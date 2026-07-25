// ═══════════════════════════════════════════════════════════════════════
// firebase-config.js
// ⚠️ Reemplazar estos valores con las credenciales reales del proyecto
// Firebase (Project Settings → General → Your apps → SDK setup).
// ═══════════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, query, where, orderBy, onSnapshot, getDocs,
  collectionGroup, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiL736RD3ChtOCcHFDsQ8wsDFo6WEPpn8",
  authDomain: "costalog-12a44.firebaseapp.com",
  projectId: "costalog-12a44",
  storageBucket: "costalog-12a44.firebasestorage.app",
  messagingSenderId: "487822219820",
  appId: "1:487822219820:web:d358cfd7748c2274f78f89"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendEmailVerification,
  RecaptchaVerifier, signInWithPhoneNumber,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, query, where, orderBy, onSnapshot, getDocs,
  collectionGroup, serverTimestamp
};
