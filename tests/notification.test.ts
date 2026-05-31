import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Notification API
const mockRequestPermission = vi.fn();
const mockNotification = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  // @ts-expect-error mock
  globalThis.Notification = {
    permission: "default",
    requestPermission: mockRequestPermission,
  };
  // @ts-expect-error mock
  globalThis.Notification = Object.assign(
    function (this: unknown, title: string, options?: NotificationOptions) {
      mockNotification(title, options);
      this.close = vi.fn();
    },
    {
      permission: "default",
      requestPermission: mockRequestPermission,
    }
  );
  // @ts-expect-error mock
  vi.stubGlobal("Notification", globalThis.Notification);
});

describe("lib/notification", () => {
  it("requestPermission calls Notification.requestPermission", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    const { requestPermission } = await import("@/lib/notification");
    const result = await requestPermission();
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(result).toBe("granted");
  });

  it("getPermissionState returns current permission", async () => {
    const { getPermissionState } = await import("@/lib/notification");
    expect(getPermissionState()).toBe("default");
  });

  it("sendCueNotification creates notification when granted", async () => {
    // @ts-expect-error mock
    vi.stubGlobal("Notification", Object.assign(mockNotification, { permission: "granted" }));
    const { sendCueNotification } = await import("@/lib/notification");
    sendCueNotification("测试提示文本");
    expect(mockNotification).toHaveBeenCalledWith(
      "Cue",
      expect.objectContaining({ body: "测试提示文本" })
    );
  });

  it("sendCueNotification does nothing when denied", async () => {
    // @ts-expect-error mock
    vi.stubGlobal("Notification", Object.assign(mockNotification, { permission: "denied" }));
    const { sendCueNotification } = await import("@/lib/notification");
    sendCueNotification("测试提示文本");
    expect(mockNotification).not.toHaveBeenCalled();
  });
});
