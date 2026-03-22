"use client";

import { useState, useEffect, useCallback, useMemo, memo, RefObject } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Loader2, Sparkles, FileText, Lightbulb, ListMusic, Scale, Play, ChevronDown, ChevronsUpDown, ChevronsDownUp, Quote, Lock, Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TranscriptAccordion } from "./TranscriptAccordion";
import { ActionFooter } from "./ActionFooter";
import { AskAIBar } from "./AskAIBar";
import { useActivateAskAI } from "@/contexts/AskAIContext";
import { useAudioPlayerSafe } from "@/contexts/AudioPlayerContext";
import { ShareMenu } from "./ShareMenu";
import { summaryToMarkdown } from "@/lib/summary-to-markdown";
import { normalizeChronologicalSections, hasRealTimestamps, parseHighlightMarkers } from "@/lib/summary-normalize";
import { cn } from "@/lib/utils";
import { isRTLText } from "@/lib/rtl";
import { AnimatePresence } from "framer-motion";
import type { Episode, Podcast, EpisodeInsightsResponse, DeepSummaryContent, QuickSummaryContent, ChronologicalSection, YouTubeMetadataResponse } from "@/types/database";
import type { YouTubeEmbedRef } from "@/components/YouTubeEmbed";
import { isYouTubeContent } from "@/lib/youtube/utils";
import { useUserPlan } from "@/hooks/useUserPlan";
import { PaywallOverlay } from "@/components/PaywallOverlay";
import { DescriptionLinks } from "./DescriptionLinks";
import { PinnedComment } from "./PinnedComment";
import { CommentsSection } from "./CommentsSection";
import { RelatedEpisodes } from "./RelatedEpisodes";
import { parseStoryboardSpec, getFrameUrlForTimestamp } from "@/lib/youtube/storyboards";

interface EpisodeSmartFeedProps {
  episode: Episode & { podcast?: Podcast };
  youtubePlayerRef?: RefObject<YouTubeEmbedRef | null>;
  videoCurrentTime?: number;
  onSummaryData?: (data: { quick?: QuickSummaryContent | null; deep?: DeepSummaryContent | null; summaryReady: boolean }) => void;
}

