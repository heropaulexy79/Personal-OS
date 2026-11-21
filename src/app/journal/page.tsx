"use client";

import React, { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  BookOpen,
  CalendarRange,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { formatFriendlyDate, todayISO } from "@/lib/utils";
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
  Select,
  Textarea,
} from "@/components/ui/primitives";
import type { DailyReflectionPrompts, JournalType } from "@/types";

const EMPTY_PROMPTS: DailyReflectionPrompts = {
  accomplished: "",
  matteredMost: "",
  avoided: "",
  consumedAttention: "",
  learned: "",
  doDifferentlyTomorrow: "",
};

export default function JournalPage() {
  const {
    data,
    createJournalEntry,
    deleteJournalEntry,
    saveWeeklyReview,
    showToast,
  } = useOS();

  const [tab, setTab] = useState<"daily" | "weekly" | "archive">("daily");

  // Daily reflection state
  const [refTitle, setRefTitle] = useState(`Daily Reflection — ${format(new Date(), "MMM d")}`);
  const [refMood, setRefMood] = useState<"grounded" | "energized" | "stretched" | "reflective" | "tired">("grounded");
  const [prompts, setPrompts] = useState<DailyReflectionPrompts>(EMPTY_PROMPTS);
  const [freeNotes, setFreeNotes] = useState("");

  // Freeform entry state
  const [entryType, setEntryType] = useState<JournalType>("freeform");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [archiveFilter, setArchiveFilter] = useState<JournalType | "all">("all");

  // Weekly Review state
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewMode, setReviewMode] = useState<"groq" | "mock" | null>(null);
  const [draftSummary, setDraftSummary] = useState("");
  const [draftAccomplishments, setDraftAccomplishments] = useState("");
  const [draftAttention, setDraftAttention] = useState("");
  const [draftAdjustments, setDraftAdjustments] = useState("");

  const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const weekEnd = todayISO();

  const weekMetrics = useMemo(() => {
    const last7 = new Set(
      Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"))
    );
    const completed = data.tasks.filter(
      (t) => t.status === "done" && (!t.completedAt || last7.has(t.completedAt.slice(0, 10)))
    );
    const deferred = data.tasks.filter(
      (t) => t.status === "deferred" || (t.status !== "done" && t.dueDate && t.dueDate < todayISO())
    );
    const focusMins = data.focusSessions
      .filter((s) => last7.has(s.date))
      .reduce((a, b) => a + b.actualMinutes, 0);
    const activeHabits = data.habits.filter((h) => h.status === "active");
    let hits = 0;
    let totalTarget = 0;
    const struggling: string[] = [];
    activeHabits.forEach((h) => {
      const hHits = data.habitEntries.filter(
        (e) => e.habitId === h.id && e.completed && last7.has(e.date)
      ).length;
      hits += hHits;
      totalTarget += h.targetPerWeek;
      if (hHits / Math.max(h.targetPerWeek, 1) < 0.5) struggling.push(h.title);
    });
    const habitPct = totalTarget > 0 ? Math.min(100, Math.round((hits / totalTarget) * 100)) : 0;

    return {
      completed,
      deferred,
      focusHours: Number((focusMins / 60).toFixed(1)),
      habitPct,
      struggling,
    };
  }, [data]);

  const handleSaveDailyReflection = (e: React.FormEvent) => {
    e.preventDefault();
    const hasContent =
      Object.values(prompts).some((v) => v.trim().length > 0) || freeNotes.trim().length > 0;
    if (!hasContent) {
      showToast("Write at least one reflection response before saving", "error");
      return;
    }
    createJournalEntry({
      type: "daily_reflection",
      title: refTitle.trim() || `Daily Reflection — ${todayISO()}`,
      content: freeNotes.trim() || prompts.accomplished || prompts.learned,
      date: todayISO(),
      prompts,
      tags: ["daily-reflection"],
      mood: refMood,
    });
    setPrompts(EMPTY_PROMPTS);
    setFreeNotes("");
  };

  const handleSaveFreeform = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryTitle.trim() || !entryContent.trim()) return;
    createJournalEntry({
      type: entryType,
      title: entryTitle.trim(),
      content: entryContent.trim(),
      date: todayISO(),
      tags: [entryType],
    });
    setEntryTitle("");
    setEntryContent("");
  };

  const handleGenerateWeeklyReview = async () => {
    setGeneratingReview(true);
    try {
      const res = await fetch("/api/ai/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          weekEnd,
          model: data.preferences.groqModel,
          metrics: {
            tasksCompleted: weekMetrics.completed.map((t) => ({
              title: t.title,
              category: t.category,
            })),
            tasksDeferred: weekMetrics.deferred.map((t) => ({
              title: t.title,
              category: t.category,
            })),
            goals: data.goals
              .filter((g) => g.status === "active")
              .map((g) => ({ title: g.title, progress: g.progress, category: g.category })),
            habitConsistencyPct: weekMetrics.habitPct,
            strugglingHabits: weekMetrics.struggling,
            focusHours: weekMetrics.focusHours,
            journalHighlights: data.journalEntries.slice(0, 4).map((j) => j.title),
          },
        }),
      });
      const json = await res.json();
      setReviewMode(json.mode || "mock");
      setDraftSummary(json.summary || "");
      setDraftAccomplishments((json.accomplishments || []).join("\n"));
      setDraftAttention((json.areasNeedingAttention || []).join("\n"));
      setDraftAdjustments((json.nextWeekAdjustments || []).join("\n"));
    } catch {
      showToast("Failed to generate weekly review", "error");
    } finally {
      setGeneratingReview(false);
    }
  };

  const handleSaveWeeklyReview = () => {
    if (!draftSummary.trim()) return;
    saveWeeklyReview({
      weekStart,
      weekEnd,
      summary: draftSummary.trim(),
      goalsProgressed: data.goals
        .filter((g) => g.status === "active")
        .map((g) => `${g.title} (${g.progress}%)`),
      tasksCompletedCount: weekMetrics.completed.length,
      tasksDeferredCount: weekMetrics.deferred.length,
      habitConsistencyPct: weekMetrics.habitPct,
      focusHours: weekMetrics.focusHours,
      accomplishments: draftAccomplishments
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      areasNeedingAttention: draftAttention
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      nextWeekAdjustments: draftAdjustments
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      aiGenerated: Boolean(reviewMode),
    });
    setDraftSummary("");
    setDraftAccomplishments("");
    setDraftAttention("");
    setDraftAdjustments("");
    setReviewMode(null);
  };

  const filteredEntries = data.journalEntries.filter(
    (j) => archiveFilter === "all" || j.type === archiveFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Clarity & Learning
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            Journal & Reflection
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Close each day and week with honest reflection, lessons, and deliberate adjustments.
          </p>
        </div>

        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {(
            [
              ["daily", "Daily Reflection"],
              ["weekly", "Weekly Review"],
              ["archive", "Journal & Ideas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
                tab === key
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* DAILY REFLECTION TAB */}
      {tab === "daily" && (
        <Card className="p-6">
          <form onSubmit={handleSaveDailyReflection} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Reflection Title
                </label>
                <Input value={refTitle} onChange={(e) => setRefTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Energy / State
                </label>
                <Select
                  value={refMood}
                  onChange={(e) => setRefMood(e.target.value as typeof refMood)}
                >
                  <option value="grounded">Grounded</option>
                  <option value="energized">Energized</option>
                  <option value="reflective">Reflective</option>
                  <option value="stretched">Stretched</option>
                  <option value="tired">Tired</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ["accomplished", "What did I accomplish today?"],
                  ["matteredMost", "What mattered most?"],
                  ["avoided", "What did I avoid?"],
                  ["consumedAttention", "What consumed my attention?"],
                  ["learned", "What did I learn?"],
                  ["doDifferentlyTomorrow", "What should I do differently tomorrow?"],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                    {label}
                  </label>
                  <Textarea
                    rows={3}
                    value={prompts[field]}
                    onChange={(e) =>
                      setPrompts((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    placeholder="Write honestly and concisely..."
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Additional Notes (Optional)
              </label>
              <Textarea
                rows={3}
                value={freeNotes}
                onChange={(e) => setFreeNotes(e.target.value)}
                placeholder="Any observations, gratitude, or ideas to capture..."
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit">
                <Save className="h-4 w-4" />
                Save Daily Reflection
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* WEEKLY REVIEW TAB */}
      {tab === "weekly" && (
        <div className="space-y-5">
          {/* Actual Data Snapshot */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-[var(--accent)]" />
                  <h2 className="text-sm font-semibold">
                    Current Week ({weekStart} to {weekEnd})
                  </h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {weekMetrics.completed.length} tasks completed · {weekMetrics.deferred.length}{" "}
                  deferred/overdue · {weekMetrics.focusHours}h focus · {weekMetrics.habitPct}%
                  habit consistency
                </p>
              </div>
              <Button onClick={() => void handleGenerateWeeklyReview()} disabled={generatingReview}>
                {generatingReview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generatingReview ? "Synthesizing..." : "Generate Weekly Review with AI"}
              </Button>
            </div>

            {/* Editable Draft */}
            {(draftSummary || draftAccomplishments) && (
              <div className="mt-5 pt-5 border-t border-[var(--border)] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Editable Weekly Review Draft
                  </span>
                  {reviewMode && (
                    <Badge tone={reviewMode === "groq" ? "accent" : "neutral"}>
                      {reviewMode === "groq" ? "Groq AI" : "Mock AI"}
                    </Badge>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Executive Summary
                  </label>
                  <Textarea
                    rows={3}
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Important Accomplishments (1 per line)
                    </label>
                    <Textarea
                      rows={4}
                      value={draftAccomplishments}
                      onChange={(e) => setDraftAccomplishments(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Areas Requiring Attention
                    </label>
                    <Textarea
                      rows={4}
                      value={draftAttention}
                      onChange={(e) => setDraftAttention(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Adjustments for Next Week
                    </label>
                    <Textarea
                      rows={4}
                      value={draftAdjustments}
                      onChange={(e) => setDraftAdjustments(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveWeeklyReview}>
                    <Save className="h-4 w-4" />
                    Save Weekly Review
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Past Weekly Reviews */}
          <div className="space-y-4">
            {data.weeklyReviews.map((wr) => (
              <Card key={wr.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Week of {formatFriendlyDate(wr.weekStart)} – {formatFriendlyDate(wr.weekEnd)}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {wr.tasksCompletedCount} completed · {wr.focusHours}h focus ·{" "}
                      {wr.habitConsistencyPct}% routines
                    </p>
                  </div>
                  {wr.aiGenerated && <Badge tone="accent">AI Assisted</Badge>}
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{wr.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="rounded-xl bg-[var(--bg)] p-3 border border-[var(--border)]">
                    <p className="font-semibold text-[var(--success)] mb-1.5">Accomplishments</p>
                    <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                      {wr.accomplishments.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-[var(--bg)] p-3 border border-[var(--border)]">
                    <p className="font-semibold text-[var(--warning)] mb-1.5">Needs Attention</p>
                    <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                      {wr.areasNeedingAttention.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-[var(--bg)] p-3 border border-[var(--border)]">
                    <p className="font-semibold text-[var(--accent)] mb-1.5">Next Week Shifts</p>
                    <ul className="space-y-1 text-[var(--text-secondary)] list-disc pl-4">
                      {wr.nextWeekAdjustments.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* JOURNAL & IDEAS ARCHIVE TAB */}
      {tab === "archive" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-5 p-5 h-fit">
            <CardTitle>New Entry</CardTitle>
            <CardDescription>Capture a lesson learned, idea, or free-form note</CardDescription>
            <form onSubmit={handleSaveFreeform} className="mt-4 space-y-3">
              <Select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as JournalType)}
              >
                <option value="freeform">Free-form Journal</option>
                <option value="lesson">Lesson Learned</option>
                <option value="idea">Idea / Observation</option>
              </Select>
              <Input
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="Entry title..."
                required
              />
              <Textarea
                rows={6}
                value={entryContent}
                onChange={(e) => setEntryContent(e.target.value)}
                placeholder="Write freely..."
                required
              />
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" />
                Save Entry
              </Button>
            </form>
          </Card>

          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {filteredEntries.length} entries
              </span>
              <Select
                value={archiveFilter}
                onChange={(e) => setArchiveFilter(e.target.value as JournalType | "all")}
                className="w-44 h-8 text-xs"
              >
                <option value="all">All Types</option>
                <option value="daily_reflection">Daily Reflections</option>
                <option value="freeform">Free-form</option>
                <option value="lesson">Lessons Learned</option>
                <option value="idea">Ideas</option>
              </Select>
            </div>

            {filteredEntries.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="No journal entries yet"
                description="Capture your first daily reflection, lesson learned, or idea."
              />
            ) : (
              filteredEntries.map((entry) => (
                <Card key={entry.id} className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">{entry.type.replace("_", " ")}</Badge>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatFriendlyDate(entry.date)}
                        </span>
                        {entry.mood && <Badge tone="neutral">{entry.mood}</Badge>}
                      </div>
                      <h3 className="mt-2 text-base font-semibold">{entry.title}</h3>
                    </div>
                    <button
                      onClick={() => deleteJournalEntry(entry.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {entry.content}
                  </p>
                  {entry.prompts && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {entry.prompts.matteredMost && (
                        <div>
                          <span className="font-semibold text-[var(--text-primary)]">Mattered most: </span>
                          <span className="text-[var(--text-secondary)]">{entry.prompts.matteredMost}</span>
                        </div>
                      )}
                      {entry.prompts.learned && (
                        <div>
                          <span className="font-semibold text-[var(--text-primary)]">Learned: </span>
                          <span className="text-[var(--text-secondary)]">{entry.prompts.learned}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

