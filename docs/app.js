const state = {
  data: null,
  nameFromYear: 1945,
  nameToYear: 2025,
  sex: "alle",
  regex: "^anna$|^ole$",
  matches: [],
  selected: new Set(),
  nameStatus: {},
  showRejected: false,
  activeView: "explore",
  lastTopNRows: [],
  review: {
    source: "random",
    deck: [],
    index: 0,
    history: [],
    shuffle: true,
    swiping: false,
  },
  metric: "count",
  scale: "linear",
  chartSmooth: 1,
  fromYear: 1880,
  toYear: 2025,
  topNSelectionMode: "top",
  topNYear: 2025,
  topNFromYear: 1880,
  topNToYear: 2025,
  topNRangePreset: "top10",
  topNRangeFrom: 0,
  topNRangeTo: 10,
  topNRangeLimit: 50,
  schoolBirthYear: 2018,
  childGrade: 1,
  gradeSize: 100,
  candidate: {
    regex: ".*",
    sex: "alle",
    birthYear: 2023,
    grade: 3,
    gradeSize: 100,
    maxSchoolmates: 1,
    sort: "school",
    rows: [],
  },
  similar: {
    referenceId: "",
    method: "pearson",
    metric: "shareSex",
    smooth: 3,
    fromYear: 1880,
    toYear: 2025,
    rows: [],
  },
  markers: false,
};

const els = {};
const STATUS_STORAGE_KEY = "navnestatistikk:nameStatus:v1";

document.addEventListener("DOMContentLoaded", () => {
  [
    "dataStatus",
    "regexInput",
    "applyRegex",
    "regexError",
    "resultCount",
    "resultList",
    "selectVisible",
    "clearSelected",
    "shortlistVisible",
    "rejectVisible",
    "showRejectedToggle",
    "topNSelectionMode",
    "topNCount",
    "topNCountControl",
    "topNMode",
    "topNRangeControls",
    "topNRangePreset",
    "topNRangeFrom",
    "topNRangeTo",
    "topNRangeLimit",
    "topNYearControl",
    "topNYear",
    "topNPeriodControls",
    "topNFromYear",
    "topNToYear",
    "syncTopNYears",
    "selectTopN",
    "shortlistTopN",
    "rejectTopN",
    "metricSelect",
    "scaleSelect",
    "chartSmooth",
    "fromYear",
    "toYear",
    "markersToggle",
    "selectedCount",
    "selectedNames",
    "shortlistTabCount",
    "rejectedTabCount",
    "statusStrip",
    "statusUavklarteCount",
    "statusAktuelleCount",
    "statusUaktuelleCount",
    "statusBackupExport",
    "statusBackupImport",
    "statusImportInput",
    "statusBackupMessage",
    "exploreView",
    "reviewView",
    "shortlistView",
    "rejectedView",
    "reviewSource",
    "reviewShuffle",
    "buildReviewDeck",
    "reviewCard",
    "reviewReject",
    "reviewSkip",
    "reviewShortlist",
    "reviewUndo",
    "shortlistTable",
    "rejectedTable",
    "showShortlistInChart",
    "clearShortlist",
    "chart",
    "similarReference",
    "similarMethod",
    "similarMetric",
    "similarSmooth",
    "similarFromYear",
    "similarToYear",
    "findSimilar",
    "addSimilarTop",
    "shortlistSimilarTop",
    "rejectSimilarTop",
    "syncSimilarYears",
    "similarCount",
    "similarBasis",
    "similarTable",
    "summaryGrid",
    "schoolBirthYear",
    "childGrade",
    "gradeSize",
    "schoolScopeHeader",
    "schoolTable",
    "copyExploreToCandidates",
    "candidateRegex",
    "candidateSex",
    "candidateBirthYear",
    "candidateGrade",
    "candidateGradeSize",
    "candidateMaxSchool",
    "candidateSort",
    "applyCandidateFilters",
    "shortlistCandidates",
    "rejectCandidates",
    "candidateError",
    "candidateCount",
    "candidateScope",
    "candidateTable",
    "dataTable",
    "copyLink",
    "downloadCsv",
    "downloadPng",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  state.nameStatus = loadNameStatus();
  wireEvents();
  loadData();
});

function wireEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });
  els.applyRegex.addEventListener("click", () => {
    state.regex = els.regexInput.value.trim() || ".*";
    updateMatches();
  });
  els.regexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      state.regex = els.regexInput.value.trim() || ".*";
      updateMatches();
    }
  });
  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      els.regexInput.value = button.dataset.template;
      state.regex = button.dataset.template;
      updateMatches();
    });
  });
  document.querySelectorAll("[data-sex]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sex = button.dataset.sex;
      document.querySelectorAll("[data-sex]").forEach((b) => b.classList.toggle("active", b === button));
      updateMatches();
    });
  });
  els.selectVisible.addEventListener("click", () => {
    state.matches.slice(0, 200).forEach((name) => state.selected.add(name.id));
    renderAll();
  });
  els.clearSelected.addEventListener("click", () => {
    state.selected.clear();
    renderAll();
  });
  els.shortlistVisible.addEventListener("click", () => bulkSetStatus(state.matches.slice(0, 250), "shortlist"));
  els.rejectVisible.addEventListener("click", () => bulkSetStatus(state.matches.slice(0, 250), "rejected"));
  els.showRejectedToggle.addEventListener("change", () => {
    state.showRejected = els.showRejectedToggle.checked;
    updateMatches();
  });
  els.selectTopN.addEventListener("click", selectTopN);
  els.shortlistTopN.addEventListener("click", () => bulkSetStatus(lastTopNItems(), "shortlist"));
  els.rejectTopN.addEventListener("click", () => bulkSetStatus(lastTopNItems(), "rejected"));
  els.topNSelectionMode.addEventListener("change", () => {
    state.topNSelectionMode = els.topNSelectionMode.value;
    writeTopNControls();
    updateUrl();
  });
  els.topNMode.addEventListener("change", () => {
    writeTopNControls();
    updateUrl();
  });
  els.topNRangePreset.addEventListener("change", () => {
    applyTopNRangePreset();
    updateUrl();
  });
  [els.topNYear, els.topNFromYear, els.topNToYear, els.topNRangeFrom, els.topNRangeTo, els.topNRangeLimit].forEach((input) => {
    input.addEventListener("change", () => {
      readTopNControls(true);
      updateUrl();
    });
  });
  els.syncTopNYears.addEventListener("click", () => {
    state.topNFromYear = state.fromYear;
    state.topNToYear = state.toYear;
    writeTopNControls();
    updateUrl();
  });
  els.metricSelect.addEventListener("change", () => {
    state.metric = els.metricSelect.value;
    renderAll();
  });
  els.scaleSelect.addEventListener("change", () => {
    state.scale = els.scaleSelect.value;
    renderChart();
  });
  els.chartSmooth.addEventListener("change", () => {
    state.chartSmooth = Math.max(1, Number(els.chartSmooth.value) || 1);
    renderChart();
    updateUrl();
  });
  [els.fromYear, els.toYear].forEach((input) => {
    input.addEventListener("change", () => {
      state.fromYear = clampNameYear(Number(els.fromYear.value));
      state.toYear = clampNameYear(Number(els.toYear.value));
      if (state.fromYear > state.toYear) [state.fromYear, state.toYear] = [state.toYear, state.fromYear];
      els.fromYear.value = state.fromYear;
      els.toYear.value = state.toYear;
      renderAll();
    });
  });
  [els.schoolBirthYear, els.childGrade, els.gradeSize].forEach((input) => {
    input.addEventListener("input", () => {
      readSchoolControls(false);
      renderSchoolEstimate();
      updateUrl();
    });
    input.addEventListener("change", () => {
      readSchoolControls(true);
      renderSchoolEstimate();
      updateUrl();
    });
  });
  [
    els.candidateRegex,
    els.candidateSex,
    els.candidateBirthYear,
    els.candidateGrade,
    els.candidateGradeSize,
    els.candidateMaxSchool,
    els.candidateSort,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      readCandidateControls(false);
      renderCandidates();
      updateUrl();
    });
    input.addEventListener("change", () => {
      readCandidateControls(true);
      renderCandidates();
      updateUrl();
    });
  });
  els.applyCandidateFilters.addEventListener("click", () => {
    readCandidateControls(true);
    renderCandidates();
    updateUrl();
  });
  els.copyExploreToCandidates.addEventListener("click", () => {
    copyExploreToCandidates();
    renderCandidates();
    updateUrl();
  });
  els.markersToggle.addEventListener("change", () => {
    state.markers = els.markersToggle.checked;
    renderChart();
  });
  [els.similarReference, els.similarMethod, els.similarMetric, els.similarSmooth, els.similarFromYear, els.similarToYear].forEach((input) => {
    input.addEventListener("change", () => {
      readSimilarControls(true);
      renderSimilar();
      updateUrl();
    });
  });
  els.findSimilar.addEventListener("click", () => {
    readSimilarControls(true);
    renderSimilar();
    updateUrl();
  });
  els.syncSimilarYears.addEventListener("click", () => {
    state.similar.fromYear = state.fromYear;
    state.similar.toYear = state.toYear;
    writeSimilarControls();
    renderSimilar();
    updateUrl();
  });
  els.addSimilarTop.addEventListener("click", () => {
    state.similar.rows.slice(0, 5).forEach((row) => state.selected.add(row.item.id));
    renderAll();
  });
  els.shortlistSimilarTop.addEventListener("click", () => bulkSetStatus(state.similar.rows.slice(0, 50).map((row) => row.item), "shortlist"));
  els.rejectSimilarTop.addEventListener("click", () => bulkSetStatus(state.similar.rows.slice(0, 50).map((row) => row.item), "rejected"));
  els.shortlistCandidates.addEventListener("click", () => bulkSetStatus(state.candidate.rows.map((row) => row.item), "shortlist"));
  els.rejectCandidates.addEventListener("click", () => bulkSetStatus(state.candidate.rows.map((row) => row.item), "rejected"));
  els.buildReviewDeck.addEventListener("click", buildReviewDeck);
  els.reviewReject.addEventListener("click", () => commitReviewSwipe("rejected", -1));
  els.reviewShortlist.addEventListener("click", () => commitReviewSwipe("shortlist", 1));
  els.reviewSkip.addEventListener("click", reviewSkip);
  els.reviewUndo.addEventListener("click", reviewUndo);
  els.showShortlistInChart.addEventListener("click", () => {
    state.selected = new Set(itemsWithStatus("shortlist").map((item) => item.id));
    setActiveView("explore");
    renderAll();
  });
  els.statusBackupExport.addEventListener("click", exportNameStatusBackup);
  els.statusBackupImport.addEventListener("click", () => els.statusImportInput.click());
  els.statusImportInput.addEventListener("change", handleNameStatusImport);
  els.clearShortlist.addEventListener("click", () => {
    const items = itemsWithStatus("shortlist");
    if (items.length && confirm(`Fjerne ${items.length} navn fra aktuelle?`)) {
      items.forEach((item) => setNameStatus(item.id, "neutral", false));
      saveNameStatus();
      renderAll();
    }
  });
  els.copyLink.addEventListener("click", copyShareLink);
  els.downloadCsv.addEventListener("click", downloadCsv);
  els.downloadPng.addEventListener("click", () => {
    Plotly.downloadImage(els.chart, { format: "png", filename: "navnestatistikk", height: 900, width: 1400 });
  });
  window.addEventListener("resize", () => {
    if (state.data) Plotly.Plots.resize(els.chart);
  });
  document.addEventListener("keydown", handleReviewKeyboard);
}

