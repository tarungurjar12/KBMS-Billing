// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview Firebase configuration and initialization.
 * This file initializes the Firebase app with the provided configuration
 * and exports the Firebase app instance, Auth instance, and Firestore instance.
 *
 * IMPORTANT: The Firebase configuration is currently hardcoded here as per specific instructions.
 * For production environments and best practices, it is STRONGLY recommended to use
 * environment variables (e.g., from a .env.local file) to store sensitive configuration
 * details like API keys. Hardcoding can expose sensitive information if the codebase is
 * made public or improperly managed.
 */

// Your web app's Firebase configuration - HARCODED AS PER INSTRUCTION
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBEM8txyg1-PYPbFNG9LH7PQL_xSItsB30",
  authDomain: "kbms-billing.firebaseapp.com",
  projectId: "kbms-billing",
  storageBucket: "kbms-billing.appspot.com", // Ensure this matches your Firebase project
  messagingSenderId: "448501672122",
  appId: "1:448501672122:web:ba56d20d8c1910ff6fba83"
};

// Initialize Firebase
let app;

// Check if Firebase is already initialized to prevent re-initialization error on hot reloads
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // Use the existing app if already initialized
}

// Get Firebase Auth instance
const auth = getAuth(app);

// Get Firestore instance
const db = getFirestore(app);

// Export the initialized app, auth, and db instances for use throughout the application
export { app, auth, db };
