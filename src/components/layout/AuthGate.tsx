"use client";

import React, { useState } from "react";
import { ArrowRight, Compass, Lock, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import { useOS } from "@/context/OSContext";
import { Button, Card, Input } from "@/components/ui/primitives";

export function AuthGate() {
  const {
    firebaseReady,
    authError,
    enterDemoMode,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
  } = useOS();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseReady) return;
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(name, email, password);
      }
    } catch {
      // handled by context authError
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col lg:flex-row">
      {/* Left Editorial Column */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              PERSONAL OS
            </span>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Execution & Growth System
            </p>
          </div>
        </div>

        <div className="my-12 lg:my-0 max-w-lg">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)] mb-4">
            Intentional Living, Engineered
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-[var(--text-primary)] leading-[1.15]">
            Your daily activities should be an expression of your long-term vision, not a distraction from it.
          </h1>
          <p className="mt-5 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Unite your life vision, goals, intelligent daily planning, deep focus sessions,
            routines, and reflective analytics in one calm, AI-assisted workspace powered by Groq.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-xs">
            {[
              "Groq-Powered Executive AI",
              "Intelligent Daily Time-Blocking",
              "Vision-to-Task Alignment",
              "Deep Focus & Rhythm Tracking",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[var(--text-primary)]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
          <span>Private Firestore workspace with strict per-user security rules.</span>
        </div>
      </div>

      {/* Right Auth Column */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {mode === "signin" ? "Sign in to your workspace" : "Create your Personal OS"}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {mode === "signin"
                  ? "Continue where you left off with synced goals, plans, and reflections."
                  : "Start aligning your daily execution with your long-term vision."}
              </p>
            </div>

            {!firebaseReady && (
              <div className="mb-5 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-3.5 text-xs text-[var(--warning)] flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Firebase credentials not yet configured</p>
                  <p className="mt-0.5 opacity-90">
                    Add your <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code> keys in{" "}
                    <code className="font-mono">.env.local</code> to enable cloud accounts, or launch
                    the full Interactive Demo below.
                  </p>
                </div>
              </div>
            )}

            {authError && (
              <div className="mb-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-xs text-[var(--danger)]">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="David"
                    required
                    disabled={!firebaseReady}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                  disabled={!firebaseReady}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  disabled={!firebaseReady}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                size="lg"
                disabled={!firebaseReady || submitting}
              >
                <Lock className="h-4 w-4" />
                {submitting
                  ? "Authenticating..."
                  : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>

            {firebaseReady && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border)]" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-[var(--surface)] px-2 text-[var(--text-muted)]">
                      or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void loginWithGoogle()}
                >
                  Continue with Google
                </Button>
              </>
            )}

            <div className="mt-5 text-center text-xs text-[var(--text-secondary)]">
              {mode === "signin" ? (
                <>
                  New to Personal OS?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-medium text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-medium text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* Isolated Demo Workspace Card */}
          <Card className="p-5 border-[var(--accent)]/25 bg-[var(--accent-soft)]/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--accent)]">
                  Interactive Demo Workspace
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Explore PERSONAL OS immediately with realistic sample vision, goals, tasks,
                  habits, focus history, and analytics. Completely isolated from real accounts.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={enterDemoMode}
              className="w-full mt-4"
              size="md"
            >
              Launch Demo Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

