const STATUS_STORAGE_KEY = "navnestatistikk:nameStatus:v1";
const WORK_STORAGE_KEY = "navnestatistikk:workSelection:v2";
const HISTORY_STORAGE_KEY = "navnestatistikk:decisionHistory:v2";
const RECENT_STORAGE_KEY = "navnestatistikk:recentSearches:v2";
const SW_VERSION = "2026-07-22.18";

const state = {
  data: null,
  years: [],
  latestYear: 2025,
  firstYear: 1880,
  itemsById: new Map(),
  selected: new Set(),
  status: {},
  history: [],
  recent: [],
  tab: "explore",
  popularSex: "jente",
  query: "",
  filters: {
    sex: "alle",
    fromYear: 1900,
    toYear: 2025,
    popularity: "alle",
    pattern: "",
    schoolMax: "",
  },
  compare: {
    metric: "count",
    fromYear: 1900,
    smooth: 3,
  },
  review: {
    deck: [],
    index: 0,
    undo: [],
  },
  candidateRows: [],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const nf = new Intl.NumberFormat("nb-NO");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindChrome();
  loadLocalState();
  await loadData();
  restoreFromUrl();
  renderAll();
  registerServiceWorker();
}

async function loadData() {
  const response = await fetch("assets/names-data.json");
  state.data = await response.json();
  state.years = state.data.years;
  state.firstYear = state.years[0];
  state.latestYear = state.years.at(-1);
  state.filters.toYear = state.latestYear;
  state.compare.fromYear = Math.max(1900, state.firstYear);
  state.itemsById = new Map(state.data.names.map((item) => [item.id, item]));
  state.selected = new Set([...state.selected].filter((id) => state.itemsById.has(id)));
  saveWorkSelection();
}

function bindChrome() {
  $$(".tabBar button").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  $("#searchInput")?.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    if (state.query) rememberSearch(state.query);
    renderExplore();
  });
  $("#openFilter")?.addEventListener("click", openFilters);
  $("#candidateCard")?.addEventListener("click", openCandidateBuilder);
  $("#openCandidateList")?.addEventListener("click", openCandidateBuilder);
  $("[data-popular-sex='jente']")?.addEventListener("click", () => setPopularSex("jente"));
  $("[data-popular-sex='gutt']")?.addEventListener("click", () => setPopularSex("gutt"));
  $$("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.compare.metric = button.dataset.metric;
      renderCompare();
      updateUrl();
    });
  });
  $("#compareYears")?.addEventListener("change", (event) => {
    state.compare.fromYear = Number(event.target.value);
    renderCompare();
    updateUrl();
  });
  $("#compareSmooth")?.addEventListener("change", (event) => {
    state.compare.smooth = Number(event.target.value);
    renderCompare();
    updateUrl();
  });
  $("#shareCompare")?.addEventListener("click", copyShareLink);
  $("#downloadCsv")?.addEventListener("click", downloadCsv);
  $("#downloadPng")?.addEventListener("click", () => {
    downloadChartSvg();
  });
  $("#openCompareSettings")?.addEventListener("click", openCompareSettings);
  $("#openCompareTable")?.addEventListener("click", openCompareTable);
  $("#reviewShortlist")?.addEventListener("click", () => decideCurrent("shortlist"));
  $("#reviewReject")?.addEventListener("click", () => decideCurrent("rejected"));
  $("#reviewSkip")?.addEventListener("click", skipCurrent);
  $("#reviewUndo")?.addEventListener("click", undoDecision);
  $("#reviewBack")?.addEventListener("click", undoDecision);
  $("#reviewMenu")?.addEventListener("click", () => openNameList("work"));
  bindReviewSwipe();
  $("#openBackup")?.addEventListener("click", openBackup);
  $("#openHistory")?.addEventListener("click", openHistory);
  $$("[data-open-list]").forEach((button) => {
    button.addEventListener("click", () => openNameList(button.dataset.openList));
  });
  $("#subBack")?.addEventListener("click", closeSubscreen);
  $("#subscreen")?.addEventListener("click", (event) => {
    if (event.target.id === "subscreen") closeSubscreen();
  });
  $("#importInput")?.addEventListener("change", importDecisions);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(`sw.js?v=${encodeURIComponent(SW_VERSION)}`, { scope: "./" }).catch(() => {});
  }
}

function loadLocalState() {
  try {
    const selected = JSON.parse(localStorage.getItem(WORK_STORAGE_KEY) || "[]");
    state.selected = new Set(Array.isArray(selected) ? selected.filter((id) => typeof id === "string") : []);
  } catch {
    state.selected = new Set();
  }
  try {
    state.status = JSON.parse(localStorage.getItem(STATUS_STORAGE_KEY) || "{}") || {};
  } catch {
    state.status = {};
  }
  try {
    state.history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]").slice(0, 100);
  } catch {
    state.history = [];
  }
  try {
    state.recent = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]").slice(0, 8);
  } catch {
    state.recent = [];
  }
}

function saveStatus() {
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(state.status));
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history.slice(0, 100)));
}

function saveWorkSelection() {
  localStorage.setItem(WORK_STORAGE_KEY, JSON.stringify([...state.selected]));
}

function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has("q")) {
    state.query = params.get("q") || "";
    $("#searchInput").value = state.query;
  }
  if (params.has("names")) {
    params
      .get("names")
      .split(",")
      .map((id) => state.itemsById.get(id))
      .filter(Boolean)
      .forEach((item) => state.selected.add(item.id));
    saveWorkSelection();
  }
  if (params.has("metric")) state.compare.metric = params.get("metric");
  if (params.has("from")) state.compare.fromYear = clampYear(Number(params.get("from")));
  if (params.has("smooth")) state.compare.smooth = Math.max(1, Number(params.get("smooth")) || 3);
}

function updateUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.selected.size) params.set("names", [...state.selected].join(","));
  params.set("metric", state.compare.metric);
  params.set("from", String(state.compare.fromYear));
  params.set("smooth", String(state.compare.smooth));
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function setTab(tab) {
  state.tab = tab;
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.view === tab));
  $$(".tabBar button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  closeSubscreen(false);
  if (tab === "review") ensureReviewDeck();
  renderAll();
  requestAnimationFrame(() => {
    if (tab === "compare") renderCompare();
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderAll() {
  if (!state.data) return;
  renderExplore();
  renderCompare();
  renderReview();
  renderMine();
}

function renderExplore() {
  renderRecentSearches();
  $("[data-popular-sex='jente']")?.classList.toggle("active", state.popularSex === "jente");
  $("[data-popular-sex='gutt']")?.classList.toggle("active", state.popularSex === "gutt");
  const list = $("#popularList");
  if (!list) return;
  const hasQuery = state.query.length > 0;
  const rows = hasQuery ? searchRows(state.query).slice(0, 10) : popularRows(state.popularSex, 4);
  $("#exploreListTitle").textContent = hasQuery ? "Søkeresultater" : "Populære navn";
  $("#popularSexToggle").hidden = hasQuery;
  $("#openCandidateList").textContent = hasQuery ? "Filtrer" : "Se alle";
  if (!rows.length) {
    list.innerHTML = `<p class="mutedEmpty">Ingen navn matcher søket. Bruk Søk og filtre for mønstersøk.</p>`;
    return;
  }
  list.replaceChildren(...rows.map((item, index) => nameRow(item, { rank: index + 1, detail: true })));
}

function setPopularSex(sex) {
  state.popularSex = sex;
  renderExplore();
}

function searchRows(query) {
  const q = normalize(query);
  if (!q) return [];
  return state.data.names
    .filter((item) => state.filters.sex === "alle" || item.sex === state.filters.sex)
    .filter((item) => !state.status[item.id] || state.status[item.id] !== "rejected")
    .filter((item) => normalize(item.name).includes(q))
    .sort((a, b) => latestCount(b) - latestCount(a) || a.name.localeCompare(b.name, "no"));
}

function popularRows(sex = "jente", limit = 10) {
  return state.data.names
    .filter((item) => item.sex === sex)
    .filter((item) => latestCount(item) > 0)
    .sort((a, b) => latestCount(b) - latestCount(a) || a.name.localeCompare(b.name, "no"))
    .slice(0, limit);
}

function renderRecentSearches() {
  const rail = $("#recentSearches");
  if (!rail) return;
  const fallback = ["Nora", "Alma", "Eli", "Oline"];
  rail.replaceChildren(...(state.recent.length ? state.recent : fallback).map((query) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = query;
    button.addEventListener("click", () => {
      state.query = query;
      $("#searchInput").value = query;
      renderExplore();
    });
    return button;
  }));
}

function rememberSearch(query) {
  if ((query.match(/[\p{L}\p{N}]/gu) || []).length < 2) return;
  state.recent = [query, ...state.recent.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(state.recent));
}

function nameRow(item, options = {}) {
  const row = document.createElement("article");
  row.className = "nameRow";
  row.innerHTML = `
    <span class="rank">${options.rank ?? ""}</span>
    <button class="nameMain" type="button">
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(item.sex)} · toppår ${item.peakYear}</small>
    </button>
    <span class="spark">${sparklineSvg(item)}</span>
    <span class="count">${formatNumber(latestCount(item))}</span>
    <button class="addButton ${state.selected.has(item.id) ? "active" : ""}" type="button" aria-label="Legg til ${escapeHtml(item.name)}">
      <svg><use href="#icon-plus"></use></svg>
    </button>
  `;
  $(".nameMain", row).addEventListener("click", () => openNameDetail(item));
  $(".addButton", row).addEventListener("click", (event) => {
    event.stopPropagation();
    addToWork(item);
  });
  return row;
}

function addToWork(item) {
  if (!item) return;
  state.selected.add(item.id);
  if (state.status[item.id] === "rejected") delete state.status[item.id];
  resetReviewDeck();
  saveWorkSelection();
  saveStatus();
  toast(`${item.name} lagt til i arbeidsutvalg`);
  renderAll();
  updateUrl();
}

function removeFromWork(id) {
  state.selected.delete(id);
  resetReviewDeck();
  saveWorkSelection();
  renderAll();
  updateUrl();
}

function applyNameStatus(id, status) {
  const item = state.itemsById.get(id);
  if (!item) return false;
  if (status === "neutral") {
    delete state.status[id];
    state.selected.add(id);
    state.history = state.history.filter((entry) => entry.id !== id);
    saveWorkSelection();
  } else {
    state.status[id] = status;
    if (status === "shortlist") state.selected.add(id);
    if (status === "rejected") state.selected.delete(id);
    saveWorkSelection();
    state.history.unshift({ id, status, at: new Date().toISOString() });
    state.history = state.history.filter((entry, index, arr) => index === arr.findIndex((other) => other.id === entry.id)).slice(0, 100);
  }
  saveStatus();
  return true;
}

function setNameStatus(id, status) {
  if (!applyNameStatus(id, status)) return;
  const item = state.itemsById.get(id);
  if (item) {
    const messages = {
      neutral: `${item.name} flyttet til arbeidsutvalg`,
      shortlist: `${item.name} markert som aktuell`,
      rejected: `${item.name} markert som uaktuell`,
    };
    toast(messages[status] || `${item.name} oppdatert`);
  }
  resetReviewDeck();
  renderAll();
  updateUrl();
}

function renderCompare() {
  $$("[data-metric]").forEach((button) => button.classList.toggle("active", button.dataset.metric === state.compare.metric));
  $("#compareYears").value = String(state.compare.fromYear);
  $("#compareSmooth").value = String(state.compare.smooth);
  $("#compareYearLabel").textContent = state.latestYear;
  const items = compareItems();
  renderCompareChips(items);
  renderCompareStats(items);
  renderChart(items);
}

function compareItems() {
  const selected = [...state.selected].map((id) => state.itemsById.get(id)).filter(Boolean);
  if (selected.length) return selected;
  return ["1NORA", "1EMMA", "1ALMA", "1ASTRID"].map((id) => state.itemsById.get(id)).filter(Boolean);
}

function renderCompareChips(items) {
  const rail = $("#compareChips");
  rail.replaceChildren(...items.map((item) => {
    const chip = document.createElement("span");
    chip.className = `nameChip removable ${item.sex}`;

    const open = document.createElement("button");
    open.type = "button";
    open.className = "nameChipName";
    open.textContent = item.name;
    open.setAttribute("aria-label", `Åpne detaljer for ${item.name}`);
    open.addEventListener("click", () => openNameDetail(item));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chipRemove";
    remove.innerHTML = '<svg aria-hidden="true"><use href="#icon-x"></use></svg>';
    remove.setAttribute("aria-label", `Fjern ${item.name} fra sammenligning`);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeFromWork(item.id);
      toast(`${item.name} fjernet fra sammenligning`);
    });

    chip.append(open, remove);
    return chip;
  }));
}

