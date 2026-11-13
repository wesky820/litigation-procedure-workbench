#!/usr/bin/env python3
"""
中国人民法院立案与诉讼程序实务问答多维精准检索与诉讼费用速算工具

用法示例：
  # 1. 多关键词语义相关度检索（自动按题干/章节/正文匹配度排序）
  python3 search_qa.py "诉前保全 担保 多久起诉"
  python3 search_qa.py "法定代表人 辞任" --part 商事
  python3 search_qa.py "复议前置" --part 行政

  # 2. 按题号或题号区间精确调取全文
  python3 search_qa.py --id 4,5,913
  python3 search_qa.py --id 1825-1830

  # 3. 按引用法律法规检索或仅看含上海法院实务口径条目
  python3 search_qa.py --law "公司法" --top 15
  python3 search_qa.py --shanghai
  python3 search_qa.py --templates

  # 4. 诉讼费 / 保全费 / 执行费 / 支付令精确计算器（支持“万”“亿”单位）
  python3 search_qa.py --calc-fee 350万
  python3 search_qa.py --calc-fee 1250000
"""

import argparse
import json
import os
import re
import sys
from decimal import Decimal, ROUND_HALF_UP

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "..", "resources", "qa_database.json")


def parse_amount(val_str: str) -> Decimal:
    s = val_str.strip().replace(",", "").replace("，", "").replace("元", "")
    mult = Decimal("1")
    if s.endswith("亿"):
        mult = Decimal("100000000")
        s = s[:-1]
    elif s.endswith("万"):
        mult = Decimal("10000")
        s = s[:-1]
    return (Decimal(s) * mult).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def fmt_money(d: Decimal) -> str:
    q = d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{q:,.2f} 元"


def calc_property_case_fee(amount: Decimal) -> Decimal:
    """《诉讼费用交纳办法》第十三条第一项：财产案件10档分段累计（Q301）"""
    if amount <= Decimal("10000"):
        return Decimal("50")
    brackets = [
        (Decimal("10000"), Decimal("100000"), Decimal("0.025")),
        (Decimal("100000"), Decimal("200000"), Decimal("0.020")),
        (Decimal("200000"), Decimal("500000"), Decimal("0.015")),
        (Decimal("500000"), Decimal("1000000"), Decimal("0.010")),
        (Decimal("1000000"), Decimal("2000000"), Decimal("0.009")),
        (Decimal("2000000"), Decimal("5000000"), Decimal("0.008")),
        (Decimal("5000000"), Decimal("10000000"), Decimal("0.007")),
        (Decimal("10000000"), Decimal("20000000"), Decimal("0.006")),
        (Decimal("20000000"), None, Decimal("0.005")),
    ]
    fee = Decimal("50")
    for low, high, rate in brackets:
        if amount <= low:
            break
        upper = amount if (high is None or amount < high) else high
        fee += (upper - low) * rate
    return fee


def calc_preservation_fee(amount: Decimal) -> Decimal:
    """《诉讼费用交纳办法》第十四条第二项：保全申请费，封顶5000元（Q318）"""
    if amount <= Decimal("1000"):
        return Decimal("30")
    fee = Decimal("30")
    if amount > Decimal("1000"):
        u1 = min(amount, Decimal("100000"))
        fee += (u1 - Decimal("1000")) * Decimal("0.01")
    if amount > Decimal("100000"):
        fee += (amount - Decimal("100000")) * Decimal("0.005")
    return min(fee, Decimal("5000"))


def calc_enforcement_fee(amount: Decimal) -> Decimal:
    """《诉讼费用交纳办法》第十四条第一项：申请执行费分段累计（Q314）"""
    if amount <= Decimal("10000"):
        return Decimal("50")
    brackets = [
        (Decimal("10000"), Decimal("500000"), Decimal("0.015")),
        (Decimal("500000"), Decimal("5000000"), Decimal("0.010")),
        (Decimal("5000000"), Decimal("10000000"), Decimal("0.005")),
        (Decimal("10000000"), None, Decimal("0.001")),
    ]
    fee = Decimal("50")
    for low, high, rate in brackets:
        if amount <= low:
            break
        upper = amount if (high is None or amount < high) else high
        fee += (upper - low) * rate
    return fee


