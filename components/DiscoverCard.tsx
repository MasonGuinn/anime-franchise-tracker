'use client'
import Image from 'next/image';
import { Plus, Star } from 'lucide-react';

interface DiscoverCardProps {
    anime: any;
    onAdd: (id: number) => void;
    onClick: (id: number) => void;
}

export default function DiscoverCard({ anime, onAdd, onClick }: DiscoverCardProps) {
    return (
        <div
            className="min-w-40 w-40 group cursor-pointer relative"
            onClick={() => onClick(anime.id)}
        >
            <div className="relative aspect-2/3 rounded-xl overflow-hidden mb-2 shadow-lg border border-zinc-800 group-hover:border-indigo-500/50 transition-all">
                {anime.coverImage?.large && (
                    <Image
                        src={anime.coverImage.large}
                        alt="cover"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 160px, 160px"
                        loading="lazy"
                    />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-60"></div>

                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-1">
                    <Star size={8} className="text-yellow-500 fill-yellow-500" />
                    {anime.averageScore ? `${anime.averageScore}%` : 'N/A'}
                </div>

                {/* Quick Add Button Overlay */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdd(anime.id);
                    }}
                    className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 hover:scale-110"
                    title="Add to Collection"
                >
                    <Plus size={16} />
                </button>
            </div>

            <h3 className="text-sm font-medium text-zinc-200 line-clamp-2 group-hover:text-indigo-400 transition-colors leading-tight">
                {anime.title.english || anime.title.romaji}
            </h3>
            <div className="text-[10px] text-zinc-500 mt-1">
                {anime.startDate?.year} • {anime.format}
            </div>
        </div>
    );
}