async function loadData() {
  const response = await fetch("assets/names-data.json");
  state.data = await response.json();
  const [nameFromYear, nameToYear] = nameYearRange();
  state.nameFromYear = nameFromYear;
  state.nameToYear = nameToYear;
  state.fromYear = state.nameFromYear;
  state.toYear = state.nameToYear;
  els.fromYear.min = state.nameFromYear;
  els.fromYear.max = state.nameToYear;
  els.toYear.min = state.nameFromYear;
  els.toYear.max = state.nameToYear;
  els.topNYear.min = state.nameFromYear;
  els.topNYear.max = state.nameToYear;
  els.topNFromYear.min = state.nameFromYear;
  els.topNFromYear.max = state.nameToYear;
  els.topNToYear.min = state.nameFromYear;
  els.topNToYear.max = state.nameToYear;
  els.schoolBirthYear.min = state.nameFromYear;
  els.schoolBirthYear.max = state.nameToYear;
  els.candidateBirthYear.min = state.nameFromYear;
  els.candidateBirthYear.max = state.nameToYear;
  els.similarFromYear.min = state.nameFromYear;
  els.similarFromYear.max = state.nameToYear;
  els.similarToYear.min = state.nameFromYear;
  els.similarToYear.max = state.nameToYear;
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  state.similar.fromYear = state.fromYear;
  state.similar.toYear = state.toYear;
  state.topNYear = state.toYear;
  state.topNFromYear = state.fromYear;
  state.topNToYear = state.toYear;
  els.topNYear.value = state.topNYear;
  restoreFromUrl();
  els.dataStatus.textContent = `Navnedata: ${state.nameFromYear}-${state.nameToYear}, bygget ${state.data.meta.builtAt.slice(0, 10)}`;
  updateMatches(true);
}

function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has("q")) {
    state.regex = params.get("q");
    els.regexInput.value = state.regex;
  }
  if (params.has("sex")) {
    state.sex = params.get("sex");
    document.querySelectorAll("[data-sex]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sex === state.sex);
    });
  }
  if (params.has("metric")) {
    state.metric = params.get("metric");
    els.metricSelect.value = state.metric;
  }
  if (params.has("smooth")) {
    state.chartSmooth = Math.max(1, Number(params.get("smooth")) || 1);
    els.chartSmooth.value = String(state.chartSmooth);
  }
  if (params.has("from")) state.fromYear = clampNameYear(Number(params.get("from")));
  if (params.has("to")) state.toYear = clampNameYear(Number(params.get("to")));
  if (params.has("topSelect")) state.topNSelectionMode = params.get("topSelect");
  els.topNSelectionMode.value = state.topNSelectionMode;
  if (params.has("topMode")) els.topNMode.value = params.get("topMode");
  if (params.has("topYear")) state.topNYear = clampNameYear(Number(params.get("topYear")));
  if (params.has("topFrom")) state.topNFromYear = clampNameYear(Number(params.get("topFrom")));
  if (params.has("topTo")) state.topNToYear = clampNameYear(Number(params.get("topTo")));
  if (state.topNFromYear > state.topNToYear) [state.topNFromYear, state.topNToYear] = [state.topNToYear, state.topNFromYear];
  if (params.has("topRange")) state.topNRangePreset = params.get("topRange");
  if (params.has("topRangeFrom")) state.topNRangeFrom = clampPercent(Number(params.get("topRangeFrom")));
  if (params.has("topRangeTo")) state.topNRangeTo = clampPercent(Number(params.get("topRangeTo")));
  if (params.has("topLimit")) state.topNRangeLimit = Math.max(1, Math.min(250, Number(params.get("topLimit")) || 50));
  if (state.topNRangeFrom > state.topNRangeTo) [state.topNRangeFrom, state.topNRangeTo] = [state.topNRangeTo, state.topNRangeFrom];
  if (params.has("schoolYear")) state.schoolBirthYear = clampNameYear(Number(params.get("schoolYear")));
  if (params.has("grade")) state.childGrade = clampGrade(Number(params.get("grade")));
  if (params.has("gradeSize")) state.gradeSize = Math.max(1, Number(params.get("gradeSize")) || 100);
  if (params.has("candidateQ")) state.candidate.regex = params.get("candidateQ");
  if (params.has("candidateSex")) state.candidate.sex = params.get("candidateSex");
  if (params.has("candidateYear")) state.candidate.birthYear = clampNameYear(Number(params.get("candidateYear")));
  if (params.has("candidateGrade")) state.candidate.grade = clampGrade(Number(params.get("candidateGrade")));
  if (params.has("candidateSize")) state.candidate.gradeSize = Math.max(1, Number(params.get("candidateSize")) || 100);
  if (params.has("candidateMax")) state.candidate.maxSchoolmates = Math.max(0, Number(params.get("candidateMax")) || 0);
  if (params.has("candidateSort")) state.candidate.sort = params.get("candidateSort");
  if (params.has("similarReference")) state.similar.referenceId = params.get("similarReference");
  if (params.has("similarMethod")) state.similar.method = params.get("similarMethod");
  if (params.has("similarMetric")) state.similar.metric = params.get("similarMetric");
  if (params.has("similarSmooth")) state.similar.smooth = Math.max(1, Number(params.get("similarSmooth")) || 3);
  if (params.has("similarFrom")) state.similar.fromYear = clampNameYear(Number(params.get("similarFrom")));
  if (params.has("similarTo")) state.similar.toYear = clampNameYear(Number(params.get("similarTo")));
  if (state.similar.fromYear > state.similar.toYear) [state.similar.fromYear, state.similar.toYear] = [state.similar.toYear, state.similar.fromYear];
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  writeTopNControls();
  els.schoolBirthYear.value = state.schoolBirthYear;
  els.childGrade.value = state.childGrade;
  els.gradeSize.value = state.gradeSize;
  writeCandidateControls();
  if (params.has("names")) {
    params.get("names").split(",").filter(Boolean).forEach((id) => state.selected.add(id));
  }
  writeSimilarControls();
}

