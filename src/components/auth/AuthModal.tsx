'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

/** Map common Supabase error messages to user-friendly text */
function friendlyError(msg: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Check your email and password and try again.',
    'Email not confirmed': 'Please check your email and confirm your account first.',
    'User already registered': 'Check your email and password and try again.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'Email rate limit exceeded': 'Too many attempts. Please wait a moment and try again.',
  };
  return map[msg] || msg;
}

export function AuthModal() {
  const { showAuthModal, setShowAuthModal, signUpOrIn, signInWithGoogle, authPromptMessage } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setSuccessMessage(null);
    setIsLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setShowAuthModal(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const result = await signUpOrIn(email, password);
      if (result.error) {
        setError(result.error);
      } else if (result.needsConfirmation) {
        setSuccessMessage('Check your email for a confirmation link!');
      } else {
        // Signed in — check if onboarding already done
        setShowAuthModal(false);
        try {
          const res = await fetch('/api/user/profile');
          const { profile } = await res.json();
          router.push(profile?.onboarding_completed ? '/discover' : '/onboarding');
        } catch {
          router.push('/onboarding');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccessMessage('Password reset link sent! Check your email.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
        <DialogClose onClick={() => handleClose(false)} />

        <div className="p-6">
          <DialogHeader className="p-0 mb-6">
            <DialogTitle className="text-xl text-center">
              Sign In or Create Account
            </DialogTitle>
          </DialogHeader>

          {/* Prompt Message */}
          {authPromptMessage && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {authPromptMessage}
                </p>
              </div>
            </div>
          )}

          {/* Google OAuth */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogleSignIn}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label htmlFor="auth-email" className="sr-only">Email</label>
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <label htmlFor="auth-password" className="sr-only">Password</label>
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="auth-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-9"
                autoComplete="new-password"
              />
            </div>

            <div className="text-right">
              <a
                href="/auth/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  handleForgotPassword();
                }}
              >
                Forgot password?
              </a>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center" role="alert">{friendlyError(error)}</p>
            )}

            {successMessage && (
              <p className="text-sm text-green-600 dark:text-green-400 text-center" role="status">{successMessage}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Continue
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
