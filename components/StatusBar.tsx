"use client";

import { Chip } from "@heroui/react";

type StatusBarState = "idle" | "configuring" | "listening" | "paused" | "error" | "demo";

type StatusBarProps = {
  state: StatusBarState;
  message?: string;
};

const stateColorMap: Record<StatusBarState, "default" | "success" | "warning" | "danger" | "accent"> = {
  idle: "default",
  configuring: "warning",
  listening: "success",
  paused: "warning",
  error: "danger",
  demo: "accent",
};

const stateLabel: Record<StatusBarState, string> = {
  idle: "空闲",
  configuring: "配置中",
  listening: "监听中",
  paused: "已暂停",
  error: "错误",
  demo: "演示中",
};

export function StatusBar({ state, message }: StatusBarProps) {
  return (
    <Chip size="sm" variant="soft" color={stateColorMap[state]} className="text-default-500">
      {message ?? stateLabel[state]}
    </Chip>
  );
}
