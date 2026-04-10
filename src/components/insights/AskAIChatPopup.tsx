"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Loader2, AlertCircle, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAskAI } from "@/contexts/AskAIContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerSafe } from "@/contexts/AudioPlayerContext";
import { useAskAIChat } from "@/hooks/useAskAIChat";
import { useUsage } from "@/contexts/UsageContext";

const SUGGESTED_QUESTIONS = [
  "What are the key takeaways?",
  "Summarize in 3 bullets",
  "Most surprising insight?",
];

/** Lightweight markdown: bold, italic, lists, blockquotes */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-3 my-1 text-muted-foreground italic">
          {formatInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          {formatInline(line.replace(/^[-*]\s/, ""))}
        </li>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal">
          {formatInline(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
      continue;
    }

    // Empty line = paragraph break
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular text
    elements.push(
      <p key={i} className="my-0.5">
        {formatInline(line)}
      </p>
    );
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
  // Bold + italic, bold, italic
  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("***") && part.endsWith("***")) {
      return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function AskAIChatPopup() {
  const { chatOpen, closeChat, episodeId } = useAskAI();
  const { user, setShowAuthModal } = useAuth();
  const { usage, incrementAskAi } = useUsage();
  const player = useAudioPlayerSafe();
  const playerActive = !!(player && player.currentTrack);
  const { messages, isStreaming, error, sendMessage, clearChat } = useAskAIChat(
    chatOpen && user ? episodeId : null,
    incrementAskAi
  );
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens (only for authenticated users)
  useEffect(() => {
    if (chatOpen && user) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatOpen, user]);

  // Escape key to close
  useEffect(() => {
    if (!chatOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChat();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [chatOpen, closeChat]);

  // Focus trap
  const popupRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const el = popupRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    posthog.capture('ask_ai_used', { episode_id: episodeId, question_length: input.trim().length });
    sendMessage(input);
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    posthog.capture('ask_ai_used', { episode_id: episodeId, question_length: q.length });
    sendMessage(q);
  };

  const handleClose = () => {
    closeChat();
  };

  // Bottom offset: account for player height
  const bottomOffset = playerActive ? "bottom-[180px]" : "bottom-[90px]";

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`fixed ${bottomOffset} left-4 right-4 z-[65] flex justify-center pointer-events-none`}
        >
          <div className="pointer-events-auto w-full max-w-xl" ref={popupRef} role="dialog" aria-label="Ask AI chat" onKeyDown={handleKeyDown}>
            <div className="bg-card/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 dark:border-white/10 overflow-hidden flex flex-col max-h-[60vh]">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="bg-primary rounded-full p-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-sm">Ask AI</span>
                </div>
                <div className="flex items-center gap-1">
                  {user && messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={clearChat}
                      title="Clear chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={handleClose}
                    aria-label="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Guest gated view */}
              {!user ? (
                <div className="px-4 py-6 space-y-5">
                  <div className="flex flex-col items-center text-center gap-2">
                    <p className="text-sm text-muted-foreground">Ask anything about this episode</p>
                    {/* Show suggested questions as visual preview (non-functional) */}
                    <div className="flex flex-wrap gap-2 justify-center">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <span
                          key={q}
                          className="px-3 py-1.5 text-xs rounded-full border border-border bg-muted/50 text-muted-foreground"
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sign up CTA */}
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="w-full h-px bg-border" />
                    <p className="text-xs text-muted-foreground">
                      Get AI-powered answers about any episode
                    </p>
                    <button
                      onClick={() => { closeChat(); setShowAuthModal(true, 'Sign up to ask AI about any podcast or YouTube video.'); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Sign up to use Ask AI
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[100px]">
                    {messages.length === 0 && !error && (
                      <div className="flex flex-col items-center justify-center py-6 gap-3">
                        <p className="text-sm text-muted-foreground">Ask anything about this episode</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {SUGGESTED_QUESTIONS.map((q) => (
                            <button
                              key={q}
                              onClick={() => handleSuggestion(q)}
                              className="px-3 py-1.5 text-xs rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors cursor-pointer"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/70 text-foreground rounded-bl-md"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="prose-sm prose-p:my-0.5 prose-li:my-0">
                              {msg.text ? renderMarkdown(msg.text) : (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                              {msg.isStreaming && msg.text && (
                                <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                              )}
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    ))}

                    {error && (
                      <div className="flex items-center gap-2 text-destructive text-xs px-3 py-2 bg-destructive/10 rounded-lg">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 px-3 py-2.5 border-t border-border/50"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question..."
                      disabled={isStreaming}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
                      maxLength={2000}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-full w-8 h-8 shrink-0"
                      disabled={!input.trim() || isStreaming}
                    >
                      {isStreaming ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
