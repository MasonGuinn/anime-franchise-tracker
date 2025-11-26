'use server'

// --- TYPES ---
interface TitleData { english?: string | null; romaji?: string | null; }
interface RelationNode { id: number; type?: string; title?: TitleData; format?: string; startDate?: { year?: number }; coverImage?: { medium?: string; large?: string }; relations?: { edges: any[] }; }
interface MediaData { id: number; title: TitleData; format?: string; startDate?: { year?: number }; coverImage?: { large?: string }; relations?: { edges: any[] }; }
interface AniListResponse<T> { data: { Media: T }; }

// Updated AnimeNode
interface AnimeNode {
    id: number;
    title: TitleData;
    format: string;
    year: number;
    cover: string;
    edges: { id: number; relationType: string }[];
}

interface FranchiseResult {
    id: number;
    title: TitleData;
    coverImage: { large?: string; medium?: string };
    children: AnimeNode[];
}

// --- QUERIES ---
const DEEP_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    title { english romaji }
    coverImage { large }
    startDate { year }
    format
    relations {
      edges {
        relationType
        node {
          id
          title { english romaji }
          format
          startDate { year }
          coverImage { medium }
          relations {
            edges {
              relationType
              node { 
                id 
                title { english romaji }
                format 
                startDate { year }
                coverImage { medium }
              }
            }
          }
        }
      }
    }
  }
}
`;

const PREQUEL_CHECK_QUERY = `
query ($search: String, $id: Int) {
  Media(search: $search, id: $id, type: ANIME, sort: SEARCH_MATCH) {
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

// --- FETCH HELPER ---
async function fetchAnilist<T>(query: string, variables: Record<string, string | number>): Promise<AniListResponse<T>> {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data;
}

// --- MAIN FUNCTION ---
export async function fetchFranchise(search: string): Promise<FranchiseResult> {
    // 1. Find Target
    const currentData = await fetchAnilist<MediaData>(PREQUEL_CHECK_QUERY, { search });
    let media = currentData.data.Media;
    if (!media) throw new Error("Anime not found");

    // 2. Climb to Root
    let hasPrequel = true;
    let attempts = 0;
    while (hasPrequel && attempts < 10) {
        const prequelEdge = media.relations?.edges?.find(e => e.relationType === 'PREQUEL' && e.node.type === 'ANIME');
        if (prequelEdge) {
            const prequelData = await fetchAnilist<MediaData>(PREQUEL_CHECK_QUERY, { id: prequelEdge.node.id });
            if (prequelData.data.Media) { media = prequelData.data.Media; attempts++; } else break;
        } else { hasPrequel = false; }
    }

    // 3. Fetch Tree
    const finalData = await fetchAnilist<MediaData>(DEEP_QUERY, { id: media.id });
    const rootNode = finalData.data.Media;
    if (!rootNode) throw new Error("Failed to fetch tree");

    // 4. Flatten & Process with STRICT FILTERING
    const allItemsMap = new Map<number, AnimeNode>();
    const ALLOWED_FORMATS = ['TV', 'MOVIE', 'OVA', 'SPECIAL', 'ONA', 'TV_SHORT'];

    // THE FIX: Only allow these relationships. This blocks "Character", "Other", "Source".
    const VALID_RELATIONS = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY'];

    const addItem = (node: any) => {
        if (!node || !node.format || !ALLOWED_FORMATS.includes(node.format) || allItemsMap.has(node.id)) return;

        // Capture edges, but only valid ones
        const edges = node.relations?.edges
            ?.filter((e: any) => VALID_RELATIONS.includes(e.relationType))
            .map((e: any) => ({
                id: e.node.id,
                relationType: e.relationType
            })) || [];

        allItemsMap.set(node.id, {
            id: node.id,
            title: node.title || { romaji: 'Unknown' },
            format: node.format,
            year: node.startDate?.year ?? 9999,
            cover: node.coverImage?.medium || node.coverImage?.large || '',
            edges: edges
        });
    };

    addItem(rootNode);
    if (rootNode.relations?.edges) {
        rootNode.relations.edges.forEach((edge: any) => {
            // Only traverse down if the relation type is valid
            if (edge?.node && VALID_RELATIONS.includes(edge.relationType)) {
                addItem(edge.node);
                if (edge.node.relations?.edges) {
                    edge.node.relations.edges.forEach((grandEdge: any) => {
                        if (grandEdge?.node && VALID_RELATIONS.includes(grandEdge.relationType)) {
                            addItem(grandEdge.node);
                        }
                    });
                }
            }
        });
    }

    return {
        id: rootNode.id,
        title: rootNode.title || { romaji: 'Unknown' },
        coverImage: rootNode.coverImage || {},
        children: Array.from(allItemsMap.values())
    };
}