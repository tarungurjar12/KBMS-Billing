
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// import { getFirestore } from 'firebase/firestore'; // Import when ready for Firestore

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBEM8txyg1-PYPbFNG9LH7PQL_xSItsB30",
  authDomain: "kbms-billing.firebaseapp.com",
  projectId: "kbms-billing",
  storageBucket: "kbms-billing.appspot.com", // Corrected from your provided snippet which likely had a typo
  messagingSenderId: "448501672122",
  appId: "1:448501672122:web:ba56d20d8c1910ff6fba83"
  // measurementId is optional
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
// const db = getFirestore(app); // Initialize Firestore when ready

export { app, auth /*, db */ };
