# 诉讼立案与程序实务工作台 · Web 应用 + AI Agent Skill

[![GitHub Pages](https://img.shields.io/badge/在线体验-GitHub%20Pages-c81e3a?style=flat-square)](https://wesky820.github.io/litigation-procedure-workbench/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)

覆盖中国人民法院 **六大诉讼领域（民事、商事、刑事、国家赔偿、行政、知识产权与竞争）、59 个专题章节、2,300 项立案与全流程程序实务问答** 的开源法律科技工具箱。仓库同时提供**在线交互式动态 Web 工作台**与**标准 AI Agent Skill 知识包**。

---

## 在线直达体验（GitHub Pages）

- **主工作台首页**：https://wesky820.github.io/litigation-procedure-workbench/
- **问答直达示例（诉前财产保全 Q243）**：https://wesky820.github.io/litigation-procedure-workbench/?q=243
- **交互式诉状起草与 Word 下载**：https://wesky820.github.io/litigation-procedure-workbench/?tab=draft&tpl=civil_complaint
- **法定诉讼费/保全费/执行费速算**：https://wesky820.github.io/litigation-procedure-workbench/?tab=calc&amount=350&unit=10000
- **起诉前 5 步合规自查与审查期限表**：https://wesky820.github.io/litigation-procedure-workbench/?tab=guide

---

## 一、两大核心模块

### 1. 动态交互式 Web 工作台（[`./web-app`](./web-app)）
纯前端零后端依赖构建，打开网页即可使用全部交互功能：
- **2,300 项问答渐进式分片检索**：首屏秒开轻量目录，后台流式加载 7 个全文分片；支持题号定位、多词加权搜索、章节联动、上海法院实务参考筛选、深浅色主题切换与 `⌘K / Ctrl+K` 快捷搜索。
- **8 类官方诉讼文书交互式起草与导出**：内置**民事起诉状、民事上诉状、强制执行申请书、刑事自诉状、刑事附带民事自诉状、刑事上诉状、行政起诉状、行政上诉状**，支持自然人/法人切换、草稿本地自动保存、仿真 A4 实时预览，一键下载**国标公文排版 Word (`.doc`)、Markdown (`.md`)、纯文本 (`.txt`)** 或纯净 A4 打印/另存 PDF。
- **整数分精确诉讼费速算器**：严格依照《诉讼费用交纳办法》第 13–16 条分段累计计算案件受理费、减半费、保全费（5,000 元封顶）、执行费、反诉费与支付令费，零浮点误差。
- **专属直达链接与高清长图导出**：任意问答或算费预算单均可一键生成自适应高度（绝不截断长文）的 **Retina 2x 高清长图（PNG）** 或复制直达 URL。

### 2. AI Agent 诉讼程序专业 Skill（[`./skills/litigation-procedure-qa`](./skills/litigation-procedure-qa)）
遵循开放 Agent Skill 渐进式披露（Progressive Disclosure）规范构建，兼容 **Claude Code、Cursor、Codex、Antigravity、Gemini CLI** 等支持 `SKILL.md` 的主流智能体：
- **专题立案总纲**：[`00-case-filing-core-guide.md`](./skills/litigation-procedure-qa/references/00-case-filing-core-guide.md) 浓缩审查期限、负面清单、四级管辖矩阵与新旧法变动。
- **27 个分领域参考模块**：全面反映现行《民事诉讼法》（2023修正）、《公司法》（2023修订）、《行政复议法》（2023修订）及最新司法解释，显式区分【全国通用规定】与【地方/上海法院实务口径】。
- **MCP 可选 / 联网检索自动切换**：已挂载法律 MCP 服务时可联动核验条文；未配置 MCP 时自动通过联网搜索查询国家法律法规数据库（`flk.npc.gov.cn`）与最高法官网（`court.gov.cn`）。
- **内置零依赖 CLI 检索与算费脚本**：[`search_qa.py`](./skills/litigation-procedure-qa/scripts/search_qa.py)。

---

## 二、仓库目录结构

```text
litigation-procedure-workbench/
├── .github/workflows/
│   └── deploy-pages.yml                        # GitHub Pages 自动构建发布工作流
├── .agents/
│   └── skills.json                             # Agent 自动发现挂载配置
├── web-app/                                    # 【动态 Web 工作台源码】
│   ├── index.html                              # 响应式双栏工作台入口
│   ├── assets/                                 # 样式系统 (styles.css)、检索算费引擎 (app.js)、文书起草器 (drafter.js)
│   ├── data/                                   # 轻量目录索引 (catalog.js) 与 7 个问答分片 (chunks/qa-0..6.js)
│   └── scripts/sync_data.py                    # 从 JSON 知识库重新切分前端数据包的同步脚本
└── skills/
    └── litigation-procedure-qa/                # 【AI Agent 标准 Skill 包】
        ├── SKILL.md                            # 主指令文件（四步工作流、红线清单与模块路由表）
        ├── scripts/search_qa.py                # 零依赖多维加权检索 + 精确诉讼费计算 CLI
        ├── resources/qa_database.json          # 2,300 项程序实务问答完整结构化数据库
        ├── examples/official-litigation-templates.md # 8 份常用起诉/上诉/自诉/申请执行官方标准范本
        └── references/                         # 00 ~ 27 共 28 个分编分章 Markdown 知识模块
```

---

## 三、本地快速使用

### 1. 本地运行动态网页
```bash
cd web-app
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### 2. 安装或调用 Agent Skill
- **方式 A（克隆或复制到 Agent 技能目录）**：将 `skills/litigation-procedure-qa` 复制到 `~/.claude/skills/`、`~/.codex/skills/` 或 `~/.gemini/antigravity/skills/`。
- **方式 B（命令行直接检索与算费）**：
  ```bash
  python3 skills/litigation-procedure-qa/scripts/search_qa.py "诉前保全 担保"
  python3 skills/litigation-procedure-qa/scripts/search_qa.py --calc-fee 350万
  python3 skills/litigation-procedure-qa/scripts/search_qa.py --shanghai
  ```

---

## 四、免责声明

本项目依据现行有效法律法规与最高人民法院司法解释整理，仅供诉讼程序导引、诉讼费用测算与文书初稿起草参考，**不构成正式法律意见**。各地各级人民法院对级别管辖标准、小额诉讼标的额基准线及立案材料细则可能存在动态调整，具体请以受诉人民法院最新审查口径为准。
