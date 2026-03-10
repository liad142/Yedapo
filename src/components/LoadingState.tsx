"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Headphones, FileText, Sparkles } from "lucide-react";

interface LoadingStateProps {
  stage?: "transcribing" | "summarizing" | "loading";
  message?: string;
}

const ROTATING_MESSAGES = [
  "Listening to your episode...",
  "Finding key insights...",
  "Polishing the summary...",
  "Extracting the best moments...",
  "Almost there...",
];

export function LoadingState({
  stage = "loading",
  message,
}: LoadingStateProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const stages = {
    transcribing: {
      icon: Headphones,
      title: "Transcribing Audio",
      description:
        "Converting speech to text. This may take 20-60 seconds depending on episode length...",
    },
    summarizing: {
      icon: Sparkles,
      title: "Generating Summary",
      description:
        "AI is analyzing the transcript and extracting key insights...",
    },
    loading: {
      icon: FileText,
      title: "Loading",
      description: message || "Please wait...",
    },
  };

  const currentStage = stages[stage];
  const Icon = currentStage.icon;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 relative">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          </div>
          <h3 className="text-xl font-semibold">{currentStage.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStage.description}
          </p>
          <p
            key={messageIndex}
            className="text-xs text-primary/70 mt-2 animate-pulse transition-opacity"
          >
            {ROTATING_MESSAGES[messageIndex]}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress visualization */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  stage === "transcribing" || stage === "summarizing"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Headphones className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Transcription</span>
                  {stage === "transcribing" && (
                    <span className="text-xs text-primary">In progress...</span>
                  )}
                  {stage === "summarizing" && (
                    <span className="text-xs text-muted-foreground">
                      Complete
                    </span>
                  )}
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      stage === "transcribing"
                        ? "w-1/2 bg-primary animate-pulse"
                        : stage === "summarizing"
                        ? "w-full bg-primary"
                        : "w-0 bg-muted"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  stage === "summarizing"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">AI Summary</span>
                  {stage === "summarizing" && (
                    <span className="text-xs text-primary">In progress...</span>
                  )}
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      stage === "summarizing"
                        ? "w-1/2 bg-primary animate-pulse"
                        : "w-0 bg-muted"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Skeleton preview */}
          <div className="pt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="pt-2 space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