function renderChart(items) {
  const chart = $("#compareChart");
  if (!chart) return;
  const metric = effectiveMetric();
  chart.innerHTML = lineChartSvg(items, metric, state.compare.fromYear, state.latestYear, 344, 250);
  chart.dataset.traces = String(items.length);
  const legend = $("#compareLegend");
  legend.replaceChildren(...items.map((item, index) => {
    const label = document.createElement("span");
    label.innerHTML = `<i style="background:${chartColor(index, item)}"></i>${escapeHtml(item.name)}`;
    return label;
  }));
}

function renderCompareStats(items) {
  const table = $("#compareStats");
  table.replaceChildren(...items.map((item) => {
    const point = pointInYear(item, state.latestYear);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "statRow";
    row.innerHTML = `
      <span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.sex)}</small></span>
      <span>${formatNumber(point?.[1] ?? 0)}</span>
      <span>${point?.[2] ? formatNumber(point[2]) : "-"}</span>
      <span>${formatPercent(point?.[3])}</span>
      <span>${item.peakYear}</span>
    `;
    row.addEventListener("click", () => openNameDetail(item));
    return row;
  }));
}

function openNameDetail(item) {
  openSubscreen(item.name, detailMarkup(item), () => setNameStatus(item.id, "shortlist"));
  $("#subAction").innerHTML = '<svg><use href="#icon-heart"></use></svg>';
  requestAnimationFrame(() => renderMiniChart("detailChart", [item], "shareSex", 1900, 3));
}

function detailMarkup(item) {
  const latest = pointInYear(item, state.latestYear);
  return `
    <section class="detailHero">
      <div><h2>${escapeHtml(item.name)} <span class="${item.sex}">${sexSymbol(item)}</span></h2><p>${escapeHtml(item.sex)}</p></div>
      <button class="heartRound" data-status="${item.id}" data-next="shortlist" type="button"><svg><use href="#icon-heart"></use></svg></button>
    </section>
    <div class="subTabs"><button class="active">Oversikt</button><button>Statistikk</button><button>Skole</button><button data-similar="${item.id}">Lignende</button></div>
    <section class="subCard">
      <h3>Utvikling over tid</h3>
      <div id="detailChart" class="miniChart"></div>
      <div class="detailStats">
        <span><small>Antall (${state.latestYear})</small><b>${formatNumber(latest?.[1] ?? 0)}</b></span>
        <span><small>Rang (${state.latestYear})</small><b>${latest?.[2] ? formatNumber(latest[2]) : "-"}</b></span>
        <span><small>Andel</small><b>${formatPercent(latest?.[3])}</b></span>
      </div>
    </section>
    <section class="subCard gridStats">
      <span><small>Toppår</small><b>${item.peakYear}</b><em>${formatNumber(item.peakCount)} fødte</em></span>
      <span><small>Første år</small><b>${item.firstYear ?? item.firstDataYear}</b></span>
      <span><small>Siste år</small><b>${item.lastYear ?? item.lastDataYear}</b></span>
    </section>
    <section class="subCard schoolCard">
      <span><strong>Skolekontekst</strong><small>Estimat i relevant skoleløp</small></span>
      <b>${formatDecimal(schoolEstimate(item, state.latestYear, 100, 7), 2)}</b>
    </section>
    <button class="primaryWide" data-add="${item.id}" type="button">Legg til arbeidsutvalg</button>
    <button class="secondaryWide" data-similar="${item.id}" type="button">Finn lignende navn</button>
  `;
}

function openSimilar(item) {
  const rows = similarRows(item, "text").slice(0, 40);
  openSubscreen("Finn lignende navn", `
    <div class="similarHead">
      <span>Lignende navn: <b>${escapeHtml(item.name)}</b></span>
    </div>
    <div class="segmented subMode" aria-label="Likhetstype">
      <button class="active" type="button" data-sim-mode="text">Tekstlikhet</button>
      <button type="button" data-sim-mode="curve">Utvikling</button>
      <button type="button" data-sim-mode="popularity">Popularitet</button>
    </div>
    <div id="similarList" class="nameRows"></div>
  `);
  renderSimilarList(item, rows);
  $$("[data-sim-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      $$("[data-sim-mode]").forEach((b) => b.classList.toggle("active", b === button));
      renderSimilarList(item, similarRows(item, button.dataset.simMode).slice(0, 40));
    });
  });
}

function renderSimilarList(reference, rows) {
  const list = $("#similarList");
  if (!list) return;
  list.replaceChildren(...rows.map((row) => {
    const item = row.item;
    const element = nameRow(item);
    $(".rank", element).textContent = "";
    $(".count", element).textContent = `${formatDecimal(row.similarity * 100, 0)} %`;
    $(".nameMain small", element).textContent = `${row.reason}`;
    return element;
  }));
}

