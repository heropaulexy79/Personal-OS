"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { Button, Modal } from "@/components/ui/primitives";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextValue {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  triggerInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue>({
  canInstall: false,
  isInstalled: false,
  isIOS: false,
  triggerInstall: async () => {},
});

export function usePWA() {
  return useContext(PWAContext);
}

const DISMISS_KEY = "personal_os_pwa_banner_dismissed";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration skipped:", err);
      });
    }

    // Detect already installed standalone mode
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    setIsIOS(ios);

    const dismissed = localStorage.getItem(DISMISS_KEY) === "true";
    setBannerDismissed(dismissed);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return;
    }
    if (isIOS) {
      setIosGuideOpen(true);
    }
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  const canInstall = !isInstalled && (Boolean(deferredPrompt) || isIOS);
  const showMobileBanner = canInstall && !bannerDismissed;

  return (
    <PWAContext.Provider value={{ canInstall, isInstalled, isIOS, triggerInstall }}>
      {children}

      {/* Sleek Mobile Install Banner */}
      {showMobileBanner && (
        <div className="fixed bottom-18 lg:bottom-5 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-40 rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)]/95 backdrop-blur-md p-3.5 shadow-xl flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Install Personal OS
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              Add to your home screen for a native app feel
            </p>
          </div>
          <Button size="xs" onClick={() => void triggerInstall()}>
            <Download className="h-3 w-3" />
            Install
          </Button>
          <button
            onClick={dismissBanner}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Dismiss install prompt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* iOS Safari Add to Home Screen Modal */}
      <Modal
        open={iosGuideOpen}
        onClose={() => setIosGuideOpen(false)}
        title="Install Personal OS on iPhone / iPad"
        description="Safari installs web apps directly from the Share menu."
        maxWidth="max-w-sm"
      >
        <div className="space-y-4 text-xs text-[var(--text-secondary)]">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <Share className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p>
              <strong className="text-[var(--text-primary)]">1. Tap the Share button</strong> at the
              bottom of Safari.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <PlusSquare className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p>
              <strong className="text-[var(--text-primary)]">
                2. Scroll down and tap &ldquo;Add to Home Screen&rdquo;
              </strong>
              , then tap <strong>Add</strong>.
            </p>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Personal OS will open full-screen from your home screen just like a native app.
          </p>
          <Button className="w-full" onClick={() => setIosGuideOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </PWAContext.Provider>
  );
}

