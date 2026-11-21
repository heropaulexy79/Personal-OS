"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from "@/components/ui/primitives";
import type { UserPreferences } from "@/types";

interface AIStatusInfo {
  provider: string;
  configured: boolean;
  defaultModel: string;
  models: Array<{ id: string; label: string }>;
}

export default function SettingsPage() {
  const {
    data,
    isDemo,
    firebaseReady,
    updateProfile,
    updatePreferences,
    exportAllData,
    resetDemoData,
    wipeWorkspaceData,
    showToast,
  } = useOS();

  const [name, setName] = useState(data.profile.name);
  const [role, setRole] = useState(data.profile.role || "");
  const [prefs, setPrefs] = useState<UserPreferences>(data.preferences);
  const [aiStatus, setAiStatus] = useState<AIStatusInfo | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((j) => setAiStatus(j as AIStatusInfo))
      .catch(() => {});
  }, []);

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name: name.trim() || "Explorer", role: role.trim() });
    updatePreferences(prefs);
    showToast("Settings saved", "success");
  };

  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personal-os-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Workspace exported as JSON", "success");
  };

  const weightSum =
    prefs.scoreWeights.priorities +
    prefs.scoreWeights.habits +
    prefs.scoreWeights.focus +
    prefs.scoreWeights.goals;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
          System Configuration
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Tailor your planning boundaries, Groq AI model, theme, and data ownership.
        </p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Profile & Theme */}
        <Card>
          <CardHeader>
            <CardTitle>Profile & Appearance</CardTitle>
            <CardDescription>How PERSONAL OS addresses and displays your workspace</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Display Name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Role / Focus
              </label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Founder, Engineer, Student"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Theme
              </label>
              <Select
                value={prefs.theme}
                onChange={(e) =>
                  setPrefs({ ...prefs, theme: e.target.value as UserPreferences["theme"] })
                }
              >
                <option value="light">Light (Warm Off-White)</option>
                <option value="dark">Dark (Deep Charcoal)</option>
                <option value="system">System Preference</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Daily Planning & Focus Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Planning & Focus Guardrails</CardTitle>
            <CardDescription>
              Used by &ldquo;Plan My Day with AI&rdquo; and the Focus timer to prevent overload
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Workday Start
              </label>
              <Input
                type="time"
                value={prefs.workStartHour}
                onChange={(e) => setPrefs({ ...prefs, workStartHour: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Workday End
              </label>
              <Input
                type="time"
                value={prefs.workEndHour}
                onChange={(e) => setPrefs({ ...prefs, workEndHour: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Max Daily Workload (hours)
              </label>
              <Input
                type="number"
                min={2}
                max={12}
                value={prefs.maxDailyWorkloadHours}
                onChange={(e) =>
                  setPrefs({ ...prefs, maxDailyWorkloadHours: Number(e.target.value) || 6 })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Preferred Focus Block (mins)
              </label>
              <Input
                type="number"
                min={15}
                max={120}
                value={prefs.preferredFocusMinutes}
                onChange={(e) =>
                  setPrefs({ ...prefs, preferredFocusMinutes: Number(e.target.value) || 50 })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Break Interval (mins)
              </label>
              <Input
                type="number"
                min={5}
                max={30}
                value={prefs.preferredBreakMinutes}
                onChange={(e) =>
                  setPrefs({ ...prefs, preferredBreakMinutes: Number(e.target.value) || 10 })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Daily Focus Target (mins)
              </label>
              <Input
                type="number"
                min={30}
                max={480}
                value={prefs.dailyFocusTargetMinutes}
                onChange={(e) =>
                  setPrefs({ ...prefs, dailyFocusTargetMinutes: Number(e.target.value) || 180 })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Weekly Review Day
              </label>
              <Select
                value={prefs.weeklyReviewDay}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    weeklyReviewDay: e.target.value as UserPreferences["weeklyReviewDay"],
                  })
                }
              >
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Timezone
              </label>
              <Input
                value={prefs.timezone}
                onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Transparent Daily Execution Score Weights */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Daily Execution Score Weights</CardTitle>
              <CardDescription>
                Customize how your personal alignment indicator is calculated (normalized automatically)
              </CardDescription>
            </div>
            <Badge tone={weightSum === 100 ? "success" : "warning"}>Total: {weightSum}%</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(
              [
                ["priorities", "Priorities %"],
                ["habits", "Routines %"],
                ["focus", "Focus Time %"],
                ["goals", "Goal Alignment %"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {label}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={prefs.scoreWeights[key]}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      scoreWeights: {
                        ...prefs.scoreWeights,
                        [key]: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Groq AI Configuration */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                AI Configuration (Groq)
              </CardTitle>
              <CardDescription>
                Server-side Groq API integration — API keys are never exposed to the browser
              </CardDescription>
            </div>
            <Badge tone={aiStatus?.configured ? "success" : "warning"}>
              {aiStatus?.configured ? "Groq Connected" : "Mock AI Mode"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Groq Model
              </label>
              <Select
                value={prefs.groqModel}
                onChange={(e) => setPrefs({ ...prefs, groqModel: e.target.value })}
              >
                {(
                  aiStatus?.models || [
                    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Recommended)" },
                    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Fast)" },
                    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B 32K" },
                  ]
                ).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            {!aiStatus?.configured && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                To activate live Groq inference, add{" "}
                <code className="font-mono text-[var(--text-primary)]">GROQ_API_KEY=gsk_...</code>{" "}
                to your <code className="font-mono text-[var(--text-primary)]">.env.local</code>{" "}
                file and restart the Next.js server. Until then, all AI features operate in
                transparent, data-grounded Mock AI mode.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            <Save className="h-4 w-4" />
            Save All Settings
          </Button>
        </div>
      </form>

      {/* Account, Firebase & Data Ownership */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--success)]" />
            Account & Data Ownership
          </CardTitle>
          <CardDescription>
            {isDemo
              ? "Currently running in isolated Demo Mode (stored locally in your browser)"
              : firebaseReady
              ? "Synced privately to Cloud Firestore under your authenticated UID"
              : "Local session"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2.5">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export All Data (JSON)
            </Button>
            {isDemo && (
              <Button variant="outline" onClick={resetDemoData}>
                <RotateCcw className="h-4 w-4" />
                Reset Demo Sample Data
              </Button>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            {!confirmWipe ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmWipe(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete All Workspace Data
              </Button>
            ) : (
              <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--danger)]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>This permanently clears your goals, tasks, habits, and journal entries.</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="xs" variant="ghost" onClick={() => setConfirmWipe(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    variant="danger"
                    onClick={() => {
                      void wipeWorkspaceData();
                      setConfirmWipe(false);
                    }}
                  >
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

