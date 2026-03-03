"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { CommentComposer } from "./CommentComposer";
import type { EpisodeCommentWithAuthor } from "@/types/database";

interface CommentThreadProps {
  comment: EpisodeCommentWithAuthor;
  currentUserId?: string;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

export function CommentThread({ comment, currentUserId, onReply, onEdit, onDelete }: CommentThreadProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <CommentCard
        comment={comment}
        currentUserId={currentUserId}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
        isTopLevel
      />

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 border-l-2 border-border pl-4 space-y-1 mt-1">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              isTopLevel={false}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CommentCard({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  isTopLevel,
}: {
  comment: EpisodeCommentWithAuthor;
  currentUserId?: string;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  isTopLevel: boolean;
}) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const displayName = comment.author?.display_name || "Anonymous";
  const initial = displayName.charAt(0).toUpperCase();
  const replyTargetId = comment.parent_id || comment.id;

  const handleReply = async (body: string) => {
    setIsSubmitting(true);
    try {
      await onReply(replyTargetId, body);
      setShowReplyComposer(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (body: string) => {
    setIsSubmitting(true);
    try {
      await onEdit(comment.id, body);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={cn("rounded-xl p-4", isTopLevel ? "bg-card border border-border shadow-[var(--shadow-1)]" : "hover:bg-secondary/50")}>
      {/* Author row */}
      <div className="flex items-center gap-2 mb-2">
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.author.avatar_url}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{initial}</span>
          </div>
        )}
        <span className="text-sm font-semibold text-foreground">{displayName}</span>
        <span className="text-caption text-muted-foreground">
          {formatRelativeTime(comment.created_at)}
        </span>
        {comment.edited_at && (
          <span className="text-caption text-muted-foreground italic">(edited)</span>
        )}
      </div>

      {/* Body or edit mode */}
      {isEditing ? (
        <CommentComposer
          onSubmit={handleEdit}
          onCancel={() => setIsEditing(false)}
          placeholder="Edit your comment..."
          autoFocus
          isSubmitting={isSubmitting}
        />
      ) : (
        <p className="text-body text-muted-foreground whitespace-pre-line mb-2">
          {comment.body}
        </p>
      )}

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-1">
          {isTopLevel && currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground"
              onClick={() => setShowReplyComposer(!showReplyComposer)}
            >
              <MessageCircle className="h-3 w-3" />
              Reply
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              {showDeleteConfirm ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Delete?
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-destructive"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    No
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Inline reply composer */}
      <AnimatePresence>
        {showReplyComposer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3"
          >
            <CommentComposer
              onSubmit={handleReply}
              onCancel={() => setShowReplyComposer(false)}
              placeholder={`Reply to ${displayName}...`}
              autoFocus
              isSubmitting={isSubmitting}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
