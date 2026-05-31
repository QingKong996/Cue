import { MAX_CONTEXT_TURNS } from "@/lib/constants";
import type { TranscriptTurn } from "@/lib/types";

export function createTranscriptManager() {
  const turns: TranscriptTurn[] = [];

  function addTurn(turn: TranscriptTurn) {
    turns.push(turn);
    if (turns.length > MAX_CONTEXT_TURNS) {
      turns.splice(0, turns.length - MAX_CONTEXT_TURNS);
    }
  }

  function getRecentTurns(count = 20): TranscriptTurn[] {
    return turns.slice(-count);
  }

  function getRecentMinutes(minutes: number): TranscriptTurn[] {
    const cutoff = Date.now() - minutes * 60_000;
    return turns.filter((t) => t.timestamp >= cutoff);
  }

  function getAllTurns(): TranscriptTurn[] {
    return [...turns];
  }

  function clear() {
    turns.length = 0;
  }

  function size() {
    return turns.length;
  }

  return { addTurn, getRecentTurns, getRecentMinutes, getAllTurns, clear, size };
}
