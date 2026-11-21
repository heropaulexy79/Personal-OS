"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, Sparkles, Wand2 } from "lucide-react";
import { useOS } from "@/context/OSContext";
import { todayISO } from "@/lib/utils";
import { Badge, Button, Input, Modal, Select } from "@/components/ui/primitives";
import type { Priority } from "@/types";

interface ParsedTask {
  title: string;
  dueDate: string;
  priority: Priority;
  estimatedMinutes: number;
  projectId: string;
  goalId?: string;
  category: string;
  needsConfirmation: boolean;
  ambiguities: string[];
}

export function QuickCaptureModal() {
  const { quickCaptureOpen, setQuickCaptureOpen, data, createTask, showToast } = useOS();

  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [aiMode, setAiMode] = useState<"groq" | "mock" | null>(null);
  const [draft, setDraft] = useState<ParsedTask | null>(null);

  const reset = () => {
    setRawInput("");
    setDraft(null);
    setAiMode(null);
    setParsing(false);
  };

  const handleClose = () => {
    reset();
    setQuickCaptureOpen(false);
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/ai/quick-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: rawInput.trim(),
          today: todayISO(),
          projects: data.projects.map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
          })),
          goals: data.goals.map((g) => ({
            id: g.id,
            title: g.title,
            category: g.category,
          })),
          categories: data.vision.lifeAreas.map((a) => a.name),
          model: data.preferences.groqModel,
        }),
      });
      const json = await res.json();
      if (json.parsed) {
        setDraft(json.parsed as ParsedTask);
        setAiMode(json.mode || "mock");
      }
    } catch {
      showToast("Could not analyze input — fill fields manually below", "error");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmSave = () => {
    if (!draft || !draft.title.trim()) return;
    createTask({
      title: draft.title.trim(),
      status: "todo",
      priority: draft.priority,
      dueDate: draft.dueDate || todayISO(),
      scheduledDate: draft.dueDate || todayISO(),
      estimatedMinutes: Number(draft.estimatedMinutes) || 45,
      actualMinutes: 0,
      projectId: draft.projectId || undefined,
      goalId: draft.goalId || undefined,
      category: draft.category || "Personal Development",
      recurrence: "none",
      subtasks: [],
    });
    showToast("Task captured and saved", "success");
    handleClose();
  };

  return (
    <Modal
      open={quickCaptureOpen}
      onClose={handleClose}
      title="Quick Capture"
      description='Type naturally, e.g. "Finish the Devorah Foundation website by Friday, high priority"'
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleParse} className="space-y-4">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Capture a task, deadline, or thought..."
            className="h-10"
          />
          <Button type="submit" disabled={parsing || !rawInput.trim()} className="shrink-0 h-10">
            <Wand2 className="h-4 w-4" />
            {parsing ? "Parsing..." : "Analyze"}
          </Button>
        </div>
      </form>

      {draft && (
        <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Review & Confirm Extracted Task
              </span>
            </div>
            {aiMode && (
              <Badge tone={aiMode === "groq" ? "accent" : "neutral"}>
                {aiMode === "groq" ? "Groq AI" : "Mock AI"}
              </Badge>
            )}
          </div>

          {draft.ambiguities && draft.ambiguities.length > 0 && (
            <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Please confirm inferred details</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 opacity-90">
                {draft.ambiguities.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Task Title
              </label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Priority
                </label>
                <Select
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Est. Minutes
                </label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={draft.estimatedMinutes}
                  onChange={(e) =>
                    setDraft({ ...draft, estimatedMinutes: Number(e.target.value) || 30 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Life Area
                </label>
                <Select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {data.vision.lifeAreas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Project (Optional)
                </label>
                <Select
                  value={draft.projectId}
                  onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
                >
                  <option value="">No project</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSave}>
              <Check className="h-4 w-4" />
              Confirm & Save Task
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

