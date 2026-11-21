"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { subDays, format } from "date-fns";
import { useOS } from "@/context/OSContext";
import { todayISO, uid } from "@/lib/utils";
import { Badge, Button } from "@/components/ui/primitives";
import type { AIConversation, AIMessage, AIProposedAction } from "@/types";

const QUICK_PROMPTS = [
  "What should I focus on today?",
  "Which goals am I neglecting?",
  "My schedule is overloaded. Help me reorganize it.",
  "What patterns do you notice in my execution?",
  "Help me reflect on my week.",
];

export function AssistantPanel({ compact = false }: { compact?: boolean }) {
  const { data, saveConversation, applyProposedAction } = useOS();

  const [activeConvId, setActiveConvId] = useState<string>(
    () => data.aiConversations[0]?.id || uid("conv")
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; defaultModel: string } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((j) => setAiStatus({ configured: Boolean(j.configured), defaultModel: j.defaultModel }))
      .catch(() => {});
  }, []);

  const conversation: AIConversation = useMemo(() => {
    const found = data.aiConversations.find((c) => c.id === activeConvId);
    if (found) return found;
    return {
      id: activeConvId,
      userId: data.profile.id,
      title: "Personal OS Assistant",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content:
            "I'm ready to think alongside you. Ask about today's priorities, neglected goals, overloaded schedules, or weekly patterns.",
          timestamp: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
  }, [data.aiConversations, activeConvId, data.profile.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation.messages.length, sending]);

  const buildWorkspaceContext = () => {
    const today = todayISO();
    const last7Dates = new Set(
      Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"))
    );

    const focusMinutesLast7Days = data.focusSessions
      .filter((s) => last7Dates.has(s.date))
      .reduce((a, b) => a + b.actualMinutes, 0);

    const habits = data.habits
      .filter((h) => h.status === "active")
      .map((h) => {
        const done = data.habitEntries.filter(
          (e) => e.habitId === h.id && e.completed && last7Dates.has(e.date)
        ).length;
        return {
          title: h.title,
          category: h.category,
          recentRatePct: Math.min(100, Math.round((done / Math.max(h.targetPerWeek, 1)) * 100)),
        };
      });

    return {
      today,
      userName: data.profile.name,
      visionNorthStar: data.vision.northStar,
      visionStatement: data.vision.statement.slice(0, 600),
      activeGoals: data.goals
        .filter((g) => g.status === "active")
        .map((g) => ({
          id: g.id,
          title: g.title,
          category: g.category,
          progress: g.progress,
          priority: g.priority,
          targetDate: g.targetDate,
        })),
      openTasks: data.tasks
        .filter((t) => t.status !== "done")
        .slice(0, 25)
        .map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate,
          scheduledDate: t.scheduledDate,
          estimatedMinutes: t.estimatedMinutes,
          category: t.category,
          goalId: t.goalId,
        })),
      completedTasksCount: data.tasks.filter((t) => t.status === "done").length,
      habits,
      focusMinutesLast7Days,
      recentJournalTitles: data.journalEntries.slice(0, 4).map((j) => `${j.date}: ${j.title}`),
      maxDailyWorkloadHours: data.preferences.maxDailyWorkloadHours,
    };
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: AIMessage = {
      id: uid("msg"),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const updatedWithUser: AIConversation = {
      ...conversation,
      messages: [...conversation.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };
    saveConversation(updatedWithUser);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: updatedWithUser.messages.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: data.preferences.groqModel,
          workspaceContext: buildWorkspaceContext(),
        }),
      });
      const json = await res.json();

      const assistantMsg: AIMessage = {
        id: uid("msg"),
        role: "assistant",
        content: json.reply || "I could not generate a response right now.",
        timestamp: new Date().toISOString(),
        mode: json.mode || "mock",
        proposedActions: Array.isArray(json.proposedActions)
          ? (json.proposedActions as AIProposedAction[])
          : undefined,
      };

      saveConversation({
        ...updatedWithUser,
        messages: [...updatedWithUser.messages, assistantMsg],
        updatedAt: new Date().toISOString(),
      });
    } catch {
      const errMsg: AIMessage = {
        id: uid("msg"),
        role: "assistant",
        content: "I ran into a connection issue reaching the AI route. Please try again.",
        timestamp: new Date().toISOString(),
      };
      saveConversation({
        ...updatedWithUser,
        messages: [...updatedWithUser.messages, errMsg],
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  const handleActionDecision = (
    messageId: string,
    actionId: string,
    decision: "approved" | "rejected"
  ) => {
    const targetMsg = conversation.messages.find((m) => m.id === messageId);
    const targetAction = targetMsg?.proposedActions?.find((a) => a.id === actionId);
    if (!targetAction || targetAction.status !== "pending") return;

    if (decision === "approved") {
      applyProposedAction(targetAction);
    }

    const updatedMessages = conversation.messages.map((m) => {
      if (m.id !== messageId) return m;
      return {
        ...m,
        proposedActions: m.proposedActions?.map((a) =>
          a.id === actionId ? { ...a, status: decision } : a
        ),
      };
    });

    saveConversation({
      ...conversation,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header status */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Executive AI Assistant
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Grounded in your live workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={aiStatus?.configured ? "success" : "warning"}>
            {aiStatus?.configured ? "Groq Live" : "Mock AI Mode"}
          </Badge>
          {!compact && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setActiveConvId(uid("conv"))}
            >
              New Thread
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border)]"
              }`}
            >
              {msg.content}
              {msg.role === "assistant" && msg.mode && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <span>{msg.mode === "groq" ? "Powered by Groq" : "Mock AI (add GROQ_API_KEY for live Groq)"}</span>
                </div>
              )}
            </div>

            {/* Proposed actions requiring explicit user approval */}
            {msg.proposedActions && msg.proposedActions.length > 0 && (
              <div className="mt-2 w-full max-w-[90%] space-y-2">
                {msg.proposedActions.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{act.label}</p>
                        <p className="text-[var(--text-secondary)] mt-0.5">{act.description}</p>
                      </div>
                      {act.status === "pending" ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleActionDecision(msg.id, act.id, "approved")}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleActionDecision(msg.id, act.id, "rejected")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Badge tone={act.status === "approved" ? "success" : "neutral"}>
                          {act.status === "approved" ? "Applied" : "Dismissed"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] px-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
            <span>Analyzing your workspace...</span>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="border-t border-[var(--border)] px-4 pt-2.5 pb-1 flex gap-1.5 overflow-x-auto">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void sendMessage(q)}
            disabled={sending}
            className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="p-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your Personal OS assistant..."
          className="h-10 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
        />
        <Button type="submit" disabled={sending || !input.trim()} className="h-10 px-3.5 rounded-xl">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