function updateMatches(autoSelect = false) {
  if (!state.data) return;
  let pattern;
  try {
    pattern = new RegExp(state.regex, "iu");
    els.regexError.textContent = "";
  } catch (error) {
    els.regexError.textContent = error.message;
    return;
  }
  state.matches = state.data.names
    .filter((item) => state.sex === "alle" || item.sex === state.sex)
    .filter((item) => state.showRejected || statusOf(item.id) !== "rejected")
    .filter((item) => pattern.test(item.name) || pattern.test(item.key.replaceAll("_", " ")))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "no"));
  if (autoSelect && state.selected.size === 0) {
    state.matches.slice(0, 8).forEach((item) => state.selected.add(item.id));
  }
  renderAll();
}

function renderAll() {
  renderResults();
  renderSelected();
  renderChart();
  renderSimilar();
  renderSummary();
  renderSchoolEstimate();
  renderCandidates();
  renderTable();
  renderStatusViews();
  renderReviewCard();
  updateUrl();
}

function setActiveView(view) {
  state.activeView = view;
  document.body.classList.toggle("reviewModeActive", view === "review");
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  [els.exploreView, els.reviewView, els.shortlistView, els.rejectedView].forEach((panel) => {
    panel.hidden = panel.id !== `${view}View`;
  });
  if (view === "review" && !state.review.deck.length) buildReviewDeck(false);
  renderStatusViews();
  renderReviewCard();
}

function renderStatusViews() {
  const shortlist = itemsWithStatus("shortlist");
  const rejected = itemsWithStatus("rejected");
  const total = state.data?.names.length ?? 0;
  const unresolved = Math.max(0, total - shortlist.length - rejected.length);
  renderStatusStrip(unresolved, shortlist.length, rejected.length);
  els.shortlistTabCount.textContent = String(shortlist.length);
  els.rejectedTabCount.textContent = String(rejected.length);
  renderStatusTable(els.shortlistTable, shortlist, "shortlist");
  renderStatusTable(els.rejectedTable, rejected, "rejected");
}

function renderStatusStrip(unresolved, shortlistCount, rejectedCount) {
  if (!els.statusStrip) return;
  els.statusStrip.hidden = !state.data;
  if (!state.data) return;
  els.statusUavklarteCount.textContent = formatNumber(unresolved);
  els.statusAktuelleCount.textContent = formatNumber(shortlistCount);
  els.statusUaktuelleCount.textContent = formatNumber(rejectedCount);
}

function renderStatusTable(tbody, items, mode) {
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5">${mode === "shortlist" ? "Ingen aktuelle navn" : "Ingen uaktuelle navn"}</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.append(
      cell(item.name),
      cell(item.sex),
      cell(String(item.peakYear)),
      cell(formatNumber(item.peakCount)),
      actionCell(item),
    );
    fragment.append(tr);
  });
  tbody.append(fragment);
}

function renderResults() {
  els.resultCount.textContent = `${formatNumber(state.matches.length)} navn`;
  els.resultList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.matches.slice(0, 250).forEach((item) => {
    const label = document.createElement("div");
    label.className = "resultItem";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(item.id);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? state.selected.add(item.id) : state.selected.delete(item.id);
      renderAll();
    });
    const name = document.createElement("span");
    name.textContent = item.name;
    const meta = document.createElement("small");
    meta.textContent = `${item.sex}, maks ${formatNumber(item.peakCount)} i ${item.peakYear}`;
    const actions = statusActions(item);
    label.append(checkbox, name, meta, actions);
    fragment.append(label);
  });
  els.resultList.append(fragment);
}

function selectedItems() {
  const byId = new Map(state.data.names.map((item) => [item.id, item]));
  return [...state.selected].map((id) => byId.get(id)).filter(Boolean);
}

function itemById(id) {
  return state.data?.names.find((item) => item.id === id) ?? null;
}

function loadNameStatus() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATUS_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value === "shortlist" || value === "rejected"));
  } catch {
    return {};
  }
}

function saveNameStatus() {
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(state.nameStatus));
}

function setBackupMessage(message, kind = "info") {
  if (!els.statusBackupMessage) return;
  els.statusBackupMessage.textContent = message;
  els.statusBackupMessage.classList.toggle("isError", kind === "error");
  els.statusBackupMessage.classList.toggle("isSuccess", kind === "success");
}

function statusOf(id) {
  return state.nameStatus[id] ?? "neutral";
}

function setNameStatus(id, status, render = true) {
  if (status === "neutral") {
    delete state.nameStatus[id];
  } else {
    state.nameStatus[id] = status;
    if (status === "rejected") state.selected.delete(id);
  }
  saveNameStatus();
  if (render) {
    updateMatches();
  }
}

function itemsWithStatus(status) {
  if (!state.data) return [];
  return state.data.names.filter((item) => statusOf(item.id) === status).sort((a, b) => a.name.localeCompare(b.name, "no") || a.sex.localeCompare(b.sex, "no"));
}

function statusActions(item) {
  const wrap = document.createElement("span");
  wrap.className = "rowActions";
  const current = statusOf(item.id);
  if (current !== "shortlist") wrap.append(smallAction("+ aktuell", () => setNameStatus(item.id, "shortlist")));
  if (current !== "rejected") wrap.append(smallAction("uaktuell", () => setNameStatus(item.id, "rejected")));
  if (current !== "neutral") wrap.append(smallAction("aktuell", () => setNameStatus(item.id, "neutral")));
  return wrap;
}

function smallAction(text, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  });
  return button;
}

function actionCell(item) {
  const td = document.createElement("td");
  td.append(statusActions(item));
  return td;
}

function bulkSetStatus(items, status) {
  const unique = uniqueItems(items).filter((item) => statusOf(item.id) !== status);
  if (!unique.length) return;
  if (unique.length >= 50 && !confirm(`${status === "rejected" ? "Avvise" : "Merke som aktuelle"} ${unique.length} navn?`)) return;
  unique.forEach((item) => setNameStatus(item.id, status, false));
  saveNameStatus();
  updateMatches();
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => item && !seen.has(item.id) && seen.add(item.id));
}

function lastTopNItems() {
  if (state.lastTopNRows.length) return state.lastTopNRows.map((row) => row.item);
  selectTopN();
  return state.lastTopNRows.map((row) => row.item);
}

function buildReviewDeck(render = true) {
  state.review.source = els.reviewSource.value;
  state.review.shuffle = els.reviewShuffle.checked;
  let items = [];
  if (state.review.source === "matches") items = state.matches;
  if (state.review.source === "candidates") items = state.candidate.rows.map((row) => row.item);
  if (state.review.source === "topn") items = lastTopNItems();
  if (state.review.source === "similar") items = state.similar.rows.map((row) => row.item);
  if (state.review.source === "random") items = state.data.names;
  items = uniqueItems(items).filter((item) => statusOf(item.id) === "neutral");
  if (state.review.shuffle) items = shuffle(items);
  state.review.deck = items.map((item) => item.id);
  state.review.index = 0;
  if (render) renderReviewCard();
}

