import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";


// Extend Window interface for custom properties
declare global {
    interface Window {
        __firebase_config?: string;
        __app_id?: string;
    }
}

// 1. Setup Firebase Config
const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config
    ? JSON.parse(window.__firebase_config)
    : {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };

// 2. Initialize App (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 3. Export Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize analytics only on client side
if (typeof window !== 'undefined') {
    getAnalytics(app);
}

// Helper for the preview environment
export const getAppId = () => {
    return typeof window !== 'undefined' && window.__app_id
        ? window.__app_id
        : 'default-app';
};