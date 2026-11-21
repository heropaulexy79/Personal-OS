"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { Archive, ArrowRight, Plus, Target, Trash2 } from "lucide-react";
import { useOS } from "@/context/OSContext";
import { formatFriendlyDate } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PriorityBadge,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import type { GoalStatus, Priority } from "@/types";

export default function GoalsPage() {
  const { data, createGoal, updateGoal, deleteGoal } = useOS();

  const [statusFilter, setStatusFilter] = useState<GoalStatus | "all">("active");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [category, setCategory] = useState(data.vision.lifeAreas[0]?.name || "Career");
  const [priority, setPriority] = useState<Priority>("high");
  const [targetDate, setTargetDate] = useState(
    format(addDays(new Date(), 45), "yyyy-MM-dd")
  );

  const filtered = useMemo(() => {
    return data.goals.filter((g) => {
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (areaFilter !== "all" && g.category !== areaFilter) return false;
      return true;
    });
  }, [data.goals, statusFilter, areaFilter]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createGoal({
      title: title.trim(),
      description: description.trim(),
      whyItMatters: whyItMatters.trim() || undefined,
      category,
      priority,
      targetDate,
      status: "active",
      progress: 0,
    });
    setTitle("");
    setDescription("");
    setWhyItMatters("");
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Strategic Outcomes
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Goals</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Turn long-term vision into structured milestones and measurable progress.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {(["active", "completed", "paused", "archived", "all"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <Select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="w-48 h-9 text-xs"
        >
          <option value="all">All Life Areas</option>
          {data.vision.lifeAreas.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Goals Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Target className="h-5 w-5" />}
          title="No goals match this filter"
          description="Create a goal aligned with your Life Vision, then use AI Goal Breakdown to map milestones and tasks."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Your First Goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((goal) => {
            const ms = data.milestones.filter((m) => m.goalId === goal.id);
            const msDone = ms.filter((m) => m.completed).length;
            const linkedTasks = data.tasks.filter((t) => t.goalId === goal.id);
            return (
              <Card key={goal.id} className="p-5 flex flex-col justify-between hover:border-[var(--border-strong)] transition-all">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{goal.category}</Badge>
                      <PriorityBadge priority={goal.priority} />
                      {goal.status !== "active" && (
                        <Badge tone={goal.status === "completed" ? "success" : "warning"}>
                          {goal.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateGoal(goal.id, {
                            status: goal.status === "archived" ? "active" : "archived",
                          })
                        }
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                        title={goal.status === "archived" ? "Restore goal" : "Archive goal"}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
                        title="Delete goal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <Link href={`/goals/${goal.id}`} className="block mt-3 group">
                    <h3 className="text-base font-semibold tracking-tight group-hover:text-[var(--accent)] transition-colors">
                      {goal.title}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {goal.description}
                    </p>
                  </Link>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[var(--text-secondary)]">Progress</span>
                      <span className="font-semibold tabular-nums">{goal.progress}%</span>
                    </div>
                    <ProgressBar value={goal.progress} />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-3">
                    <span>
                      {msDone}/{ms.length} milestones
                    </span>
                    <span>·</span>
                    <span>{linkedTasks.length} tasks</span>
                    <span>·</span>
                    <span>Due {formatFriendlyDate(goal.targetDate)}</span>
                  </div>
                  <Link
                    href={`/goals/${goal.id}`}
                    className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Goal Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Goal"
        description="Connect a clear, measurable outcome to one of your life areas."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Goal Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Launch Devorah Foundation Website"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does completion look like?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Why This Matters (Optional)
            </label>
            <Input
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              placeholder="How does this express your long-term vision?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Life Area
              </label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {data.vision.lifeAreas.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Priority
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Target Date
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Goal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

