// Progress tracking: save analysed games and track the blunder rate over time.
// Firebase (anonymous Auth + Firestore) when configured; localStorage fallback
// otherwise. The core flow never blocks on Firebase - if it is not configured
// or the network fails, everything still works locally.

import { isFirebaseConfigured, firebaseConfig } from "./firebase-config";

export interface SavedGame {
  id: string;
  date: string; // ISO string
  white: string;
  black: string;
  result: string;
  moves: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  accuracyWhite: number;
  accuracyBlack: number;
  source: "firebase" | "local";
  pgn?: string;
}

const LOCAL_KEY = "blundercheck:history";

function loadLocal(): SavedGame[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedGame[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(record: SavedGame): void {
  const list = loadLocal();
  list.unshift(record);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 50)));
}

export async function saveGame(record: Omit<SavedGame, "id" | "source" | "date">): Promise<SavedGame> {
  const full: SavedGame = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    source: "local",
  };
  if (!isFirebaseConfigured) {
    saveLocal(full);
    return full;
  }
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, signInAnonymously } = await import("firebase/auth");
    const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    if (!auth.currentUser) await signInAnonymously(auth);
    const db = getFirestore(app);
    await addDoc(collection(db, "analyses"), {
      ...full,
      source: "firebase",
      createdAt: serverTimestamp(),
    });
    return { ...full, source: "firebase" };
  } catch {
    // Firebase failed - keep the game locally so nothing is lost.
    saveLocal(full);
    return full;
  }
}

export async function loadHistory(): Promise<SavedGame[]> {
  if (!isFirebaseConfigured) return loadLocal();
  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, signInAnonymously } = await import("firebase/auth");
    const { getFirestore, collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    if (!auth.currentUser) await signInAnonymously(auth);
    const db = getFirestore(app);
    const snap = await getDocs(query(collection(db, "analyses"), orderBy("date", "desc"), limit(50)));
    const remote = snap.docs.map((d) => d.data() as SavedGame);
    return remote.length > 0 ? remote : loadLocal();
  } catch {
    return loadLocal();
  }
}

/** Blunders per game across the saved history, oldest to newest. */
export function blunderTrend(history: SavedGame[]): Array<{ date: string; blunders: number }> {
  return [...history]
    .reverse()
    .map((g) => ({ date: g.date.slice(0, 10), blunders: g.blunders }));
}

export function averageBlunders(history: SavedGame[]): number {
  if (history.length === 0) return 0;
  return history.reduce((sum, g) => sum + g.blunders, 0) / history.length;
}