function openFilters() {
  openSubscreen("Søk og filtre", `
    <form id="filterForm" class="formStack">
      <label>Søk etter navn<input name="query" type="search" value="${escapeHtml(state.query)}" /></label>
      <label>Kjønn<select name="sex"><option value="alle">Alle</option><option value="jente">Jente</option><option value="gutt">Gutt</option></select></label>
      <label>Periode<div class="rangePair"><input name="fromYear" type="number" min="${state.firstYear}" max="${state.latestYear}" value="${state.filters.fromYear}" /><input name="toYear" type="number" min="${state.firstYear}" max="${state.latestYear}" value="${state.filters.toYear}" /></div></label>
      <label>Popularitet<select name="popularity"><option value="alle">Alle</option><option value="top50">Topp 50 i siste år</option><option value="rising">Stigende trend</option><option value="rare">Mindre vanlig nå</option></select></label>
      <label>Navnemønster<input name="pattern" type="text" placeholder="f.eks. ^El eller a$" value="${escapeHtml(state.filters.pattern)}" /></label>
      <label>Forventet navnetetthet<input name="schoolMax" type="number" min="0" step="0.1" placeholder="Maks i skoleløp" value="${escapeHtml(state.filters.schoolMax)}" /></label>
      <button class="primaryWide" type="submit">Vis ${formatNumber(filteredRows().length)} navn</button>
    </form>
  `);
  $("#filterForm [name='sex']").value = state.filters.sex;
  $("#filterForm [name='popularity']").value = state.filters.popularity;
  $("#filterForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.query = String(form.get("query") || "").trim();
    state.filters.sex = String(form.get("sex"));
    state.filters.fromYear = clampYear(Number(form.get("fromYear")));
    state.filters.toYear = clampYear(Number(form.get("toYear")));
    state.filters.popularity = String(form.get("popularity"));
    state.filters.pattern = String(form.get("pattern") || "").trim();
    state.filters.schoolMax = String(form.get("schoolMax") || "").trim();
    $("#searchInput").value = state.query;
    closeSubscreen();
    renderExplore();
  });
}

function openCandidateBuilder() {
  const rows = filteredRows().slice(0, 248);
  state.candidateRows = rows;
  openSubscreen("Kandidatliste", `
    <section class="subCard candidateSummary">
      <strong>${formatNumber(rows.length)} navn</strong>
      <small>${state.filters.sex === "alle" ? "Jenter og gutter" : state.filters.sex} · ${state.filters.fromYear}-${state.filters.toYear}</small>
    </section>
    <div id="candidateList" class="nameRows"></div>
    <button class="primaryWide" id="addAllCandidates" type="button">Legg til alle (${formatNumber(rows.length)})</button>
  `);
  $("#candidateList").replaceChildren(...rows.slice(0, 80).map((item) => nameRow(item)));
  $("#addAllCandidates").addEventListener("click", () => {
    rows.forEach((item) => state.selected.add(item.id));
    resetReviewDeck();
    saveWorkSelection();
    toast(`${formatNumber(rows.length)} navn lagt til`);
    closeSubscreen();
    renderAll();
    updateUrl();
  });
}

function openCompareSettings() {
  openSubscreen("Innstillinger", `
    <form id="compareSettingsForm" class="formStack">
      <label>Tidsperiode<input name="fromYear" type="range" min="${state.firstYear}" max="${state.latestYear}" value="${state.compare.fromYear}" /></label>
      <label>Mål<select name="metric"><option value="count">Antall</option><option value="shareSex">Andel (%)</option><option value="rank">Rang</option><option value="index">Indeks</option></select></label>
      <label>Glatting<input name="smooth" type="range" min="1" max="10" value="${state.compare.smooth}" /></label>
      <button class="primaryWide" type="submit">Oppdater</button>
    </form>
  `);
  $("#compareSettingsForm [name='metric']").value = state.compare.metric;
  $("#compareSettingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.compare.fromYear = clampYear(Number(form.get("fromYear")));
    state.compare.metric = String(form.get("metric"));
    state.compare.smooth = Number(form.get("smooth"));
    closeSubscreen();
    renderCompare();
    updateUrl();
  });
}

