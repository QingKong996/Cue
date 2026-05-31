"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Separator, Typography } from "@heroui/react";
import type { AppState, AudioSource, TranscriptTurn, UserProfile } from "@/lib/types";
import { createTranscriptManager } from "@/lib/context/transcript";
import { useTranscript } from "@/hooks/useTranscript";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useDetection } from "@/hooks/useDetection";
import { useCueFrame } from "@/hooks/useCueFrame";
import { useDemoMode } from "@/hooks/useDemoMode";
import { UserConfig } from "@/components/UserConfig";
import { AudioSourceSelector } from "@/components/AudioSourceSelector";
import { NotificationBanner } from "@/components/NotificationBanner";
import { StatusBar } from "@/components/StatusBar";
import { CuePanel } from "@/components/CuePanel";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [audioSource, setAudioSource] = useState<AudioSource | null>(null);
  const [cueVisible, setCueVisible] = useState(false);
  const [cueText, setCueText] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoTurns, setDemoTurns] = useState<TranscriptTurn[]>([]);

  const transcriptManager = useRef(createTranscriptManager());
  const processedIds = useRef(new Set<string>());

  const {
    turns,
    partialText,
    feedChunk,
    startTranscription,
    stopTranscription,
  } = useTranscript();

  const {
    candidates,
    lastDetection,
    isProcessing,
    error: detectionError,
    processSentence,
  } = useDetection(userProfile);

  const { cueFrame, displayText: cueFrameDisplayText, isUpdating } = useCueFrame(
    userProfile ? transcriptManager.current : null,
    userProfile,
  );

  const {
    state: audioState,
    error: audioError,
    start: startAudio,
    stop: stopAudio,
  } = useAudioCapture(
    useCallback((chunk: ArrayBuffer) => {
      feedChunk(chunk);
    }, [feedChunk]),
  );

  // Demo mode: generate mock transcript turns
  const handleDemoTurn = useCallback((turn: TranscriptTurn) => {
    setDemoTurns((prev) => [...prev, turn]);
  }, []);

  const { start: startDemo, stop: stopDemo } = useDemoMode(handleDemoTurn);

  function handleStartDemo() {
    setIsDemoMode(true);
    setAppState("listening");
    startDemo();
  }

  // Sync demo turns into the transcript manager and run detection
  useEffect(() => {
    if (!isDemoMode) return;
    const newFinalTurns = demoTurns.filter(
      (t) => t.isFinal && !processedIds.current.has(t.id),
    );
    if (newFinalTurns.length === 0) return;

    for (const turn of newFinalTurns) {
      processedIds.current.add(turn.id);
      transcriptManager.current.addTurn(turn);
      processSentence(turn, transcriptManager.current.getRecentTurns(20), cueFrame);
    }
  }, [demoTurns, isDemoMode, processSentence, cueFrame]);

  // Sync new final turns into the transcript manager and run detection
  useEffect(() => {
    if (isDemoMode) return; // demo mode has its own sync
    const newFinalTurns = turns.filter(
      (t) => t.isFinal && !processedIds.current.has(t.id),
    );
    if (newFinalTurns.length === 0) return;

    for (const turn of newFinalTurns) {
      processedIds.current.add(turn.id);
      transcriptManager.current.addTurn(turn);
      console.log("[page] turn added, manager size:", transcriptManager.current.size());
      processSentence(turn, transcriptManager.current.getRecentTurns(20), cueFrame);
    }
  }, [turns, processSentence, isDemoMode, cueFrame]);

  // Show CueDisplay + send notification when detection triggers
  useEffect(() => {
    if (lastDetection && lastDetection.action === "show") {
      const text = lastDetection.cueText || "有人在叫你，请注意回应。";
      setCueText(text);
      setCueVisible(true);
      // Send browser notification simultaneously
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Cue", { body: text, tag: "cue" });
      }
    }
  }, [lastDetection]);

  // Handle audio state changes
  useEffect(() => {
    if (audioState === "active") {
      setAppState("listening");
      startTranscription();
    } else if (audioState === "error") {
      setAppState("error");
      stopTranscription();
    }
  }, [audioState, startTranscription, stopTranscription]);

  function handleConfirmProfile(profile: UserProfile) {
    setUserProfile(profile);
    setAppState("configuring");
  }

  async function handleSelectAudioSource(source: AudioSource) {
    setAudioSource(source);
    setAppState("listening");
    await startAudio(source);
  }

  function handleReset() {
    if (isDemoMode) {
      stopDemo();
      setIsDemoMode(false);
      setDemoTurns([]);
    }
    stopAudio();
    stopTranscription();
    setAudioSource(null);
    setAppState(userProfile ? "configuring" : "idle");
    processedIds.current.clear();
  }

  return (
    <div className="min-h-screen p-6 bg-background">
      <Card className="min-h-[calc(100vh-48px)] w-full max-w-[1440px] mx-auto flex flex-col">
        <Card.Header className="flex items-center justify-between min-h-[76px] px-5 py-4">
          <div>
            <Typography.Paragraph
              size="sm"
              className="text-default-500 uppercase tracking-wide mb-1"
            >
              Cue live panel
            </Typography.Paragraph>
            <Typography.Heading level={1} className="text-[27px] font-semibold">
              Cue
            </Typography.Heading>
          </div>
          <StatusBar state={isDemoMode ? "demo" : appState} />
        </Card.Header>
        <Separator />

        {appState !== "listening" ? (
          <Card.Content className="flex flex-col gap-6 p-6 max-w-lg">
            <NotificationBanner />
            <UserConfig onConfirm={handleConfirmProfile} disabled={false} />
            <div className="flex flex-col gap-2">
              <Typography.Paragraph size="sm" className="text-default-500">
                音频源
              </Typography.Paragraph>
              <AudioSourceSelector
                onSelect={handleSelectAudioSource}
                currentSource={audioSource}
                disabled={!userProfile}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Typography.Paragraph size="sm" className="text-default-500">
                快速演示
              </Typography.Paragraph>
              <Button
                variant="outline"
                isDisabled={!userProfile}
                onPress={handleStartDemo}
              >
                演示模式（无需音频）
              </Button>
            </div>
            {appState === "error" && audioError && (
              <div className="flex flex-col gap-2">
                <Typography.Paragraph size="sm" className="text-danger">
                  {audioError}
                </Typography.Paragraph>
                <Button variant="outline" onPress={handleReset}>
                  重试
                </Button>
              </div>
            )}
          </Card.Content>
        ) : (
          <Card.Content className="flex-1 min-h-0 p-4">
            <CuePanel
              transcriptTurns={isDemoMode ? demoTurns : turns}
              partialText={isDemoMode ? "" : partialText}
              candidates={candidates}
              cueFrameDisplayText={cueFrameDisplayText}
              cueText={cueText}
              cueVisible={cueVisible}
              onCloseCue={() => setCueVisible(false)}
              appState={appState}
              isProcessing={isProcessing}
              isCueFrameUpdating={isUpdating}
              error={detectionError}
            />
          </Card.Content>
        )}
      </Card>
    </div>
  );
}
