import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJXm6j3ojwgknVSQxqJ0B_VcBj463gkpI",
  authDomain: "ecoclash-ec7d3.firebaseapp.com",
  projectId: "ecoclash-ec7d3",
  storageBucket: "ecoclash-ec7d3.firebasestorage.app",
  messagingSenderId: "1068842263154",
  appId: "1:1068842263154:web:1877838f7d1ae7f516d8eb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await setPersistence(auth, browserLocalPersistence);

export { app, auth, db };
export default app;