function currentReviewItem() {
  while (state.review.index < state.review.deck.length && statusOf(state.review.deck[state.review.index]) !== "neutral") {
    state.review.index += 1;
  }
  return itemById(state.review.deck[state.review.index]);
}

function renderReviewCard() {
  if (!els.reviewCard || !state.data) return;
  const item = currentReviewItem();
  const remaining = Math.max(0, state.review.deck.length - state.review.index);
  if (!item) {
    els.reviewCard.className = "reviewCard reviewEmpty";
    els.reviewCard.innerHTML = `
      <p class="emptyState">Ingen nøytrale navn i kortstokken. Juster filtrene eller lag en ny kortstokk.</p>
    `;
    return;
  }
  const school = schoolEstimate(item, schoolScopeForGrade(state.childGrade));
  els.reviewCard.className = "reviewCard";
  els.reviewCard.innerHTML = `
    <div class="reviewMeta">${remaining} igjen</div>
    <h3>${escapeHtml(item.name)}</h3>
    <p>${item.sex}, toppår ${item.peakYear} med ${formatNumber(item.peakCount)} fødte.</p>
    <dl>
      <div><dt>Total</dt><dd>${formatNumber(item.total)}</dd></div>
      <div><dt>Beste rang</dt><dd>${bestRankLabel(item)}</dd></div>
      <div><dt>Skole</dt><dd>${formatEstimate(school.scope)}</dd></div>
    </dl>
  `;
  attachReviewSwipe();
}

function reviewSetStatus(status) {
  if (state.review.swiping) return;
  const item = currentReviewItem();
  if (!item) return;
  const from = statusOf(item.id);
  setNameStatus(item.id, status, false);
  state.review.history.push({ id: item.id, from, to: status });
  state.review.index += 1;
  saveNameStatus();
  updateMatches();
}

function commitReviewSwipe(status, direction) {
  if (state.review.swiping) return;
  const item = currentReviewItem();
  if (!item) return;
  state.review.swiping = true;
  els.reviewCard.classList.add(status === "shortlist" ? "swipeShortlist" : "swipeReject");
  els.reviewCard.style.transform = `translate(${direction * 120}vw, -4vh) rotate(${direction * 18}deg)`;
  els.reviewCard.style.opacity = "0";
  setTimeout(() => {
    state.review.swiping = false;
    els.reviewCard.style.transform = "";
    els.reviewCard.style.opacity = "";
    reviewSetStatus(status);
  }, 180);
}

function attachReviewSwipe() {
  const card = els.reviewCard;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let dragging = false;

  card.onpointerdown = (event) => {
    if (state.review.swiping || !currentReviewItem()) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    currentX = 0;
    currentY = 0;
    card.setPointerCapture(event.pointerId);
    card.classList.add("dragging");
  };

  card.onpointermove = (event) => {
    if (!dragging) return;
    currentX = event.clientX - startX;
    currentY = event.clientY - startY;
    const rotation = Math.max(-16, Math.min(16, currentX / 14));
    card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
    card.classList.toggle("hintShortlist", currentX > 70);
    card.classList.toggle("hintReject", currentX < -70);
  };

  card.onpointerup = (event) => {
    if (!dragging) return;
    dragging = false;
    card.releasePointerCapture(event.pointerId);
    card.classList.remove("dragging", "hintShortlist", "hintReject");
    const shouldCommit = Math.abs(currentX) > 110 || Math.abs(currentX) > card.clientWidth * 0.28;
    if (shouldCommit) {
      commitReviewSwipe(currentX > 0 ? "shortlist" : "rejected", currentX > 0 ? 1 : -1);
      return;
    }
    card.style.transform = "";
  };

  card.onpointercancel = () => {
    dragging = false;
    card.classList.remove("dragging", "hintShortlist", "hintReject");
    card.style.transform = "";
  };
}

function handleReviewKeyboard(event) {
  if (state.activeView !== "review" || event.target.closest("input, select, textarea, button")) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    commitReviewSwipe("rejected", -1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    commitReviewSwipe("shortlist", 1);
  }
  if (event.key === "ArrowDown" || event.key === " ") {
    event.preventDefault();
    reviewSkip();
  }
  if (event.key === "Backspace") {
    event.preventDefault();
    reviewUndo();
  }
}

function reviewSkip() {
  if (state.review.swiping) return;
  const item = currentReviewItem();
  if (!item) return;
  state.review.deck.push(item.id);
  state.review.index += 1;
  renderReviewCard();
}

