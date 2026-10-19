import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOoRAVHd0M-k_j49CqD9bbjKbMMfnY5LM",
  authDomain: "youcompetemeapp-b73f9.firebaseapp.com",
  projectId: "youcompetemeapp-b73f9",
  storageBucket: "youcompetemeapp-b73f9.firebasestorage.app",
  messagingSenderId: "3787796633",
  appId: "1:3787796633:web:9e82f4a871a9f8e39f4808",
  measurementId: "G-ZD5GD1G4MQ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, updateDoc 
};