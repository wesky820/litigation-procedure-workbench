---
name: litigation-procedure-qa
description: >-
  提供中国人民法院立案审查与全流程诉讼程序权威实务指引（覆盖民事、商事、刑事、国家赔偿、行政、知识产权与竞争六大诉讼领域共 2,300 项结构化实务问答、立案审查总纲与法定算费工具）。当用户咨询立案程序、起诉条件、主管与受案范围、级别/地域/专属/协议管辖、当事人与代理人主体资格、诉讼费/保全费/执行费计算与缓减免、诉前与诉中财产/行为/证据保全、期间与送达（电子送达/公告送达）、一审/简易/小额/二审/特别程序/再审/支付令/公示催告、强制执行（查控/限高/失信/执行异议）、涉外与涉港澳台诉讼，以及民事、商事（公司/破产/金融/票据/保险）、刑事（公诉/自诉/附带民事）、国家赔偿、行政诉讼（含复议前置）、知识产权与反垄断诉讼程序问题，或起草起诉状/上诉状/自诉状/申请执行书、办理12368导诉答疑时，必须激活并使用本Skill。
---

# 中国人民法院立案与诉讼程序实务指南

本 Skill 提供覆盖中国人民法院 **六大诉讼领域、59 个专题章节、2,300 项诉讼程序实务问答** 的渐进式知识库与立案审查决策工具，已全面吸收 **2023修正《民事诉讼法》、2023修订《公司法》、2023修订《行政复议法》、2024《反垄断民事纠纷司法解释》、2024《拒执罪司法解释》** 等现行有效程序规则。

---

## 标准检索与作答工作流（必遵四步法）

### 第一步：程序定性与立案前置审查
1. 明确用户咨询所属诉讼性质（**民事 / 商事 / 刑事公诉或自诉 / 国家赔偿 / 行政诉讼 / 知识产权与垄断 / 执行程序**）及所处阶段（诉前保全、立案受理、管辖异议、审理、上诉、再审、执行）。
2. 若涉及**立案可否受理、管辖法院确定、前置程序（劳动仲裁前置 / 行政复议前置 / 国赔先行处理）、诉讼费计算、保全期限或上海特殊管辖**，优先查阅 [00-case-filing-core-guide.md](./references/00-case-filing-core-guide.md)（立案审查与诉讼服务核心速查总纲）。

### 第二步：使用脚本秒级检索 + 按需加载分章模块
切勿凭记忆猜测期限、标的额或管辖法院，优先运行检索脚本 [search_qa.py](./scripts/search_qa.py) 定位知识库精确条目，再按需读取对应的 `references/` 模块上下文：

```bash
# 1. 关键词组合检索（推荐用 2~4 个核心程序词）
python3 skills/litigation-procedure-qa/scripts/search_qa.py "诉前保全 担保 多少日"

# 2. 限定编/章或引用法规检索
python3 skills/litigation-procedure-qa/scripts/search_qa.py "法定代表人 辞任" --part 商事
python3 skills/litigation-procedure-qa/scripts/search_qa.py "复议" --part 行政 --chapter 起诉

# 3. 按条目编号或区间精确调取全文
python3 skills/litigation-procedure-qa/scripts/search_qa.py --id 4,5,913
python3 skills/litigation-procedure-qa/scripts/search_qa.py --id 1825-1835

# 4. 涉及金额时，必须调用内置算费器精确计算受理费/减半费/保全费/执行费/支付令费
python3 skills/litigation-procedure-qa/scripts/search_qa.py --calc-fee 350万

# 5. 查询全部含上海法院专门管辖/收费实务口径的条目，或查看7类官方文书范本
python3 skills/litigation-procedure-qa/scripts/search_qa.py --shanghai
python3 skills/litigation-procedure-qa/scripts/search_qa.py --templates
```

