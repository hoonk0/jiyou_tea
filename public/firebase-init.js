// Firebase 연결 설정 (apiKey는 웹 공개용이라 코드에 넣어도 안전)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNlW8VNm6sAhYUHCIKAHxgkltUlOGl6sE",
  authDomain: "jiyou-eb262.firebaseapp.com",
  projectId: "jiyou-eb262",
  storageBucket: "jiyou-eb262.firebasestorage.app",
  messagingSenderId: "224385064434",
  appId: "1:224385064434:web:9d55ce9721cbbf947a1f6b",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