function reviewUndo() {
  if (state.review.swiping) return;
  const last = state.review.history.pop();
  if (!last) return;
  setNameStatus(last.id, last.from, false);
  state.review.index = Math.max(0, state.review.index - 1);
  if (!state.review.deck.includes(last.id)) state.review.deck.splice(state.review.index, 0, last.id);
  saveNameStatus();
  updateMatches();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function bestRankLabel(item) {
  const ranks = item.series.map((point) => point[2]).filter(Boolean);
  return ranks.length ? `#${Math.min(...ranks)}` : "–";
}

function selectTopN() {
  if (!state.data) return;
  readTopNControls(true);
  const n = Number(els.topNCount.value);
  const mode = els.topNMode.value;
  const rows = state.matches
    .map((item) => {
      const value = mode === "year" ? topNValueInYear(item, state.topNYear) : topNValueInPeriod(item, state.topNFromYear, state.topNToYear);
      return { item, value };
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.item.name.localeCompare(b.item.name, "no"));
  const selectedRows = state.topNSelectionMode === "range" ? topNRowsInRange(rows) : rows.slice(0, n);
  state.lastTopNRows = selectedRows;
  state.selected = new Set(selectedRows.map((row) => row.item.id));
  renderAll();
}

function readTopNControls(commit = false) {
  const topNYear = parseIntegerInput(els.topNYear.value);
  const topNFromYear = parseIntegerInput(els.topNFromYear.value);
  const topNToYear = parseIntegerInput(els.topNToYear.value);
  const topNRangeFrom = parseNumberInput(els.topNRangeFrom.value);
  const topNRangeTo = parseNumberInput(els.topNRangeTo.value);
  const topNRangeLimit = parseIntegerInput(els.topNRangeLimit.value);
  if (!commit) return;
  state.topNSelectionMode = els.topNSelectionMode.value;
  state.topNRangePreset = els.topNRangePreset.value;
  if (topNYear != null) state.topNYear = clampNameYear(topNYear);
  if (topNFromYear != null) state.topNFromYear = clampNameYear(topNFromYear);
  if (topNToYear != null) state.topNToYear = clampNameYear(topNToYear);
  if (state.topNFromYear > state.topNToYear) [state.topNFromYear, state.topNToYear] = [state.topNToYear, state.topNFromYear];
  if (topNRangeFrom != null) state.topNRangeFrom = clampPercent(topNRangeFrom);
  if (topNRangeTo != null) state.topNRangeTo = clampPercent(topNRangeTo);
  if (state.topNRangeFrom > state.topNRangeTo) [state.topNRangeFrom, state.topNRangeTo] = [state.topNRangeTo, state.topNRangeFrom];
  state.topNRangePreset = matchingTopNRangePreset(state.topNRangeFrom, state.topNRangeTo) ?? "custom";
  if (topNRangeLimit != null) state.topNRangeLimit = Math.max(1, Math.min(250, topNRangeLimit));
  writeTopNControls();
}

function writeTopNControls() {
  const periodMode = els.topNMode.value === "period";
  const rangeMode = state.topNSelectionMode === "range";
  els.topNSelectionMode.value = state.topNSelectionMode;
  els.topNCountControl.hidden = rangeMode;
  els.topNRangeControls.hidden = !rangeMode;
  els.selectTopN.textContent = rangeMode ? "Velg intervall" : "Velg topp";
  els.topNYearControl.hidden = periodMode;
  els.topNPeriodControls.hidden = !periodMode;
  els.syncTopNYears.hidden = !periodMode;
  els.topNRangePreset.value = state.topNRangePreset;
  els.topNRangeFrom.value = state.topNRangeFrom;
  els.topNRangeTo.value = state.topNRangeTo;
  els.topNRangeLimit.value = state.topNRangeLimit;
  els.topNYear.value = state.topNYear;
  els.topNFromYear.value = state.topNFromYear;
  els.topNToYear.value = state.topNToYear;
}

function applyTopNRangePreset() {
  const preset = els.topNRangePreset.value;
  const ranges = topNRangePresets();
  state.topNRangePreset = preset;
  if (ranges[preset]) {
    [state.topNRangeFrom, state.topNRangeTo] = ranges[preset];
  } else {
    readTopNControls(true);
    return;
  }
  writeTopNControls();
}

function topNRowsInRange(rows) {
  if (!rows.length) return [];
  const from = Math.min(state.topNRangeFrom, state.topNRangeTo);
  const to = Math.max(state.topNRangeFrom, state.topNRangeTo);
  const maxRows = Math.max(1, Math.min(250, state.topNRangeLimit));
  return rows
    .map((row, index) => ({ ...row, percentile: rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100 }))
    .filter((row) => row.percentile >= from && row.percentile <= to)
    .slice(0, maxRows);
}

function topNRangePresets() {
  return {
    top10: [0, 10],
    top25: [0, 25],
    middle50: [25, 75],
    bottom25: [75, 100],
    bottom10: [90, 100],
  };
}

function matchingTopNRangePreset(from, to) {
  return Object.entries(topNRangePresets()).find(([, range]) => range[0] === from && range[1] === to)?.[0] ?? null;
}

function countInYear(item, year) {
  const point = pointInYear(item, year);
  return point ? point[1] : 0;
}

function shareInYear(item, year) {
  const point = pointInYear(item, year);
  return point ? point[3] : null;
}

function pointInYear(item, year) {
  const yearIndex = state.data.years.indexOf(year);
  if (yearIndex < 0) return null;
  return item.series.find(([yi]) => yi === yearIndex) ?? null;
}

function topNValueInYear(item, year) {
  const point = pointInYear(item, year);
  if (!point) return 0;
  return point[1] ?? point[3] ?? 0;
}

function topNValueInPeriod(item, fromYear, toYear) {
  return item.series.reduce((sum, [yearIndex, count, , share]) => {
    const year = state.data.years[yearIndex];
    return year >= fromYear && year <= toYear ? sum + (count ?? share ?? 0) : sum;
  }, 0);
}

function countInPeriod(item, fromYear, toYear) {
  return item.series.reduce((sum, [yearIndex, count]) => {
    const year = state.data.years[yearIndex];
    return year >= fromYear && year <= toYear ? sum + (count ?? 0) : sum;
  }, 0);
}

function nameYearRange() {
  let minIndex = Infinity;
  let maxIndex = -Infinity;
  state.data.names.forEach((item) => {
    item.series.forEach(([yearIndex]) => {
      minIndex = Math.min(minIndex, yearIndex);
      maxIndex = Math.max(maxIndex, yearIndex);
    });
  });
  return [state.data.years[minIndex], state.data.years[maxIndex]];
}

function firstCountYear() {
  let minIndex = Infinity;
  state.data.names.forEach((item) => {
    item.series.forEach(([yearIndex, count]) => {
      if (count != null) minIndex = Math.min(minIndex, yearIndex);
    });
  });
  return Number.isFinite(minIndex) ? state.data.years[minIndex] : state.nameToYear;
}

function readSchoolControls(commit = false) {
  state.schoolBirthYear = parseIntegerInput(els.schoolBirthYear.value);
  state.childGrade = parseIntegerInput(els.childGrade.value);
  state.gradeSize = parseNumberInput(els.gradeSize.value);
  if (!commit) return;
  if (state.schoolBirthYear != null && hasNameDataYear(state.schoolBirthYear)) els.schoolBirthYear.value = state.schoolBirthYear;
  if (state.childGrade != null && isValidGrade(state.childGrade)) els.childGrade.value = state.childGrade;
  if (state.gradeSize != null && state.gradeSize > 0) els.gradeSize.value = state.gradeSize;
}

function readCandidateControls(commit = false) {
  state.candidate.regex = els.candidateRegex.value.trim() || ".*";
  state.candidate.sex = els.candidateSex.value;
  state.candidate.birthYear = parseIntegerInput(els.candidateBirthYear.value);
  state.candidate.grade = parseIntegerInput(els.candidateGrade.value);
  state.candidate.gradeSize = parseNumberInput(els.candidateGradeSize.value);
  state.candidate.maxSchoolmates = parseNumberInput(els.candidateMaxSchool.value);
  state.candidate.sort = els.candidateSort.value;
  if (!commit) return;
  if (state.candidate.birthYear != null && hasNameDataYear(state.candidate.birthYear)) els.candidateBirthYear.value = state.candidate.birthYear;
  if (state.candidate.grade != null && isValidGrade(state.candidate.grade)) els.candidateGrade.value = state.candidate.grade;
  if (state.candidate.gradeSize != null && state.candidate.gradeSize > 0) els.candidateGradeSize.value = state.candidate.gradeSize;
  if (state.candidate.maxSchoolmates != null && state.candidate.maxSchoolmates >= 0) els.candidateMaxSchool.value = state.candidate.maxSchoolmates;
}

function writeCandidateControls() {
  els.candidateRegex.value = state.candidate.regex;
  els.candidateSex.value = state.candidate.sex;
  els.candidateBirthYear.value = state.candidate.birthYear;
  els.candidateGrade.value = state.candidate.grade;
  els.candidateGradeSize.value = state.candidate.gradeSize;
  els.candidateMaxSchool.value = state.candidate.maxSchoolmates;
  els.candidateSort.value = state.candidate.sort;
}

function copyExploreToCandidates() {
  readSchoolControls(false);
  state.candidate.regex = state.regex;
  state.candidate.sex = state.sex;
  state.candidate.birthYear = state.schoolBirthYear;
  state.candidate.grade = state.childGrade;
  state.candidate.gradeSize = state.gradeSize;
  writeCandidateControls();
}

function readSimilarControls(commit = false) {
  state.similar.referenceId = els.similarReference.value || state.similar.referenceId;
  state.similar.method = els.similarMethod.value;
  state.similar.metric = els.similarMetric.value;
  state.similar.smooth = Number(els.similarSmooth.value) || 1;
  state.similar.fromYear = parseIntegerInput(els.similarFromYear.value);
  state.similar.toYear = parseIntegerInput(els.similarToYear.value);
  if (!commit) return;
  if (state.similar.fromYear != null) state.similar.fromYear = clampNameYear(state.similar.fromYear);
  if (state.similar.toYear != null) state.similar.toYear = clampNameYear(state.similar.toYear);
  if (state.similar.fromYear > state.similar.toYear) [state.similar.fromYear, state.similar.toYear] = [state.similar.toYear, state.similar.fromYear];
  els.similarFromYear.value = state.similar.fromYear;
  els.similarToYear.value = state.similar.toYear;
}

function writeSimilarControls() {
  els.similarMethod.value = state.similar.method;
  els.similarMetric.value = state.similar.metric;
  els.similarSmooth.value = String(state.similar.smooth);
  els.similarFromYear.value = state.similar.fromYear;
  els.similarToYear.value = state.similar.toYear;
}

function renderSelected() {
  const items = selectedItems();
  els.selectedCount.textContent = `${items.length} navn`;
  els.selectedNames.innerHTML = "";
  items.forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${item.name} (${item.sex})`;
    const reference = document.createElement("button");
    reference.type = "button";
    reference.textContent = "ref";
    reference.setAttribute("aria-label", `Bruk ${item.name} som referanse`);
    reference.addEventListener("click", () => {
      state.similar.referenceId = item.id;
      renderAll();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Fjern ${item.name}`);
    remove.addEventListener("click", () => {
      state.selected.delete(item.id);
      renderAll();
    });
    pill.append(reference, remove);
    els.selectedNames.append(pill);
  });
  renderSimilarReferenceOptions(items);
}

