"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";

export function NotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  async function handleRequest() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === "granted") {
    return null;
  }

  if (permission === "denied") {
    return (
      <div className="bg-default-100 border border-default-200 rounded-medium px-4 py-3 text-sm text-default-600">
        浏览器通知已被禁用。请在浏览器设置中允许通知以获得提醒功能。
      </div>
    );
  }

  return (
    <div className="bg-default-100 border border-default-200 rounded-medium px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-sm text-default-600">
        开启浏览器通知可在被提及时收到提醒。
      </span>
      <Button size="sm" variant="primary" onPress={handleRequest}>
        开启通知
      </Button>
    </div>
  );
}
