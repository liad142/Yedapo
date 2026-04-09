"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import posthog from "posthog-js";
import {
  Share2,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Send,
  Loader2,
  FileText,
  Download,
  Sparkles,
  Link as LinkIcon,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { elevation } from "@/lib/elevation";
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

  const [open, setOpen] = useState(false);
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

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3000);
  }, []);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(currentUrl);
    posthog.capture("summary_shared", {
      method: "copy_link",
      episode_id: episodeId,
    });
    setCopied(true);
    showToast("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    posthog.capture("summary_shared", {
      method: "whatsapp",
      episode_id: episodeId,
    });
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
    setOpen(false);
  };

  const handleTelegram = () => {
    posthog.capture("summary_shared", {
      method: "telegram",
      episode_id: episodeId,
    });
    const text = `\u{1F399} ${episodeTitle} - ${podcastName}`;
    const url = encodeURIComponent(currentUrl);
    const encodedText = encodeURIComponent(text);
    window.open(
      `https://t.me/share/url?url=${url}&text=${encodedText}`,
      "_blank"
    );
    setOpen(false);
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
    setOpen(false);
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

      posthog.capture("summary_shared", {
        method: "email",
        episode_id: episodeId,
      });
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
      setOpen(false);
      return;
    }

    setIsSendingTelegram(true);
    try {
      const payload: SendNotificationPayload = {
        episodeId,
        channel: "telegram",
        recipient: "",
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
        err instanceof Error
          ? err.message
          : "Failed to send Telegram notification"
      );
    } finally {
      setIsSendingTelegram(false);
      setOpen(false);
    }
  };

  const handleTelegramConnected = () => {
    setTelegramConnected(true);
    setShowTelegramConnect(false);
    showToast("Telegram connected successfully");
  };

  const requirePro = (action: () => void) => {
    if (isPro) {
      action();
      return;
    }
    setOpen(false);
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
        throw new Error(data?.error || "Failed to export");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || "summary.md";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      posthog.capture("summary_exported", {
        method: "download_markdown",
        episode_id: episodeId,
      });
      showToast("Summary downloaded");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to download");
    } finally {
      setIsDownloading(false);
      setOpen(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!markdownContent) return;
    await navigator.clipboard.writeText(markdownContent);
    posthog.capture("summary_exported", {
      method: "copy_markdown",
      episode_id: episodeId,
    });
    setCopiedMarkdown(true);
    showToast("Markdown copied to clipboard");
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  // Truncated URL for display
  const displayUrl = currentUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const truncatedUrl =
    displayUrl.length > 36
      ? displayUrl.substring(0, 33) + "..."
      : displayUrl;

  return (
    <>
      {/* Trigger + Panel wrapper */}
      <div className="relative inline-block">
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          className={cn(
            "h-10 px-5 gap-2 rounded-full text-sm font-medium",
            open && "bg-secondary text-foreground"
          )}
          onClick={() => setOpen(!open)}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>

        {open && (
          <div
            ref={panelRef}
            className={cn(
              "absolute z-50 right-0 sm:left-0 top-full mt-2",
              "w-[min(calc(100vw-2rem),20rem)]",
              elevation.floating,
              "overflow-hidden",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
          >
            {summaryReady ? (
              <>
                {/* ── Share Section ── */}
                <div className="p-4 pb-3">
                  <p className="text-caption text-muted-foreground mb-3">
                    Share
                  </p>

                  {/* Copy link row */}
                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl p-2.5 -mx-0.5",
                      "transition-colors duration-150",
                      "hover:bg-secondary",
                      "group cursor-pointer"
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 flex items-center justify-center",
                        "h-10 w-10 rounded-xl",
                        "bg-secondary text-muted-foreground",
                        "group-hover:bg-primary/10 group-hover:text-primary",
                        "transition-colors duration-150"
                      )}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {copied ? "Copied!" : "Copy link"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {truncatedUrl}
                      </p>
                    </div>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  </button>

                  {/* Social share circles */}
                  <div className="flex items-center gap-2 mt-3">
                    {[
                      { label: 'WhatsApp', icon: MessageCircle, color: 'bg-[#25D366]/10 text-[#25D366]', hoverColor: 'group-hover:bg-[#25D366]/20', onClick: handleWhatsApp },
                      { label: 'Telegram', icon: Send, color: 'bg-[#229ED9]/10 text-[#229ED9]', hoverColor: 'group-hover:bg-[#229ED9]/20', onClick: handleTelegram },
                      { label: 'Email', icon: Mail, color: 'bg-primary/10 text-primary', hoverColor: 'group-hover:bg-primary/20', onClick: () => openEmailDialog(false) },
                    ].map((channel) => (
                      <button
                        key={channel.label}
                        onClick={() => isPro ? channel.onClick() : setShowUpgradeDialog(true)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 flex-1",
                          "group cursor-pointer"
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center",
                            "h-12 w-12 rounded-full mx-auto",
                            "transition-all duration-150",
                            "group-active:scale-95",
                            isPro
                              ? cn(channel.color, channel.hoverColor)
                              : "bg-muted/60 text-muted-foreground/40"
                          )}
                        >
                          {isPro ? (
                            <channel.icon className="h-5 w-5" />
                          ) : (
                            <Crown className="h-4 w-4 text-accent-amber" />
                          )}
                        </div>
                        <span className={cn(
                          "text-[11px] font-medium",
                          isPro ? "text-muted-foreground" : "text-muted-foreground/50"
                        )}>
                          {channel.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="h-px bg-border" />

                {/* ── Export Section ── */}
                <div className="p-4 pt-3 bg-primary-subtle">
                  <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-caption text-muted-foreground">
                      Export
                    </p>
                    {!isPro && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-amber-subtle px-2 py-0.5 text-[10px] font-semibold text-accent-amber">
                        <Crown className="h-2.5 w-2.5" />
                        Pro
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {/* Download Markdown */}
                    <button
                      onClick={() => requirePro(handleDownloadMarkdown)}
                      disabled={isDownloading}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5",
                        "transition-colors duration-150",
                        "hover:bg-secondary/80",
                        "group cursor-pointer",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center",
                          "h-9 w-9 rounded-lg",
                          isPro
                            ? "bg-secondary text-foreground"
                            : "bg-accent-amber-subtle text-accent-amber"
                        )}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isPro
                              ? "text-foreground"
                              : "text-foreground"
                          )}
                        >
                          {isDownloading
                            ? "Exporting..."
                            : "Download Markdown"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Save as .md file
                        </p>
                      </div>
                      {!isPro && (
                        <Sparkles className="h-3.5 w-3.5 text-accent-amber flex-shrink-0" />
                      )}
                    </button>

                    {/* Copy Markdown */}
                    {markdownContent && (
                      <button
                        onClick={() => requirePro(handleCopyMarkdown)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5",
                          "transition-colors duration-150",
                          "hover:bg-secondary/80",
                          "group cursor-pointer"
                        )}
                      >
                        <div
                          className={cn(
                            "flex-shrink-0 flex items-center justify-center",
                            "h-9 w-9 rounded-lg",
                            isPro
                              ? "bg-secondary text-foreground"
                              : "bg-accent-amber-subtle text-accent-amber"
                          )}
                        >
                          {copiedMarkdown ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-foreground">
                            {copiedMarkdown
                              ? "Copied!"
                              : "Copy Markdown"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Paste into Notion, Obsidian
                          </p>
                        </div>
                        {!isPro && (
                          <Sparkles className="h-3.5 w-3.5 text-accent-amber flex-shrink-0" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── Summary Not Ready: Notify Me ── */}
                <div className="p-4">
                  <p className="text-caption text-muted-foreground mb-3">
                    Get notified
                  </p>

                  <div className="space-y-1">
                    {/* Notify via Email */}
                    <button
                      onClick={() => openEmailDialog(true)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5",
                        "transition-colors duration-150",
                        "hover:bg-secondary",
                        "group cursor-pointer"
                      )}
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center",
                          "h-10 w-10 rounded-xl",
                          "bg-primary/10 text-primary"
                        )}
                      >
                        <Mail className="h-[18px] w-[18px]" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">
                          Notify via Email
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Get emailed when insights are ready
                        </p>
                      </div>
                    </button>

                    {/* Notify via Telegram */}
                    <button
                      onClick={handleTelegramNotify}
                      disabled={isSendingTelegram}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5",
                        "transition-colors duration-150",
                        "hover:bg-secondary",
                        "group cursor-pointer",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center",
                          "h-10 w-10 rounded-xl",
                          "bg-[#229ED9]/10 text-[#229ED9]"
                        )}
                      >
                        {isSendingTelegram ? (
                          <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        ) : (
                          <Send className="h-[18px] w-[18px]" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">
                          Notify via Telegram
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Get a message when ready
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-amber to-amber-600">
                <Crown className="h-4 w-4 text-white" />
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