function renderSimilarReferenceOptions(items) {
  const previous = state.similar.referenceId;
  els.similarReference.innerHTML = "";
  if (!items.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Velg navn til graf først";
    els.similarReference.append(option);
    state.similar.referenceId = "";
    return;
  }
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} (${item.sex})`;
    els.similarReference.append(option);
  });
  if (items.some((item) => item.id === previous)) {
    state.similar.referenceId = previous;
  } else {
    state.similar.referenceId = items[0]?.id ?? "";
  }
  els.similarReference.value = state.similar.referenceId;
}

function renderChart() {
  if (!state.data || !window.Plotly) return;
  const effectiveMetric = effectiveChartMetric();
  const traces = selectedItems().map((item) => {
    const points = visiblePoints(item);
    const values = points.map((p) => metricValue(p, item, effectiveMetric));
    return {
      x: points.map((p) => p.year),
      y: smoothSeries(values, state.chartSmooth),
      mode: state.markers ? "lines+markers" : "lines",
      name: `${item.name} (${item.sex})`,
      line: { width: 2.5 },
      hovertemplate: hoverTemplate(effectiveMetric),
      customdata: points.map((p) => [p.count, p.rank, p.shareAll, p.shareSex, p.year]),
    };
  });
  const layout = {
    margin: { l: 64, r: 24, t: 26, b: 56 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    hovermode: "x unified",
    legend: { orientation: "h", y: -0.2 },
    xaxis: { title: "År", range: [state.fromYear, state.toYear] },
    yaxis: yAxisConfig(effectiveMetric),
  };
  const config = { responsive: true, displaylogo: false };
  Plotly.react(els.chart, traces, layout, config);
}

function visiblePoints(item) {
  return allPoints(item).filter((p) => p.year >= state.fromYear && p.year <= state.toYear);
}

function smoothSeries(values, width) {
  if (Math.max(1, Number(width) || 1) <= 1) return values;
  const smoothed = [];
  const size = Math.max(1, Math.round(width));
  const radius = Math.floor(size / 2);
  values.forEach((_, index) => {
    const windowValues = values.slice(Math.max(0, index - radius), index + radius + 1).filter((value) => value != null && Number.isFinite(value));
    smoothed.push(windowValues.length ? mean(windowValues) : null);
  });
  return smoothed;
}

function allPoints(item) {
  return item.series
    .map(([yearIndex, count, rank, sourceShareSex]) => {
      const year = state.data.years[yearIndex];
      const total = state.data.totalBirths[yearIndex];
      const sexTotal = state.data.sexBirths[item.sex]?.[String(year)] ?? null;
      return {
        year,
        yearIndex,
        count,
        rank,
        shareAll: total && count != null ? (count / total) * 100 : null,
        shareSex: sourceShareSex ?? (sexTotal && count != null ? (count / sexTotal) * 100 : null),
      };
    });
}

function metricValue(point, item, metric = state.metric) {
  if (metric === "shareAll") return point.shareAll;
  if (metric === "shareSex") return point.shareSex;
  if (metric === "rank") return point.rank;
  if (metric === "index") {
    const base = visiblePoints(item).find((p) => p.count > 0)?.count;
    return base ? (point.count / base) * 100 : null;
  }
  return point.count;
}

function effectiveChartMetric() {
  if (state.metric === "count" && state.fromYear < firstCountYear()) return "shareSex";
  return state.metric;
}

function yAxisConfig(metric = state.metric) {
  const titles = {
    count: "Antall fødte",
    shareAll: "Andel av alle levendefødte (%)",
    shareSex: "Andel av levendefødte samme kjønn (%)",
    rank: "Rang innen kjønn",
    index: "Indeks (første punkt = 100)",
  };
  const axis = { title: titles[metric], rangemode: "tozero" };
  if (metric === "rank") {
    axis.autorange = "reversed";
    axis.rangemode = undefined;
  } else if (state.scale === "log") {
    axis.type = "log";
  }
  return axis;
}

function hoverTemplate(metric = state.metric) {
  if (metric === "rank") return "%{x}<br>Rang: %{y}<br>Antall: %{customdata[0]}<extra>%{fullData.name}</extra>";
  if (metric === "shareAll") return "%{x}<br>Andel: %{y:.3f}%<br>Antall: %{customdata[0]}<br>Rang: %{customdata[1]}<extra>%{fullData.name}</extra>";
  if (metric === "shareSex") return "%{x}<br>Andel: %{y:.3f}%<br>Antall: %{customdata[0]}<br>Rang: %{customdata[1]}<extra>%{fullData.name}</extra>";
  if (metric === "index") return "%{x}<br>Indeks: %{y:.1f}<br>Antall: %{customdata[0]}<br>Rang: %{customdata[1]}<extra>%{fullData.name}</extra>";
  return "%{x}<br>Antall: %{y}<br>Rang: %{customdata[1]}<br>Andel: %{customdata[2]:.3f}%<extra>%{fullData.name}</extra>";
}

function renderSimilar() {
  if (!state.data) return;
  readSimilarControls(false);
  const reference = selectedItems().find((item) => item.id === state.similar.referenceId);
  const methodLabel = { pearson: "Pearson", spearman: "Spearman", euclidean: "Euklidsk" }[state.similar.method] ?? "Pearson";
  els.similarBasis.textContent = methodLabel;
  if (!reference) {
    state.similar.rows = [];
    els.similarCount.textContent = "0 navn";
    els.similarTable.innerHTML = '<tr><td colspan="6">Velg et referansenavn</td></tr>';
    return;
  }
  const referenceSeries = comparableSeries(reference, state.similar.metric);
  const rows = state.data.names
    .filter((item) => item.id !== reference.id)
    .filter((item) => state.sex === "alle" || item.sex === state.sex)
    .filter((item) => state.showRejected || statusOf(item.id) !== "rejected")
    .map((item) => similarityRow(referenceSeries, item))
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity || a.item.name.localeCompare(b.item.name, "no"));
  state.similar.rows = rows;
  els.similarCount.textContent = `${formatNumber(rows.length)} navn`;
  if (!rows.length) {
    els.similarTable.innerHTML = '<tr><td colspan="6">Ingen lignende kurver</td></tr>';
    return;
  }
  els.similarTable.innerHTML = "";
  const fragment = document.createDocumentFragment();
  rows.slice(0, 50).forEach((row) => {
    const tr = document.createElement("tr");
    const nameCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "linkButton";
    button.textContent = row.item.name;
    button.addEventListener("click", () => {
      state.selected.add(row.item.id);
      renderAll();
    });
    nameCell.append(button);
    [
      nameCell,
      cell(row.item.sex),
      cell(formatDecimal(row.similarity * 100, 0)),
      cell(formatScore(row.score)),
      cell(`${row.item.peakYear} (${formatNumber(row.item.peakCount)})`),
      actionCell(row.item),
    ].forEach((td) => tr.append(td));
    fragment.append(tr);
  });
  els.similarTable.append(fragment);
}

function similarityRow(referenceSeries, item) {
  const candidateSeries = comparableSeries(item, state.similar.metric);
  const pairs = [];
  referenceSeries.forEach((refValue, year) => {
    const candidateValue = candidateSeries.get(year);
    if (refValue != null && candidateValue != null) pairs.push([refValue, candidateValue]);
  });
  if (pairs.length < 3) return null;
  const left = smoothValues(pairs.map(([value]) => value), state.similar.smooth);
  const right = smoothValues(pairs.map(([, value]) => value), state.similar.smooth);
  const score = similarityScore(left, right, state.similar.method);
  if (score == null) return null;
  return {
    item,
    score,
    similarity: normalizedSimilarity(score, state.similar.method),
  };
}

function comparableSeries(item, metric) {
  const points = allPoints(item).filter((point) => point.year >= state.similar.fromYear && point.year <= state.similar.toYear);
  const values = points.map((point) => [point.year, comparableValue(point, item, metric)]);
  if (metric !== "index") return new Map(values.filter(([, value]) => value != null));
  const base = values.find(([, value]) => value != null && value > 0)?.[1];
  if (!base) return new Map();
  return new Map(values.map(([year, value]) => [year, value == null ? null : (value / base) * 100]).filter(([, value]) => value != null));
}

function comparableValue(point, item, metric) {
  if (metric === "rank") return point.rank;
  if (metric === "index") return point.shareSex;
  return point.shareSex;
}

function similarityScore(left, right, method) {
  if (method === "spearman") return pearson(rankValues(left), rankValues(right));
  if (method === "euclidean") return euclidean(zScores(left), zScores(right));
  return pearson(zScores(left), zScores(right));
}

function normalizedSimilarity(score, method) {
  if (method === "euclidean") return 1 / (1 + score);
  return Math.max(0, Math.min(1, (score + 1) / 2));
}

function pearson(left, right) {
  if (left.length !== right.length || left.length < 3) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSum = 0;
  let rightSum = 0;
  for (let i = 0; i < left.length; i += 1) {
    const lx = left[i] - leftMean;
    const ry = right[i] - rightMean;
    numerator += lx * ry;
    leftSum += lx * lx;
    rightSum += ry * ry;
  }
  const denominator = Math.sqrt(leftSum * rightSum);
  return denominator ? numerator / denominator : null;
}

function euclidean(left, right) {
  if (left.length !== right.length || left.length < 3) return null;
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0));
}

function zScores(values) {
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  const sd = Math.sqrt(variance);
  return sd ? values.map((value) => (value - avg) / sd) : values.map(() => 0);
}

function rankValues(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  for (let i = 0; i < sorted.length; i += 1) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j += 1;
    const rank = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) ranks[sorted[k].index] = rank;
    i = j;
  }
  return ranks;
}

function smoothValues(values, width) {
  const size = Math.max(1, Math.round(width || 1));
  if (size <= 1) return values;
  const radius = Math.floor(size / 2);
  return values.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(values.length, index + radius + 1);
    return mean(values.slice(from, to));
  });
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function renderSummary() {
  const items = selectedItems();
  const visible = items.flatMap((item) => visiblePoints(item).map((point) => ({ item, point })));
  const bestRank = visible.filter((row) => row.point.rank).sort((a, b) => a.point.rank - b.point.rank)[0];
  const largest = visible.sort((a, b) => b.point.count - a.point.count)[0];
  const totals = items.reduce((sum, item) => sum + item.total, 0);
  els.summaryGrid.innerHTML = "";
  [
    ["Valgte navn", String(items.length)],
    ["Samlet fødte", formatNumber(totals)],
    ["Største årspunkt", largest ? `${largest.item.name}: ${formatNumber(largest.point.count)} (${largest.point.year})` : "–"],
    ["Beste rang", bestRank ? `${bestRank.item.name}: #${bestRank.point.rank} (${bestRank.point.year})` : "–"],
  ].forEach(([label, value]) => {
    const div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    els.summaryGrid.append(div);
  });
}

