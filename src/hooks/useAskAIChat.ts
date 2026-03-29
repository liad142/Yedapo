"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import posthog from "posthog-js";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
}

const MAX_MESSAGES = 20;
const STORAGE_PREFIX = "askai-chat-";

function loadMessages(episodeId: string): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + episodeId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    // Strip any leftover streaming flags from a previous session
    return parsed.map((m) => ({ ...m, isStreaming: false }));
  } catch {
    return [];
  }
}

function saveMessages(episodeId: string, messages: Message[]) {
  try {
    // Only persist completed messages (not mid-stream)
    const toSave = messages.filter((m) => !m.isStreaming && m.text);
    localStorage.setItem(STORAGE_PREFIX + episodeId, JSON.stringify(toSave));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useAskAIChat(episodeId: string | null, onMessageSent?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load saved chat when episode changes
  useEffect(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setError(null);
    if (episodeId) {
      setMessages(loadMessages(episodeId));
    } else {
      setMessages([]);
    }
  }, [episodeId]);

  // Persist messages whenever they change (debounce-free since writes are small)
  useEffect(() => {
    if (episodeId && messages.length > 0) {
      saveMessages(episodeId, messages);
    }
  }, [episodeId, messages]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    if (episodeId) {
      localStorage.removeItem(STORAGE_PREFIX + episodeId);
    }
  }, [episodeId]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!episodeId || !question.trim() || isStreaming) return;

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      const sendStartTime = Date.now();

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        text: question.trim(),
      };

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "",
        isStreaming: true,
      };

      setMessages((prev) => {
        const next = [...prev, userMsg, assistantMsg];
        // Client-side limit
        if (next.length > MAX_MESSAGES) {
          return next.slice(next.length - MAX_MESSAGES);
        }
        return next;
      });

      setIsStreaming(true);

      try {
        // Build history from existing messages (exclude the new ones we just added)
        const history = messages
          .filter((m) => !m.isStreaming)
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("model" as const),
            text: m.text,
          }));

        const res = await fetch(`/api/episodes/${episodeId}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim(), history }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        onMessageSent?.();

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, text: m.text + parsed.text }
                      : m
                  )
                );
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }

        // Mark streaming complete
        setMessages((prev) => {
          const final = prev.find((m) => m.id === assistantMsg.id);
          if (final?.text) {
            posthog.capture('ask_ai_response', {
              episode_id: episodeId,
              response_length: final.text.length,
              duration_ms: Date.now() - sendStartTime,
            });
          }
          return prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
          );
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;

        const errorMsg = err instanceof Error ? err.message : "Something went wrong";
        setError(errorMsg);

        // Remove the empty assistant message on error
        setMessages((prev) => {
          const updated = prev.filter((m) => m.id !== assistantMsg.id);
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [episodeId, isStreaming, messages]
  );

  return { messages, isStreaming, error, sendMessage, clearChat };
}