def print_fee_report(val_str: str):
    amt = parse_amount(val_str)
    prop_fee = calc_property_case_fee(amt)
    half_fee = prop_fee / Decimal("2")
    pres_fee = calc_preservation_fee(amt)
    enf_fee = calc_enforcement_fee(amt)
    pay_order_fee = prop_fee / Decimal("3")
    bankruptcy_fee = min(half_fee, Decimal("300000"))

    divorce_extra = Decimal("0") if amt <= Decimal("200000") else (amt - Decimal("200000")) * Decimal("0.005")
    pers_extra = Decimal("0")
    if amt > Decimal("50000"):
        pers_extra += (min(amt, Decimal("100000")) - Decimal("50000")) * Decimal("0.01")
    if amt > Decimal("100000"):
        pers_extra += (amt - Decimal("100000")) * Decimal("0.005")

    print(f"=== 诉讼费用精确速算报告（标的额：{fmt_money(amt)}）===")
    print(f"1. 财产案件一审受理费（普通程序全额，Q301）  ：{fmt_money(prop_fee)}")
    print(f"   └─ 简易程序 / 调解结案 / 撤诉减半（Q326-328）：{fmt_money(half_fee)}")
    print(f"2. 申请财产/行为保全费（上限5000元，Q318）    ：{fmt_money(pres_fee)}")
    print(f"3. 申请执行费（执行到位扣交、不预交，Q314/335）：{fmt_money(enf_fee)}")
    print(f"4. 督促程序申请支付令费（按财产1/3，Q319）    ：{fmt_money(pay_order_fee)}")
    print(f"5. 破产案件申请费（减半且封顶30万，Q324相关） ：{fmt_money(bankruptcy_fee)}")
    print(f"6. 离婚涉及该额财产分割附加费（超20万0.5%，Q304）：基础 50~300 元 + {fmt_money(divorce_extra)}")
    print(f"7. 人格权侵害涉及该额赔偿附加费（超5万分段，Q304）：基础 100~500 元 + {fmt_money(pers_extra)}")
    print("依据：《诉讼费用交纳办法》第十三条、第十四条、第十五条、第十六条。")


def parse_id_spec(spec: str):
    ids = set()
    for part in spec.split(","):
        part = part.strip().lstrip("Qq")
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            for i in range(int(a.lstrip("Qq")), int(b.lstrip("Qq")) + 1):
                ids.add(i)
        else:
            ids.add(int(part))
    return sorted(ids)


def format_record(r: dict, brief: bool = False) -> str:
    loc = " > ".join(x for x in [r["part"], r["chapter"], r["section"]] if x)
    badge = " 【含上海法院实务口径】" if r["scope"] == "national_with_shanghai_local" else ""
    out = [
        f"============================================================",
        f"[Q{r['id']}] {r['question']}{badge}",
        f"分类：{loc} | 模块：{r['ref_file']}",
        f"------------------------------------------------------------",
    ]
    if brief:
        ans_preview = r["answer"].replace("\n", " ")
        if len(ans_preview) > 180:
            ans_preview = ans_preview[:180] + "……"
        out.append(f"解答摘要：{ans_preview}")
        if r["legal_basis"]:
            out.append(f"法条提示：{r['legal_basis'].splitlines()[0]}")
    else:
        out.append("【解答】")
        out.append(r["answer"])
        if r["special_note"]:
            out.append("\n【特别提示】")
            out.append(r["special_note"])
        if r["shanghai_local_note"]:
            out.append(f"\n【全国通用 vs 上海实务区分】\n{r['shanghai_local_note']}")
        if r["reference_case"]:
            out.append("\n【参考案例】")
            out.append(r["reference_case"])
        if r["legal_basis"]:
            out.append("\n【法条提示】")
            out.append(r["legal_basis"])
        if r["template"]:
            out.append("\n" + r["template"])
    return "\n".join(out)