function openCompareTable() {
  const years = [1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2024, state.latestYear].filter((year, index, arr) => state.years.includes(year) && arr.indexOf(year) === index);
  const items = compareItems();
  openSubscreen("Tabellvisning", `
    <div class="tableScroller">
      <table class="dataTable">
        <thead><tr><th>År</th>${items.map((item) => `<th>${escapeHtml(item.name)}</th>`).join("")}</tr></thead>
        <tbody>${years.map((year) => `<tr><td>${year}</td>${items.map((item) => `<td>${formatNumber(pointInYear(item, year)?.[1] ?? 0)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `);
}

function renderReview() {
  ensureReviewDeck();
  const item = currentReviewItem();
  $("#reviewBack").hidden = !state.review.undo.length;
  $("#reviewUndo").hidden = !state.review.undo.length;
  $("#reviewCounter").textContent = state.review.deck.length ? `${Math.min(state.review.index + 1, state.review.deck.length)} av ${state.review.deck.length}` : "0 av 0";
  const card = $("#reviewCard");
  resetReviewSwipe(card);
  if (!item) {
    card.innerHTML = `<div class="emptyState"><h2>Ingen navn å vurdere</h2><p>Legg navn i arbeidsutvalget fra Utforsk eller Mine navn.</p></div>`;
    return;
  }
  const latest = pointInYear(item, state.latestYear);
  card.innerHTML = `
    <button class="heartRound" data-status="${item.id}" data-next="shortlist" type="button"><svg><use href="#icon-heart"></use></svg></button>
    <p class="cardMeta">${state.review.index + 1} av ${state.review.deck.length}</p>
    <h2>${escapeHtml(item.name)} <span class="${item.sex}">${sexSymbol(item)}</span></h2>
    <span class="trendPill">${trendLabel(item)}</span>
    <div class="reviewSpark">${sparklineSvg(item, 420, 120)}</div>
    <div class="reviewStats">
      <span><small>Antall</small><b>${formatNumber(latest?.[1] ?? 0)}</b><em>${item.sex}r i ${state.latestYear}</em></span>
      <span><small>Rang</small><b>${latest?.[2] ? formatNumber(latest[2]) : "-"}</b><em>i ${state.latestYear}</em></span>
      <span><small>Andel</small><b>${formatPercent(latest?.[3])}</b><em>av ${item.sex}r</em></span>
      <span><small>Toppår</small><b>${item.peakYear}</b><em>${formatNumber(item.peakCount)} fødte</em></span>
    </div>
    <section class="schoolCard"><span><strong>Skolekontekst</strong><small>Estimat i relevant skoleløp</small></span><b>${formatDecimal(schoolEstimate(item, state.latestYear, 100, 7), 2)}</b></section>
  `;
  bindSubscreenButtons(card);
}

const reviewSwipe = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
};

function bindReviewSwipe() {
  const card = $("#reviewCard");
  if (!card) return;
  card.addEventListener("pointerdown", startReviewSwipe);
  card.addEventListener("pointermove", moveReviewSwipe);
  card.addEventListener("pointerup", endReviewSwipe);
  card.addEventListener("pointercancel", cancelReviewSwipe);
}

function startReviewSwipe(event) {
  const card = event.currentTarget;
  if (!currentReviewItem() || event.target.closest("button")) return;
  reviewSwipe.active = true;
  reviewSwipe.pointerId = event.pointerId;
  reviewSwipe.startX = event.clientX;
  reviewSwipe.startY = event.clientY;
  reviewSwipe.dx = 0;
  reviewSwipe.dy = 0;
  card.setPointerCapture?.(event.pointerId);
  card.classList.add("is-swiping");
}

function moveReviewSwipe(event) {
  if (!reviewSwipe.active || event.pointerId !== reviewSwipe.pointerId) return;
  const card = event.currentTarget;
  reviewSwipe.dx = event.clientX - reviewSwipe.startX;
  reviewSwipe.dy = event.clientY - reviewSwipe.startY;
  const x = Math.max(-96, Math.min(96, reviewSwipe.dx));
  card.style.setProperty("--swipe-x", `${x}px`);
  card.style.setProperty("--swipe-rotate", `${x / 42}deg`);
  card.classList.toggle("swipe-right", reviewSwipe.dx > 32);
  card.classList.toggle("swipe-left", reviewSwipe.dx < -32);
}

function endReviewSwipe(event) {
  if (!reviewSwipe.active || event.pointerId !== reviewSwipe.pointerId) return;
  const card = event.currentTarget;
  const horizontal = Math.abs(reviewSwipe.dx) > 76 && Math.abs(reviewSwipe.dx) > Math.abs(reviewSwipe.dy) * 1.25;
  const status = reviewSwipe.dx > 0 ? "shortlist" : "rejected";
  cancelReviewSwipe(event);
  if (horizontal) decideCurrent(status);
}

function cancelReviewSwipe(event) {
  const card = event.currentTarget ?? $("#reviewCard");
  if (card && reviewSwipe.pointerId !== null) card.releasePointerCapture?.(reviewSwipe.pointerId);
  resetReviewSwipe(card);
}

function resetReviewSwipe(card = $("#reviewCard")) {
  reviewSwipe.active = false;
  reviewSwipe.pointerId = null;
  reviewSwipe.dx = 0;
  reviewSwipe.dy = 0;
  if (!card) return;
  card.classList.remove("is-swiping", "swipe-right", "swipe-left");
  card.style.removeProperty("--swipe-x");
  card.style.removeProperty("--swipe-rotate");
}

function ensureReviewDeck() {
  if (state.review.deck.length && state.review.index < state.review.deck.length) return;
  const work = [...state.selected].map((id) => state.itemsById.get(id)).filter((item) => item && !state.status[item.id]);
  const fallback = state.data ? popularRows("jente", 40).concat(popularRows("gutt", 40)).filter((item) => !state.status[item.id]) : [];
  state.review.deck = (work.length ? work : fallback).map((item) => item.id);
  state.review.index = 0;
}

function currentReviewItem() {
  return state.itemsById.get(state.review.deck[state.review.index]) ?? null;
}

function resetReviewDeck() {
  state.review.deck = [];
  state.review.index = 0;
}

function decideCurrent(status) {
  const item = currentReviewItem();
  if (!item) return;
  state.review.undo.unshift({ id: item.id, previous: state.status[item.id] ?? "neutral", wasSelected: state.selected.has(item.id), index: state.review.index });
  applyNameStatus(item.id, status);
  state.review.index += 1;
  ensureReviewDeck();
  renderReview();
  renderMine();
  renderCompare();
  updateUrl();
}

function skipCurrent() {
  state.review.index += 1;
  ensureReviewDeck();
  renderReview();
}

function undoDecision() {
  const last = state.review.undo.shift();
  if (!last) return;
  if (last.previous === "neutral") delete state.status[last.id];
  else state.status[last.id] = last.previous;
  if (last.wasSelected) state.selected.add(last.id);
  else state.selected.delete(last.id);
  const work = [...state.selected].filter((id) => id !== last.id && !state.status[id]);
  state.review.deck = [last.id, ...work];
  state.review.index = 0;
  saveWorkSelection();
  saveStatus();
  renderAll();
}

function renderMine() {
  const work = [...state.selected].map((id) => state.itemsById.get(id)).filter(Boolean);
  const shortlist = itemsWithStatus("shortlist");
  const rejected = itemsWithStatus("rejected");
  $("#workCount").textContent = `${formatNumber(work.length)} navn`;
  $("#shortlistCount").textContent = `${formatNumber(shortlist.length)} navn`;
  $("#rejectedCount").textContent = `${formatNumber(rejected.length)} navn`;
  const recent = $("#recentDecisions");
  recent.replaceChildren(...state.history.slice(0, 6).map((entry) => decisionRow(entry)));
  if (!state.history.length) recent.innerHTML = `<p class="mutedEmpty">Ingen vurderinger ennå.</p>`;
}

function decisionRow(entry) {
  const item = state.itemsById.get(entry.id);
  const row = document.createElement("button");
  row.type = "button";
  row.className = "decisionRow";
  row.innerHTML = `
    <span class="miniIcon ${entry.status === "shortlist" ? "green" : "red"}"><svg><use href="#icon-${entry.status === "shortlist" ? "heart" : "x"}"></use></svg></span>
    <span><strong>${escapeHtml(item?.name ?? "Ukjent")}</strong><small>${entry.status === "shortlist" ? "Aktuelt" : "Uaktuelt"}</small></span>
    <em>${entry.status === "shortlist" ? "Aktuelt" : "Uaktuelt"}</em>
  `;
  if (item) row.addEventListener("click", () => openNameDetail(item));
  return row;
}

function openNameList(kind) {
  const title = kind === "work" ? "Arbeidsutvalg" : kind === "shortlist" ? "Aktuelle" : "Uaktuelle";
  const rows = kind === "work" ? [...state.selected].map((id) => state.itemsById.get(id)).filter(Boolean) : itemsWithStatus(kind);
  openSubscreen(title, `
    <p class="subLead">${kind === "work" ? "Navn som ikke er endelig vurdert ennå." : kind === "shortlist" ? "Navn som er markert som aktuelle." : "Navn som er valgt bort."}</p>
    <div class="sectionRow"><h3>${formatNumber(rows.length)} navn</h3><button id="listPrimaryAction" type="button">${kind === "work" ? "Sammenlign" : "Del liste"}</button></div>
    <div id="mineListRows" class="nameRows"></div>
  `);
  $("#mineListRows").replaceChildren(...rows.map((item) => listManageRow(item, kind)));
  $("#listPrimaryAction").addEventListener("click", () => {
    if (kind === "work") {
      closeSubscreen();
      setTab("compare");
    } else {
      copyShareLink();
    }
  });
}

function listManageRow(item, kind) {
  const row = nameRow(item);
  $(".addButton", row).remove();
  const menu = document.createElement("button");
  menu.type = "button";
  menu.className = "moreButton";
  menu.textContent = "⋯";
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    openSubscreen(item.name, `
      <div class="listMenu">
        <button data-status="${item.id}" data-next="neutral" data-close-after="true" type="button"><span class="miniIcon blue"><svg><use href="#icon-list"></use></svg></span><span><strong>Sett som ikke vurdert</strong><small>Flytt til arbeidsutvalg uten aktuell/uaktuell-status</small></span><em>›</em></button>
        <button data-status="${item.id}" data-next="shortlist" data-close-after="true" type="button"><span class="miniIcon green"><svg><use href="#icon-heart"></use></svg></span><span><strong>Marker aktuell</strong><small>Flytt til favoritter</small></span><em>›</em></button>
        <button data-status="${item.id}" data-next="rejected" data-close-after="true" type="button"><span class="miniIcon red"><svg><use href="#icon-x"></use></svg></span><span><strong>Marker uaktuell</strong><small>Skjul fra vanlige forslag</small></span><em>›</em></button>
        <button data-remove="${item.id}" data-close-after="true" type="button"><span class="miniIcon"><svg><use href="#icon-x"></use></svg></span><span><strong>Fjern fra arbeidsutvalg</strong><small>Påvirker ikke vurderingen</small></span><em>›</em></button>
      </div>
    `);
    bindSubscreenButtons();
  });
  row.append(menu);
  return row;
}

