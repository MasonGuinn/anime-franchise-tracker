'use client'
import { useState, useEffect } from 'react';
import { fetchFranchise } from './actions';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Folder, Plus, Trash2 } from 'lucide-react';

export default function Home() {
  const [query, setQuery] = useState('');

  type RelationNode = {
    node: {
      id: number;
      format?: string | null;
      title?: {
        english?: string | null;
        romaji?: string | null;
      } | null;
    };
  };

  type FranchiseItem = {
    id: number;
    title: string;
    cover: string;
    children: RelationNode[];
  };

  const [myList, setMyList] = useState<FranchiseItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('myAnimeList');
      return saved ? (JSON.parse(saved) as FranchiseItem[]) : [];
    } catch {
      return [];
    }
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 1. Load data from local storage on startup (initialized lazily)

  // 2. Save data to local storage whenever list changes
  useEffect(() => {
    localStorage.setItem('myAnimeList', JSON.stringify(myList));
  }, [myList]);

  // 3. Search and Add Logic
  const handleAdd = async () => {
    if (!query) return;
    try {
      const anime = await fetchFranchise(query);

      // Filter relations to only keep Anime (remove manga/games)
      const relations = anime.relations.edges.filter((edge: RelationNode) =>
        ['TV', 'MOVIE', 'OVA', 'SPECIAL'].includes(edge.node.format ?? '') &&
        edge.node.id !== anime.id
      );

      // Sort by ID (Lower ID = Older Anime)
      relations.sort((a: RelationNode, b: RelationNode) => a.node.id - b.node.id);

      const newItem = {
        id: anime.id,
        title: anime.title.english || anime.title.romaji,
        cover: anime.coverImage.large,
        children: relations
      };

      // Check if already exists
      if (!myList.some(i => i.id === newItem.id)) {
        setMyList([...myList, newItem]);
      }
      setQuery('');
    } catch {
      alert('Anime not found!');
    }
  };

  const removeitem = (id: number) => {
    setMyList(myList.filter(item => item.id !== id));
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Folder className="text-blue-400" /> My Franchise Tracker
        </h1>

        {/* Search Bar */}
        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Enter anime name (e.g. Bleach)..."
            className="flex-1 p-3 rounded bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            className="bg-blue-600 px-6 py-3 rounded hover:bg-blue-500 font-bold flex items-center gap-2"
          >
            <Plus size={20} /> Add
          </button>
        </div>

        {/* The List */}
        <div className="space-y-4">
          {myList.map((item) => (
            <div key={item.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              {/* Franchise Header (The Folder) */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-750 transition-colors"
                onClick={() => toggleExpand(item.id)}
              >
                <Image
                  src={item.cover}
                  alt={item.title}
                  width={48}
                  height={64}
                  className="w-12 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{item.title}</h2>
                  <p className="text-slate-400 text-sm">{item.children.length} related items</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeitem(item.id); }} className="text-red-400 p-2 hover:bg-slate-700 rounded">
                  <Trash2 size={18} />
                </button>
                {expandedId === item.id ? <ChevronDown /> : <ChevronRight />}
              </div>

              {/* The "Contents" of the Folder */}
              {expandedId === item.id && (
                <div className="bg-slate-900/50 p-4 border-t border-slate-700 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Collection Contents</div>
                  {/* List the Main item first */}
                  <div className="flex items-center gap-3 p-2 rounded bg-slate-800/50">
                    <span className="bg-blue-600 text-xs px-2 py-1 rounded">MAIN</span>
                    <span>{item.title}</span>
                  </div>
                  {/* List Children */}
                  {item.children.map((child: RelationNode) => (
                    <div key={child.node.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-800 transition">
                      <span className="bg-slate-600 text-xs px-2 py-1 rounded w-16 text-center">
                        {child.node.format || 'OVA'}
                      </span>
                      <span className="text-slate-300">
                        {child.node.title?.english || child.node.title?.romaji || 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {myList.length === 0 && (
            <div className="text-center text-slate-500 py-10">
              Your list is empty. Try adding &quot;Naruto&quot; or &quot;Bleach&quot;.
            </div>
          )}
        </div>
      </div>
    </div >
  );
}