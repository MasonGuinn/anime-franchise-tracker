'use client'
import { useState, useEffect } from 'react';
import { fetchFranchise, searchSuggestions, fetchAnimeDetails, AnimeNode } from './actions';
import { TimelineView, UITimelineNode } from '@/components/TimelineView';
import AnimeDetailModal from '@/components/AnimeDetailModal';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2, Search, Loader2, Filter, ArrowDownUp, EyeOff } from 'lucide-react';

type FranchiseItem = {
  id: number;
  title: string;
  cover: string;
  children: AnimeNode[];
  watchedIds: number[];
};

type SortOption = 'year' | 'title';

export default function Home() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // -- STATE --
  const [sortBy, setSortBy] = useState<SortOption>('year');
  const [hideWatched, setHideWatched] = useState(false);
  const [hideSpecials, setHideSpecials] = useState(false);

  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  const [myList, setMyList] = useState<FranchiseItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('myAnimeList_v16') || '[]'); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('myAnimeList_v16', JSON.stringify(myList)); }, [myList]);

  // -- SEARCH --
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setIsSearching(true);
        const results = await searchSuggestions(query);
        setSuggestions(results);
        setIsSearching(false);
      } else { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // -- ACTIONS --
  const handleAdd = async (id?: number) => {
    const searchTerm = id || query;
    if (!searchTerm) return;
    setIsLoading(true); setQuery(''); setSuggestions([]);

    try {
      const anime = await fetchFranchise(searchTerm as any);
      const newItem = { id: anime.id, title: anime.title.english || anime.title.romaji, cover: anime.coverImage.large || '', children: anime.children, watchedIds: [] };
      if (!myList.some(i => i.id === newItem.id as number)) {
        setMyList(prev => [...prev, newItem as any]);
        setExpandedFranchiseId(newItem.id as number);
      }
    } catch { alert('Anime not found'); }
    finally { setIsLoading(false); }
  };

  const removeitem = (id: number) => setMyList(myList.filter(item => item.id !== id));

  const toggleWatched = (franchiseId: number, animeId: number) => {
    setMyList(myList.map(item => {
      if (item.id !== franchiseId) return item;
      const isWatched = item.watchedIds.includes(animeId);
      return { ...item, watchedIds: isWatched ? item.watchedIds.filter(id => id !== animeId) : [...item.watchedIds, animeId] };
    }));
  };

  const handleShowDetails = async (id: number) => {
    setIsModalOpen(true);
    setIsModalLoading(true);
    try {
      const details = await fetchAnimeDetails(id);
      setSelectedAnime(details);
    } catch (e) { console.error(e); }
    finally { setIsModalLoading(false); }
  };

  // -- HIERARCHY BUILDER --
  const buildHierarchy = (franchise: FranchiseItem) => {
    let allNodes = franchise.children;

    if (hideSpecials) allNodes = allNodes.filter(n => ['TV', 'MOVIE'].includes(n.format));
    if (hideWatched) allNodes = allNodes.filter(n => !franchise.watchedIds.includes(n.id));

    const sortedNodes = [...allNodes].sort((a, b) => {
      if (sortBy === 'title') {
        const tA = a.title.english || a.title.romaji || '';
        const tB = b.title.english || b.title.romaji || '';
        return tA.localeCompare(tB);
      }
      return (a.year || 0) - (b.year || 0);
    });

    const root = sortedNodes.find(n => n.format === 'TV');
    const realSpine: AnimeNode[] = [];
    const spineIds = new Set<number>();

    if (root) {
      realSpine.push(root); spineIds.add(root.id);
      let current = root;
      while (true) {
        const nextSeq = sortedNodes.find(n =>
          !spineIds.has(n.id) && n.format === 'TV' && (
            n.edges.some(e => e.id === current.id && e.relationType === 'PREQUEL') ||
            current.edges.some(e => e.id === n.id && e.relationType === 'SEQUEL')
          )
        );
        if (nextSeq) { realSpine.push(nextSeq); spineIds.add(nextSeq.id); current = nextSeq; } else { break; }
      }
    }

    const leftoverTV = sortedNodes.filter(n => n.format === 'TV' && !spineIds.has(n.id));
    leftoverTV.forEach(node => {
      const relatedToSpine = realSpine.some(spineItem => node.edges.some(e => e.id === spineItem.id && e.relationType === 'PREQUEL'));
      const isSpinOff = node.edges.some(e => ['SPIN_OFF', 'SIDE_STORY', 'ALTERNATIVE'].includes(e.relationType));
      if (relatedToSpine && !isSpinOff) { realSpine.push(node); spineIds.add(node.id); }
    });

    realSpine.sort((a, b) => (a.year || 0) - (b.year || 0));

    const extrasPool = sortedNodes.filter(n => !spineIds.has(n.id));
    const assignments = new Map<number, AnimeNode[]>();
    realSpine.forEach(tv => assignments.set(tv.id, []));

    extrasPool.forEach(extra => {
      const isRelated = (child: AnimeNode, parent: AnimeNode) =>
        parent.edges.some(e => e.id === child.id) || child.edges.some(e => e.id === parent.id);

      const parents = realSpine.filter(tv => isRelated(extra, tv));
      let bestParent;
      if (parents.length === 0) {
        const recursiveParent = realSpine.find(tv => extrasPool.some(sibling => isRelated(sibling, tv) && isRelated(extra, sibling)));
        bestParent = recursiveParent || realSpine[0];
      } else {
        const chronologicalParents = [...parents].sort((a, b) => (a.year || 0) - (b.year || 0));
        bestParent = chronologicalParents.find(p => p.year <= extra.year) || chronologicalParents[chronologicalParents.length - 1];
      }

      if (bestParent) {
        const edge = bestParent.edges.find(e => e.id === extra.id) || extra.edges.find(e => e.id === bestParent.id);
        assignments.get(bestParent.id)?.push({ ...extra, relationToParent: edge?.relationType || undefined } as any);
      }
    });

    return realSpine.map(tv => {
      const rawExtras = assignments.get(tv.id) || [];
      const rootExtras: UITimelineNode[] = [];
      const nodeMap = new Map<number, UITimelineNode>();

      rawExtras.sort((a, b) => {
        if (sortBy === 'title') return (a.title.english || '').localeCompare(b.title.english || '');
        return (a.year || 0) - (b.year || 0);
      });

      rawExtras.forEach(e => { nodeMap.set(e.id, { ...e, childrenNodes: [] }); });

      nodeMap.forEach(node => {
        let parentFound = false;
        for (const [potentialParentId, potentialParent] of nodeMap) {
          if (node.id === potentialParentId) continue;

          const parentEdge = potentialParent.edges.find(e => e.id === node.id);
          const childEdge = node.edges.find(e => e.id === potentialParentId);

          const canNest = (parentEdge && ['SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY', 'OTHER'].includes(parentEdge.relationType)) ||
            (childEdge && ['SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY'].includes(childEdge.relationType));

          if (canNest) {
            const relation = parentEdge ? parentEdge.relationType : 'SIDE_STORY';
            potentialParent.childrenNodes?.push({ ...node, relationToParent: relation });
            parentFound = true;
            break;
          }
        }
        if (!parentFound) rootExtras.push(node);
      });
      return { main: tv, extras: rootExtras };
    });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8 font-sans">

      <AnimeDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        anime={selectedAnime}
        isLoading={isModalLoading}
      />

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white"><Folder className="text-indigo-500 fill-indigo-500/20" /> Franchise Timeline</h1>

        {/* SEARCH */}
        <div className="relative mb-6 z-50">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Search franchise (e.g. One Piece)..." className="w-full p-4 pl-11 rounded-xl bg-[#18181b] border border-zinc-800 focus:outline-none focus:border-indigo-500 text-white placeholder-zinc-500 transition-all" />
              <Search className="absolute left-4 top-4 text-zinc-500" size={20} />
              {isSearching && <Loader2 className="absolute right-4 top-4 text-indigo-500 animate-spin" size={20} />}
            </div>
            <button onClick={() => handleAdd()} disabled={isLoading} className="bg-indigo-600 px-8 py-3 rounded-xl hover:bg-indigo-500 font-bold flex items-center gap-2 text-white shadow-lg shadow-indigo-900/20 disabled:opacity-50">{isLoading ? <Loader2 className="animate-spin" size={22} /> : <Plus size={22} />} Add</button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 w-[calc(100%-130px)] mt-2 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
              {suggestions.map((item) => (
                <div key={item.id} onClick={() => handleAdd(item.id)} className="flex items-center gap-4 p-3 hover:bg-[#27272a] cursor-pointer border-b border-zinc-800/50 last:border-0">
                  {item.coverImage?.medium && <Image src={item.coverImage.medium} alt="cover" width={40} height={56} className="w-10 h-14 object-cover rounded" />}
                  <div><div className="font-bold text-zinc-200">{item.title.english || item.title.romaji}</div><div className="text-xs text-zinc-500 flex gap-2"><span>{item.startDate?.year}</span><span className="uppercase border border-zinc-700 px-1 rounded bg-zinc-800/50">{item.format}</span></div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-[#121214] border border-zinc-800/50 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-zinc-400 mr-2"><Filter size={16} /> Filters:</div>
          <button onClick={() => setHideWatched(!hideWatched)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hideWatched ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}><EyeOff size={14} /> Hide Watched</button>
          <button onClick={() => setHideSpecials(!hideSpecials)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hideSpecials ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}><Filter size={14} /> Main Series Only</button>
          <div className="w-px h-6 bg-zinc-800 mx-2"></div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mr-2"><ArrowDownUp size={16} /> Sort:</div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"><option value="year">Release Date</option><option value="title">Title (A-Z)</option></select>
        </div>

        {/* LIST */}
        <div className="space-y-6">
          {myList.map((franchise) => {
            const groups = buildHierarchy(franchise);
            const isExpanded = expandedFranchiseId === franchise.id;
            const progress = franchise.watchedIds.length;
            const total = franchise.children.length;

            return (
              <div key={franchise.id} className="bg-[#18181b] rounded-2xl overflow-hidden border border-zinc-800/60 shadow-xl">
                <div onClick={() => setExpandedFranchiseId(isExpanded ? null : franchise.id)} className="p-5 flex items-center gap-5 cursor-pointer hover:bg-[#27272a] transition-colors group relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/20 w-full"><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(progress / total) * 100}%` }} /></div>
                  <Image src={franchise.cover} alt="cover" width={50} height={70} className="w-12 h-16 object-cover rounded shadow-md z-10" />
                  <div className="flex-1 z-10">
                    {/* --- ADDED "FRANCHISE" HERE --- */}
                    <h2 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {franchise.title} <span className="opacity-50 text-lg font-normal">Franchise</span>
                    </h2>
                    <div className="text-sm text-zinc-500 mt-1">{progress} / {total} Watched</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeitem(franchise.id); }} className="text-zinc-600 hover:text-red-400 p-3 z-10"><Trash2 size={20} /></button>
                  {isExpanded ? <ChevronDown className="text-zinc-500 z-10" /> : <ChevronRight className="text-zinc-500 z-10" />}
                </div>

                {isExpanded && (
                  <TimelineView
                    franchiseId={franchise.id}
                    groups={groups as any}
                    watchedIds={franchise.watchedIds}
                    onToggleWatched={toggleWatched}
                    onTitleClick={handleShowDetails}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}