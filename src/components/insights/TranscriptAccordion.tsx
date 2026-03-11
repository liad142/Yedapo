"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  ChevronDown,
  ChevronRight,
  Play,
  Sparkles,
  Loader2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAudioPlayerSafe } from "@/contexts/AudioPlayerContext";
import { cn } from "@/lib/utils";

interface TranscriptAccordionProps {
  transcript: string | undefined;
  transcriptStatus: string;
  isGenerating: boolean;
  onGenerate: () => void;
  sectionLabel?: string;
  isRTL?: boolean;
}

interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp?: string;
  isRTL: boolean;
}

// Detect if text is RTL
function isRTLText(text: string): boolean {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const rtlMatches = (text.match(rtlChars) || []).length;
  const latinChars = /[a-zA-Z]/g;
  const latinMatches = (text.match(latinChars) || []).length;
  return rtlMatches > latinMatches;
}

// Parse timestamp to seconds
function parseTimestamp(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  const parts = timestamp.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

// Generate speaker color
function getSpeakerColor(index: number): string {
  const colors = [
    "#0D9488", // Teal
    "#8B5CF6", // Purple
    "#F59E0B", // Amber
    "#EC4899", // Pink
    "#10B981", // Emerald
    "#3B82F6", // Blue
  ];
  return colors[index % colors.length];
}

// Get speaker initials
function getSpeakerInitials(name: string): string {
  const parts = name.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

export function TranscriptAccordion({
  transcript,
  transcriptStatus,
  isGenerating,
  onGenerate,
  sectionLabel,
  isRTL,
}: TranscriptAccordionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const player = useAudioPlayerSafe();

  const isTranscribing = ["queued", "transcribing"].includes(transcriptStatus);
  const hasTranscript = transcriptStatus === "ready" && transcript;

  // Parse transcript into segments
  const segments = useMemo<TranscriptSegment[]>(() => {
    if (!transcript) return [];

    const lines = transcript.split("\n").filter((line) => line.trim());
    const rawSegments: { speaker: string; text: string; timestamp?: string }[] = [];
    let currentSpeaker = "Speaker";

    for (const line of lines) {
      let timestamp: string | undefined;
      let speaker: string | undefined;
      let text: string = line;

      // Format: [timestamp] [Speaker Name] text
      const format1Match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*\[([^\]]+)\]\s*(.+)/);
      // Format: [timestamp] Speaker Name: text
      const format2Match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:\[\]]+):\s*(.+)/);
      // Format: Speaker Name: text
      const format3Match = line.match(/^([A-Z][^:\[\]]{1,30}):\s*(.+)/);

      if (format1Match) {
        timestamp = format1Match[1];
        speaker = format1Match[2].trim();
        text = format1Match[3].trim();
      } else if (format2Match) {
        timestamp = format2Match[1];
        speaker = format2Match[2].trim();
        text = format2Match[3].trim();
      } else if (format3Match) {
        speaker = format3Match[1].trim();
        text = format3Match[2].trim();
      } else {
        const timestampOnly = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)/);
        if (timestampOnly) {
          timestamp = timestampOnly[1];
          text = timestampOnly[2].trim();
        }
      }

      if (speaker) currentSpeaker = speaker;

      if (text.trim()) {
        rawSegments.push({ speaker: currentSpeaker, text: text.trim(), timestamp });
      }
    }

    // Merge consecutive segments from same speaker
    const merged: TranscriptSegment[] = [];
    let segmentId = 0;

    for (const seg of rawSegments) {
      const last = merged[merged.length - 1];
      if (last && last.speaker === seg.speaker) {
        last.text += " " + seg.text;
      } else {
        merged.push({
          id: `seg-${segmentId++}`,
          speaker: seg.speaker,
          text: seg.text,
          timestamp: seg.timestamp,
          isRTL: isRTLText(seg.text),
        });
      }
    }

    // Update RTL for merged text
    merged.forEach((seg) => {
      seg.isRTL = isRTLText(seg.text);
    });

    return merged;
  }, [transcript]);

  // Get unique speakers
  const speakers = useMemo(() => {
    const unique = [...new Set(segments.map((s) => s.speaker))];
    return unique.map((name, i) => ({
      name,
      color: getSpeakerColor(i),
      initials: getSpeakerInitials(name),
    }));
  }, [segments]);

  // Filter segments by search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const query = searchQuery.toLowerCase();
    return segments.filter(
      (seg) =>
        seg.text.toLowerCase().includes(query) ||
        seg.speaker.toLowerCase().includes(query)
    );
  }, [segments, searchQuery]);

  // Handle play from segment
  const handlePlayFrom = (timestamp: string | undefined) => {
    const seconds = parseTimestamp(timestamp);
    if (seconds !== null && player) {
      player.seek(seconds);
      if (!player.isPlaying) {
        player.play();
      }
    }
  };

  // Highlight search matches
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 dark:bg-yellow-400/30 dark:text-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Empty/generating state
  if (!hasTranscript) {
    return (
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-h3 text-foreground mb-2">{sectionLabel ?? 'Transcript'}</h3>
          <p className="text-body-sm text-muted-foreground mb-4">
            {isTranscribing || isGenerating
              ? "Transcribing audio..."
              : transcriptStatus === "failed"
                ? "Transcription failed. Please try again."
                : "Get a searchable transcript of this episode"}
          </p>
          {(isTranscribing || isGenerating) && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {!isTranscribing && !isGenerating && transcriptStatus !== "failed" && (
            <Button onClick={onGenerate} variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Insights
            </Button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-card border border-border rounded-2xl shadow-[var(--shadow-1)] overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h2 className="text-h2 text-foreground">{sectionLabel ?? 'Transcript'}</h2>
              <span className="text-caption text-muted-foreground">
                {segments.length} segments
              </span>
            </div>
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{speakers.length} speakers</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-4 bg-secondary border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20"
            />
            {searchQuery && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
                {filteredSegments.length} matches
              </span>
            )}
          </div>

          {/* Speaker filter pills */}
          {speakers.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {speakers.map((speaker) => (
                <button
                  key={speaker.name}
                  onClick={() => setSearchQuery(speaker.name)}
                  className={cn(
                    "rounded-full px-3 py-1 text-caption font-medium flex items-center gap-1.5 transition-colors",
                    searchQuery === speaker.name
                      ? "bg-[var(--primary-subtle)] text-primary border border-primary"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: speaker.color }}
                  >
                    {speaker.initials}
                  </span>
                  {speaker.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Segments */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredSegments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No matches found for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredSegments.map((segment) => {
                const speakerInfo = speakers.find((s) => s.name === segment.speaker);
                const isExpanded = expandedId === segment.id;
                const previewText =
                  segment.text.length > 100
                    ? segment.text.slice(0, 100) + "..."
                    : segment.text;

                return (
                  <div key={segment.id} className="hover:bg-secondary transition-colors">
                    {/* Accordion Header */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : segment.id)}
                      className="w-full px-5 py-4 flex items-start gap-3 text-left cursor-pointer"
                    >
                      {/* Expand Icon */}
                      <div className="shrink-0 mt-0.5">
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          !isExpanded && "-rotate-90"
                        )} />
                      </div>

                      {/* Speaker Avatar */}
                      <div
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: speakerInfo?.color }}
                      >
                        {speakerInfo?.initials}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-body-sm text-foreground">{segment.speaker}</span>
                          {segment.timestamp && (
                            <span className="text-caption text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded-md">
                              {segment.timestamp}
                            </span>
                          )}
                        </div>
                        {!isExpanded && (
                          <p
                            className={cn(
                              "text-body-sm text-muted-foreground line-clamp-2 leading-relaxed",
                              segment.isRTL && "text-right"
                            )}
                            dir={segment.isRTL ? "rtl" : "ltr"}
                          >
                            {highlightText(previewText, searchQuery)}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="px-5 pb-4 pl-14 md:pl-16"
                            dir={segment.isRTL ? "rtl" : "ltr"}
                          >
                            <p
                              className={cn(
                                "text-body-sm leading-relaxed mb-3 text-foreground",
                                segment.isRTL && "text-right"
                              )}
                            >
                              {highlightText(segment.text, searchQuery)}
                            </p>

                            {segment.timestamp && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayFrom(segment.timestamp);
                                }}
                                className="gap-2 h-8 px-3 rounded-full"
                              >
                                <Play className="h-3 w-3 fill-current" />
                                <span className="text-caption font-medium">Play from {segment.timestamp}</span>
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border text-center">
          <p className="text-caption text-muted-foreground">
            Click a segment to expand &middot; Search to find specific topics
          </p>
        </div>
      </motion.div>
    </div>
  );
}
