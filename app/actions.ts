'use server'

// --- TYPES ---
export interface TitleData { english?: string | null; romaji?: string | null; native?: string | null; }
interface RelationEdge { relationType: string; node: { id: number; type: string; format: string }; }
interface MediaData {
    id: number;
    title: TitleData;
    format: string;
    startDate?: { year?: number; month?: number; day?: number };
    popularity?: number;
    coverImage?: { large?: string; medium?: string; extraLarge?: string };
    relations?: { edges: RelationEdge[] };
    bannerImage?: string;
    description?: string;
    episodes?: number;
    duration?: number;
    status?: string;
    averageScore?: number;
    genres?: string[];
    studios?: { nodes: { name: string }[] };
}
interface AniListResponse { data: { Page: { media: MediaData[] } }; }
interface SingleResponse { data: { Media: MediaData }; }

export interface AnimeNode {
    id: number;
    title: TitleData;
    format: string;
    year: number;
    cover: string;
    popularity: number;
    edges: { id: number; relationType: string }[];
}

export interface FranchiseResult {
    id: number;
    title: TitleData;
    coverImage: { large?: string; medium?: string };
    children: AnimeNode[];
}

// --- QUERIES ---

const SUGGESTION_QUERY = `
query ($search: String) {
  Page(perPage: 5) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      title { english romaji }
      format
      startDate { year }
      coverImage { medium }
    }
  }
}
`;

const SEARCH_QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    relations {
      edges {
        relationType
        node { id type }
      }
    }
  }
}
`;

const PREQUEL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    relations {
      edges {
        relationType
        node { id type }
      }
    }
  }
}
`;

const BATCH_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids) {
      id
      title { english romaji }
      format
      startDate { year }
      popularity 
      coverImage { large medium }
      relations {
        edges {
          relationType
          node { id type format }
        }
      }
    }
  }
}
`;

// --- NEW: DETAILS QUERY (Restored) ---
const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    title { english romaji native }
    coverImage { large extraLarge }
    bannerImage
    description
    format
    episodes
    duration
    status
    averageScore
    popularity
    startDate { year month day }
    genres
    studios(isMain: true) {
      nodes { name }
    }
  }
}
`;

// --- FETCH HELPER ---
async function fetchAPI(query: string, variables: any) {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    return response.json();
}

// --- ACTIONS ---

// 1. Live Search
export async function searchSuggestions(search: string) {
    if (!search || search.length < 3) return [];
    const data = await fetchAPI(SUGGESTION_QUERY, { search }) as AniListResponse;
    return data.data.Page.media;
}

// 2. Fetch Details (For Modal) - THIS WAS MISSING
export async function fetchAnimeDetails(id: number) {
    const data = await fetchAPI(DETAILS_QUERY, { id }) as SingleResponse;
    return data.data.Media;
}

// 3. Main Crawler
export async function fetchFranchise(searchOrId: string | number): Promise<FranchiseResult> {
    let currentId: number;

    if (typeof searchOrId === 'number') {
        currentId = searchOrId;
    } else {
        const searchRes = await fetchAPI(SEARCH_QUERY, { search: searchOrId }) as SingleResponse;
        currentId = searchRes.data.Media?.id;
    }

    if (!currentId) throw new Error("Anime not found");

    // Climb to Root
    let attempts = 0;
    while (attempts < 5) {
        const data = await fetchAPI(PREQUEL_QUERY, { id: currentId }) as SingleResponse;
        const media = data.data.Media;
        const prequel = media.relations?.edges?.find(e => e.relationType === 'PREQUEL' && e.node.type === 'ANIME');

        if (prequel) {
            currentId = prequel.node.id;
            attempts++;
        } else {
            break;
        }
    }

    const rootId = currentId;

    // CRAWLER
    const visitedIds = new Set<number>();
    let queue = [rootId];
    const allNodesMap = new Map<number, AnimeNode>();

    const ALLOWED_FORMATS = ['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'TV_SHORT'];
    // Removed 'OTHER' to prevent bad crossovers
    const TRAVERSE_TYPES = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY'];

    let loopCount = 0;
    while (queue.length > 0 && loopCount < 10) {
        const batchRes = await fetchAPI(BATCH_QUERY, { ids: queue }) as AniListResponse;
        const mediaList = batchRes.data.Page.media;
        queue = [];

        for (const media of mediaList) {
            if (!media || !ALLOWED_FORMATS.includes(media.format)) continue;

            const edges = media.relations?.edges
                ?.filter(e => TRAVERSE_TYPES.includes(e.relationType) && e.node.type === 'ANIME')
                .map(e => ({ id: e.node.id, relationType: e.relationType })) || [];

            allNodesMap.set(media.id, {
                id: media.id,
                title: media.title || { romaji: 'Unknown' },
                format: media.format,
                year: media.startDate?.year ?? 9999,
                popularity: media.popularity || 0,
                cover: media.coverImage?.large || media.coverImage?.medium || '',
                edges: edges
            });

            visitedIds.add(media.id);

            for (const edge of edges) {
                if (!visitedIds.has(edge.id) && !queue.includes(edge.id)) {
                    queue.push(edge.id);
                }
            }
        }
        loopCount++;
    }

    const nodes = Array.from(allNodesMap.values());
    if (nodes.length === 0) throw new Error("No nodes found");

    // Pick the Face of the Franchise (Highest Popularity)
    const faceNode = nodes.reduce((prev, current) =>
        (current.popularity > prev.popularity) ? current : prev
    );

    return {
        id: faceNode.id,
        title: faceNode.title,
        coverImage: { large: faceNode.cover },
        children: nodes
    };
}