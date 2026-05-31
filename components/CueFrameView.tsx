"use client";

import { Spinner, TextArea, Typography } from "@heroui/react";

type CueFrameViewProps = {
  value?: string;
  displayText?: string;
  isUpdating?: boolean;
};

export function CueFrameView({ value, displayText, isUpdating }: CueFrameViewProps) {
  const text = displayText ?? value ?? "";
  return (
    <label className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <Typography.Paragraph size="sm" className="text-default-500">
          CueFrame
        </Typography.Paragraph>
        {isUpdating && (
          <div className="flex items-center gap-1">
            <Spinner size="sm" />
            <Typography.Paragraph size="sm" className="text-default-400">
              更新中...
            </Typography.Paragraph>
          </div>
        )}
      </div>
      <TextArea
        readOnly
        rows={11}
        value={text}
        className="min-h-[260px]"
      />
    </label>
  );
}
