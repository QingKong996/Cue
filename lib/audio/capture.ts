/**
 * Browser audio stream acquisition utilities.
 */

export async function createMicStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err: unknown) {
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError") {
        throw new Error("麦克风权限被拒绝，请在浏览器设置中允许麦克风访问");
      }
      if (err.name === "NotFoundError") {
        throw new Error("未找到可用的麦克风设备");
      }
      if (err.name === "NotReadableError") {
        throw new Error("麦克风被其他应用占用");
      }
    }
    throw new Error("获取麦克风失败: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function createScreenStream(): Promise<MediaStream> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      throw new Error("屏幕共享权限被拒绝");
    }
    throw new Error("获取屏幕共享失败: " + (err instanceof Error ? err.message : String(err)));
  }

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('所选标签页没有音频，请确保勾选“共享标签页音频”选项');
  }

  return stream;
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
