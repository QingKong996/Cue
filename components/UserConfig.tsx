"use client";

import { useState } from "react";
import { Button, Input } from "@heroui/react";
import type { UserProfile, AliasCandidate } from "@/lib/types";

type UserConfigProps = {
  onConfirm: (profile: UserProfile) => void;
  disabled: boolean;
};

export function UserConfig({ onConfirm, disabled }: UserConfigProps) {
  const [canonicalName, setCanonicalName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [nicknamesRaw, setNicknamesRaw] = useState("");
  const [role, setRole] = useState("");
  const [team, setTeam] = useState("");
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <div className="text-default-500 text-sm">
        用户信息已确认
      </div>
    );
  }

  function handleConfirm() {
    const trimmed = canonicalName.trim();
    if (!trimmed) return;

    const aliases: AliasCandidate[] = [
      { text: trimmed, kind: "canonical", prior: 1.0, source: "user" },
    ];

    if (englishName.trim()) {
      aliases.push({
        text: englishName.trim(),
        kind: "explicit_nickname",
        prior: 0.85,
        source: "user",
      });
    }

    const nicknames = nicknamesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const nick of nicknames) {
      aliases.push({
        text: nick,
        kind: "explicit_nickname",
        prior: 0.8,
        source: "user",
      });
    }

    const profile: UserProfile = {
      canonicalName: trimmed,
      englishName: englishName.trim() || undefined,
      nicknames: nicknames.length > 0 ? nicknames : undefined,
      role: role.trim() || undefined,
      team: team.trim() || undefined,
      domainKeywords: keywordsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      aliases,
    };

    onConfirm(profile);
    setConfirmed(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-default-500">主称呼</span>
        <Input
          placeholder="你的名字"
          value={canonicalName}
          onChange={(e) => setCanonicalName(e.target.value)}
          required
          disabled={disabled}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-default-500">英文名</span>
        <Input
          placeholder="可选"
          value={englishName}
          onChange={(e) => setEnglishName(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-default-500">昵称</span>
        <Input
          placeholder="逗号分隔，可选"
          value={nicknamesRaw}
          onChange={(e) => setNicknamesRaw(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-default-500">职位</span>
        <Input
          placeholder="可选"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-default-500">团队</span>
        <Input
          placeholder="可选"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-default-500">负责领域关键词</span>
        <Input
          placeholder="逗号分隔，可选"
          value={keywordsRaw}
          onChange={(e) => setKeywordsRaw(e.target.value)}
          disabled={disabled}
        />
      </label>
      <Button
        variant="primary"
        isDisabled={disabled || !canonicalName.trim()}
        onPress={handleConfirm}
      >
        确认
      </Button>
    </div>
  );
}
