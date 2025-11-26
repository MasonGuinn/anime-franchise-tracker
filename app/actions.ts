'use server'

// 1. A deep query that gets Children AND Grandchildren
const DEEP_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    title {
      english
      romaji
    }
    coverImage {
      large
    }
    relations {
      edges {
        relationType
        node {
          id
          title {
            english
            romaji
          }
          format
          episodes
          coverImage {
            medium
          }
          # LEVEL 2: Fetch the relations of the relations (Grandchildren)
          relations {
            edges {
              relationType
              node {
                id
                title {
                  english
                  romaji
                }
                format
                episodes
              }
            }
          }
        }
      }
    }
  }
}
`;

// 2. A simple query just to check if something has a Prequel
const PREQUEL_CHECK_QUERY = `
query ($search: String, $id: Int) {
  Media(search: $search, id: $id, type: ANIME, sort: SEARCH_MATCH) {
    id
    title {
      english
      romaji
    }
    relations {
      edges {
        relationType
        node {
          id
          type
        }
      }
    }
  }
}
`;

async function fetchAnilist(query: string, variables: Record<string, unknown>) {
    const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    return response.json();
}

export async function fetchFranchise(search: string) {
    // STEP 1: Find the anime the user searched for
    const currentData = await fetchAnilist(PREQUEL_CHECK_QUERY, { search });
    let media = currentData.data.Media;

    if (!media) throw new Error("Not found");

    // STEP 2: Climb up the tree to find the "ROOT" (The Original Prequel)
    // We loop purely to find the absolute start of the franchise
    let hasPrequel = true;
    let attempts = 0;

    while (hasPrequel && attempts < 5) {
        const prequelEdge = media.relations.edges.find(
            (edge: { relationType: string; node: { id: number; type?: string } }) =>
                edge.relationType === 'PREQUEL' && edge.node.type === 'ANIME'
        );

        if (prequelEdge) {
            // If we found a prequel, fetch THAT prequel and restart the loop
            const prequelId = prequelEdge.node.id;
            const prequelData = await fetchAnilist(PREQUEL_CHECK_QUERY, { id: prequelId });
            media = prequelData.data.Media;
            attempts++;
        } else {
            hasPrequel = false;
        }
    }

    // STEP 3: Now that we have the Root ID, fetch the entire tree (2 levels deep)
    const finalData = await fetchAnilist(DEEP_QUERY, { id: media.id });
    const rootNode = finalData.data.Media;

    // STEP 4: Flatten the tree into a single list and remove duplicates
    interface MediaNode {
        id: number;
        title?: { english?: string | null; romaji?: string | null } | null;
        format?: string | null;
        episodes?: number | null;
        coverImage?: { medium?: string | null; large?: string | null } | null;
        relations?: { edges: Array<{ relationType: string; node: MediaNode }> } | null;
        type?: string | null;
    }

    const allItemsMap = new Map<number, { node: MediaNode }>();

    // Helper to add items to our map
    const addItem = (node: MediaNode) => {
        // skip if it's the root itself or already added
        if (node.id === rootNode.id || allItemsMap.has(node.id)) return;

        allItemsMap.set(node.id, {
            node: {
                id: node.id,
                title: node.title,
                format: node.format,
                episodes: node.episodes,
                coverImage: node.coverImage
            }
        });
    };

    // Process Level 1 (Children)
    if (rootNode.relations && rootNode.relations.edges) {
        rootNode.relations.edges.forEach((edge: { relationType: string; node: MediaNode }) => {
            addItem(edge.node);

            // Process Level 2 (Grandchildren)
            if (edge.node.relations && edge.node.relations.edges) {
                edge.node.relations.edges.forEach((grandEdge: { relationType: string; node: MediaNode }) => {
                    addItem(grandEdge.node);
                });
            }
        });
    }

    // Reconstruct the response format your Frontend expects
    return {
        id: rootNode.id,
        title: rootNode.title,
        coverImage: rootNode.coverImage,
        relations: {
            edges: Array.from(allItemsMap.values())
        }
    };
}