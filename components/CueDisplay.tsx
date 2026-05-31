"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Typography } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { sendCueNotification } from "@/lib/notification";
import { CUE_DISPLAY_DURATION_MS } from "@/lib/constants";

type CueDisplayProps = {
  cueText: string | null;
  visible: boolean;
  onClose: () => void;
};

export function CueDisplay({ cueText, visible, onClose }: CueDisplayProps) {
  const prevCueRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(1);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, 1 - elapsed / CUE_DISPLAY_DURATION_MS);
    setProgress(remaining);
    if (remaining > 0) {
      animFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    if (cueText && cueText !== prevCueRef.current) {
      sendCueNotification(cueText);
    }
    prevCueRef.current = cueText;
  }, [cueText]);

  // Auto-dismiss timer with progress tracking
  useEffect(() => {
    clearTimer();
    if (visible && cueText) {
      startTimeRef.current = Date.now();
      setProgress(1);
      animFrameRef.current = requestAnimationFrame(updateProgress);
      timerRef.current = setTimeout(() => {
        onClose();
      }, CUE_DISPLAY_DURATION_MS);
    } else {
      setProgress(1);
    }
    return clearTimer;
  }, [visible, cueText, onClose, clearTimer, updateProgress]);

  return (
    <AnimatePresence>
      {visible && cueText !== null && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <Card
            className="shadow-lg border border-success/30"
            style={{
              boxShadow:
                "0 0 20px rgba(34, 197, 94, 0.15), 0 8px 32px rgba(0, 0, 0, 0.12)",
            }}
          >
            <Card.Header className="flex items-center justify-between pb-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <Typography.Heading level={3} className="text-sm font-semibold">
                  Cue
                </Typography.Heading>
              </div>
              <button
                onClick={onClose}
                className="text-default-500 hover:text-default-700 text-sm"
                aria-label="关闭 Cue"
              >
                关闭
              </button>
            </Card.Header>
            <Card.Content className="pt-1">
              <Typography.Paragraph size="sm">
                {cueText}
              </Typography.Paragraph>
              {/* Progress bar */}
              <div className="mt-2 h-1 w-full rounded-full bg-default-200 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-success/60"
                  style={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
