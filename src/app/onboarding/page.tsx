'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Sparkles, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { YouTubeIcon } from '@/components/icons/BrandIcons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GenreCard } from '@/components/onboarding/GenreCard';
import { YouTubeChannelCard } from '@/components/onboarding/YouTubeChannelCard';
import { useAuth } from '@/contexts/AuthContext';
import { APPLE_PODCAST_GENRES } from '@/types/apple-podcasts';
import { createLogger } from '@/lib/logger';

const log = createLogger('onboarding');

type Step = 'welcome' | 'youtube' | 'genres' | 'done';

interface YouTubeChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // YouTube state
  const [ytChannels, setYtChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [isLoadingYt, setIsLoadingYt] = useState(false);
  const [ytError, setYtError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [classifications, setClassifications] = useState<Record<string, string[]>>({});

  // Check if user signed in with Google OAuth
  const isGoogleUser = user?.app_metadata?.provider === 'google';

  const displayName = user?.user_metadata?.display_name
    || user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'there';

  // Fetch YouTube subscriptions and classify when entering youtube step
  useEffect(() => {
    if (step !== 'youtube') return;

    let cancelled = false;
    setIsLoadingYt(true);
    setYtError(false);

    (async () => {
      try {
        // Step 1: Fetch subscriptions
        const subsRes = await fetch('/api/youtube/subscriptions');
        const subsData = await subsRes.json();
        const subs: YouTubeChannel[] = subsData.subscriptions || [];

        if (cancelled) return;
        setYtChannels(subs);

        if (subs.length === 0) {
          setIsLoadingYt(false);
          return;
        }

        // Step 2: Classify channels against selected genres
        if (selectedGenres.size > 0) {
          try {
            const classifyRes = await fetch('/api/youtube/classify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channels: subs.map(ch => ({
                  channelId: ch.channelId,
                  title: ch.title,
                  description: ch.description,
                })),
                genres: Array.from(selectedGenres),
              }),
            });
            const classifyData = await classifyRes.json();

            if (cancelled) return;

            const classMap: Record<string, string[]> = classifyData.classifications || {};
            setClassifications(classMap);

            // Pre-select only matched channels
            const matched = new Set(
              subs
                .filter(ch => (classMap[ch.channelId] || []).length > 0)
                .map(ch => ch.channelId)
            );
            setSelectedChannels(matched);
          } catch {
            // Classification failed — fallback: select all
            if (!cancelled) {
              setSelectedChannels(new Set(subs.map(ch => ch.channelId)));
            }
          }
        } else {
          // No genres selected — select all
          setSelectedChannels(new Set(subs.map(ch => ch.channelId)));
        }
      } catch {
        if (!cancelled) setYtError(true);
      } finally {
        if (!cancelled) setIsLoadingYt(false);
      }
    })();

    return () => { cancelled = true; };
  }, [step]);

  const toggleGenre = (id: string) => {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  };

  const toggleAllChannels = () => {
    if (selectedChannels.size === ytChannels.length) {
      setSelectedChannels(new Set());
    } else {
      setSelectedChannels(new Set(ytChannels.map(ch => ch.channelId)));
    }
  };

  const handleImportAndContinue = async () => {
    setIsImporting(true);
    try {
      if (selectedChannels.size > 0) {
        const channelsToImport = ytChannels.filter(ch => selectedChannels.has(ch.channelId));
        posthog.capture('onboarding_step_completed', { step: 'youtube', channels_imported: channelsToImport.length, channels_available: ytChannels.length });
        log.info('Importing YouTube channels (background)', { count: channelsToImport.length });
        // Fire and forget — import runs on the server while user continues onboarding
        fetch('/api/youtube/subscriptions/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channels: channelsToImport }),
        })
          .then(res => res.json())
          .then(data => log.success('YouTube import completed', data))
          .catch(err => log.error('YouTube import error (background)', err));
      }
      // Save genres and mark onboarding complete — don't wait for import
      await saveAndFinish(Array.from(selectedGenres));
    } catch (err) {
      log.error('Error', err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSkip = async () => {
    posthog.capture('onboarding_skipped', { from_step: step });
    await saveAndFinish([]);
  };

  const handleFinishGenres = () => {
    posthog.capture('onboarding_step_completed', { step: 'genres', genre_count: selectedGenres.size });
    if (isGoogleUser) {
      setStep('youtube');
    } else {
      // Skip YouTube step for non-Google users
      saveAndFinish(Array.from(selectedGenres));
    }
  };

  const saveAndFinish = async (genres: string[]) => {
    setIsSaving(true);
    log.info('Saving genres + completing onboarding', { genreCount: genres.length });
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_genres: genres,
          onboarding_completed: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      const data = await res.json();
      log.success('Profile saved', { genres: data.profile?.preferred_genres });
      setStep('done');
      posthog.capture('onboarding_completed');
    } catch (error) {
      log.error('Error saving preferences', error);
      setSaveError('Failed to save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartExploring = () => {
    router.push('/discover');
  };

  const allSteps: Step[] = isGoogleUser
    ? ['welcome', 'genres', 'youtube', 'done']
    : ['welcome', 'genres', 'done'];

  const matchedChannels = ytChannels.filter(
    ch => (classifications[ch.channelId] || []).length > 0
  );
  const otherChannels = ytChannels.filter(
    ch => (classifications[ch.channelId] || []).length === 0
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {allSteps.map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step
                  ? 'w-8 bg-primary'
                  : i < allSteps.indexOf(step)
                    ? 'w-8 bg-primary/40'
                    : 'w-8 bg-muted'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                  <Headphones className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-3">
                  Welcome to Yedapo, {displayName}!
                </h1>
                <p className="text-muted-foreground text-lg mb-2">
                  AI-powered insights from podcasts and YouTube
                </p>
                <p className="text-muted-foreground mb-8">
                  Discover podcasts, get AI summaries, and never miss an insight.
                  Let&apos;s personalize your experience.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button onClick={() => { setStep('genres'); posthog.capture('onboarding_step_completed', { step: 'welcome' }); }} className="gap-2 min-w-[200px]">
                    <Sparkles className="h-4 w-4" />
                    Personalize My Feed
                  </Button>
                  <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
                    Skip for now
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'youtube' && (
            <motion.div
              key="youtube"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-4 sm:p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white ring-1 ring-black/5 shadow-sm mb-4">
                    <YouTubeIcon className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Import YouTube Channels</h2>
                  {!isLoadingYt && ytChannels.length > 0 && (
                    <p className="text-muted-foreground">
                      We found your YouTube subscriptions. Select channels to follow.
                    </p>
                  )}
                  {!isLoadingYt && ytChannels.length === 0 && !ytError && (
                    <p className="text-muted-foreground">
                      No YouTube subscriptions found on your account.
                    </p>
                  )}
                  {isLoadingYt && (
                    <p className="text-muted-foreground">
                      Checking your YouTube subscriptions...
                    </p>
                  )}
                </div>

                {isLoadingYt ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading and filtering your subscriptions...</p>
                  </div>
                ) : ytError || ytChannels.length === 0 ? (
                  <div className="text-center py-8">
                    {ytError && (
                      <p className="text-muted-foreground mb-2">Could not load YouTube subscriptions.</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      You can import YouTube channels later from Settings.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">
                        {selectedChannels.size} of {ytChannels.length} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllChannels}
                        className="text-xs"
                      >
                        {selectedChannels.size === ytChannels.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <div className="max-h-[340px] overflow-y-auto mb-6 pr-1 space-y-2">
                      {/* Matched channels */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchedChannels.map((channel) => (
                          <YouTubeChannelCard
                            key={channel.channelId}
                            channelId={channel.channelId}
                            name={channel.title}
                            thumbnailUrl={channel.thumbnailUrl}
                            description={channel.description}
                            selected={selectedChannels.has(channel.channelId)}
                            onToggle={toggleChannel}
                          />
                        ))}
                      </div>

                      {/* Divider — only show if both sections have content */}
                      {matchedChannels.length > 0 && otherChannels.length > 0 && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Other channels (not matched to your interests)
                          </span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}

                      {/* Other channels */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {otherChannels.map((channel) => (
                          <YouTubeChannelCard
                            key={channel.channelId}
                            channelId={channel.channelId}
                            name={channel.title}
                            thumbnailUrl={channel.thumbnailUrl}
                            description={channel.description}
                            selected={selectedChannels.has(channel.channelId)}
                            onToggle={toggleChannel}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setStep('genres')} className="gap-1">
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button variant="ghost" onClick={() => saveAndFinish(Array.from(selectedGenres))} disabled={isSaving}>
                      Skip
                    </Button>
                  </div>
                  <Button
                    onClick={handleImportAndContinue}
                    disabled={isImporting}
                    className="gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'genres' && (
            <motion.div
              key="genres"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-4 sm:p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">What topics interest you?</h2>
                  <p className="text-muted-foreground">
                    Select at least 3 for best recommendations
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                  {APPLE_PODCAST_GENRES.map((genre) => (
                    <GenreCard
                      key={genre.id}
                      id={genre.id}
                      name={genre.name}
                      selected={selectedGenres.has(genre.id)}
                      onToggle={toggleGenre}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setStep('welcome')} className="gap-1">
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
                      Skip
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedGenres.size} selected
                    </span>
                    <Button
                      onClick={handleFinishGenres}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6"
                >
                  <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
                </motion.div>
                <h2 className="text-3xl font-bold mb-3">You&apos;re all set!</h2>
                <p className="text-muted-foreground mb-4">
                  {selectedGenres.size > 0 || selectedChannels.size > 0
                    ? "We've personalized your discovery feed based on your selections."
                    : "You can always update your preferences in Settings."}
                </p>
                {(selectedGenres.size > 0 || selectedChannels.size > 0) && (
                  <div className="mb-8 inline-flex flex-col gap-1 text-sm text-muted-foreground bg-muted/50 rounded-lg px-5 py-3">
                    {selectedGenres.size > 0 && (
                      <span>
                        {selectedGenres.size} genre{selectedGenres.size !== 1 ? 's' : ''} selected
                      </span>
                    )}
                    {selectedChannels.size > 0 && (
                      <span>
                        {selectedChannels.size} YouTube channel{selectedChannels.size !== 1 ? 's' : ''} imported
                      </span>
                    )}
                  </div>
                )}
                {selectedGenres.size === 0 && selectedChannels.size === 0 && <div className="mb-4" />}
                <Button onClick={handleStartExploring} className="gap-2 min-w-[200px]">
                  Start Exploring
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {saveError && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <p className="text-sm text-destructive">{saveError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
