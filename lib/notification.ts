function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  return Notification.requestPermission();
}

export function getPermissionState(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export function sendCueNotification(cueText: string): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission === "granted") {
    new Notification("Cue", { body: cueText, tag: "cue-notification" });
  }
}
