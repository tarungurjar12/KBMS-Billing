
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview Firebase configuration and initialization.
 * This file initializes the Firebase app with the provided configuration
 * and exports the Firebase app instance, Auth instance, and Firestore instance.
 *
 * Configuration is hardcoded here as per specific project instructions.
 * For production environments, using environment variables (e.g., from .env.local)
 * is generally recommended for security and flexibility.
 */

// Your web app's Firebase configuration - HARCODED AS PER INSTRUCTION
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBEM8txyg1-PYPbFNG9LH7PQL_xSItsB30",
  authDomain: "kbms-billing.firebaseapp.com",
  projectId: "kbms-billing",
  storageBucket: "kbms-billing.appspot.com", // Corrected from .firebasestorage.app if this was a typo
  messagingSenderId: "448501672122",
  appId: "1:448501672122:web:ba56d20d8c1910ff6fba83"
  // measurementId: "G-XXXXXXXXXX" // Optional: Add if you use Google Analytics for Firebase
};

// Initialize Firebase
let app;

// Check if Firebase is already initialized to prevent re-initialization errors
// This is particularly useful in Next.js development environment with hot reloading.
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully.");
} else {
  app = getApp(); // Use the existing app if already initialized
  console.log("Firebase app already initialized, using existing instance.");
}

// Get Firebase Auth instance associated with the initialized app
const auth = getAuth(app);

// Get Firestore instance associated with the initialized app
const db = getFirestore(app);

// Export the initialized app, auth, and db instances for use throughout the application
export { app, auth, db };

