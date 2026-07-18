# 数字电路交互仿真与个性化学习系统

## 在线访问

https://digital-circuit-lab-production.up.railway.app/

这是原 Java 课程设计之外的独立升级版。旧工程未被修改。

## 技术栈

- Node.js 18+
- Express 5
- LangChain.js + 通义千问百炼 OpenAI 兼容接口
- Server-Sent Events 流式回答
- 原生 HTML、CSS、JavaScript
- Web Speech API 中文朗读与语音识别
- Mammoth 提取 Word 文本
- pdf-parse 提取文字型 PDF
- 本地 JSON 持久化

## 功能

- 普通练习、智能组卷、针对训练和错题复盘
- 可点击的试卷目录与错题目录
- 个性化学习路线和薄弱知识点诊断
- 学习积分、徽章、连续学习天数和进步轨迹
- 个性化方向有效性验证
- Word/PDF 题库导入
- 气泡式 AI 助教、继续追问和变式题
- SSE 流式输出，减少等待感
- 四层折叠实验课程目录、关键词搜索、实验指南与刷新恢复
- 基本逻辑门、加减器、MUX/DEMUX、译码器、比较器、奇偶校验和 BCD 数码管
- SR/D/T/JK 触发器、寄存器、移位寄存器、同步/异步计数器和 101 序列状态机
- 传播延迟、竞争冒险、建立/保持时间教学模型
- 全加器“预测 → 仿真 → 服务端记录 → AI 讲解 → 报告 → 掌握度”学习闭环
- 自由搭建支持统一逻辑内核、触屏点按连线以及 50 步撤销/重做
- 响应式 SVG 矢量电路图、门级结构和实时信号高亮
- JK 触发器动态时序图，记录最近 10 个 CLK 上升沿的 J、K、Q、Q̅
- 自动演示按语音讲解完成后再进入下一步，不会中途打断
- 真值表联动、中文朗读和语音提问

## 运行

首次运行需要联网安装依赖：

```bat
start.bat
```

也可以手动执行：

```bat
npm install
npm start
```

浏览器访问：`http://localhost:8080`

## AI 配置

本机运行时可以在页面 AI 设置中填写：

- API Key
- 接口地址
- 模型名称

也可以复制 `.env.example` 为 `.env` 后填写。页面保存的密钥位于
`data/ai-config.json`，是本机明文文件，不应提交或发给他人。

公开部署默认禁止匿名修改 AI 配置。推荐直接设置环境变量
`DASHSCOPE_API_KEY`、`AI_BASE_URL` 和 `AI_MODEL`。如确需开放管理接口，必须设置
`AI_CONFIG_ADMIN_TOKEN`，并通过 `AI_ALLOWED_BASE_URLS`（逗号分隔）限制允许的 HTTPS 服务源。

## Railway 部署

- 挂载持久卷，例如挂载到 `/data`，并设置 `DATA_DIR=/data`；否则重新部署后学习记录可能丢失。
- 当前 JSON Store 只适合单实例运行，请将副本数保持为 1。需要横向扩容时应先迁移到 PostgreSQL。
- 设置 `NODE_ENV=production`。公开部署会禁用远程 `/api/shutdown`，AI 配置写入也需要管理令牌。
- `X-Learner-Id` 当前是随机匿名学习档案标识，不是登录鉴权。多用户正式运营前应接入账号会话。

## 数据文件

运行后自动生成：

- `data/imported-questions.json`
- `data/answer-records.json`
- `data/ai-config.json`
- `data/experiment-sessions.json`
- `data/experiment-reports.json`

上述文件已被 `.gitignore` 排除。

## 测试

```bat
npm test
```

## 当前边界

- 扫描 PDF 需要先 OCR。
- Word 图片、复杂公式和电路图暂不自动还原。
- 语音识别优先使用最新版 Edge 或 Chrome，并允许麦克风权限。
- 当前数字助教使用轻量动画形象和口型联动，后续可接入自有授权的 Live2D 模型资源。
- 当前教学状态使用本地 JSON 单实例持久化；多实例并发与事务需要数据库支持。
