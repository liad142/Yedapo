'use client';

import { useState } from 'react';
import { Loader2, Pencil, Check, X } from 'lucide-react';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import type { UserProfile } from './types';

interface AccountCardProps {
  profile: UserProfile | null;
  onProfileChange: (profile: UserProfile) => void;
  onError?: (message: string) => void;
}

export function AccountCard({ profile, onProfileChange, onError }: AccountCardProps) {
  const { user } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    '';

  const initials = (displayName || '?').slice(0, 2).toUpperCase();

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setIsSavingName(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: nameInput.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        onProfileChange(d.profile);
        setEditingName(false);
        posthog.capture('profile_updated', { field: 'display_name' });
      } else {
        onError?.('Failed to save name.');
      }
    } catch {
      onError?.('Failed to save name.');
    } finally {
      setIsSavingName(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0 select-none">
        {initials}
      </div>
      <div className="min-w-0">
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Display name"
              className="h-8 text-sm max-w-[180px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
            <button
              onClick={handleSaveName}
              disabled={isSavingName}
              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            >
              {isSavingName ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">{displayName}</span>
            <button
              onClick={() => {
                setNameInput(displayName);
                setEditingName(true);
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-sm text-muted-foreground truncate mt-0.5">{user.email}</p>
      </div>
    </div>
  );
}
