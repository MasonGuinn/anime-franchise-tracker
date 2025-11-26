'use server'
import { unstable_cache } from 'next/cache';

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
interface DiscoverResponse {
  data: {
    trending: { media: MediaData[] };
    popular: { media: MediaData[] };
    upcoming: { media: MediaData[] };
  }
}

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

const DISCOVER_QUERY = `
query {
  trending: Page(perPage: 10) {
    media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
      ...mediaFields
    }
  }
  popular: Page(perPage: 10) {
    media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
      ...mediaFields
    }
  }
  upcoming: Page(perPage: 10) {
    media(sort: POPULARITY_DESC, type: ANIME, status: NOT_YET_RELEASED, isAdult: false) {
      ...mediaFields
    }
  }
}

fragment mediaFields on Media {
  id
  title { english romaji }
  coverImage { large }
  startDate { year }
  format
  averageScore
}
`;

const SUGGESTION_QUERY = `
query ($search: String) {
  Page(perPage: 5) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
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
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
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
async function fetchAPI(query: string, variables?: any) {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    // We handle caching manually with unstable_cache, so we tell fetch to revalidate often
    // to ensure the cache layer is the one controlling the TTL
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please wait a moment.");
    }
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

// --- INTERNAL CACHED FUNCTIONS ---

const getDiscoverData = unstable_cache(
  async () => {
    const data = await fetchAPI(DISCOVER_QUERY) as DiscoverResponse;
    return {
      trending: data.data.trending.media,
      popular: data.data.popular.media,
      upcoming: data.data.upcoming.media
    };
  },
  ['discover-data'],
  { revalidate: 43200 } // Cache for 12 hours
);

const getSearchSuggestions = unstable_cache(
  async (search: string) => {
    if (!search || search.length < 3) return [];
    const data = await fetchAPI(SUGGESTION_QUERY, { search }) as AniListResponse;
    return data.data.Page.media;
  },
  ['search-suggestions'], // Key will include the search parameter automatically
  { revalidate: 3600 } // Cache for 1 hour
);

const getAnimeDetails = unstable_cache(
  async (id: number) => {
    const data = await fetchAPI(DETAILS_QUERY, { id }) as SingleResponse;
    return data.data.Media;
  },
  ['anime-details'],
  { revalidate: 604800 } // Cache for 7 days
);

// The "Heavy Lifter" Crawler - Cached for 7 days
const getFranchiseData = unstable_cache(
  async (startId: number) => {
    let currentId = startId;

    // 1. Climb to Root (Find oldest ancestor)
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

    // 2. CRAWL (Breadth-First Search)
    const visitedIds = new Set<number>();
    let queue = [rootId];
    const allNodesMap = new Map<number, AnimeNode>();

    const ALLOWED_FORMATS = ['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'TV_SHORT'];

    // IMPORTANT: 'OTHER' and 'CHARACTER' are excluded to prevent Crossovers (e.g. One Piece -> Dragon Ball)
    const TRAVERSE_TYPES = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY'];

    let loopCount = 0;
    // Loop limit protects against massive franchises consuming too much RAM/Time
    while (queue.length > 0 && loopCount < 10) {
      const batchRes = await fetchAPI(BATCH_QUERY, { ids: queue }) as AniListResponse;
      const mediaList = batchRes.data.Page.media;
      queue = []; // Clear queue for next batch

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

        // Add neighbors to queue if not visited
        for (const edge of edges) {
          if (!visitedIds.has(edge.id) && !queue.includes(edge.id)) {
            queue.push(edge.id);
          }
        }
      }
      loopCount++;
    }

    const nodes = Array.from(allNodesMap.values());
    if (nodes.length === 0) return null; // Safety check

    // 3. Determine "Face of the Franchise" based on popularity
    // This prevents "Monsters" (Prequel) from being the title instead of "One Piece"
    const faceNode = nodes.reduce((prev, current) =>
      (current.popularity > prev.popularity) ? current : prev
    );

    return {
      id: faceNode.id,
      title: faceNode.title,
      coverImage: { large: faceNode.cover },
      children: nodes
    };
  },
  ['franchise-crawler'], // Cache Key
  { revalidate: 604800 } // Revalidate every 7 days
);

// --- EXPORTED ACTIONS ---

export async function fetchDiscoverData() {
  return await getDiscoverData();
}

export async function searchSuggestions(search: string) {
  return await getSearchSuggestions(search);
}

export async function fetchAnimeDetails(id: number) {
  return await getAnimeDetails(id);
}

export async function fetchFranchise(searchOrId: string | number): Promise<FranchiseResult> {
  let currentId: number;

  // If string, search first to get an ID
  if (typeof searchOrId === 'number') {
    currentId = searchOrId;
  } else {
    const searchRes = await fetchAPI(SEARCH_QUERY, { search: searchOrId }) as SingleResponse;
    currentId = searchRes.data.Media?.id;
  }

  if (!currentId) throw new Error("Anime not found");

  // Trigger the cached crawler
  const result = await getFranchiseData(currentId);
  if (!result) throw new Error("Failed to load franchise data");

  return result;
}