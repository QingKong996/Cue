# Cue 任务执行计划

## 总体架构

```
Cue/
├── app/
│   ├── layout.tsx                  # 根布局（需加入 HeroUI Provider）
│   ├── page.tsx                    # 主页面（需拆解为组合式页面）
│   ├── globals.css                 # 全局样式
│   └── api/
│       ├── health/route.ts         # 健康检查
│       ├── session/route.ts        # 会话管理
│       ├── asr/route.ts            # ASR 桥接
│       └── llm/
│           ├── alias/route.ts      # 称呼候选生成
│           ├── detect/route.ts     # 语义判定
│           ├── cueframe/route.ts   # CueFrame 更新
│           └── cue/route.ts        # 正式 Cue 生成
├── components/
│   ├── CuePanel.tsx                # 主面板容器
│   ├── TranscriptView.tsx          # 实时转写视图
│   ├── CandidateList.tsx           # 候选判定列表
│   ├── CandidateCard.tsx           # 单个候选卡片
│   ├── CueFrameView.tsx            # CueFrame 展示
│   ├── CueDisplay.tsx              # 最终 Cue 提示
│   ├── AudioSourceSelector.tsx     # 音频源选择器
│   ├── UserConfig.tsx              # 用户称呼配置
│   ├── StatusBar.tsx               # 运行状态栏
│   └── NotificationBanner.tsx      # 通知权限提示
├── lib/
│   ├── types.ts                    # 全局类型定义
│   ├── constants.ts                # 阈值、模型名等常量
│   ├── audio/
│   │   ├── capture.ts              # getUserMedia / getDisplayMedia
│   │   └── processor.ts            # Web Audio API 音频处理
│   ├── asr/
│   │   ├── client.ts               # 浏览器端 ASR 客户端
│   │   └── volcengine.ts           # 火山引擎 ASR 协议封装
│   ├── llm/
│   │   ├── client.ts               # DeepSeek API 封装
│   │   ├── prompts.ts              # prompt 模板
│   │   └── parsers.ts              # LLM 输出解析
│   ├── detection/
│   │   ├── recall.ts               # 候选召回
│   │   ├── semantic.ts             # 语义判定
│   │   ├── confidence.ts           # 置信度融合
│   │   └── decision.ts             # 决策器
│   ├── context/
│   │   ├── transcript.ts           # 转写上下文管理
│   │   └── cueframe.ts             # CueFrame 维护
│   └── notification.ts             # Web Notifications 封装
├── hooks/
│   ├── useAudioCapture.ts          # 音频采集 hook
│   ├── useTranscript.ts            # 实时转写 hook
│   ├── useDetection.ts             # 点名检测 hook
│   ├── useCueFrame.ts              # CueFrame 维护 hook
│   └── useNotification.ts          # 通知 hook
└── .env.local                      # 环境变量（不提交）
```

## 阶段依赖关系

```
阶段 0（基础设施）
 ├─→ 阶段 1（UI 拆解）─────┐
 ├─→ 阶段 2（音频采集）─────┤
 ├─→ 阶段 3（API 骨架）─────┤
 │                           │
 │   阶段 2 + 阶段 3 ──→ 阶段 4（ASR 桥接）
 │                           │
 │   阶段 4 ──┬──→ 阶段 5（检测管线）──┐
 │            └──→ 阶段 6（CueFrame）──┤
 │                                     │
 │   阶段 5 + 阶段 6 ──→ 阶段 7（Cue 生成与展示）
 │                                     │
 └── 阶段 1 + 阶段 7 ──→ 阶段 8（端到端整合）──→ 阶段 9（打磨）
```

---

## 阶段 0：基础设施与环境准备

里程碑：项目可正常构建，环境变量就位，类型系统建立。

| 编号 | 任务 |
|------|------|
| 0.1 | 创建 `.env.local` 模板 |
| 0.2 | 创建 `lib/types.ts`（所有核心类型） |
| 0.3 | 创建 `lib/constants.ts`（阈值、模型名等） |
| 0.4 | 改造 `app/layout.tsx` 挂载 HeroUIProvider |
| 0.5 | 验证构建 `npm run build` |

## 阶段 1：UI 组件拆解

里程碑：page.tsx 拆解为独立组件，数据仍为 mock，但结构已是真实架构。

| 编号 | 任务 |
|------|------|
| 1.1 | 创建 `components/CandidateCard.tsx` |
| 1.2 | 创建 `components/CandidateList.tsx` |
| 1.3 | 创建 `components/TranscriptView.tsx` |
| 1.4 | 创建 `components/CueFrameView.tsx` |
| 1.5 | 创建 `components/CueDisplay.tsx` |
| 1.6 | 创建 `components/StatusBar.tsx` |
| 1.7 | 重写 `app/page.tsx` 组合所有组件 |

## 阶段 2：音频采集

里程碑：用户可选择音频源，浏览器成功获取 MediaStream，音频数据可被处理和分片。

