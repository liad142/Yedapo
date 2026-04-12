"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { TelegramIcon } from "@/components/icons/BrandIcons";
import { Button } from "@/components/ui/button";

interface TelegramConnectFlowProps {
  onConnected: () => void;
}

export function TelegramConnectFlow({ onConnected }: TelegramConnectFlowProps) {
  const [step, setStep] = useState<"idle" | "linking" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setStep("linking");
    setError(null);

    try {
      const res = await fetch("/api/notifications/telegram/connect", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start Telegram connection");
      }

      const data = await res.json();

      if (data.botLink) {
        window.open(data.botLink, "_blank");
      }

      setStep("verifying");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStep("idle");
    }
  };

  const handleVerify = async () => {
    setError(null);

    try {
      const res = await fetch("/api/notifications/telegram/connect");

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Verification failed");
      }

      const data = await res.json();

      if (data.connected) {
        onConnected();
      } else {
        setError(
          "Connection not detected yet. Make sure you clicked Start in the Telegram bot."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  if (step === "idle") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Connect your Telegram account to receive notifications directly in
          Telegram.
        </p>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <Button onClick={handleConnect} className="w-full gap-2">
          <TelegramIcon className="h-4 w-4" />
          Connect Telegram
        </Button>
      </div>
    );
  }

  if (step === "linking") {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // step === "verifying"
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-secondary p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ExternalLink className="h-4 w-4" />
          Telegram bot opened in a new tab
        </div>
        <ol className="text-sm text-slate-500 space-y-1 list-decimal list-inside">
          <li>Click <strong>Start</strong> in the Telegram bot</li>
          <li>Come back here and click verify</li>
        </ol>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button onClick={handleVerify} className="w-full gap-2">
        <CheckCircle2 className="h-4 w-4" />
        I've connected - Verify
      </Button>
    </div>
  );
}
