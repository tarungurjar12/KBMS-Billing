
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// import { getFirestore } from 'firebase/firestore'; // Import when ready for Firestore

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
let app;

// Check if Firebase is already initialized to prevent re-initialization
if (!getApps().length) {
  if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Check your .env.local file and ensure NEXT_PUBLIC_FIREBASE_API_KEY is set.");
    // Potentially throw an error or handle this case as appropriate for your app
    // For now, we'll let initializeApp throw the error if critical configs are missing.
  }
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
// const db = getFirestore(app); // Initialize Firestore when ready

export { app, auth /*, db */ };
