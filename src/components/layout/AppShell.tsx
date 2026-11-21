"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Compass,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Target,
  Timer,
  X,
} from "lucide-react";
import { useOS } from "@/context/OSContext";
import { cn } from "@/lib/utils";
import { AuthGate } from "./AuthGate";
import { QuickCaptureModal } from "@/components/ai/QuickCaptureModal";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { Badge, Button } from "@/components/ui/primitives";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/vision", label: "My Vision", icon: Compass },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/planner", label: "Daily Planner", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits & Routines", icon: Flame },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/journal", label: "Journal & Reflection", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_BOTTOM_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/assistant", label: "AI", icon: Sparkles },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    isAuthenticated,
    isLoading,
    isDemo,
    data,
    logout,
    resetDemoData,
    setQuickCaptureOpen,
    aiDrawerOpen,
    setAiDrawerOpen,
    updatePreferences,
    toast,
  } = useOS();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center animate-pulse">
            <Compass className="h-5 w-5" />
          </div>
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            Loading Personal OS...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  const isDark = data.preferences.theme === "dark";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen transition-all duration-200 shrink-0",
          collapsed ? "w-[72px]" : "w-[244px]"
        )}
      >
        {/* Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
              <Compass className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <p className="text-sm font-semibold tracking-tight leading-none">
                  PERSONAL OS
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Execution System
                </p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-[var(--border)] p-3">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{data.profile.name}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {isDemo ? "Demo Workspace" : data.profile.email}
                </p>
              </div>
              <button
                onClick={() => void logout()}
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                title={isDemo ? "Exit Demo" : "Sign Out"}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => void logout()}
              className="w-full flex justify-center rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--danger)] cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {isDemo && (
              <div className="flex items-center gap-2">
                <Badge tone="warning">Demo Mode</Badge>
                <button
                  onClick={resetDemoData}
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  title="Reset sample data"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Demo
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Global Quick Capture */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickCaptureOpen(true)}
              className="gap-2"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="hidden sm:inline">Quick Capture</span>
              <kbd className="hidden md:inline-block rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)]">
                ⌘K
              </kbd>
            </Button>

            {/* Contextual AI Drawer Toggle */}
            {pathname !== "/assistant" && (
              <Button
                variant={aiDrawerOpen ? "primary" : "outline"}
                size="sm"
                onClick={() => setAiDrawerOpen(!aiDrawerOpen)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Copilot</span>
              </Button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={() =>
                updatePreferences({ theme: isDark ? "light" : "dark" })
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              aria-label="Toggle theme"
              title="Toggle light/dark theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-24 lg:pb-10 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Contextual AI Assistant Drawer */}
      {aiDrawerOpen && pathname !== "/assistant" && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Contextual Assistant
            </span>
            <button
              onClick={() => setAiDrawerOpen(false)}
              className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AssistantPanel compact />
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
                  <Compass className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold">PERSONAL OS</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-[var(--text-secondary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-[var(--border)]">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void logout();
                }}
              >
                <LogOut className="h-4 w-4" />
                {isDemo ? "Exit Demo" : "Sign Out"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium",
                active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal />

      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-20 lg:bottom-6 right-6 z-50 rounded-xl px-4 py-2.5 text-xs font-medium shadow-lg border transition-all",
            toast.tone === "success"
              ? "bg-[var(--surface)] border-[var(--success)]/40 text-[var(--success)]"
              : toast.tone === "error"
              ? "bg-[var(--surface)] border-[var(--danger)]/40 text-[var(--danger)]"
              : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]"
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