export const EpisodeSmartFeed = memo(function EpisodeSmartFeed({ episode, youtubePlayerRef, videoCurrentTime, onSummaryData }: EpisodeSmartFeedProps) {
  const { user, setShowCompactPrompt, setShowAuthModal } = useAuth();
  const { cutoffs, isGuest } = useUserPlan();
  const [data, setData] = useState<EpisodeInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isYouTube = isYouTubeContent(episode.podcast);

  // Build track with chapters from deep summary (only for authenticated users)
  const track = useMemo(() => {
    if (!episode.audio_url || isYouTube) return undefined;
    let chapters: { title: string; timestamp: string; timestamp_seconds: number }[] | undefined;

    if (user) {
      const deepContent = data?.summaries?.deep?.content as DeepSummaryContent | undefined;
      const sections = deepContent?.chronological_breakdown;
      if (sections) {
        const normalized = normalizeChronologicalSections(sections);
        if (hasRealTimestamps(normalized)) {
          chapters = normalized
            .filter((s) => (s.timestamp_seconds ?? 0) >= 0 && s.timestamp)
            .map((s) => ({
              title: s.title || s.timestamp_description || 'Untitled',
              timestamp: s.timestamp!,
              timestamp_seconds: s.timestamp_seconds!,
            }));
        }
      }
    }

    return {
      id: episode.id,
      title: episode.title,
      artist: episode.podcast?.title || 'Unknown Podcast',
      artworkUrl: episode.podcast?.image_url || '',
      audioUrl: episode.audio_url,
      duration: episode.duration_seconds ?? undefined,
      chapters,
    };
  }, [episode, data?.summaries?.deep, user, isYouTube]);

  // Signal to the global AskAI context that we're on an insights page
  useActivateAskAI(episode.id);

  // Inject chapters into an already-playing track when data loads
  const player = useAudioPlayerSafe();
  useEffect(() => {
    if (!player || !track?.chapters?.length) return;
    if (player.currentTrack?.id === episode.id && !player.currentTrack.chapters?.length) {
      player.updateTrackMeta({ chapters: track.chapters });
    }
  }, [player, track?.chapters, episode.id]);

  // Fetch insights data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/episodes/${episode.id}/insights`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      const json = await res.json();
      setData(json);
      setError(null);

      // Notify parent about summary data for ShareMenu / ExportCard
      const quickContent = json.summaries?.quick?.content as QuickSummaryContent | undefined;
      const deepContent = json.summaries?.deep?.content as DeepSummaryContent | undefined;
      const hasSummary = json.summaries?.quick?.status === 'ready' || json.summaries?.deep?.status === 'ready';
      onSummaryData?.({ quick: quickContent ?? null, deep: deepContent ?? null, summaryReady: hasSummary });

      const insightStatus = json.insights?.status;
      const isProcessing = ["queued", "transcribing", "summarizing"].includes(insightStatus);
      setIsGenerating(isProcessing);

      return json;
    } catch (err) {
      console.error("Error fetching insights:", err);
      setError("Failed to load insights");
      return null;
    }
  }, [episode.id]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode.id]);

  // Poll while deep/insights are still generating (triggered server-side by YouTube summary flow)
  useEffect(() => {
    if (!data) return;
    const deepPending = data.summaries?.deep?.status && ['queued', 'transcribing', 'summarizing'].includes(data.summaries.deep.status);
    const insightsPending = data.insights?.status && ['queued', 'transcribing', 'summarizing'].includes(data.insights.status);
    if (deepPending || insightsPending) {
      setIsGenerating(true);
    }
  }, [data]);

  // Polling while generating (max 3 minutes)
  useEffect(() => {
    if (!isGenerating) return;

    let delay = 3000;
    let timeoutId: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 180_000; // 3 minute max

    const poll = () => {
      if (Date.now() > deadline) {
        setIsGenerating(false);
        return; // Silently stop — whatever loaded is shown
      }
      fetchData().then((json) => {
        if (json) {
          const insightsStatus = json.insights?.status;
          const deepStatus = json.summaries?.deep?.status;
          const inProgress = (s: string | undefined) =>
            s && ["queued", "transcribing", "summarizing"].includes(s);
          if (!inProgress(insightsStatus) && !inProgress(deepStatus)) {
            setIsGenerating(false);
            return;
          }
        }
        delay = Math.min(delay * 1.3, 10000);
        timeoutId = setTimeout(poll, delay);
      });
    };

    timeoutId = setTimeout(poll, delay);
    return () => clearTimeout(timeoutId);
  }, [isGenerating, fetchData]);

  // Generate insights
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const insightsRes = await fetch(`/api/episodes/${episode.id}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!insightsRes.ok) throw new Error("Failed to start insights generation");

      // Wait for insights response to confirm episode exists before firing summary POSTs
      await insightsRes.json().catch(() => ({}));

      await Promise.all([
        fetch(`/api/episodes/${episode.id}/summaries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: "quick" }),
        }),
        fetch(`/api/episodes/${episode.id}/summaries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: "deep" }),
        }),
      ]).catch(() => {});

      await fetchData();
    } catch (err) {
      console.error("Error generating insights:", err);
      setError("Failed to generate insights");
      setIsGenerating(false);
    }
  };

  // Extract data for sections
  const quickContent = data?.summaries?.quick?.content as QuickSummaryContent | undefined;
  const deepContent = data?.summaries?.deep?.content as DeepSummaryContent | undefined;
  const isQuickReady = data?.summaries?.quick?.status === "ready" && quickContent;
  const isDeepReady = data?.summaries?.deep?.status === "ready" && deepContent;
  const hasAnyContent = data?.insights || data?.transcript_text || data?.summaries?.quick || data?.summaries?.deep;
  const ytMeta = data?.youtube_metadata as YouTubeMetadataResponse | undefined;

  const summaryReady = !!(isQuickReady || isDeepReady);

  // Markdown for export card
  const markdownForExport = useMemo(() => {
    if (!summaryReady) return undefined;
    return summaryToMarkdown({
      episodeTitle: episode.title,
      podcastName: episode.podcast?.title || 'Unknown Podcast',
      publishedAt: episode.published_at,
      durationSeconds: episode.duration_seconds,
      quickSummary: quickContent,
      deepSummary: deepContent,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }, [episode, quickContent, deepContent, summaryReady]);

  // RTL detection
  const isRTL = useMemo(() => {
    const textToCheck = quickContent?.executive_brief || quickContent?.hook_headline ||
      deepContent?.comprehensive_overview || episode.description || "";
    return isRTLText(textToCheck);
  }, [quickContent, deepContent, episode.description]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading insights...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!hasAnyContent && !isGenerating) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md space-y-6 p-8"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Unlock Episode Insights</h2>
            <p className="text-muted-foreground">
              Get AI-powered summaries, key quotes, mindmaps, and a searchable transcript.
            </p>
          </div>
          {user ? (
            <Button onClick={handleGenerate} size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              Generate Insights
            </Button>
          ) : (
            <Button
              onClick={() => setShowCompactPrompt(true, 'Sign up to generate AI insights, summaries, and transcripts for any episode.')}
              size="lg"
              className="gap-2"
            >
              <Lock className="h-5 w-5" />
              Sign up to Generate Insights
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            This may take a few minutes depending on episode length
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Generation Status Banner */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 p-3 bg-primary/10 backdrop-blur-sm border-b"
        >
          <div className="flex items-center justify-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {data?.transcript_status === "transcribing"
                ? "Transcribing audio..."
                : data?.insights?.status === "summarizing"
                  ? "Generating insights with AI..."
                  : "Processing..."}
            </span>
          </div>
        </motion.div>
      )}

      {/* Main Feed — Linear sections */}
      <div className="pb-28 space-y-10 max-w-3xl mx-auto px-4 md:px-0">

        {/* --- Section 1: Teaser Card --- */}
        {isQuickReady && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {user ? (
              <TeaserCard content={quickContent!} isRTL={isRTL} />
            ) : (
              <GuestTeaserCard content={quickContent!} isRTL={isRTL} />
            )}
          </motion.section>
        )}

        {/* --- Sections 2-7: Auth-gated with real content preview for guests --- */}
        {!user && hasAnyContent ? (
          <>
            {/* CTA card — scrolls naturally, visible at the top then gone */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/20 p-6 text-center space-y-4 max-w-sm mx-auto">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-foreground">Unlock Full Insights</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sign up to read the full analysis, chapters, key concepts, transcript, and Ask AI.
                  </p>
                </div>
                <button
                  onClick={() => setShowAuthModal(true, 'Sign up to explore full insights, chapters, and AI-powered episode analysis.')}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer mx-auto"
                >
                  <Lock className="h-4 w-4" />
                  Sign up for free
                </button>
              </div>
            </motion.section>

            {/* Blurred real content — tap anywhere to open auth modal */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="relative overflow-hidden">
                {/* Real content rendered behind a blur */}
                <div className="select-none blur-[4px] opacity-60 space-y-10" aria-hidden>
                  {isDeepReady && deepContent!.comprehensive_overview && (
                    <div dir={isRTL ? "rtl" : "ltr"}>
                      <ComprehensiveOverview text={deepContent!.comprehensive_overview} isRTL={isRTL} label={deepContent!.section_labels?.comprehensive_overview} />
                    </div>
                  )}

                  {isDeepReady && deepContent!.core_concepts?.length > 0 && (
                    <div dir={isRTL ? "rtl" : "ltr"}>
                      <CoreConcepts concepts={deepContent!.core_concepts} isRTL={isRTL} label={deepContent!.section_labels?.core_concepts} />
                    </div>
                  )}

                  {isDeepReady && deepContent!.chronological_breakdown?.length > 0 && (
                    <div dir={isRTL ? "rtl" : "ltr"}>
                      <EpisodeChapters
                        sections={deepContent!.chronological_breakdown}
                        isRTL={isRTL}
                        episode={episode}
                        youtubePlayerRef={youtubePlayerRef}
                        videoCurrentTime={videoCurrentTime}
                        creatorChapters={ytMeta?.chapters}
                        storyboardSpec={ytMeta?.storyboard_spec ?? undefined}
                        label={deepContent!.section_labels?.episode_flow}
                      />
                    </div>
                  )}

                  {isDeepReady && deepContent!.contrarian_views?.length > 0 && (
                    <div dir={isRTL ? "rtl" : "ltr"}>
                      <ContrarianViews views={deepContent!.contrarian_views} isRTL={isRTL} label={deepContent!.section_labels?.counterpoints} subtitle={deepContent!.section_labels?.counterpoints_subtitle} />
                    </div>
                  )}

                  <div>
                    <TranscriptAccordion
                      transcript={data?.transcript_text}
                      transcriptStatus={data?.transcript_status || "not_started"}
                      isGenerating={false}
                      onGenerate={() => {}}
                      sectionLabel={deepContent?.section_labels?.transcript}
                      isRTL={isRTL}
                    />
                  </div>

                  <div>
                    <ActionFooter
                      episode={episode}
                      actionPrompts={deepContent?.actionable_takeaways}
                      summaryReady={data?.summaries?.quick?.status === 'ready' || data?.summaries?.deep?.status === 'ready'}
                      sectionLabel={deepContent?.section_labels?.action_items}
                      isRTL={isRTL}
                    />
                  </div>
                </div>

                {/* Clickable overlay — tap anywhere on blurred content to sign up */}
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={() => setShowAuthModal(true, 'Sign up to explore full insights, chapters, and AI-powered episode analysis.')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowAuthModal(true, 'Sign up to explore full insights, chapters, and AI-powered episode analysis.'); }}
                  aria-label="Sign up to unlock full insights"
                />
              </div>
            </motion.section>
          </>
        ) : user ? (
          <>
            {/* --- Section 1.5: Description Links (YouTube only) — hidden for now --- */}
            {/* {isYouTube && ytMeta && ytMeta.description_links.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.03 }}
              >
                <DescriptionLinks links={ytMeta.description_links} isRTL={isRTL} />
              </motion.section>
            )} */}

            {/* --- Generate Insights CTA (when only quick summary exists) --- */}
            {!isDeepReady && !isGenerating && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.05 }}
              >
                <div className="text-center max-w-md mx-auto space-y-6 py-8">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Unlock Episode Insights</h2>
                    <p className="text-muted-foreground">
                      Get the full AI analysis: deep summary, chapters, key concepts, transcript, and more.
                    </p>
                  </div>
                  <Button onClick={handleGenerate} size="lg" className="gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generate Insights
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This may take a few minutes depending on episode length
                  </p>
                </div>
              </motion.section>
            )}

            {/* --- Section 2: Comprehensive Overview --- */}
            {isDeepReady && deepContent!.comprehensive_overview && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.05 }}
                dir={isRTL ? "rtl" : "ltr"}
              >
                <PaywallOverlay
                  isGated={isGuest && deepContent!.comprehensive_overview.split('\n').filter(p => p.trim()).length > cutoffs.deepSummaryParagraphs}
                  module="deep summary"
                  teaser={isGuest ? <ComprehensiveOverview text={deepContent!.comprehensive_overview} isRTL={isRTL} skipParagraphs={cutoffs.deepSummaryParagraphs} maxParagraphs={cutoffs.deepSummaryParagraphs + 2} hideHeader /> : undefined}
                >
                  <ComprehensiveOverview text={deepContent!.comprehensive_overview} isRTL={isRTL} maxParagraphs={isGuest ? cutoffs.deepSummaryParagraphs : undefined} label={deepContent!.section_labels?.comprehensive_overview} />
                </PaywallOverlay>
              </motion.section>
            )}

            {/* --- Section 3: Core Concepts --- */}
            {isDeepReady && deepContent!.core_concepts?.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                dir={isRTL ? "rtl" : "ltr"}
              >
                <PaywallOverlay
                  isGated={isGuest && deepContent!.core_concepts.length > cutoffs.coreConcepts}
                  module="core concepts"
                  teaser={isGuest ? <CoreConcepts concepts={deepContent!.core_concepts.slice(cutoffs.coreConcepts, cutoffs.coreConcepts + 2)} isRTL={isRTL} hideHeader /> : undefined}
                >
                  <CoreConcepts concepts={isGuest ? deepContent!.core_concepts.slice(0, cutoffs.coreConcepts) : deepContent!.core_concepts} isRTL={isRTL} label={deepContent!.section_labels?.core_concepts} />
                </PaywallOverlay>
              </motion.section>
            )}

            {/* --- Section 4: Episode Chapters --- */}
            {isDeepReady && deepContent!.chronological_breakdown?.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 }}
                dir={isRTL ? "rtl" : "ltr"}
              >
                <PaywallOverlay
                  isGated={isGuest && deepContent!.chronological_breakdown!.length > cutoffs.chapters}
                  module="chapters"
                  teaser={isGuest ? (
                    <EpisodeChapters
                      sections={deepContent!.chronological_breakdown!.slice(cutoffs.chapters, cutoffs.chapters + 2)}
                      isRTL={isRTL}
                      episode={episode}
                      youtubePlayerRef={youtubePlayerRef}
                      videoCurrentTime={videoCurrentTime}
                      storyboardSpec={ytMeta?.storyboard_spec ?? undefined}
                      hideHeader
                    />
                  ) : undefined}
                >
                  <EpisodeChapters
                    sections={isGuest ? deepContent!.chronological_breakdown!.slice(0, cutoffs.chapters) : deepContent!.chronological_breakdown}
                    isRTL={isRTL}
                    episode={episode}
                    youtubePlayerRef={youtubePlayerRef}
                    videoCurrentTime={videoCurrentTime}
                    creatorChapters={isGuest ? undefined : ytMeta?.chapters}
                    storyboardSpec={ytMeta?.storyboard_spec ?? undefined}
                    label={deepContent!.section_labels?.episode_flow}
                  />
                </PaywallOverlay>
              </motion.section>
            )}

            {/* --- Section 4.5: Pinned Comment (YouTube only) --- */}
            {isYouTube && ytMeta?.pinned_comment && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.17 }}
              >
                <PinnedComment comment={ytMeta.pinned_comment} isRTL={isRTL} />
              </motion.section>
            )}

            {/* --- Section 5: Counterpoints --- */}
            {isDeepReady && deepContent!.contrarian_views?.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                dir={isRTL ? "rtl" : "ltr"}
              >
                <PaywallOverlay
                  isGated={isGuest}
                  module="counterpoints"
                  teaser={isGuest ? <ContrarianViews views={deepContent!.contrarian_views.slice(0, 2)} isRTL={isRTL} label={deepContent!.section_labels?.counterpoints} subtitle={deepContent!.section_labels?.counterpoints_subtitle} /> : undefined}
                >
                  {/* Free users see no counterpoints but get the blurred teaser above */}
                  {!isGuest && <ContrarianViews views={deepContent!.contrarian_views} isRTL={isRTL} label={deepContent!.section_labels?.counterpoints} subtitle={deepContent!.section_labels?.counterpoints_subtitle} />}
                </PaywallOverlay>
              </motion.section>
            )}

            {/* --- Section 6: Transcript --- */}
            <section>
              <TranscriptAccordion
                transcript={data?.transcript_text}
                transcriptStatus={data?.transcript_status || "not_started"}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                sectionLabel={deepContent?.section_labels?.transcript}
                isRTL={isRTL}
              />
            </section>

            {/* --- Section 7: Action Items --- */}
            <section dir={isRTL ? "rtl" : "ltr"}>
              <ActionFooter
                episode={episode}
                actionPrompts={deepContent?.actionable_takeaways}
                summaryReady={data?.summaries?.quick?.status === 'ready' || data?.summaries?.deep?.status === 'ready'}
                sectionLabel={deepContent?.section_labels?.action_items}
                isRTL={isRTL}
              />
            </section>
          </>
        ) : null}

        {/* --- Section 8: Related Episodes --- */}
        <RelatedEpisodes episodeId={episode.id} />

        {/* --- Section 9: Discussion / Comments --- */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.25 }}
          dir={isRTL ? "rtl" : "ltr"}
        >
          <CommentsSection episodeId={episode.id} sectionLabel={deepContent?.section_labels?.discussion} isRTL={isRTL} />
        </motion.section>

        {/* Export Card */}
        {summaryReady && (
          <section>
            <ExportCard
              episodeId={episode.id}
              episodeTitle={episode.title}
              podcastName={episode.podcast?.title || "Unknown Podcast"}
              summaryReady={summaryReady}
              markdownContent={markdownForExport}
            />
          </section>
        )}
      </div>

      {/* Standalone Ask AI Bar — only for authenticated users */}
      {user && <AskAIBar mode="standalone" track={track} />}
    </div>
  );
});


/* -------------------------------------------
   Section Components
   ------------------------------------------- */

/** Section header with icon + label */
function SectionHeader({ icon: Icon, label, iconClassName, subtitle, isRTL, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconClassName?: string;
  subtitle?: string;
  isRTL?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="text-h2 text-foreground flex items-center gap-2">
          <Icon className={cn("h-5 w-5", iconClassName)} />
          {label}
        </h2>
        {subtitle && (
          <p className="text-body-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/* --- 1. Teaser Card --- */
function TeaserCard({ content, isRTL }: { content: QuickSummaryContent; isRTL: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-6 lg:p-8 space-y-6">
      {/* Headline */}
      {content.hook_headline && (
        <h2 className="text-display text-foreground">
          {content.hook_headline}
        </h2>
      )}

      {/* Executive Brief */}
      {content.executive_brief && (
        <p className="text-body text-muted-foreground prose-width">
          {content.executive_brief}
        </p>
      )}

      {/* Golden Nugget */}
      {content.golden_nugget && (
        <div className="bg-[var(--accent-amber-subtle)] rounded-r-xl p-4 border-s-4 border-[hsl(var(--accent-amber))]">
          <div className="flex items-center gap-2 mb-2">
            <Quote className="h-5 w-5 text-amber-500" />
            <span className="text-caption font-bold text-[hsl(var(--accent-amber))] uppercase tracking-wider">Golden Nugget</span>
          </div>
          <p className="text-body italic text-foreground font-medium">
            &ldquo;{content.golden_nugget}&rdquo;
          </p>
        </div>
      )}

      {/* Perfect For + Tags */}
      {(content.perfect_for || (content.tags && content.tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          {content.perfect_for && (
            <Badge variant="secondary">
              {content.perfect_for}
            </Badge>
          )}
          {content.tags?.map((tag, i) => (
            <Badge key={i} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- 1b. Guest Teaser Card (truncated for unauthenticated users) --- */
function GuestTeaserCard({ content, isRTL }: { content: QuickSummaryContent; isRTL: boolean }) {
  const { setShowAuthModal } = useAuth();

  return (
    <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-6 lg:p-8 space-y-5">
      {/* Headline — fully visible */}
      {content.hook_headline && (
        <h2 className={cn(
          "text-display text-foreground",
        )}>
          {content.hook_headline}
        </h2>
      )}

      {/* Truncated Executive Brief — first 300 chars visible */}
      {content.executive_brief && (
        <p className="text-body text-muted-foreground prose-width">
          {content.executive_brief.slice(0, 300)}{content.executive_brief.length > 300 ? '...' : ''}
        </p>
      )}

      {/* Golden Nugget — visible but with sign-up prompt */}
      {content.golden_nugget && (
        <div className="bg-[var(--accent-amber-subtle)] rounded-r-xl p-4 relative overflow-hidden border-s-4 border-[hsl(var(--accent-amber))]">
          <div className="flex items-center gap-2 mb-2">
            <Quote className="h-5 w-5 text-amber-500" />
            <span className="text-caption font-bold text-[hsl(var(--accent-amber))] uppercase tracking-wider">Golden Nugget</span>
          </div>
          <p className="text-body italic text-foreground font-medium">
            &ldquo;{content.golden_nugget.slice(0, 120)}{content.golden_nugget.length > 120 ? '...' : ''}&rdquo;
          </p>
        </div>
      )}

      {/* Tags + Perfect For — visible */}
      {(content.perfect_for || (content.tags && content.tags.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          {content.perfect_for && (
            <Badge variant="secondary">
              {content.perfect_for}
            </Badge>
          )}
          {content.tags?.slice(0, 4).map((tag, i) => (
            <Badge key={i} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* CTA divider */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => setShowAuthModal(true, 'Sign up to read full AI summaries for podcasts and YouTube.')}
          className="flex items-center gap-2 text-sm text-primary font-medium hover:underline cursor-pointer"
        >
          <Lock className="h-3.5 w-3.5" />
          Sign up to read the full summary
        </button>
      </div>
    </div>
  );
}

/* --- 2. Comprehensive Overview --- */
function ComprehensiveOverview({ text, isRTL, maxParagraphs, skipParagraphs, hideHeader, label }: { text: string; isRTL: boolean; maxParagraphs?: number; skipParagraphs?: number; hideHeader?: boolean; label?: string }) {
  const allParagraphs = text.split('\n').filter(p => p.trim());
  const start = skipParagraphs ?? 0;
  const visibleParagraphs = maxParagraphs !== undefined ? allParagraphs.slice(start, maxParagraphs) : allParagraphs.slice(start);

  return (
    <div>
      {!hideHeader && <SectionHeader icon={FileText} label={label ?? "Comprehensive Overview"} isRTL={isRTL} />}
      <div className="prose-width">
        {visibleParagraphs.map((paragraph, i) => (
          <AnnotatedParagraph key={i} text={paragraph} isRTL={isRTL} />
        ))}
      </div>
    </div>
  );
}

/** Render paragraph with <<highlighted>> markers */
function AnnotatedParagraph({ text, isRTL }: { text: string; isRTL: boolean }) {
  const segments = parseHighlightMarkers(text);
  return (
    <p className="text-body text-muted-foreground leading-relaxed mb-6 last:mb-0">
      {segments.map((seg, i) =>
        seg.type === "highlight" ? (
          <mark
            key={i}
            className="bg-[var(--accent-amber-subtle)] text-foreground px-1 rounded font-medium"
          >
            {seg.content}
          </mark>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </p>
  );
}

/* --- 3. Core Concepts --- */
function CoreConcepts({ concepts, isRTL, hideHeader, label }: {
  concepts: DeepSummaryContent["core_concepts"];
  isRTL: boolean;
  hideHeader?: boolean;
  label?: string;
}) {
  return (
    <div>
      {!hideHeader && <SectionHeader icon={Lightbulb} label={label ?? "Core Concepts"} iconClassName="text-amber-500" isRTL={isRTL} />}
      <div className="grid gap-4">
        {concepts.map((concept, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--primary-subtle)] text-primary text-sm font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <h3 className="text-h3 text-foreground">
                {concept.concept}
              </h3>
            </div>
            <p className="text-body text-muted-foreground mt-3">
              {concept.explanation}
            </p>
            {concept.quote_reference && (
              <blockquote className="mt-4 ps-4 border-s-2 border-border-strong text-body-sm text-muted-foreground italic">
                &ldquo;{concept.quote_reference}&rdquo;
              </blockquote>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- 4. Episode Chapters --- */
function EpisodeChapters({ sections, isRTL, episode, youtubePlayerRef, videoCurrentTime, creatorChapters, storyboardSpec, hideHeader, label }: {
  sections: ChronologicalSection[];
  isRTL: boolean;
  episode: Episode & { podcast?: Podcast };
  youtubePlayerRef?: RefObject<YouTubeEmbedRef | null>;
  videoCurrentTime?: number;
  creatorChapters?: { title: string; startSeconds: number }[];
  storyboardSpec?: string;
  hideHeader?: boolean;
  label?: string;
}) {
  const { user } = useAuth();

  // If creator chapters are available, convert them to ChronologicalSection format
  const effectiveSections = useMemo(() => {
    if (creatorChapters && creatorChapters.length >= 3) {
      return creatorChapters.map((ch) => ({
        timestamp: `${String(Math.floor(ch.startSeconds / 60)).padStart(2, '0')}:${String(ch.startSeconds % 60).padStart(2, '0')}`,
        timestamp_seconds: ch.startSeconds,
        title: ch.title,
        content: '', // Creator chapters don't have AI-generated content
      } as ChronologicalSection));
    }
    return sections;
  }, [creatorChapters, sections]);

  // Parse storyboard spec for thumbnails
  const storyboardLevels = useMemo(() => {
    if (!storyboardSpec) return [];
    return parseStoryboardSpec(storyboardSpec);
  }, [storyboardSpec]);

  const normalized = useMemo(() => {
    const sections = normalizeChronologicalSections(effectiveSections);
    // Deduplicate: AI summaries sometimes repeat chapters (e.g. when creator chapters
    // appear in both the transcript and the description context given to the model).
    if (sections.length < 2) return sections;
    const seen = new Set<string>();
    return sections.filter((s) => {
      const key = `${s.timestamp_seconds ?? ''}|${(s.title || s.timestamp_description || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [effectiveSections]);
  const showTimestamps = useMemo(() => hasRealTimestamps(normalized), [normalized]);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [allExpanded, setAllExpanded] = useState(false);
  const player = useAudioPlayerSafe();

  // Only build chapters for authenticated users
  const chapters = useMemo(() => {
    if (!user || !showTimestamps) return undefined;
    return normalized
      .filter((s) => (s.timestamp_seconds ?? 0) >= 0 && s.timestamp)
      .map((s) => ({
        title: s.title || s.timestamp_description || 'Untitled',
        timestamp: s.timestamp!,
        timestamp_seconds: s.timestamp_seconds!,
      }));
  }, [normalized, showTimestamps, user]);

  const chapterTrack = useMemo(() => {
    if (!episode.audio_url) return null;
    return {
      id: episode.id,
      title: episode.title,
      artist: episode.podcast?.title || 'Unknown Podcast',
      artworkUrl: episode.podcast?.image_url || '',
      audioUrl: episode.audio_url,
      duration: episode.duration_seconds ?? undefined,
      chapters,
    };
  }, [episode, chapters]);

  const activeIndex = useMemo(() => {
    const isYT = !!youtubePlayerRef;
    const time = isYT ? (videoCurrentTime ?? 0) : player?.currentTime ?? 0;
    if ((!player && !isYT) || !showTimestamps) return -1;
    // Only highlight chapters if this episode is actually playing
    if (!isYT && player?.currentTrack?.id !== episode.id) return -1;
    let active = -1;
    for (let i = 0; i < normalized.length; i++) {
      const sec = normalized[i].timestamp_seconds ?? 0;
      if (sec <= time) active = i;
    }
    return active;
  }, [player?.currentTime, player?.currentTrack?.id, normalized, showTimestamps, player, youtubePlayerRef, videoCurrentTime, episode.id]);

  const handleSeekTo = (seconds: number) => {
    if (seconds < 0) return;
    // Use YouTube player if available
    if (youtubePlayerRef?.current) {
      youtubePlayerRef.current.seekTo(seconds);
      return;
    }
    if (!player) return;
    const isTrackLoaded = player.currentTrack?.audioUrl === chapterTrack?.audioUrl;
    if (isTrackLoaded) {
      player.seek(seconds);
      if (!player.isPlaying) player.play();
    } else if (chapterTrack) {
      player.playFromTime(chapterTrack, seconds);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
    setAllExpanded(false);
  };

  const toggleAll = () => {
    setAllExpanded(!allExpanded);
    if (allExpanded) setExpandedIndex(0);
  };

  if (normalized.length === 0) return null;

  return (
    <div>
      {!hideHeader && <SectionHeader icon={ListMusic} label={label ?? "Episode Chapters"} isRTL={isRTL}>
        {normalized.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="text-xs gap-1 h-7 text-muted-foreground"
          >
            {allExpanded ? (
              <><ChevronsDownUp className="h-3 w-3" /> Collapse All</>
            ) : (
              <><ChevronsUpDown className="h-3 w-3" /> Expand All</>
            )}
          </Button>
        )}
      </SectionHeader>}

      <div dir={isRTL ? "rtl" : "ltr"} className="space-y-1">
        {normalized.map((section, i) => {
          const isActive = i === activeIndex;
          const isExpanded = allExpanded || expandedIndex === i;
          const sectionTitle = section.title || section.timestamp_description || `Section ${i + 1}`;
          const hasTimestamp = showTimestamps && (section.timestamp_seconds ?? 0) > 0;

          return (
            <div
              key={i}
              className={cn(
                "rounded-xl transition-colors duration-150",
                isActive
                  ? "bg-[var(--primary-subtle)] border border-primary"
                  : "hover:bg-secondary"
              )}
            >
              {/* Clickable row */}
              <button
                onClick={() => toggleExpand(i)}
                className={cn(
                  "w-full p-4 cursor-pointer",
                  isRTL ? "text-right" : "text-left",
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Storyboard thumbnail */}
                  {storyboardLevels.length > 0 && hasTimestamp && (() => {
                    const frame = getFrameUrlForTimestamp(storyboardLevels, section.timestamp_seconds ?? 0);
                    if (!frame) return null;
                    // The best level is the one getFrameUrlForTimestamp picked (largest width)
                    const bestLevel = storyboardLevels.reduce((b, l) => l.width > b.width ? l : b, storyboardLevels[0]);
                    const sheetW = bestLevel.width * bestLevel.cols;
                    const sheetH = bestLevel.height * bestLevel.rows;
                    // Scale to fit 64px wide thumbnail
                    const scale = 64 / bestLevel.width;
                    return (
                      <div
                        className="w-16 h-9 rounded overflow-hidden shrink-0 bg-secondary"
                        style={{
                          backgroundImage: `url(${frame.sheetUrl})`,
                          backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
                          backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
                        }}
                      />
                    );
                  })()}
                  {hasTimestamp && (
                    <span
                      role="button"
                      className="text-caption bg-secondary px-2 py-1 rounded-md font-mono shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeekTo(section.timestamp_seconds!);
                      }}
                    >
                      {section.timestamp}
                    </span>
                  )}
                  <span className={cn(
                    "text-h4 text-foreground",
                    isActive && "text-primary"
                  )}>
                    {sectionTitle}
                  </span>
                  {isActive && (
                    <span className="bg-primary text-primary-foreground text-caption px-2 py-0.5 rounded-full font-medium shrink-0">
                      Now Playing
                    </span>
                  )}
                  {!isExpanded && (
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground shrink-0 ms-auto"
                    )} />
                  )}
                </div>

                {/* Summary teaser (collapsed only) */}
                {!isExpanded && section.hook && (
                  <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">
                    {section.hook}
                  </p>
                )}
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2 ps-4">
                      {section.hook && (
                        <p className="text-body-sm text-muted-foreground italic">
                          {section.hook}
                        </p>
                      )}
                      <p className="text-body text-muted-foreground prose-width">
                        {section.content}
                      </p>
                      {hasTimestamp && (
                        <div className="pt-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2 h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeekTo(section.timestamp_seconds!);
                            }}
                          >
                            <Play className="h-3 w-3 fill-current" />
                            Play from ~{section.timestamp}
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- 5. Contrarian Views --- */
/** Render text with **bold** markers as <strong> tags */
function renderBoldMarkers(text: string) {
  if (typeof text !== 'string') return String(text ?? '');
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function ContrarianViews({ views, isRTL, hideHeader, label, subtitle }: { views: string[]; isRTL: boolean; hideHeader?: boolean; label?: string; subtitle?: string }) {
  return (
    <div>
      {!hideHeader && <SectionHeader
        icon={Scale}
        label={label ?? "Counterpoints"}
        iconClassName="text-red-400"
        subtitle={subtitle ?? "Alternative perspectives worth considering"}
        isRTL={isRTL}
      />}
      <div className="grid gap-4">
        {views.map((view, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-5 border-s-4 border-s-red-500/50">
            <p className="text-body text-muted-foreground">{renderBoldMarkers(view)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- Export Card (replaces SubscriptionCard) --- */
function ExportCard({
  episodeId,
  episodeTitle,
  podcastName,
  summaryReady,
  markdownContent,
}: {
  episodeId: string;
  episodeTitle: string;
  podcastName: string;
  summaryReady: boolean;
  markdownContent?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = async () => {
    if (!markdownContent) return;
    await navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/15 dark:border-primary/20 rounded-2xl shadow-[var(--shadow-2)] p-5 lg:p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-h4 text-foreground">Save this summary</p>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Copy as Markdown for Obsidian, Notion, or share with others.
          </p>
          <div className="flex items-center gap-2 mt-3">
            {markdownContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMarkdown}
                className="gap-2"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied!" : "Copy Markdown"}
              </Button>
            )}
            <ShareMenu
              episodeId={episodeId}
              episodeTitle={episodeTitle}
              podcastName={podcastName}
              summaryReady={summaryReady}
              markdownContent={markdownContent}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