function openHistory() {
  openSubscreen("Vurderingshistorikk", `<div class="decisionRows">${state.history.map((entry) => decisionRow(entry).outerHTML).join("") || '<p class="mutedEmpty">Ingen vurderinger ennå.</p>'}</div>`);
}

function openBackup() {
  openSubscreen("Sikkerhetskopi", `
    <div class="listMenu">
      <button id="exportJson" type="button"><span class="miniIcon blue"><svg><use href="#icon-share"></use></svg></span><span><strong>Eksporter beslutninger</strong><small>JSON-fil for import senere</small></span><em>›</em></button>
      <button id="exportStatusCsv" type="button"><span class="miniIcon green"><svg><use href="#icon-list"></use></svg></span><span><strong>Eksporter CSV</strong><small>Aktuelle og uaktuelle navn</small></span><em>›</em></button>
      <button id="importJson" type="button"><span class="miniIcon yellow"><svg><use href="#icon-gear"></use></svg></span><span><strong>Importer beslutninger</strong><small>Slår sammen med lokale valg</small></span><em>›</em></button>
    </div>
  `);
  $("#exportJson").addEventListener("click", exportDecisionsJson);
  $("#exportStatusCsv").addEventListener("click", exportDecisionsCsv);
  $("#importJson").addEventListener("click", () => $("#importInput").click());
}

function openSubscreen(title, html, action) {
  $("#subTitle").textContent = title;
  $("#subContent").innerHTML = html;
  $("#subscreen").classList.add("open");
  $("#subscreen").setAttribute("aria-hidden", "false");
  $("#subAction").onclick = action || null;
  $("#subAction").hidden = !action;
  if (!action) $("#subAction").replaceChildren();
  bindSubscreenButtons();
}

function closeSubscreen(render = true) {
  $("#subscreen")?.classList.remove("open");
  $("#subscreen")?.setAttribute("aria-hidden", "true");
  if (render) renderAll();
}

function bindSubscreenButtons(root = document) {
  $$("[data-add]", root).forEach((button) => button.addEventListener("click", () => addToWork(state.itemsById.get(button.dataset.add))));
  $$("[data-status]", root).forEach((button) => button.addEventListener("click", () => {
    setNameStatus(button.dataset.status, button.dataset.next);
    if (button.dataset.closeAfter === "true") closeSubscreen();
  }));
  $$("[data-remove]", root).forEach((button) => button.addEventListener("click", () => {
    removeFromWork(button.dataset.remove);
    if (button.dataset.closeAfter === "true") closeSubscreen();
  }));
  $$("[data-similar]", root).forEach((button) => button.addEventListener("click", () => openSimilar(state.itemsById.get(button.dataset.similar))));
}

function filteredRows() {
  let rows = state.query ? searchRows(state.query) : state.data.names.slice();
  if (state.filters.pattern) {
    try {
      const regex = new RegExp(state.filters.pattern, "i");
      rows = rows.filter((item) => regex.test(item.name));
    } catch {
      rows = [];
    }
  }
  if (state.filters.sex !== "alle") rows = rows.filter((item) => item.sex === state.filters.sex);
  if (state.filters.popularity === "top50") rows = rows.filter((item) => (pointInYear(item, state.latestYear)?.[2] ?? 9999) <= 50);
  if (state.filters.popularity === "rising") rows = rows.filter((item) => trendScore(item) > 0);
  if (state.filters.popularity === "rare") rows = rows.filter((item) => latestCount(item) < 25);
  if (state.filters.schoolMax !== "") rows = rows.filter((item) => schoolEstimate(item, state.latestYear, 100, 7) <= Number(state.filters.schoolMax));
  return rows.sort((a, b) => latestCount(b) - latestCount(a) || a.name.localeCompare(b.name, "no"));
}

