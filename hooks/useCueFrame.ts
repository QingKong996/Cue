"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CUEFRAME_UPDATE_INTERVAL_MS, MAX_CONTEXT_MINUTES } from "@/lib/constants";
import { createCueFrameManager } from "@/lib/context/cueframe";
import type { createTranscriptManager } from "@/lib/context/transcript";
import type { CueFrame, UserProfile } from "@/lib/types";

export function useCueFrame(
  transcriptManager: ReturnType<typeof createTranscriptManager> | null,
  profile: UserProfile | null,
): {
  cueFrame: CueFrame | null;
  displayText: string;
  isUpdating: boolean;
  lastUpdated: number | null;
  forceUpdate: () => Promise<void>;
} {
  const managerRef = useRef(createCueFrameManager());
  const [cueFrame, setCueFrame] = useState<CueFrame | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Store latest values in refs so the interval callback always sees them
  const tmRef = useRef(transcriptManager);
  tmRef.current = transcriptManager;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const doUpdate = useCallback(async () => {
    const manager = managerRef.current;
    const tm = tmRef.current;
    const p = profileRef.current;
    console.log("[CueFrame] doUpdate called, tm:", !!tm, "profile:", !!p);
    if (!tm || !p) return;
    if (!manager.shouldUpdate()) {
      console.log("[CueFrame] shouldUpdate=false");
      return;
    }

    const newTurns = tm.getRecentMinutes(MAX_CONTEXT_MINUTES);
    console.log("[CueFrame] turns available:", newTurns.length);
    if (newTurns.length === 0) return;

    console.log("[CueFrame] calling API...");
    setIsUpdating(true);
    try {
      const input = {
        previousFrame: manager.getCurrent(),
        newTurns,
        userProfile: p,
        updatedAt: Date.now(),
      };
      const frame = await manager.update(input);
      console.log("[CueFrame] API success:", frame.macroTopic);
      setCueFrame(frame);
      setDisplayText(manager.formatForDisplay(frame));
      setLastUpdated(frame.updatedAt);
    } catch {
      console.warn("[CueFrame] update failed, will retry next cycle");
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const forceUpdate = useCallback(async () => {
    const manager = managerRef.current;
    const tm = tmRef.current;
    const p = profileRef.current;
    if (!tm || !p) return;

    const newTurns = tm.getRecentMinutes(MAX_CONTEXT_MINUTES);
    if (newTurns.length === 0) return;

    setIsUpdating(true);
    try {
      const input = {
        previousFrame: manager.getCurrent(),
        newTurns,
        userProfile: p,
        updatedAt: Date.now(),
      };
      const frame = await manager.update(input);
      setCueFrame(frame);
      setDisplayText(manager.formatForDisplay(frame));
      setLastUpdated(frame.updatedAt);
    } catch {
      // keep previous frame on failure
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Single interval that runs as long as the component is mounted
  useEffect(() => {
    // First update after 3 seconds
    const initTimer = setTimeout(() => {
      doUpdate();
    }, 3000);

    // Then every 30 seconds
    const id = setInterval(() => {
      doUpdate();
    }, CUEFRAME_UPDATE_INTERVAL_MS);

    return () => {
      clearTimeout(initTimer);
      clearInterval(id);
    };
  }, [doUpdate]);

  return { cueFrame, displayText, isUpdating, lastUpdated, forceUpdate };
}
