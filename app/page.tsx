"use client";

import {
  Card,
  Chip,
  ScrollShadow,
  Separator,
  Surface,
  TextArea,
  Typography,
  cn,
} from "@heroui/react";

type CandidateStatus = "rejected" | "watching" | "confirmed";

type Candidate = {
  id: string;
  status: CandidateStatus;
  label: string;
  confidence: number;
  text: string;
};

const statusCopy: Record<CandidateStatus, string> = {
  rejected: "静默",
  watching: "候选",
  confirmed: "触发",
};

const statusColorMap: Record<CandidateStatus, "success" | "warning" | "danger"> = {
  confirmed: "success",
  watching: "warning",
  rejected: "danger",
};

const statusBorderClass: Record<CandidateStatus, string> = {
  confirmed: "border-success/54 bg-success-soft",
  watching: "border-warning/54 bg-warning-soft",
  rejected: "border-danger/54 bg-danger-soft",
};

const candidates: Candidate[] = [
  {
    id: "candidate-1",
    status: "confirmed",
    label: "直接点名",
    confidence: 92,
    text: "小陈，你们技术侧能不能把 Beta 发布时间提前到 5 月底？",
  },
  {
    id: "candidate-2",
    status: "watching",
    label: "弱称呼",
    confidence: 64,
    text: "技术这边谁来确认一下压缩测试周期的风险？",
  },
  {
    id: "candidate-3",
    status: "rejected",
    label: "仅提及",
    confidence: 18,
    text: "小陈刚才提到的接口风险，后面可以再单独看。",
  },
  {
    id: "candidate-4",
    status: "watching",
    label: "角色指向",
    confidence: 57,
    text: "这块如果工程侧有阻塞，需要现在讲出来。",
  },
];

const transcript = `10:31  产品：Q3 的目标已经压到两个主线，一个是 Beta 发布，一个是销售线索回收。

10:32  运营：如果 Beta 能提前两周，市场活动可以跟着往前排，但我们需要确认技术风险。

10:33  产品：现在主要卡在测试周期，尤其是支付回调和权限模块。

10:34  研发：权限模块可以拆开上线，支付回调最好保留完整回归。

10:35  产品：小陈，你们技术侧能不能把 Beta 发布时间提前到 5 月底？`;

const cueFrame = `时间范围：过去约 4 分钟

宏观话题：Beta 发布时间是否从 6 月中旬提前到 5 月底。

关键变化：市场侧希望提前两周配合活动；技术侧目前主要担心测试周期被压缩。

与你相关：需要判断技术侧是否能接受提前发布，以及最大风险是什么。

可回应角度：可以先区分权限模块和支付回调，给出可提前的部分与必须保留完整回归的部分。`;

function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <Surface
      variant="default"
      className={cn(
        "flex-none min-h-[86px] rounded-lg border sm:min-h-[104px]",
        statusBorderClass[candidate.status]
      )}
    >
      <div className="grid grid-cols-[92px_minmax(0,1fr)_60px] items-center h-full gap-2.5 p-3 sm:grid-cols-[72px_minmax(0,1fr)_52px] sm:gap-2">
        <div className="flex flex-col gap-2 min-w-0">
          <Typography.Paragraph size="sm" className="text-default-500">
            {candidate.label}
          </Typography.Paragraph>
          <Typography.Paragraph size="sm" className="text-default-500">
            {statusCopy[candidate.status]}
          </Typography.Paragraph>
        </div>
        <TextArea
          readOnly
          rows={2}
          value={candidate.text}
          aria-label={`${candidate.label} ${statusCopy[candidate.status]}`}
        />
        <Chip
          size="sm"
          variant="soft"
          color={statusColorMap[candidate.status]}
          className="min-w-[54px] justify-center"
        >
          {candidate.confidence}%
        </Chip>
      </div>
    </Surface>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen p-6 bg-background">
      <Card className="min-h-[calc(100vh-48px)] w-full max-w-[1440px] mx-auto">
        <Card.Header className="flex items-center justify-between min-h-[76px] px-5 py-4">
          <div>
            <Typography.Paragraph
              size="sm"
              className="text-default-500 uppercase tracking-wide mb-1"
            >
              Cue live panel
            </Typography.Paragraph>
            <Typography.Heading level={1} className="text-[27px] font-semibold">
              Cue
            </Typography.Heading>
          </div>
          <Chip size="sm" variant="soft" color="default" className="text-default-500">
            Dark mode
          </Chip>
        </Card.Header>
        <Separator />
        <Card.Content className="grid grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] gap-4 p-4 lg:grid-cols-1">
          <section aria-label="会议转写" className="min-w-0">
            <label className="flex flex-col gap-2 w-full">
              <Typography.Paragraph size="sm" className="text-default-500">
                会议上下文
              </Typography.Paragraph>
              <TextArea
                readOnly
                rows={20}
                value={transcript}
                className="min-h-[calc(100vh-170px)] lg:min-h-[460px]"
              />
            </label>
          </section>

          <aside
            aria-label="候选判定与 CueFrame"
            className="min-w-0 grid grid-rows-[286px_minmax(260px,1fr)] gap-4 lg:grid-rows-[372px_auto]"
          >
            <section aria-label="候选被 call 判定">
              <ScrollShadow
                orientation="vertical"
                className="flex flex-col gap-3 min-h-0 overflow-y-auto h-full"
              >
                {candidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} />
                ))}
              </ScrollShadow>
            </section>

            <section aria-label="CueFrame">
              <label className="flex flex-col gap-2 w-full">
                <Typography.Paragraph size="sm" className="text-default-500">
                  CueFrame
                </Typography.Paragraph>
                <TextArea
                  readOnly
                  rows={11}
                  value={cueFrame}
                  className="min-h-[260px]"
                />
              </label>
            </section>
          </aside>
        </Card.Content>
      </Card>
    </div>
  );
}
