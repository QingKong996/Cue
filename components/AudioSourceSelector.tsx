"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { AudioSource } from "../lib/types";

type AudioSourceSelectorProps = {
  onSelect: (source: AudioSource) => void;
  currentSource: AudioSource | null;
  disabled: boolean;
};

export function AudioSourceSelector({
  onSelect,
  currentSource,
  disabled,
}: AudioSourceSelectorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const micSupported = mounted
    ? !!navigator.mediaDevices?.getUserMedia
    : true;
  const screenSupported = mounted
    ? !!navigator.mediaDevices?.getDisplayMedia
    : true;

  return (
    <div className="flex gap-3">
      <span title={micSupported ? undefined : "此浏览器不支持麦克风录音"}>
        <Button
          variant={currentSource === "mic" ? "primary" : "outline"}
          isDisabled={disabled || !micSupported}
          onPress={() => onSelect("mic")}
        >
          麦克风
        </Button>
      </span>
      <span title={screenSupported ? undefined : "此浏览器不支持屏幕共享"}>
        <Button
          variant={currentSource === "screen" ? "primary" : "outline"}
          isDisabled={disabled || !screenSupported}
          onPress={() => onSelect("screen")}
        >
          标签页共享
        </Button>
      </span>
    </div>
  );
}
