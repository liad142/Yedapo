"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  Check,
  Search,
  Download,
  ScrollText,
  User,
  Mic,
  Filter,
  Crown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TranscriptMessage } from "./TranscriptMessage";
import { isRTLText } from "@/lib/rtl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { PaywallOverlay } from "@/components/PaywallOverlay";
import type { ParsedTranscriptSegment, SpeakerInfo } from "@/types/transcript";

interface TranscriptTabContentProps {
  transcript: string | undefined;
  transcriptStatus: string;
  isLoading: boolean;
}

export function TranscriptTabContent({
  transcript,
  transcriptStatus,
  isLoading
}: TranscriptTabContentProps) {
  const { cutoffs, isFree } = useUserPlan();
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<Map<string, SpeakerInfo>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const isTranscribing = ['queued', 'transcribing'].includes(transcriptStatus);
  const hasTranscript = transcriptStatus === 'ready' && transcript;

  // Parse transcript into segments with speaker detection
  // Then merge consecutive segments from the same speaker for better readability
  const segments = useMemo<ParsedTranscriptSegment[]>(() => {
    if (!transcript) return [];

    // Step 1: Parse each line
    const lines = transcript.split('\n').filter(line => line.trim());
    const rawSegments: { speaker: string; text: string; timestamp?: string }[] = [];

    let currentSpeaker = 'Unknown Speaker';

    for (const line of lines) {
      let timestamp: string | undefined;
      let speaker: string | undefined;
      let text: string = line;

      // Format 1: [timestamp] [Speaker Name] text (our format from Deepgram)
      const format1Match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*\[([^\]]+)\]\s*(.+)/);
      
      // Format 2: [timestamp] Speaker Name: text (alternative format)
      const format2Match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:\[\]]+):\s*(.+)/);
      
      // Format 3: Speaker Name: text (no timestamp)
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

      if (speaker) {
        currentSpeaker = speaker;
      }

      if (text.trim()) {
        rawSegments.push({
          speaker: currentSpeaker,
          text: text.trim(),
          timestamp
        });
      }
    }

    // Step 2: Merge consecutive segments from the same speaker
    // This makes transcripts much more readable (full paragraphs instead of fragments)
    const merged: ParsedTranscriptSegment[] = [];
    let segmentId = 0;

    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      const lastMerged = merged[merged.length - 1];

      // Merge if same speaker and previous segment exists
      // Keep them separate only if there's a speaker change
      if (lastMerged && lastMerged.speaker === seg.speaker) {
        // Append text to previous segment
        lastMerged.text += ' ' + seg.text;
      } else {
        // New speaker - create new segment
        merged.push({
          id: `segment-${segmentId++}`,
          speaker: seg.speaker,
          text: seg.text,
          timestamp: seg.timestamp,
          isRTL: isRTLText(seg.text)
        });
      }
    }

    // Update RTL detection for merged text
    merged.forEach(seg => {
      seg.isRTL = isRTLText(seg.text);
    });

    return merged;
  }, [transcript]);

  const uniqueSpeakers = useMemo(() => {
    const speakerSet = new Set<string>();
    segments.forEach(seg => speakerSet.add(seg.speaker));
    return Array.from(speakerSet);
  }, [segments]);

  useEffect(() => {
    const speakerMap = new Map<string, SpeakerInfo>();
    // Vibrant, distinct colors for speakers (similar to podcast app designs)
    const colors = [
      '#0D9488', // Teal (like Cal Newport example)
      '#8B5CF6', // Purple
      '#F59E0B', // Amber
      '#EC4899', // Pink
      '#10B981', // Emerald
      '#3B82F6', // Blue
      '#EF4444', // Red
      '#6366F1', // Indigo
      '#14B8A6', // Cyan
      '#F97316', // Orange
    ];

    uniqueSpeakers.forEach((speaker, index) => {
      // Get first letter of first and last name if available
      const nameParts = speaker.split(' ').filter(p => p.length > 0);
      const avatar = nameParts.length >= 2 
        ? `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase()
        : speaker.charAt(0).toUpperCase();

      speakerMap.set(speaker, {
        name: speaker,
        color: colors[index % colors.length],
        avatar: avatar
      });
    });

    setSpeakers(speakerMap);
  }, [uniqueSpeakers]);

  const filteredSegments = useMemo(() => {
    let filtered = segments;

    if (selectedSpeaker) {
      filtered = filtered.filter(seg => seg.speaker === selectedSpeaker);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(seg =>
        seg.text.toLowerCase().includes(query) ||
        seg.speaker.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [segments, searchQuery, selectedSpeaker]);

  const matchCount = filteredSegments.length;

  const handleCopy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-surface-2 to-surface-3">
        <div className="flex gap-3 p-6 border-b border-border">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 w-32" />
        </div>
        <div className="flex-1 p-6 space-y-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4 animate-pulse">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasTranscript) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gradient-to-b from-surface-2 to-surface-3">
        <div className="text-center max-w-md px-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary text-primary-foreground mb-6 shadow-lg shadow-primary/30">
            <ScrollText size={40} />
          </div>
          {isTranscribing ? (
            <>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                Transcribing audio...
              </h3>
              <p className="text-muted-foreground mb-8">
                This may take a few minutes. We're converting speech to text.
              </p>
              <div className="flex justify-center gap-1.5">
                {[0, 150, 300, 450, 600].map((delay) => (
                  <div
                    key={delay}
                    className="w-1 h-8 bg-primary rounded-sm"
                    style={{
                      animation: 'wave 1.2s ease-in-out infinite',
                      animationDelay: `${delay}ms`
                    }}
                  />
                ))}
              </div>
            </>
          ) : transcriptStatus === 'failed' ? (
            <>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                Transcription failed
              </h3>
              <p className="text-muted-foreground">
                We couldn't transcribe this episode. Please try generating insights again.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                No transcript available
              </h3>
              <p className="text-muted-foreground">
                Generate insights to create a transcript for this episode.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-surface-2 to-surface-3">
      {/* Header */}
      <div className="flex gap-3 p-6 border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex-1 relative">
          {isFree ? (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                type="text"
                placeholder="Search conversation..."
                disabled
                className="pl-12 pr-32 h-12 rounded-full border-2 border-transparent bg-muted opacity-60 cursor-not-allowed"
              />
              <Badge variant="secondary" className="absolute right-4 top-1/2 -translate-y-1/2 gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                <Crown size={12} />
                Pro
              </Badge>
            </div>
          ) : (
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
              <Input
                type="text"
                placeholder="Search conversation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-24 h-12 rounded-full border-2 border-transparent bg-muted focus:border-primary focus:bg-card transition-all"
              />
              {searchQuery && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {matchCount} {matchCount === 1 ? 'result' : 'results'}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            disabled={isFree}
            title={isFree ? "Upgrade to Pro to copy" : "Copy transcript"}
            className="h-12 w-12 rounded-full border-2 hover:bg-primary/5 hover:border-primary dark:hover:bg-primary/5 transition-all"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleDownload}
            disabled={isFree}
            title={isFree ? "Upgrade to Pro to download" : "Download transcript"}
            className="h-12 w-12 rounded-full border-2 hover:bg-primary/5 hover:border-primary dark:hover:bg-primary/5 transition-all"
          >
            <Download size={16} />
          </Button>
        </div>
      </div>

      {/* Speaker Filter */}
      {uniqueSpeakers.length > 1 && (
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60 bg-card/60 backdrop-blur-lg">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Filter by speaker:
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSpeaker(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                !selectedSpeaker
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:border-primary/50'
              }`}
            >
              All
            </button>
            {uniqueSpeakers.map(speaker => {
              const info = speakers.get(speaker);
              const isActive = speaker === selectedSpeaker;
              return (
                <button
                  key={speaker}
                  onClick={() => setSelectedSpeaker(isActive ? null : speaker)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'bg-card text-foreground border-border hover:border-border'
                  }`}
                  style={isActive ? { backgroundColor: info?.color } : {}}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: info?.color }}
                  >
                    {info?.avatar}
                  </span>
                  {speaker}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8" ref={scrollRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {(() => {
            const visibleSegments = isFree
              ? filteredSegments.slice(0, cutoffs.transcriptSegments)
              : filteredSegments;

            return (
              <>
                {visibleSegments.map((segment, index) => {
                  const speakerInfo = speakers.get(segment.speaker);
                  const prevSegment = index > 0 ? visibleSegments[index - 1] : null;
                  const isGrouped = prevSegment?.speaker === segment.speaker;

                  return (
                    <TranscriptMessage
                      key={segment.id}
                      segment={segment}
                      speakerInfo={speakerInfo}
                      isGrouped={isGrouped}
                      searchQuery={searchQuery}
                      index={index}
                    />
                  );
                })}

                {isFree && filteredSegments.length > cutoffs.transcriptSegments && (
                  <PaywallOverlay isGated={true} module="transcript">
                    <div className="space-y-6">
                      {filteredSegments.slice(cutoffs.transcriptSegments, cutoffs.transcriptSegments + 2).map((segment, index) => {
                        const speakerInfo = speakers.get(segment.speaker);
                        return (
                          <TranscriptMessage
                            key={segment.id}
                            segment={segment}
                            speakerInfo={speakerInfo}
                            isGrouped={false}
                            searchQuery={searchQuery}
                            index={cutoffs.transcriptSegments + index}
                          />
                        );
                      })}
                    </div>
                  </PaywallOverlay>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-0 border-t border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="flex justify-center gap-8 px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Mic size={14} />
            <span>{uniqueSpeakers.length} {uniqueSpeakers.length === 1 ? 'speaker' : 'speakers'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ScrollText size={14} />
            <span>{segments.length} segments</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User size={14} />
            <span>{transcript.split(/\s+/).length.toLocaleString()} words</span>
          </div>
        </div>
        <div className="px-6 py-2 border-t border-border/40">
          <p className="text-[11px] text-center text-muted-foreground">
            Transcript provided for accessibility and personal reference. All content belongs to the original creators.
          </p>
        </div>
      </div>
    </div>
  );
}
