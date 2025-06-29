
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview Firebase configuration and initialization.
 * This file initializes the Firebase app with the provided configuration
 * and exports the Firebase app instance, Auth instance, and Firestore instance
 * for use throughout the application.
 *
 * Configuration is hardcoded here as per specific project instructions.
 * For production environments, using environment variables (e.g., from .env.local)
 * is generally recommended for security and flexibility. This approach prevents
 * sensitive keys from being committed to version control.
 */

// Your web app's Firebase configuration - HARCODED AS PER INSTRUCTION
// These keys are typically found in your Firebase project settings.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBEM8txyg1-PYPbFNG9LH7PQL_xSItsB30",
  authDomain: "kbms-billing.firebaseapp.com",
  projectId: "kbms-billing",
  storageBucket: "kbms-billing.appspot.com",
  messagingSenderId: "448501672122",
  appId: "1:448501672122:web:ba56d20d8c1910ff6fba83"
};

// Initialize Firebase
let app;

// Check if Firebase is already initialized to prevent re-initialization errors.
// This is a standard pattern in environments like Next.js where hot-reloading
// can cause the initialization code to run multiple times.
if (!getApps().length) {
  // If no apps are initialized, create a new one.
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully.");
} else {
  // If an app is already initialized, get the existing one.
  app = getApp(); 
  console.log("Firebase app already initialized, using existing instance.");
}

// Get Firebase Auth instance associated with the initialized app.
// This object is used for all authentication-related tasks like login, logout, etc.
const auth = getAuth(app);

// Get Firestore instance associated with the initialized app.
// This object is the entry point for all database operations (CRUD).
const db = getFirestore(app);

// Export the initialized app, auth, and db instances for use throughout the application.
export { app, auth, db };
