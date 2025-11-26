import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AnimeNode } from '@/app/actions';

export type FranchiseItem = {
    id: number;
    title: string;
    cover: string;
    children: AnimeNode[];
    watchedIds: number[];
};

type UserCollections = {
    franchises: FranchiseItem[];
    lastUpdated: number;
};

export function useUserCollections(user: User | null) {
    const [myList, setMyList] = useState<FranchiseItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isLoadingFromSnapshot, setIsLoadingFromSnapshot] = useState(false);

    // Load from Firestore when user logs in
    useEffect(() => {
        if (!user) {
            // Not logged in - use localStorage
            setIsLoading(true);
            try {
                const saved = localStorage.getItem('myAnimeList_v16');
                if (saved) {
                    setMyList(JSON.parse(saved));
                }
            } catch (e) {
                console.error('Failed to load from localStorage:', e);
            }
            setIsLoading(false);
            return;
        }

        // Logged in - use Firestore with real-time sync
        setIsLoading(true);
        const userDocRef = doc(db, 'users', user.uid);

        console.log('Setting up Firestore listener for user:', user.uid);

        const unsubscribe = onSnapshot(
            userDocRef,
            async (docSnap) => {
                console.log('Firestore snapshot received. Exists:', docSnap.exists());
                if (docSnap.exists()) {
                    const data = docSnap.data() as UserCollections;
                    const franchisesData = data.franchises || [];
                    console.log('Loaded franchises from Firestore:', franchisesData.length);
                    setIsLoadingFromSnapshot(true);
                    setMyList(franchisesData);
                    setIsLoading(false);
                    // Reset flag after a brief delay to allow this render cycle to complete
                    setTimeout(() => setIsLoadingFromSnapshot(false), 200);
                } else {
                    console.log('No Firestore document found, checking localStorage for migration');
                    // First time user - migrate from localStorage if exists
                    const localData = localStorage.getItem('myAnimeList_v16');
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            console.log('Migrating from localStorage:', parsed.length, 'items');
                            setIsLoadingFromSnapshot(true);
                            setMyList(parsed);
                            setIsLoading(false);
                            // Save to Firestore
                            await setDoc(userDocRef, {
                                franchises: parsed,
                                lastUpdated: Date.now()
                            });
                            console.log('Migration complete');
                            setTimeout(() => setIsLoadingFromSnapshot(false), 200);
                            // Clear localStorage after migration
                            localStorage.removeItem('myAnimeList_v16');
                        } catch (e) {
                            console.error('Migration failed:', e);
                            setIsLoading(false);
                        }
                    } else {
                        // New user with no data
                        console.log('New user, no data');
                        setMyList([]);
                        setIsLoading(false);
                    }
                }
            },
            (error) => {
                console.error('Firestore sync error:', error);
                setIsLoading(false);
            }
        );

        return () => {
            console.log('Cleaning up Firestore listener');
            unsubscribe();
        };
    }, [user]);

    // Save to storage whenever list changes (but not when loading from Firestore)
    useEffect(() => {
        if (isLoading || isLoadingFromSnapshot) return;

        const saveData = async () => {
            if (user) {
                // Save to Firestore
                setIsSyncing(true);
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    console.log('Saving to Firestore:', myList.length, 'items');
                    await setDoc(userDocRef, {
                        franchises: myList,
                        lastUpdated: Date.now()
                    }, { merge: true });
                    console.log('Save successful');
                } catch (error) {
                    console.error('Failed to sync with Firestore:', error);
                } finally {
                    setIsSyncing(false);
                }
            } else {
                // Save to localStorage
                console.log('Saving to localStorage:', myList.length, 'items');
                localStorage.setItem('myAnimeList_v16', JSON.stringify(myList));
            }
        };

        // Debounce saves to avoid too many writes
        const timeoutId = setTimeout(saveData, 500);
        return () => clearTimeout(timeoutId);
    }, [myList, user, isLoading, isLoadingFromSnapshot]);

    const addFranchise = (franchise: FranchiseItem) => {
        if (!myList.some(item => item.id === franchise.id)) {
            setMyList(prev => [...prev, franchise]);
            return true;
        }
        return false;
    };

    const removeFranchise = (franchiseId: number) => {
        setMyList(prev => prev.filter(item => item.id !== franchiseId));
    };

    const toggleWatched = (franchiseId: number, animeId: number) => {
        setMyList(prev => prev.map(item => {
            if (item.id !== franchiseId) return item;
            const isWatched = item.watchedIds.includes(animeId);
            return {
                ...item,
                watchedIds: isWatched
                    ? item.watchedIds.filter(id => id !== animeId)
                    : [...item.watchedIds, animeId]
            };
        }));
    };

    return {
        myList,
        isLoading,
        isSyncing,
        addFranchise,
        removeFranchise,
        toggleWatched
    };
}
