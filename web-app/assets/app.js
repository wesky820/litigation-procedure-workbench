/**
 * 诉讼立案与程序实务工作台 — 主应用控制器 (app.js)
 * 纯前端零构建架构：支持 2,300 项问答渐进式分片检索、URL 深度直达路由、
 * 整数分精确诉讼费速算、自适应高度 Retina 长图导出、深浅色主题与本地收藏持久化。
 */
(function () {
  "use strict";

  var catalog = window.LITIGATION_CATALOG || {
    parts: [],
    chapters: [],
    sections: [],
    deadlines: [],
    templates: [],
    items: []
  };
  window.LITIGATION_CHUNKS = window.LITIGATION_CHUNKS || {};

  var FAV_STORAGE_KEY = "litigation_web_favs_v1";
  var CHECK_STORAGE_KEY = "litigation_web_checklist_v1";
  var THEME_STORAGE_KEY = "litigation_web_theme_v1";
  var PAGE_SIZE = 50;

  // 构建题号快速索引表: qid -> item tuple [qid, pIdx, cIdx, sIdx, chunkId, isSh, qText]
  var itemById = {};
  var partCounts = {};
  for (var idx = 0; idx < catalog.items.length; idx++) {
    var row = catalog.items[idx];
    itemById[row[0]] = row;
    partCounts[row[1]] = (partCounts[row[1]] || 0) + 1;
  }

  var state = {
    tab: "qa",
    part: -1,
    chapter: -1,
    shOnly: false,
    favOnly: false,
    query: "",
    filtered: [],
    visibleLimit: PAGE_SIZE,
    activeQid: null,
    favSet: loadFavSet(),
    chunksLoadedCount: 0,
    chunkCallbacks: {},
    calcAmount: 350,
    calcUnit: 10000
  };

  var toastTimer = null;

  /* ==================== 工具函数 ==================== */
  function escHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(text, tokens) {
    var safe = escHtml(text);
    if (!tokens || !tokens.length) return safe;
    var valid = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] && tokens[i].length >= 1) {
        valid.push(escapeRegExp(escHtml(tokens[i])));
      }
    }
    if (!valid.length) return safe;
    var re = new RegExp("(" + valid.join("|") + ")", "gi");
    return safe.replace(re, '<mark class="hl">$1</mark>');
  }

  function showToast(msg) {
    var el = document.getElementById("webToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add("hidden");
    }, 2600);
  }

  function copyTextToClipboard(text, successMsg) {
    var msg = successMsg || "已复制到剪贴板";
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast(msg);
        },
        function () {
          fallbackCopy(text, msg);
        }
      );
    } else {
      fallbackCopy(text, msg);
    }
  }

  function fallbackCopy(text, msg) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      showToast(msg);
    } catch (e) {
      showToast("复制失败，请手动选中复制");
    }
    document.body.removeChild(ta);
  }

  window.copyTextToClipboard = copyTextToClipboard;

  function loadFavSet() {
    var map = {};
    try {
      var arr = JSON.parse(localStorage.getItem(FAV_STORAGE_KEY) || "[]");
      if (Array.isArray(arr)) {
        for (var i = 0; i < arr.length; i++) map[Number(arr[i])] = true;
      }
    } catch (e) {}
    return map;
  }

  function saveFavSet() {
    var arr = [];
    for (var k in state.favSet) {
      if (state.favSet[k]) arr.push(Number(k));
    }
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
    updateFavCounters();
  }

  function favCount() {
    var c = 0;
    for (var k in state.favSet) {
      if (state.favSet[k]) c++;
    }
    return c;
  }

  function updateFavCounters() {
    var el = document.getElementById("topFavCount");
    if (el) el.textContent = String(favCount());
  }

  /* ==================== 主题切换（浅色/深色） ==================== */
  function initTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {}
    var theme = saved;
    if (!theme) {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    applyTheme(theme);

    var btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        var cur = document.documentElement.getAttribute("data-theme") || "light";
        var next = cur === "dark" ? "light" : "dark";
        applyTheme(next);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch (e) {}
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  /* ==================== 渐进式数据分片加载 ==================== */
  function updateChunkBadge() {
    var loaded = 0;
    for (var i = 0; i <= 6; i++) {
      if (window.LITIGATION_CHUNKS && window.LITIGATION_CHUNKS[i]) loaded++;
    }
    state.chunksLoadedCount = loaded;
    var badge = document.getElementById("chunkLoadBadge");
    if (!badge) return;
    if (loaded >= 7) {
      badge.textContent = "✓ 全文索引就绪 (2,300题)";
      badge.classList.add("ready");
    } else {
      badge.textContent = "正在加载全文索引 " + loaded + "/7…";
      badge.classList.remove("ready");
    }
  }

  function loadChunk(chunkId, cb) {
    if (window.LITIGATION_CHUNKS && window.LITIGATION_CHUNKS[chunkId]) {
      updateChunkBadge();
      if (cb) cb(window.LITIGATION_CHUNKS[chunkId]);
      return;
    }

    if (state.chunkCallbacks[chunkId]) {
      if (cb) state.chunkCallbacks[chunkId].push(cb);
      return;
    }

    state.chunkCallbacks[chunkId] = cb ? [cb] : [];
    var s = document.createElement("script");
    s.src = "./data/chunks/qa-" + chunkId + ".js";
    s.async = true;
    s.onload = function () {
      updateChunkBadge();
      var list = state.chunkCallbacks[chunkId] || [];
      delete state.chunkCallbacks[chunkId];
      var data = window.LITIGATION_CHUNKS[chunkId] || {};
      for (var i = 0; i < list.length; i++) {
        list[i](data);
      }
    };
    s.onerror = function () {
      delete state.chunkCallbacks[chunkId];
      showToast("数据分片 qa-" + chunkId + ".js 加载失败，请使用本地静态服务器预览");
    };
    document.body.appendChild(s);
  }

  function prefetchAllChunks() {
    var nextId = 0;
    function step() {
      if (nextId > 6) {
        updateChunkBadge();
        if (state.query.trim()) {
          runFilterAndRender(false);
        }
        return;
      }
      var cid = nextId++;
      loadChunk(cid, function () {
        setTimeout(step, 35);
      });
    }
    setTimeout(step, 80);
  }

  /* ==================== 筛选与全文加权检索 ==================== */
  function initPartAndChapterControls() {
    var pills = document.querySelectorAll("#partPills .part-pill");
    for (var i = 0; i < pills.length; i++) {
      var pVal = Number(pills[i].getAttribute("data-part"));
      if (pVal >= 0 && partCounts[pVal]) {
        var baseLabel = pills[i].textContent.replace(/\s*\(\d+\)$/, "");
        pills[i].textContent = baseLabel + " (" + partCounts[pVal] + ")";
      }
    }
    populateChapterOptions();
  }

  function populateChapterOptions() {
    var sel = document.getElementById("chapterSelect");
    if (!sel) return;
    var html = '<option value="-1">全部章节' + (state.part === -1 ? "（59章）" : "") + "</option>";
    for (var cIdx = 0; cIdx < catalog.chapters.length; cIdx++) {
      var ch = catalog.chapters[cIdx];
      if (state.part !== -1 && ch[0] !== state.part) continue;
      var selectedAttr = state.chapter === cIdx ? " selected" : "";
      html += '<option value="' + cIdx + '"' + selectedAttr + ">" + escHtml(ch[1]) + "</option>";
    }
    sel.innerHTML = html;
  }

  function parseQueryTokens(q) {
    var trimmed = String(q || "").trim();
    if (!trimmed) return [];
    return trimmed.split(/[\s,，、；;]+/).filter(Boolean);
  }

  function extractExactQid(q) {
    var m = String(q || "").trim().match(/^(?:[qQ]|第)?\s*(\d{1,4})\s*(?:题)?$/);
    if (!m) return null;
    var num = Number(m[1]);
    return num >= 1 && num <= 2300 ? num : null;
  }

  function runFilterAndRender(resetLimit) {
    if (resetLimit !== false) {
      state.visibleLimit = PAGE_SIZE;
    }

    var qRaw = state.query.trim();
    var exactQid = extractExactQid(qRaw);
    var tokens = parseQueryTokens(qRaw);
    var lowerTokens = [];
    for (var t = 0; t < tokens.length; t++) {
      lowerTokens.push(tokens[t].toLowerCase());
    }

    var scored = [];
    for (var i = 0; i < catalog.items.length; i++) {
      var item = catalog.items[i];
      var qid = item[0];
      var pIdx = item[1];
      var cIdx = item[2];
      var sIdx = item[3];
      var chunkId = item[4];
      var isSh = item[5];
      var qText = item[6];

      if (state.part !== -1 && pIdx !== state.part) continue;
      if (state.chapter !== -1 && cIdx !== state.chapter) continue;
      if (state.shOnly && !isSh) continue;
      if (state.favOnly && !state.favSet[qid]) continue;

      if (!lowerTokens.length) {
        scored.push({ item: item, score: 0 });
        continue;
      }

      var score = 0;
      if (exactQid && qid === exactQid) {
        score += 1000;
      } else if (exactQid && String(qid).indexOf(String(exactQid)) !== -1) {
        score += 120;
      }

      var chapName = (catalog.chapters[cIdx] && catalog.chapters[cIdx][1]) || "";
      var sectName = (catalog.sections[sIdx] && catalog.sections[sIdx][1]) || "";
      var qLower = qText.toLowerCase();
      var metaLower = (chapName + " " + sectName).toLowerCase();

      var detail = window.LITIGATION_CHUNKS[chunkId] && window.LITIGATION_CHUNKS[chunkId][String(qid)];
      var ansLower = detail && detail[0] ? detail[0].toLowerCase() : "";
      var lawLower = detail && detail[1] ? detail[1].toLowerCase() : "";
      var noteLower = detail ? ((detail[2] || "") + " " + (detail[3] || "")).toLowerCase() : "";

      var allMatched = true;
      for (var k = 0; k < lowerTokens.length; k++) {
        var tk = lowerTokens[k];
        var hit = false;
        if (exactQid && qid === exactQid) {
          hit = true;
        }
        if (qLower.indexOf(tk) !== -1) {
          score += 50;
          if (qLower.indexOf(tk) === 0) score += 10;
          hit = true;
        }
        if (metaLower.indexOf(tk) !== -1) {
          score += 18;
          hit = true;
        }
        if (ansLower && ansLower.indexOf(tk) !== -1) {
          score += 14;
          hit = true;
        }
        if (noteLower && noteLower.indexOf(tk) !== -1) {
          score += 12;
          hit = true;
        }
        if (lawLower && lawLower.indexOf(tk) !== -1) {
          score += 9;
          hit = true;
        }
        if (!hit) {
          allMatched = false;
          break;
        }
      }

      if (allMatched && score > 0) {
        scored.push({ item: item, score: score });
      }
    }

    if (lowerTokens.length) {
      scored.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.item[0] - b.item[0];
      });
    }

    state.filtered = scored;
    renderQaList(tokens);
  }

  function renderQaList(tokens) {
    var statEl = document.getElementById("qaResultStat");
    var listEl = document.getElementById("qaCardsList");
    var moreBtn = document.getElementById("loadMoreQaBtn");
    if (!listEl) return;

    var total = state.filtered.length;
    if (statEl) {
      statEl.textContent = state.query.trim()
        ? "检索到 " + total + " 条匹配问答"
        : "共 " + total + " 条诉讼程序问答";
    }

    if (total === 0) {
      listEl.innerHTML =
        '<div class="empty-reader" style="padding:48px 16px;">' +
        "<p>未找到匹配的程序问答。请尝试缩短关键词、取消筛选条件或等待全文索引同步完成。</p>" +
        "</div>";
      if (moreBtn) moreBtn.classList.add("hidden");
      return;
    }

    var end = Math.min(total, state.visibleLimit);
    var html = "";
    for (var i = 0; i < end; i++) {
      var row = state.filtered[i].item;
      var qid = row[0];
      var pIdx = row[1];
      var cIdx = row[2];
      var isSh = row[5];
      var qText = row[6];

      var partShort = (catalog.parts[pIdx] || "").replace(/^第.部分\s*/, "");
      var chapShort = (catalog.chapters[cIdx] && catalog.chapters[cIdx][1]) || "";
      var isSelected = state.activeQid === qid;
      var isFav = !!state.favSet[qid];

      html +=
        '<div class="qa-item-card' + (isSelected ? " selected" : "") + '" data-qid="' + qid + '">' +
          '<div class="qa-item-title">' +
            '<span class="qa-id-num">Q' + qid + "</span>" +
            highlightText(qText, tokens) +
          "</div>" +
          '<div class="qa-item-meta">' +
            '<span class="tag-meta">' + escHtml(partShort) + " · " + escHtml(chapShort) + "</span>" +
            (isSh ? '<span class="tag-sh">上海参考</span>' : "") +
            (isFav ? '<span class="tag-fav">★ 已收藏</span>' : "") +
          "</div>" +
        "</div>";
    }

    listEl.innerHTML = html;

    if (moreBtn) {
      if (end < total) {
        moreBtn.textContent = "加载更多（已显示 " + end + " / " + total + " 条）";
        moreBtn.classList.remove("hidden");
      } else {
        moreBtn.classList.add("hidden");
      }
    }
  }

  /* ==================== 右栏详情阅读器 ==================== */
  function openQuestion(qid, opts) {
    opts = opts || {};
    var item = itemById[Number(qid)];
    if (!item) return;

    state.activeQid = item[0];
    updateSelectedCardHighlight();
    updateFavButtonState();

    if (opts.openDrawer && window.innerWidth <= 960) {
      var pane = document.getElementById("qaDetailPane");
      if (pane) pane.classList.add("mobile-open");
    }

    var article = document.getElementById("detailArticle");
    var chunkId = item[4];
    if (!(window.LITIGATION_CHUNKS && window.LITIGATION_CHUNKS[chunkId])) {
      if (article) {
        article.innerHTML = '<div class="empty-reader"><p>正在加载 Q' + item[0] + " 详情内容…</p></div>";
      }
    }

    loadChunk(chunkId, function (chunkData) {
      if (state.activeQid !== item[0]) return;
      var detail = chunkData[String(item[0])] || [""];
      renderQuestionDetail(item, detail);
    });

    if (!opts.silentUrl) {
      syncUrlFromState();
    }
  }

  function updateSelectedCardHighlight() {
    var cards = document.querySelectorAll("#qaCardsList .qa-item-card");
    for (var i = 0; i < cards.length; i++) {
      var cid = Number(cards[i].getAttribute("data-qid"));
      cards[i].classList.toggle("selected", cid === state.activeQid);
    }
  }

  function updateFavButtonState() {
    var btn = document.getElementById("btnFavQa");
    if (!btn || !state.activeQid) return;
    var isFav = !!state.favSet[state.activeQid];
    btn.textContent = isFav ? "★ 已收藏" : "☆ 收藏";
  }

  function renderQuestionDetail(item, detail) {
    var article = document.getElementById("detailArticle");
    if (!article) return;

    var qid = item[0];
    var pName = catalog.parts[item[1]] || "";
    var cName = (catalog.chapters[item[2]] && catalog.chapters[item[2]][1]) || "";
    var sName = (catalog.sections[item[3]] && catalog.sections[item[3]][1]) || "";
    var qText = item[6];

    var ansText = detail[0] || "";
    var lawText = detail[1] || "";
    var noteText = detail[2] || "";
    var shText = detail[3] || "";
    var caseText = detail[4] || "";

    var tokens = parseQueryTokens(state.query);
    var breadcrumb = pName + " / " + cName + (sName ? " / " + sName : "");

    var html =
      '<div class="reader-breadcrumb">' + escHtml(breadcrumb) + "</div>" +
      '<h1 class="reader-title">Q' + qid + ". " + highlightText(qText, tokens) + "</h1>" +
      '<div class="reader-section">' +
        '<span class="reader-badge rb-ans">实务解答</span>' +
        '<div class="reader-body">' + highlightText(ansText, tokens) + "</div>" +
      "</div>";

    if (noteText) {
      html +=
        '<div class="reader-section">' +
          '<span class="reader-badge rb-note">特别提示</span>' +
          '<div class="reader-body">' + highlightText(noteText, tokens) + "</div>" +
        "</div>";
    }

    if (shText) {
      html +=
        '<div class="reader-section">' +
          '<span class="reader-badge rb-sh">上海法院实务参考（外省市以当地高院规定为准）</span>' +
          '<div class="reader-body">' + highlightText(shText, tokens) + "</div>" +
        "</div>";
    }

    if (caseText) {
      html +=
        '<div class="reader-section">' +
          '<span class="reader-badge rb-note">关联参考案例</span>' +
          '<div class="reader-body">' + highlightText(caseText, tokens) + "</div>" +
        "</div>";
    }

    if (lawText) {
      html +=
        '<div class="reader-section">' +
          '<span class="reader-badge rb-law">现行法律与司法解释依据</span>' +
          '<div class="reader-law-box">' + highlightText(lawText, tokens) + "</div>" +
        "</div>";
    }

    // 针对文书撰写类问答提供一键跳转到「交互式诉状起草器」快捷入口
    var tplKeyMap = {
      416: "civil_complaint",
      916: "civil_appeal",
      1164: "civil_enforcement",
      1832: "criminal_private",
      1861: "criminal_appeal",
      2107: "admin_complaint",
      2156: "admin_appeal"
    };
    if (tplKeyMap[qid]) {
      html +=
        '<div class="reader-section" style="margin-top:22px;">' +
          '<button type="button" class="btn btn-primary" data-goto-draft="' + tplKeyMap[qid] + '">' +
            "✍️ 在线填写并导出该文书 Word (.doc) 范本 &rarr;" +
          "</button>" +
        "</div>";
    }

    article.innerHTML = html;
    article.scrollTop = 0;
  }

  function getActiveQuestionBundle() {
    if (!state.activeQid || !itemById[state.activeQid]) return null;
    var item = itemById[state.activeQid];
    var chunk = window.LITIGATION_CHUNKS[item[4]];
    if (!chunk || !chunk[String(item[0])]) return null;
    return { item: item, detail: chunk[String(item[0])] };
  }

  /* ==================== 自适应高度 Retina 2x 高清长图导出 ==================== */
  function wrapCanvasParagraphs(ctx, text, maxWidth) {
    var rawLines = String(text || "").split("\n");
    var result = [];
    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i];
      if (!line) {
        result.push("");
        continue;
      }
      var cur = "";
      for (var c = 0; c < line.length; c++) {
        var ch = line[c];
        var test = cur + ch;
        if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
          result.push(cur);
          cur = ch;
        } else {
          cur = test;
        }
      }
      if (cur) result.push(cur);
    }
    return result;
  }

  function exportActiveQaLongImage() {
    var bundle = getActiveQuestionBundle();
    if (!bundle) {
      showToast("请先选择一条已加载完成的诉讼问答");
      return;
    }

    var item = bundle.item;
    var detail = bundle.detail;
    var qid = item[0];
    var breadcrumb = (catalog.parts[item[1]] || "") + " · " + ((catalog.chapters[item[2]] && catalog.chapters[item[2]][1]) || "");
    var titleText = "Q" + qid + ". " + item[6];
    var ansText = detail[0] || "";
    var lawText = detail[1] || "";
    var noteText = detail[2] || "";
    var shText = detail[3] || "";

    var W = 760;
    var PAD = 44;
    var INNER_W = W - PAD * 2 - 48;
    var fontStack = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';

    var measureCanvas = document.createElement("canvas");
    var mCtx = measureCanvas.getContext("2d");

    mCtx.font = "bold 24px " + fontStack;
    var titleLines = wrapCanvasParagraphs(mCtx, titleText, INNER_W);

    mCtx.font = "17px " + fontStack;
    var ansLines = wrapCanvasParagraphs(mCtx, ansText, INNER_W);
    var noteLines = noteText ? wrapCanvasParagraphs(mCtx, noteText, INNER_W - 28) : [];
    var shLines = shText ? wrapCanvasParagraphs(mCtx, shText, INNER_W - 28) : [];

    mCtx.font = "15px " + fontStack;
    var lawLines = lawText ? wrapCanvasParagraphs(mCtx, lawText, INNER_W - 28) : [];

    // 动态计算总画布高度（绝不截断长文本）
    var totalH = 136; // 顶部红底品牌横幅
    totalH += 36 + titleLines.length * 36 + 26; // 面包屑 + 标题
    totalH += 38 + ansLines.length * 30 + 24; // 实务解答
    if (noteLines.length) totalH += 44 + noteLines.length * 28 + 26;
    if (shLines.length) totalH += 44 + shLines.length * 28 + 26;
    if (lawLines.length) totalH += 44 + lawLines.length * 26 + 30;
    totalH += 88; // 底部免责声明栏

    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = totalH * scale;
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // 背景
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, W, totalH);

    // 顶部横幅
    ctx.fillStyle = "#b91c38";
    ctx.fillRect(0, 0, W, 108);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px " + fontStack;
    ctx.fillText("诉讼立案与程序实务工作台", PAD, 50);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "14px " + fontStack;
    ctx.fillText(breadcrumb, PAD, 80);

    // 白色主体卡片
    var cardTop = 94;
    var cardH = totalH - cardTop - 58;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, PAD - 12, cardTop, W - (PAD - 12) * 2, cardH, 16);
    ctx.fill();

    var y = cardTop + 42;
    var x = PAD + 12;

    // 标题
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 24px " + fontStack;
    for (var i = 0; i < titleLines.length; i++) {
      ctx.fillText(titleLines[i], x, y);
      y += 36;
    }

    y += 4;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(W - x, y);
    ctx.stroke();
    y += 28;

    // 实务解答标签
    drawBadge(ctx, "实务解答", x, y - 18, "#fff1f3", "#c81e3a", fontStack);
    y += 22;
    ctx.fillStyle = "#1e293b";
    ctx.font = "17px " + fontStack;
    for (var a = 0; a < ansLines.length; a++) {
      ctx.fillText(ansLines[a], x, y);
      y += 30;
    }
    y += 16;

    if (noteLines.length) {
      y = drawCalloutBlock(ctx, "特别提示", noteLines, x, y, INNER_W, "#fffbeb", "#b45309", 17, 28, fontStack);
    }

    if (shLines.length) {
      y = drawCalloutBlock(ctx, "上海法院实务参考", shLines, x, y, INNER_W, "#eff6ff", "#1d4ed8", 17, 28, fontStack);
    }

    if (lawLines.length) {
      y = drawCalloutBlock(ctx, "现行法律与司法解释依据", lawLines, x, y, INNER_W, "#f8fafc", "#334155", 15, 26, fontStack);
    }

    // 底部声明
    ctx.fillStyle = "#64748b";
    ctx.font = "13px " + fontStack;
    ctx.fillText("依据现行有效法律法规与司法解释整理 · 仅供诉讼指引参考，具体以受诉法院审查口径为准", PAD, totalH - 24);

    downloadCanvasPng(canvas, "诉讼程序问答-Q" + qid + ".png");
    showToast("已导出高清长图：诉讼程序问答-Q" + qid + ".png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBadge(ctx, label, x, y, bg, fg, fontStack) {
    ctx.font = "bold 13px " + fontStack;
    var tw = ctx.measureText(label).width + 20;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, tw, 26, 6);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(label, x + 10, y + 18);
  }

  function drawCalloutBlock(ctx, title, lines, x, y, width, bg, accent, fontSize, lineH, fontStack) {
    var boxH = 44 + lines.length * lineH + 12;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, width, boxH, 10);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + 8, 4, boxH - 16);

    ctx.font = "bold 14px " + fontStack;
    ctx.fillStyle = accent;
    ctx.fillText(title, x + 14, y + 26);

    ctx.font = fontSize + "px " + fontStack;
    ctx.fillStyle = "#1e293b";
    var cy = y + 52;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + 14, cy);
      cy += lineH;
    }
    return y + boxH + 18;
  }

  function downloadCanvasPng(canvas, filename) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
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
    }, "image/png");
  }

  /* ==================== 法定诉讼费 / 保全费 / 执行费速算器 ==================== */
  // 整数分（cents）精确分段累计，杜绝 IEEE-754 浮点误差
  function calcAcceptFeeCents(cents) {
    if (cents <= 0) return 0;
    if (cents <= 1000000) return 5000; // 不超过1万元：50元
    var tiers = [
      [1000000, 10000000, 0.025],
      [10000000, 20000000, 0.02],
      [20000000, 50000000, 0.015],
      [50000000, 100000000, 0.01],
      [100000000, 200000000, 0.009],
      [200000000, 500000000, 0.008],
      [500000000, 1000000000, 0.007],
      [1000000000, 2000000000, 0.006],
      [2000000000, Infinity, 0.005]
    ];
    var fee = 5000;
    for (var i = 0; i < tiers.length; i++) {
      var low = tiers[i][0];
      var high = tiers[i][1];
      var rate = tiers[i][2];
      if (cents > low) {
        var part = Math.min(cents, high) - low;
        fee += Math.round(part * rate);
      }
    }
    return fee;
  }

  function calcPreservationFeeCents(cents) {
    if (cents <= 0) return 0;
    if (cents <= 100000) return 3000; // 不超过1000元：30元
    var fee = 3000;
    if (cents > 100000) {
      fee += Math.round((Math.min(cents, 10000000) - 100000) * 0.01);
    }
    if (cents > 10000000) {
      fee += Math.round((cents - 10000000) * 0.005);
    }
    return Math.min(fee, 500000); // 封顶 5000 元
  }

  function calcExecutionFeeCents(cents) {
    if (cents <= 0) return 0;
    if (cents <= 1000000) return 5000; // 不超过1万元：50元
    var tiers = [
      [1000000, 50000000, 0.015],
      [50000000, 500000000, 0.01],
      [500000000, 1000000000, 0.005],
      [1000000000, Infinity, 0.001]
    ];
    var fee = 5000;
    for (var i = 0; i < tiers.length; i++) {
      var low = tiers[i][0];
      var high = tiers[i][1];
      var rate = tiers[i][2];
      if (cents > low) {
        fee += Math.round((Math.min(cents, high) - low) * rate);
      }
    }
    return fee;
  }

  function formatYuan(cents) {
    var yuan = (cents / 100).toFixed(2);
    var parts = yuan.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "¥" + parts.join(".");
  }

  function computeCurrentFeeMetrics() {
    var val = parseFloat(state.calcAmount);
    if (isNaN(val) || val < 0) val = 0;
    var cents = Math.round(val * state.calcUnit * 100);
    var accept = calcAcceptFeeCents(cents);
    var half = Math.round(accept / 2);
    var preserve = calcPreservationFeeCents(cents);
    var execFee = calcExecutionFeeCents(cents);
    var paymentOrder = Math.round(accept / 3);

    return {
      amountCents: cents,
      amountLabel: formatYuan(cents),
      cards: [
        {
          label: "一审财产案件受理费（普通程序全额）",
          val: formatYuan(accept),
          sub: "《诉讼费用交纳办法》第13条第1项分段累计",
          highlight: true
        },
        {
          label: "简易程序 / 小额诉讼 / 调解结案 / 撤诉",
          val: formatYuan(half),
          sub: "按案件受理费标准减半交纳（50%）",
          highlight: true
        },
        {
          label: "申请财产保全费（最高封顶 5,000 元）",
          val: formatYuan(preserve),
          sub: "1千元至10万元部分1%，超10万元部分0.5%",
          highlight: false
        },
        {
          label: "申请强制执行费（执行到位后扣交）",
          val: formatYuan(execFee),
          sub: "首次申请执行不预交，由被执行人负担",
          highlight: false
        },
        {
          label: "本诉反诉 / 有独立请求权第三人参加诉讼",
          val: formatYuan(half),
          sub: "按财产案件受理费标准减半交纳",
          highlight: false
        },
        {
          label: "督促程序（申请支付令）受理费",
          val: formatYuan(paymentOrder),
          sub: "按财产案件受理费标准的 1/3 交纳",
          highlight: false
        }
      ]
    };
  }

  function renderCalcMetrics() {
    var grid = document.getElementById("calcMetricsGrid");
    if (!grid) return;
    var data = computeCurrentFeeMetrics();
    var html = "";
    for (var i = 0; i < data.cards.length; i++) {
      var c = data.cards[i];
      html +=
        '<div class="metric-card' + (c.highlight ? " highlight" : "") + '">' +
          '<div class="metric-label">' + escHtml(c.label) + "</div>" +
          '<div class="metric-val">' + escHtml(c.val) + "</div>" +
          '<div class="metric-sub">' + escHtml(c.sub) + "</div>" +
        "</div>";
    }
    grid.innerHTML = html;
  }

  function exportCalcImage() {
    var data = computeCurrentFeeMetrics();
    var W = 740;
    var H = 620;
    var scale = 2;
    var fontStack = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    var canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#b91c38";
    ctx.fillRect(0, 0, W, 110);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px " + fontStack;
    ctx.fillText("人民法院法定诉讼费用预算单", 40, 48);
    ctx.font = "15px " + fontStack;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText("争议标的金额：" + data.amountLabel + "（依据《诉讼费用交纳办法》精确测算）", 40, 80);

    var startY = 132;
    var cardW = 320;
    var cardH = 126;
    for (var i = 0; i < data.cards.length; i++) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      var cx = 40 + col * (cardW + 20);
      var cy = startY + row * (cardH + 16);
      var c = data.cards[i];

      ctx.fillStyle = c.highlight ? "#fff1f3" : "#ffffff";
      roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.fill();

      ctx.fillStyle = "#475569";
      ctx.font = "bold 13px " + fontStack;
      ctx.fillText(c.label, cx + 16, cy + 32);

      ctx.fillStyle = c.highlight ? "#c81e3a" : "#0f172a";
      ctx.font = "bold 24px " + fontStack;
      ctx.fillText(c.val, cx + 16, cy + 72);

      ctx.fillStyle = "#64748b";
      ctx.font = "12px " + fontStack;
      ctx.fillText(c.sub, cx + 16, cy + 102);
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "12.5px " + fontStack;
    ctx.fillText("注：本测算表按国务院《诉讼费用交纳办法》第13-16条计算，具体预交金额以受诉法院缴费通知书为准。", 40, H - 24);

    downloadCanvasPng(canvas, "诉讼费用预算单.png");
    showToast("已下载高清预算图：诉讼费用预算单.png");
  }

  /* ==================== 立案自查清单与审查期限总表 ==================== */
  function initGuideSection() {
    var savedChecks = {};
    try {
      savedChecks = JSON.parse(localStorage.getItem(CHECK_STORAGE_KEY) || "{}") || {};
    } catch (e) {}

    var checkboxes = document.querySelectorAll('#guideChecklist input[type="checkbox"]');
    function refreshCheckUi() {
      var doneCount = 0;
      for (var i = 0; i < checkboxes.length; i++) {
        var idxKey = checkboxes[i].getAttribute("data-idx");
        var checked = !!savedChecks[idxKey];
        checkboxes[i].checked = checked;
        var rowEl = checkboxes[i].closest(".guide-check-row");
        if (rowEl) rowEl.classList.toggle("done", checked);
        if (checked) doneCount++;
      }
      var scoreEl = document.getElementById("guideCheckScore");
      if (scoreEl) {
        scoreEl.textContent = "已完成 " + doneCount + " / " + checkboxes.length;
        scoreEl.classList.toggle("ready", doneCount === checkboxes.length);
      }
    }

    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].addEventListener("change", function (e) {
        var k = e.target.getAttribute("data-idx");
        savedChecks[k] = e.target.checked;
        try {
          localStorage.setItem(CHECK_STORAGE_KEY, JSON.stringify(savedChecks));
        } catch (err) {}
        refreshCheckUi();
      });
    }
    refreshCheckUi();

    var dlGrid = document.getElementById("guideDeadlinesGrid");
    if (dlGrid && catalog.deadlines) {
      var html = "";
      for (var d = 0; d < catalog.deadlines.length; d++) {
        var dl = catalog.deadlines[d];
        var pillsHtml = "";
        for (var q = 0; q < (dl.qids || []).length; q++) {
          var qid = dl.qids[q];
          pillsHtml += '<button type="button" class="jump-q-pill" data-jump-q="' + qid + '">Q' + qid + " 详解 &rarr;</button>";
        }
        html +=
          '<div class="dl-box">' +
            '<div class="dl-box-head">' +
              '<span class="dl-box-title">' + escHtml(dl.type) + "</span>" +
              '<span class="dl-box-time">' + escHtml(dl.limit) + "</span>" +
            "</div>" +
            '<p class="dl-box-text"><strong>受理要件：</strong>' + escHtml(dl.condition) + "</p>" +
            '<p class="dl-box-text"><strong>程序救济：</strong>' + escHtml(dl.remedy) + "</p>" +
            '<div class="dl-links">' + pillsHtml + "</div>" +
          "</div>";
      }
      dlGrid.innerHTML = html;

      dlGrid.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-jump-q]");
        if (!btn) return;
        var targetQ = Number(btn.getAttribute("data-jump-q"));
        switchTab("qa", true);
        openQuestion(targetQ, { openDrawer: true });
      });
    }
  }

  /* ==================== 主标签切换与 URL 路由同步 ==================== */
  function switchTab(tabName, silentUrl) {
    var allowed = { qa: true, draft: true, calc: true, guide: true };
    if (!allowed[tabName]) tabName = "qa";
    state.tab = tabName;

    var navBtns = document.querySelectorAll(".nav-tab[data-tab]");
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].classList.toggle("active", navBtns[i].getAttribute("data-tab") === tabName);
    }

    var sections = document.querySelectorAll(".view-section");
    for (var j = 0; j < sections.length; j++) {
      sections[j].classList.toggle("active", sections[j].id === "tab-" + tabName);
    }

    if (!silentUrl) {
      syncUrlFromState();
    }
  }

  function syncUrlFromState() {
    if (!window.history || !window.history.replaceState) return;
    var u = new URL(window.location.href);
    u.search = "";
    u.hash = "";

    if (state.tab === "qa") {
      if (state.activeQid) u.searchParams.set("q", String(state.activeQid));
      if (state.query.trim()) u.searchParams.set("search", state.query.trim());
      if (state.part !== -1) u.searchParams.set("part", String(state.part));
      if (state.shOnly) u.searchParams.set("sh", "1");
    } else if (state.tab === "draft") {
      u.searchParams.set("tab", "draft");
      if (window.LitigationDrafter) {
        u.searchParams.set("tpl", window.LitigationDrafter.getCurrentKey());
      }
    } else if (state.tab === "calc") {
      u.searchParams.set("tab", "calc");
      u.searchParams.set("amount", String(state.calcAmount));
      u.searchParams.set("unit", String(state.calcUnit));
    } else if (state.tab === "guide") {
      u.searchParams.set("tab", "guide");
    }

    try {
      window.history.replaceState(null, "", u.toString());
    } catch (e) {}
  }

  function syncStateFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var hashMatch = window.location.hash.match(/q=(\d+)/i);

    var tabParam = params.get("tab") || "qa";
    var qParam = params.get("q") || (hashMatch ? hashMatch[1] : null);
    var searchParam = params.get("search") || "";
    var partParam = params.get("part");
    var shParam = params.get("sh");
    var tplParam = params.get("tpl");
    var amtParam = params.get("amount");
    var unitParam = params.get("unit");

    if (qParam && !params.get("tab")) {
      tabParam = "qa";
    }

    if (partParam !== null && partParam !== "") {
      var pNum = Number(partParam);
      if (pNum >= -1 && pNum <= 5) state.part = pNum;
    }
    state.shOnly = shParam === "1";
    state.query = searchParam;

    var searchInput = document.getElementById("searchInput");
    var clearBtn = document.getElementById("clearSearchBtn");
    if (searchInput) searchInput.value = state.query;
    if (clearBtn) clearBtn.classList.toggle("hidden", !state.query);

    syncFilterControlsUi();

    if (amtParam !== null && !isNaN(parseFloat(amtParam))) {
      state.calcAmount = parseFloat(amtParam);
      var amtInput = document.getElementById("calcAmountInput");
      if (amtInput) amtInput.value = String(state.calcAmount);
    }
    if (unitParam === "1" || unitParam === "10000") {
      state.calcUnit = Number(unitParam);
      var segBtns = document.querySelectorAll(".seg-btn[data-unit]");
      for (var s = 0; s < segBtns.length; s++) {
        segBtns[s].classList.toggle("active", Number(segBtns[s].getAttribute("data-unit")) === state.calcUnit);
      }
    }

    renderCalcMetrics();

    if (window.LitigationDrafter && tplParam) {
      window.LitigationDrafter.setTemplate(tplParam);
    }

    switchTab(tabParam, true);
    runFilterAndRender(true);

    if (qParam && itemById[Number(qParam)]) {
      openQuestion(Number(qParam), { openDrawer: true, silentUrl: true });
    } else if (window.innerWidth > 960 && state.filtered.length > 0) {
      // 桌面端默认展示首个高频核心问答（如 Q1 或筛选结果首项）
      openQuestion(state.filtered[0].item[0], { openDrawer: false, silentUrl: true });
    }
  }

  function syncFilterControlsUi() {
    var pills = document.querySelectorAll("#partPills .part-pill");
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.toggle("active", Number(pills[i].getAttribute("data-part")) === state.part);
    }
    populateChapterOptions();
    var shBtn = document.getElementById("shOnlyBtn");
    if (shBtn) shBtn.classList.toggle("active", state.shOnly);
    var favBtn = document.getElementById("favOnlyBtn");
    if (favBtn) favBtn.classList.toggle("active", state.favOnly);
  }

  /* ==================== 全局事件绑定 ==================== */
  function bindEvents() {
    // 平台快捷键标识适配
    var kbd = document.getElementById("kbdHint");
    if (kbd && navigator.platform && !/Mac|iPod|iPhone|iPad/i.test(navigator.platform)) {
      kbd.textContent = "Ctrl+K";
    }

    // 品牌 Logo 回到默认初始态
    var homeLink = document.getElementById("brandHomeLink");
    if (homeLink) {
      homeLink.addEventListener("click", function (e) {
        e.preventDefault();
        state.part = -1;
        state.chapter = -1;
        state.shOnly = false;
        state.favOnly = false;
        state.query = "";
        var searchInput = document.getElementById("searchInput");
        var clearBtn = document.getElementById("clearSearchBtn");
        if (searchInput) searchInput.value = "";
        if (clearBtn) clearBtn.classList.add("hidden");
        syncFilterControlsUi();
        switchTab("qa", true);
        runFilterAndRender(true);
        if (window.innerWidth > 960 && state.filtered.length) {
          openQuestion(state.filtered[0].item[0], { openDrawer: false, silentUrl: false });
        } else {
          syncUrlFromState();
        }
      });
    }

    // 主导航切换
    var navBtns = document.querySelectorAll(".nav-tab[data-tab]");
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener("click", function (e) {
        switchTab(e.currentTarget.getAttribute("data-tab"), false);
      });
    }

    // 搜索框输入与清空
    var searchInput = document.getElementById("searchInput");
    var clearBtn = document.getElementById("clearSearchBtn");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.query = searchInput.value;
        if (clearBtn) clearBtn.classList.toggle("hidden", !state.query);
        if (state.tab !== "qa") switchTab("qa", true);
        runFilterAndRender(true);
        syncUrlFromState();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.query = "";
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        clearBtn.classList.add("hidden");
        runFilterAndRender(true);
        syncUrlFromState();
      });
    }

    // 全局快捷键 ⌘K / Ctrl+K 与 Esc
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (state.tab !== "qa") switchTab("qa", false);
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === "Escape") {
        var pane = document.getElementById("qaDetailPane");
        if (pane && pane.classList.contains("mobile-open")) {
          pane.classList.remove("mobile-open");
        }
      }
    });

    // 领域筛选
    var partPills = document.getElementById("partPills");
    if (partPills) {
      partPills.addEventListener("click", function (e) {
        var btn = e.target.closest(".part-pill");
        if (!btn) return;
        state.part = Number(btn.getAttribute("data-part"));
        state.chapter = -1;
        syncFilterControlsUi();
        runFilterAndRender(true);
        syncUrlFromState();
      });
    }

    // 章节下拉筛选
    var chapSel = document.getElementById("chapterSelect");
    if (chapSel) {
      chapSel.addEventListener("change", function () {
        state.chapter = Number(chapSel.value);
        runFilterAndRender(true);
      });
    }

    // 上海实务参考 & 收藏开关
    var shBtn = document.getElementById("shOnlyBtn");
    if (shBtn) {
      shBtn.addEventListener("click", function () {
        state.shOnly = !state.shOnly;
        shBtn.classList.toggle("active", state.shOnly);
        runFilterAndRender(true);
        syncUrlFromState();
      });
    }

    function toggleFavFilter() {
      state.favOnly = !state.favOnly;
      var favBtn = document.getElementById("favOnlyBtn");
      if (favBtn) favBtn.classList.toggle("active", state.favOnly);
      if (state.tab !== "qa") switchTab("qa", true);
      runFilterAndRender(true);
    }

    var favOnlyBtn = document.getElementById("favOnlyBtn");
    if (favOnlyBtn) favOnlyBtn.addEventListener("click", toggleFavFilter);

    var topFavBtn = document.getElementById("favFilterQuickBtn");
    if (topFavBtn) {
      topFavBtn.addEventListener("click", function () {
        state.favOnly = true;
        var favBtn = document.getElementById("favOnlyBtn");
        if (favBtn) favBtn.classList.add("active");
        switchTab("qa", false);
        runFilterAndRender(true);
      });
    }

    // 热门检索词
    var hotBar = document.getElementById("hotQueriesBar");
    if (hotBar) {
      hotBar.addEventListener("click", function (e) {
        var chip = e.target.closest(".hot-chip");
        if (!chip) return;
        var q = chip.getAttribute("data-q") || "";
        state.query = q;
        if (searchInput) searchInput.value = q;
        if (clearBtn) clearBtn.classList.toggle("hidden", !q);
        runFilterAndRender(true);
        syncUrlFromState();
      });
    }

    // 列表点击与分页加载
    var listEl = document.getElementById("qaCardsList");
    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var card = e.target.closest(".qa-item-card");
        if (!card) return;
        openQuestion(Number(card.getAttribute("data-qid")), { openDrawer: true });
      });
    }

    var moreBtn = document.getElementById("loadMoreQaBtn");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        state.visibleLimit += PAGE_SIZE;
        renderQaList(parseQueryTokens(state.query));
      });
    }

    // 移动端关闭详情抽屉
    var closeDetailBtn = document.getElementById("mobileCloseDetailBtn");
    if (closeDetailBtn) {
      closeDetailBtn.addEventListener("click", function () {
        var pane = document.getElementById("qaDetailPane");
        if (pane) pane.classList.remove("mobile-open");
      });
    }

    // 阅读器内跳转到交互式诉状起草器
    var detailArticle = document.getElementById("detailArticle");
    if (detailArticle) {
      detailArticle.addEventListener("click", function (e) {
        var gotoBtn = e.target.closest("[data-goto-draft]");
        if (!gotoBtn) return;
        var tpl = gotoBtn.getAttribute("data-goto-draft");
        var pane = document.getElementById("qaDetailPane");
        if (pane) pane.classList.remove("mobile-open");
        if (window.LitigationDrafter) window.LitigationDrafter.setTemplate(tpl);
        switchTab("draft", false);
      });
    }

    // 问答详情工具栏按钮
    var btnFavQa = document.getElementById("btnFavQa");
    if (btnFavQa) {
      btnFavQa.addEventListener("click", function () {
        if (!state.activeQid) return;
        if (state.favSet[state.activeQid]) {
          delete state.favSet[state.activeQid];
          showToast("已取消收藏 Q" + state.activeQid);
        } else {
          state.favSet[state.activeQid] = true;
          showToast("已收藏 Q" + state.activeQid);
        }
        saveFavSet();
        updateFavButtonState();
        renderQaList(parseQueryTokens(state.query));
      });
    }

    var btnShareLinkQa = document.getElementById("btnShareLinkQa");
    if (btnShareLinkQa) {
      btnShareLinkQa.addEventListener("click", function () {
        if (!state.activeQid) return;
        var u = new URL(window.location.href);
        u.search = "";
        u.hash = "";
        u.searchParams.set("q", String(state.activeQid));
        copyTextToClipboard(u.toString(), "已复制 Q" + state.activeQid + " 专属直达链接");
      });
    }

    var btnCopyFullQa = document.getElementById("btnCopyFullQa");
    if (btnCopyFullQa) {
      btnCopyFullQa.addEventListener("click", function () {
        var bundle = getActiveQuestionBundle();
        if (!bundle) return;
        var item = bundle.item;
        var d = bundle.detail;
        var lines = [
          "【Q" + item[0] + "】" + item[6],
          "",
          "【实务解答】",
          d[0] || ""
        ];
        if (d[2]) lines.push("", "【特别提示】", d[2]);
        if (d[3]) lines.push("", "【上海法院实务参考】", d[3]);
        if (d[1]) lines.push("", "【法条依据】", d[1]);
        copyTextToClipboard(lines.join("\n"), "已复制 Q" + item[0] + " 完整解答与法条");
      });
    }

    var btnCopyLawQa = document.getElementById("btnCopyLawQa");
    if (btnCopyLawQa) {
      btnCopyLawQa.addEventListener("click", function () {
        var bundle = getActiveQuestionBundle();
        if (!bundle) return;
        var law = bundle.detail[1];
        if (!law) {
          showToast("该条目无单独列明的法条引用，请使用「复制全文」");
          return;
        }
        copyTextToClipboard(law, "已复制 Q" + bundle.item[0] + " 法条依据");
      });
    }

    var btnExportImgQa = document.getElementById("btnExportImgQa");
    if (btnExportImgQa) {
      btnExportImgQa.addEventListener("click", exportActiveQaLongImage);
    }

    // 诉讼费计算器事件
    var calcInput = document.getElementById("calcAmountInput");
    if (calcInput) {
      calcInput.addEventListener("input", function () {
        state.calcAmount = calcInput.value;
        renderCalcMetrics();
        syncUrlFromState();
      });
    }

    var segBtns = document.querySelectorAll(".seg-btn[data-unit]");
    for (var uIdx = 0; uIdx < segBtns.length; uIdx++) {
      segBtns[uIdx].addEventListener("click", function (e) {
        state.calcUnit = Number(e.currentTarget.getAttribute("data-unit"));
        for (var k = 0; k < segBtns.length; k++) {
          segBtns[k].classList.toggle("active", segBtns[k] === e.currentTarget);
        }
        renderCalcMetrics();
        syncUrlFromState();
      });
    }

    var amtChips = document.querySelectorAll(".amt-chip[data-val]");
    for (var aIdx = 0; aIdx < amtChips.length; aIdx++) {
      amtChips[aIdx].addEventListener("click", function (e) {
        var v = parseFloat(e.currentTarget.getAttribute("data-val"));
        var u = Number(e.currentTarget.getAttribute("data-unit"));
        state.calcAmount = v;
        state.calcUnit = u;
        if (calcInput) calcInput.value = String(v);
        for (var k = 0; k < segBtns.length; k++) {
          segBtns[k].classList.toggle("active", Number(segBtns[k].getAttribute("data-unit")) === u);
        }
        renderCalcMetrics();
        syncUrlFromState();
      });
    }

    var btnShareCalc = document.getElementById("btnShareCalcLink");
    if (btnShareCalc) {
      btnShareCalc.addEventListener("click", function () {
        var u = new URL(window.location.href);
        u.search = "";
        u.hash = "";
        u.searchParams.set("tab", "calc");
        u.searchParams.set("amount", String(state.calcAmount));
        u.searchParams.set("unit", String(state.calcUnit));
        copyTextToClipboard(u.toString(), "已复制当前标的额算费直达链接");
      });
    }

    var btnCopyCalc = document.getElementById("btnCopyCalcReport");
    if (btnCopyCalc) {
      btnCopyCalc.addEventListener("click", function () {
        var data = computeCurrentFeeMetrics();
        var lines = ["【诉讼费用法定测算明细】", "争议标的金额：" + data.amountLabel, ""];
        for (var c = 0; c < data.cards.length; c++) {
          lines.push("· " + data.cards[c].label + "：" + data.cards[c].val + "（" + data.cards[c].sub + "）");
        }
        copyTextToClipboard(lines.join("\n"), "已复制诉讼费测算明细文本");
      });
    }

    var btnExportCalc = document.getElementById("btnExportCalcImg");
    if (btnExportCalc) {
      btnExportCalc.addEventListener("click", exportCalcImage);
    }

    window.addEventListener("popstate", function () {
      syncStateFromUrl();
    });
  }

  /* ==================== 启动入口 ==================== */
  function bootstrap() {
    initTheme();
    updateFavCounters();
    initPartAndChapterControls();
    initGuideSection();

    if (window.LitigationDrafter) {
      var initParams = new URLSearchParams(window.location.search);
      window.LitigationDrafter.init({
        initialTpl: initParams.get("tpl") || "civil_complaint",
        notify: showToast,
        onUrlChange: syncUrlFromState
      });
    }

    bindEvents();
    syncStateFromUrl();
    prefetchAllChunks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
