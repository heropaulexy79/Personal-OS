"use client";

import React, { useState } from "react";
import { Compass, Flame, MessageSquare, Plus, Target, Timer, Trash2 } from "lucide-react";
import { useOS } from "@/context/OSContext";
import { uid } from "@/lib/utils";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { Button, Card } from "@/components/ui/primitives";

export default function AssistantPage() {
  const { data, deleteConversation } = useOS();
  const [selectedConvId, setSelectedConvId] = useState<string>(
    () => data.aiConversations[0]?.id || uid("conv")
  );

  const activeGoals = data.goals.filter((g) => g.status === "active").length;
  const openTasks = data.tasks.filter((t) => t.status !== "done").length;
  const activeHabits = data.habits.filter((h) => h.status === "active").length;
  const totalFocusHours = (
    data.focusSessions.reduce((a, s) => a + s.actualMinutes, 0) / 60
  ).toFixed(1);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
          Executive Thinking Partner
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
          AI Assistant
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Strategic guidance grounded in your live vision, goals, projects, schedule, tasks, habits, and reflections.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Context & Conversation History Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Conversations</span>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setSelectedConvId(uid("conv"))}
              >
                <Plus className="h-3 w-3" />
                New
              </Button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.aiConversations.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2">
                  Start typing to save your first conversation.
                </p>
              ) : (
                data.aiConversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      selectedConvId === c.id
                        ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedConvId(c.id)}
                      className="truncate text-left flex-1 cursor-pointer"
                    >
                      {c.title}
                    </button>
                    <button
                      onClick={() => {
                        deleteConversation(c.id);
                        if (selectedConvId === c.id) {
                          const next = data.aiConversations.find((x) => x.id !== c.id);
                          setSelectedConvId(next?.id || uid("conv"));
                        }
                      }}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer shrink-0"
                      title="Delete thread"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)] mb-2">
              <Compass className="h-4 w-4" />
              <span>Loaded Live Context</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {data.vision.northStar ||
                "Set your North Star in My Vision so the assistant can align every recommendation with it."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Target className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>Active Goals</span>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{activeGoals}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Flame className="h-3.5 w-3.5 text-[var(--warning)]" />
                  <span>Habits</span>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{activeHabits}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="text-[var(--text-secondary)]">Open Tasks</div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{openTasks}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Timer className="h-3.5 w-3.5 text-[var(--success)]" />
                  <span>Focus Logged</span>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{totalFocusHours}h</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Autonomy Safeguard
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Every task creation, reschedule, or milestone suggested by the AI appears as a
              reviewable proposal card. Nothing in your workspace is modified without your explicit
              approval.
            </p>
          </Card>
        </div>

        {/* Full Chat Panel */}
        <Card className="lg:col-span-8 h-[680px] overflow-hidden flex flex-col">
          <AssistantPanel
            selectedConvId={selectedConvId}
            onSelectConvId={setSelectedConvId}
          />
        </Card>
      </div>
    </div>
  );
}
