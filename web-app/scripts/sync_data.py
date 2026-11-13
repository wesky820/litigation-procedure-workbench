#!/usr/bin/env python3
"""
生成 Web 应用离线/静态托管所需的模块化数据包（data/catalog.js 与 data/chunks/qa-*.js）。
支持从上级知识库 JSON 同步更新，零第三方依赖。
"""

import json
import os
import re

WEB_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE = os.path.dirname(WEB_ROOT)
DB_PATH = os.path.join(
    WORKSPACE, "skills", "litigation-procedure-qa", "resources", "qa_database.json"
)
DATA_DIR = os.path.join(WEB_ROOT, "data")


def main():
    if not os.path.exists(DB_PATH):
        print(f"数据源不存在：{DB_PATH}，保留现有 data/ 目录数据。")
        return

    with open(DB_PATH, encoding="utf-8") as f:
        db = json.load(f)

    questions = db["questions"]
    os.makedirs(os.path.join(DATA_DIR, "chunks"), exist_ok=True)

    parts = []
    part_map = {}
    chapters = []
    chap_map = {}
    sections = []
    sect_map = {}

    chunks = {i: {} for i in range(7)}
    catalog_items = []
    templates = []

    for r in questions:
        qid = r["id"]
        p_name = r["part"]
        c_name = r["chapter"]
        s_name = r["section"] or ""

        if p_name not in part_map:
            part_map[p_name] = len(parts)
            parts.append(p_name)
        p_idx = part_map[p_name]

        c_key = f"{p_idx}:{c_name}"
        if c_key not in chap_map:
            chap_map[c_key] = len(chapters)
            chapters.append([p_idx, c_name])
        c_idx = chap_map[c_key]

        s_key = f"{c_idx}:{s_name}"
        if s_key not in sect_map:
            sect_map[s_key] = len(sections)
            sections.append([c_idx, s_name])
        s_idx = sect_map[s_key]

        if p_idx == 0:
            chunk_id = 0 if qid <= 763 else 1
        else:
            chunk_id = p_idx + 1

        is_sh = 1 if r.get("scope") == "national_with_shanghai_local" else 0
        q_text = r["question"]
        ans_text = r["answer"]
        law_text = r.get("legal_basis", "")
        note_text = r.get("special_note", "")
        sh_text = r.get("shanghai_local_note", "")
        case_text = r.get("reference_case", "")
        tpl_text = r.get("template", "")

        catalog_items.append(
            [qid, p_idx, c_idx, s_idx, chunk_id, is_sh, q_text]
        )

        detail = [ans_text, law_text, note_text, sh_text, case_text]
        while len(detail) > 1 and detail[-1] == "":
            detail.pop()
        chunks[chunk_id][str(qid)] = detail

        if tpl_text:
            templates.append(
                {
                    "id": qid,
                    "title": re.sub(r"(该怎么写|如何写)？$", "", q_text),
                    "question": q_text,
                    "requirements": ans_text,
                    "law": law_text,
                    "content": tpl_text,
                }
            )

    filing_deadlines = [
        {
            "type": "民事一审起诉",
            "limit": "当场登记立案；不能当场判定的 7 日内决定",
            "condition": "原告与本案有直接利害关系、有明确被告、有具体诉讼请求和事实理由、属法院受理民事诉讼范围及受诉法院管辖（《民事诉讼法》第122条）",
            "remedy": "对不予受理/驳回起诉裁定可在收到后 10 日内上诉（小额诉讼驳回起诉裁定一审终审除外）",
            "qids": [419, 420, 861, 914],
        },
        {
            "type": "小额诉讼程序",
            "limit": "一般收到材料当日登记立案，审限 2 个月",
            "condition": "基层法院审理事实清楚、权利义务关系明确、争议不大，标的额为各省上年度就业人员年平均工资 50% 以下的简单金钱给付案件",
            "remedy": "实行一审终审，判决及管辖异议、驳回起诉裁定均不得上诉（可依法申请再审）",
            "qids": [847, 852, 860, 861],
        },
        {
            "type": "诉前财产/行为/证据保全",
            "limit": "接受申请及担保后 48 小时内作出裁定并立即执行",
            "condition": "情况紧急，不立即申请保全将会使合法权益受到难以弥补的损害或证据灭失；诉前财产/行为保全应当提供担保",
            "remedy": "采取保全措施后 30 日内必须依法提起诉讼或申请仲裁，逾期不诉法院应当解除保全",
            "qids": [243, 245, 246, 2250],
        },
        {
            "type": "劳动争议起诉",
            "limit": "收到仲裁裁决书或不予受理通知书之日起 15 日内",
            "condition": "须先经劳动争议仲裁前置（持用人单位工资欠条且不涉其他劳动关系争议的，可直接按普通民事纠纷起诉）",
            "remedy": "一裁终局案件劳动者可 15 日内起诉；用人单位不得起诉，但可 30 日内向中院申请撤销裁决",
            "qids": [466, 471, 506, 513],
        },
        {
            "type": "行政一审起诉",
            "limit": "当场登记立案或 7 日内决定是否立案",
            "condition": "直接起诉期限一般为知道行政行为之日起 6 个月内；经复议的为收到复议决定书之日起 15 日内（注意 2023 新《行政复议法》5 类复议前置情形）",
            "remedy": "对不予立案裁定 10 日内上诉；既不立案又不作裁定的可向上一级法院起诉",
            "qids": [2086, 2087, 2102, 2105],
        },
        {
            "type": "刑事自诉案件",
            "limit": "收到自诉状次日起 15 日内审查完毕",
            "condition": "属三类自诉范围（告诉才处理、被害人有证据证明的轻微刑事案件、公诉转自诉）、有明确被告人（下落不明不可自诉）和证明犯罪事实的罪证",
            "remedy": "自诉人对不予受理或驳回起诉刑事裁定不服，可在收到后 5 日内提出上诉",
            "qids": [1825, 1828, 1834, 1858],
        },
        {
            "type": "首次申请强制执行",
            "limit": "符合条件的 7 日内决定立案；申请执行期间为 2 年",
            "condition": "生效法律文书具有可执行给付内容、申请人适格、义务人逾期未履行、属于受申请法院管辖（一般是第一审法院或同级被执行财产所在地法院）",
            "remedy": "首次申请执行不预交执行费；对不予受理执行裁定可在 10 日内向上一级法院申请复议",
            "qids": [1094, 1156, 1162, 1170],
        },
        {
            "type": "督促程序（申请支付令）",
            "limit": "5 日内通知是否受理；受理后 15 日内审查发出",
            "condition": "请求给付金钱或有价证券已到期且数额确定，债权人无对待给付义务，且支付令能够送达债务人（不可公告送达）",
            "remedy": "债务人收到后 15 日内提出书面异议则支付令自动失效，转入诉讼（不同意转诉除外）",
            "qids": [1049, 1054, 1060, 1063],
        },
    ]

    catalog_payload = {
        "parts": parts,
        "chapters": chapters,
        "sections": sections,
        "deadlines": filing_deadlines,
        "templates": templates,
        "items": catalog_items,
    }

    cat_path = os.path.join(DATA_DIR, "catalog.js")
    with open(cat_path, "w", encoding="utf-8") as f:
        f.write(
            "window.LITIGATION_CATALOG = "
            + json.dumps(catalog_payload, ensure_ascii=False, separators=(",", ":"))
            + ";\n"
        )
    print(f"Generated {cat_path} ({os.path.getsize(cat_path)/1024:.1f} KiB)")

    for cid, cmap in sorted(chunks.items()):
        c_path = os.path.join(DATA_DIR, "chunks", f"qa-{cid}.js")
        with open(c_path, "w", encoding="utf-8") as f:
            f.write(
                "window.LITIGATION_CHUNKS = window.LITIGATION_CHUNKS || {};\n"
                f"window.LITIGATION_CHUNKS[{cid}] = "
                + json.dumps(cmap, ensure_ascii=False, separators=(",", ":"))
                + ";\n"
            )
        print(f"Generated {c_path} ({len(cmap)} items, {os.path.getsize(c_path)/1024:.1f} KiB)")


if __name__ == "__main__":
    main()