function similarRows(reference, mode) {
  return state.data.names
    .filter((item) => item.id !== reference.id && item.sex === reference.sex && state.status[item.id] !== "rejected")
    .map((item) => {
      if (mode === "text") {
        const distance = levenshtein(normalize(reference.name), normalize(item.name));
        return { item, similarity: 1 / (1 + distance), reason: "tekstlikhet" };
      }
      if (mode === "popularity") {
        const rankDiff = Math.abs((pointInYear(reference, state.latestYear)?.[2] ?? 999) - (pointInYear(item, state.latestYear)?.[2] ?? 999));
        const peakDiff = Math.abs(reference.peakCount - item.peakCount);
        return { item, similarity: 1 / (1 + rankDiff / 15 + peakDiff / 500), reason: "lik popularitet" };
      }
      const similarity = curveSimilarity(reference, item);
      return { item, similarity, reason: "lignende kurve" };
    })
    .filter((row) => Number.isFinite(row.similarity))
    .sort((a, b) => b.similarity - a.similarity || a.item.name.localeCompare(b.item.name, "no"));
}

function curveSimilarity(a, b) {
  const left = allPoints(a).filter((p) => p.year >= 1900).map((p) => p.shareSex ?? 0);
  const right = allPoints(b).filter((p) => p.year >= 1900).map((p) => p.shareSex ?? 0);
  const n = Math.min(left.length, right.length);
  if (n < 3) return 0;
  return Math.max(0, Math.min(1, (pearson(zScore(left.slice(-n)), zScore(right.slice(-n))) + 1) / 2));
}

