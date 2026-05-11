import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBHthN13gNWZGBtuB7-HtKRMmCzcDPtrGM",
  authDomain: "separacao-f8500.firebaseapp.com",
  projectId: "separacao-f8500",
  storageBucket: "separacao-f8500.firebasestorage.app",
  messagingSenderId: "945687269648",
  appId: "1:945687269648:web:5d09bd097b93e448921595"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