def score_record(r: dict, terms: list) -> float:
    score = 0.0
    q = r["question"]
    ch = r["chapter"] + " " + r["section"]
    ans = r["answer"]
    note = r["special_note"] + " " + r["shanghai_local_note"]
    law = r["legal_basis"]
    full = f"{q}\n{ch}\n{ans}\n{note}\n{law}"

    matched_terms = 0
    for t in terms:
        if t in full:
            matched_terms += 1
            if t in q:
                score += 6.0
            if t in ch:
                score += 3.0
            if t in ans:
                score += 2.0 + min(ans.count(t), 4) * 0.3
            if t in note:
                score += 2.5
            if t in law:
                score += 1.5
    if matched_terms == len(terms) and len(terms) > 1:
        score *= 1.5  # Boost records matching ALL query keywords
    return score


def main():
    parser = argparse.ArgumentParser(description="中国人民法院立案与诉讼程序实务问答检索与算费工具")
    parser.add_argument("query", nargs="?", default="", help="检索关键词（多个词以空格分隔）")
    parser.add_argument("--id", dest="id_spec", help="按题号或区间精确查询，如 4,5 或 1825-1830")
    parser.add_argument("--part", help="限定编名关键词，如 民事 / 商事 / 刑事 / 赔偿 / 行政 / 知识产权")
    parser.add_argument("--chapter", help="限定章/节名关键词，如 管辖 / 保全 / 劳动 / 公司")
    parser.add_argument("--law", help="按法条提示中的法规名称过滤，如 民事诉讼法 / 公司法 / 行政复议法")
    parser.add_argument("--shanghai", action="store_true", help="仅显示含上海法院实务口径/专门管辖标准的问答")
    parser.add_argument("--has-note", action="store_true", help="仅显示含【特别提示】的问答")
    parser.add_argument("--templates", action="store_true", help="列出含官方诉讼文书范本的问答")
    parser.add_argument("--calc-fee", dest="calc_fee", help="精确计算给定标的额的各类诉讼/保全/执行费用，如 350万")
    parser.add_argument("--top", type=int, default=8, help="最大返回条数（默认 8）")
    parser.add_argument("--brief", action="store_true", help="仅输出摘要模式")
    parser.add_argument("--json", dest="as_json", action="store_true", help="以 JSON 格式输出结果")
    args = parser.parse_args()

    if args.calc_fee:
        print_fee_report(args.calc_fee)
        return

    with open(DB_PATH, encoding="utf-8") as f:
        db = json.load(f)
    questions = db["questions"]

    if args.id_spec:
        target_ids = set(parse_id_spec(args.id_spec))
        results = [r for r in questions if r["id"] in target_ids]
    else:
        pool = questions
        if args.part:
            pool = [r for r in pool if args.part in r["part"]]
        if args.chapter:
            pool = [r for r in pool if (args.chapter in r["chapter"] or args.chapter in r["section"])]
        if args.law:
            pool = [r for r in pool if args.law in r["legal_basis"]]
        if args.shanghai:
            pool = [r for r in pool if r["scope"] == "national_with_shanghai_local"]
        if args.has_note:
            pool = [r for r in pool if r["special_note"]]
        if args.templates:
            pool = [r for r in pool if r["template"]]

        terms = [t.strip() for t in re.split(r"\s+", args.query.strip()) if t.strip()]
        if terms:
            scored = []
            for r in pool:
                sc = score_record(r, terms)
                if sc > 0:
                    scored.append((sc, r))
            scored.sort(key=lambda x: (-x[0], x[1]["id"]))
            results = [x[1] for x in scored[: args.top]]
        else:
            results = pool[: args.top] if not (args.shanghai or args.templates) else pool

    if args.as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return

    if not results:
        print("未找到匹配的程序问答。建议减少限定词、拆分为短关键词，或查看 references/27-master-index-and-statutes.md 浏览章节目录。")
        return

    print(f"共命中并返回 {len(results)} 条问答：")
    for r in results:
        print(format_record(r, brief=args.brief))


if __name__ == "__main__":
    main()