### 第三步：严格区分【全国通用规定】与【地方/上海法院实务口径】
知识库绝大多数条目为全国统一适用的法律与最高人民法院司法解释，部分条目的「特别提示」或正文包含上海法院地方实务口径（如上海知产法院管辖范围、上海金融法院管辖、上海无争议金额知产案件受理费800元、上海一二三中院及铁路法院审级对应与拒执自诉移交规则等，已标注 `【含上海实务口径】`）：
- **用户未说明地域时**：先给出**【全国通用法律及司法解释规定】**；若命中含上海口径条目，可单独以**【上海法院实务参考】**补充说明，并提示其他省市应以当地高级人民法院公布的标准为准。
- **用户明确在上海诉讼时**：同时适用全国通用规定与上海法院专门管辖/收费标准，直接给出具体管辖法院层级（如上海知产法院、上海金融法院、对应中院或指定基层院）。
- **用户明确在其他省市诉讼时**：适用全国通用规定，并结合第四步外部检索核实该省（区、市）高级人民法院的级别管辖、小额诉讼基准或跨区域集中管辖规定。

### 第四步：法条核验、外部检索与输出规范（MCP 可选 / 联网检索自动切换）
- **输出规范**：作答时直接给出结论清晰、逻辑严密的实务指引，并明确标注**现行法律、行政法规或司法解释全称及具体条文号**。**严禁在回答中提及任何参考书籍名称、编者信息或内部题库编号**，保持纯粹、权威的法律实务顾问表达。
- **外部核验双通道（按环境工具可选切换）**：当需要核对法条逐字原文、排查最新立改废司法解释、查询参考案例或核实外省市地方管辖标准时：
  1. **已启用法律 MCP 工具时（可选）**：若当前环境已连接并启用了法律检索类 MCP（如 `pkulaw-law-item-keyword`、`pkulaw-law-search`、`pkulaw-citation-validator`、`pkulaw-case-semantic-search` 等），可优先调用对应 MCP 工具核验法条原文、效力状态或检索类案；
  2. **未选择/未安装 MCP 工具时（联网检索）**：直接使用**联网检索工具（如 `search_web`）**进行实时检索，优先采信权威官方信源（如**国家法律法规数据库 `flk.npc.gov.cn`、最高人民法院官网 `court.gov.cn`、人民法院案例库、中国审判流程信息公开网及各省高级人民法院官方通知**）。
- **文书起草辅助**：如用户需起草诉状或申请书，读取 [official-litigation-templates.md](./examples/official-litigation-templates.md) 获取官方标准样式并结合案情填充。

---

## 高频易错程序红线（作答核查清单）

1. **严分三类驳回/不受理裁判**：
   - **裁定不予受理 / 不予立案**：立案审查阶段不符合起诉条件（7日内作出，可10日内上诉）；
   - **裁定驳回起诉**：立案受理后发现不符合起诉条件（可10日内上诉，**但小额诉讼驳回起诉裁定一审终审不得上诉**，见 Q861）；
   - **判决驳回诉讼请求**：程序合法受理后，实体权利不成立或**诉讼时效抗辩成立**（注意：**超过诉讼时效不得在立案阶段不予受理**，见 Q427；判决上诉期15日）。
2. **严守现行新修法口径**：
   - **裁判文书电子送达**：经受送达人同意，**判决书、裁定书、调解书可以电子送达**（Q220、Q224）；
   - **公告送达期限**：国内统一 **30日**，涉外统一缩短为 **60日**（Q231，勿再用旧法涉外3个月）；
   - **涉外公证认证**：海牙公约缔约国公文书适用 **公证 + 附加证明书（Apostille）**，免领事认证（Q1322、Q1323）；
   - **行政复议前置扩容**：当场行政处罚、自然资源权属侵权决定、**行政机关未履行法定职责**、**政府信息公开不予公开**均须先申请行政复议（Q2086）；
   - **反垄断与仲裁条款**：合同存在仲裁协议**不能排除**人民法院对垄断民事纠纷的管辖（Q2299）。
3. **申请执行费与保全费区别**：财产保全费由申请人**预先交纳**且**封顶 5,000元**（Q318）；首次申请执行费**不由申请人预交**，执行到位后由被执行人交纳（Q314、Q335）。

---

## 渐进式知识库模块路由总表（`references/` 共 2,300 项问答）

根据问题所属领域，按需读取对应模块文件（切勿一次性全量加载所有文件）：

