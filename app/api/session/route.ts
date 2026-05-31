import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const sessions = new Map<string, number>();

export async function POST() {
  const sessionId = randomUUID();
  sessions.set(sessionId, Date.now());
  return NextResponse.json({ sessionId });
}

export async function DELETE(request: Request) {
  const { sessionId } = await request.json();
  if (typeof sessionId !== "string" || !sessions.has(sessionId)) {
    return NextResponse.json(
      { error: "Invalid or unknown sessionId" },
      { status: 400 },
    );
  }
  sessions.delete(sessionId);
  return NextResponse.json({ ok: true });
}
