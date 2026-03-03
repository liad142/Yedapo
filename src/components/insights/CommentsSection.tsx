"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CommentComposer } from "./CommentComposer";
import { CommentThread } from "./CommentThread";
import type { EpisodeCommentWithAuthor } from "@/types/database";

interface CommentsSectionProps {
  episodeId: string;
}

export function CommentsSection({ episodeId }: CommentsSectionProps) {
  const { user, setShowAuthModal } = useAuth();
  const [comments, setComments] = useState<EpisodeCommentWithAuthor[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/episodes/${episodeId}/comments`);
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments || []);
      setTotal(data.total || 0);
    } catch {
      // Silently fail — comments are non-critical
    }
  }, [episodeId]);

  useEffect(() => {
    setIsLoading(true);
    fetchComments().finally(() => setIsLoading(false));
  }, [fetchComments]);

  const handleAddComment = async (body: string) => {
    if (!user) return;
    setIsSubmitting(true);

    // Optimistic: create a temporary comment
    const tempId = `temp-${Date.now()}`;
    const optimistic: EpisodeCommentWithAuthor = {
      id: tempId,
      episode_id: episodeId,
      user_id: user.id,
      parent_id: null,
      body,
      edited_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      },
      replies: [],
    };

    setComments((prev) => [optimistic, ...prev]);
    setTotal((prev) => prev + 1);

    try {
      const res = await fetch(`/api/episodes/${episodeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();
      // Replace optimistic comment with real one
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? data.comment : c))
      );
    } catch {
      // Revert optimistic update
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setTotal((prev) => prev - 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    if (!user) return;

    const optimisticReply: EpisodeCommentWithAuthor = {
      id: `temp-${Date.now()}`,
      episode_id: episodeId,
      user_id: user.id,
      parent_id: parentId,
      body,
      edited_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      },
    };

    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies || []), optimisticReply] }
          : c
      )
    );

    try {
      const res = await fetch(`/api/episodes/${episodeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId }),
      });

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();
      // Replace optimistic reply with real one
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: (c.replies || []).map((r) =>
                  r.id === optimisticReply.id ? data.comment : r
                ),
              }
            : c
        )
      );
    } catch {
      // Revert
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? {
                ...c,
                replies: (c.replies || []).filter(
                  (r) => r.id !== optimisticReply.id
                ),
              }
            : c
        )
      );
    }
  };

  const handleEdit = async (commentId: string, body: string) => {
    // Find the comment (could be top-level or a reply)
    const prev = comments;

    setComments((cs) =>
      cs.map((c) => {
        if (c.id === commentId) return { ...c, body, edited_at: new Date().toISOString() };
        if (c.replies?.some((r) => r.id === commentId)) {
          return {
            ...c,
            replies: c.replies!.map((r) =>
              r.id === commentId ? { ...r, body, edited_at: new Date().toISOString() } : r
            ),
          };
        }
        return c;
      })
    );

    try {
      const res = await fetch(`/api/episodes/${episodeId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) throw new Error("Failed");
    } catch {
      setComments(prev);
    }
  };

  const handleDelete = async (commentId: string) => {
    const prev = comments;

    // Remove from state (top-level or reply)
    setComments((cs) => {
      // Check if it's a top-level comment
      if (cs.some((c) => c.id === commentId)) {
        setTotal((t) => t - 1);
        return cs.filter((c) => c.id !== commentId);
      }
      // Otherwise it's a reply
      return cs.map((c) => ({
        ...c,
        replies: (c.replies || []).filter((r) => r.id !== commentId),
      }));
    });

    try {
      const res = await fetch(`/api/episodes/${episodeId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed");
    } catch {
      setComments(prev);
      setTotal(prev.length);
    }
  };

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-h2 text-foreground flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Discussion
          {total > 0 && (
            <Badge variant="secondary" className="text-caption">
              {total}
            </Badge>
          )}
        </h2>
      </div>

      {/* Composer or sign-up prompt */}
      {user ? (
        <div className="mb-6">
          <CommentComposer onSubmit={handleAddComment} isSubmitting={isSubmitting} />
        </div>
      ) : (
        <button
          onClick={() =>
            setShowAuthModal(true, "Sign up to join the discussion.")
          }
          className={cn(
            "flex items-center gap-2 text-sm text-primary font-medium hover:underline cursor-pointer mb-6"
          )}
        >
          <Lock className="h-3.5 w-3.5" />
          Sign up to join the discussion
        </button>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10">
          <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