| 模块文件 | 编章范围 | 条目区间 | 核心内容 |
| :--- | :--- | :---: | :--- |
| [00-case-filing-core-guide.md](./references/00-case-filing-core-guide.md) | **跨编总纲** | 跨编提炼 | **立案审查期限表、不受理负面清单、级别/地域管辖矩阵、算费速算表、新法变动、全国vs上海口径总表** |
| [01-civil-jurisdiction-org-recusal.md](./references/01-civil-jurisdiction-org-recusal.md) | 民诉 第1–3章 | Q1–Q84 | 级别管辖（50亿/5亿/1亿、涉外4000万/2000万）、地域管辖、合同履行地、专属/协议管辖、管辖异议、审判组织、回避 |
| [02-civil-parties-agents.md](./references/02-civil-parties-agents.md) | 民诉 第4章 | Q85–Q153 | 当事人适格与特殊主体列明（分支机构/个体户/合伙/劳务派遣/村居委/继承）、共同诉讼、第三人、法定与委托代理人 |
| [03-civil-evidence-time-service-mediation.md](./references/03-civil-evidence-time-service-mediation.md) | 民诉 第5–7章 | Q154–Q242 | 举证责任与期限、电子数据、证人与鉴定、证据保全、期间计算、直接/留置/电子/公告送达、法院调解 |
| [04-civil-preservation-sanctions.md](./references/04-civil-preservation-sanctions.md) | 民诉 第8–9章 | Q243–Q290 | 诉前/诉中财产保全与行为保全、担保、续保与解保、先予执行、妨害民事诉讼强制措施（罚款/拘留） |
| [05-civil-litigation-fees-limitation.md](./references/05-civil-litigation-fees-limitation.md) | 民诉 第10–11章 | Q291–Q411 | 受理费与申请费标准、减半与退费、诉讼费负担、司法救助（缓减免）、3年普通诉讼时效及中止中断 |
| [06-civil-first-instance-general-labor.md](./references/06-civil-first-instance-general-labor.md) | 民诉 第12章1–2节 | Q412–Q517 | 民事起诉条件、当场登记立案、反诉、撤诉、中止终结；劳动争议仲裁前置、一裁终局与双轨起诉 |
| [07-civil-marriage-family-inheritance.md](./references/07-civil-marriage-family-inheritance.md) | 民诉 第12章3–5节 | Q518–Q649 | 离婚管辖与6个月禁诉、彩礼、夫妻共同财产债务、抚养赡养探望收养、法定/遗嘱继承与遗产分割 |
| [08-civil-tort-damages.md](./references/08-civil-tort-damages.md) | 民诉 第12章6节 | Q650–Q763 | 人身/精神损害赔偿、交通事故、医疗损害、产品责任、环境污染、饲养动物、高空抛物、网暴侵权、消保食安赔偿 |
| [09-civil-neighbor-lending-arbitration-notary.md](./references/09-civil-neighbor-lending-arbitration-notary.md) | 民诉 第12章7–8节 | Q764–Q824 | 相邻关系、民间借贷、确认仲裁协议效力与撤仲审查、农地承包仲裁衔接、人事争议、公证民事纠纷 |
| [10-civil-summary-public-revocation-appeal.md](./references/10-civil-summary-public-revocation-appeal.md) | 民诉 第13–17章 | Q825–Q926 | 简易程序、小额诉讼一审终审、公益诉讼、第三人撤销之诉、执行异议之诉、民事二审上诉（含上海审级表） |
| [11-civil-special-procedures.md](./references/11-civil-special-procedures.md) | 民诉 第18章 | Q927–Q1011 | 选民资格、宣告失踪死亡、指定遗产管理人、行为能力认定、无主财产、司法确认调解协议、实现担保物权、监护 |
| [12-civil-retrial-payment-public-notice.md](./references/12-civil-retrial-payment-public-notice.md) | 民诉 第19–21章 | Q1012–Q1093 | 民事再审申请（6个月期限/事由/检察监督）、督促程序（支付令）、票据公示催告与除权判决 |
| [13-civil-enforcement-general-application.md](./references/13-civil-enforcement-general-application.md) | 民诉 第22–23章 | Q1094–Q1172 | 执行管辖、执行行为异议与复议、案外人异议、执行和解、执行担保、2年申请执行期间与立案条件 |
| [14-civil-enforcement-measures.md](./references/14-civil-enforcement-measures.md) | 民诉 第24章 | Q1173–Q1256 | 查封扣押冻结拍卖、迟延履行利息、财产报告与查控、案款管理、限制高消费令、失信被执行人名单与删除 |
| [15-civil-enforcement-end-arb-notary.md](./references/15-civil-enforcement-end-arb-notary.md) | 民诉 第25–26章 | Q1257–Q1318 | 执行中止与终结、仲裁裁决执行与不予执行审查、公证债权文书执行与不予执行救济 |
| [16-civil-foreign-related.md](./references/16-civil-foreign-related.md) | 民诉 第27章 | Q1319–Q1378 | 涉外主体公证与海牙附加证明书、涉外管辖/平行诉讼/不方便法院、涉外送达期间、外国判决与离婚判决承认执行 |
| [17-civil-hk-macao-taiwan.md](./references/17-civil-hk-macao-taiwan.md) | 民诉 第28章 | Q1379–Q1477 | 跨境网上立案、涉港澳台送达取证协助、民商事判决与仲裁裁决相互认可和执行安排 |
| [18-commercial-enterprise-company-bankruptcy.md](./references/18-commercial-enterprise-company-bankruptcy.md) | 商事 第1–3章 | Q1478–Q1609 | 企业改制纠纷、2023新《公司法》全套诉讼（法代涤除/知情权/决议三诉/催缴失权/代表诉讼/清算）、企业破产管辖受理 |
| [19-commercial-finance-insurance-bills-contracts.md](./references/19-commercial-finance-insurance-bills-contracts.md) | 商事 第4–12章 | Q1610–Q1717 | 证券、期货（含上海金融法院管辖）、信托、财产险与人身险、票据、信用证止付、保证合同、农地承包及其他合同 |
| [20-criminal-general-provisions.md](./references/20-criminal-general-provisions.md) | 刑事 第1章 | Q1718–Q1806 | 刑事管辖（含拒执罪管辖及上海指定管辖）、回避、辩护代理、刑事证据与排非、强制措施、刑事附带民事诉讼 |
| [21-criminal-first-second-instance.md](./references/21-criminal-first-second-instance.md) | 刑事 第2–3章 | Q1807–Q1873 | 公诉一审审限、刑事自诉范围与15日立案审查、简易与速裁程序、刑事二审上诉与上诉不加刑 |
| [22-criminal-review-enforcement-special.md](./references/22-criminal-review-enforcement-special.md) | 刑事 第4–5章 | Q1874–Q1972 | 死刑复核、刑事申诉再审、涉外刑事、刑罚执行与监外执行、未成年人/公诉和解/缺席审判/违法所得没收/强制医疗 |
| [23-state-compensation.md](./references/23-state-compensation.md) | 国赔 第1–4章 | Q1973–Q2035 | 行政赔偿前置与单独起诉、刑事赔偿范围与复议/赔偿委员会7日立案审查、人身自由与精神损害赔偿金标准 |
| [24-administrative-filing-jurisdiction-evidence.md](./references/24-administrative-filing-jurisdiction-evidence.md) | 行政 第1–6章 | Q2036–Q2121 | 行政受案范围、四级与跨区管辖、复议共同被告、举证期限、新复议法复议前置、6个月/15日起诉期、登记立案与驳回起诉 |
| [25-administrative-trial-enforcement-special.md](./references/25-administrative-trial-enforcement-special.md) | 行政 第7–9章 | Q2122–Q2206 | 负责人出庭、一并审理民事争议、各类行政判决、简易/二审/再审、非诉行政执行、知产授权确权与房屋登记行政诉讼 |
| [26-ip-and-competition.md](./references/26-ip-and-competition.md) | 知产 第1–10章 | Q2207–Q2300 | 知产管辖分级与上诉、著作权/商标/专利（诉前禁令与证据保全）/植物新品种/集成电路/域名/确认不侵权/不正当竞争/垄断 |
| [27-master-index-and-statutes.md](./references/27-master-index-and-statutes.md) | **知识库总索引** | Q1–Q2300 | 六大编精细「编—章—节」条目映射总表 + 高频引用法律法规 TOP 60 索引 |
| [official-litigation-templates.md](./examples/official-litigation-templates.md) | **文书范本库** | 7类8份 | 民事起诉状、民事上诉状、申请执行书、刑事自诉状、附带民事自诉状、刑事上诉状、行政起诉状、行政上诉状 |
