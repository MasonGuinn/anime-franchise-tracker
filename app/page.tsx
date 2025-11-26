'use client'
import { useState, useEffect } from 'react';
import { fetchFranchise, searchSuggestions, fetchAnimeDetails, fetchDiscoverData, AnimeNode } from './actions';
import { TimelineView, UITimelineNode } from '@/components/TimelineView';
import AnimeDetailModal from '@/components/AnimeDetailModal';
import DiscoverSection from '@/components/DiscoverSection'; // New Import
import LoginButton from '@/components/LoginButton';
import { useUserCollections, type FranchiseItem } from '@/hooks/useUserCollections';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2, Search, Loader2, Filter, ArrowDownUp, EyeOff, Flame, Calendar, Trophy, Library, LayoutGrid } from 'lucide-react';

type SortOption = 'year' | 'title';
type TabOption = 'discover' | 'library';

export default function Home() {
  // -- AUTH STATE --
  const [user, setUser] = useState<any | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // -- USER COLLECTIONS --
  const { myList, isLoading: isCollectionsLoading, isSyncing, addFranchise, removeFranchise, toggleWatched } = useUserCollections(user);

  // -- STATE --
  const [activeTab, setActiveTab] = useState<TabOption>('discover');
  const [discoverData, setDiscoverData] = useState<{ trending: any[], popular: any[], upcoming: any[] } | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>('year');
  const [hideWatched, setHideWatched] = useState(false);
  const [hideSpecials, setHideSpecials] = useState(false);

  const [selectedAnime, setSelectedAnime] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // -- FETCH DATA --
  useEffect(() => {
    async function load() {
      const data = await fetchDiscoverData();
      setDiscoverData(data);
    }
    load();
  }, []);

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

  // -- HANDLERS --
  const handleAdd = async (id?: number) => {
    const searchTerm = id || query;
    if (!searchTerm) return;
    setIsLoading(true); setQuery(''); setSuggestions([]);

    try {
      const anime = await fetchFranchise(searchTerm as any);
      const newItem: FranchiseItem = {
        id: anime.id,
        title: anime.title.english || anime.title.romaji || 'Unknown',
        cover: anime.coverImage.large || '',
        children: anime.children,
        watchedIds: []
      }; const added = addFranchise(newItem);
      if (added) {
        setExpandedFranchiseId(newItem.id);
        setActiveTab('library');
      } else {
        alert('Already in your library!');
      }
    } catch { alert('Anime not found'); }
    finally { setIsLoading(false); }
  };

  const removeitem = (id: number) => removeFranchise(id);

  const handleShowDetails = async (id: number) => {
    setIsModalOpen(true); setIsModalLoading(true);
    try {
      const details = await fetchAnimeDetails(id);
      setSelectedAnime(details);
    } catch (e) { console.error(e); }
    finally { setIsModalLoading(false); }
  };

  // -- HIERARCHY LOGIC --
  const buildHierarchy = (franchise: FranchiseItem) => {
    let allNodes = franchise.children;
    if (hideSpecials) allNodes = allNodes.filter(n => ['TV', 'MOVIE'].includes(n.format));
    if (hideWatched) allNodes = allNodes.filter(n => !franchise.watchedIds.includes(n.id));
    const sortedNodes = [...allNodes].sort((a, b) => sortBy === 'title' ? (a.title.english || '').localeCompare(b.title.english || '') : (a.year || 0) - (b.year || 0));

    const root = sortedNodes.find(n => n.format === 'TV');
    const realSpine: AnimeNode[] = [];
    const spineIds = new Set<number>();

    if (root) {
      realSpine.push(root); spineIds.add(root.id);
      let current = root;
      while (true) {
        const nextSeq = sortedNodes.find(n => !spineIds.has(n.id) && n.format === 'TV' && (n.edges.some(e => e.id === current.id && e.relationType === 'PREQUEL') || current.edges.some(e => e.id === n.id && e.relationType === 'SEQUEL')));
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
      const isRelated = (c: AnimeNode, p: AnimeNode) => p.edges.some(e => e.id === c.id) || c.edges.some(e => e.id === p.id);
      const parents = realSpine.filter(tv => isRelated(extra, tv));
      let bestParent;
      if (parents.length === 0) {
        const recursiveParent = realSpine.find(tv => extrasPool.some(sibling => isRelated(sibling, tv) && isRelated(extra, sibling)));
        bestParent = recursiveParent || realSpine[0];
      } else {
        const cp = [...parents].sort((a, b) => (a.year || 0) - (b.year || 0));
        bestParent = cp.find(p => p.year <= extra.year) || cp[cp.length - 1];
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
      rawExtras.sort((a, b) => sortBy === 'title' ? (a.title.english || '').localeCompare(b.title.english || '') : (a.year || 0) - (b.year || 0));
      rawExtras.forEach(e => { nodeMap.set(e.id, { ...e, childrenNodes: [] }); });
      nodeMap.forEach(node => {
        let parentFound = false;
        for (const [potentialParentId, potentialParent] of nodeMap) {
          if (node.id === potentialParentId) continue;
          const parentEdge = potentialParent.edges.find(e => e.id === node.id);
          const childEdge = node.edges.find(e => e.id === potentialParentId);
          const canNest = (parentEdge && ['SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY', 'OTHER'].includes(parentEdge.relationType)) || (childEdge && ['SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'SUMMARY'].includes(childEdge.relationType));
          if (canNest) {
            potentialParent.childrenNodes?.push({ ...node, relationToParent: parentEdge ? parentEdge.relationType : 'SIDE_STORY' });
            parentFound = true; break;
          }
        }
        if (!parentFound) rootExtras.push(node);
      });
      return { main: tv, extras: rootExtras };
    });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8 font-sans">

      {/* MODAL */}
      <AnimeDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        anime={selectedAnime}
        isLoading={isModalLoading}
      />

      <div className="max-w-5xl mx-auto">

        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
            <Folder className="text-indigo-500 fill-indigo-500/20" /> Franchise Timeline
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex bg-[#18181b] p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setActiveTab('discover')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'discover' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <LayoutGrid size={16} /> Discover
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'library' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Library size={16} /> My Collection {isMounted && <span className="bg-indigo-600 text-[10px] px-1.5 rounded-full ml-1">{myList.length}</span>}
              </button>
            </div>

            <LoginButton />
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative mb-10 z-50">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Search franchise (e.g. One Piece)..." className="w-full p-4 pl-11 rounded-xl bg-[#18181b] border border-zinc-800 focus:outline-none focus:border-indigo-500 text-white placeholder-zinc-500 transition-all" />
              <Search className="absolute left-4 top-4 text-zinc-500" size={20} />
              {isSearching && <Loader2 className="absolute right-4 top-4 text-indigo-500 animate-spin" size={20} />}
            </div>
            <button onClick={() => handleAdd()} disabled={isLoading} className="bg-indigo-600 px-8 py-3 rounded-xl hover:bg-indigo-500 font-bold flex items-center gap-2 text-white shadow-lg shadow-indigo-900/20 disabled:opacity-50">{isLoading ? <Loader2 className="animate-spin" size={22} /> : <Plus size={22} />} Add</button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 w-[calc(100%-130px)] mt-2 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 z-50">
              {suggestions.map((item) => (
                <div key={item.id} onClick={() => handleAdd(item.id)} className="flex items-center gap-4 p-3 hover:bg-[#27272a] cursor-pointer border-b border-zinc-800/50 last:border-0">
                  {item.coverImage?.medium && <Image src={item.coverImage.medium} alt="cover" width={40} height={56} className="w-10 h-14 object-cover rounded" />}
                  <div><div className="font-bold text-zinc-200">{item.title.english || item.title.romaji}</div><div className="text-xs text-zinc-500 flex gap-2"><span>{item.startDate?.year}</span><span className="uppercase border border-zinc-700 px-1 rounded bg-zinc-800/50">{item.format}</span></div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- MAIN CONTENT --- */}
        {activeTab === 'discover' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DiscoverSection
              title="Trending Now"
              icon={Flame}
              iconColor="text-indigo-400"
              data={discoverData?.trending || []}
              onAdd={handleAdd}
              onCardClick={handleShowDetails}
            />
            <DiscoverSection
              title="All Time Popular"
              icon={Trophy}
              iconColor="text-amber-400"
              data={discoverData?.popular || []}
              onAdd={handleAdd}
              onCardClick={handleShowDetails}
            />
            <DiscoverSection
              title="Upcoming Hype"
              icon={Calendar}
              iconColor="text-emerald-400"
              data={discoverData?.upcoming || []}
              onAdd={handleAdd}
              onCardClick={handleShowDetails}
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* LIBRARY TOOLBAR */}
            <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-[#121214] border border-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-zinc-400 mr-2"><Filter size={16} /> Filters:</div>
              <button onClick={() => setHideWatched(!hideWatched)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hideWatched ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}><EyeOff size={14} /> Hide Watched</button>
              <button onClick={() => setHideSpecials(!hideSpecials)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hideSpecials ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}><Filter size={14} /> Main Series Only</button>
              <div className="w-px h-6 bg-zinc-800 mx-2"></div>
              <div className="flex items-center gap-2 text-sm text-zinc-400 mr-2"><ArrowDownUp size={16} /> Sort:</div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"><option value="year">Release Date</option><option value="title">Title (A-Z)</option></select>
            </div>

            {/* LIBRARY LIST */}
            <div className="space-y-6">
              {myList.length === 0 && (
                <div className="text-center py-20 text-zinc-500">
                  <p className="mb-2">Your collection is empty.</p>
                  <button onClick={() => setActiveTab('discover')} className="text-indigo-400 hover:underline">Go discover some anime!</button>
                </div>
              )}

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
                        <h2 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors">{franchise.title} <span className="opacity-50 text-lg font-normal">Franchise</span></h2>
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
        )}
      </div>
    </div>
  );
}