function lineChartSvg(items, metric, fromYear, toYear, width, height, options = {}) {
  const pad = options.compact ? { top: 10, right: 8, bottom: 24, left: 34 } : { top: 14, right: 12, bottom: 34, left: 44 };
  const series = items.map((item) => {
    const points = allPoints(item)
      .filter((point) => point.year >= fromYear && point.year <= toYear)
      .map((point) => ({ year: point.year, value: metricValue(point, item, metric) }));
    const values = smooth(points.map((point) => point.value), state.compare.smooth);
    return { item, points: points.map((point, index) => ({ year: point.year, value: values[index] })).filter((point) => point.value != null && Number.isFinite(point.value)) };
  });
  const values = series.flatMap((line) => line.points.map((point) => point.value));
  if (!values.length) {
    return `<svg class="lineChart" viewBox="0 0 ${width} ${height}" role="img"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#7a8494" font-size="13">Ingen grafdata</text></svg>`;
  }
  let minY = metric === "rank" ? Math.min(...values) : Math.min(0, Math.min(...values));
  let maxY = Math.max(...values);
  if (metric === "rank") {
    minY = Math.min(...values);
    maxY = Math.max(...values);
  }
  if (maxY === minY) maxY += 1;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (year) => pad.left + ((year - fromYear) / Math.max(1, toYear - fromYear)) * plotW;
  const y = (value) => {
    const normalized = (value - minY) / (maxY - minY);
    return metric === "rank" ? pad.top + normalized * plotH : pad.top + (1 - normalized) * plotH;
  };
  const ticks = [fromYear, Math.round((fromYear + toYear) / 2), toYear];
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const yy = pad.top + t * plotH;
      return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#edf0f4" stroke-width="1"/>`;
    })
    .join("");
  const xTicks = ticks
    .map((year, index) => {
      const anchor = index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle";
      return `<text x="${x(year).toFixed(1)}" y="${height - 9}" text-anchor="${anchor}" fill="#6f7888" font-size="10">${year}</text>`;
    })
    .join("");
  const yTop = metric === "rank" ? minY : maxY;
  const yBottom = metric === "rank" ? maxY : minY;
  const yLabels = `
    <text x="${pad.left - 8}" y="${pad.top + 4}" text-anchor="end" fill="#6f7888" font-size="10">${shortNumber(yTop)}</text>
    <text x="${pad.left - 8}" y="${pad.top + plotH}" text-anchor="end" fill="#6f7888" font-size="10">${shortNumber(yBottom)}</text>
  `;
  const lines = series
    .map((line, index) => {
      const points = line.points.map((point) => `${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
      return `<polyline class="chartLine" points="${points}" fill="none" stroke="${chartColor(index, line.item)}" stroke-width="${options.compact ? 3 : 3.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg class="lineChart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historisk navneutvikling">
    <rect width="${width}" height="${height}" rx="14" fill="#fff"/>
    ${grid}
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + plotH}" y2="${pad.top + plotH}" stroke="#d8dde5"/>
    ${xTicks}
    ${options.compact ? "" : yLabels}
    ${lines}
  </svg>`;
}

function chartColor(index, item) {
  const palette = ["#ef5d93", "#2e7bcf", "#4aa36f", "#8b68d9", "#e59b3c", "#42a6a1"];
  if (item?.sex === "gutt" && index === 0) return "#2e7bcf";
  if (item?.sex === "jente" && index === 0) return "#ef5d93";
  return palette[index % palette.length];
}

function shortNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${formatDecimal(value / 1000, 1)}k`;
  if (abs < 10 && abs !== Math.round(abs)) return formatDecimal(value, 1);
  return formatNumber(Math.round(value));
}

function allPoints(item) {
  return item.series.map(([yearIndex, count, rank, shareSex]) => {
    const year = state.years[yearIndex];
    const total = state.data.totalBirths[yearIndex];
    return {
      year,
      count,
      rank,
      shareSex,
      shareAll: total && count != null ? (count / total) * 100 : null,
    };
  });
}

function pointInYear(item, year) {
  const index = state.years.indexOf(year);
  if (index < 0) return null;
  return item.series.find(([yearIndex]) => yearIndex === index) ?? null;
}

function latestCount(item) {
  return pointInYear(item, state.latestYear)?.[1] ?? 0;
}

function effectiveMetric() {
  return state.compare.metric === "count" && state.compare.fromYear < 1945 ? "shareSex" : state.compare.metric;
}

function metricValue(point, item, metric) {
  if (metric === "shareSex") return point.shareSex;
  if (metric === "rank") return point.rank;
  if (metric === "index") {
    const base = allPoints(item).find((p) => p.year >= state.compare.fromYear && p.count)?.count;
    return base && point.count != null ? (point.count / base) * 100 : null;
  }
  return point.count;
}

function yAxis(metric) {
  const title = { count: "Antall", shareSex: "Andel (%)", rank: "Rang", index: "Indeks" }[metric] || "Antall";
  const axis = { title, gridcolor: "#edf0f4", zeroline: false, rangemode: "tozero" };
  if (metric === "rank") axis.autorange = "reversed";
  return axis;
}

function smooth(values, width) {
  const size = Math.max(1, Math.round(width));
  if (size <= 1) return values;
  const radius = Math.floor(size / 2);
  return values.map((_, index) => {
    const windowValues = values.slice(Math.max(0, index - radius), index + radius + 1).filter((value) => value != null && Number.isFinite(value));
    return windowValues.length ? mean(windowValues) : null;
  });
}

function sparklineSvg(item, width = 118, height = 32) {
  const points = allPoints(item).filter((point) => point.year >= 1950);
  const values = points.map((point) => point.count ?? point.shareSex ?? 0);
  const max = Math.max(...values, 1);
  const coords = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - (value / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = item.sex === "jente" ? "#ef5d93" : "#2e7bcf";
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${coords.join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function trendScore(item) {
  const points = allPoints(item).filter((point) => point.year >= state.latestYear - 10);
  const first = points[0]?.count ?? 0;
  const last = points.at(-1)?.count ?? 0;
  return last - first;
}

function trendLabel(item) {
  const score = trendScore(item);
  if (score > 20) return "Stigende trend siste år";
  if (score < -20) return "Roligere utvikling siste år";
  return "Historisk utvikling tilgjengelig";
}

function schoolEstimate(item, birthYear, gradeSize, grades) {
  const point = pointInYear(item, birthYear);
  const share = point?.[3] ?? 0;
  return (share / 100) * gradeSize * grades;
}

function renderMiniChart(id, items, metric = "shareSex", fromYear = 1900, smoothWidth = 3) {
  const chart = document.getElementById(id);
  if (!chart) return;
  const originalSmooth = state.compare.smooth;
  state.compare.smooth = smoothWidth;
  chart.innerHTML = lineChartSvg(items, metric, fromYear, state.latestYear, 330, 170, { compact: true });
  state.compare.smooth = originalSmooth;
}

function itemsWithStatus(status) {
  return Object.entries(state.status)
    .filter(([, value]) => value === status)
    .map(([id]) => state.itemsById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "no"));
}

function copyShareLink() {
  updateUrl();
  navigator.clipboard?.writeText(location.href).then(() => toast("Lenke kopiert"));
}

function downloadCsv() {
  const items = compareItems();
  const rows = [["name", "sex", "year", "count", "rank", "share_same_sex_pct"]];
  items.forEach((item) => allPoints(item).filter((p) => p.year >= state.compare.fromYear).forEach((p) => rows.push([item.name, item.sex, p.year, p.count ?? "", p.rank ?? "", p.shareSex ?? ""])));
  downloadBlob("navnestatistikk.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function downloadChartSvg() {
  const chart = $("#compareChart svg");
  if (!chart) return;
  downloadBlob("navnestatistikk-graf.svg", chart.outerHTML, "image/svg+xml;charset=utf-8");
}

function exportDecisionsJson() {
  downloadBlob("navnestatistikk-navnevalg.json", JSON.stringify({ schema: "navnestatistikk-name-status", version: 1, exportedAt: new Date().toISOString(), decisions: state.status }, null, 2), "application/json;charset=utf-8");
}

function exportDecisionsCsv() {
  const rows = [["status", "name", "sex", "peak_year", "peak_count", "total"]];
  Object.entries(state.status).forEach(([id, status]) => {
    const item = state.itemsById.get(id);
    if (item) rows.push([status === "shortlist" ? "aktuell" : "uaktuell", item.name, item.sex, item.peakYear, item.peakCount, item.total]);
  });
  downloadBlob("navnestatistikk-navnevalg.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

async function importDecisions(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const payload = JSON.parse(await file.text());
  Object.entries(payload.decisions || {}).forEach(([id, value]) => {
    if (state.itemsById.has(id) && (value === "shortlist" || value === "rejected")) {
      state.status[id] = value;
      if (value === "shortlist") state.selected.add(id);
      if (value === "rejected") state.selected.delete(id);
    }
  });
  resetReviewDeck();
  saveWorkSelection();
  saveStatus();
  renderAll();
  toast("Beslutninger importert");
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([`${content}\n`], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function clampYear(year) {
  return Math.max(state.firstYear, Math.min(state.latestYear, Number.isFinite(year) ? year : state.latestYear));
}

function normalize(value) {
  return String(value).trim().toLocaleLowerCase("nb-NO");
}

function sexSymbol(item) {
  return item.sex === "jente" ? "♀" : "♂";
}

function formatNumber(value) {
  return value == null || Number.isNaN(Number(value)) ? "-" : nf.format(Number(value));
}

function formatPercent(value) {
  return value == null || Number.isNaN(Number(value)) ? "-" : `${formatDecimal(value, 2)} %`;
}

function formatDecimal(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? "-" : nf.format(Number(value.toFixed(digits)));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function zScore(values) {
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  const sd = Math.sqrt(variance) || 1;
  return values.map((value) => (value - avg) / sd);
}

function pearson(left, right) {
  const n = Math.min(left.length, right.length);
  if (n < 3) return 0;
  const a = left.slice(0, n);
  const b = right.slice(0, n);
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / (Math.sqrt(da * db) || 1);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1600);
}
