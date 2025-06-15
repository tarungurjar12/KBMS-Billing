// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Import Firestore

/**
 * @fileOverview Firebase configuration and initialization.
 * This file initializes the Firebase app with the provided configuration
 * and exports the Firebase app instance, Auth instance, and Firestore instance.
 */

// Your web app's Firebase configuration - directly embedded as requested.
// For production, it's highly recommended to use environment variables for these.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBEM8txyg1-PYPbFNG9LH7PQL_xSItsB30",
  authDomain: "kbms-billing.firebaseapp.com",
  projectId: "kbms-billing",
  storageBucket: "kbms-billing.appspot.com", // Corrected bucket name
  messagingSenderId: "448501672122",
  appId: "1:448501672122:web:ba56d20d8c1910ff6fba83"
};

// Initialize Firebase
let app;

// Check if Firebase is already initialized to prevent re-initialization
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, db };
