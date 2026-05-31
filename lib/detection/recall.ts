import type { AliasCandidate, RecallHit } from "@/lib/types";

const SECOND_PERSON_PATTERNS = [
  "你怎么看",
  "你来讲",
  "你来说",
  "你来讲一下",
  "你来说一下",
  "你来确认",
  "你确认一下",
  "你觉得",
  "你认为",
  "你说呢",
  "你的看法",
  "你的意见",
  "你的想法",
  "你这边",
  "你们这边",
  "你怎么说",
  "你说一下",
  "你补充",
  "你补充一下",
  "你来回答",
  "你回答一下",
  "你先说",
  "你说说",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAliasPattern(text: string): RegExp {
  return new RegExp(escapeRegex(text), "gi");
}

function mapKindToHitType(
  kind: AliasCandidate["kind"],
): RecallHit["hitType"] {
  switch (kind) {
    case "canonical":
      return "exact_name";
    case "explicit_nickname":
      return "nickname";
    case "generated_alias":
      return "nickname";
    case "weak_alias":
      return "weak_alias";
    case "role_based":
      return "weak_alias";
  }
}

export function recallCandidates(
  sentence: string,
  aliases: AliasCandidate[],
): RecallHit[] {
  const hits: RecallHit[] = [];
  const lowerSentence = sentence.toLowerCase();

  for (const alias of aliases) {
    const pattern = buildAliasPattern(alias.text);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sentence)) !== null) {
      hits.push({
        alias,
        matchedText: match[0],
        hitType: mapKindToHitType(alias.kind),
        position: match.index,
      });
    }
    // Also check case-insensitive for non-Chinese aliases
    if (alias.text.toLowerCase() !== alias.text) {
      const lowerPattern = buildAliasPattern(alias.text.toLowerCase());
      while ((match = lowerPattern.exec(lowerSentence)) !== null) {
        const alreadyCovered = hits.some(
          (h) => h.position === match!.index && h.alias === alias,
        );
        if (!alreadyCovered) {
          hits.push({
            alias,
            matchedText: match[0],
            hitType: mapKindToHitType(alias.kind),
            position: match.index,
          });
        }
      }
    }
  }

  // Check second-person question patterns
  for (const pattern of SECOND_PERSON_PATTERNS) {
    const idx = sentence.indexOf(pattern);
    if (idx !== -1) {
      hits.push({
        alias: {
          text: pattern,
          kind: "weak_alias",
          prior: 0.3,
          source: "system",
        },
        matchedText: pattern,
        hitType: "second_person",
        position: idx,
      });
    }
  }

  // Check domain keywords
  for (const alias of aliases) {
    if (alias.kind === "role_based") {
      const pattern = buildAliasPattern(alias.text);
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(sentence)) !== null) {
        const alreadyCovered = hits.some(
          (h) => h.position === match!.index && h.alias.text === alias.text,
        );
        if (!alreadyCovered) {
          hits.push({
            alias,
            matchedText: match[0],
            hitType: "domain_keyword",
            position: match.index,
          });
        }
      }
    }
  }

  return hits;
}
