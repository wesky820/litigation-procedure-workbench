/**
 * 交互式诉讼文书起草与多格式导出模块 (drafter.js)
 * 覆盖 8 类人民法院常用起诉、上诉、刑事自诉及申请执行标准文书样式
 * 支持：自然人/法人主体切换、localStorage 草稿自动保存、A4 实时预览、Word(.doc) / Markdown(.md) / TXT(.txt) 下载与打印 PDF
 */
(function () {
  "use strict";

  var STORAGE_PREFIX = "litigation_web_draft_v1_";

  function todayChinese() {
    var d = new Date();
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function escHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function placeholderOrVal(val, placeholder) {
    var v = String(val == null ? "" : val).trim();
    return v ? v : placeholder;
  }

  // 当事人信息格式化辅助函数
  function formatPartyBlock(roleLabel, state, prefix, opts) {
    opts = opts || {};
    var mode = opts.fixedMode || state[prefix + "_mode"] || "person";
    if (mode === "org") {
      var orgName = placeholderOrVal(state[prefix + "_org_name"], "________（单位全称）");
      var credit = state[prefix + "_org_code"] ? "，统一社会信用代码：" + state[prefix + "_org_code"].trim() : "";
      var addr = placeholderOrVal(state[prefix + "_org_addr"], "________");
      var repName = placeholderOrVal(state[prefix + "_rep_name"], "____");
      var repRole = placeholderOrVal(state[prefix + "_rep_title"], "法定代表人/负责人");
      var tel = state[prefix + "_tel"] ? "，联系电话：" + state[prefix + "_tel"].trim() : "";
      return [
        roleLabel + "：" + orgName + credit + "，住所地：" + addr + "。",
        "法定代表人（或主要负责人）：" + repName + "，职务：" + repRole + tel + "。"
      ];
    }

    if (mode === "admin_agency") {
      var agName = placeholderOrVal(state[prefix + "_org_name"], "________（行政机关全称）");
      var agAddr = placeholderOrVal(state[prefix + "_org_addr"], "________");
      var agRep = placeholderOrVal(state[prefix + "_rep_name"], "____");
      var agTitle = placeholderOrVal(state[prefix + "_rep_title"], "局长/主任");
      return [
        roleLabel + "：" + agName + "，住所地：" + agAddr + "。",
        "法定代表人：" + agRep + "，职务：" + agTitle + "。"
      ];
    }

    // 自然人
    var name = placeholderOrVal(state[prefix + "_name"], "____");
    var gender = placeholderOrVal(state[prefix + "_gender"], "__");
    var birth = placeholderOrVal(state[prefix + "_birth"], "____年__月__日出生");
    var nation = placeholderOrVal(state[prefix + "_nation"], "__族");
    var extra = "";
    if (opts.criminalFields) {
      var birthplace = state[prefix + "_birthplace"] ? "，出生地：" + state[prefix + "_birthplace"].trim() : "";
      var edu = state[prefix + "_edu"] ? "，文化程度：" + state[prefix + "_edu"].trim() : "";
      extra += birthplace + edu;
    }
    var job = state[prefix + "_job"] ? "，职业/工作单位：" + state[prefix + "_job"].trim() : "";
    var idNo = state[prefix + "_idno"] ? "，公民身份号码：" + state[prefix + "_idno"].trim() : "";
    var addrP = placeholderOrVal(state[prefix + "_addr"], "________");
    var phone = state[prefix + "_tel"] ? "，联系电话：" + state[prefix + "_tel"].trim() : "";
    return [
      roleLabel + "：" + name + "，" + gender + "，" + birth + "，" + nation + extra + job + idNo + "，住址：" + addrP + phone + "。"
    ];
  }

  // 8 类官方诉讼文书配置
  var DOC_SCHEMAS = [
    {
      key: "civil_complaint",
      shortName: "民事起诉状",
      docTitle: "民事起诉状",
      qid: 416,
      lawBasis: "《中华人民共和国民事诉讼法》（2023修正）第一百二十四条：起诉状应当记明原告与被告基本情况、诉讼请求和所根据的事实与理由、证据和证据来源、证人姓名和住所。",
      parties: [
        { prefix: "p1", label: "原告", allowSwitch: true, defaultMode: "person" },
        { prefix: "p2", label: "被告", allowSwitch: true, defaultMode: "org" }
      ],
      sections: [
        {
          title: "诉讼请求与事实理由",
          fields: [
            { name: "claims", label: "诉讼请求（分项列明本金、利息计算方式及诉讼费负担）", type: "textarea", rows: 4, placeholder: "1. 判令被告向原告支付货款/借款本金人民币 ____ 元；\n2. 判令被告支付逾期利息 ____ 元（以 ____ 元为基数，自 ____ 起按 ____ 计算至实际清偿之日止）；\n3. 判令本案诉讼费用由被告承担。" },
            { name: "facts", label: "事实与理由（按时间顺序简明陈述法律关系产生、履行及违约经过）", type: "textarea", rows: 5, placeholder: "写明双方建立合同或侵权关系的时间、核心约定、履行情况、被告违约或侵权事实，以及起诉所依据的法律规定……" },
            { name: "evidence", label: "证据和证据来源，证人姓名和住址", type: "textarea", rows: 3, placeholder: "证据一：《合同》复印件1份，来源：原告保存，证明双方合同关系；\n证据二：银行转账凭证1份，来源：银行电子回单，证明原告已履行付款义务。" }
          ]
        },
        {
          title: "致送法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "受诉人民法院名称", type: "text", placeholder: "例如：上海市浦东新区人民法院" },
            { name: "copies", label: "附诉状副本份数（按被告人数填写）", type: "text", placeholder: "1" },
            { name: "signer", label: "起诉人（签名或盖章）", type: "text", placeholder: "姓名或单位全称" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_mode: "person",
        p1_name: "林知远",
        p1_gender: "男",
        p1_birth: "1988年5月16日出生",
        p1_nation: "汉族",
        p1_job: "自由设计师",
        p1_idno: "31011519880516001X",
        p1_addr: "上海市浦东新区世纪大道1000号2幢802室",
        p1_tel: "13800138000",
        p2_mode: "org",
        p2_org_name: "上海星海数字科技有限公司",
        p2_org_code: "91310115MA1K00000X",
        p2_org_addr: "上海市浦东新区张江高科路666号A座12层",
        p2_rep_name: "周明轩",
        p2_rep_title: "执行董事",
        p2_tel: "021-58880000",
        claims: "1. 判令被告立即向原告支付软件界面设计服务费尾款人民币 120,000 元；\n2. 判令被告向原告支付逾期付款利息（以 120,000 元为基数，自 2026 年 3 月 1 日起按全国银行间同业拆借中心公布的一年期贷款市场报价利率 LPR 计算至实际付清之日止）；\n3. 判令本案案件受理费、财产保全费由被告承担。",
        facts: "2025年11月10日，原告与被告签订《UI视觉系统委托设计合同》，约定原告为被告开发的新一代客户端提供全套界面设计服务，合同总价款为人民币200,000元。被告于签约后支付了首付款80,000元，约定其余尾款120,000元于设计成果全部交付验收后15日内付清。\n2026年2月10日，原告按约交付全部设计源文件并通过被告项目组书面验收确认。然而付款期限届满后，经原告多次催告，被告均以资金周转为由拖延未付。依据《中华人民共和国民法典》第五百零九条、第五百七十七条及《中华人民共和国民事诉讼法》第一百二十二条之规定，特向贵院提起诉讼，望判如所请。",
        evidence: "1.《UI视觉系统委托设计合同》复印件1份（原告保存，证明双方委托合同关系及价款约定）；\n2.《项目交付验收确认单》及往来邮件打印件1组（原告保存，证明原告已依约完成交付并通过验收）；\n3. 微信催款记录截图1组（原告保存，证明原告多次催告付款的事实）。",
        court: "上海市浦东新区人民法院",
        copies: "1",
        signer: "林知远",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("原告", s, "p1"))
          .concat(formatPartyBlock("被告", s, "p2"));
        return {
          title: "民事起诉状",
          parties: partyLines,
          leadParagraph: "",
          sections: [
            { heading: "诉讼请求：", body: placeholderOrVal(s.claims, "1. ……\n2. ……") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true },
            { heading: "证据和证据来源，证人姓名和住址：", body: placeholderOrVal(s.evidence, "……") }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "起诉人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "civil_appeal",
      shortName: "民事上诉状",
      docTitle: "民事上诉状",
      qid: 916,
      lawBasis: "《中华人民共和国民事诉讼法》（2023修正）第一百七十一、一百七十二条：不服地方人民法院第一审判决的，有权在判决书送达之日起 15 日内向上一级法院提起上诉；不服裁定的，在 10 日内提起上诉。",
      parties: [
        { prefix: "p1", label: "上诉人（原审地位请在姓名/名称后注明）", allowSwitch: true, defaultMode: "org" },
        { prefix: "p2", label: "被上诉人", allowSwitch: true, defaultMode: "person" }
      ],
      sections: [
        {
          title: "一审裁判文书信息",
          grid2: true,
          fields: [
            { name: "cause", label: "一审案由", type: "text", placeholder: "例如：买卖合同纠纷" },
            { name: "origCourt", label: "第一审人民法院名称", type: "text", placeholder: "例如：上海市徐汇区人民法院" },
            { name: "origDate", label: "一审裁判作出日期", type: "text", placeholder: "例如：2026年8月20日" },
            { name: "origCaseNo", label: "一审案号与文书种类", type: "text", placeholder: "例如：（2026）沪0104民初1234号民事判决" }
          ]
        },
        {
          title: "上诉请求与理由",
          fields: [
            { name: "claims", label: "上诉请求", type: "textarea", rows: 4, placeholder: "1. 请求依法撤销一审判决第____项，改判驳回被上诉人的一审诉讼请求（或改判支持上诉人一审全部诉讼请求）；\n2. 请求判令一审、二审诉讼费用由被上诉人承担。" },
            { name: "facts", label: "事实与理由（针对一审认定事实不清或适用法律错误逐项阐述）", type: "textarea", rows: 5, placeholder: "一、原审判决认定基本事实不清……\n二、原审判决适用法律错误……" }
          ]
        },
        {
          title: "致送二审法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "二审人民法院名称（通过原审法院提交）", type: "text", placeholder: "例如：上海市第一中级人民法院" },
            { name: "copies", label: "附上诉状副本份数", type: "text", placeholder: "1" },
            { name: "signer", label: "上诉人（签名或盖章）", type: "text", placeholder: "姓名或单位全称" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_mode: "org",
        p1_org_name: "上海宏达建材贸易有限公司（原审被告）",
        p1_org_code: "91310104MA1FR00008",
        p1_org_addr: "上海市徐汇区虹桥路500号1501室",
        p1_rep_name: "陈建国",
        p1_rep_title: "总经理",
        p1_tel: "021-64001111",
        p2_mode: "person",
        p2_name: "赵文博（原审原告）",
        p2_gender: "男",
        p2_birth: "1982年10月9日出生",
        p2_nation: "汉族",
        p2_addr: "上海市闵行区莘松路380弄12号601室",
        p2_tel: "13900139000",
        cause: "买卖合同纠纷",
        origCourt: "上海市徐汇区人民法院",
        origDate: "2026年10月18日",
        origCaseNo: "（2026）沪0104民初5678号民事判决",
        claims: "1. 请求依法撤销上海市徐汇区人民法院（2026）沪0104民初5678号民事判决第二项，改判上诉人无需支付违约金人民币 45,000 元（或依法调减至实际损失范围内）；\n2. 请求判令本案一、二审案件受理费按改判比例分担。",
        facts: "一、一审判决对上诉人已于2026年5月12日先行交付部分货物的事实未予查明，导致逾期违约金计算基数有误。\n二、双方合同约定的日万分之八违约金折算年化高达29.2%，显著高于被上诉人实际资金占用损失。上诉人在一审庭审中已明确提出违约金过高之抗辩，依据《中华人民共和国民法典》第五百八十五条第二款之规定，请求二审法院依法予以调整。",
        court: "上海市第一中级人民法院",
        copies: "1",
        signer: "上海宏达建材贸易有限公司",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("上诉人", s, "p1"))
          .concat(formatPartyBlock("被上诉人", s, "p2"));
        var lead = "上诉人因" + placeholderOrVal(s.cause, "________") + "一案，不服" +
          placeholderOrVal(s.origCourt, "________人民法院") + "于" +
          placeholderOrVal(s.origDate, "____年__月__日") + "作出的" +
          placeholderOrVal(s.origCaseNo, "（____）____字第____号民事判决（或裁定）") + "，现依法提出上诉。";
        return {
          title: "民事上诉状",
          parties: partyLines,
          leadParagraph: lead,
          sections: [
            { heading: "上诉请求：", body: placeholderOrVal(s.claims, "1. ……\n2. ……") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本上诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "上诉人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "civil_enforcement",
      shortName: "强制执行申请书",
      docTitle: "强制执行申请书",
      qid: 1164,
      lawBasis: "《中华人民共和国民事诉讼法》第二百四十七、二百五十条：申请执行的期间为二年；发生法律效力的民事判决、裁定，由第一审人民法院或者与第一审法院同级的被执行的财产所在地人民法院执行。首次申请执行不预交执行费。",
      parties: [
        { prefix: "p1", label: "申请执行人", allowSwitch: true, defaultMode: "person" },
        { prefix: "p2", label: "被执行人", allowSwitch: true, defaultMode: "org" }
      ],
      sections: [
        {
          title: "生效执行依据信息",
          grid2: true,
          fields: [
            { name: "cause", label: "纠纷案由", type: "text", placeholder: "例如：委托设计合同纠纷" },
            { name: "maker", label: "生效文书作出法院/仲裁机构", type: "text", placeholder: "例如：上海市浦东新区人民法院" },
            { name: "execDocNo", label: "生效法律文书案号及名称", type: "text", placeholder: "例如：（2026）沪0115民初3210号民事判决书" },
            { name: "effectiveDate", label: "文书发生法律效力日期", type: "text", placeholder: "例如：2026年10月25日" }
          ]
        },
        {
          title: "申请执行请求与财产线索",
          fields: [
            { name: "claims", label: "请求事项（明确本金、一般债务利息、加倍部分债务利息）", type: "textarea", rows: 4, placeholder: "1. 强制被执行人向申请执行人支付款项人民币 ____ 元及迟延履行期间的加倍部分债务利息；\n2. 强制被执行人负担本案执行费。" },
            { name: "facts", label: "事实与理由及所了解的被执行人财产线索", type: "textarea", rows: 4, placeholder: "被执行人未按生效法律文书指定的期间履行给付金钱义务。已知财产线索：被执行人名下开户行及账号 ____ / 不动产地址 ____。" }
          ]
        },
        {
          title: "致送执行法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "执行人民法院名称", type: "text", placeholder: "例如：上海市浦东新区人民法院" },
            { name: "signer", label: "申请执行人（签名或盖章）", type: "text", placeholder: "姓名或单位全称" },
            { name: "signDate", label: "申请日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_mode: "person",
        p1_name: "林知远",
        p1_gender: "男",
        p1_birth: "1988年5月16日出生",
        p1_nation: "汉族",
        p1_idno: "31011519880516001X",
        p1_addr: "上海市浦东新区世纪大道1000号2幢802室",
        p1_tel: "13800138000",
        p2_mode: "org",
        p2_org_name: "上海星海数字科技有限公司",
        p2_org_code: "91310115MA1K00000X",
        p2_org_addr: "上海市浦东新区张江高科路666号A座12层",
        p2_rep_name: "周明轩",
        p2_rep_title: "执行董事",
        p2_tel: "021-58880000",
        cause: "委托创作合同纠纷",
        maker: "上海市浦东新区人民法院",
        execDocNo: "（2026）沪0115民初8890号民事判决书",
        effectiveDate: "2026年10月20日",
        claims: "1. 依法强制被执行人向申请执行人支付设计服务费人民币 120,000 元及一般债务利息 2,850 元；\n2. 依法强制被执行人支付迟延履行期间的加倍部分债务利息（以 120,000 元为基数，按日万分之一点七五自履行期届满次日起计至实际清偿之日止）；\n3. 本案执行费由被执行人承担。",
        facts: "申请执行人与被执行人因委托创作合同纠纷一案，上海市浦东新区人民法院作出的（2026）沪0115民初8890号民事判决书已于2026年10月20日发生法律效力。判决确定被执行人应于判决生效之日起十日内支付款项，现履行期限已满，被执行人仍拒不履行。\n财产线索：被执行人基本存款账户开立于中国工商银行上海市张江支行（账号：1001XXXX00008888）。特依据《中华人民共和国民事诉讼法》第二百四十七条申请强制执行。",
        court: "上海市浦东新区人民法院",
        signer: "林知远",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("申请执行人", s, "p1"))
          .concat(formatPartyBlock("被执行人", s, "p2"));
        var lead = "申请执行人因与被执行人" + placeholderOrVal(s.cause, "________") + "一案，" +
          placeholderOrVal(s.maker, "________") + "作出的" +
          placeholderOrVal(s.execDocNo, "（____）____字第____号生效法律文书") +
          "已于" + placeholderOrVal(s.effectiveDate, "____年__月__日") + "发生法律效力。被执行人逾期拒不履行生效法律文书确定的义务，特向你院申请强制执行。";
        return {
          title: "强制执行申请书",
          parties: partyLines,
          leadParagraph: "",
          sections: [
            { heading: "请求事项：", body: placeholderOrVal(s.claims, "1. ……\n2. ……") },
            { heading: "事实与理由（含财产线索）：", body: lead + "\n" + placeholderOrVal(s.facts, ""), indent: true }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "生效法律文书副本及生效证明各 1 份",
          signerLabel: "申请执行人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "criminal_private",
      shortName: "刑事自诉状",
      docTitle: "刑事自诉状",
      qid: 1832,
      lawBasis: "《最高人民法院关于适用〈中华人民共和国刑事诉讼法〉的解释》第三百一十九条：刑事自诉状应记明自诉人、被告人出生地、文化程度等基本信息，犯罪时间、地点、手段、情节和危害后果，具体诉讼请求及罪证。注意：被告人下落不明的，不适用自诉程序。",
      parties: [
        { prefix: "p1", label: "自诉人", allowSwitch: false, fixedMode: "person", criminalFields: true },
        { prefix: "p2", label: "被告人", allowSwitch: false, fixedMode: "person", criminalFields: true }
      ],
      sections: [
        {
          title: "控告罪名、诉讼请求与犯罪事实",
          fields: [
            { name: "claims", label: "诉讼请求（明确请求追究刑事责任的罪名）", type: "textarea", rows: 3, placeholder: "依法追究被告人 ____ 犯侮辱罪/诽谤罪/侵占罪等刑事责任。" },
            { name: "facts", label: "事实与理由（写明被告人实施犯罪的时间、地点、手段、情节和危害后果）", type: "textarea", rows: 5, placeholder: "写明案发时间、地点、行为经过、危害后果，以及属于人民法院直接受理自诉案件范围的法律依据……" },
            { name: "evidence", label: "证据和证据来源，证人姓名、住址及联系方式", type: "textarea", rows: 3, placeholder: "1. 物证/书证/电子数据名称及来源；\n2. 证人姓名、住址、联系电话（两名以上被告人请按人数准备副本）。" }
          ]
        },
        {
          title: "致送法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "受诉人民法院名称", type: "text", placeholder: "例如：上海市静安区人民法院" },
            { name: "copies", label: "附自诉状副本份数", type: "text", placeholder: "1" },
            { name: "signer", label: "自诉人（签名或盖章）", type: "text", placeholder: "自诉人本人签名" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_name: "宋佳宁",
        p1_gender: "女",
        p1_birth: "1991年4月12日出生",
        p1_nation: "汉族",
        p1_birthplace: "江苏省苏州市",
        p1_edu: "大学本科",
        p1_job: "公司职员",
        p1_addr: "上海市静安区南京西路1200弄5号901室",
        p1_tel: "13700137000",
        p2_name: "吴某强",
        p2_gender: "男",
        p2_birth: "1987年9月3日出生",
        p2_nation: "汉族",
        p2_birthplace: "安徽省合肥市",
        p2_edu: "大专",
        p2_job: "个体经营者",
        p2_addr: "上海市静安区万航渡路600弄8号302室",
        p2_tel: "13600136000",
        claims: "依法追究被告人吴某强犯诽谤罪的刑事责任。",
        facts: "2026年8月起，被告人吴某强因邻里琐事对自诉人心生不满，故意捏造损害自诉人人格与名誉的虚假事实，先后在多个公开网络社交平台发布配有自诉人姓名与生活照片的诽谤帖文，单篇浏览量超过3万次、转发逾800次，严重贬损自诉人人格尊严并导致自诉人出现严重精神困扰，情节严重。\n依据《中华人民共和国刑法》第二百四十六条及《中华人民共和国刑事诉讼法》第二百一十条第一项之规定，本案属告诉才处理的刑事自诉案件，特向贵院提起刑事自诉。",
        evidence: "1. 公证处出具的《电子数据保全证据公证书》1份（自诉人委托公证保全，证明诽谤信息发布账号、内容及传播阅读转发数量）；\n2. 社区居委会调解记录复印件1份（证明案发起因及交涉经过）；\n3. 医疗机构诊断证明书1份（证明造成自诉人身心受损后果）。",
        court: "上海市静安区人民法院",
        copies: "1",
        signer: "宋佳宁",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("自诉人", s, "p1", { fixedMode: "person", criminalFields: true }))
          .concat(formatPartyBlock("被告人", s, "p2", { fixedMode: "person", criminalFields: true }));
        return {
          title: "刑事自诉状",
          parties: partyLines,
          leadParagraph: "",
          sections: [
            { heading: "诉讼请求：", body: placeholderOrVal(s.claims, "1. 依法追究被告人 ____ 犯 ____ 罪的刑事责任。") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true },
            { heading: "证据和证据来源，证人姓名、住址及联系方式：", body: placeholderOrVal(s.evidence, "……") }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "自诉人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "criminal_civil",
      shortName: "刑事附带民事自诉状",
      docTitle: "刑事附带民事自诉状",
      qid: 1832,
      lawBasis: "《中华人民共和国刑事诉讼法》第一百零一条：被害人由于被告人的犯罪行为而遭受物质损失的，在刑事诉讼过程中，有权提起附带民事诉讼。注意：附带民事诉讼赔偿范围以犯罪行为直接造成的物质损失为限，一般不含精神抚慰金。",
      parties: [
        { prefix: "p1", label: "自诉人暨附带民事诉讼原告人", allowSwitch: false, fixedMode: "person", criminalFields: true },
        { prefix: "p2", label: "被告人暨附带民事诉讼被告人", allowSwitch: false, fixedMode: "person", criminalFields: true }
      ],
      sections: [
        {
          title: "刑事与附带民事诉讼请求",
          fields: [
            { name: "claims", label: "诉讼请求（分别列明刑事追责请求与直接物质损失赔偿金额）", type: "textarea", rows: 4, placeholder: "1. 依法追究被告人 ____ 犯故意伤害罪（轻伤）的刑事责任；\n2. 判令附带民事诉讼被告人赔偿医疗费、护理费、误工费等直接经济损失共计人民币 ____ 元。" },
            { name: "facts", label: "事实与理由（犯罪事实经过及造成物质损失的明细与因果关系）", type: "textarea", rows: 5, placeholder: "写明犯罪时间、地点、手段、伤情鉴定结论及各项直接物质损失费用明细……" },
            { name: "evidence", label: "证据和证据来源，证人姓名、住址及联系方式", type: "textarea", rows: 3, placeholder: "1. 公安机关受案回执、伤情司法鉴定意见书；\n2. 医院病历、医疗费发票清单等。" }
          ]
        },
        {
          title: "致送法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "受诉人民法院名称", type: "text", placeholder: "例如：上海市普陀区人民法院" },
            { name: "copies", label: "附诉状副本份数", type: "text", placeholder: "1" },
            { name: "signer", label: "自诉人（签名或盖章）", type: "text", placeholder: "本人签名" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_name: "郑浩然",
        p1_gender: "男",
        p1_birth: "1990年7月21日出生",
        p1_nation: "汉族",
        p1_birthplace: "浙江省宁波市",
        p1_edu: "本科",
        p1_job: "工程师",
        p1_addr: "上海市普陀区长寿路800弄3号1102室",
        p1_tel: "13500135000",
        p2_name: "刘某峰",
        p2_gender: "男",
        p2_birth: "1985年12月8日出生",
        p2_nation: "汉族",
        p2_birthplace: "山东省济南市",
        p2_edu: "高中",
        p2_job: "无业",
        p2_addr: "上海市普陀区武宁路300弄10号401室",
        p2_tel: "13400134000",
        claims: "1. 依法追究被告人刘某峰犯故意伤害罪的刑事责任；\n2. 判令附带民事诉讼被告人刘某峰赔偿附带民事诉讼原告人医疗费 18,600 元、误工费 9,200 元、护理费 2,400 元、营养费 1,200 元，合计人民币 31,400 元。",
        facts: "2026年9月5日晚20时许，在上海市普陀区长寿路某停车场出口处，被告人刘某峰因车辆会车让行问题与自诉人发生口角，继而挥拳击打自诉人面部，致自诉人鼻骨骨折及面部软组织挫裂伤。经司法鉴定，自诉人伤情构成轻伤二级。\n被告人的故意伤害犯罪行为同时造成自诉人支出医疗费、误工费等直接物质损失共计31,400元。依据《中华人民共和国刑事诉讼法》第一百零一条、第二百一十条第二项之规定，特一并提起刑事附带民事自诉。",
        evidence: "1. 公安机关报警回执及询问笔录复印件；\n2. 司法鉴定科学研究院《司法鉴定意见书》（鉴定轻伤二级）；\n3. 住院病史、医疗费电子票据及单位误工扣发薪资证明各1组。",
        court: "上海市普陀区人民法院",
        copies: "1",
        signer: "郑浩然",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("自诉人暨附带民事诉讼原告人", s, "p1", { fixedMode: "person", criminalFields: true }))
          .concat(formatPartyBlock("被告人暨附带民事诉讼被告人", s, "p2", { fixedMode: "person", criminalFields: true }));
        return {
          title: "刑事附带民事自诉状",
          parties: partyLines,
          leadParagraph: "",
          sections: [
            { heading: "诉讼请求：", body: placeholderOrVal(s.claims, "1. ……\n2. ……") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true },
            { heading: "证据和证据来源，证人姓名、住址及联系方式：", body: placeholderOrVal(s.evidence, "……") }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "自诉人暨附带民事诉讼原告人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "criminal_appeal",
      shortName: "刑事上诉状",
      docTitle: "刑事上诉状",
      qid: 1861,
      lawBasis: "《中华人民共和国刑事诉讼法》第二百三十条：不服判决的上诉期限为 10 日，不服裁定的上诉期限为 5 日（刑事自诉不予受理/驳回起诉裁定亦为 5 日），从接到判决书、裁定书的第二日起算。",
      parties: [
        { prefix: "p1", label: "上诉人（被告人/自诉人/附带民事当事人）", allowSwitch: false, fixedMode: "person", criminalFields: true }
      ],
      sections: [
        {
          title: "一审刑事裁判送达与文号信息",
          grid2: true,
          fields: [
            { name: "cause", label: "一审罪名/案由", type: "text", placeholder: "例如：职务侵占 / 刑事自诉不予受理" },
            { name: "receiveDate", label: "收到一审裁判文书日期", type: "text", placeholder: "例如：2026年11月5日" },
            { name: "origCourt", label: "第一审人民法院名称", type: "text", placeholder: "例如：上海市长宁区人民法院" },
            { name: "origCaseNo", label: "一审裁判日期、案号及种类", type: "text", placeholder: "例如：2026年11月4日（2026）沪0105刑初210号刑事判决" }
          ]
        },
        {
          title: "上诉请求与上诉理由",
          fields: [
            { name: "claims", label: "上诉请求", type: "textarea", rows: 3, placeholder: "请求二审法院依法撤销一审刑事判决（或裁定），改判……（或裁定指令一审法院立案受理）。" },
            { name: "facts", label: "事实与理由", type: "textarea", rows: 5, placeholder: "围绕事实认定、证据采信、自首/立功/退赔退赃量刑情节或法律适用阐述上诉理由……" }
          ]
        },
        {
          title: "致送法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "二审人民法院名称", type: "text", placeholder: "例如：上海市第一中级人民法院" },
            { name: "copies", label: "附上诉状副本份数", type: "text", placeholder: "2" },
            { name: "signer", label: "上诉人（签名或捺印）", type: "text", placeholder: "上诉人签名" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_name: "孙某宇（原审被告人）",
        p1_gender: "男",
        p1_birth: "1993年2月19日出生",
        p1_nation: "汉族",
        p1_birthplace: "上海市",
        p1_edu: "大学本科",
        p1_addr: "上海市长宁区延安西路1500弄6号402室",
        p1_tel: "13300133000",
        cause: "帮信罪",
        receiveDate: "2026年11月6日",
        origCourt: "上海市长宁区人民法院",
        origCaseNo: "2026年11月5日（2026）沪0105刑初308号刑事判决",
        claims: "请求二审法院依法改判对上诉人适用缓刑。",
        facts: "一、上诉人在侦查阶段经电话传唤主动到案并如实供述全部事实，依法构成自首；\n二、一审宣判后，上诉人家属已代为全额退缴违法所得并取得被害人谅解，社会危害性显著降低，符合《中华人民共和国刑法》第七十二条适用缓刑之法定条件，恳请二审法院依法从宽处罚。",
        court: "上海市第一中级人民法院",
        copies: "2",
        signer: "孙某宇",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = formatPartyBlock("上诉人", s, "p1", { fixedMode: "person", criminalFields: true });
        var lead = "上诉人因" + placeholderOrVal(s.cause, "________") + "一案，于" +
          placeholderOrVal(s.receiveDate, "____年__月__日") + "收到" +
          placeholderOrVal(s.origCourt, "________人民法院") +
          placeholderOrVal(s.origCaseNo, "____年__月__日（____）____字第____号刑事判决（或裁定）") +
          "，现因不服该判决（或裁定），依法提出上诉。";
        return {
          title: "刑事上诉状",
          parties: partyLines,
          leadParagraph: lead,
          sections: [
            { heading: "上诉请求：", body: placeholderOrVal(s.claims, "……") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本上诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "上诉人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "admin_complaint",
      shortName: "行政起诉状",
      docTitle: "行政起诉状",
      qid: 2107,
      lawBasis: "《中华人民共和国行政诉讼法》第四十六、四十九条：直接起诉期限一般为知道作出行政行为之日起 6 个月内；经行政复议的为收到复议决定书之日起 15 日内（注意排查新《行政复议法》规定的当场处罚、信息公开不予公开等复议前置情形）。",
      parties: [
        { prefix: "p1", label: "原告", allowSwitch: true, defaultMode: "org" },
        { prefix: "p2", label: "被告（作出行政行为的行政机关，若复议维持应列共同被告）", allowSwitch: false, fixedMode: "admin_agency" }
      ],
      sections: [
        {
          title: "行政诉讼请求与事实理由",
          fields: [
            { name: "claims", label: "诉讼请求（撤销/确认违法/履行法定职责/一并请求行政赔偿）", type: "textarea", rows: 4, placeholder: "1. 请求依法判决撤销被告于____年__月__日作出的____号《行政处罚决定书》；\n2. 请求判令本案诉讼费用由被告承担。" },
            { name: "facts", label: "事实与理由（行政行为作出经过、何时得知、程序或实体违法理由）", type: "textarea", rows: 5, placeholder: "写明被诉行政行为作出及送达情况（如经过行政复议一并写明复议决定情况），并阐述被告在职权、事实证据、执法程序或法律适用方面存在的问题……" },
            { name: "evidence", label: "证据和证据来源，证人姓名和住址", type: "textarea", rows: 3, placeholder: "1. 被诉《行政处罚决定书》（或《行政复议决定书》）复印件1份（证明具体行政行为存在及起诉未超法定期限）；\n2. 原告主体资格证明材料。" }
          ]
        },
        {
          title: "致送法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "受诉人民法院名称（注意跨区划集中管辖规定）", type: "text", placeholder: "例如：上海铁路运输法院" },
            { name: "copies", label: "附诉状副本份数", type: "text", placeholder: "1" },
            { name: "signer", label: "起诉人（签名或盖章）", type: "text", placeholder: "姓名或单位全称" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_mode: "org",
        p1_org_name: "上海清源餐饮管理有限公司",
        p1_org_code: "91310106MA1FY00099",
        p1_org_addr: "上海市静安区愚园路300号1层",
        p1_rep_name: "许文涛",
        p1_rep_title: "执行董事",
        p1_tel: "13911112222",
        p2_org_name: "上海市某区市场监督管理局",
        p2_org_addr: "上海市某区行政路100号",
        p2_rep_name: "王某",
        p2_rep_title: "局长",
        claims: "1. 请求依法判决撤销被告于 2026 年 9 月 18 日作出的沪市监某处〔2026〕第 060123 号《行政处罚决定书》；\n2. 请求判令本案案件受理费由被告承担。",
        facts: "2026年9月18日，被告以原告在网络外卖平台页面使用不当宣传用语为由，作出沪市监某处〔2026〕第060123号《行政处罚决定书》，对原告处以罚款人民币50,000元（非当场处罚决定）。原告于2026年9月20日收到该决定书。\n原告认为，涉案词条系客观陈述食材产地来源，且原告在接到检查提示当日已主动整改消除影响，涉案页面点击成交仅3单，违法行为轻微并及时改正，没有造成危害后果。被告未适用《中华人民共和国行政处罚法》第三十三条首违不罚/轻微免罚规定，且在作出较大数额罚款前未依法告知听证权利，属程序违法、处罚明显不当。特依据《中华人民共和国行政诉讼法》第四十九条提起行政诉讼。",
        evidence: "1. 沪市监某处〔2026〕第060123号《行政处罚决定书》及送达回证复印件1份（证明被诉行政行为存在且在6个月起诉期限内）；\n2. 食材产地采购检验合格单及整改截图1组（证明陈述属实且已及时整改）。",
        court: "上海铁路运输法院",
        copies: "1",
        signer: "上海清源餐饮管理有限公司",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("原告", s, "p1"))
          .concat(formatPartyBlock("被告", s, "p2", { fixedMode: "admin_agency" }));
        return {
          title: "行政起诉状",
          parties: partyLines,
          leadParagraph: "",
          sections: [
            { heading: "诉讼请求：", body: placeholderOrVal(s.claims, "1. ……\n2. ……") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true },
            { heading: "证据和证据来源，证人姓名和住址：", body: placeholderOrVal(s.evidence, "……") }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "起诉人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    },
    {
      key: "admin_appeal",
      shortName: "行政上诉状",
      docTitle: "行政上诉状",
      qid: 2156,
      lawBasis: "《中华人民共和国行政诉讼法》第八十五条：当事人不服人民法院第一审判决的，有权在判决书送达之日起 15 日内向上一级人民法院提起上诉；不服第一审裁定的，有权在裁定书送达之日起 10 日内提起上诉。",
      parties: [
        { prefix: "p1", label: "上诉人", allowSwitch: true, defaultMode: "person" },
        { prefix: "p2", label: "被上诉人", allowSwitch: true, defaultMode: "org" }
      ],
      sections: [
        {
          title: "一审行政裁判信息",
          grid2: true,
          fields: [
            { name: "cause", label: "一审行政案由", type: "text", placeholder: "例如：工伤保险资格认定及行政复议" },
            { name: "origCourt", label: "第一审人民法院名称", type: "text", placeholder: "例如：上海铁路运输法院" },
            { name: "origDate", label: "一审裁判作出日期", type: "text", placeholder: "例如：2026年10月30日" },
            { name: "origCaseNo", label: "一审案号与文书种类", type: "text", placeholder: "例如：（2026）沪7101行初998号行政判决" }
          ]
        },
        {
          title: "上诉请求与理由",
          fields: [
            { name: "claims", label: "上诉请求", type: "textarea", rows: 3, placeholder: "1. 请求撤销一审行政判决（或裁定），依法改判支持上诉人的一审诉讼请求；\n2. 一、二审案件受理费由被上诉人负担。" },
            { name: "facts", label: "事实与理由", type: "textarea", rows: 5, placeholder: "阐述原审判决在审查被诉行政行为合法性、事实认定或法律适用方面存在的错误……" }
          ]
        },
        {
          title: "致送二审法院与落款",
          grid2: true,
          fields: [
            { name: "court", label: "二审人民法院名称", type: "text", placeholder: "例如：上海市第三中级人民法院" },
            { name: "copies", label: "附上诉状副本份数", type: "text", placeholder: "1" },
            { name: "signer", label: "上诉人（签名或盖章）", type: "text", placeholder: "姓名或单位全称" },
            { name: "signDate", label: "具状日期", type: "text", placeholder: todayChinese() }
          ]
        }
      ],
      demo: {
        p1_mode: "person",
        p1_name: "韩立伟（原审原告）",
        p1_gender: "男",
        p1_birth: "1979年11月3日出生",
        p1_nation: "汉族",
        p1_addr: "上海市嘉定区博乐路99弄4号502室",
        p1_tel: "13688889999",
        p2_mode: "org",
        p2_org_name: "上海市某区人力资源和社会保障局（原审被告）",
        p2_org_addr: "上海市某区嘉新路88号",
        p2_rep_name: "李某",
        p2_rep_title: "局长",
        cause: "不予认定工伤决定",
        origCourt: "上海铁路运输法院",
        origDate: "2026年10月28日",
        origCaseNo: "（2026）沪7101行初998号行政判决",
        claims: "1. 请求依法撤销上海铁路运输法院（2026）沪7101行初998号行政判决；\n2. 请求改判撤销被上诉人作出的《不予认定工伤决定书》，并判令被上诉人在法定期限内重新作出工伤认定决定；\n3. 一、二审案件受理费由被上诉人负担。",
        facts: "一、上诉人系在下班返回经常居住地合理路线途中遭遇非本人主要责任的交通事故受伤，因绕道顺路接未成年子女放学属日常生活必需的合理路线延伸，符合《最高人民法院关于审理工伤保险行政案件若干问题的规定》第六条第二项之规定。\n二、一审判决机械理解上下班合理路线，未能准确适用上述司法解释，请求二审法院依法纠正。",
        court: "上海市第三中级人民法院",
        copies: "1",
        signer: "韩立伟",
        signDate: todayChinese()
      },
      buildBlocks: function (s) {
        var partyLines = []
          .concat(formatPartyBlock("上诉人", s, "p1"))
          .concat(formatPartyBlock("被上诉人", s, "p2"));
        var lead = "上诉人因" + placeholderOrVal(s.cause, "________") + "一案，不服" +
          placeholderOrVal(s.origCourt, "________人民法院") + "于" +
          placeholderOrVal(s.origDate, "____年__月__日") + "作出的" +
          placeholderOrVal(s.origCaseNo, "（____）____字第____号行政判决（或裁定）") + "，现依法提出上诉。";
        return {
          title: "行政上诉状",
          parties: partyLines,
          leadParagraph: lead,
          sections: [
            { heading: "上诉请求：", body: placeholderOrVal(s.claims, "1. ……\n2. ……") },
            { heading: "事实与理由：", body: placeholderOrVal(s.facts, "……"), indent: true }
          ],
          court: placeholderOrVal(s.court, "________人民法院"),
          attachment: "本上诉状副本 " + placeholderOrVal(s.copies, "____") + " 份",
          signerLabel: "上诉人",
          signer: placeholderOrVal(s.signer, "（签名或盖章）"),
          signDate: placeholderOrVal(s.signDate, todayChinese())
        };
      }
    }
  ];

  var currentKey = "civil_complaint";
  var currentState = {};
  var notifyFn = function () {};
  var urlSyncFn = function () {};

  function getSchema(key) {
    for (var i = 0; i < DOC_SCHEMAS.length; i++) {
      if (DOC_SCHEMAS[i].key === key) return DOC_SCHEMAS[i];
    }
    return DOC_SCHEMAS[0];
  }

  function loadDraftState(schema) {
    var saved = {};
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + schema.key);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (e) {}

    // 默认初始化当事人类型与日期
    for (var i = 0; i < schema.parties.length; i++) {
      var p = schema.parties[i];
      if (p.allowSwitch && !saved[p.prefix + "_mode"]) {
        saved[p.prefix + "_mode"] = p.defaultMode || "person";
      }
    }
    if (!saved.signDate) {
      saved.signDate = todayChinese();
    }
    return saved;
  }

  function saveDraftState(schema, state) {
    try {
      localStorage.setItem(STORAGE_PREFIX + schema.key, JSON.stringify(state));
    } catch (e) {}
  }

  // 渲染单个当事人表单组
  function renderPartyGroupHtml(p, state) {
    var mode = p.fixedMode || state[p.prefix + "_mode"] || p.defaultMode || "person";
    var switchHtml = "";
    if (p.allowSwitch) {
      switchHtml =
        '<div class="party-mode-switch">' +
          '<button type="button" class="party-mode-btn ' + (mode === "person" ? "active" : "") + '" data-party-prefix="' + p.prefix + '" data-party-mode="person">自然人</button>' +
          '<button type="button" class="party-mode-btn ' + (mode === "org" ? "active" : "") + '" data-party-prefix="' + p.prefix + '" data-party-mode="org">法人/非法人组织</button>' +
        "</div>";
    }

    var fieldsHtml = "";
    if (mode === "org") {
      fieldsHtml =
        '<div class="field-row">' +
          '<label class="field-label">单位全称</label>' +
          '<input class="field-input" type="text" data-field="' + p.prefix + '_org_name" value="' + escHtml(state[p.prefix + "_org_name"]) + '" placeholder="营业执照登记全称" />' +
        "</div>" +
        '<div class="field-grid-2 field-row">' +
          '<div><label class="field-label">统一社会信用代码（选填）</label><input class="field-input" type="text" data-field="' + p.prefix + '_org_code" value="' + escHtml(state[p.prefix + "_org_code"]) + '" placeholder="18位信用代码" /></div>' +
          '<div><label class="field-label">联系电话</label><input class="field-input" type="text" data-field="' + p.prefix + '_tel" value="' + escHtml(state[p.prefix + "_tel"]) + '" placeholder="座机或手机号" /></div>' +
        "</div>" +
        '<div class="field-row">' +
          '<label class="field-label">住所地 / 有效送达地址</label>' +
          '<input class="field-input" type="text" data-field="' + p.prefix + '_org_addr" value="' + escHtml(state[p.prefix + "_org_addr"]) + '" placeholder="登记住所地或主要办事机构所在地" />' +
        "</div>" +
        '<div class="field-grid-2 field-row">' +
          '<div><label class="field-label">法定代表人 / 主要负责人</label><input class="field-input" type="text" data-field="' + p.prefix + '_rep_name" value="' + escHtml(state[p.prefix + "_rep_name"]) + '" placeholder="姓名" /></div>' +
          '<div><label class="field-label">职务</label><input class="field-input" type="text" data-field="' + p.prefix + '_rep_title" value="' + escHtml(state[p.prefix + "_rep_title"]) + '" placeholder="董事长/执行董事/总经理" /></div>' +
        "</div>";
    } else if (mode === "admin_agency") {
      fieldsHtml =
        '<div class="field-row">' +
          '<label class="field-label">被告行政机关全称</label>' +
          '<input class="field-input" type="text" data-field="' + p.prefix + '_org_name" value="' + escHtml(state[p.prefix + "_org_name"]) + '" placeholder="例如：上海市某区市场监督管理局" />' +
        "</div>" +
        '<div class="field-row">' +
          '<label class="field-label">机关住所地</label>' +
          '<input class="field-input" type="text" data-field="' + p.prefix + '_org_addr" value="' + escHtml(state[p.prefix + "_org_addr"]) + '" placeholder="行政机关办公地址" />' +
        "</div>" +
        '<div class="field-grid-2 field-row">' +
          '<div><label class="field-label">法定代表人姓名</label><input class="field-input" type="text" data-field="' + p.prefix + '_rep_name" value="' + escHtml(state[p.prefix + "_rep_name"]) + '" placeholder="负责人姓名" /></div>' +
          '<div><label class="field-label">职务</label><input class="field-input" type="text" data-field="' + p.prefix + '_rep_title" value="' + escHtml(state[p.prefix + "_rep_title"]) + '" placeholder="例如：局长 / 主任" /></div>' +
        "</div>";
    } else {
      // 自然人
      var crimRow = "";
      if (p.criminalFields) {
        crimRow =
          '<div class="field-grid-2 field-row">' +
            '<div><label class="field-label">出生地</label><input class="field-input" type="text" data-field="' + p.prefix + '_birthplace" value="' + escHtml(state[p.prefix + "_birthplace"]) + '" placeholder="省市县" /></div>' +
            '<div><label class="field-label">文化程度</label><input class="field-input" type="text" data-field="' + p.prefix + '_edu" value="' + escHtml(state[p.prefix + "_edu"]) + '" placeholder="例如：大学本科" /></div>' +
          "</div>";
      }
      fieldsHtml =
        '<div class="field-grid-2 field-row">' +
          '<div><label class="field-label">姓名</label><input class="field-input" type="text" data-field="' + p.prefix + '_name" value="' + escHtml(state[p.prefix + "_name"]) + '" placeholder="真实姓名" /></div>' +
          '<div><label class="field-label">性别 / 民族</label>' +
            '<div class="field-grid-2">' +
              '<input class="field-input" type="text" data-field="' + p.prefix + '_gender" value="' + escHtml(state[p.prefix + "_gender"]) + '" placeholder="男/女" />' +
              '<input class="field-input" type="text" data-field="' + p.prefix + '_nation" value="' + escHtml(state[p.prefix + "_nation"]) + '" placeholder="汉族" />' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="field-grid-2 field-row">' +
          '<div><label class="field-label">出生日期</label><input class="field-input" type="text" data-field="' + p.prefix + '_birth" value="' + escHtml(state[p.prefix + "_birth"]) + '" placeholder="1990年1月1日出生" /></div>' +
          '<div><label class="field-label">联系电话</label><input class="field-input" type="text" data-field="' + p.prefix + '_tel" value="' + escHtml(state[p.prefix + "_tel"]) + '" placeholder="手机号码" /></div>' +
        "</div>" +
        crimRow +
        '<div class="field-grid-2 field-row">' +
          '<div><label class="field-label">公民身份号码（选填）</label><input class="field-input" type="text" data-field="' + p.prefix + '_idno" value="' + escHtml(state[p.prefix + "_idno"]) + '" placeholder="18位身份证号" /></div>' +
          '<div><label class="field-label">职业 / 工作单位（选填）</label><input class="field-input" type="text" data-field="' + p.prefix + '_job" value="' + escHtml(state[p.prefix + "_job"]) + '" placeholder="职业或单位" /></div>' +
        "</div>" +
        '<div class="field-row">' +
          '<label class="field-label">住址 / 经常居住地（送达地址）</label>' +
          '<input class="field-input" type="text" data-field="' + p.prefix + '_addr" value="' + escHtml(state[p.prefix + "_addr"]) + '" placeholder="详细门牌地址" />' +
        "</div>";
    }

    return (
      '<div class="form-group-box">' +
        '<div class="form-group-head">' +
          '<span class="form-group-title">' + escHtml(p.label) + "</span>" +
          switchHtml +
        "</div>" +
        fieldsHtml +
      "</div>"
    );
  }

  function renderTabs() {
    var container = document.getElementById("docTypeSelector");
    if (!container) return;
    var html = "";
    for (var i = 0; i < DOC_SCHEMAS.length; i++) {
      var s = DOC_SCHEMAS[i];
      var cls = s.key === currentKey ? "doc-tab-btn active" : "doc-tab-btn";
      html += '<button type="button" class="' + cls + '" data-doc-key="' + s.key + '">' + escHtml(s.shortName) + "</button>";
    }
    container.innerHTML = html;
  }

  function renderForm() {
    var schema = getSchema(currentKey);
    var tipEl = document.getElementById("drafterLawTip");
    if (tipEl) {
      tipEl.innerHTML =
        "<strong>法定记载要件提示（关联问答 Q" + schema.qid + "）：</strong>" + escHtml(schema.lawBasis);
    }

    var formEl = document.getElementById("drafterForm");
    if (!formEl) return;

    var html = "";
    for (var i = 0; i < schema.parties.length; i++) {
      html += renderPartyGroupHtml(schema.parties[i], currentState);
    }

    for (var j = 0; j < schema.sections.length; j++) {
      var sec = schema.sections[j];
      html += '<div class="form-group-box">';
      html += '<div class="form-group-head"><span class="form-group-title">' + escHtml(sec.title) + "</span></div>";
      if (sec.grid2) {
        html += '<div class="field-grid-2">';
      }
      for (var k = 0; k < sec.fields.length; k++) {
        var f = sec.fields[k];
        var val = currentState[f.name] != null ? currentState[f.name] : "";
        html += '<div class="field-row">';
        html += '<label class="field-label">' + escHtml(f.label) + "</label>";
        if (f.type === "textarea") {
          html += '<textarea class="field-textarea" rows="' + (f.rows || 4) + '" data-field="' + f.name + '" placeholder="' + escHtml(f.placeholder) + '">' + escHtml(val) + "</textarea>";
        } else {
          html += '<input class="field-input" type="text" data-field="' + f.name + '" value="' + escHtml(val) + '" placeholder="' + escHtml(f.placeholder) + '" />';
        }
        html += "</div>";
      }
      if (sec.grid2) {
        html += "</div>";
      }
      html += "</div>";
    }

    formEl.innerHTML = html;
  }

  function renderPaperHtml(blocks) {
    var html = '<h2 class="doc-paper-title">' + escHtml(blocks.title) + "</h2>";
    for (var i = 0; i < blocks.parties.length; i++) {
      html += '<p class="doc-paper-p">' + escHtml(blocks.parties[i]) + "</p>";
    }
    if (blocks.leadParagraph) {
      html += '<p class="doc-paper-indent">' + escHtml(blocks.leadParagraph) + "</p>";
    }
    for (var j = 0; j < blocks.sections.length; j++) {
      var sec = blocks.sections[j];
      html += '<p class="doc-paper-h">' + escHtml(sec.heading) + "</p>";
      var paras = String(sec.body || "").split(/\n+/);
      for (var pIdx = 0; pIdx < paras.length; pIdx++) {
        var line = paras[pIdx];
        if (!line && paras.length > 1) continue;
        html += '<p class="' + (sec.indent ? "doc-paper-indent" : "doc-paper-p") + '">' + escHtml(line) + "</p>";
      }
    }

    html += '<div class="doc-paper-footer">';
    html += '<div><p class="doc-paper-p">此致</p><p class="doc-paper-p">' + escHtml(blocks.court) + "</p></div>";
    if (blocks.attachment) {
      html += '<p class="doc-paper-p">附：' + escHtml(blocks.attachment) + "</p>";
    }
    html += '<div class="doc-sign-right">';
    html += "<p>" + escHtml(blocks.signerLabel) + "：" + escHtml(blocks.signer) + "</p>";
    html += "<p>" + escHtml(blocks.signDate) + "</p>";
    html += "</div></div>";
    return html;
  }

  function updatePreview() {
    var schema = getSchema(currentKey);
    var blocks = schema.buildBlocks(currentState);
    var html = renderPaperHtml(blocks);
    var paper = document.getElementById("a4PreviewPaper");
    var printNode = document.getElementById("printOnlyDoc");
    if (paper) paper.innerHTML = html;
    if (printNode) printNode.innerHTML = html;
  }

  function buildPlainText(blocks) {
    var lines = [blocks.title, ""];
    for (var i = 0; i < blocks.parties.length; i++) {
      lines.push(blocks.parties[i]);
    }
    lines.push("");
    if (blocks.leadParagraph) {
      lines.push("    " + blocks.leadParagraph);
      lines.push("");
    }
    for (var j = 0; j < blocks.sections.length; j++) {
      var sec = blocks.sections[j];
      lines.push(sec.heading);
      var paras = String(sec.body || "").split(/\n+/);
      for (var p = 0; p < paras.length; p++) {
        if (!paras[p] && paras.length > 1) continue;
        lines.push((sec.indent ? "    " : "") + paras[p]);
      }
      lines.push("");
    }
    lines.push("    此致");
    lines.push(blocks.court);
    lines.push("");
    if (blocks.attachment) {
      lines.push("附：" + blocks.attachment);
      lines.push("");
    }
    lines.push("                                        " + blocks.signerLabel + "：" + blocks.signer);
    lines.push("                                        " + blocks.signDate);
    return lines.join("\n");
  }

  function buildMarkdownText(blocks) {
    var lines = ["# " + blocks.title, ""];
    for (var i = 0; i < blocks.parties.length; i++) {
      lines.push("- " + blocks.parties[i]);
    }
    lines.push("");
    if (blocks.leadParagraph) {
      lines.push(blocks.leadParagraph);
      lines.push("");
    }
    for (var j = 0; j < blocks.sections.length; j++) {
      var sec = blocks.sections[j];
      lines.push("## " + sec.heading.replace(/：$/, ""));
      lines.push("");
      lines.push(sec.body);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
    lines.push("**此致**  ");
    lines.push("**" + blocks.court + "**");
    lines.push("");
    if (blocks.attachment) {
      lines.push("附：" + blocks.attachment);
      lines.push("");
    }
    lines.push("> **" + blocks.signerLabel + "**：" + blocks.signer + "  ");
    lines.push("> **日期**：" + blocks.signDate);
    return lines.join("\n");
  }

  // 生成标准人民法院公文排版 Word (.doc) 文件（兼容 Microsoft Word / WPS Office）
  function buildWordHtml(blocks) {
    var bodyHtml = '<p class="title">' + escHtml(blocks.title) + "</p>";
    for (var i = 0; i < blocks.parties.length; i++) {
      bodyHtml += '<p class="party">' + escHtml(blocks.parties[i]) + "</p>";
    }
    if (blocks.leadParagraph) {
      bodyHtml += '<p class="indent">' + escHtml(blocks.leadParagraph) + "</p>";
    }
    for (var j = 0; j < blocks.sections.length; j++) {
      var sec = blocks.sections[j];
      bodyHtml += '<p class="sec-h">' + escHtml(sec.heading) + "</p>";
      var paras = String(sec.body || "").split(/\n+/);
      for (var p = 0; p < paras.length; p++) {
        if (!paras[p] && paras.length > 1) continue;
        bodyHtml += '<p class="' + (sec.indent ? "indent" : "normal") + '">' + escHtml(paras[p]) + "</p>";
      }
    }
    bodyHtml += '<p class="indent" style="margin-top:18pt;">此致</p>';
    bodyHtml += '<p class="normal">' + escHtml(blocks.court) + "</p>";
    if (blocks.attachment) {
      bodyHtml += '<p class="normal" style="margin-top:12pt;">附：' + escHtml(blocks.attachment) + "</p>";
    }
    bodyHtml += '<p class="sign" style="margin-top:28pt;">' + escHtml(blocks.signerLabel) + "：" + escHtml(blocks.signer) + "</p>";
    bodyHtml += '<p class="sign">' + escHtml(blocks.signDate) + "</p>";

    return (
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + escHtml(blocks.title) + "</title>" +
      "<style>" +
      "@page WordSection1 { size: 21.0cm 29.7cm; margin: 3.7cm 2.6cm 3.5cm 2.8cm; }" +
      "div.WordSection1 { page: WordSection1; }" +
      'p { margin: 0 0 6pt 0; line-height: 28pt; mso-line-height-rule: exactly; font-family: "FangSong_GB2312", "FangSong", "SimSun", serif; font-size: 16pt; color: #000000; }' +
      'p.title { text-align: center; font-family: "FZXiaoBiaoSong-B05S", "STZhongsong", "SimSun", serif; font-size: 22pt; font-weight: bold; letter-spacing: 3pt; margin-bottom: 20pt; }' +
      "p.party { text-indent: 0; }" +
      "p.sec-h { font-family: \"SimHei\", \"FangSong_GB2312\", serif; font-weight: bold; margin-top: 12pt; }" +
      "p.indent { text-indent: 32pt; }" +
      "p.normal { text-indent: 0; }" +
      "p.sign { text-align: right; margin-right: 24pt; }" +
      "</style></head>" +
      '<body><div class="WordSection1">' + bodyHtml + "</div></body></html>"
    );
  }

  function triggerBlobDownload(content, mimeType, filename) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function selectTemplate(key, silentUrl) {
    var schema = getSchema(key);
    currentKey = schema.key;
    currentState = loadDraftState(schema);
    renderTabs();
    renderForm();
    updatePreview();
    if (!silentUrl) {
      urlSyncFn();
    }
  }

  function bindEvents() {
    var tabsEl = document.getElementById("docTypeSelector");
    if (tabsEl) {
      tabsEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-doc-key]");
        if (!btn) return;
        selectTemplate(btn.getAttribute("data-doc-key"), false);
      });
    }

    var formEl = document.getElementById("drafterForm");
    if (formEl) {
      formEl.addEventListener("input", function (e) {
        var field = e.target.getAttribute("data-field");
        if (!field) return;
        currentState[field] = e.target.value;
        saveDraftState(getSchema(currentKey), currentState);
        updatePreview();
      });

      formEl.addEventListener("click", function (e) {
        var switchBtn = e.target.closest("[data-party-mode]");
        if (!switchBtn) return;
        var prefix = switchBtn.getAttribute("data-party-prefix");
        var mode = switchBtn.getAttribute("data-party-mode");
        currentState[prefix + "_mode"] = mode;
        saveDraftState(getSchema(currentKey), currentState);
        renderForm();
        updatePreview();
      });
    }

    var demoBtn = document.getElementById("btnFillDemoDraft");
    if (demoBtn) {
      demoBtn.addEventListener("click", function () {
        var schema = getSchema(currentKey);
        currentState = JSON.parse(JSON.stringify(schema.demo));
        currentState.signDate = todayChinese();
        saveDraftState(schema, currentState);
        renderForm();
        updatePreview();
        notifyFn("已填入「" + schema.shortName + "」标准示例数据，可直接修改或下载");
      });
    }

    var resetBtn = document.getElementById("btnResetDraft");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var schema = getSchema(currentKey);
        currentState = { signDate: todayChinese() };
        for (var i = 0; i < schema.parties.length; i++) {
          var p = schema.parties[i];
          if (p.allowSwitch) currentState[p.prefix + "_mode"] = p.defaultMode || "person";
        }
        saveDraftState(schema, currentState);
        renderForm();
        updatePreview();
        notifyFn("已清空当前文书草稿");
      });
    }

    var shareBtn = document.getElementById("btnShareDraftLink");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var u = new URL(window.location.href);
        u.search = "";
        u.hash = "";
        u.searchParams.set("tab", "draft");
        u.searchParams.set("tpl", currentKey);
        if (window.copyTextToClipboard) {
          window.copyTextToClipboard(u.toString(), "已复制「" + getSchema(currentKey).shortName + "」专属起草链接");
        }
      });
    }

    var docBtn = document.getElementById("btnDownloadDoc");
    if (docBtn) {
      docBtn.addEventListener("click", function () {
        var schema = getSchema(currentKey);
        var blocks = schema.buildBlocks(currentState);
        var wordContent = "\ufeff" + buildWordHtml(blocks);
        triggerBlobDownload(wordContent, "application/msword;charset=utf-8", schema.docTitle + ".doc");
        notifyFn("已生成并下载国标公文排版 Word 文件：" + schema.docTitle + ".doc");
      });
    }

    var mdBtn = document.getElementById("btnDownloadMd");
    if (mdBtn) {
      mdBtn.addEventListener("click", function () {
        var schema = getSchema(currentKey);
        var blocks = schema.buildBlocks(currentState);
        triggerBlobDownload(buildMarkdownText(blocks), "text/markdown;charset=utf-8", schema.docTitle + ".md");
        notifyFn("已下载 Markdown 文书：" + schema.docTitle + ".md");
      });
    }

    var txtBtn = document.getElementById("btnDownloadTxt");
    if (txtBtn) {
      txtBtn.addEventListener("click", function () {
        var schema = getSchema(currentKey);
        var blocks = schema.buildBlocks(currentState);
        triggerBlobDownload("\ufeff" + buildPlainText(blocks), "text/plain;charset=utf-8", schema.docTitle + ".txt");
        notifyFn("已下载纯文本文书：" + schema.docTitle + ".txt");
      });
    }

    var copyBtn = document.getElementById("btnCopyDraftText");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var schema = getSchema(currentKey);
        var blocks = schema.buildBlocks(currentState);
        if (window.copyTextToClipboard) {
          window.copyTextToClipboard(buildPlainText(blocks), "已复制完整「" + schema.docTitle + "」全文");
        }
      });
    }

    var printBtn = document.getElementById("btnPrintDraft");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        updatePreview();
        window.print();
      });
    }
  }

  window.LitigationDrafter = {
    init: function (options) {
      options = options || {};
      if (typeof options.notify === "function") notifyFn = options.notify;
      if (typeof options.onUrlChange === "function") urlSyncFn = options.onUrlChange;
      var initTpl = options.initialTpl || "civil_complaint";
      selectTemplate(initTpl, true);
      bindEvents();
    },
    setTemplate: function (tplKey) {
      if (!tplKey) return;
      selectTemplate(tplKey, true);
    },
    getCurrentKey: function () {
      return currentKey;
    },
    schemas: DOC_SCHEMAS
  };
})();
