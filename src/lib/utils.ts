import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays, parseISO } from "date-fns";
import type {
  ExecutionScoreWeights,
  FocusSession,
  Goal,
  Habit,
  HabitEntry,
  Task,
} from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function daysAgoISO(days: number): string {
  return format(subDays(new Date(), days), "yyyy-MM-dd");
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatFriendlyDate(dateStr?: string): string {
  if (!dateStr) return "No date";
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface ExecutionScoreBreakdown {
  total: number;
  prioritiesScore: number;
  habitsScore: number;
  focusScore: number;
  goalsScore: number;
  details: {
    completedToday: number;
    scheduledToday: number;
    habitsDoneToday: number;
    activeHabits: number;
    focusMinutesToday: number;
    focusTargetMinutes: number;
    goalAlignedDone: number;
  };
}

export function calculateDailyExecutionScore(params: {
  date: string;
  tasks: Task[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  focusSessions: FocusSession[];
  goals: Goal[];
  focusTargetMinutes: number;
  weights: ExecutionScoreWeights;
}): ExecutionScoreBreakdown {
  const {
    date,
    tasks,
    habits,
    habitEntries,
    focusSessions,
    focusTargetMinutes,
    weights,
  } = params;

  const todayTasks = tasks.filter(
    (t) => t.scheduledDate === date || t.dueDate === date || t.completedAt?.startsWith(date)
  );
  const completedToday = todayTasks.filter((t) => t.status === "done").length;
  const scheduledToday = Math.max(todayTasks.length, 1);
  const priorityRatio = Math.min(1, completedToday / scheduledToday);

  const activeHabits = habits.filter((h) => h.status === "active");
  const habitsDoneToday = habitEntries.filter(
    (e) => e.date === date && e.completed && activeHabits.some((h) => h.id === e.habitId)
  ).length;
  const habitRatio =
    activeHabits.length > 0 ? Math.min(1, habitsDoneToday / activeHabits.length) : 0;

  const focusMinutesToday = focusSessions
    .filter((s) => s.date === date)
    .reduce((acc, s) => acc + s.actualMinutes, 0);
  const focusRatio =
    focusTargetMinutes > 0 ? Math.min(1, focusMinutesToday / focusTargetMinutes) : 0;

  const goalAlignedDone = todayTasks.filter(
    (t) => t.status === "done" && Boolean(t.goalId)
  ).length;
  const goalAlignedTotal = todayTasks.filter((t) => Boolean(t.goalId)).length;
  const goalRatio =
    goalAlignedTotal > 0 ? Math.min(1, goalAlignedDone / goalAlignedTotal) : priorityRatio;

  const weightSum =
    weights.priorities + weights.habits + weights.focus + weights.goals || 100;

  const prioritiesScore = Math.round((priorityRatio * weights.priorities * 100) / weightSum);
  const habitsScore = Math.round((habitRatio * weights.habits * 100) / weightSum);
  const focusScore = Math.round((focusRatio * weights.focus * 100) / weightSum);
  const goalsScore = Math.round((goalRatio * weights.goals * 100) / weightSum);

  const total = Math.min(100, prioritiesScore + habitsScore + focusScore + goalsScore);

  return {
    total,
    prioritiesScore,
    habitsScore,
    focusScore,
    goalsScore,
    details: {
      completedToday,
      scheduledToday: todayTasks.length,
      habitsDoneToday,
      activeHabits: activeHabits.length,
      focusMinutesToday,
      focusTargetMinutes,
      goalAlignedDone,
    },
  };
}

