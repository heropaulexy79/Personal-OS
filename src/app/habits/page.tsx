"use client";

import React, { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Archive,
  Check,
  Edit3,
  Flame,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { todayISO } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  ProgressBar,
  Select,
} from "@/components/ui/primitives";
import type { Habit, HabitFrequency } from "@/types";

export default function HabitsPage() {
  const { data, createHabit, updateHabit, deleteHabit, toggleHabitEntry, showToast } = useOS();

  const today = todayISO();
  const [range, setRange] = useState<"week" | "month">("week");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Spiritual Growth");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [reminderTime, setReminderTime] = useState("07:00");

  const openCreateModal = () => {
    setEditingHabit(null);
    setTitle("");
    setDescription("");
    setCategory(data.vision.lifeAreas[0]?.name || "Spiritual Growth");
    setFrequency("daily");
    setReminderTime("07:00");
    setModalOpen(true);
  };

  const openEditModal = (h: Habit) => {
    setEditingHabit(h);
    setTitle(h.title);
    setDescription(h.description || "");
    setCategory(h.category);
    setFrequency(h.frequency);
    setReminderTime(h.reminderTime || "");
    setModalOpen(true);
  };

  const dates = useMemo(() => {
    const count = range === "week" ? 7 : 28;
    return Array.from({ length: count }, (_, i) => {
      const d = subDays(new Date(), count - 1 - i);
      return {
        iso: format(d, "yyyy-MM-dd"),
        dayLabel: format(d, "EEE"),
        dayNum: format(d, "d"),
      };
    });
  }, [range]);

  const activeHabits = data.habits.filter((h) => h.status === "active");
  const pausedOrArchived = data.habits.filter((h) => h.status !== "active");

  const isCompleted = (habitId: string, date: string) =>
    data.habitEntries.some((e) => e.habitId === habitId && e.date === date && e.completed);

  const getConsistency = (habit: Habit, daysCount = 14) => {
    let hits = 0;
    for (let i = 0; i < daysCount; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      if (isCompleted(habit.id, d)) hits++;
    }
    return Math.round((hits / daysCount) * 100);
  };

  // Detect interrupted habits (active, missed last 2+ days) for "Resume Your Rhythm"
  const interruptedHabits = useMemo(() => {
    return activeHabits.filter((h) => {
      const d0 = format(subDays(new Date(), 0), "yyyy-MM-dd");
      const d1 = format(subDays(new Date(), 1), "yyyy-MM-dd");
      const d2 = format(subDays(new Date(), 2), "yyyy-MM-dd");
      return !isCompleted(h.id, d0) && !isCompleted(h.id, d1) && !isCompleted(h.id, d2);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHabits, data.habitEntries]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const targetMap: Record<HabitFrequency, number> = {
      daily: 7,
      weekdays: 5,
      "5x_week": 5,
      "3x_week": 3,
      weekly: 1,
    };
    if (editingHabit) {
      updateHabit(editingHabit.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        frequency,
        reminderTime: reminderTime || undefined,
        targetPerWeek: targetMap[frequency],
      });
      showToast("Habit updated", "success");
    } else {
      createHabit({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        frequency,
        reminderTime: reminderTime || undefined,
        status: "active",
        targetPerWeek: targetMap[frequency],
      });
    }
    setTitle("");
    setDescription("");
    setEditingHabit(null);
    setModalOpen(false);
  };

  const handleResumeRhythm = (habit: Habit) => {
    toggleHabitEntry(habit.id, today);
    showToast(`Welcome back to "${habit.title}" — rhythm resumed!`, "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Sustainable Consistency
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Habits & Routines
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Build calm, repeatable rhythms without guilt or all-or-nothing pressure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            <button
              onClick={() => setRange("week")}
              className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
                range === "week"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setRange("month")}
              className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
                range === "month"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              28 Days
            </button>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            New Habit
          </Button>
        </div>
      </div>

      {/* Resume Your Rhythm Gentle Restart Section */}
      {interruptedHabits.length > 0 && (
        <Card className="p-5 border-[var(--accent)]/25 bg-[var(--accent-soft)]/35">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Resume Your Rhythm
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                Interruptions are a normal part of life—not failure. Pick a gentle, 5-minute
                version today to reconnect with these routines:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {interruptedHabits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                  >
                    <span className="font-medium">{h.title}</span>
                    <Button size="xs" onClick={() => handleResumeRhythm(h)}>
                      <Check className="h-3 w-3" />
                      Restart Today
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Active Habits Tracker */}
      {activeHabits.length === 0 ? (
        <EmptyState
          icon={<Flame className="h-5 w-5" />}
          title="No active habits yet"
          description="Add grounding daily or weekly routines such as morning prayer, reading, exercise, or synthesis writing."
          action={<Button onClick={() => setModalOpen(true)}>Create First Habit</Button>}
        />
      ) : (
        <div className="space-y-4">
          {activeHabits.map((habit) => {
            const consistency = getConsistency(habit, 14);
            const doneToday = isCompleted(habit.id, today);
            return (
              <Card key={habit.id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold tracking-tight">{habit.title}</h3>
                      <Badge tone="neutral">{habit.category}</Badge>
                      <Badge tone="accent">{habit.frequency.replace("_", " ")}</Badge>
                      {habit.reminderTime && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Reminder {habit.reminderTime}
                        </span>
                      )}
                    </div>
                    {habit.description && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {habit.description}
                      </p>
                    )}

                    <div className="mt-3 max-w-xs">
                      <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                        <span>14-day consistency</span>
                        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                          {consistency}%
                        </span>
                      </div>
                      <ProgressBar value={consistency} />
                    </div>
                  </div>

                  {/* Interactive Calendar Matrix */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid gap-1.5 ${
                        range === "week" ? "grid-cols-7" : "grid-cols-7 sm:grid-cols-14"
                      }`}
                    >
                      {dates.map((d) => {
                        const hit = isCompleted(habit.id, d.iso);
                        const isToday = d.iso === today;
                        return (
                          <button
                            key={d.iso}
                            onClick={() => toggleHabitEntry(habit.id, d.iso)}
                            title={`${d.iso}: ${hit ? "Completed" : "Not marked"}`}
                            className={`flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer ${
                              range === "week" ? "w-10 h-11" : "w-7 h-7"
                            } ${
                              hit
                                ? "border-[var(--success)] bg-[var(--success)] text-white"
                                : isToday
                                ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 text-[var(--accent)]"
                                : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                            }`}
                          >
                            {range === "week" && (
                              <span className="text-[9px] uppercase opacity-80">
                                {d.dayLabel}
                              </span>
                            )}
                            <span className="text-[11px] font-semibold tabular-nums">
                              {hit && range === "month" ? "✓" : d.dayNum}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-1 border-l border-[var(--border)] pl-3">
                      <Button
                        size="xs"
                        variant={doneToday ? "secondary" : "primary"}
                        onClick={() => toggleHabitEntry(habit.id, today)}
                      >
                        {doneToday ? "Done" : "Check"}
                      </Button>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => openEditModal(habit)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer"
                          title="Edit habit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            updateHabit(habit.id, {
                              status: "paused",
                              pausedAt: new Date().toISOString(),
                            })
                          }
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--warning)] cursor-pointer"
                          title="Pause habit"
                        >
                          <Pause className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => updateHabit(habit.id, { status: "archived" })}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          title="Archive habit"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                          title="Delete habit"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Paused / Archived Habits */}
      {pausedOrArchived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paused & Archived Habits</CardTitle>
            <CardDescription>Resume anytime without losing your history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pausedOrArchived.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Archive className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="font-medium">{h.title}</span>
                  <Badge tone="neutral">{h.status}</Badge>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => updateHabit(h.id, { status: "active" })}
                >
                  <Play className="h-3 w-3" />
                  Resume
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Habit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHabit ? "Edit Habit" : "Create New Habit"}
        description="Anchor a sustainable routine to one of your life areas."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Habit Name
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Prayer, Reading 30m, Exercise"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description (Optional)
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keep the minimum version clear and approachable"
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
                Frequency
              </label>
              <Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="5x_week">5x / week</option>
                <option value="3x_week">3x / week</option>
                <option value="weekly">Weekly</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Reminder
              </label>
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Habit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

