# 数字电路交互仿真与个性化学习系统

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
- 基本逻辑门、全加器、3-8 译码器和 JK 触发器仿真实验
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

可以在页面 AI 设置中填写：

- API Key
- 接口地址
- 模型名称

也可以复制 `.env.example` 为 `.env` 后填写。页面保存的密钥位于
`data/ai-config.json`，是本机明文文件，不应提交或发给他人。

## 数据文件

运行后自动生成：

- `data/imported-questions.json`
- `data/answer-records.json`
- `data/ai-config.json`

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
