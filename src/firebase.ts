import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  getDocFromServer,
  getFirestore
} from 'firebase/firestore';

// Configuration loaded from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyA8Jeglx7NEhBTGPOCfddKMIMUaQCTCbhw",
  authDomain: "gen-lang-client-0500973317.firebaseapp.com",
  projectId: "gen-lang-client-0500973317",
  storageBucket: "gen-lang-client-0500973317.firebasestorage.app",
  messagingSenderId: "488625840153",
  appId: "1:488625840153:web:c6247afab80c1a6a0a8a88"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with robust local persistent cache for offline support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, "ai-studio-1654b752-049a-407f-877e-621160ca1b5a");

// Validate Firestore Connection
export async function validateConnection(): Promise<boolean> {
  try {
    // Attempt a live fetch from server of a dummy config document (no cache)
    await getDocFromServer(doc(db, 'system', 'connection-test'));
    return true;
  } catch (error: any) {
    console.warn("Firestore running in offline mode or unable to connect online:", error.message);
    return false;
  }
}

// Perform initial connection test
validateConnection();
