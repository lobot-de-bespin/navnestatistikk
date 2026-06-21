const state = {
  data: null,
  sex: "alle",
  regex: "^anna$|^ole$",
  matches: [],
  selected: new Set(),
  metric: "count",
  scale: "linear",
  fromYear: 1880,
  toYear: 2025,
  markers: false,
};

const els = {};
const groupDefinitions = {
  "group:boys2025:noah": { name: "Noah", sex: "gutt", members: ["2NOAH", "2NOA"] },
  "group:boys2025:jakob": { name: "Jakob", sex: "gutt", members: ["2JAKOB", "2JACOB"] },
  "group:boys2025:lucas": { name: "Lucas", sex: "gutt", members: ["2LUCAS", "2LUKAS"] },
  "group:boys2025:emil": { name: "Emil", sex: "gutt", members: ["2EMIL"] },
  "group:boys2025:oskar": { name: "Oskar", sex: "gutt", members: ["2OSKAR", "2OSCAR"] },
  "group:boys2025:william": { name: "William", sex: "gutt", members: ["2WILLIAM"] },
  "group:boys2025:elias": { name: "Elias", sex: "gutt", members: ["2ELIAS"] },
  "group:boys2025:isak": { name: "Isak", sex: "gutt", members: ["2ISAK", "2ISAAC", "2ISAC"] },
  "group:boys2025:oliver": { name: "Oliver", sex: "gutt", members: ["2OLIVER"] },
  "group:boys2025:ludvig": { name: "Ludvig", sex: "gutt", members: ["2LUDVIG", "2LUDVIK"], extra: [{ year: 2025, count: 5, label: "Ludwig" }] },
};
const boys2025Preset = Object.keys(groupDefinitions);

document.addEventListener("DOMContentLoaded", () => {
  [
    "dataStatus",
    "regexInput",
    "applyRegex",
    "presetBoys2025",
    "regexError",
    "resultCount",
    "resultList",
    "selectVisible",
    "clearSelected",
    "metricSelect",
    "scaleSelect",
    "fromYear",
    "toYear",
    "markersToggle",
    "selectedNames",
    "chart",
    "summaryGrid",
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
  els.presetBoys2025.addEventListener("click", applyBoys2025Preset);
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
      state.fromYear = clampYear(Number(els.fromYear.value));
      state.toYear = clampYear(Number(els.toYear.value));
      if (state.fromYear > state.toYear) [state.fromYear, state.toYear] = [state.toYear, state.fromYear];
      els.fromYear.value = state.fromYear;
      els.toYear.value = state.toYear;
      renderAll();
    });
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
  state.fromYear = state.data.years[0];
  state.toYear = state.data.years[state.data.years.length - 1];
  els.fromYear.min = state.fromYear;
  els.fromYear.max = state.toYear;
  els.toYear.min = state.fromYear;
  els.toYear.max = state.toYear;
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  restoreFromUrl();
  els.dataStatus.textContent = `Data: ${state.data.years[0]}-${state.data.years.at(-1)}, bygget ${state.data.meta.builtAt.slice(0, 10)}`;
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
  if (params.has("from")) state.fromYear = clampYear(Number(params.get("from")));
  if (params.has("to")) state.toYear = clampYear(Number(params.get("to")));
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  if (params.has("names")) {
    params.get("names").split(",").filter(Boolean).forEach((id) => state.selected.add(id));
  }
  if (params.get("preset") === "boys2025") applyBoys2025Preset(false);
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
  return [...state.selected].map((id) => groupDefinitions[id] ? makeGroupItem(id, byId) : byId.get(id)).filter(Boolean);
}

