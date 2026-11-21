"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, subDays } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Info,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import {
  calculateDailyExecutionScore,
  formatFriendlyDate,
  formatMinutes,
  getGreeting,
  todayISO,
} from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PriorityBadge,
  ProgressBar,
} from "@/components/ui/primitives";

interface DailyInsightResponse {
  mode: "groq" | "mock";
  headline: string;
  insight: string;
  suggestion: string;
}

export default function OverviewPage() {
  const router = useRouter();
  const {
    data,
    toggleTaskComplete,
    toggleHabitEntry,
    updateTimeBlock,
    setActiveFocusTaskId,
    setQuickCaptureOpen,
  } = useOS();

  const today = todayISO();
  const todayFormatted = format(new Date(), "EEEE, MMMM d, yyyy");

  const todayTasks = useMemo(
    () =>
      data.tasks.filter(
        (t) =>
          t.scheduledDate === today ||
          t.dueDate === today ||
          t.completedAt?.startsWith(today)
      ),
    [data.tasks, today]
  );

  const overdueTasks = useMemo(
    () => data.tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today),
    [data.tasks, today]
  );

  const upcomingDeadlines = useMemo(
    () =>
      data.tasks
        .filter((t) => t.status !== "done" && t.dueDate && t.dueDate >= today)
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
        .slice(0, 5),
    [data.tasks, today]
  );

  const activeGoals = useMemo(
    () => data.goals.filter((g) => g.status === "active"),
    [data.goals]
  );

  const activeHabits = useMemo(
    () => data.habits.filter((h) => h.status === "active"),
    [data.habits]
  );

  const todayBlocks = useMemo(
    () =>
      data.timeBlocks
        .filter((b) => b.date === today)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data.timeBlocks, today]
  );

  const focusMinutesToday = useMemo(
    () =>
      data.focusSessions
        .filter((s) => s.date === today)
        .reduce((sum, s) => sum + s.actualMinutes, 0),
    [data.focusSessions, today]
  );

  const todayCompletedCount = todayTasks.filter((t) => t.status === "done").length;

  const habitsCompletedToday = useMemo(
    () =>
      activeHabits.filter((h) =>
        data.habitEntries.some((e) => e.habitId === h.id && e.date === today && e.completed)
      ).length,
    [activeHabits, data.habitEntries, today]
  );

  // Pick Today's Focus task
  const todaysFocusTask = useMemo(() => {
    const plan = data.dailyPlans.find((p) => p.date === today);
    if (plan?.focusTaskId) {
      const found = data.tasks.find((t) => t.id === plan.focusTaskId && t.status !== "done");
      if (found) return found;
    }
    return (
      todayTasks.find((t) => t.isTopPriority && t.status !== "done") ||
      todayTasks.find((t) => t.priority === "urgent" && t.status !== "done") ||
      todayTasks.find((t) => t.status !== "done") ||
      data.tasks.find((t) => t.status !== "done") ||
      null
    );
  }, [data.dailyPlans, data.tasks, today, todayTasks]);

  const focusGoal = useMemo(
    () =>
      todaysFocusTask?.goalId
        ? data.goals.find((g) => g.id === todaysFocusTask.goalId)
        : undefined,
    [data.goals, todaysFocusTask]
  );

  const score = useMemo(
    () =>
      calculateDailyExecutionScore({
        date: today,
        tasks: data.tasks,
        habits: data.habits,
        habitEntries: data.habitEntries,
        focusSessions: data.focusSessions,
        goals: data.goals,
        focusTargetMinutes: data.preferences.dailyFocusTargetMinutes,
        weights: data.preferences.scoreWeights,
      }),
    [data, today]
  );

  // 7-day consistency strip
  const weeklyConsistency = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayLabel = format(d, "EEE");
      const habitsDone = activeHabits.filter((h) =>
        data.habitEntries.some((e) => e.habitId === h.id && e.date === dateStr && e.completed)
      ).length;
      const pct =
        activeHabits.length > 0 ? Math.round((habitsDone / activeHabits.length) * 100) : 0;
      const focusMins = data.focusSessions
        .filter((s) => s.date === dateStr)
        .reduce((a, b) => a + b.actualMinutes, 0);
      return { dateStr, dayLabel, pct, focusMins };
    });
  }, [activeHabits, data.habitEntries, data.focusSessions]);

  // AI Daily Insight
  const [insight, setInsight] = useState<DailyInsightResponse | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const fetchInsight = useCallback(async () => {
    setLoadingInsight(true);
    try {
      const scheduledGoalIds = new Set(todayTasks.map((t) => t.goalId).filter(Boolean));
      const neglectedGoal = activeGoals.find((g) => !scheduledGoalIds.has(g.id));

      const res = await fetch("/api/ai/daily-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          model: data.preferences.groqModel,
          context: {
            todayTasksCount: todayTasks.filter((t) => t.status !== "done").length,
            highPriorityCount: todayTasks.filter(
              (t) => t.status !== "done" && (t.priority === "high" || t.priority === "urgent")
            ).length,
            overdueCount: overdueTasks.length,
            completedTodayCount: todayCompletedCount,
            totalEstimatedMinutesToday: todayTasks
              .filter((t) => t.status !== "done")
              .reduce((sum, t) => sum + t.estimatedMinutes, 0),
            maxWorkloadHours: data.preferences.maxDailyWorkloadHours,
            activeGoalsCount: activeGoals.length,
            habitsDoneToday: habitsCompletedToday,
            activeHabitsCount: activeHabits.length,
            focusMinutesToday,
            topTaskTitle: todaysFocusTask?.title,
            neglectedGoalTitle: neglectedGoal?.title,
          },
        }),
      });
      const json = await res.json();
      if (json.insight) {
        setInsight(json as DailyInsightResponse);
      }
    } catch {
      // ignore network error
    } finally {
      setLoadingInsight(false);
    }
  }, [
    today,
    data.preferences.groqModel,
    data.preferences.maxDailyWorkloadHours,
    todayTasks,
    overdueTasks.length,
    todayCompletedCount,
    activeGoals,
    habitsCompletedToday,
    activeHabits.length,
    focusMinutesToday,
    todaysFocusTask?.title,
  ]);

  useEffect(() => {
    void fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, data.tasks.length]);

  const handleStartFocus = (taskId?: string) => {
    if (taskId) setActiveFocusTaskId(taskId);
    router.push("/focus");
  };

  return (
    <div className="space-y-6">
      {/* Editorial Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            {todayFormatted}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            {getGreeting()}, {data.profile.name}.
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Let&apos;s make today count.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/planner">
            <Button variant="outline" size="sm">
              <Calendar className="h-3.5 w-3.5" />
              Open Daily Planner
            </Button>
          </Link>
          <Button size="sm" onClick={() => setQuickCaptureOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            Quick Capture
          </Button>
        </div>
      </div>

      {/* Top Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Tasks Completed</span>
            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {todayCompletedCount}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              /{todayTasks.length}
            </span>
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Scheduled for today</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Focus Time</span>
            <Timer className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMinutes(focusMinutesToday)}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Target {formatMinutes(data.preferences.dailyFocusTargetMinutes)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Active Goals</span>
            <Target className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{activeGoals.length}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Avg{" "}
            {activeGoals.length > 0
              ? Math.round(
                  activeGoals.reduce((a, g) => a + g.progress, 0) / activeGoals.length
                )
              : 0}
            % progress
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Habits Today</span>
            <Flame className="h-4 w-4 text-[var(--warning)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {habitsCompletedToday}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              /{activeHabits.length}
            </span>
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Daily routines</p>
        </Card>

        <Card className="p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Deadlines</span>
            <Clock className="h-4 w-4 text-[var(--danger)]" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {upcomingDeadlines.length}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "All caught up"}
          </p>
        </Card>
      </div>

      {/* Hero Row: Today's Focus + Daily Execution Score + AI Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Focus Card */}
        <Card className="lg:col-span-7 p-6 flex flex-col justify-between relative overflow-hidden border-[var(--accent)]/25">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent)]/[0.04] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="accent">Today&apos;s Focus</Badge>
                {todaysFocusTask && <PriorityBadge priority={todaysFocusTask.priority} />}
              </div>
              {todaysFocusTask && (
                <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                  Est. {formatMinutes(todaysFocusTask.estimatedMinutes)}
                </span>
              )}
            </div>

            {todaysFocusTask ? (
              <div className="mt-4">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)] leading-snug">
                  {todaysFocusTask.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {todaysFocusTask.whyItMatters ||
                    todaysFocusTask.description ||
                    "Completing this moves your highest-leverage objective forward today."}
                </p>

                {focusGoal && (
                  <Link
                    href={`/goals/${focusGoal.id}`}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Target className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span>Aligned Goal:</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {focusGoal.title}
                    </span>
                    <span className="text-[var(--text-muted)]">({focusGoal.progress}%)</span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  No primary task selected yet
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Capture a task or open your Daily Planner to choose your highest-leverage focus.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--border)] flex flex-wrap items-center gap-2.5">
            <Button
              size="md"
              onClick={() => handleStartFocus(todaysFocusTask?.id)}
            >
              <Play className="h-4 w-4 fill-current" />
              Start Focus Session
            </Button>
            {todaysFocusTask && (
              <Button
                variant="outline"
                size="md"
                onClick={() => toggleTaskComplete(todaysFocusTask.id)}
              >
                <Check className="h-4 w-4" />
                Mark Complete
              </Button>
            )}
          </div>
        </Card>

        {/* Right Column: Execution Score + AI Insight */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Daily Execution Score */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle>Daily Execution Score</CardTitle>
                  <span
                    title="Transparent indicator calculated from your configured weights in Settings. Not a scientific measure."
                    className="text-[var(--text-muted)] cursor-help"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </div>
                <CardDescription>
                  Self-configured alignment indicator
                </CardDescription>
              </div>
              <div className="text-right">
                <span className="text-3xl font-semibold tracking-tight tabular-nums text-[var(--accent)]">
                  {score.total}
                </span>
                <span className="text-xs text-[var(--text-muted)]">/100</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-[var(--text-secondary)] mb-1">
                  <span>Priorities ({data.preferences.scoreWeights.priorities}%)</span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {score.details.completedToday}/{score.details.scheduledToday}
                  </span>
                </div>
                <ProgressBar
                  value={
                    score.details.scheduledToday > 0
                      ? (score.details.completedToday / score.details.scheduledToday) * 100
                      : 0
                  }
                />
              </div>

              <div>
                <div className="flex justify-between text-[var(--text-secondary)] mb-1">
                  <span>Routines ({data.preferences.scoreWeights.habits}%)</span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {score.details.habitsDoneToday}/{score.details.activeHabits}
                  </span>
                </div>
                <ProgressBar
                  value={
                    score.details.activeHabits > 0
                      ? (score.details.habitsDoneToday / score.details.activeHabits) * 100
                      : 0
                  }
                />
              </div>

              <div>
                <div className="flex justify-between text-[var(--text-secondary)] mb-1">
                  <span>Focus ({data.preferences.scoreWeights.focus}%)</span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {formatMinutes(score.details.focusMinutesToday)}
                  </span>
                </div>
                <ProgressBar
                  value={
                    score.details.focusTargetMinutes > 0
                      ? (score.details.focusMinutesToday / score.details.focusTargetMinutes) *
                        100
                      : 0
                  }
                />
              </div>

              <div>
                <div className="flex justify-between text-[var(--text-secondary)] mb-1">
                  <span>Goal Work ({data.preferences.scoreWeights.goals}%)</span>
                  <span className="tabular-nums font-medium text-[var(--text-primary)]">
                    {score.details.goalAlignedDone} done
                  </span>
                </div>
                <ProgressBar value={score.goalsScore * (100 / Math.max(data.preferences.scoreWeights.goals, 1))} />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Link
                href="/settings"
                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
              >
                Configure weights →
              </Link>
            </div>
          </Card>

          {/* AI Insight Card */}
          <Card className="p-5 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <CardTitle>{insight?.headline || "Daily AI Insight"}</CardTitle>
              </div>
              <div className="flex items-center gap-1.5">
                {insight && (
                  <Badge tone={insight.mode === "groq" ? "accent" : "neutral"}>
                    {insight.mode === "groq" ? "Groq" : "Mock AI"}
                  </Badge>
                )}
                <button
                  onClick={() => void fetchInsight()}
                  disabled={loadingInsight}
                  className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                  title="Refresh insight"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingInsight ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-sm text-[var(--text-primary)] leading-relaxed">
              {insight?.insight || "Analyzing your live schedule and goals..."}
            </p>
            {insight?.suggestion && (
              <p className="mt-2 text-xs text-[var(--accent)] font-medium">
                → {insight.suggestion}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Interactive Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Schedule */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today&apos;s Schedule</CardTitle>
              <CardDescription>{todayBlocks.length} planned time blocks</CardDescription>
            </div>
            <Link
              href="/planner"
              className="text-xs font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Plan Day <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayBlocks.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                No time blocks yet. Use &quot;Plan My Day with AI&quot; in Daily Planner.
              </p>
            ) : (
              todayBlocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => updateTimeBlock(block.id, { completed: !block.completed })}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2.5 hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-mono text-[var(--text-secondary)] tabular-nums w-24 shrink-0">
                    {block.startTime}–{block.endTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium truncate ${
                        block.completed
                          ? "line-through text-[var(--text-muted)]"
                          : "text-[var(--text-primary)]"
                      }`}
                    >
                      {block.title}
                    </p>
                  </div>
                  <Badge
                    tone={
                      block.type === "focus"
                        ? "accent"
                        : block.type === "break"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {block.type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Today's Priorities & Tasks */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today&apos;s Priorities</CardTitle>
              <CardDescription>Click to toggle completion</CardDescription>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              All Tasks
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                No tasks scheduled for today.
              </p>
            ) : (
              todayTasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[var(--surface-subtle)] transition-colors"
                >
                  <button
                    onClick={() => toggleTaskComplete(task.id)}
                    className="mt-0.5 text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                    aria-label="Toggle task complete"
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium leading-snug ${
                        task.status === "done"
                          ? "line-through text-[var(--text-muted)]"
                          : "text-[var(--text-primary)]"
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{task.category}</span>
                      <span>·</span>
                      <span className="tabular-nums">{formatMinutes(task.estimatedMinutes)}</span>
                    </div>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Interactive Habit Tracker */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Habit Tracker</CardTitle>
              <CardDescription>Today&apos;s rhythm</CardDescription>
            </div>
            <Link
              href="/habits"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeHabits.map((habit) => {
              const done = data.habitEntries.some(
                (e) => e.habitId === habit.id && e.date === today && e.completed
              );
              return (
                <button
                  key={habit.id}
                  onClick={() => toggleHabitEntry(habit.id, today)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                    done
                      ? "border-[var(--success)]/30 bg-[var(--success-soft)]"
                      : "border-[var(--border)] bg-[var(--bg)]/50 hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        done ? "text-[var(--success)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {habit.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{habit.category}</p>
                  </div>
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      done
                        ? "border-[var(--success)] bg-[var(--success)] text-white"
                        : "border-[var(--border-strong)]"
                    }`}
                  >
                    {done && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Goal Progress + Weekly Consistency + Upcoming Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Goal Progress</CardTitle>
              <CardDescription>Long-term ambitions in motion</CardDescription>
            </div>
            <Link
              href="/goals"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              All Goals
            </Link>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {activeGoals.slice(0, 4).map((goal) => (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="block group rounded-xl p-2 -mx-2 hover:bg-[var(--surface-subtle)] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] truncate">
                    {goal.title}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                    {goal.progress}%
                  </span>
                </div>
                <ProgressBar value={goal.progress} />
                <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>{goal.category}</span>
                  <span>Target {formatFriendlyDate(goal.targetDate)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Weekly Consistency</CardTitle>
            <CardDescription>Last 7 days of routine & focus cadence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 items-end h-32 pt-2">
              {weeklyConsistency.map((day) => (
                <div key={day.dateStr} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-lg bg-[var(--accent)]/80 transition-all"
                      style={{ height: `${Math.max(10, day.pct)}%` }}
                      title={`${day.dayLabel}: ${day.pct}% habits · ${day.focusMins}m focus`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {day.dayLabel}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>7-Day Focus Total</span>
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                {formatMinutes(
                  weeklyConsistency.reduce((sum, d) => sum + d.focusMins, 0)
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Upcoming Commitments</CardTitle>
            <CardDescription>Next deadlines on your radar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-4">No upcoming deadlines.</p>
            ) : (
              upcomingDeadlines.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 text-xs border-b border-[var(--border)] last:border-0 pb-2 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">{t.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{t.category}</p>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-secondary)] shrink-0">
                    {t.dueDate === today ? "Today" : t.dueDate?.slice(5)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

