"use client";

import React, { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useOS } from "@/context/OSContext";
import { calculateDailyExecutionScore } from "@/lib/utils";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ProgressBar,
} from "@/components/ui/primitives";

const CHART_COLORS = [
  "#635BFF",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

export default function AnalyticsPage() {
  const { data } = useOS();
  const [windowDays, setWindowDays] = useState<7 | 14>(7);

  // Daily execution & focus trend (calculated strictly from actual data)
  const dailyTrend = useMemo(() => {
    return Array.from({ length: windowDays }, (_, i) => {
      const d = subDays(new Date(), windowDays - 1 - i);
      const iso = format(d, "yyyy-MM-dd");
      const label = format(d, "MMM d");
      const score = calculateDailyExecutionScore({
        date: iso,
        tasks: data.tasks,
        habits: data.habits,
        habitEntries: data.habitEntries,
        focusSessions: data.focusSessions,
        goals: data.goals,
        focusTargetMinutes: data.preferences.dailyFocusTargetMinutes,
        weights: data.preferences.scoreWeights,
      });
      const focusHours = Number(
        (
          data.focusSessions
            .filter((s) => s.date === iso)
            .reduce((a, b) => a + b.actualMinutes, 0) / 60
        ).toFixed(2)
      );
      const tasksDone = data.tasks.filter(
        (t) => t.status === "done" && t.completedAt?.startsWith(iso)
      ).length;
      return { date: label, score: score.total, focusHours, tasksDone };
    });
  }, [data, windowDays]);

  // Life Area Time & Focus Allocation
  const areaAllocation = useMemo(() => {
    const map = new Map<string, number>();
    data.focusSessions.forEach((s) => {
      const cat = s.category || "Personal Development";
      map.set(cat, (map.get(cat) || 0) + s.actualMinutes);
    });
    // Include completed task durations if no focus session logged for that area
    data.tasks
      .filter((t) => t.status === "done")
      .forEach((t) => {
        if (!map.has(t.category)) {
          map.set(t.category, (map.get(t.category) || 0) + (t.actualMinutes || t.estimatedMinutes));
        }
      });
    return Array.from(map.entries())
      .map(([name, minutes]) => ({
        name,
        hours: Number((minutes / 60).toFixed(1)),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [data.focusSessions, data.tasks]);

  // Priority Completion Breakdown
  const priorityStats = useMemo(() => {
    const levels = ["urgent", "high", "medium", "low"] as const;
    return levels.map((p) => {
      const all = data.tasks.filter((t) => t.priority === p);
      const done = all.filter((t) => t.status === "done").length;
      return {
        priority: p.charAt(0).toUpperCase() + p.slice(1),
        completed: done,
        open: all.length - done,
      };
    });
  }, [data.tasks]);

  // Habit Consistency (14 days)
  const habitStats = useMemo(() => {
    return data.habits
      .filter((h) => h.status === "active")
      .map((h) => {
        let hits = 0;
        for (let i = 0; i < 14; i++) {
          const iso = format(subDays(new Date(), i), "yyyy-MM-dd");
          if (data.habitEntries.some((e) => e.habitId === h.id && e.date === iso && e.completed)) {
            hits++;
          }
        }
        return {
          name: h.title,
          category: h.category,
          pct: Math.round((hits / 14) * 100),
        };
      });
  }, [data.habits, data.habitEntries]);

  // Summary KPIs
  const totalFocusHours = Number(
    (data.focusSessions.reduce((a, b) => a + b.actualMinutes, 0) / 60).toFixed(1)
  );
  const completedTasks = data.tasks.filter((t) => t.status === "done").length;
  const completionRate =
    data.tasks.length > 0 ? Math.round((completedTasks / data.tasks.length) * 100) : 0;
  const avgHabitConsistency =
    habitStats.length > 0
      ? Math.round(habitStats.reduce((a, b) => a + b.pct, 0) / habitStats.length)
      : 0;
  const avgExecutionScore =
    dailyTrend.length > 0
      ? Math.round(dailyTrend.reduce((a, b) => a + b.score, 0) / dailyTrend.length)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Meaningful Progress
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Analytics & Growth
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Am I making meaningful progress toward the life I intend to build?
          </p>
        </div>

        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {([7, 14] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWindowDays(w)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                windowDays === w
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              Last {w} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Avg Execution Score</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{avgExecutionScore}/100</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Last {windowDays} days</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Deep Focus Logged</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{totalFocusHours}h</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {data.focusSessions.length} sessions total
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">Task Completion Rate</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{completionRate}%</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {completedTasks} of {data.tasks.length} tasks
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-secondary)]">14-Day Habit Rhythm</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{avgHabitConsistency}%</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Across {habitStats.length} active habits
          </p>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Daily Execution Score Trend</CardTitle>
            <CardDescription>Transparent composite of priorities, habits, focus & goals</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635BFF" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Execution Score"
                  stroke="#635BFF"
                  strokeWidth={2}
                  fill="url(#scoreGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Daily Focus Hours</CardTitle>
            <CardDescription>Actual deep work hours logged per day</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="focusHours" name="Focus Hours" fill="#635BFF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Time Allocation Across Life Areas</CardTitle>
            <CardDescription>Hours invested per domain from focus sessions & completed work</CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex flex-col sm:flex-row items-center gap-4">
            {areaAllocation.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] m-auto">
                Log focus sessions or complete tasks to see life-area allocation.
              </p>
            ) : (
              <>
                <div className="w-full sm:w-1/2 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={areaAllocation}
                        dataKey="hours"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={3}
                      >
                        {areaAllocation.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2 text-xs">
                  {areaAllocation.map((a, idx) => (
                    <div key={a.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="truncate">{a.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{a.hours}h</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Priority Execution Breakdown</CardTitle>
            <CardDescription>Completed vs open tasks by priority level</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityStats} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="priority" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="completed" name="Completed" fill="#2E7D5B" radius={[6, 6, 0, 0]} />
                <Bar dataKey="open" name="Open" fill="#D6D6D0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progression & Habit Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Goal Progression</CardTitle>
            <CardDescription>Current completion across active long-term goals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.goals
              .filter((g) => g.status === "active")
              .map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium truncate pr-2">{g.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone="neutral">{g.category}</Badge>
                      <span className="font-semibold tabular-nums">{g.progress}%</span>
                    </div>
                  </div>
                  <ProgressBar value={g.progress} />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Habit Consistency (14 Days)</CardTitle>
            <CardDescription>Sustainability across each active routine</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {habitStats.map((h) => (
              <div key={h.name}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium truncate pr-2">{h.name}</span>
                  <span className="font-semibold tabular-nums">{h.pct}%</span>
                </div>
                <ProgressBar value={h.pct} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

