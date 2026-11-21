// Firebase configuration.
//
// The real config is supplied by the project owner (Firebase console ->
// Project settings -> Your apps -> Web app) and pasted here. Nothing in this
// file is a secret: Firebase web config values are public by design and are
// safe to ship in client code. Do NOT invent values - if the fields below
// still hold placeholders, Firebase features are disabled and the app runs
// fully offline on local storage instead.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyAVb8fXRmCcAaLGc38CptVJJi0qisGccxE",
  authDomain: "blundercheck-e3118.firebaseapp.com",
  projectId: "blundercheck-e3118",
  storageBucket: "blundercheck-e3118.firebasestorage.app",
  messagingSenderId: "682454548949",
  appId: "1:682454548949:web:344a17d81159936ad37d5c",
};

/** True once the real Firebase config has been pasted in. */
export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

/** Cloud model used for the full-game review and training plan. */
export const CLOUD_MODEL = "gemini-2.5-flash";
