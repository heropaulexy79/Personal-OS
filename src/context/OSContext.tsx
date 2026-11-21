"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, parseISO } from "date-fns";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { createDemoWorkspace, createEmptyWorkspace } from "@/lib/demo-data";
import {
  deleteAllUserData,
  loadUserWorkspaceFromFirestore,
  removeDocument,
  upsertDocument,
  upsertUserSingleton,
} from "@/lib/firestore-service";
import { todayISO, uid } from "@/lib/utils";
import type {
  AIConversation,
  AIProposedAction,
  DailyPlan,
  FocusSession,
  Goal,
  Habit,
  HabitEntry,
  JournalEntry,
  Milestone,
  Project,
  Task,
  TimeBlock,
  UserPreferences,
  Vision,
  WeeklyReview,
  WorkspaceData,
} from "@/types";

const DEMO_STORAGE_KEY = "personal_os_demo_workspace_v1";
const DEMO_MODE_FLAG = "personal_os_demo_mode_active";

interface OSContextValue {
  // Auth & Mode
  user: User | null;
  isDemo: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  firebaseReady: boolean;
  authError: string | null;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  resetDemoData: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;

  // Data
  data: WorkspaceData;

  // UI Globals
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  activeFocusTaskId: string | null;
  setActiveFocusTaskId: (taskId: string | null) => void;
  toast: { message: string; tone?: "default" | "success" | "error" } | null;
  showToast: (message: string, tone?: "default" | "success" | "error") => void;

  // CRUD Actions
  updateVision: (patch: Partial<Vision>) => void;
  createGoal: (goal: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  createMilestone: (ms: Omit<Milestone, "id" | "userId" | "createdAt">) => Milestone;
  updateMilestone: (id: string, patch: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  createProject: (proj: Omit<Project, "id" | "userId" | "createdAt">) => Project;
  deleteProject: (id: string) => void;

  createTask: (task: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  bulkUpdateTasks: (ids: string[], patch: Partial<Task>) => void;
  bulkDeleteTasks: (ids: string[]) => void;

  createHabit: (habit: Omit<Habit, "id" | "userId" | "createdAt">) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitEntry: (habitId: string, date: string) => void;

  upsertDailyPlan: (date: string, patch: Partial<DailyPlan>) => void;
  createTimeBlock: (block: Omit<TimeBlock, "id" | "userId">) => TimeBlock;
  updateTimeBlock: (id: string, patch: Partial<TimeBlock>) => void;
  deleteTimeBlock: (id: string) => void;
  replaceDayTimeBlocks: (date: string, blocks: Omit<TimeBlock, "id" | "userId">[]) => void;

  logFocusSession: (session: Omit<FocusSession, "id" | "userId">) => FocusSession;
  deleteFocusSession: (id: string) => void;

  createJournalEntry: (entry: Omit<JournalEntry, "id" | "userId" | "createdAt" | "updatedAt">) => JournalEntry;
  updateJournalEntry: (id: string, patch: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

  saveWeeklyReview: (review: Omit<WeeklyReview, "id" | "userId" | "createdAt" | "updatedAt">) => WeeklyReview;
  updateWeeklyReview: (id: string, patch: Partial<WeeklyReview>) => void;
  deleteWeeklyReview: (id: string) => void;

  saveConversation: (conv: AIConversation) => void;
  deleteConversation: (id: string) => void;
  applyProposedAction: (action: AIProposedAction) => void;

  updatePreferences: (patch: Partial<UserPreferences>) => void;
  updateProfile: (patch: { name?: string; role?: string }) => void;
  exportAllData: () => string;
  wipeWorkspaceData: () => Promise<void>;
}

const OSContext = createContext<OSContextValue | null>(null);

export function OSProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceData>(() => createDemoWorkspace());

  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone?: "default" | "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, tone: "default" | "success" | "error" = "default") => {
      setToast({ message, tone });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3200);
    },
    []
  );

  // Sync theme to document root
  useEffect(() => {
    const root = document.documentElement;
    const pref = data.preferences.theme;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = pref === "dark" || (pref === "system" && prefersDark);
    root.classList.toggle("dark", useDark);
  }, [data.preferences.theme]);

