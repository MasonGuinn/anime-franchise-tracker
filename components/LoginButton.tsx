'use client'
import { useState, useEffect } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { LogIn, LogOut, UserCircle } from 'lucide-react';
import Image from 'next/image';

export default function LoginButton() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            setImageError(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error('Login failed:', error);
            alert('Failed to sign in. Please try again.');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    if (loading) {
        return (
            <div className="h-10 w-10 rounded-full bg-zinc-800 animate-pulse"></div>
        );
    }

    if (user) {
        return (
            <div className="flex items-center gap-3">
                {user.photoURL && !imageError ? (
                    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <Image
                            src={user.photoURL}
                            alt=""
                            width={32}
                            height={32}
                            className="rounded-full ring-2 ring-zinc-700"
                            unoptimized
                            onError={() => setImageError(true)}
                        />
                        <span className="text-zinc-300 text-sm font-medium max-w-[120px] truncate">
                            {user.displayName || user.email}
                        </span>
                    </div>
                ) : (
                    <div className="hidden md:flex items-center gap-2 text-sm text-zinc-300">
                        <UserCircle size={32} className="text-zinc-400" />
                        <span className="max-w-[120px] truncate">
                            {user.displayName || user.email}
                        </span>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
                    title="Sign out"
                >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Sign Out</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-500/20"
        >
            <LogIn size={18} />
            <span className="hidden sm:inline">Sign In</span>
        </button>
    );
}
