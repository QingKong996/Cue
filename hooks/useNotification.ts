"use client";

import { useCallback, useState } from "react";
import {
  getPermissionState,
  requestPermission as requestPermissionApi,
  sendCueNotification,
} from "@/lib/notification";

export function useNotification(): {
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  sendNotification: (cueText: string) => void;
} {
  const [permission, setPermission] = useState<NotificationPermission>(
    getPermissionState(),
  );

  const requestPermission = useCallback(async () => {
    const result = await requestPermissionApi();
    setPermission(result);
  }, []);

  const sendNotification = useCallback((cueText: string) => {
    sendCueNotification(cueText);
  }, []);

  return { permission, requestPermission, sendNotification };
}
