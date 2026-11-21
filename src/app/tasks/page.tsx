"use client";

import React, { useMemo, useState } from "react";
import { addDays, eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Columns3,
  Edit3,
  List,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { formatFriendlyDate, formatMinutes, todayISO, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PriorityBadge,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import type { Priority, Recurrence, Task, TaskStatus } from "@/types";

type ViewMode = "list" | "kanban" | "calendar";
type SmartFilter = "all" | "today" | "upcoming" | "overdue" | "completed";

export default function TasksPage() {
  const {
    data,
    createTask,
    updateTask,
    toggleTaskComplete,
    deleteTask,
    bulkUpdateTasks,
    setQuickCaptureOpen,
    showToast,
  } = useOS();

  const today = todayISO();
  const [view, setView] = useState<ViewMode>("list");
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("todo");
  const [formPriority, setFormPriority] = useState<Priority>("medium");
  const [formDueDate, setFormDueDate] = useState(today);
  const [formEstMins, setFormEstMins] = useState(45);
  const [formCategory, setFormCategory] = useState(data.vision.lifeAreas[0]?.name || "Career");
  const [formGoalId, setFormGoalId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formRecurrence, setFormRecurrence] = useState<Recurrence>("none");
  const [formNotes, setFormNotes] = useState("");
  const [formSubtasks, setFormSubtasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const openCreateModal = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDesc("");
    setFormStatus("todo");
    setFormPriority("medium");
    setFormDueDate(today);
    setFormEstMins(45);
    setFormCategory(data.vision.lifeAreas[0]?.name || "Career");
    setFormGoalId("");
    setFormProjectId("");
    setFormRecurrence("none");
    setFormNotes("");
    setFormSubtasks([]);
    setModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || "");
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate || today);
    setFormEstMins(task.estimatedMinutes);
    setFormCategory(task.category);
    setFormGoalId(task.goalId || "");
    setFormProjectId(task.projectId || "");
    setFormRecurrence(task.recurrence);
    setFormNotes(task.notes || "");
    setFormSubtasks(task.subtasks || []);
    setModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      status: formStatus,
      priority: formPriority,
      dueDate: formDueDate || undefined,
      scheduledDate: formDueDate || today,
      estimatedMinutes: Number(formEstMins) || 30,
      goalId: formGoalId || undefined,
      projectId: formProjectId || undefined,
      category: formCategory,
      recurrence: formRecurrence,
      notes: formNotes.trim() || undefined,
      subtasks: formSubtasks,
    };

    if (editingTask) {
      updateTask(editingTask.id, payload);
      showToast("Task updated", "success");
    } else {
      createTask({ ...payload, actualMinutes: 0 });
      showToast("Task created", "success");
    }
    setModalOpen(false);
  };

  const filteredTasks = useMemo(() => {
    return data.tasks.filter((t) => {
      if (smartFilter === "today") {
        if (t.status === "done" || (t.dueDate !== today && t.scheduledDate !== today)) return false;
      } else if (smartFilter === "upcoming") {
        if (t.status === "done" || !t.dueDate || t.dueDate <= today) return false;
      } else if (smartFilter === "overdue") {
        if (t.status === "done" || !t.dueDate || t.dueDate >= today) return false;
      } else if (smartFilter === "completed") {
        if (t.status !== "done") return false;
      }

      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${t.title} ${t.description || ""} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.tasks, smartFilter, today, categoryFilter, priorityFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const monthDays = useMemo(() => {
    const now = new Date();
    return eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
  }, []);

  const KANBAN_COLS: Array<{ id: TaskStatus; label: string }> = [
    { id: "todo", label: "To Do" },
    { id: "in_progress", label: "In Progress" },
    { id: "deferred", label: "Deferred" },
    { id: "done", label: "Completed" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Execution Queue
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Capture, prioritize, and complete work aligned with your goals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setQuickCaptureOpen(true)}>
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            AI Quick Capture
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Smart Filters & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 overflow-x-auto">
          {(
            [
              ["all", "All"],
              ["today", "Today"],
              ["upcoming", "Upcoming"],
              ["overdue", "Overdue"],
              ["completed", "Completed"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSmartFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                smartFilter === key
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {(
            [
              ["list", "List", List],
              ["kanban", "Kanban", Columns3],
              ["calendar", "Calendar", Calendar],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                view === key
                  ? "bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-44 text-xs"
        >
          <option value="all">All Life Areas</option>
          {data.vision.lifeAreas.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-36 text-xs"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <Card className="p-3 bg-[var(--accent-soft)]/50 border-[var(--accent)]/30 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--accent)]">
            {selectedIds.length} task(s) selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              onClick={() => {
                bulkUpdateTasks(selectedIds, { status: "done" });
                setSelectedIds([]);
              }}
            >
              Mark Complete
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
                bulkUpdateTasks(selectedIds, { scheduledDate: tomorrow, dueDate: tomorrow });
                setSelectedIds([]);
              }}
            >
              Move to Tomorrow
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                bulkUpdateTasks(selectedIds, { priority: "high" });
                setSelectedIds([]);
              }}
            >
              Set High Priority
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        </Card>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <>
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="No tasks found"
              description="Adjust your filters or capture a new task to get moving."
              action={<Button onClick={openCreateModal}>Create Task</Button>}
            />
          ) : (
            <Card className="divide-y divide-[var(--border)] overflow-hidden">
              {filteredTasks.map((task) => {
                const goal = data.goals.find((g) => g.id === task.goalId);
                const isOverdue = task.status !== "done" && task.dueDate && task.dueDate < today;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-subtle)]/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      className="accent-[var(--accent)] cursor-pointer"
                    />
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className="cursor-pointer shrink-0"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                      ) : (
                        <Circle className="h-4 w-4 text-[var(--text-muted)] hover:text-[var(--accent)]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          task.status === "done" ? "line-through text-[var(--text-muted)]" : ""
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span>{task.category}</span>
                        {goal && (
                          <>
                            <span>·</span>
                            <span className="text-[var(--accent)]">{goal.title}</span>
                          </>
                        )}
                        {task.subtasks.length > 0 && (
                          <>
                            <span>·</span>
                            <span>
                              {task.subtasks.filter((s) => s.completed).length}/
                              {task.subtasks.length} subtasks
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-xs text-[var(--text-secondary)] tabular-nums w-14 text-right">
                        {formatMinutes(task.estimatedMinutes)}
                      </span>
                      <span
                        className={`text-xs font-mono w-24 text-right ${
                          isOverdue ? "text-[var(--danger)] font-medium" : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {task.dueDate ? formatFriendlyDate(task.dueDate).replace(/, \d{4}/, "") : "—"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      {/* KANBAN VIEW (Drag and Drop) */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedTaskId) {
                    updateTask(draggedTaskId, {
                      status: col.id,
                      completedAt: col.id === "done" ? new Date().toISOString() : undefined,
                    });
                    setDraggedTaskId(null);
                  }
                }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-3 min-h-[320px] flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold">{col.label}</span>
                  <Badge tone="neutral">{colTasks.length}</Badge>
                </div>

                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onClick={() => openEditModal(task)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs cursor-grab active:cursor-grabbing hover:border-[var(--accent)]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {formatMinutes(task.estimatedMinutes)}
                      </span>
                    </div>
                    <p className="text-xs font-medium leading-snug">{task.title}</p>
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                      {task.category} · {task.dueDate || "No date"}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR VIEW */}
      {view === "calendar" && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">{format(new Date(), "MMMM yyyy")}</h3>
            <span className="text-xs text-[var(--text-secondary)]">
              Showing tasks by due date
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-[var(--text-muted)] pb-1">
                {d}
              </div>
            ))}
            {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
              <div key={`pad_${i}`} />
            ))}
            {monthDays.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const dayItems = filteredTasks.filter((t) => t.dueDate === iso);
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={`min-h-[84px] rounded-xl border p-2 text-xs ${
                    isToday
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/25"
                      : "border-[var(--border)] bg-[var(--bg)]/40"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold ${
                      isToday ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayItems.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openEditModal(t)}
                        className="w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer"
                      >
                        {t.title}
                      </button>
                    ))}
                    {dayItems.length > 3 && (
                      <p className="text-[10px] text-[var(--text-muted)]">
                        +{dayItems.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Create / Edit Task Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? "Edit Task" : "Create New Task"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Title
            </label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <Textarea
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Context, acceptance criteria, or notes..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Status
              </label>
              <Select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="deferred">Deferred</option>
                <option value="done">Done</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Priority
              </label>
              <Select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Est. Minutes
              </label>
              <Input
                type="number"
                min={5}
                max={480}
                value={formEstMins}
                onChange={(e) => setFormEstMins(Number(e.target.value) || 30)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Life Area
              </label>
              <Select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                {data.vision.lifeAreas.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Related Goal
              </label>
              <Select value={formGoalId} onChange={(e) => setFormGoalId(e.target.value)}>
                <option value="">None</option>
                {data.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Recurrence
              </label>
              <Select
                value={formRecurrence}
                onChange={(e) => setFormRecurrence(e.target.value as Recurrence)}
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Subtasks
            </label>
            <div className="space-y-1.5 mb-2">
              {formSubtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() =>
                      setFormSubtasks((prev) =>
                        prev.map((x) =>
                          x.id === st.id ? { ...x, completed: !x.completed } : x
                        )
                      )
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span className={st.completed ? "line-through text-[var(--text-muted)] flex-1" : "flex-1"}>
                    {st.title}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormSubtasks((prev) => prev.filter((x) => x.id !== st.id))
                    }
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add a subtask..."
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!newSubtask.trim()) return;
                  setFormSubtasks((prev) => [
                    ...prev,
                    { id: uid("st"), title: newSubtask.trim(), completed: false },
                  ]);
                  setNewSubtask("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingTask ? "Save Changes" : "Create Task"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