function makeGroupItem(id, byId) {
  const definition = groupDefinitions[id];
  const members = definition.members.map((memberId) => byId.get(memberId)).filter(Boolean);
  const byYear = new Map();
  members.forEach((member) => {
    member.series.forEach(([yearIndex, count]) => {
      byYear.set(yearIndex, (byYear.get(yearIndex) || 0) + count);
    });
  });
  (definition.extra || []).forEach((extra) => {
    const yearIndex = state.data.years.indexOf(extra.year);
    if (yearIndex >= 0) byYear.set(yearIndex, (byYear.get(yearIndex) || 0) + extra.count);
  });
  const series = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([yearIndex, count]) => [yearIndex, count, null]);
  const counts = series.map(([yearIndex, count]) => [yearIndex, count]);
  const total = counts.reduce((sum, [, count]) => sum + count, 0);
  const [peakIndex, peakCount] = counts.reduce((best, row) => row[1] > best[1] ? row : best, counts[0]);
  return {
    id,
    key: id,
    name: definition.name,
    sex: definition.sex,
    series,
    total,
    peakYear: state.data.years[peakIndex],
    peakCount,
    firstYear: state.data.years[counts[0][0]],
    lastYear: state.data.years[counts.at(-1)[0]],
    members: members.map((member) => member.name).concat((definition.extra || []).map((extra) => extra.label)),
  };
}

function applyBoys2025Preset(render = true) {
  state.sex = "gutt";
  state.regex = ".*";
  state.metric = "count";
  state.scale = "linear";
  state.fromYear = 2025;
  state.toYear = 2025;
  state.markers = true;
  state.selected = new Set(boys2025Preset);
  els.regexInput.value = state.regex;
  els.metricSelect.value = state.metric;
  els.scaleSelect.value = state.scale;
  els.fromYear.value = state.fromYear;
  els.toYear.value = state.toYear;
  els.markersToggle.checked = true;
  document.querySelectorAll("[data-sex]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sex === state.sex);
  });
  if (render) updateMatches();
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
  const items = selectedItems();
  const singleYear = state.fromYear === state.toYear;
  const traces = singleYear ? [barTrace(items)] : items.map((item) => {
    const points = visiblePoints(item);
    return {
      x: points.map((p) => p.year),
      y: points.map((p) => metricValue(p, item)),
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
    showlegend: !singleYear,
    legend: { orientation: "h", y: -0.2 },
    xaxis: singleYear ? { title: "Navn" } : { title: "År", range: [state.fromYear, state.toYear] },
    yaxis: yAxisConfig(),
  };
  const config = { responsive: true, displaylogo: false };
  Plotly.react(els.chart, traces, layout, config);
}

function barTrace(items) {
  const rows = items.map((item) => {
    const point = visiblePoints(item)[0];
    return { item, point, value: point ? metricValue(point, item) : null };
  }).filter((row) => row.point && row.value != null);
  return {
    type: "bar",
    x: rows.map((row) => row.item.name),
    y: rows.map((row) => row.value),
    marker: { color: "#11675a" },
    text: rows.map((row) => state.metric === "count" ? String(row.point.count) : String(round(row.value))),
    textposition: "outside",
    customdata: rows.map((row) => [row.point.count, row.point.rank, row.point.shareAll, row.point.shareSex]),
    hovertemplate: "%{x}<br>Verdi: %{y}<br>Antall: %{customdata[0]}<extra></extra>",
  };
}

function visiblePoints(item) {
  return item.series
    .map(([yearIndex, count, rank]) => {
      const year = state.data.years[yearIndex];
      const total = state.data.totalBirths[yearIndex];
      const sexTotal = state.data.sexBirths[item.sex]?.[String(year)] ?? null;
      return {
        year,
        yearIndex,
        count,
        rank,
        shareAll: total ? (count / total) * 100 : null,
        shareSex: sexTotal ? (count / sexTotal) * 100 : null,
      };
    })
    .filter((p) => p.year >= state.fromYear && p.year <= state.toYear);
}

function metricValue(point, item) {
  if (state.metric === "shareAll") return point.shareAll;
  if (state.metric === "shareSex") return point.shareSex;
  if (state.metric === "rank") return point.rank;
  if (state.metric === "index") {
    const base = visiblePoints(item).find((p) => p.count > 0)?.count;
    return base ? (point.count / base) * 100 : null;
  }
  return point.count;
}

function yAxisConfig() {
  const titles = {
    count: "Antall fødte",
    shareAll: "Andel av alle levendefødte (%)",
    shareSex: "Andel av levendefødte samme kjønn (%)",
    rank: "Rang innen kjønn",
    index: "Indeks (første punkt = 100)",
  };
  const axis = { title: titles[state.metric], rangemode: "tozero" };
  if (state.metric === "rank") {
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

function formatNumber(value) {
  return new Intl.NumberFormat("no-NO").format(value);
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
