"use client";

import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

export default function OfflinePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
          <WifiOff className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">You&apos;re currently offline</h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          PERSONAL OS couldn&apos;t reach the network right now. Reconnect to sync your Firestore
          workspace and use Groq AI features.
        </p>
        <Button onClick={() => window.location.reload()} className="w-full">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </Card>
    </div>
  );
}