function renderSchoolEstimate() {
  if (!state.data) return;
  readSchoolControls(false);
  const scope = schoolScopeForGrade(state.childGrade);
  els.schoolScopeHeader.textContent = scope.label;
  const rows = selectedItems().map((item) => schoolEstimate(item, scope));
  rows.sort((a, b) => b.own.expected - a.own.expected || a.item.name.localeCompare(b.item.name, "no"));
  if (!rows.length) {
    els.schoolTable.innerHTML = '<tr><td colspan="3">Ingen valgte navn</td></tr>';
    return;
  }
  els.schoolTable.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.item.name)}</td>
      <td>${formatEstimate(row.own)}</td>
      <td>${formatEstimate(row.scope)}</td>
    </tr>
  `).join("");
}

function renderCandidates() {
  if (!state.data) return;
  readCandidateControls(false);
  let pattern;
  try {
    pattern = new RegExp(state.candidate.regex, "iu");
    els.candidateError.textContent = "";
  } catch (error) {
    els.candidateError.textContent = error.message;
    state.candidate.rows = [];
    els.candidateCount.textContent = "0 navn";
    els.candidateTable.innerHTML = "";
    return;
  }
  const scope = schoolScopeForGrade(state.candidate.grade);
  els.candidateScope.textContent = scope.label;
  const maxSchoolmates = state.candidate.maxSchoolmates;
  const rows = state.data.names
    .filter((item) => state.candidate.sex === "alle" || item.sex === state.candidate.sex)
    .filter((item) => state.showRejected || statusOf(item.id) !== "rejected")
    .filter((item) => pattern.test(item.name) || pattern.test(item.key.replaceAll("_", " ")))
    .map((item) => candidateRow(item, scope))
    .filter((row) => maxSchoolmates == null || (row.school.complete && row.schoolmates <= maxSchoolmates));
  rows.sort(candidateSorter);
  state.candidate.rows = rows;
  els.candidateCount.textContent = `${formatNumber(rows.length)} navn`;
  if (!rows.length) {
    els.candidateTable.innerHTML = '<tr><td colspan="7">Ingen navn i filterlisten</td></tr>';
    return;
  }
  els.candidateTable.innerHTML = "";
  const fragment = document.createDocumentFragment();
  rows.slice(0, 300).forEach((row) => {
    const tr = document.createElement("tr");
    const nameCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "linkButton";
    button.textContent = row.item.name;
    button.addEventListener("click", () => {
      state.selected.add(row.item.id);
      renderAll();
    });
    nameCell.append(button);
    [
      nameCell,
      cell(row.item.sex),
      cell(formatNumber(row.birthCount)),
      cell(row.school.complete ? formatDecimal(row.schoolmates, 2) : "–"),
      cell(`${row.item.peakYear} (${formatNumber(row.item.peakCount)})`),
      cell(formatSigned(row.trend)),
      actionCell(row.item),
    ].forEach((td) => tr.append(td));
    fragment.append(tr);
  });
  els.candidateTable.append(fragment);
}

function candidateRow(item, scope) {
  const school = estimateForGradesWithControls(
    item,
    scope.from,
    scope.to,
    state.candidate.birthYear,
    state.candidate.grade,
    state.candidate.gradeSize,
  );
  const birthCount = hasNameDataYear(state.candidate.birthYear) ? countInYear(item, state.candidate.birthYear) : 0;
  const priorYear = hasNameDataYear(state.candidate.birthYear - 5) ? countInYear(item, state.candidate.birthYear - 5) : null;
  return {
    item,
    birthCount,
    school,
    schoolmates: school.complete ? Math.max(0, school.expected - 1) : 0,
    similarity: state.similar.rows.find((row) => row.item.id === item.id)?.similarity ?? null,
    trend: priorYear == null ? null : birthCount - priorYear,
  };
}

function candidateSorter(a, b) {
  if (state.candidate.sort === "birthYear") {
    return b.birthCount - a.birthCount || a.item.name.localeCompare(b.item.name, "no");
  }
  if (state.candidate.sort === "trend") {
    return (b.trend ?? -Infinity) - (a.trend ?? -Infinity) || b.birthCount - a.birthCount || a.item.name.localeCompare(b.item.name, "no");
  }
  if (state.candidate.sort === "similar") {
    return (b.similarity ?? -Infinity) - (a.similarity ?? -Infinity) || a.item.name.localeCompare(b.item.name, "no");
  }
  if (state.candidate.sort === "name") {
    return a.item.name.localeCompare(b.item.name, "no") || a.item.sex.localeCompare(b.item.sex, "no");
  }
  return a.schoolmates - b.schoolmates || b.birthCount - a.birthCount || a.item.name.localeCompare(b.item.name, "no");
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value;
  return td;
}

function schoolEstimate(item, scope) {
  return {
    item,
    own: estimateForGrades(item, state.childGrade, state.childGrade),
    scope: estimateForGrades(item, scope.from, scope.to),
  };
}

function schoolScopeForGrade(grade) {
  if (!isValidGrade(grade)) return { from: null, to: null, label: "Relevant skole" };
  if (grade <= 7) return { from: 1, to: 7, label: "Barneskole 1.-7." };
  if (grade <= 10) return { from: 8, to: 10, label: "Ungdomsskole 8.-10." };
  return { from: 11, to: 13, label: "VGS 1.-3." };
}

function estimateForGrades(item, fromGrade, toGrade) {
  return estimateForGradesWithControls(item, fromGrade, toGrade, state.schoolBirthYear, state.childGrade, state.gradeSize);
}

function estimateForGradesWithControls(item, fromGrade, toGrade, birthYear, grade, gradeSize) {
  if (!hasNameDataYear(birthYear) || !isValidGrade(grade) || !gradeSize || gradeSize <= 0 || fromGrade == null || toGrade == null) {
    return { expected: 0, share: 0, years: [], complete: false };
  }
  const years = [];
  let expected = 0;
  let usedPupils = 0;
  for (let currentGrade = fromGrade; currentGrade <= toGrade; currentGrade += 1) {
    const year = birthYear - (currentGrade - grade);
    const yearIndex = state.data.years.indexOf(year);
    if (yearIndex < 0 || !hasNameDataYear(year)) return { expected: 0, share: 0, years, complete: false };
    const totalBirths = state.data.totalBirths[yearIndex];
    if (!totalBirths) return { expected: 0, share: 0, years, complete: false };
    const count = countInYear(item, year);
    expected += (count / totalBirths) * gradeSize;
    usedPupils += gradeSize;
    years.push(year);
  }
  return {
    expected,
    share: usedPupils ? (expected / usedPupils) * 100 : 0,
    years,
    complete: true,
  };
}

function renderTable() {
  els.dataTable.innerHTML = "";
  selectedItems().forEach((item) => {
    const ranks = item.series.map((p) => p[2]).filter(Boolean);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${item.sex}</td>
      <td>${formatNumber(item.total)}</td>
      <td>${item.peakYear}</td>
      <td>${formatNumber(item.peakCount)}</td>
      <td>${item.firstYear}</td>
      <td>${item.lastYear}</td>
      <td>${ranks.length ? Math.min(...ranks) : "–"}</td>
    `;
    els.dataTable.append(row);
  });
}