| 编号 | 任务 |
|------|------|
| 2.1 | 创建 `lib/audio/capture.ts` |
| 2.2 | 创建 `lib/audio/processor.ts` |
| 2.3 | 创建 `components/AudioSourceSelector.tsx` |
| 2.4 | 创建 `components/UserConfig.tsx` |
| 2.5 | 创建 `hooks/useAudioCapture.ts` |
| 2.6 | 创建 `components/NotificationBanner.tsx` |

## 阶段 3：后端 API 路由

里程碑：所有 API 路由骨架就位，DeepSeek 客户端封装可调用。

| 编号 | 任务 |
|------|------|
| 3.1 | 创建 `lib/llm/client.ts` |
| 3.2 | 创建 `lib/llm/prompts.ts` |
| 3.3 | 创建 `lib/llm/parsers.ts` |
| 3.4 | 创建 `app/api/health/route.ts` |
| 3.5 | 创建 `app/api/session/route.ts` |
| 3.6 | 创建 `app/api/llm/alias/route.ts` |
| 3.7 | 创建 `app/api/llm/detect/route.ts` |
| 3.8 | 创建 `app/api/llm/cueframe/route.ts` |
| 3.9 | 创建 `app/api/llm/cue/route.ts` |

## 阶段 4：ASR 桥接

里程碑：音频流通过后端转发至火山引擎 ASR，返回实时转写文本。

| 编号 | 任务 |
|------|------|
| 4.1 | 创建 `lib/asr/volcengine.ts` |
| 4.2 | 创建 `lib/asr/client.ts` |
| 4.3 | 创建 `app/api/asr/route.ts` |
| 4.4 | 创建 `hooks/useTranscript.ts` |
| 4.5 | 更新 `components/TranscriptView.tsx` 接入实时数据 |

## 阶段 5：检测管线

里程碑：候选召回 → 语义判定 → 置信度融合 → 决策器完整链路。

| 编号 | 任务 |
|------|------|
| 5.1 | 创建 `lib/detection/recall.ts` |
| 5.2 | 创建 `lib/detection/semantic.ts` |
| 5.3 | 创建 `lib/detection/confidence.ts` |
| 5.4 | 创建 `lib/detection/decision.ts` |
| 5.5 | 创建 `hooks/useDetection.ts` |
| 5.6 | 更新 `components/CandidateList.tsx` 接入实时数据 |

## 阶段 6：上下文管理与 CueFrame

里程碑：CueFrame 按分钟级节奏自动更新。

| 编号 | 任务 |
|------|------|
| 6.1 | 创建 `lib/context/transcript.ts` |
| 6.2 | 创建 `lib/context/cueframe.ts` |
| 6.3 | 创建 `hooks/useCueFrame.ts` |
| 6.4 | 更新 `components/CueFrameView.tsx` 接入实时数据 |

## 阶段 7：Cue 生成与展示

里程碑：完整 fast path 闭合 — 检测到点名 → 生成 Cue → 页面展示 + 浏览器通知。

| 编号 | 任务 |
|------|------|
| 7.1 | 创建 `lib/notification.ts` |
| 7.2 | 创建 `hooks/useNotification.ts` |
| 7.3 | 在 useDetection 中接入 Cue 生成逻辑 |
| 7.4 | 更新 `components/CueDisplay.tsx` 接入实时 Cue |
| 7.5 | 整合通知流程 |

## 阶段 8：端到端整合

里程碑：全链路跑通，用户配置 → 音频采集 → ASR → 检测 → CueFrame → Cue → 展示。

| 编号 | 任务 |
|------|------|
| 8.1 | 创建 `components/CuePanel.tsx` 主面板容器 |
| 8.2 | 重写 `app/page.tsx` 组装完整流程 |
| 8.3 | 全局状态协调与生命周期管理 |
| 8.4 | 错误处理全局化 |
| 8.5 | 连接状态管理与 StatusBar 整合 |

## 阶段 9：打磨与优化

里程碑：产品可演示，体验流畅，错误场景覆盖完整。

| 编号 | 任务 |
|------|------|
| 9.1 | 端到端延迟优化（目标 < 2 秒） |
| 9.2 | 冷却与防抖逻辑 |
| 9.3 | 动画与交互体验细节 |
| 9.4 | 演示场景准备（录制音频、编写脚本） |
| 9.5 | 错误场景覆盖测试 |
| 9.6 | 安全配置（headers、CORS） |

---

## 关键风险

| 风险 | 缓解策略 |
|------|----------|
| 火山引擎 ASR 协议接入复杂 | 先用 HTTP 流式模式；或临时用 Whisper 验证管线 |
| DeepSeek API 延迟波动 | fast path 全程用 flash；设 3 秒超时降级为 CueFrame 摘要 |
| Next.js 不支持 WebSocket | 用 SSE/chunked response 作浏览器到后端通道 |
| 浏览器标签页共享无音频 | 检测音频轨道存在性，给出明确提示 |
