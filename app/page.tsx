'use client'
import { useState, useEffect } from 'react';
import { fetchFranchise } from './actions';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

// -- TYPES --
type AnimeNode = {
  id: number;
  format: string;
  year: number;
  cover: string;
  edges: { id: number; relationType: string }[];
  title: { english?: string; romaji?: string; };
  childrenNodes?: AnimeNode[];
};

type FranchiseItem = {
  id: number;
  title: string;
  cover: string;
  children: AnimeNode[];
  watchedIds: number[];
};

// -- RECURSIVE ITEM COMPONENT (Improved Button) --
const RecursiveItem = ({ node, franchiseId, watchedIds, onToggleWatched, depth = 0 }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.childrenNodes && node.childrenNodes.length > 0;
  const isWatched = watchedIds.includes(node.id);

  return (
    <div className="flex flex-col">
      {/* The Item Row */}
      <div
        className={`flex items-center gap-3 p-2 rounded hover:bg-[#1f232e] transition group border border-transparent hover:border-zinc-800 ${depth > 0 ? 'ml-6 border-l-2 border-l-zinc-800 pl-3' : ''}`}
        onClick={(e) => {
          if (hasChildren) { e.stopPropagation(); setIsOpen(!isOpen); }
        }}
      >
        <button onClick={(e) => { e.stopPropagation(); onToggleWatched(franchiseId, node.id); }} className="scale-90 hover:scale-110 transition shrink-0">
          {isWatched
            ? <CheckCircle2 className="text-indigo-500 fill-indigo-500/10" size={20} />
            : <Circle className="text-zinc-700 group-hover:text-indigo-400" size={20} />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer">
          <div className="text-sm text-zinc-300 group-hover:text-white transition-colors truncate">
            {node.title?.english || node.title?.romaji}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${node.format === 'MOVIE' ? 'border-emerald-900/50 text-emerald-500 bg-emerald-500/5' : 'border-zinc-700 text-zinc-500 bg-zinc-800'
              }`}>
              {node.format}
            </span>

            {/* === THE DROPDOWN BUTTON === */}
            {hasChildren && (
              <button
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all duration-200 active:scale-95 ${isOpen
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_10px_-3px_rgba(99,102,241,0.5)]'
                  : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500'
                  }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
              >
                <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                  <ChevronRight size={10} strokeWidth={3} />
                </span>
                <span className="font-bold">{node.childrenNodes.length} Related</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested Children */}
      {isOpen && hasChildren && (
        <div className="animate-in slide-in-from-top-1 fade-in duration-200 mb-2 mt-1">
          {node.childrenNodes.map((child: any) => (
            <RecursiveItem
              key={child.id}
              node={child}
              franchiseId={franchiseId}
              watchedIds={watchedIds}
              onToggleWatched={onToggleWatched}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// -- ERA COMPONENT --
const EraGroup = ({ group, franchiseId, watchedIds, onToggleWatched }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMainWatched = watchedIds.includes(group.main.id);
  const hasExtras = group.extras.length > 0;

  return (
    <div className="relative pl-6 border-l-2 border-zinc-800">
      <div className="absolute -left-[9px] top-6 w-4 h-4 rounded-full bg-indigo-600 border-4 border-[#09090b]"></div>

      <div className={`mb-4 group ${hasExtras ? 'cursor-pointer' : ''}`} onClick={() => hasExtras && setIsOpen(!isOpen)}>
        <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${isOpen ? 'bg-[#18181b] border-indigo-500/30 shadow-lg' : 'bg-[#18181b] border-zinc-800 hover:bg-[#202024] hover:border-zinc-700'}`}>
          <button onClick={(e) => { e.stopPropagation(); onToggleWatched(franchiseId, group.main.id); }} className="mt-1 z-10 hover:scale-110 transition shrink-0">
            {isMainWatched ? <CheckCircle2 className="text-indigo-500 fill-indigo-500/10" size={24} /> : <Circle className="text-zinc-600 hover:text-indigo-400" size={24} />}
          </button>
          {group.main.cover && <Image src={group.main.cover} alt="cover" width={60} height={85} className="w-14 h-20 object-cover rounded shadow-lg shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded uppercase tracking-wider">{group.main.year}</span>
                <span className="text-xs text-zinc-500 uppercase">{group.main.format}</span>
              </div>
              {hasExtras && <div className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><ChevronDown size={20} /></div>}
            </div>
            <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors truncate">{group.main.title?.english || group.main.title?.romaji}</h3>
            {hasExtras ? (
              <div className="text-sm text-zinc-400 mt-2 flex items-center gap-2">
                <Folder size={14} className="text-zinc-500" />
                <span>{group.extras.length} items in collection</span>
              </div>
            ) : <div className="text-sm text-zinc-600 mt-2 italic">No side stories</div>}
          </div>
        </div>
      </div>

      {isOpen && hasExtras && (
        <div className="pl-4 mb-8 space-y-1">
          {group.extras.map((extraNode: any) => (
            <RecursiveItem
              key={extraNode.id}
              node={extraNode}
              franchiseId={franchiseId}
              watchedIds={watchedIds}
              onToggleWatched={onToggleWatched}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// -- MAIN PAGE --
export default function Home() {
  const [query, setQuery] = useState('');
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<number | null>(null);
  // Bump version to v9 to force clear any corrupted "Chihayafuru" data from local storage
  const [myList, setMyList] = useState<FranchiseItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('myAnimeList_v9');
      return saved ? (JSON.parse(saved) as FranchiseItem[]) : [];
    } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('myAnimeList_v9', JSON.stringify(myList)); }, [myList]);

  const handleAdd = async () => {
    if (!query) return;
    try {
      const anime = await fetchFranchise(query);
      const newItem = { id: anime.id, title: anime.title.english || anime.title.romaji, cover: anime.coverImage.large || '', children: anime.children, watchedIds: [] };
      if (!myList.some(i => i.id === newItem.id as number)) {
        setMyList([...myList, newItem as any]);
        setExpandedFranchiseId(newItem.id as number);
      }
      setQuery('');
    } catch { alert('Anime not found'); }
  };

  const removeitem = (id: number) => setMyList(myList.filter(item => item.id !== id));
  const toggleWatched = (franchiseId: number, animeId: number) => {
    setMyList(myList.map(item => {
      if (item.id !== franchiseId) return item;
      const isWatched = item.watchedIds.includes(animeId);
      return { ...item, watchedIds: isWatched ? item.watchedIds.filter(id => id !== animeId) : [...item.watchedIds, animeId] };
    }));
  };

  // --- HIERARCHY BUILDER ---
  const buildHierarchy = (allNodes: AnimeNode[]) => {
    const spine = allNodes.filter(n => n.format === 'TV').sort((a, b) => a.year - b.year);
    const extrasPool = allNodes.filter(n => n.format !== 'TV');

    const isChildOf = (child: AnimeNode, parent: AnimeNode) => {
      return parent.edges.some(e => e.id === child.id && ['SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'OVA', 'SUMMARY'].includes(e.relationType)) ||
        child.edges.some(e => e.id === parent.id && ['PARENT', 'PREQUEL'].includes(e.relationType));
    };

    return spine.map(tv => {
      const eraExtras = extrasPool.filter(extra => {
        const direct = isChildOf(extra, tv);
        if (direct) return true;
        const linkedToAnyTV = spine.some(s => isChildOf(extra, s));
        if (!linkedToAnyTV) {
          return extra.year >= tv.year && (!spine.find(s => s.year > tv.year && s.year <= extra.year));
        }
        return false;
      });

      const rootExtras: AnimeNode[] = [];
      const nodeMap = new Map<number, AnimeNode>();
      eraExtras.sort((a, b) => a.year - b.year);
      eraExtras.forEach(e => { nodeMap.set(e.id, { ...e, childrenNodes: [] }); });

      nodeMap.forEach(node => {
        let parentFound = false;
        for (const [potentialParentId, potentialParent] of nodeMap) {
          if (node.id === potentialParentId) continue;
          if (isChildOf(node, potentialParent)) {
            potentialParent.childrenNodes?.push(node);
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 text-white"><Folder className="text-indigo-500 fill-indigo-500/20" /> Franchise Timeline</h1>
        <div className="flex gap-3 mb-10">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Search franchise (e.g. Naruto)..." className="flex-1 p-4 rounded-xl bg-[#18181b] border border-zinc-800 focus:outline-none focus:border-indigo-500 text-white placeholder-zinc-500 transition-all" />
          <button onClick={handleAdd} className="bg-indigo-600 px-8 py-3 rounded-xl hover:bg-indigo-500 font-bold flex items-center gap-2 text-white shadow-lg shadow-indigo-900/20"><Plus size={22} /> Add</button>
        </div>
        <div className="space-y-6">
          {myList.map((franchise) => {
            const groups = buildHierarchy(franchise.children);
            const isExpanded = expandedFranchiseId === franchise.id;
            const progress = franchise.watchedIds.length;
            const total = franchise.children.length;
            return (
              <div key={franchise.id} className="bg-[#18181b] rounded-2xl overflow-hidden border border-zinc-800/60 shadow-xl">
                <div onClick={() => setExpandedFranchiseId(isExpanded ? null : franchise.id)} className="p-5 flex items-center gap-5 cursor-pointer hover:bg-[#27272a] transition-colors group relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/20 w-full"><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(progress / total) * 100}%` }} /></div>
                  <Image src={franchise.cover} alt="cover" width={50} height={70} className="w-12 h-16 object-cover rounded shadow-md z-10" />
                  <div className="flex-1 z-10"><h2 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors">{franchise.title}</h2><div className="text-sm text-zinc-500 mt-1">{progress} / {total} Watched</div></div>
                  <button onClick={(e) => { e.stopPropagation(); removeitem(franchise.id); }} className="text-zinc-600 hover:text-red-400 p-3 z-10"><Trash2 size={20} /></button>
                  {isExpanded ? <ChevronDown className="text-zinc-500 z-10" /> : <ChevronRight className="text-zinc-500 z-10" />}
                </div>
                {isExpanded && <div className="bg-[#09090b] border-t border-zinc-800 p-6 pt-10">{groups.map((group) => <EraGroup key={group.main.id} group={group} franchiseId={franchise.id} watchedIds={franchise.watchedIds} onToggleWatched={toggleWatched} />)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div >
  );
}