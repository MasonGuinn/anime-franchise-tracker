'use client'
import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Folder, CheckCircle2, Circle } from 'lucide-react';
import { AnimeNode } from '../app/actions';

export type UITimelineNode = AnimeNode & {
    childrenNodes?: UITimelineNode[];
    relationToParent?: string;
};

interface ViewProps {
    franchiseId: number;
    groups: { main: UITimelineNode; extras: UITimelineNode[] }[];
    watchedIds: number[];
    onToggleWatched: (franchiseId: number, animeId: number) => void;
    onTitleClick: (id: number) => void;
}

// --- RECURSIVE ITEM ---
const RecursiveItem = ({ node, franchiseId, watchedIds, onToggleWatched, onTitleClick }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.childrenNodes && node.childrenNodes.length > 0;
    const isWatched = watchedIds.includes(node.id);

    const badgeText = node.relationToParent ? node.relationToParent.replace('_', ' ') : node.format;
    let badgeStyle = 'border-zinc-700 text-zinc-500 bg-zinc-800';
    if (node.relationToParent === 'PREQUEL') badgeStyle = 'border-amber-900/50 text-amber-500 bg-amber-500/10';
    else if (node.relationToParent === 'SEQUEL') badgeStyle = 'border-blue-900/50 text-blue-400 bg-blue-500/10';
    else if (node.format === 'MOVIE') badgeStyle = 'border-emerald-900/50 text-emerald-500 bg-emerald-500/5';

    return (
        <div className="flex flex-col relative">
            <div
                className="flex items-start gap-3 p-2 rounded hover:bg-[#1f232e] transition group border border-transparent hover:border-zinc-800 relative z-10 cursor-pointer"
                onClick={(e) => { if (hasChildren) { e.stopPropagation(); setIsOpen(!isOpen); } }}
            >
                <button onClick={(e) => { e.stopPropagation(); onToggleWatched(franchiseId, node.id); }} className="mt-0.5 scale-90 hover:scale-110 transition shrink-0">
                    {isWatched ? <CheckCircle2 className="text-indigo-500 fill-indigo-500/10" size={20} /> : <Circle className="text-zinc-700 group-hover:text-indigo-400" size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                    {/* CLICKABLE TITLE (Now with w-fit) */}
                    <div
                        className="text-sm text-zinc-300 group-hover:text-white transition-colors leading-tight hover:underline decoration-indigo-500/50 underline-offset-4 w-fit"
                        onClick={(e) => {
                            e.stopPropagation();
                            onTitleClick(node.id);
                        }}
                    >
                        {node.title?.english || node.title?.romaji}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${badgeStyle}`}>{badgeText}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{node.year}</span>
                        {hasChildren && (
                            <button
                                className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all duration-200 active:scale-95 ${isOpen ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_10px_-3px_rgba(99,102,241,0.5)]' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500'
                                    }`}
                                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                            >
                                <span className="font-bold">{node.childrenNodes.length} Related</span>
                                <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><ChevronDown size={10} strokeWidth={3} /></span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {isOpen && hasChildren && (
                <div className="relative ml-5 pl-4 border-l-2 border-zinc-800/50 my-1 space-y-1">
                    {node.childrenNodes.map((child: any) => (
                        <RecursiveItem
                            key={child.id}
                            node={child}
                            franchiseId={franchiseId}
                            watchedIds={watchedIds}
                            onToggleWatched={onToggleWatched}
                            onTitleClick={onTitleClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
export const TimelineView = ({ franchiseId, groups, watchedIds, onToggleWatched, onTitleClick }: ViewProps) => {
    return (
        <div className="bg-[#09090b] border-t border-zinc-800 p-6 pt-10">
            {groups.map((group) => (
                <EraGroup
                    key={group.main.id}
                    group={group}
                    franchiseId={franchiseId}
                    watchedIds={watchedIds}
                    onToggleWatched={onToggleWatched}
                    onTitleClick={onTitleClick}
                />
            ))}
        </div>
    );
};

const EraGroup = ({ group, franchiseId, watchedIds, onToggleWatched, onTitleClick }: any) => {
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

                        {/* CLICKABLE MAIN TITLE (Now with w-fit) */}
                        <h3
                            className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors truncate hover:underline underline-offset-4 decoration-indigo-500/50 w-fit"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTitleClick(group.main.id);
                            }}
                        >
                            {group.main.title?.english || group.main.title?.romaji}
                        </h3>

                        {hasExtras ? (
                            <div className="text-sm text-zinc-400 mt-2 flex items-center gap-2"><Folder size={14} className="text-zinc-500" /> <span>{group.extras.length} items in collection</span></div>
                        ) : <div className="text-sm text-zinc-600 mt-2 italic">No side stories</div>}
                    </div>
                </div>
            </div>
            {isOpen && hasExtras && (
                <div className="pl-4 mb-8 space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                    {group.extras.map((extraNode: any) => (
                        <RecursiveItem
                            key={extraNode.id}
                            node={extraNode}
                            franchiseId={franchiseId}
                            watchedIds={watchedIds}
                            onToggleWatched={onToggleWatched}
                            onTitleClick={onTitleClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};