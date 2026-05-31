import type {
  AddressingDecision,
  Candidate,
  DetectionResult,
} from "@/lib/types";
import {
  CANDIDATE_TIMEOUT_MS,
  CONFIDENCE_SHOW,
  CONFIDENCE_WATCH,
  CUE_COOLDOWN_MS,
} from "@/lib/constants";

export type DecisionState = {
  lastCueTime: number;
  activeCandidates: Map<string, Candidate>;
  candidateTimers: Map<string, number>;
  nextId: number;
};

function addresseeTypeToLabel(addresseeType: AddressingDecision["addresseeType"]): string {
  switch (addresseeType) {
    case "direct_name":
      return "姓名点名";
    case "nickname":
      return "昵称点名";
    case "weak_alias":
      return "疑似点名";
    case "role_context":
      return "角色相关";
    case "not_user":
      return "非本人";
  }
}

export function createDecisionMaker(): {
  decide: (
    sentence: string,
    confidence: number,
    decision: AddressingDecision,
  ) => DetectionResult | null;
  tick: () => void;
  getState: () => DecisionState;
} {
  const state: DecisionState = {
    lastCueTime: 0,
    activeCandidates: new Map(),
    candidateTimers: new Map(),
    nextId: 1,
  };

  function decide(
    sentence: string,
    confidence: number,
    decision: AddressingDecision,
  ): DetectionResult | null {
    const now = Date.now();
    const id = `c${state.nextId++}`;
    const label = addresseeTypeToLabel(decision.addresseeType);

    let action: DetectionResult["action"];
    let status: Candidate["status"];

    if (
      confidence >= CONFIDENCE_SHOW &&
      now - state.lastCueTime >= CUE_COOLDOWN_MS
    ) {
      action = "show";
      status = "confirmed";
      state.lastCueTime = now;
    } else if (confidence >= CONFIDENCE_WATCH) {
      action = "watch";
      status = "watching";
    } else {
      action = "silent";
      status = "rejected";
    }

    const candidate: Candidate = {
      id,
      status,
      label,
      confidence: Math.round(confidence * 100),
      text: sentence,
    };

    state.activeCandidates.set(id, candidate);
    state.candidateTimers.set(id, now);

    return {
      action,
      confidence,
      candidate,
      decision,
      cueText: null,
    };
  }

  function tick() {
    const now = Date.now();
    for (const [id, candidate] of state.activeCandidates) {
      const createdAt = state.candidateTimers.get(id) ?? 0;
      if (
        candidate.status === "watching" &&
        now - createdAt > CANDIDATE_TIMEOUT_MS
      ) {
        state.activeCandidates.set(id, { ...candidate, status: "rejected" });
        state.candidateTimers.delete(id);
      }
    }
  }

  function getState() {
    return state;
  }

  return { decide, tick, getState };
}
