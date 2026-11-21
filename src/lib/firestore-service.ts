import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { createEmptyWorkspace } from "./demo-data";
import type { WorkspaceData } from "@/types";

const USER_COLLECTIONS = [
  "visions",
  "goals",
  "milestones",
  "projects",
  "tasks",
  "habits",
  "habitEntries",
  "dailyPlans",
  "timeBlocks",
  "focusSessions",
  "journalEntries",
  "weeklyReviews",
  "aiConversations",
] as const;

export type UserCollectionName = (typeof USER_COLLECTIONS)[number];

export async function loadUserWorkspaceFromFirestore(
  userId: string,
  fallbackName: string,
  fallbackEmail: string
): Promise<WorkspaceData> {
  const empty = createEmptyWorkspace(userId, fallbackName, fallbackEmail);
  if (!db) return empty;

  const [profileSnap, prefSnap] = await Promise.all([
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "userPreferences", userId)),
  ]);

  if (!profileSnap.exists()) {
    await setDoc(doc(db, "users", userId), empty.profile);
  }
  if (!prefSnap.exists()) {
    await setDoc(doc(db, "userPreferences", userId), empty.preferences);
  }

  const results = await Promise.all(
    USER_COLLECTIONS.map(async (colName) => {
      const q = query(collection(db!, colName), where("userId", "==", userId));
      const snap = await getDocs(q);
      return [colName, snap.docs.map((d) => d.data())] as const;
    })
  );

  const map = Object.fromEntries(results) as Record<UserCollectionName, unknown[]>;
  const visions = (map.visions as WorkspaceData["vision"][]) || [];
  let vision = visions[0];
  if (!vision) {
    vision = empty.vision;
    await setDoc(doc(db, "visions", vision.id), vision);
  }

  return {
    profile: profileSnap.exists()
      ? (profileSnap.data() as WorkspaceData["profile"])
      : empty.profile,
    preferences: prefSnap.exists()
      ? { ...empty.preferences, ...(prefSnap.data() as Partial<WorkspaceData["preferences"]>) }
      : empty.preferences,
    vision,
    goals: (map.goals as WorkspaceData["goals"]) || [],
    milestones: (map.milestones as WorkspaceData["milestones"]) || [],
    projects: (map.projects as WorkspaceData["projects"]) || [],
    tasks: (map.tasks as WorkspaceData["tasks"]) || [],
    habits: (map.habits as WorkspaceData["habits"]) || [],
    habitEntries: (map.habitEntries as WorkspaceData["habitEntries"]) || [],
    dailyPlans: (map.dailyPlans as WorkspaceData["dailyPlans"]) || [],
    timeBlocks: (map.timeBlocks as WorkspaceData["timeBlocks"]) || [],
    focusSessions: (map.focusSessions as WorkspaceData["focusSessions"]) || [],
    journalEntries: (map.journalEntries as WorkspaceData["journalEntries"]) || [],
    weeklyReviews: (map.weeklyReviews as WorkspaceData["weeklyReviews"]) || [],
    aiConversations: (map.aiConversations as WorkspaceData["aiConversations"]) || [],
  };
}

export async function upsertDocument<T extends { id: string }>(
  collectionName: string,
  data: T
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, collectionName, data.id), stripUndefined(data), { merge: true });
}

export async function upsertUserSingleton(
  collectionName: "users" | "userPreferences",
  userId: string,
  data: object
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, collectionName, userId), stripUndefined(data), { merge: true });
}

export async function removeDocument(collectionName: string, id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, collectionName, id));
}

export async function deleteAllUserData(userId: string): Promise<void> {
  if (!db) return;
  for (const colName of USER_COLLECTIONS) {
    const q = query(collection(db, colName), where("userId", "==", userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, "userPreferences", userId));
  await deleteDoc(doc(db, "users", userId));
}

function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      clean[key] = stripUndefined(value);
    }
  }
  return clean as T;
}

