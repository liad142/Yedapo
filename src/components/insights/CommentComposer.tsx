"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

interface CommentComposerProps {
  onSubmit: (body: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function CommentComposer({
  onSubmit,
  placeholder = "Share your thoughts...",
  autoFocus = false,
  onCancel,
  isSubmitting = false,
}: CommentComposerProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || isSubmitting) return;
    await onSubmit(trimmed);
    setBody("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const trimmedLength = body.trim().length;

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={2}
        maxLength={2000}
        disabled={isSubmitting}
        className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-body text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 transition-colors"
      />
      <div className="flex items-center justify-between">
        <div className="text-caption text-muted-foreground">
          {trimmedLength > 1800 && (
            <span className={trimmedLength > 1950 ? "text-destructive" : ""}>
              {trimmedLength}/2000
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!trimmedLength || trimmedLength > 2000 || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {onCancel ? "Reply" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