function updateUrl() {
  if (!state.data) return;
  const params = new URLSearchParams();
  params.set("q", state.regex);
  params.set("sex", state.sex);
  params.set("metric", state.metric);
  params.set("smooth", String(state.chartSmooth));
  params.set("from", String(state.fromYear));
  params.set("to", String(state.toYear));
  params.set("topSelect", state.topNSelectionMode);
  params.set("topMode", els.topNMode.value);
  params.set("topYear", String(state.topNYear));
  params.set("topFrom", String(state.topNFromYear));
  params.set("topTo", String(state.topNToYear));
  params.set("topRange", state.topNRangePreset);
  params.set("topRangeFrom", String(state.topNRangeFrom));
  params.set("topRangeTo", String(state.topNRangeTo));
  params.set("topLimit", String(state.topNRangeLimit));
  if (state.schoolBirthYear != null) params.set("schoolYear", String(state.schoolBirthYear));
  if (state.childGrade != null) params.set("grade", String(state.childGrade));
  if (state.gradeSize != null) params.set("gradeSize", String(state.gradeSize));
  params.set("candidateQ", state.candidate.regex);
  params.set("candidateSex", state.candidate.sex);
  if (state.candidate.birthYear != null) params.set("candidateYear", String(state.candidate.birthYear));
  if (state.candidate.grade != null) params.set("candidateGrade", String(state.candidate.grade));
  if (state.candidate.gradeSize != null) params.set("candidateSize", String(state.candidate.gradeSize));
  if (state.candidate.maxSchoolmates != null) params.set("candidateMax", String(state.candidate.maxSchoolmates));
  params.set("candidateSort", state.candidate.sort);
  if (state.similar.referenceId) params.set("similarReference", state.similar.referenceId);
  params.set("similarMethod", state.similar.method);
  params.set("similarMetric", state.similar.metric);
  params.set("similarSmooth", String(state.similar.smooth));
  params.set("similarFrom", String(state.similar.fromYear));
  params.set("similarTo", String(state.similar.toYear));
  if (state.selected.size) params.set("names", [...state.selected].join(","));
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

async function copyShareLink() {
  await navigator.clipboard.writeText(location.href);
  els.copyLink.textContent = "Kopiert";
  setTimeout(() => (els.copyLink.textContent = "Kopier lenke"), 1100);
}

function downloadCsv() {
  const rows = [["name", "sex", "year", "count", "rank", "share_all_births_pct", "share_same_sex_births_pct"]];
  selectedItems().forEach((item) => {
    visiblePoints(item).forEach((p) => {
      rows.push([item.name, item.sex, p.year, p.count, p.rank, round(p.shareAll), round(p.shareSex)]);
    });
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "navnestatistikk.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportNameStatusBackup() {
  const payload = {
    schema: "navnestatistikk-name-status",
    version: 1,
    exportedAt: new Date().toISOString(),
    decisions: state.nameStatus,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `navnestatistikk-navnevalg-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setBackupMessage(`Eksportert ${formatNumber(Object.keys(state.nameStatus).length)} valg.`, "success");
}

async function handleNameStatusImport(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const payload = validateNameStatusBackup(parsed);
    if (!payload.ok) {
      setBackupMessage(payload.error, "error");
      return;
    }
    const imported = payload.decisions;
    const importedEntries = Object.entries(imported);
    const importedShortlist = importedEntries.filter(([, value]) => value === "shortlist").length;
    const importedRejected = importedEntries.filter(([, value]) => value === "rejected").length;
    const overwrites = importedEntries.filter(([id, value]) => state.nameStatus[id] && state.nameStatus[id] !== value).length;
    const mergeSummary = `${importedShortlist} aktuelle og ${importedRejected} uaktuelle`;
    const overwriteSummary = overwrites ? ` ${overwrites} eksisterende valg blir erstattet.` : "";
    if (!confirm(`Importere ${mergeSummary}?${overwriteSummary}`)) {
      setBackupMessage("Import avbrutt.", "info");
      return;
    }
    state.nameStatus = { ...state.nameStatus, ...imported };
    state.selected = new Set([...state.selected].filter((id) => statusOf(id) !== "rejected"));
    saveNameStatus();
    updateMatches();
    setBackupMessage(`Importerte ${mergeSummary}.`, "success");
  } catch (error) {
    setBackupMessage(`Kunne ikke lese filen: ${error.message}`, "error");
  }
}

function validateNameStatusBackup(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Ugyldig JSON-fil." };
  }
  if (parsed.schema !== "navnestatistikk-name-status") {
    return { ok: false, error: "Ukjent eksportformat." };
  }
  if (parsed.version !== 1 || typeof parsed.exportedAt !== "string") {
    return { ok: false, error: "Eksportfilen mangler gyldige metadata." };
  }
  if (!parsed.decisions || typeof parsed.decisions !== "object" || Array.isArray(parsed.decisions)) {
    return { ok: false, error: "Eksportfilen mangler navnevalg." };
  }
  const decisions = {};
  for (const [id, value] of Object.entries(parsed.decisions)) {
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, error: "Eksportfilen inneholder ugyldige navn." };
    }
    if (value !== "shortlist" && value !== "rejected") {
      return { ok: false, error: "Eksportfilen inneholder ukjente statusverdier." };
    }
    decisions[id] = value;
  }
  return { ok: true, decisions };
}

function clampYear(year) {
  if (!state.data) return year;
  return Math.max(state.data.years[0], Math.min(state.data.years.at(-1), year));
}

function clampNameYear(year) {
  if (!state.data) return year;
  const fallback = Number.isFinite(year) ? year : state.nameToYear;
  return Math.max(state.nameFromYear, Math.min(state.nameToYear, fallback));
}

function clampGrade(grade) {
  return Math.max(1, Math.min(13, Number.isFinite(grade) ? Math.round(grade) : 1));
}

function clampPercent(percent) {
  return Math.max(0, Math.min(100, Number.isFinite(percent) ? Math.round(percent) : 0));
}

function parseIntegerInput(value) {
  if (String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function parseNumberInput(value) {
  if (String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isValidYear(year) {
  return Number.isInteger(year) && state.data && state.data.years.includes(year);
}

function hasNameDataYear(year) {
  return Number.isInteger(year) && state.data && year >= state.nameFromYear && year <= state.nameToYear;
}

function isValidGrade(grade) {
  return Number.isInteger(grade) && grade >= 1 && grade <= 13;
}

function formatNumber(value) {
  return new Intl.NumberFormat("no-NO").format(value);
}

function formatDecimal(value, digits) {
  return new Intl.NumberFormat("no-NO", { maximumFractionDigits: digits }).format(value);
}

function formatSigned(value) {
  if (value == null) return "–";
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function formatEstimate(value) {
  if (!value.complete) return "–";
  return `${formatDecimal(value.expected, 2)} (${formatDecimal(value.share, 3)} %)`;
}

function formatScore(value) {
  if (value == null) return "–";
  return state.similar.method === "euclidean" ? formatDecimal(value, 3) : formatDecimal(value, 3);
}

function round(value) {
  return value == null ? "" : Math.round(value * 10000) / 10000;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
