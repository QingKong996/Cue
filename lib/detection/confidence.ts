import type { AddressingDecision, RecallHit } from "@/lib/types";

export function fuseConfidence(
  recallHits: RecallHit[],
  decision: AddressingDecision,
): number {
  if (recallHits.length === 0) return 0;

  const nameHits = recallHits.filter(
    (h) => h.hitType !== "second_person" && h.hitType !== "domain_keyword",
  );

  // Base: highest alias prior from name-related hits
  let score = nameHits.reduce(
    (max, h) => Math.max(max, h.alias.prior),
    0,
  );

  // If no name hits, use a low base from second-person patterns
  if (score === 0) {
    const hasSecondPerson = recallHits.some(
      (h) => h.hitType === "second_person",
    );
    score = hasSecondPerson ? 0.3 : 0;
  }

  // Intent boost: multiply by LLM decision confidence
  score *= decision.confidence;

  // Direct name boost
  const hasExactName = recallHits.some((h) => h.hitType === "exact_name");
  if (hasExactName) {
    score += 0.15;
  }

  // Second person + name combo boost
  const hasSecondPerson = recallHits.some(
    (h) => h.hitType === "second_person",
  );
  const hasNameHit = nameHits.length > 0;
  if (hasSecondPerson && hasNameHit) {
    score += 0.1;
  }

  // Weak alias penalty
  const bestNameHitType = nameHits.reduce<RecallHit["hitType"] | null>(
    (best, h) => {
      if (!best) return h.hitType;
      const priority: Record<string, number> = {
        exact_name: 4,
        nickname: 3,
        weak_alias: 1,
        domain_keyword: 0,
      };
      return (priority[h.hitType] ?? 0) > (priority[best] ?? 0)
        ? h.hitType
        : best;
    },
    null,
  );
  if (bestNameHitType === "weak_alias") {
    score *= 0.7;
  }

  // Not-user penalty
  if (decision.addresseeType === "not_user") {
    score *= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}
