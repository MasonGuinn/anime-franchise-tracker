'use client'
import { useEffect } from 'react';
import Image from 'next/image';
import { X, Star, Calendar, Clock, Film, Users } from 'lucide-react';

interface Anime {
    bannerImage?: string | null;
    coverImage?: {
        large?: string | null;
        extraLarge?: string | null;
    } | null;
    averageScore?: number | null;
    format?: string | null;
    episodes?: number | null;
    startDate?: { year?: number | null } | null;
    popularity?: number | null;
    title: {
        english?: string | null;
        romaji?: string | null;
        native?: string | null;
    };
    genres?: string[] | null;
    description?: string | null;
    studios?: { nodes?: { name?: string }[] | null } | null;
}

interface AnimeDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    anime: Anime | null;
    isLoading: boolean;
}

export default function AnimeDetailModal({ isOpen, onClose, anime, isLoading }: AnimeDetailModalProps) {

    // Close on Escape key press
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Prevent scrolling background when modal is open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-[#151f2e] w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col border border-zinc-800 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >

                {isLoading ? (
                    <div className="h-96 flex flex-col items-center justify-center text-indigo-400 gap-4">
                        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
                        <p className="text-sm text-zinc-500 animate-pulse">Fetching details...</p>
                    </div>
                ) : anime ? (
                    <>
                        {/* HEADER: Banner */}
                        <div className="relative h-48 shrink-0 bg-zinc-900">
                            {anime.bannerImage ? (
                                <Image
                                    src={anime.bannerImage}
                                    alt="banner"
                                    fill
                                    className="object-cover opacity-50 mask-image-gradient"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-linear-to-br from-indigo-900/40 to-zinc-900"></div>
                            )}

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-10 backdrop-blur-md border border-white/10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="flex-1 overflow-y-auto p-8 pt-0 relative">
                            <div className="flex flex-col md:flex-row gap-8">

                                {/* LEFT COLUMN: Poster & Quick Stats */}
                                <div className="shrink-0 -mt-28 relative z-10 w-48 flex flex-col gap-4 mx-auto md:mx-0">
                                    <div className="rounded-xl overflow-hidden shadow-2xl border-4 border-[#151f2e] bg-[#151f2e]">
                                        {anime.coverImage?.large && (
                                            <Image
                                                src={anime.coverImage.extraLarge || anime.coverImage.large}
                                                alt="cover"
                                                width={200}
                                                height={300}
                                                className="w-full h-auto object-cover"
                                            />
                                        )}
                                    </div>

                                    {/* Stat Grid */}
                                    <div className="grid grid-cols-1 gap-2 bg-[#1a2332] p-4 rounded-xl border border-zinc-800/50 shadow-sm">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-zinc-500"><Star size={14} className="text-yellow-500" /> Score</span>
                                            <span className="font-bold text-zinc-200">{anime.averageScore ? `${anime.averageScore}%` : 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-zinc-500"><Film size={14} /> Format</span>
                                            <span className="text-zinc-300 uppercase text-xs font-medium bg-zinc-800 px-1.5 py-0.5 rounded">{anime.format}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-zinc-500"><Clock size={14} /> Eps</span>
                                            <span className="text-zinc-300">{anime.episodes || '?'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="flex items-center gap-2 text-zinc-500"><Calendar size={14} /> Year</span>
                                            <span className="text-zinc-300">{anime.startDate?.year}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-800 mt-2">
                                            <span className="flex items-center gap-2 text-zinc-500"><Users size={14} /> Popularity</span>
                                            <span className="text-zinc-400 text-xs">{(anime.popularity || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: Info & Description */}
                                <div className="flex-1 pt-4 md:pt-6 text-center md:text-left">
                                    <h2 className="text-3xl font-bold text-white leading-tight mb-1 font-heading">
                                        {anime.title.english || anime.title.romaji}
                                    </h2>
                                    <h3 className="text-sm text-zinc-500 mb-6 italic">
                                        {anime.title.native}
                                    </h3>

                                    {/* Genres */}
                                    <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                                        {anime.genres?.map((g: string) => (
                                            <span key={g} className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-default">
                                                {g}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Description - rendered safely */}
                                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed">
                                        <div dangerouslySetInnerHTML={{ __html: anime.description || '<p>No description available.</p>' }} />
                                    </div>

                                    {/* Studio Footer */}
                                    {anime.studios?.nodes?.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-500">
                                            <span>Animation Studio:</span>
                                            <span className="text-zinc-200 font-medium px-2 py-1 bg-zinc-800 rounded">{anime.studios.nodes[0].name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-12 text-center flex flex-col items-center gap-3">
                        <div className="bg-red-500/10 p-3 rounded-full text-red-500"><X size={24} /></div>
                        <div className="text-zinc-300 font-medium">Failed to load anime details.</div>
                        <p className="text-zinc-500 text-sm">Please check your connection and try again.</p>
                    </div>
                )}
            </div>
        </div>
    );
}