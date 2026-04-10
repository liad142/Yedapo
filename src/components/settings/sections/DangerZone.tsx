'use client';

import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { FieldLabel } from './SectionLabel';

interface DangerZoneProps {
  onError?: (message: string) => void;
}

export function DangerZone({ onError }: DangerZoneProps) {
  const { signOut } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account');
      }
      posthog.capture('account_deleted');
      await signOut();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete account. Please try again.';
      onError?.(message);
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <>
      <div className="pt-2 border-t border-border">
        <FieldLabel>Danger Zone</FieldLabel>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button
          variant="outline"
          onClick={() => setShowDeleteDialog(true)}
          className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" />
          Delete My Account
        </Button>
      </div>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeleteConfirmText('');
        }}
      >
        <DialogContent className="max-w-sm p-6">
          <DialogClose
            onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmText('');
            }}
          />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4">
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                This will permanently delete your account and all associated data including your
                profile, subscriptions, summaries, and listening history.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Type{' '}
                <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-destructive">
                  DELETE
                </span>{' '}
                to confirm
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1"
                disabled={isDeletingAccount}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {isDeletingAccount ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Forever
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
