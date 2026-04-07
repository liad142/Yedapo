"use client";

import { useState } from "react";
import posthog from "posthog-js";
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
  Download,
  Sparkles,
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
import { useUserPlan } from "@/hooks/useUserPlan";
import { TelegramConnectFlow } from "./TelegramConnectFlow";
import Link from "next/link";
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
  const { isPro } = useUserPlan();

  const [copied, setCopied] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
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
    posthog.capture('summary_shared', { method: 'copy_link', episode_id: episodeId });
    setCopied(true);
    showToast("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    posthog.capture('summary_shared', { method: 'whatsapp', episode_id: episodeId });
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
    posthog.capture('summary_shared', { method: 'telegram', episode_id: episodeId });
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

      posthog.capture('summary_shared', { method: 'email', episode_id: episodeId });
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

  /** Gate Pro-only actions: show upgrade dialog for non-Pro users */
  const requirePro = (action: () => void) => {
    if (isPro) {
      action();
      return;
    }
    setShowUpgradeDialog(true);
  };

  const handleDownloadMarkdown = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/episodes/${episodeId}/export`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 403) {
          setShowUpgradeDialog(true);
          return;
        }
        throw new Error(data?.error || 'Failed to export');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || 'summary.md';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      posthog.capture('summary_exported', { method: 'download_markdown', episode_id: episodeId });
      showToast("Summary downloaded");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to download");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!markdownContent) return;
    await navigator.clipboard.writeText(markdownContent);
    posthog.capture('summary_exported', { method: 'copy_markdown', episode_id: episodeId });
    setCopiedMarkdown(true);
    showToast("Markdown copied to clipboard");
    setTimeout(() => setCopiedMarkdown(false), 2000);
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
        <DropdownMenuContent align="start" className="w-60">
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

              {/* -- Export options (Pro only) -- */}
              <div className="h-px bg-border my-1" />

              <DropdownMenuItem
                onClick={() => requirePro(handleDownloadMarkdown)}
                disabled={isDownloading}
                className="gap-2 justify-between"
              >
                <span className={`flex items-center gap-2 ${!isPro ? 'text-muted-foreground' : ''}`}>
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isDownloading ? "Exporting..." : "Download as Markdown"}
                </span>
                {!isPro && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="h-2.5 w-2.5" />
                    Pro
                  </span>
                )}
              </DropdownMenuItem>

              {markdownContent && (
                <DropdownMenuItem
                  onClick={() => requirePro(handleCopyMarkdown)}
                  className="gap-2 justify-between"
                >
                  <span className={`flex items-center gap-2 ${!isPro ? 'text-muted-foreground' : ''}`}>
                    {copiedMarkdown ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {copiedMarkdown ? "Copied!" : "Copy Markdown"}
                  </span>
                  {!isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      <Sparkles className="h-2.5 w-2.5" />
                      Pro
                    </span>
                  )}
                </DropdownMenuItem>
              )}
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

      {/* Pro Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-sm p-6">
          <DialogClose onClick={() => setShowUpgradeDialog(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              Pro Feature
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporting summaries as Markdown is available on the Pro plan.
              Upgrade to download and copy summaries for Obsidian, Notion, or
              any markdown-based workflow.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full gap-2">
                <Link href="/pricing">
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowUpgradeDialog(false)}
                className="w-full text-muted-foreground"
              >
                Maybe later
              </Button>
            </div>
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
