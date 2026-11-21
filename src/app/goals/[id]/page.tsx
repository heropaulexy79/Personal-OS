"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  FolderKanban,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { formatFriendlyDate, formatMinutes, todayISO } from "@/lib/utils";
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
  ProgressBar,
  Select,
} from "@/components/ui/primitives";
import type { GoalStatus, Priority } from "@/types";

interface AIBreakdownMilestone {
  title: string;
  targetDate: string;
  selected: boolean;
  tasks: Array<{
    title: string;
    estimatedMinutes: number;
    priority: Priority;
    selected: boolean;
  }>;
}

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    data,
    updateGoal,
    deleteGoal,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createProject,
    createTask,
    toggleTaskComplete,
    showToast,
  } = useOS();

  const goal = data.goals.find((g) => g.id === params.id);

  const milestones = useMemo(
    () =>
      data.milestones
        .filter((m) => m.goalId === params.id)
        .sort((a, b) => a.order - b.order),
    [data.milestones, params.id]
  );

  const projects = useMemo(
    () => data.projects.filter((p) => p.goalId === params.id),
    [data.projects, params.id]
  );

  const tasks = useMemo(
    () => data.tasks.filter((t) => t.goalId === params.id),
    [data.tasks, params.id]
  );

  const [newMsTitle, setNewMsTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");

  // AI Breakdown state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"groq" | "mock">("mock");
  const [aiRationale, setAiRationale] = useState("");
  const [aiProposal, setAiProposal] = useState<AIBreakdownMilestone[]>([]);

  if (!goal) {
    return (
      <div className="space-y-4">
        <Link href="/goals" className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Goals
        </Link>
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Goal not found.</p>
        </Card>
      </div>
    );
  }

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsTitle.trim()) return;
    createMilestone({
      goalId: goal.id,
      title: newMsTitle.trim(),
      completed: false,
      order: milestones.length + 1,
    });
    setNewMsTitle("");
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTask({
      title: newTaskTitle.trim(),
      status: "todo",
      priority: goal.priority,
      dueDate: todayISO(),
      scheduledDate: todayISO(),
      estimatedMinutes: 45,
      actualMinutes: 0,
      goalId: goal.id,
      category: goal.category,
      recurrence: "none",
      subtasks: [],
    });
    setNewTaskTitle("");
    showToast("Task linked to goal", "success");
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    createProject({
      title: newProjectTitle.trim(),
      goalId: goal.id,
      category: goal.category,
      status: "active",
    });
    setNewProjectTitle("");
    showToast("Project added", "success");
  };

  const handleRunAIBreakdown = async () => {
    setAiLoading(true);
    setAiModalOpen(true);
    try {
      const res = await fetch("/api/ai/goal-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            category: goal.category,
            targetDate: goal.targetDate,
            priority: goal.priority,
          },
          visionStatement: data.vision.northStar,
          model: data.preferences.groqModel,
        }),
      });
      const json = await res.json();
      setAiMode(json.mode || "mock");
      setAiRationale(json.rationale || "");
      const mapped: AIBreakdownMilestone[] = (json.milestones || []).map(
        (m: {
          title: string;
          targetDate: string;
          tasks?: Array<{ title: string; estimatedMinutes?: number; priority?: Priority }>;
        }) => ({
          title: m.title,
          targetDate: m.targetDate || goal.targetDate,
          selected: true,
          tasks: (m.tasks || []).map((t) => ({
            title: t.title,
            estimatedMinutes: t.estimatedMinutes || 45,
            priority: t.priority || "medium",
            selected: true,
          })),
        })
      );
      setAiProposal(mapped);
    } catch {
      showToast("Failed to generate AI breakdown", "error");
      setAiModalOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApproveBreakdown = () => {
    let msCount = 0;
    let taskCount = 0;
    aiProposal.forEach((m, idx) => {
      if (m.selected) {
        createMilestone({
          goalId: goal.id,
          title: m.title,
          targetDate: m.targetDate,
          completed: false,
          order: milestones.length + idx + 1,
        });
        msCount++;
      }
      m.tasks.forEach((t) => {
        if (t.selected) {
          createTask({
            title: t.title,
            status: "todo",
            priority: t.priority,
            dueDate: m.targetDate,
            scheduledDate: todayISO(),
            estimatedMinutes: t.estimatedMinutes,
            actualMinutes: 0,
            goalId: goal.id,
            category: goal.category,
            recurrence: "none",
            subtasks: [],
          });
          taskCount++;
        }
      });
    });
    setAiModalOpen(false);
    showToast(`Saved ${msCount} milestones & ${taskCount} tasks`, "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/goals"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Goals
        </Link>

        <div className="flex items-center gap-2">
          <Button onClick={() => void handleRunAIBreakdown()} disabled={aiLoading}>
            <Sparkles className="h-4 w-4" />
            Break Down Goal with AI
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              deleteGoal(goal.id);
              router.push("/goals");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Goal Hero */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge tone="neutral">{goal.category}</Badge>
          <PriorityBadge priority={goal.priority} />
          <Select
            value={goal.status}
            onChange={(e) => updateGoal(goal.id, { status: e.target.value as GoalStatus })}
            className="w-32 h-7 text-xs"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </Select>
          <span className="text-xs text-[var(--text-secondary)] ml-auto">
            Target: {formatFriendlyDate(goal.targetDate)}
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
          {goal.description}
        </p>
        {goal.whyItMatters && (
          <p className="mt-2 text-xs text-[var(--accent)] font-medium">
            Why it matters: {goal.whyItMatters}
          </p>
        )}

        <div className="mt-6 pt-5 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-[var(--text-secondary)]">
              Goal Progress
            </span>
            <span className="font-semibold tabular-nums text-base">{goal.progress}%</span>
          </div>
          <ProgressBar value={goal.progress} className="h-2.5" />
          <input
            type="range"
            min={0}
            max={100}
            value={goal.progress}
            onChange={(e) => updateGoal(goal.id, { progress: Number(e.target.value) })}
            className="w-full mt-2 accent-[var(--accent)] cursor-pointer"
          />
        </div>
      </Card>

      {/* Milestones & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Milestones */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>
              {milestones.filter((m) => m.completed).length} of {milestones.length} completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {milestones.map((ms) => (
              <div
                key={ms.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-3.5 py-2.5"
              >
                <button
                  onClick={() => updateMilestone(ms.id, { completed: !ms.completed })}
                  className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer"
                >
                  {ms.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium ${
                        ms.completed ? "line-through text-[var(--text-muted)]" : ""
                      }`}
                    >
                      {ms.title}
                    </p>
                    {ms.targetDate && (
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Target {formatFriendlyDate(ms.targetDate)}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => deleteMilestone(ms.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <form onSubmit={handleAddMilestone} className="flex gap-2 pt-2">
              <Input
                value={newMsTitle}
                onChange={(e) => setNewMsTitle(e.target.value)}
                placeholder="Add a milestone..."
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Associated Tasks & Projects */}
        <div className="lg:col-span-6 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Associated Tasks</CardTitle>
              <CardDescription>
                {tasks.filter((t) => t.status === "done").length} of {tasks.length} completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 hover:bg-[var(--surface-subtle)]"
                >
                  <button
                    onClick={() => toggleTaskComplete(task.id)}
                    className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer"
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                    )}
                    <span
                      className={`text-xs font-medium truncate ${
                        task.status === "done" ? "line-through text-[var(--text-muted)]" : ""
                      }`}
                    >
                      {task.title}
                    </span>
                  </button>
                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {formatMinutes(task.estimatedMinutes)}
                  </span>
                </div>
              ))}

              <form onSubmit={handleAddTask} className="flex gap-2 pt-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add an actionable task for this goal..."
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="secondary">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-[var(--accent)]" />
                Associated Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-3 py-2 text-xs font-medium"
                >
                  {p.title}
                </div>
              ))}
              <form onSubmit={handleAddProject} className="flex gap-2 pt-1">
                <Input
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Link a project..."
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Goal Breakdown Review Modal */}
      <Modal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI Goal Breakdown — Review & Approve"
        description="Uncheck any milestones or tasks you do not want to save."
        maxWidth="max-w-2xl"
      >
        {aiLoading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-xs text-[var(--text-secondary)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
            <span>Designing realistic milestones and actionable tasks...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--accent-soft)]/50 px-4 py-3 text-xs">
              <p className="text-[var(--text-primary)]">{aiRationale}</p>
              <Badge tone={aiMode === "groq" ? "accent" : "neutral"}>
                {aiMode === "groq" ? "Groq AI" : "Mock AI"}
              </Badge>
            </div>

            <div className="space-y-3">
              {aiProposal.map((m, mi) => (
                <div
                  key={mi}
                  className="rounded-xl border border-[var(--border)] p-4 space-y-2.5"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={m.selected}
                      onChange={() =>
                        setAiProposal((prev) =>
                          prev.map((item, i) =>
                            i === mi ? { ...item, selected: !item.selected } : item
                          )
                        )
                      }
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-sm font-semibold">{m.title}</span>
                    <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                      {m.targetDate}
                    </span>
                  </label>

                  <div className="pl-6 space-y-1.5">
                    {m.tasks.map((t, ti) => (
                      <label
                        key={ti}
                        className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={t.selected}
                          onChange={() =>
                            setAiProposal((prev) =>
                              prev.map((item, i) =>
                                i === mi
                                  ? {
                                      ...item,
                                      tasks: item.tasks.map((tk, j) =>
                                        j === ti ? { ...tk, selected: !tk.selected } : tk
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="accent-[var(--accent)]"
                        />
                        <span className="flex-1 text-[var(--text-primary)]">{t.title}</span>
                        <span className="tabular-nums text-[var(--text-muted)]">
                          {t.estimatedMinutes}m
                        </span>
                        <PriorityBadge priority={t.priority} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button variant="ghost" onClick={() => setAiModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApproveBreakdown}>
                <Check className="h-4 w-4" />
                Approve & Save Selected
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

