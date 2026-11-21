"use client";

import React, { useMemo, useState } from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  LayoutList,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { formatMinutes, minutesToTime, timeToMinutes, todayISO } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  PriorityBadge,
  Select,
} from "@/components/ui/primitives";
import type { Priority, TimeBlock } from "@/types";

interface ProposedBlock {
  title: string;
  taskId?: string | null;
  startTime: string;
  endTime: string;
  type: TimeBlock["type"];
  rationale?: string;
  isFixed?: boolean;
}

interface DeferredItem {
  taskId: string;
  title: string;
  reason: string;
}

export default function DailyPlannerPage() {
  const {
    data,
    createTask,
    toggleTaskComplete,
    updateTask,
    upsertDailyPlan,
    createTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
    replaceDayTimeBlocks,
    showToast,
  } = useOS();

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");

  // Quick-add task for selected date
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskPriority, setQuickTaskPriority] = useState<Priority>("medium");
  const [quickTaskMins, setQuickTaskMins] = useState(45);

  // Manual block modal
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTitle, setBlockTitle] = useState("");
  const [blockStart, setBlockStart] = useState("09:00");
  const [blockEnd, setBlockEnd] = useState("10:00");
  const [blockType, setBlockType] = useState<TimeBlock["type"]>("focus");
  const [blockTaskId, setBlockTaskId] = useState("");
  const [blockFixed, setBlockFixed] = useState(false);

  // AI Plan My Day state
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"groq" | "mock">("mock");
  const [aiSummary, setAiSummary] = useState("");
  const [proposedBlocks, setProposedBlocks] = useState<ProposedBlock[]>([]);
  const [deferredTasks, setDeferredTasks] = useState<DeferredItem[]>([]);

  const dayPlan = data.dailyPlans.find((p) => p.date === selectedDate);
  const dayBlocks = useMemo(
    () =>
      data.timeBlocks
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [data.timeBlocks, selectedDate]
  );

  const dayTasks = useMemo(
    () =>
      data.tasks.filter(
        (t) =>
          t.scheduledDate === selectedDate ||
          t.dueDate === selectedDate ||
          (selectedDate === todayISO() && t.status !== "done" && t.dueDate && t.dueDate < selectedDate)
      ),
    [data.tasks, selectedDate]
  );

  const incompleteDayTasks = dayTasks.filter((t) => t.status !== "done");
  const totalScheduledMins = dayBlocks
    .filter((b) => b.type === "focus" || b.type === "admin")
    .reduce((acc, b) => acc + Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime)), 0);

  const shiftDate = (days: number) => {
    const d = parseISO(selectedDate);
    setSelectedDate(format(days > 0 ? addDays(d, days) : subDays(d, Math.abs(days)), "yyyy-MM-dd"));
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) return;
    createTimeBlock({
      date: selectedDate,
      title: blockTitle.trim(),
      startTime: blockStart,
      endTime: blockEnd,
      type: blockType,
      taskId: blockTaskId || undefined,
      completed: false,
      isFixed: blockFixed,
    });
    setBlockTitle("");
    setBlockTaskId("");
    setBlockFixed(false);
    setBlockModalOpen(false);
    showToast("Time block added", "success");
  };

  const handleRescheduleIncomplete = () => {
    if (incompleteDayTasks.length === 0) return;
    const nextDay = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    incompleteDayTasks.forEach((t) => {
      updateTask(t.id, { scheduledDate: nextDay });
    });
    showToast(`Moved ${incompleteDayTasks.length} incomplete task(s) to ${nextDay}`, "success");
  };

  const handlePlanWithAI = async () => {
    setAiPlanning(true);
    setAiModalOpen(true);
    try {
      const fixedBlocks = dayBlocks
        .filter((b) => b.isFixed || b.type === "meeting")
        .map((b) => ({
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          type: b.type,
        }));

      const candidateTasks = (incompleteDayTasks.length > 0
        ? incompleteDayTasks
        : data.tasks.filter((t) => t.status !== "done").slice(0, 8)
      ).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimatedMinutes: t.estimatedMinutes,
        dueDate: t.dueDate,
        category: t.category,
        goalTitle: data.goals.find((g) => g.id === t.goalId)?.title,
      }));

      const res = await fetch("/api/ai/plan-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          workStartHour: data.preferences.workStartHour,
          workEndHour: data.preferences.workEndHour,
          maxDailyWorkloadHours: data.preferences.maxDailyWorkloadHours,
          preferredFocusMinutes: data.preferences.preferredFocusMinutes,
          preferredBreakMinutes: data.preferences.preferredBreakMinutes,
          fixedBlocks,
          tasks: candidateTasks,
          habits: data.habits
            .filter((h) => h.status === "active")
            .map((h) => ({ title: h.title, reminderTime: h.reminderTime })),
          model: data.preferences.groqModel,
        }),
      });

      const json = await res.json();
      setAiMode(json.mode || "mock");
      setAiSummary(json.summary || "");
      setProposedBlocks(json.blocks || []);
      setDeferredTasks(json.deferredTasks || []);
    } catch {
      showToast("Failed to generate AI daily plan", "error");
      setAiModalOpen(false);
    } finally {
      setAiPlanning(false);
    }
  };

  const handleApproveAIPlan = () => {
    replaceDayTimeBlocks(
      selectedDate,
      proposedBlocks.map((b) => ({
        date: selectedDate,
        title: b.title,
        taskId: b.taskId || undefined,
        startTime: b.startTime,
        endTime: b.endTime,
        type: b.type,
        completed: false,
        rationale: b.rationale,
        isFixed: b.isFixed,
      }))
    );

    // Move deferred tasks to next day
    const nextDay = format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    deferredTasks.forEach((d) => {
      if (d.taskId) {
        updateTask(d.taskId, { scheduledDate: nextDay });
      }
    });

    upsertDailyPlan(selectedDate, { aiSummary });
    setAiModalOpen(false);
  };

  const blockTypeStyles: Record<TimeBlock["type"], string> = {
    focus: "border-l-[var(--accent)] bg-[var(--accent-soft)]/35",
    routine: "border-l-[var(--success)] bg-[var(--success-soft)]/35",
    meeting: "border-l-[var(--warning)] bg-[var(--warning-soft)]/35",
    break: "border-l-[var(--border-strong)] bg-[var(--surface-subtle)]",
    admin: "border-l-[var(--text-muted)] bg-[var(--surface-subtle)]/70",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Intentional Time Architecture
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Daily Planner
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Design a realistic, non-overlapping day anchored in your top priorities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void handlePlanWithAI()} disabled={aiPlanning}>
            <Sparkles className="h-4 w-4" />
            Plan My Day with AI
          </Button>
          <Button variant="outline" onClick={() => setBlockModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Time Block
          </Button>
        </div>
      </div>

      {/* Date Bar & View Switcher */}
      <Card className="p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40 h-8 text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(todayISO())}
          >
            Today
          </Button>
          <span className="hidden sm:inline text-xs font-medium text-[var(--text-secondary)] ml-2">
            {format(parseISO(selectedDate), "EEEE, MMM d")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">
            Planned Focus:{" "}
            <strong className="text-[var(--text-primary)]">
              {formatMinutes(totalScheduledMins)}
            </strong>{" "}
            / {data.preferences.maxDailyWorkloadHours}h cap
          </span>

          <div className="flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg)]">
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Schedule
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                viewMode === "list"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>
      </Card>

      {/* Main Split: Time Blocks + Day's Task Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Schedule / Time Blocks */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {viewMode === "timeline" ? "Time-Blocked Schedule" : "Schedule List"}
              </CardTitle>
              <CardDescription>
                Working hours: {data.preferences.workStartHour} – {data.preferences.workEndHour}
              </CardDescription>
            </div>
            <Badge tone="neutral">{dayBlocks.length} blocks</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {/* Daily Intention */}
            <div className="mb-4">
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Daily Intention
              </label>
              <Input
                value={dayPlan?.intention || ""}
                onChange={(e) =>
                  upsertDailyPlan(selectedDate, { intention: e.target.value })
                }
                placeholder="What would make today feel deeply meaningful?"
                className="text-xs"
              />
            </div>

            {dayBlocks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-center">
                <Clock className="h-6 w-6 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm font-medium">No time blocks scheduled for this day</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Click &ldquo;Plan My Day with AI&rdquo; to generate a balanced, non-overlapping schedule.
                </p>
              </div>
            ) : viewMode === "timeline" ? (
              /* Visual Hourly Calendar Timeline (06:00 - 21:00) */
              <div className="relative rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 overflow-hidden">
                {Array.from({ length: 16 }, (_, idx) => {
                  const hour = 6 + idx;
                  const hourLabel = `${String(hour).padStart(2, "0")}:00`;
                  const slotBlocks = dayBlocks.filter((b) => {
                    const startHour = Math.floor(timeToMinutes(b.startTime) / 60);
                    return startHour === hour || (idx === 0 && startHour < 6) || (idx === 15 && startHour > 21);
                  });
                  return (
                    <div
                      key={hour}
                      className="flex border-b border-[var(--border)]/70 last:border-b-0 min-h-[54px]"
                    >
                      <div className="w-14 shrink-0 px-2 py-2 text-[11px] font-mono text-[var(--text-muted)] border-r border-[var(--border)]/70 text-right tabular-nums">
                        {hourLabel}
                      </div>
                      <div className="flex-1 p-1.5 space-y-1.5">
                        {slotBlocks.map((block) => (
                          <div
                            key={block.id}
                            className={`rounded-lg border border-[var(--border)] border-l-4 px-3 py-2 transition-all ${blockTypeStyles[block.type]}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                onClick={() =>
                                  updateTimeBlock(block.id, { completed: !block.completed })
                                }
                                className="flex items-start gap-2 text-left flex-1 cursor-pointer"
                              >
                                {block.completed ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)] mt-0.5 shrink-0" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
                                      {block.startTime}–{block.endTime}
                                    </span>
                                    <Badge tone="neutral">{block.type}</Badge>
                                    {block.isFixed && <Badge tone="warning">Fixed</Badge>}
                                  </div>
                                  <p
                                    className={`text-xs font-medium mt-0.5 ${
                                      block.completed
                                        ? "line-through text-[var(--text-muted)]"
                                        : ""
                                    }`}
                                  >
                                    {block.title}
                                  </p>
                                  {block.rationale && (
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                      {block.rationale}
                                    </p>
                                  )}
                                </div>
                              </button>
                              <button
                                onClick={() => deleteTimeBlock(block.id)}
                                className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer shrink-0"
                                title="Delete time block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Compact List Mode */
              <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] overflow-hidden">
                {dayBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[var(--surface)] hover:bg-[var(--surface-subtle)]/50"
                  >
                    <button
                      onClick={() => updateTimeBlock(block.id, { completed: !block.completed })}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      {block.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                      )}
                      <span className="text-xs font-mono text-[var(--text-secondary)] tabular-nums w-24 shrink-0">
                        {block.startTime}–{block.endTime}
                      </span>
                      <span
                        className={`text-xs font-medium truncate ${
                          block.completed ? "line-through text-[var(--text-muted)]" : ""
                        }`}
                      >
                        {block.title}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone="neutral">{block.type}</Badge>
                      <button
                        onClick={() => deleteTimeBlock(block.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Tasks for Selected Date */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Tasks for {format(parseISO(selectedDate), "MMM d")}</CardTitle>
              <CardDescription>
                {incompleteDayTasks.length} remaining ·{" "}
                {formatMinutes(
                  incompleteDayTasks.reduce((s, t) => s + t.estimatedMinutes, 0)
                )}{" "}
                estimated
              </CardDescription>
            </div>
            {incompleteDayTasks.length > 0 && (
              <Button
                variant="outline"
                size="xs"
                onClick={handleRescheduleIncomplete}
                title="Move all incomplete tasks to tomorrow"
              >
                Move to Tomorrow
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Inline Quick-Add Task for Selected Date */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickTaskTitle.trim()) return;
                createTask({
                  title: quickTaskTitle.trim(),
                  status: "todo",
                  priority: quickTaskPriority,
                  dueDate: selectedDate,
                  scheduledDate: selectedDate,
                  estimatedMinutes: Number(quickTaskMins) || 45,
                  actualMinutes: 0,
                  category: data.vision.lifeAreas[0]?.name || "Personal Development",
                  recurrence: "none",
                  subtasks: [],
                });
                setQuickTaskTitle("");
                showToast("Task added to this day", "success");
              }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 p-2.5 space-y-2"
            >
              <Input
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder={`Add a task for ${format(parseISO(selectedDate), "MMM d")}...`}
                className="h-8 text-xs"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={quickTaskPriority}
                  onChange={(e) => setQuickTaskPriority(e.target.value as Priority)}
                  className="h-7 text-xs flex-1"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Input
                  type="number"
                  min={10}
                  max={240}
                  value={quickTaskMins}
                  onChange={(e) => setQuickTaskMins(Number(e.target.value) || 30)}
                  className="h-7 w-20 text-xs"
                  title="Estimated minutes"
                />
                <Button type="submit" size="xs">
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>
            </form>

            {dayTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                No tasks scheduled for this date.
              </p>
            ) : (
              dayTasks.map((task) => {
                const isFocus = dayPlan?.focusTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-3 flex items-start gap-2.5"
                  >
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className="mt-0.5 cursor-pointer"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                      ) : (
                        <Circle className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium ${
                          task.status === "done" ? "line-through text-[var(--text-muted)]" : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={task.priority} />
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {formatMinutes(task.estimatedMinutes)}
                        </span>
                        {isFocus ? (
                          <Badge tone="accent">Top Focus</Badge>
                        ) : (
                          task.status !== "done" && (
                            <button
                              onClick={() =>
                                upsertDailyPlan(selectedDate, { focusTaskId: task.id })
                              }
                              className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
                            >
                              Set Focus
                            </button>
                          )
                        )}
                        {task.status !== "done" && (
                          <button
                            onClick={() => {
                              const startMin = timeToMinutes(data.preferences.workStartHour || "09:00");
                              const endMin = startMin + Math.max(15, task.estimatedMinutes || 45);
                              setBlockTaskId(task.id);
                              setBlockTitle(task.title);
                              setBlockStart(minutesToTime(startMin));
                              setBlockEnd(minutesToTime(endMin));
                              setBlockType("focus");
                              setBlockModalOpen(true);
                            }}
                            className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer ml-auto"
                          >
                            + Time Block
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Time Block Modal */}
      <Modal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title="Add Time Block"
        description={`Schedule a block on ${selectedDate}`}
      >
        <form onSubmit={handleAddBlock} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Link Existing Task (Optional)
            </label>
            <Select
              value={blockTaskId}
              onChange={(e) => {
                setBlockTaskId(e.target.value);
                const t = data.tasks.find((tk) => tk.id === e.target.value);
                if (t) setBlockTitle(t.title);
              }}
            >
              <option value="">Custom block</option>
              {data.tasks
                .filter((t) => t.status !== "done")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.estimatedMinutes}m)
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Block Title
            </label>
            <Input
              value={blockTitle}
              onChange={(e) => setBlockTitle(e.target.value)}
              placeholder="e.g. Deep Work: Architecture Spec"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Start
              </label>
              <Input
                type="time"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                End
              </label>
              <Input
                type="time"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Type
              </label>
              <Select
                value={blockType}
                onChange={(e) => setBlockType(e.target.value as TimeBlock["type"])}
              >
                <option value="focus">Focus</option>
                <option value="routine">Routine</option>
                <option value="meeting">Meeting</option>
                <option value="break">Break</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={blockFixed}
              onChange={(e) => setBlockFixed(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Fixed commitment (AI planner will preserve this exact time)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setBlockModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Block</Button>
          </div>
        </form>
      </Modal>

      {/* AI Proposed Schedule Review & Approval Modal */}
      <Modal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="Proposed Daily Schedule — Review & Approve"
        description="Edit times or remove blocks before applying. Your schedule is never modified silently."
        maxWidth="max-w-2xl"
      >
        {aiPlanning ? (
          <div className="py-12 flex flex-col items-center gap-3 text-xs text-[var(--text-secondary)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
            <span>Balancing priorities, working hours, fixed meetings, and breaks...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--accent-soft)]/50 p-3.5 text-xs">
              <p className="leading-relaxed text-[var(--text-primary)]">{aiSummary}</p>
              <Badge tone={aiMode === "groq" ? "accent" : "neutral"}>
                {aiMode === "groq" ? "Groq AI" : "Mock AI"}
              </Badge>
            </div>

            <div className="space-y-2">
              {proposedBlocks.map((b, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5"
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="time"
                      value={b.startTime}
                      onChange={(e) =>
                        setProposedBlocks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, startTime: e.target.value } : item
                          )
                        )
                      }
                      className="w-28 h-8 text-xs font-mono"
                    />
                    <span className="text-xs text-[var(--text-muted)]">–</span>
                    <Input
                      type="time"
                      value={b.endTime}
                      onChange={(e) =>
                        setProposedBlocks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, endTime: e.target.value } : item
                          )
                        )
                      }
                      className="w-28 h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{b.title}</p>
                    {b.rationale && (
                      <p className="text-[11px] text-[var(--text-secondary)]">{b.rationale}</p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setProposedBlocks((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] self-end sm:self-center cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {deferredTasks.length > 0 && (
              <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)]/50 p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-[var(--warning)]">
                  Recommended to Defer to Tomorrow ({deferredTasks.length})
                </p>
                {deferredTasks.map((d, i) => (
                  <p key={i} className="text-xs text-[var(--text-primary)]">
                    • <strong>{d.title}</strong> —{" "}
                    <span className="text-[var(--text-secondary)]">{d.reason}</span>
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button variant="ghost" onClick={() => setAiModalOpen(false)}>
                Discard
              </Button>
              <Button onClick={handleApproveAIPlan}>
                <Check className="h-4 w-4" />
                Approve & Apply Schedule
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

