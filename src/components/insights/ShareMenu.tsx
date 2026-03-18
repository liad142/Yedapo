"use client";

import { useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Send,
  Bell,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { TelegramConnectFlow } from "./TelegramConnectFlow";
import type { SendNotificationPayload } from "@/types/notifications";

interface ShareMenuProps {
  episodeId: string;
  episodeTitle: string;
  podcastName: string;
  summaryReady: boolean;
  markdownContent?: string;
}

export function ShareMenu({
  episodeId,
  episodeTitle,
  podcastName,
  summaryReady,
  markdownContent,
}: ShareMenuProps) {
  const { user, setShowAuthModal } = useAuth();

  const [copied, setCopied] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);

  // Telegram connect flow state
  const [showTelegramConnect, setShowTelegramConnect] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    // Build a client-side message (the server format-message uses DB queries, not suitable here)
    const lines = [
      `\u{1F399} ${episodeTitle} - ${podcastName}`,
      "",
      `Read full insights \u{1F447}`,
      currentUrl,
    ];
    const message = lines.join("\n");
    const truncated =
      message.length > 1000 ? message.substring(0, 997) + "..." : message;
    const encoded = encodeURIComponent(truncated);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleTelegram = () => {
    const text = `\u{1F399} ${episodeTitle} - ${podcastName}`;
    const url = encodeURIComponent(currentUrl);
    const encodedText = encodeURIComponent(text);
    window.open(
      `https://t.me/share/url?url=${url}&text=${encodedText}`,
      "_blank"
    );
  };

  const openEmailDialog = (scheduled: boolean) => {
    if (!user) {
      setShowAuthModal(
        true,
        scheduled
          ? "Sign up to get notified when insights are ready"
          : "Sign up to share via email"
      );
      return;
    }
    setIsScheduled(scheduled);
    setEmailInput(user.email || "");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim()) return;

    setIsSending(true);
    try {
      const payload: SendNotificationPayload = {
        episodeId,
        channel: "email",
        recipient: emailInput.trim(),
        scheduled: isScheduled,
      };

      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send");
      }

      setEmailDialogOpen(false);
      showToast(
        isScheduled
          ? "You'll be notified when insights are ready"
          : "Email sent successfully"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to send email"
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleTelegramNotify = async () => {
    if (!user) {
      setShowAuthModal(true, "Sign up to get Telegram notifications");
      return;
    }

    if (!telegramConnected) {
      setShowTelegramConnect(true);
      return;
    }

    // User has telegram connected, schedule the notification
    setIsSendingTelegram(true);
    try {
      const payload: SendNotificationPayload = {
        episodeId,
        channel: "telegram",
        recipient: "", // Server resolves from telegram_connections
        scheduled: !summaryReady,
      };

      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send");
      }

      showToast(
        summaryReady
          ? "Sent to your Telegram"
          : "You'll be notified on Telegram when ready"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to send Telegram notification"
      );
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleTelegramConnected = () => {
    setTelegramConnected(true);
    setShowTelegramConnect(false);
    showToast("Telegram connected successfully");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-4 gap-2 text-muted-foreground"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {summaryReady ? (
            <>
              {/* -- Summary ready: share now options -- */}
              <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy link"}
              </DropdownMenuItem>

              {markdownContent && (
                <DropdownMenuItem
                  onClick={async () => {
                    await navigator.clipboard.writeText(markdownContent);
                    showToast("Markdown copied to clipboard");
                  }}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Copy as Markdown
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleWhatsApp} className="gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleTelegram} className="gap-2">
                <Send className="h-4 w-4" />
                Telegram
              </DropdownMenuItem>

              <div className="h-px bg-border my-1" />

              <DropdownMenuItem
                onClick={() => openEmailDialog(false)}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Send via Email
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {/* -- Summary not ready: schedule notifications -- */}
              <DropdownMenuItem
                onClick={() => openEmailDialog(true)}
                className="gap-2"
              >
                <Bell className="h-4 w-4" />
                Notify via Email when ready
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleTelegramNotify}
                disabled={isSendingTelegram}
                className="gap-2"
              >
                {isSendingTelegram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Notify via Telegram when ready
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => setEmailDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>
              {isScheduled ? "Get notified via email" : "Send via email"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {isScheduled
                ? "We'll email you when insights for this episode are ready."
                : `Share insights for "${episodeTitle}" via email.`}
            </p>
            <Input
              type="email"
              placeholder="Enter email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
            />
            <Button
              onClick={handleSendEmail}
              disabled={isSending || !emailInput.trim()}
              className="w-full gap-2"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {isSending
                ? "Sending..."
                : isScheduled
                  ? "Notify me"
                  : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Telegram Connect Dialog */}
      <Dialog open={showTelegramConnect} onOpenChange={setShowTelegramConnect}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => setShowTelegramConnect(false)} />
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <TelegramConnectFlow onConnected={handleTelegramConnected} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast feedback */}
      <Toast open={toastOpen} onOpenChange={setToastOpen}>
        <p className="text-sm font-medium">{toastMessage}</p>
      </Toast>
    </>
  );
}
