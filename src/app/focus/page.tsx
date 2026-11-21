"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Coffee,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Timer,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { formatMinutes, todayISO } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  ProgressBar,
  Select,
} from "@/components/ui/primitives";

const PRESETS = [
  { label: "Pomodoro 25/5", focus: 25, brk: 5 },
  { label: "Deep Work 50/10", focus: 50, brk: 10 },
  { label: "Extended 90/15", focus: 90, brk: 15 },
];

export default function FocusPage() {
  const {
    data,
    activeFocusTaskId,
    setActiveFocusTaskId,
    logFocusSession,
    deleteFocusSession,
  } = useOS();

  const today = todayISO();
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    activeFocusTaskId || data.tasks.find((t) => t.status !== "done")?.id || ""
  );
  const [focusMinutes, setFocusMinutes] = useState(data.preferences.preferredFocusMinutes || 50);
  const [breakMinutes, setBreakMinutes] = useState(data.preferences.preferredBreakMinutes || 10);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const startedAtRef = useRef<string | null>(null);
  const elapsedSecondsRef = useRef<number>(0);

  // Sync if user clicked "Start Focus Session" from Overview
  useEffect(() => {
    if (activeFocusTaskId) {
      setSelectedTaskId(activeFocusTaskId);
      setActiveFocusTaskId(null);
    }
  }, [activeFocusTaskId, setActiveFocusTaskId]);

  const selectedTask = data.tasks.find((t) => t.id === selectedTaskId);
  const totalPhaseSeconds = (phase === "focus" ? focusMinutes : breakMinutes) * 60;
  const progressPct =
    totalPhaseSeconds > 0
      ? Math.round(((totalPhaseSeconds - secondsLeft) / totalPhaseSeconds) * 100)
      : 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          if (phase === "focus") {
            logFocusSession({
              taskId: selectedTask?.id,
              taskTitle: selectedTask?.title || "Unlinked Deep Work Session",
              goalId: selectedTask?.goalId,
              category: selectedTask?.category || "Personal Development",
              plannedMinutes: focusMinutes,
              actualMinutes: focusMinutes,
              breakMinutes,
              completed: true,
              startedAt: startedAtRef.current || new Date().toISOString(),
              endedAt: new Date().toISOString(),
              date: todayISO(),
            });
            setPhase("break");
            return breakMinutes * 60;
          } else {
            setPhase("focus");
            return focusMinutes * 60;
          }
        }
        elapsedSecondsRef.current += 1;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase, focusMinutes, breakMinutes, selectedTask, logFocusSession]);

  const handleStart = () => {
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
    }
    setRunning(true);
  };

  const handleStopAndLog = () => {
    setRunning(false);
    const loggedMins = Math.max(1, Math.round(elapsedSecondsRef.current / 60));
    if (phase === "focus" && elapsedSecondsRef.current >= 60) {
      logFocusSession({
        taskId: selectedTask?.id,
        taskTitle: selectedTask?.title || "Unlinked Deep Work Session",
        goalId: selectedTask?.goalId,
        category: selectedTask?.category || "Personal Development",
        plannedMinutes: focusMinutes,
        actualMinutes: loggedMins,
        breakMinutes,
        completed: loggedMins >= focusMinutes,
        startedAt: startedAtRef.current || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        date: todayISO(),
      });
    }
    elapsedSecondsRef.current = 0;
    startedAtRef.current = null;
    setPhase("focus");
    setSecondsLeft(focusMinutes * 60);
  };

  const handleReset = () => {
    setRunning(false);
    elapsedSecondsRef.current = 0;
    startedAtRef.current = null;
    setSecondsLeft((phase === "focus" ? focusMinutes : breakMinutes) * 60);
  };

  const applyPreset = (f: number, b: number) => {
    setRunning(false);
    setFocusMinutes(f);
    setBreakMinutes(b);
    setPhase("focus");
    setSecondsLeft(f * 60);
    elapsedSecondsRef.current = 0;
    startedAtRef.current = null;
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const todayMinutes = useMemo(
    () =>
      data.focusSessions
        .filter((s) => s.date === today)
        .reduce((a, b) => a + b.actualMinutes, 0),
    [data.focusSessions, today]
  );

  const targetPct = Math.min(
    100,
    Math.round((todayMinutes / Math.max(data.preferences.dailyFocusTargetMinutes, 1)) * 100)
  );

  return (
    <div className="space-y-6">
      {!zenMode && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
              Deep Work & Attention
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Focus</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Protect uninterrupted blocks of attention for your highest-leverage work.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setZenMode(true)}>
            <Maximize2 className="h-3.5 w-3.5" />
            Minimal Zen View
          </Button>
        </div>
      )}

      {/* Ambient Timer Card */}
      <Card
        className={`p-8 sm:p-12 flex flex-col items-center text-center relative transition-all ${
          zenMode ? "min-h-[75vh] justify-center border-[var(--accent)]/30" : ""
        }`}
      >
        {zenMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZenMode(false)}
            className="absolute top-4 right-4"
          >
            <Minimize2 className="h-4 w-4" />
            Exit Zen View
          </Button>
        )}

        <div className="flex items-center gap-2 mb-6">
          <Badge tone={phase === "focus" ? "accent" : "success"}>
            {phase === "focus" ? (
              <>
                <Timer className="h-3 w-3" /> Focus Session
              </>
            ) : (
              <>
                <Coffee className="h-3 w-3" /> Recovery Break
              </>
            )}
          </Badge>
          {selectedTask && (
            <Badge tone="neutral">{selectedTask.category}</Badge>
          )}
        </div>

        {/* Active Task Title */}
        <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] max-w-lg">
          {selectedTask ? selectedTask.title : "Open Deep Work Block"}
        </p>

        {/* Big Countdown Display */}
        <div className="my-8">
          <div className="text-6xl sm:text-8xl font-semibold tracking-tighter tabular-nums text-[var(--text-primary)]">
            {mm}:{ss}
          </div>
          <div className="mt-4 w-64 mx-auto">
            <ProgressBar value={progressPct} className="h-1.5" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!running ? (
            <Button size="lg" onClick={handleStart} className="px-7">
              <Play className="h-4 w-4 fill-current" />
              {elapsedSecondsRef.current > 0 ? "Resume" : "Start Session"}
            </Button>
          ) : (
            <Button size="lg" variant="secondary" onClick={() => setRunning(false)} className="px-7">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={handleStopAndLog} title="Stop and log session">
            <Square className="h-4 w-4" />
            Stop & Log
          </Button>
          <Button size="lg" variant="ghost" onClick={handleReset} title="Reset timer">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Presets & Task Selector */}
        {!zenMode && (
          <div className="mt-8 pt-6 border-t border-[var(--border)] w-full max-w-2xl space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.focus, p.brk)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                    focusMinutes === p.focus && breakMinutes === p.brk
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-left">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Linked Task
                </label>
                <Select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  disabled={running}
                >
                  <option value="">Unlinked deep work</option>
                  {data.tasks
                    .filter((t) => t.status !== "done")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Focus (mins)
                </label>
                <Input
                  type="number"
                  min={5}
                  max={180}
                  value={focusMinutes}
                  disabled={running}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 25;
                    setFocusMinutes(v);
                    if (phase === "focus") setSecondsLeft(v * 60);
                  }}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Break (mins)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={breakMinutes}
                  disabled={running}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 5;
                    setBreakMinutes(v);
                    if (phase === "break") setSecondsLeft(v * 60);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Daily Focus Target & History */}
      {!zenMode && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-4 p-5">
            <CardTitle>Daily Focus Target</CardTitle>
            <CardDescription>Today&apos;s deep work accumulation</CardDescription>
            <div className="mt-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-semibold tabular-nums">
                  {formatMinutes(todayMinutes)}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  of {formatMinutes(data.preferences.dailyFocusTargetMinutes)} target ({targetPct}%)
                </span>
              </div>
              <ProgressBar value={targetPct} className="h-2.5" />
            </div>
            <p className="mt-4 text-xs text-[var(--text-secondary)] leading-relaxed">
              Completed sessions automatically add their duration to the linked task&apos;s actual time.
            </p>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>Recent Focus Sessions</CardTitle>
              <CardDescription>{data.focusSessions.length} logged sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.focusSessions.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
                  Start your first focus session above to begin tracking deep work.
                </p>
              ) : (
                data.focusSessions.slice(0, 8).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.taskTitle}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {s.date} · {s.category || "Deep Work"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge tone="accent">{formatMinutes(s.actualMinutes)}</Badge>
                      <button
                        onClick={() => deleteFocusSession(s.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

