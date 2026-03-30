'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import posthog from 'posthog-js';
import { createClient } from '@/lib/supabase/client';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signUpOrIn: (email: string, password: string, displayName?: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean, message?: string) => void;
  authPromptMessage: string | null;
  showCompactPrompt: boolean;
  setShowCompactPrompt: (show: boolean, message?: string) => void;
  compactPromptMessage: string | null;
  guestGateTab: 'my-list' | 'summaries' | 'settings' | null;
  setGuestGateTab: (tab: 'my-list' | 'summaries' | 'settings' | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const supabase = createClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModalState, setShowAuthModalState] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [showCompactPromptState, setShowCompactPromptState] = useState(false);
  const [compactPromptMessage, setCompactPromptMessage] = useState<string | null>(null);
  const [guestGateTab, setGuestGateTabState] = useState<'my-list' | 'summaries' | 'settings' | null>(null);

  const setShowAuthModal = useCallback((show: boolean, message?: string) => {
    setShowAuthModalState(show);
    setAuthPromptMessage(message || null);
    if (show) posthog.capture('auth_modal_opened', { message: message || null });
  }, []);

  const setShowCompactPrompt = useCallback((show: boolean, message?: string) => {
    setShowCompactPromptState(show);
    setCompactPromptMessage(message || null);
  }, []);

  const setGuestGateTab = useCallback((tab: 'my-list' | 'summaries' | 'settings' | null) => {
    setGuestGateTabState(tab);
    if (tab) posthog.capture('guest_gate_shown', { tab });
  }, []);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch {
        // Session fetch failed (network, expired token, etc.) — treat as logged out
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        // Detect new Google sign-ups: user created within the last 60 seconds
        if (event === 'SIGNED_IN' && newSession?.user) {
          const createdAt = new Date(newSession.user.created_at).getTime();
          const isNewUser = Date.now() - createdAt < 60_000;
          const provider = newSession.user.app_metadata?.provider;
          if (isNewUser && provider === 'google') {
            posthog.capture('auth_signed_up', { provider: 'google' });
          }
        }

        // Only update session/user state if identity actually changed — avoids
        // unnecessary re-renders from TOKEN_REFRESHED events that create
        // new object references with the same data.
        setSession(prev => {
          if (prev?.access_token === newSession?.access_token) return prev;
          return newSession;
        });
        setUser(prev => {
          const newUser = newSession?.user ?? null;
          if (prev?.id === newUser?.id) return prev;
          return newUser;
        });
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      posthog.capture('auth_sign_in_failed', { provider: 'email', error: error.message });
      return { error: error.message };
    }
    posthog.capture('auth_signed_in', { provider: 'email' });
    setShowAuthModal(false);
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) {
      posthog.capture('auth_sign_up_failed', { provider: 'email', error: error.message });
      return { error: error.message, needsConfirmation: false };
    }
    // needsConfirmation = true when Supabase requires email verification (session is null until confirmed)
    const needsConfirmation = !data.session;
    posthog.capture('auth_signed_up', { provider: 'email', needs_confirmation: needsConfirmation });
    return { error: null, needsConfirmation };
  }, []);

  // Tries signUp first; if the user already exists, falls back to signIn automatically
  const signUpOrIn = useCallback(async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    // User already exists — Supabase may return an error or a fake success with empty identities
    const alreadyExists =
      error?.message.toLowerCase().includes('already registered') ||
      error?.message.toLowerCase().includes('already been registered') ||
      (!error && data.user && data.user.identities?.length === 0);

    if (alreadyExists) {
      const signInResult = await supabase.auth.signInWithPassword({ email, password });
      if (signInResult.error) {
        posthog.capture('auth_sign_in_failed', { provider: 'email', error: signInResult.error.message });
        return { error: signInResult.error.message, needsConfirmation: false };
      }
      posthog.capture('auth_signed_in', { provider: 'email', was_existing_user: true });
      setShowAuthModal(false);
      return { error: null, needsConfirmation: false };
    }

    if (error) {
      return { error: error.message, needsConfirmation: false };
    }

    const needsConfirmation = !data.session;
    if (data.session) { setShowAuthModal(false); }
    return { error: null, needsConfirmation };
  }, [setShowAuthModal]);

  const signInWithGoogle = useCallback(async () => {
    posthog.capture('auth_google_started');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      posthog.capture('auth_sign_in_failed', { provider: 'google', error: error.message });
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    posthog.capture('auth_signed_out');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signUpOrIn,
    signInWithGoogle,
    signOut,
    showAuthModal: showAuthModalState,
    setShowAuthModal,
    authPromptMessage,
    showCompactPrompt: showCompactPromptState,
    setShowCompactPrompt,
    compactPromptMessage,
    guestGateTab,
    setGuestGateTab,
  }), [user, session, isLoading, signIn, signUp, signUpOrIn, signInWithGoogle, signOut, showAuthModalState, setShowAuthModal, authPromptMessage, showCompactPromptState, setShowCompactPrompt, compactPromptMessage, guestGateTab, setGuestGateTab]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
