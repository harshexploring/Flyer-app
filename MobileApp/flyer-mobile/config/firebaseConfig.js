// Firebase configuration for Flyer mobile app.
// Get your config from Firebase Console > Project Settings > Your Apps > Web.
// For now, using a placeholder — you'll replace this with your actual credentials.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDummyKeyReplaceWithYours',
  authDomain: 'flyer-app.firebaseapp.com',
  projectId: 'flyer-app',
  storageBucket: 'flyer-app.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123def456',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