  // Global keyboard shortcut Cmd/Ctrl + K for Quick Capture
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickCaptureOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Persist demo workspace to localStorage ONLY when in Demo Mode
  useEffect(() => {
    if (!isDemo) return;
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors
    }
  }, [data, isDemo]);

  // Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Check if user already chose demo mode
      const savedDemo = typeof window !== "undefined" && localStorage.getItem(DEMO_MODE_FLAG) === "true";
      if (savedDemo) {
        try {
          const raw = localStorage.getItem(DEMO_STORAGE_KEY);
          setData(raw ? (JSON.parse(raw) as WorkspaceData) : createDemoWorkspace());
        } catch {
          setData(createDemoWorkspace());
        }
        setIsDemo(true);
      }
      setIsLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsDemo(false);
        localStorage.removeItem(DEMO_MODE_FLAG);
        try {
          const loaded = await loadUserWorkspaceFromFirestore(
            firebaseUser.uid,
            firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Explorer",
            firebaseUser.email || ""
          );
          setData(loaded);
        } catch (err) {
          console.error("Failed to load Firestore workspace:", err);
          setData(
            createEmptyWorkspace(
              firebaseUser.uid,
              firebaseUser.displayName || "Explorer",
              firebaseUser.email || ""
            )
          );
          showToast("Loaded local session (check Firestore rules/connection)", "error");
        }
      } else {
        setUser(null);
        const savedDemo = localStorage.getItem(DEMO_MODE_FLAG) === "true";
        if (savedDemo) {
          try {
            const raw = localStorage.getItem(DEMO_STORAGE_KEY);
            setData(raw ? (JSON.parse(raw) as WorkspaceData) : createDemoWorkspace());
          } catch {
            setData(createDemoWorkspace());
          }
          setIsDemo(true);
        } else {
          setIsDemo(false);
        }
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [showToast]);

  const activeUserId = user?.uid || "demo_user";
  const shouldSyncFirestore = Boolean(user && !isDemo && isFirebaseConfigured);

  const persistSafe = useCallback(
    (op: Promise<void>) => {
      op.catch((err) => {
        console.error("Firestore sync failed:", err);
        showToast("Cloud sync error — check Firestore rules or connection", "error");
      });
    },
    [showToast]
  );

  const enterDemoMode = useCallback(() => {
    localStorage.setItem(DEMO_MODE_FLAG, "true");
    try {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      setData(raw ? (JSON.parse(raw) as WorkspaceData) : createDemoWorkspace());
    } catch {
      setData(createDemoWorkspace());
    }
    setIsDemo(true);
    setAuthError(null);
  }, []);

  const exitDemoMode = useCallback(() => {
    localStorage.removeItem(DEMO_MODE_FLAG);
    setIsDemo(false);
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh = createDemoWorkspace();
    setData(fresh);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
    showToast("Demo workspace reset to fresh sample data", "success");
  }, [showToast]);

  const formatAuthError = (e: unknown, fallback: string) => {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (code === "auth/configuration-not-found") {
      return "Firebase Authentication is not enabled yet for this project. Open Firebase Console → Authentication → click 'Get started', then enable Google and Email/Password under Sign-in method.";
    }
    if (code === "auth/operation-not-allowed") {
      return "This sign-in provider is disabled. Enable Google (and Email/Password) in Firebase Console → Authentication → Sign-in method.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized. Add localhost (or your domain) in Firebase Console → Authentication → Settings → Authorized domains.";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Sign-in popup was closed before completing.";
    }
    return e instanceof Error ? e.message : fallback;
  };

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase Authentication is not configured.");
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      setAuthError(formatAuthError(e, "Failed to sign in"));
    }
  }, []);

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      if (!auth) throw new Error("Firebase Authentication is not configured.");
      setAuthError(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateFirebaseProfile(cred.user, { displayName: name.trim() });
        }
      } catch (e: unknown) {
        setAuthError(formatAuthError(e, "Failed to create account"));
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    if (!auth) throw new Error("Firebase Authentication is not configured.");
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      setAuthError(formatAuthError(e, "Google sign-in failed"));
    }
  }, []);

  const logout = useCallback(async () => {
    if (isDemo) {
      exitDemoMode();
      return;
    }
    if (auth) {
      await signOut(auth);
    }
  }, [isDemo, exitDemoMode]);

  // ---- Vision ----
  const updateVision = useCallback(
    (patch: Partial<Vision>) => {
      setData((prev) => {
        const next: Vision = {
          ...prev.vision,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        if (shouldSyncFirestore) void upsertDocument("visions", next);
        return { ...prev, vision: next };
      });
    },
    [shouldSyncFirestore]
  );

  // ---- Goals ----
  const createGoal = useCallback(
    (goalInput: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt">): Goal => {
      const now = new Date().toISOString();
      const goal: Goal = {
        ...goalInput,
        id: uid("goal"),
        userId: activeUserId,
        createdAt: now,
        updatedAt: now,
      };
      setData((prev) => ({ ...prev, goals: [goal, ...prev.goals] }));
      if (shouldSyncFirestore) void upsertDocument("goals", goal);
      showToast("Goal created", "success");
      return goal;
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) => {
      setData((prev) => {
        const goals = prev.goals.map((g) => {
          if (g.id !== id) return g;
          const updated = { ...g, ...patch, updatedAt: new Date().toISOString() };
          if (shouldSyncFirestore) void upsertDocument("goals", updated);
          return updated;
        });
        return { ...prev, goals };
      });
    },
    [shouldSyncFirestore]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      setData((prev) => {
        const orphanMilestones = prev.milestones.filter((m) => m.goalId === id);
        if (shouldSyncFirestore) {
          persistSafe(removeDocument("goals", id));
          orphanMilestones.forEach((m) => persistSafe(removeDocument("milestones", m.id)));
        }
        return {
          ...prev,
          goals: prev.goals.filter((g) => g.id !== id),
          milestones: prev.milestones.filter((m) => m.goalId !== id),
        };
      });
      showToast("Goal deleted");
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  // ---- Milestones ----
  const createMilestone = useCallback(
    (msInput: Omit<Milestone, "id" | "userId" | "createdAt">): Milestone => {
      const ms: Milestone = {
        ...msInput,
        id: uid("ms"),
        userId: activeUserId,
        createdAt: new Date().toISOString(),
      };
      setData((prev) => ({ ...prev, milestones: [...prev.milestones, ms] }));
      if (shouldSyncFirestore) void upsertDocument("milestones", ms);
      return ms;
    },
    [activeUserId, shouldSyncFirestore]
  );

  const updateMilestone = useCallback(
    (id: string, patch: Partial<Milestone>) => {
      setData((prev) => {
        const milestones = prev.milestones.map((m) => {
          if (m.id !== id) return m;
          const updated = { ...m, ...patch };
          if (shouldSyncFirestore) void upsertDocument("milestones", updated);
          return updated;
        });
        return { ...prev, milestones };
      });
    },
    [shouldSyncFirestore]
  );

  const deleteMilestone = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        milestones: prev.milestones.filter((m) => m.id !== id),
      }));
      if (shouldSyncFirestore) void removeDocument("milestones", id);
    },
    [shouldSyncFirestore]
  );

  // ---- Projects ----
  const createProject = useCallback(
    (projInput: Omit<Project, "id" | "userId" | "createdAt">): Project => {
      const proj: Project = {
        ...projInput,
        id: uid("proj"),
        userId: activeUserId,
        createdAt: new Date().toISOString(),
      };
      setData((prev) => ({ ...prev, projects: [proj, ...prev.projects] }));
      if (shouldSyncFirestore) void upsertDocument("projects", proj);
      return proj;
    },
    [activeUserId, shouldSyncFirestore]
  );

  const deleteProject = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
      }));
      if (shouldSyncFirestore) void removeDocument("projects", id);
    },
    [shouldSyncFirestore]
  );

  // ---- Tasks ----
  const createTask = useCallback(
    (taskInput: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">): Task => {
      const now = new Date().toISOString();
      const task: Task = {
        ...taskInput,
        id: uid("task"),
        userId: activeUserId,
        createdAt: now,
        updatedAt: now,
      };
      setData((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      if (shouldSyncFirestore) void upsertDocument("tasks", task);
      return task;
    },
    [activeUserId, shouldSyncFirestore]
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      setData((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (t.id !== id) return t;
          const updated: Task = {
            ...t,
            ...patch,
            updatedAt: new Date().toISOString(),
          };
          if (shouldSyncFirestore) void upsertDocument("tasks", updated);
          return updated;
        });
        return { ...prev, tasks };
      });
    },
    [shouldSyncFirestore]
  );

  const toggleTaskComplete = useCallback(
    (id: string) => {
      let spawnedTitle: string | null = null;
      setData((prev) => {
        let nextOccurrence: Task | null = null;
        const tasks = prev.tasks.map((t) => {
          if (t.id !== id) return t;
          const nextDone = t.status !== "done";
          const nowIso = new Date().toISOString();
          const updated: Task = {
            ...t,
            status: nextDone ? "done" : "todo",
            completedAt: nextDone ? nowIso : undefined,
            updatedAt: nowIso,
          };
          if (shouldSyncFirestore) persistSafe(upsertDocument("tasks", updated));

          if (nextDone && t.recurrence && t.recurrence !== "none") {
            const base = t.dueDate ? parseISO(t.dueDate) : new Date();
            let nextDate = addDays(base, 1);
            if (t.recurrence === "weekdays") {
              nextDate = addDays(base, 1);
              while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
                nextDate = addDays(nextDate, 1);
              }
            } else if (t.recurrence === "weekly") {
              nextDate = addDays(base, 7);
            } else if (t.recurrence === "monthly") {
              nextDate = addMonths(base, 1);
            }
            const nextIsoDate = format(nextDate, "yyyy-MM-dd");
            nextOccurrence = {
              ...t,
              id: uid("task"),
              status: "todo",
              dueDate: nextIsoDate,
              scheduledDate: nextIsoDate,
              actualMinutes: 0,
              completedAt: undefined,
              subtasks: t.subtasks.map((s) => ({ ...s, completed: false })),
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            spawnedTitle = `${t.title} (${nextIsoDate})`;
            if (shouldSyncFirestore) persistSafe(upsertDocument("tasks", nextOccurrence));
          }
          return updated;
        });
        return {
          ...prev,
          tasks: nextOccurrence ? [nextOccurrence, ...tasks] : tasks,
        };
      });
      if (spawnedTitle) {
        showToast(`Next recurring task scheduled: ${spawnedTitle}`, "success");
      }
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  const deleteTask = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }));
      if (shouldSyncFirestore) persistSafe(removeDocument("tasks", id));
    },
    [shouldSyncFirestore, persistSafe]
  );

  const bulkUpdateTasks = useCallback(
    (ids: string[], patch: Partial<Task>) => {
      const idSet = new Set(ids);
      setData((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (!idSet.has(t.id)) return t;
          const updated: Task = {
            ...t,
            ...patch,
            completedAt:
              patch.status === "done"
                ? new Date().toISOString()
                : patch.status
                ? undefined
                : t.completedAt,
            updatedAt: new Date().toISOString(),
          };
          if (shouldSyncFirestore) persistSafe(upsertDocument("tasks", updated));
          return updated;
        });
        return { ...prev, tasks };
      });
      showToast(`Updated ${ids.length} tasks`, "success");
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  const bulkDeleteTasks = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => !idSet.has(t.id)),
      }));
      if (shouldSyncFirestore) {
        ids.forEach((id) => persistSafe(removeDocument("tasks", id)));
      }
      showToast(`Deleted ${ids.length} task(s)`);
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  // ---- Habits ----
  const createHabit = useCallback(
    (habitInput: Omit<Habit, "id" | "userId" | "createdAt">): Habit => {
      const habit: Habit = {
        ...habitInput,
        id: uid("hab"),
        userId: activeUserId,
        createdAt: new Date().toISOString(),
      };
      setData((prev) => ({ ...prev, habits: [habit, ...prev.habits] }));
      if (shouldSyncFirestore) void upsertDocument("habits", habit);
      showToast("Habit created", "success");
      return habit;
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Habit>) => {
      setData((prev) => {
        const habits = prev.habits.map((h) => {
          if (h.id !== id) return h;
          const updated = { ...h, ...patch };
          if (shouldSyncFirestore) void upsertDocument("habits", updated);
          return updated;
        });
        return { ...prev, habits };
      });
    },
    [shouldSyncFirestore]
  );

  const deleteHabit = useCallback(
    (id: string) => {
      setData((prev) => {
        const orphanEntries = prev.habitEntries.filter((e) => e.habitId === id);
        if (shouldSyncFirestore) {
          persistSafe(removeDocument("habits", id));
          orphanEntries.forEach((e) => persistSafe(removeDocument("habitEntries", e.id)));
        }
        return {
          ...prev,
          habits: prev.habits.filter((h) => h.id !== id),
          habitEntries: prev.habitEntries.filter((e) => e.habitId !== id),
        };
      });
      showToast("Habit deleted");
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  const toggleHabitEntry = useCallback(
    (habitId: string, date: string) => {
      const entryId = `he_${habitId}_${date}`;
      setData((prev) => {
        const existing = prev.habitEntries.find(
          (e) => e.habitId === habitId && e.date === date
        );
        if (existing) {
          const updated: HabitEntry = { ...existing, completed: !existing.completed };
          if (shouldSyncFirestore) void upsertDocument("habitEntries", updated);
          return {
            ...prev,
            habitEntries: prev.habitEntries.map((e) => (e.id === existing.id ? updated : e)),
          };
        }
        const created: HabitEntry = {
          id: entryId,
          userId: activeUserId,
          habitId,
          date,
          completed: true,
        };
        if (shouldSyncFirestore) void upsertDocument("habitEntries", created);
        return { ...prev, habitEntries: [...prev.habitEntries, created] };
      });
    },
    [activeUserId, shouldSyncFirestore]
  );

  // ---- Daily Plans & Time Blocks ----
  const upsertDailyPlan = useCallback(
    (date: string, patch: Partial<DailyPlan>) => {
      setData((prev) => {
        const existing = prev.dailyPlans.find((p) => p.date === date);
        const updated: DailyPlan = existing
          ? { ...existing, ...patch, updatedAt: new Date().toISOString() }
          : {
              id: `plan_${activeUserId}_${date}`,
              userId: activeUserId,
              date,
              ...patch,
              updatedAt: new Date().toISOString(),
            };
        if (shouldSyncFirestore) void upsertDocument("dailyPlans", updated);
        const dailyPlans = existing
          ? prev.dailyPlans.map((p) => (p.date === date ? updated : p))
          : [...prev.dailyPlans, updated];
        return { ...prev, dailyPlans };
      });
    },
    [activeUserId, shouldSyncFirestore]
  );

  const createTimeBlock = useCallback(
    (blockInput: Omit<TimeBlock, "id" | "userId">): TimeBlock => {
      const block: TimeBlock = {
        ...blockInput,
        id: uid("tb"),
        userId: activeUserId,
      };
      setData((prev) => ({ ...prev, timeBlocks: [...prev.timeBlocks, block] }));
      if (shouldSyncFirestore) void upsertDocument("timeBlocks", block);
      return block;
    },
    [activeUserId, shouldSyncFirestore]
  );

  const updateTimeBlock = useCallback(
    (id: string, patch: Partial<TimeBlock>) => {
      setData((prev) => {
        const timeBlocks = prev.timeBlocks.map((b) => {
          if (b.id !== id) return b;
          const updated = { ...b, ...patch };
          if (shouldSyncFirestore) void upsertDocument("timeBlocks", updated);
          return updated;
        });
        return { ...prev, timeBlocks };
      });
    },
    [shouldSyncFirestore]
  );

  const deleteTimeBlock = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        timeBlocks: prev.timeBlocks.filter((b) => b.id !== id),
      }));
      if (shouldSyncFirestore) void removeDocument("timeBlocks", id);
    },
    [shouldSyncFirestore]
  );

  const replaceDayTimeBlocks = useCallback(
    (date: string, blocks: Omit<TimeBlock, "id" | "userId">[]) => {
      const created: TimeBlock[] = blocks.map((b) => ({
        ...b,
        id: uid("tb"),
        userId: activeUserId,
      }));
      setData((prev) => {
        const oldBlocks = prev.timeBlocks.filter((b) => b.date === date);
        if (shouldSyncFirestore) {
          oldBlocks.forEach((b) => void removeDocument("timeBlocks", b.id));
          created.forEach((b) => void upsertDocument("timeBlocks", b));
        }
        return {
          ...prev,
          timeBlocks: [
            ...prev.timeBlocks.filter((b) => b.date !== date),
            ...created,
          ],
        };
      });
      showToast("Daily schedule updated", "success");
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  // ---- Focus Sessions ----
  const logFocusSession = useCallback(
    (sessionInput: Omit<FocusSession, "id" | "userId">): FocusSession => {
      const session: FocusSession = {
        ...sessionInput,
        id: uid("fs"),
        userId: activeUserId,
      };
      setData((prev) => {
        const tasks = session.taskId
          ? prev.tasks.map((t) => {
              if (t.id !== session.taskId) return t;
              const updated = {
                ...t,
                actualMinutes: (t.actualMinutes || 0) + session.actualMinutes,
                updatedAt: new Date().toISOString(),
              };
              if (shouldSyncFirestore) void upsertDocument("tasks", updated);
              return updated;
            })
          : prev.tasks;
        return {
          ...prev,
          tasks,
          focusSessions: [session, ...prev.focusSessions],
        };
      });
      if (shouldSyncFirestore) void upsertDocument("focusSessions", session);
      showToast(`Logged ${session.actualMinutes}m focus session`, "success");
      return session;
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  const deleteFocusSession = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        focusSessions: prev.focusSessions.filter((s) => s.id !== id),
      }));
      if (shouldSyncFirestore) void removeDocument("focusSessions", id);
    },
    [shouldSyncFirestore]
  );

  // ---- Journal ----
  const createJournalEntry = useCallback(
    (entryInput: Omit<JournalEntry, "id" | "userId" | "createdAt" | "updatedAt">): JournalEntry => {
      const now = new Date().toISOString();
      const entry: JournalEntry = {
        ...entryInput,
        id: uid("jr"),
        userId: activeUserId,
        createdAt: now,
        updatedAt: now,
      };
      setData((prev) => ({ ...prev, journalEntries: [entry, ...prev.journalEntries] }));
      if (shouldSyncFirestore) void upsertDocument("journalEntries", entry);
      showToast("Journal entry saved", "success");
      return entry;
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  const updateJournalEntry = useCallback(
    (id: string, patch: Partial<JournalEntry>) => {
      setData((prev) => {
        const journalEntries = prev.journalEntries.map((j) => {
          if (j.id !== id) return j;
          const updated = { ...j, ...patch, updatedAt: new Date().toISOString() };
          if (shouldSyncFirestore) void upsertDocument("journalEntries", updated);
          return updated;
        });
        return { ...prev, journalEntries };
      });
    },
    [shouldSyncFirestore]
  );

  const deleteJournalEntry = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        journalEntries: prev.journalEntries.filter((j) => j.id !== id),
      }));
      if (shouldSyncFirestore) void removeDocument("journalEntries", id);
    },
    [shouldSyncFirestore]
  );

  // ---- Weekly Reviews ----
  const saveWeeklyReview = useCallback(
    (reviewInput: Omit<WeeklyReview, "id" | "userId" | "createdAt" | "updatedAt">): WeeklyReview => {
      const now = new Date().toISOString();
      const review: WeeklyReview = {
        ...reviewInput,
        id: uid("wr"),
        userId: activeUserId,
        createdAt: now,
        updatedAt: now,
      };
      setData((prev) => ({ ...prev, weeklyReviews: [review, ...prev.weeklyReviews] }));
      if (shouldSyncFirestore) void upsertDocument("weeklyReviews", review);
      showToast("Weekly review saved", "success");
      return review;
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  const updateWeeklyReview = useCallback(
    (id: string, patch: Partial<WeeklyReview>) => {
      setData((prev) => {
        const weeklyReviews = prev.weeklyReviews.map((w) => {
          if (w.id !== id) return w;
          const updated = { ...w, ...patch, updatedAt: new Date().toISOString() };
          if (shouldSyncFirestore) persistSafe(upsertDocument("weeklyReviews", updated));
          return updated;
        });
        return { ...prev, weeklyReviews };
      });
      showToast("Weekly review updated", "success");
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  const deleteWeeklyReview = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        weeklyReviews: prev.weeklyReviews.filter((w) => w.id !== id),
      }));
      if (shouldSyncFirestore) persistSafe(removeDocument("weeklyReviews", id));
      showToast("Weekly review deleted");
    },
    [shouldSyncFirestore, persistSafe, showToast]
  );

  // ---- AI Conversations & Approved Actions ----
  const saveConversation = useCallback(
    (conv: AIConversation) => {
      setData((prev) => {
        const exists = prev.aiConversations.some((c) => c.id === conv.id);
        const aiConversations = exists
          ? prev.aiConversations.map((c) => (c.id === conv.id ? conv : c))
          : [conv, ...prev.aiConversations];
        return { ...prev, aiConversations };
      });
      if (shouldSyncFirestore) persistSafe(upsertDocument("aiConversations", conv));
    },
    [shouldSyncFirestore, persistSafe]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setData((prev) => ({
        ...prev,
        aiConversations: prev.aiConversations.filter((c) => c.id !== id),
      }));
      if (shouldSyncFirestore) persistSafe(removeDocument("aiConversations", id));
    },
    [shouldSyncFirestore, persistSafe]
  );

  const applyProposedAction = useCallback(
    (action: AIProposedAction) => {
      const p = action.payload;
      if (action.type === "create_task") {
        createTask({
          title: String(p.title || action.label),
          description: p.description ? String(p.description) : undefined,
          status: "todo",
          priority: (p.priority as Task["priority"]) || "medium",
          dueDate: p.dueDate ? String(p.dueDate) : todayISO(),
          scheduledDate: p.scheduledDate ? String(p.scheduledDate) : todayISO(),
          estimatedMinutes: Number(p.estimatedMinutes) || 30,
          actualMinutes: 0,
          category: String(p.category || "Personal Development"),
          goalId: p.goalId ? String(p.goalId) : undefined,
          recurrence: "none",
          subtasks: [],
        });
        showToast("Task created from AI recommendation", "success");
      } else if (action.type === "reschedule_task" || action.type === "defer_task") {
        const taskId = String(p.taskId || "");
        const newDate = String(p.newDate || todayISO());
        if (taskId) {
          updateTask(taskId, {
            scheduledDate: newDate,
            dueDate: p.updateDueDate ? newDate : undefined,
            status: action.type === "defer_task" ? "deferred" : "todo",
          });
          showToast("Task rescheduled", "success");
        }
      } else if (action.type === "create_milestone") {
        if (p.goalId && p.title) {
          createMilestone({
            goalId: String(p.goalId),
            title: String(p.title),
            targetDate: p.targetDate ? String(p.targetDate) : undefined,
            completed: false,
            order: 99,
          });
          showToast("Milestone added", "success");
        }
      }
    },
    [createTask, updateTask, createMilestone, showToast]
  );

  // ---- Preferences & Profile ----
  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      setData((prev) => {
        const preferences: UserPreferences = { ...prev.preferences, ...patch };
        if (shouldSyncFirestore) {
          void upsertUserSingleton("userPreferences", activeUserId, preferences);
        }
        return { ...prev, preferences };
      });
    },
    [activeUserId, shouldSyncFirestore]
  );

  const updateProfile = useCallback(
    (patch: { name?: string; role?: string }) => {
      setData((prev) => {
        const profile = {
          ...prev.profile,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        const preferences = patch.name
          ? { ...prev.preferences, displayName: patch.name }
          : prev.preferences;
        if (shouldSyncFirestore) {
          void upsertUserSingleton("users", activeUserId, profile);
          void upsertUserSingleton("userPreferences", activeUserId, preferences);
        }
        return { ...prev, profile, preferences };
      });
      showToast("Profile updated", "success");
    },
    [activeUserId, shouldSyncFirestore, showToast]
  );

  const exportAllData = useCallback(() => {
    return JSON.stringify(data, null, 2);
  }, [data]);

  const wipeWorkspaceData = useCallback(async () => {
    if (isDemo) {
      const empty = createEmptyWorkspace("demo_user", data.profile.name, data.profile.email);
      setData(empty);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(empty));
      showToast("Demo data cleared");
      return;
    }
    if (shouldSyncFirestore) {
      await deleteAllUserData(activeUserId);
      const fresh = createEmptyWorkspace(activeUserId, data.profile.name, data.profile.email);
      setData(fresh);
      showToast("All workspace data deleted");
    }
  }, [isDemo, shouldSyncFirestore, activeUserId, data.profile.name, data.profile.email, showToast]);

  const value = useMemo<OSContextValue>(
    () => ({
      user,
      isDemo,
      isLoading,
      isAuthenticated: Boolean(user || isDemo),
      firebaseReady: isFirebaseConfigured,
      authError,
      enterDemoMode,
      exitDemoMode,
      resetDemoData,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      logout,
      data,
      quickCaptureOpen,
      setQuickCaptureOpen,
      aiDrawerOpen,
      setAiDrawerOpen,
      activeFocusTaskId,
      setActiveFocusTaskId,
      toast,
      showToast,
      updateVision,
      createGoal,
      updateGoal,
      deleteGoal,
      createMilestone,
      updateMilestone,
      deleteMilestone,
      createProject,
      deleteProject,
      createTask,
      updateTask,
      toggleTaskComplete,
      deleteTask,
      bulkUpdateTasks,
      bulkDeleteTasks,
      createHabit,
      updateHabit,
      deleteHabit,
      toggleHabitEntry,
      upsertDailyPlan,
      createTimeBlock,
      updateTimeBlock,
      deleteTimeBlock,
      replaceDayTimeBlocks,
      logFocusSession,
      deleteFocusSession,
      createJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      saveWeeklyReview,
      updateWeeklyReview,
      deleteWeeklyReview,
      saveConversation,
      deleteConversation,
      applyProposedAction,
      updatePreferences,
      updateProfile,
      exportAllData,
      wipeWorkspaceData,
    }),
    [
      user,
      isDemo,
      isLoading,
      authError,
      enterDemoMode,
      exitDemoMode,
      resetDemoData,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      logout,
      data,
      quickCaptureOpen,
      aiDrawerOpen,
      activeFocusTaskId,
      toast,
      showToast,
      updateVision,
      createGoal,
      updateGoal,
      deleteGoal,
      createMilestone,
      updateMilestone,
      deleteMilestone,
      createProject,
      deleteProject,
      createTask,
      updateTask,
      toggleTaskComplete,
      deleteTask,
      bulkUpdateTasks,
      bulkDeleteTasks,
      createHabit,
      updateHabit,
      deleteHabit,
      toggleHabitEntry,
      upsertDailyPlan,
      createTimeBlock,
      updateTimeBlock,
      deleteTimeBlock,
      replaceDayTimeBlocks,
      logFocusSession,
      deleteFocusSession,
      createJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      saveWeeklyReview,
      updateWeeklyReview,
      deleteWeeklyReview,
      saveConversation,
      deleteConversation,
      applyProposedAction,
      updatePreferences,
      updateProfile,
      exportAllData,
      wipeWorkspaceData,
    ]
  );

  return <OSContext.Provider value={value}>{children}</OSContext.Provider>;
}

export function useOS(): OSContextValue {
  const ctx = useContext(OSContext);
  if (!ctx) throw new Error("useOS must be used within OSProvider");
  return ctx;
}

