'use client'
import DiscoverCard from './DiscoverCard';
import { LucideIcon } from 'lucide-react';

interface DiscoverSectionProps {
    title: string;
    icon: LucideIcon;
    iconColor: string;
    data: any[];
    onAdd: (id: number) => void;
    onCardClick: (id: number) => void;
}

export default function DiscoverSection({ title, icon: Icon, iconColor, data, onAdd, onCardClick }: DiscoverSectionProps) {
    return (
        <section>
            <div className={`flex items-center gap-2 mb-4 font-bold uppercase tracking-wider text-sm ${iconColor}`}>
                <Icon size={18} /> {title}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 mask-image-right">
                {data && data.length > 0 ? (
                    data.map((anime) => (
                        <DiscoverCard
                            key={anime.id}
                            anime={anime}
                            onAdd={onAdd}
                            onClick={onCardClick}
                        />
                    ))
                ) : (
                    // Skeleton Loading State
                    [1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="min-w-[160px] w-[160px] space-y-2">
                            <div className="aspect-[2/3] bg-zinc-800/50 rounded-xl animate-pulse" />
                            <div className="h-4 w-3/4 bg-zinc-800/50 rounded animate-pulse" />
                            <div className="h-3 w-1/2 bg-zinc-800/30 rounded animate-pulse" />
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}