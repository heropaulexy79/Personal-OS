export type Priority = "low" | "medium" | "high" | "urgent";
export type GoalStatus = "active" | "completed" | "paused" | "archived";
export type TaskStatus = "todo" | "in_progress" | "done" | "deferred";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type HabitFrequency = "daily" | "weekdays" | "3x_week" | "5x_week" | "weekly";
export type HabitStatus = "active" | "paused" | "archived";
export type JournalType = "daily_reflection" | "weekly_review" | "freeform" | "lesson" | "idea";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeArea {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface Vision {
  id: string;
  userId: string;
  statement: string;
  northStar: string;
  coreValues: string[];
  horizonYears: number;
  lifeAreas: LifeArea[];
  updatedAt: string;
}

export interface Milestone {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed: boolean;
  order: number;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  whyItMatters?: string;
  category: string; // LifeArea name
  targetDate: string;
  priority: Priority;
  status: GoalStatus;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goalId?: string;
  category: string;
  status: "active" | "completed" | "archived";
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string; // YYYY-MM-DD
  scheduledDate?: string; // YYYY-MM-DD
  estimatedMinutes: number;
  actualMinutes: number;
  goalId?: string;
  projectId?: string;
  category: string;
  notes?: string;
  recurrence: Recurrence;
  subtasks: Subtask[];
  isTopPriority?: boolean;
  whyItMatters?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  frequency: HabitFrequency;
  reminderTime?: string; // HH:mm
  status: HabitStatus;
  targetPerWeek: number;
  createdAt: string;
  pausedAt?: string;
}

export interface HabitEntry {
  id: string;
  userId: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  note?: string;
}

export interface TimeBlock {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  taskId?: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: "focus" | "routine" | "meeting" | "break" | "admin";
  completed: boolean;
  rationale?: string;
  isFixed?: boolean;
}

export interface DailyPlan {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  focusTaskId?: string;
  intention?: string;
  aiSummary?: string;
  updatedAt: string;
}

export interface FocusSession {
  id: string;
  userId: string;
  taskId?: string;
  taskTitle: string;
  goalId?: string;
  category?: string;
  plannedMinutes: number;
  actualMinutes: number;
  breakMinutes: number;
  completed: boolean;
  startedAt: string;
  endedAt: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface DailyReflectionPrompts {
  accomplished: string;
  matteredMost: string;
  avoided: string;
  consumedAttention: string;
  learned: string;
  doDifferentlyTomorrow: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  type: JournalType;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  prompts?: DailyReflectionPrompts;
  tags: string[];
  mood?: "grounded" | "energized" | "stretched" | "reflective" | "tired";
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  summary: string;
  goalsProgressed: string[];
  tasksCompletedCount: number;
  tasksDeferredCount: number;
  habitConsistencyPct: number;
  focusHours: number;
  accomplishments: string[];
  areasNeedingAttention: string[];
  nextWeekAdjustments: string[];
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIProposedAction {
  id: string;
  type: "create_task" | "reschedule_task" | "create_milestone" | "defer_task";
  label: string;
  description: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode?: "groq" | "mock";
  proposedActions?: AIProposedAction[];
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  messages: AIMessage[];
  updatedAt: string;
}

export interface ExecutionScoreWeights {
  priorities: number; // default 35
  habits: number; // default 25
  focus: number; // default 25
  goals: number; // default 15
}

export interface UserPreferences {
  userId: string;
  displayName: string;
  timezone: string;
  workStartHour: string; // e.g. "08:30"
  workEndHour: string; // e.g. "17:30"
  maxDailyWorkloadHours: number; // default 6
  preferredFocusMinutes: number; // default 50
  preferredBreakMinutes: number; // default 10
  dailyFocusTargetMinutes: number; // default 180
  weeklyReviewDay: "Friday" | "Saturday" | "Sunday";
  theme: "light" | "dark" | "system";
  groqModel: string;
  notificationsEnabled: boolean;
  habitRemindersEnabled: boolean;
  scoreWeights: ExecutionScoreWeights;
}

export interface WorkspaceData {
  profile: UserProfile;
  vision: Vision;
  goals: Goal[];
  milestones: Milestone[];
  projects: Project[];
  tasks: Task[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  dailyPlans: DailyPlan[];
  timeBlocks: TimeBlock[];
  focusSessions: FocusSession[];
  journalEntries: JournalEntry[];
  weeklyReviews: WeeklyReview[];
  aiConversations: AIConversation[];
  preferences: UserPreferences;
}

