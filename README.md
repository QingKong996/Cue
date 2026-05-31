# Cue

### 只在你被点名的那一秒出现

> 一个开会时保持沉默、只在你被直接提问时，才把上下文递到你眼前的助手。
>
> 把注意力还给值得的事。

Cue 是一个为会议走神瞬间而生的项目。它不试图让你全程更专注，也不把会议变成另一块需要盯着看的屏幕；它只做一件事：平时彻底隐形，在你被直接点名的那一秒，把刚才讨论的前因后果递到你眼前。

## 问题

会议的信息密度常常配不上全程专注，但人又很难真正离开。哪怕已经在处理别的事情，心里也始终悬着一根弦：怕突然听到那句“你怎么看？”

我们把这根弦称为 **互动税**。

它不是单纯的走神问题，而是一种持续的低强度紧绷：你不一定真的听进去了多少，却必须为那个不可预测的被点名瞬间随时待命。代价是注意力被持续切割，无法投向更值得的工作。

## 解决方案

Cue 选择克制，而不是制造更多提醒。

- 平时不显示、不弹窗、不打扰。
- 持续理解会议上下文，但只等待一个触发条件：你被直接点名或被抛来问题。
- 一旦触发，Cue 立刻给出极短上下文，例如：“刚才在讨论 Q3 预算缩减，问题是技术侧能不能配合把上线时间提前两周。”
- 你只需要扫一眼，就能自然接话。

Cue 不是会后纪要，因为会后太晚；也不是全程话术助手，因为全程太吵。它只服务唯一真正关键的那一秒。

## 核心体验

```text
会议进行中
  ↓
Cue 静默监听并整理上下文
  ↓
有人说：“Alex，你怎么看？”
  ↓
Cue 检测到用户被点名
  ↓
屏幕边缘出现一句话摘要
  ↓
用户接住对话
```

理想状态下，Cue 出现得足够快、足够短、足够不打扰，让人感觉它不是另一个会议工具，而是一条只在危险瞬间展开的安全绳。

## 为谁而造

Cue 面向所有经历过“开会走神又怕被点名”的人，尤其适合：

- 高频参加低信息密度会议的知识工作者。
- 需要在会议中并行处理其他任务的人。
- ADHD、听觉处理障碍、容易短暂断线的人。
- 使用第二语言开会，需要更高上下文恢复成本的人。
- 远程会议中经常错过话题转折的人。

## 产品原则

- **克制优先**：Cue 的价值来自“少出现”，不是“多提醒”。
- **只在当下有用**：提示必须服务被点名的那一秒，而不是事后复盘。
- **短到能扫读**：输出应尽量是一句话，必要时最多扩展成 2-3 个要点。
- **默认不打扰**：没有被点名，就不占用用户注意力。
- **体面参与**：目标不是伪装专注，而是帮助人在短暂断线后重新接回对话。


## 部署

### 环境变量

在 `.env.local`（本地开发）或 Vercel 项目设置中配置以下变量：

```bash
# DeepSeek API（CueFrame 更新、语义判定、Cue 生成）
DEEPSEEK_API_KEY=your_deepseek_api_key

# 火山引擎 ASR（实时语音识别，仅本地开发可用）
VOLCENGINE_APP_KEY=your_app_id
VOLCENGINE_ACCESS_KEY_ID=your_access_token
VOLCENGINE_ACCESS_KEY_SECRET=your_secret_key
```

### Vercel 部署

1. Fork 或导入本仓库到 Vercel
2. Framework 选 Next.js，无需额外配置
3. 在 Settings → Environment Variables 中添加上述环境变量
4. 部署

Vercel 上演示模式和 DeepSeek Cue 生成完全可用。

默认使用 HTTP 非流式 ASR，Vercel 部署完全可用。如需更低延迟的流式识别，在本地运行 `npm run dev` 并切换为流式模式。

### 本地开发

```bash
git clone https://github.com/QingKong996/Cue.git
cd Cue
npm install
cp .env.local.example .env.local
# 编辑 .env.local 填入你的 API Key
npm run dev
```

打开 http://localhost:3000 ，填写主称呼后选择音频源或演示模式。

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
