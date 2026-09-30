import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC5Rpbmz9Oh2OmIyg9Qw9iIK_UltztblBA",
  authDomain: "tcctattooart-aee35.firebaseapp.com",
  projectId: "tcctattooart-aee35",
  storageBucket: "tcctattooart-aee35.firebasestorage.app",
  messagingSenderId: "103073035106",
  appId: "1:103073035106:web:aa3f830c31efd8da6e323b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firestore: é aqui que os tatuadores (e outras coleções) vão ser salvos
export const db = getFirestore(app);