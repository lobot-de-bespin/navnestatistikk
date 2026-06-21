const state = {
  data: null,
  nameFromYear: 1945,
  nameToYear: 2025,
  sex: "alle",
  regex: "^anna$|^ole$",
  matches: [],
  selected: new Set(),
  metric: "count",
  scale: "linear",
  fromYear: 1880,
  toYear: 2025,
  topNYear: 2025,
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
  markers: false,
};

const els = {};

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
    "topNCount",
    "topNMode",
    "topNYear",
    "selectTopN",
    "metricSelect",
    "scaleSelect",
    "fromYear",
    "toYear",
    "markersToggle",
    "selectedNames",
    "chart",
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

  wireEvents();
  loadData();
});

function wireEvents() {
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
  els.selectTopN.addEventListener("click", selectTopN);
  els.topNMode.addEventListener("change", () => {
    els.topNYear.disabled = els.topNMode.value === "period";
  });
  els.topNYear.addEventListener("change", () => {
    state.topNYear = clampNameYear(Number(els.topNYear.value));
    els.topNYear.value = state.topNYear;
  });
  els.metricSelect.addEventListener("change", () => {
    state.metric = els.metricSelect.value;
    renderAll();
  });
  els.scaleSelect.addEventListener("change", () => {
    state.scale = els.scaleSelect.value;
    renderChart();
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
  els.copyLink.addEventListener("click", copyShareLink);
  els.downloadCsv.addEventListener("click", downloadCsv);
  els.downloadPng.addEventListener("click", () => {
    Plotly.downloadImage(els.chart, { format: "png", filename: "navnestatistikk", height: 900, width: 1400 });
  });
  window.addEventListener("resize", () => {
    if (state.data) Plotly.Plots.resize(els.chart);
  });
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
  els.schoolBirthYear.min = state.nameFromYear;
  els.schoolBirthYear.max = state.nameToYear;
  els.candidateBirthYear.min = state.nameFromYear;
  els.candidateBirthYear.max = state.nameToYear;
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  state.topNYear = state.toYear;
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
  if (params.has("from")) state.fromYear = clampNameYear(Number(params.get("from")));
  if (params.has("to")) state.toYear = clampNameYear(Number(params.get("to")));
  if (params.has("topYear")) state.topNYear = clampNameYear(Number(params.get("topYear")));
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
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  els.topNYear.value = state.topNYear;
  els.schoolBirthYear.value = state.schoolBirthYear;
  els.childGrade.value = state.childGrade;
  els.gradeSize.value = state.gradeSize;
  writeCandidateControls();
  if (params.has("names")) {
    params.get("names").split(",").filter(Boolean).forEach((id) => state.selected.add(id));
  }
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
  renderSummary();
  renderSchoolEstimate();
  renderCandidates();
  renderTable();
  updateUrl();
}

function renderResults() {
  els.resultCount.textContent = `${state.matches.length} treff`;
  els.resultList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.matches.slice(0, 250).forEach((item) => {
    const label = document.createElement("label");
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
    label.append(checkbox, name, meta);
    fragment.append(label);
  });
  els.resultList.append(fragment);
}

function selectedItems() {
  const byId = new Map(state.data.names.map((item) => [item.id, item]));
  return [...state.selected].map((id) => byId.get(id)).filter(Boolean);
}

function selectTopN() {
  if (!state.data) return;
  state.topNYear = clampNameYear(Number(els.topNYear.value));
  els.topNYear.value = state.topNYear;
  const n = Number(els.topNCount.value);
  const mode = els.topNMode.value;
  const rows = state.data.names
    .filter((item) => state.sex === "alle" || item.sex === state.sex)
    .map((item) => {
      const value = mode === "year" ? topNValueInYear(item, state.topNYear) : topNValueInPeriod(item, state.fromYear, state.toYear);
      return { item, value };
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.item.name.localeCompare(b.item.name, "no"));
  state.selected = new Set(rows.slice(0, n).map((row) => row.item.id));
  state.regex = ".*";
  els.regexInput.value = state.regex;
  updateMatches();
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

function renderSelected() {
  els.selectedNames.innerHTML = "";
  selectedItems().forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = `${item.name} (${item.sex})`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Fjern ${item.name}`);
    remove.addEventListener("click", () => {
      state.selected.delete(item.id);
      renderAll();
    });
    pill.append(remove);
    els.selectedNames.append(pill);
  });
}

function renderChart() {
  if (!state.data || !window.Plotly) return;
  const effectiveMetric = effectiveChartMetric();
  const traces = selectedItems().map((item) => {
    const points = visiblePoints(item);
    return {
      x: points.map((p) => p.year),
      y: points.map((p) => metricValue(p, item, effectiveMetric)),
      mode: state.markers ? "lines+markers" : "lines",
      name: `${item.name} (${item.sex})`,
      line: { width: 2.5 },
      hovertemplate: hoverTemplate(),
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
    })
    .filter((p) => p.year >= state.fromYear && p.year <= state.toYear);
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

function hoverTemplate() {
  if (state.metric === "rank") return "%{x}<br>Rang: %{y}<br>Antall: %{customdata[0]}<extra>%{fullData.name}</extra>";
  if (state.metric === "shareAll") return "%{x}<br>Andel: %{y:.3f}%<br>Antall: %{customdata[0]}<br>Rang: %{customdata[1]}<extra>%{fullData.name}</extra>";
  if (state.metric === "shareSex") return "%{x}<br>Andel: %{y:.3f}%<br>Antall: %{customdata[0]}<br>Rang: %{customdata[1]}<extra>%{fullData.name}</extra>";
  if (state.metric === "index") return "%{x}<br>Indeks: %{y:.1f}<br>Antall: %{customdata[0]}<br>Rang: %{customdata[1]}<extra>%{fullData.name}</extra>";
  return "%{x}<br>Antall: %{y}<br>Rang: %{customdata[1]}<br>Andel: %{customdata[2]:.3f}%<extra>%{fullData.name}</extra>";
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
    .filter((item) => pattern.test(item.name) || pattern.test(item.key.replaceAll("_", " ")))
    .map((item) => candidateRow(item, scope))
    .filter((row) => maxSchoolmates == null || (row.school.complete && row.schoolmates <= maxSchoolmates));
  rows.sort(candidateSorter);
  state.candidate.rows = rows;
  els.candidateCount.textContent = `${formatNumber(rows.length)} navn`;
  if (!rows.length) {
    els.candidateTable.innerHTML = '<tr><td colspan="6">Ingen kandidater</td></tr>';
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
  params.set("from", String(state.fromYear));
  params.set("to", String(state.toYear));
  params.set("topYear", String(state.topNYear));
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
