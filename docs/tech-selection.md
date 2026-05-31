# 技术选型

## 结论

Cue 的黑客松原型采用 **Next.js Web-first** 路线。

Next.js 足够承载第一版产品体验：它可以提供页面、权限引导、音频采集控制、实时状态、提示卡片，以及后端 API 代理。第一版不做桌面客户端，也不做会议平台集成；先把核心链路跑通：用户打开网页，选择音频来源，Cue 在被点名时给出上下文提示。

## 技术栈

- 框架：Next.js + React + TypeScript。
- 音频采集：浏览器 MediaDevices API。
- 音频处理：Web Audio API，必要时使用 MediaRecorder 做分片。
- 语音识别：字节跳动/火山引擎豆包流式语音识别模型 2.0。
- 服务端：Next.js Route Handlers 负责会话创建、密钥代理、转写/摘要接口转发。
- 实时通道：优先用浏览器到后端或第三方转写服务的流式连接；如果部署环境不适合长连接，再拆出独立 Node 服务。
- 通知展示：页面内 Cue 卡片 + 浏览器系统通知。
- 模型提供商：Demo 阶段统一使用 DeepSeek API。
- 模型分工：称呼候选生成和 CueFrame 使用 `deepseek-v4-pro`，点名语义检测和正式 Cue 使用 `deepseek-v4-flash`。
- 状态管理：React state 起步，复杂后再引入轻量 store。
- 样式：先用 CSS Modules 或 Tailwind，避免过早引入重型组件体系。

## 音频输入策略

第一版支持两种输入：

1. 麦克风输入：通过 `navigator.mediaDevices.getUserMedia({ audio: true })` 获取。
2. 标签页/屏幕共享音频：通过 `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` 获取。

需要明确限制：纯 Web 无法静默、稳定地捕获任意设备内音频。浏览器可以在用户授权后获取麦克风，也可以在屏幕/标签页共享时尝试包含音频，但是否有音频轨道取决于浏览器、系统和用户选择。对于黑客松原型，优先把演示场景设计成 Chrome 标签页音频或麦克风输入。

## 核心链路

```text
用户选择音频来源
  ↓
浏览器生成 MediaStream
  ↓
前端将音频流或音频分片送往服务端
  ↓
字节跳动流式 ASR 转写为实时文本
  ↓
并行进入两条路径
  ├─ 分钟级更新 CueFrame
  └─ 实时候选召回 → 语义检测 → 正式 Cue 生成 → 前端显示
```

## 点名检测

第一版采用混合策略：

- 用户在开始前配置姓名、英文名、昵称和常见称呼。
- 每个称呼都有置信度层级：主称呼最高，明确昵称次之，泛称或弱别名更低。
- 先用规则检测高置信触发，例如“名字 + 你怎么看”“名字 + 能不能”“名字 + 有什么意见”。
- 触发后再调用模型判断该句话是否真的是直接提问，降低误报。

这样可以把延迟和成本压低：不是每一句话都调用大模型，只在疑似点名时进入判断和摘要。

### 称呼置信度

点名检测不能只做字符串匹配。以用户叫“张三”为例：

- “张三”：主称呼，强触发。
- “三哥”“San”：如果用户主动配置为昵称，中高置信。
- “小张”：弱别名，低于“张三”，因为它可能指向任何姓张的人。
- “张工”“你”：上下文称呼，需要结合前后句、说话方向和问题句式判断。

弱别名命中时，不应立刻弹出 Cue。系统应该先进入候选状态，再结合以下信号提高或降低置信度：

- 句子是否是直接提问。
- 是否包含“你怎么看”“能不能”“这块你来讲”等指向性表达。
- 会议里是否可能存在其他同姓或同职能的人。
- 最近几轮对话是否正在讨论用户负责的领域。

只有综合分数超过阈值时，才展示提示；低分候选保持静默。

详细落地方案见 [点名检测设计](detection-design.md)。

## 上下文策略

保留最近几分钟的转写文本，按时间和说话轮次组织。同时维护一份较具体的 CueFrame，包含当前话题、开放问题、最近决定、用户相关信息和可能的回应角度。

CueFrame 不需要逐句实时更新，建议一分钟以上更新一次，或在明显话题切换时更新，因此使用 `deepseek-v4-pro`。每次更新时，把新增上下文和上一版 CueFrame 一起交给模型，让它增量生成新的 CueFrame。点名候选出现后，系统先用 `deepseek-v4-flash` 做快速语义检测；如果确认是在问用户，就把 CueFrame、当前问题和最近几轮原文交给 `deepseek-v4-flash` 生成正式 Cue；如果检测为假，保持静默。

Demo 模型选择：

- CueFrame：`deepseek-v4-pro`。它负责分钟级上下文框架，允许更慢，但需要更稳的宏观理解。
- 点名语义检测：`deepseek-v4-flash`。它负责快速判断候选句是否真的在问用户。
- 正式 Cue：`deepseek-v4-flash`。它负责在被点名后快速生成最终展示文案。
- 称呼候选生成：`deepseek-v4-pro`。它负责生成更完整的称呼、弱别名和可能的角色称呼。

## 语音识别

Demo 接入字节跳动/火山引擎豆包流式语音识别模型 2.0。优先使用双向流式模式，以便会议中“边说边出字”；如果接入复杂度过高，可退一步使用流式输入模式，按句返回识别结果。

浏览器端只负责采集音频，不直接暴露语音识别服务凭证。音频流应先进入 Next.js 后端或独立 Node ASR bridge，再由服务端连接字节跳动流式 ASR。

## 通知展示

实际使用时，用户很可能不在 Cue 页面前台，因此正式 Cue 生成后应同时触发两种展示：

- 页面内 Cue 卡片：用户切回 Cue 页面时可查看完整提示。
- 浏览器系统通知：用户在其他窗口或标签页时也能看到关键提示。

系统通知使用 Web Notifications API。首次使用时需要在用户手势中请求通知权限；只有权限为 `granted` 时才发送通知。通知内容应保持短，避免暴露过多会议敏感信息。点击通知时，前端应聚焦或打开 Cue 页面，并展示完整 Cue 卡片。

如果用户拒绝通知权限，Cue 仍应在页面内展示提示，并在设置区显示通知未开启状态。

提示目标不是完整复盘，而是回答：

- 刚才在讨论什么？
- 现在为什么问我？
- 我需要回应哪一个具体问题？

## 暂不选择的方案

- 桌面客户端：更适合长期产品，但黑客松阶段成本过高。
- 浏览器扩展：适合捕获会议标签页音频，但会增加安装和权限解释成本。
- 直接对接 Zoom/Teams/Meet API：集成复杂，且不一定解决“被点名瞬间”的实时体验。

## 参考

- MDN: `getUserMedia` - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN: Screen Capture API - https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API/Using_Screen_Capture
- MDN: MediaRecorder - https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN: Notifications API - https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- MDN: Using the Notifications API - https://developer.mozilla.org/docs/Web/API/Notifications_API/Using_the_Notifications_API
- DeepSeek API Models and Pricing - https://api-docs.deepseek.com/quick_start/pricing
- DeepSeek First API Call - https://api-docs.deepseek.com/
- 火山引擎豆包语音模型列表 - https://www.volcengine.com/docs/6561/2499930?lang=zh
- 火山引擎流式语音识别文档 - https://www.volcengine.com/docs/6561/80818?lang=en
