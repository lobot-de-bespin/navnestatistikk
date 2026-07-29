const STATUS_STORAGE_KEY = "navnestatistikk:nameStatus:v1";
const WORK_STORAGE_KEY = "navnestatistikk:workSelection:v2";
const HISTORY_STORAGE_KEY = "navnestatistikk:decisionHistory:v2";
const RECENT_STORAGE_KEY = "navnestatistikk:recentSearches:v2";
const SCHOOL_STORAGE_KEY = "navnestatistikk:schoolSettings:v1";
const SW_VERSION = "2026-07-29.1";
const MAX_COMPARE_ITEMS = 12;
let searchRuleCounter = 0;

const state = {
  data: null,
  years: [],
  latestYear: 2025,
  firstYear: 1880,
  itemsById: new Map(),
  selected: new Set(),
  hasUserSelection: false,
  status: {},
  history: [],
  recent: [],
  tab: "explore",
  popularSex: "jente",
  discoverySex: "alle",
  query: "",
  searchShowAll: false,
  searchFiltersOpen: false,
  filters: {
    rules: [],
  },
  compare: {
    metric: "count",
    fromYear: 1900,
    toYear: 2025,
    smooth: 3,
  },
  school: {
    gradeSize: 100,
    grades: 7,
    birthYear: 2025,
  },
  similarMode: "shareLevel",
  similarReferenceId: "",
  similarSex: "alle",
  showAdvancedSimilar: false,
  mineFilter: "all",
  review: {
    deck: [],
    index: 0,
    undo: [],
    swiping: false,
  },
  candidateRows: [],
  subscreenMode: "default",
  returnToSearch: false,
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
  if (state.query) requestAnimationFrame(openSearchView);
  lockPortraitOrientation();
  registerServiceWorker();
}

async function loadData() {
  const response = await fetch("assets/names-data.json");
  state.data = await response.json();
  state.years = state.data.years;
  state.firstYear = state.years[0];
  state.latestYear = state.years.at(-1);
  state.compare.fromYear = Math.max(1900, state.firstYear);
  state.compare.toYear = state.latestYear;
  state.school.birthYear = clampYear(state.school.birthYear || state.latestYear);
  state.itemsById = new Map(state.data.names.map((item) => [item.id, item]));
  state.selected = new Set([...state.selected].filter((id) => state.itemsById.has(id)));
  ["#openSearchView"].forEach((selector) => {
    const control = $(selector);
    if (control) control.disabled = false;
  });
  saveWorkSelection(false);
}

function bindChrome() {
  document.addEventListener("click", handleWorkflowNavigation);
  $$(".tabBar button").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });
  $("#openSearchView")?.addEventListener("click", openSearchView);
  $$("[data-global-sex]").forEach((button) => {
    button.addEventListener("click", () => {
      state.discoverySex = button.dataset.globalSex;
      renderExplore();
    });
  });
  $$("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.compare.metric = button.dataset.metric;
      renderCompare();
      updateUrl();
    });
  });
  $("#compareFromYear")?.addEventListener("change", (event) => setComparePeriod(Number(event.target.value), state.compare.toYear));
  $("#compareToYear")?.addEventListener("change", (event) => setComparePeriod(state.compare.fromYear, Number(event.target.value)));
  $("#compareSmooth")?.addEventListener("change", (event) => {
    state.compare.smooth = Number(event.target.value);
    renderCompare();
    updateUrl();
  });
  $("#compareRangeSummary")?.addEventListener("click", openCompareSettings);
  $("#shareCompare")?.addEventListener("click", copyShareLink);
  $("#downloadCsv")?.addEventListener("click", downloadCsv);
  $("#downloadPng")?.addEventListener("click", () => {
    downloadChartSvg();
  });
  $("#openCompareSettings")?.addEventListener("click", openCompareSettings);
  $("#openCompareTable")?.addEventListener("click", openCompareTable);
  $("#compareReview")?.addEventListener("click", () => setTab("review"));
  $("#reviewShortlist")?.addEventListener("click", () => commitReviewDecision("shortlist", 1));
  $("#reviewReject")?.addEventListener("click", () => commitReviewDecision("rejected", -1));
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
  $$("[data-mine-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mineFilter = button.dataset.mineFilter;
      renderMine();
    });
  });
  $("#subBack")?.addEventListener("click", closeSubscreen);
  $("#subscreen")?.addEventListener("click", (event) => {
    if (event.target.id === "subscreen") closeSubscreen();
  });
  $("#importInput")?.addEventListener("change", importDecisions);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    let refreshed = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshed) return;
      refreshed = true;
      location.reload();
    });
    navigator.serviceWorker
      .register(`sw.js?v=${encodeURIComponent(SW_VERSION)}`, { scope: "./" })
      .then((registration) => registration.update())
      .catch(() => {});
  }
}

function lockPortraitOrientation() {
  if (!screen.orientation?.lock) return;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!standalone) return;
  screen.orientation.lock("portrait").catch(() => {});
}

function loadLocalState() {
  try {
    const storedSelection = localStorage.getItem(WORK_STORAGE_KEY);
    state.hasUserSelection = storedSelection !== null;
    const selected = JSON.parse(storedSelection || "[]");
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
  try {
    const school = JSON.parse(localStorage.getItem(SCHOOL_STORAGE_KEY) || "{}") || {};
    state.school.gradeSize = Math.max(1, Number(school.gradeSize) || state.school.gradeSize);
    state.school.grades = Math.max(1, Number(school.grades) || state.school.grades);
    state.school.birthYear = Number(school.birthYear) || state.school.birthYear;
  } catch {
    state.school = { gradeSize: 100, grades: 7, birthYear: 2025 };
  }
}

function saveStatus() {
  localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(state.status));
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history.slice(0, 100)));
}

function saveWorkSelection(markUserSelection = true) {
  if (markUserSelection) state.hasUserSelection = true;
  localStorage.setItem(WORK_STORAGE_KEY, JSON.stringify([...state.selected]));
}

function saveSchoolSettings() {
  localStorage.setItem(SCHOOL_STORAGE_KEY, JSON.stringify(state.school));
}

function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has("q")) {
    state.query = params.get("q") || "";
    state.searchShowAll = true;
  }
  if (params.has("names")) {
    params
      .get("names")
      .split(",")
      .map((value) => findNameFromUrlToken(value))
      .filter(Boolean)
      .forEach((item) => state.selected.add(item.id));
    state.hasUserSelection = true;
    saveWorkSelection();
  }
  if (params.has("metric")) state.compare.metric = params.get("metric");
  if (params.has("from")) state.compare.fromYear = clampYear(Number(params.get("from")));
  if (params.has("to")) state.compare.toYear = clampYear(Number(params.get("to")));
  if (params.has("smooth")) state.compare.smooth = Math.max(1, Number(params.get("smooth")) || 3);
  normalizeComparePeriod();
}

function findNameFromUrlToken(value) {
  const token = String(value || "").trim();
  if (!token) return null;
  const direct = state.itemsById.get(token);
  if (direct) return direct;
  const normalized = normalize(token);
  return state.data.names.find((item) => normalize(item.name) === normalized) || null;
}

function updateUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.selected.size && state.selected.size <= 100) params.set("names", [...state.selected].join(","));
  if (state.selected.size > 100) params.set("selected", String(state.selected.size));
  params.set("metric", state.compare.metric);
  params.set("from", String(state.compare.fromYear));
  params.set("to", String(state.compare.toYear));
  params.set("smooth", String(state.compare.smooth));
  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
}

function setTab(tab) {
  state.tab = tab;
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.view === tab));
  $$(".tabBar button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  state.returnToSearch = false;
  state.subscreenMode = "default";
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
  renderWorkflowCards();
  renderExplore();
  renderCompare();
  renderReview();
  renderMine();
}

function workflowCounts() {
  return {
    work: workItems().length,
    shortlist: itemsWithStatus("shortlist").length,
    rejected: itemsWithStatus("rejected").length,
  };
}

function workflowSummaryMarkup(counts) {
  return `
    <div class="workflowCounts" aria-label="Status">
      <span><b>${formatNumber(counts.work)}</b><small>Valgt</small></span>
      <span><b>${formatNumber(counts.shortlist)}</b><small>Akt.</small></span>
      <span><b>${formatNumber(counts.rejected)}</b><small>Ute</small></span>
    </div>
  `;
}

function workflowPathMarkup(active) {
  const steps = [
    ["explore", "Oppdag", "Start bredt"],
    ["compare", "Sammenlign", "Se mønstre"],
    ["review", "Vurder", "Velg shortlist"],
  ];
  return `
    <div class="workflowPath" aria-label="Arbeidsflyt">
      ${steps
        .map(
          ([tab, label, detail], index) => `
            <button class="${tab === active ? "active" : ""}" data-go-tab="${tab}" type="button">
              <b>${index + 1}</b><span><strong>${label}</strong><small>${detail}</small></span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWorkflowCards() {
  const counts = workflowCounts();
  const explore = $("#exploreWorkflow");
  if (explore) {
    explore.hidden = false;
    explore.innerHTML = workflowPathMarkup("explore");
  }
  const compare = $("#compareWorkflow");
  if (compare) {
    compare.innerHTML = counts.work
      ? `${workflowPathMarkup("compare")}${workflowSummaryMarkup(counts)}<button class="workflowCta" data-go-tab="review" type="button">Vurder valgte</button>`
      : `${workflowPathMarkup("compare")}<section class="taskPrompt"><strong>Legg inn navn først</strong><small>Søk etter et navn, eller bruk forslagene for å fylle utvalget.</small><button data-go-tab="explore" type="button">Oppdag navn</button></section>`;
  }
  const mine = $("#mineWorkflow");
  if (mine) {
    const next = nextMineStep(counts);
    mine.innerHTML = `${workflowSummaryMarkup(counts)}<button class="workflowCta" data-go-tab="${next.tab}" type="button">${next.label}</button>`;
  }
}

function handleWorkflowNavigation(event) {
  const quick = event.target.closest("[data-quick-name]");
  if (quick) {
    event.preventDefault();
    addQuickName(quick.dataset.quickName);
    return;
  }
  const preset = event.target.closest("[data-filter-preset]");
  if (preset) {
    event.preventDefault();
    applyExplorePreset(preset.dataset.filterPreset);
    return;
  }
  const focusSearch = event.target.closest("[data-focus-search]");
  if (focusSearch) {
    event.preventDefault();
    openSearchView();
    return;
  }
  const advancedSimilar = event.target.closest("[data-toggle-advanced-similar]");
  if (advancedSimilar) {
    event.preventDefault();
    state.showAdvancedSimilar = !state.showAdvancedSimilar;
    renderCompare();
    return;
  }
  const button = event.target.closest("[data-go-tab]");
  if (!button) return;
  event.preventDefault();
  setTab(button.dataset.goTab);
}

function nextMineStep(counts) {
  if (counts.work >= 2) return { tab: "compare", label: "Utforsk utvalg" };
  if (counts.work === 1) return { tab: "review", label: "Vurder navnet" };
  if (counts.shortlist) return { tab: "compare", label: "Utforsk aktuelle" };
  return { tab: "explore", label: "Oppdag navn" };
}

function renderExplore() {
  renderRecentSearches();
  renderExploreStarter();
  $$("[data-global-sex]").forEach((button) => button.classList.toggle("active", button.dataset.globalSex === state.discoverySex));
  const searchLabel = $("#homeSearchLabel");
  if (searchLabel) searchLabel.textContent = state.query ? `Søk videre etter «${state.query}»` : "Søk etter navn";
  renderDiscoverySections();
}

function renderExploreStarter() {
  const panel = $("#exploreStarter");
  if (!panel) return;
  const work = workItems().slice(0, 3);
  if (work.length) {
    panel.hidden = false;
    panel.innerHTML = `
      <div class="heroArt chart" aria-hidden="true"></div>
      <div class="lensCopy">
        <small>Utvalget</small>
        <strong>${formatNumber(workItems().length)} navn å kjenne på</strong>
        <span>${work.map((item) => escapeHtml(item.name)).join(", ")}${workItems().length > work.length ? " ..." : ""}</span>
      </div>
      <div class="selectedNameRail">
        ${work.map((item) => `<span class="${item.sex}">${escapeHtml(item.name)}</span>`).join("")}
      </div>
      <div class="lensActions">
        <button data-go-tab="compare" type="button">Sammenlign</button>
        <button data-go-tab="review" type="button">Vurder</button>
      </div>
    `;
    return;
  }
  panel.hidden = true;
  panel.replaceChildren();
}

function hasActiveSearchFilters() {
  return Boolean(state.query || state.filters.rules.length);
}

function addCandidateRowsToWork(rows, startReview = false) {
  if (!rows.length) {
    toast("Ingen treff å legge til");
    return;
  }
  rows.forEach((item) => {
    if (state.status[item.id] === "rejected") delete state.status[item.id];
  });
  rows.forEach((item) => state.selected.add(item.id));
  resetReviewDeck();
  saveWorkSelection();
  saveStatus();
  toast(`${formatNumber(rows.length)} navn lagt til i utvalget`);
  closeSubscreen();
  renderAll();
  updateUrl();
  if (startReview) setTab("review");
}

function setPopularSex(sex) {
  state.popularSex = sex;
  renderExplore();
}

function applyExplorePreset(preset) {
  state.query = "";
  state.filters.rules = [];
  if (preset === "popular") state.filters.rules.push(createSearchRule("latestRank", { op: "lte", value: "50" }));
  if (preset === "rising") state.filters.rules.push(createSearchRule("trend", { op: "gte", value: "1" }));
  if (preset === "rare") state.filters.rules.push(createSearchRule("latestCount", { op: "lte", value: "24" }));
  if (preset === "school") state.filters.rules.push(createSearchRule("school", { op: "lte", value: "2" }));
  state.searchShowAll = true;
  state.searchFiltersOpen = state.filters.rules.length > 0;
  openSearchView();
  updateUrl();
}

function searchRows(query) {
  const q = normalize(query);
  if (!q) return [];
  return state.data.names
    .filter((item) => !state.status[item.id] || state.status[item.id] !== "rejected")
    .filter((item) => normalize(item.name).includes(q))
    .sort((a, b) => {
      const aName = normalize(a.name);
      const bName = normalize(b.name);
      return (
        Number(bName === q) - Number(aName === q) ||
        Number(bName.startsWith(q)) - Number(aName.startsWith(q)) ||
        (a.currentRank ?? 9999) - (b.currentRank ?? 9999) ||
        a.name.localeCompare(b.name, "no")
      );
    });
}

function popularRows(sex = "jente", limit = 10) {
  return state.data.names
    .filter((item) => item.sex === sex)
    .filter((item) => latestCount(item) > 0)
    .sort((a, b) => latestCount(b) - latestCount(a) || a.name.localeCompare(b.name, "no"))
    .slice(0, limit);
}

function discoveryBaseRows() {
  let rows = state.data.names.filter((item) => state.status[item.id] !== "rejected");
  if (state.discoverySex !== "alle") rows = rows.filter((item) => item.sex === state.discoverySex);
  return rows;
}

function discoveryCollections() {
  const base = discoveryBaseRows();
  const birth = base.filter(hasHistory).filter((item) => latestCount(item) > 0);
  const collections = [
    {
      id: "popular",
      title: "Populære nå",
      subtitle: `Flest nyfødte i ${state.latestYear}`,
      rows: birth.slice().sort((a, b) => latestCount(b) - latestCount(a) || a.name.localeCompare(b.name, "no")),
      metric: (item) => `${formatNumber(latestCount(item))} nyfødte`,
    },
    {
      id: "rising",
      title: "På vei opp",
      subtitle: "Størst økning det siste tiåret",
      rows: birth.filter((item) => trendScore(item) > 0).sort((a, b) => trendScore(b) - trendScore(a) || latestCount(b) - latestCount(a)),
      metric: (item) => `${signedNumber(trendScore(item))} på ti år`,
    },
    {
      id: "distinctive",
      title: "Særpreg, fortsatt i bruk",
      subtitle: "Færre velger dem, men de brukes nå",
      rows: birth.filter((item) => latestCount(item) >= 4 && latestCount(item) < 25).sort((a, b) => latestCount(b) - latestCount(a) || a.name.localeCompare(b.name, "no")),
      metric: (item) => `${formatNumber(latestCount(item))} nyfødte`,
    },
    {
      id: "school",
      title: "Få navnebrødre på skolen",
      subtitle: `Anslag for ${formatNumber(state.school.gradeSize)} elever per trinn`,
      rows: birth
        .map((item) => ({ item, estimate: schoolEstimateForCurrentSettings(item).school }))
        .filter((row) => row.estimate > 0 && row.estimate <= 2)
        .sort((a, b) => b.item.currentRank - a.item.currentRank || b.estimate - a.estimate)
        .map((row) => row.item),
      metric: (item) => `${formatDecimal(schoolEstimateForCurrentSettings(item).school, 1)} i skoleløpet`,
    },
  ];
  const meanings = base.filter((item) => hasCapability(item, "meaning"));
  if (meanings.length) {
    collections.push({
      id: "meaning",
      title: "Med dokumentert betydning",
      subtitle: "Språkdata med kilde på opplysningen",
      rows: meanings,
      metric: () => "Betydning tilgjengelig",
    });
  }
  return collections.filter((section) => section.rows.length);
}

function renderDiscoverySections() {
  const root = $("#discoverySections");
  if (!root) return;
  const collections = discoveryCollections();
  if (!collections.length) {
    root.innerHTML = `
      <div class="emptyState compact">
        <p>Ingen forslag har denne datadekningen og navnetypen ennå.</p>
        <div class="emptyActions"><button id="resetDiscoveryFilters" type="button">Vis alle navn</button></div>
      </div>
    `;
    $("#resetDiscoveryFilters")?.addEventListener("click", () => {
      state.discoverySex = "alle";
      renderExplore();
    });
    return;
  }
  root.replaceChildren(...collections.map((section) => discoverySection(section)));
}

function discoverySection(section) {
  const container = document.createElement("section");
  container.className = `discoverySection discovery-${section.id}`;
  container.innerHTML = `
    <div class="discoverySectionHead">
      <span><h3>${escapeHtml(section.title)}</h3><small>${escapeHtml(section.subtitle)}</small></span>
      <button type="button">Se alle <span>${formatNumber(section.rows.length)}</span></button>
    </div>
    <div class="discoveryRail"></div>
  `;
  $("button", container).addEventListener("click", () => openCandidateBuilder(section.rows, section.title, section.subtitle));
  $(".discoveryRail", container).replaceChildren(...section.rows.slice(0, 8).map((item) => discoveryNameCard(item, section.metric(item))));
  return container;
}

function discoveryNameCard(item, metric) {
  const selected = state.selected.has(item.id);
  const card = document.createElement("article");
  card.className = `discoveryNameCard ${item.sex} ${selected ? "selected" : ""}`;
  card.innerHTML = `
    <button class="discoveryNameMain" type="button">
      <span class="discoverySex">${sexIconMarkup(item)}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(metric)}</small>
      <span class="discoveryMiniChart">${hasHistory(item) ? sparklineSvg(item, 118, 34) : ""}</span>
    </button>
    <button class="discoveryAdd ${selected ? "active" : ""}" type="button" aria-label="${selected ? "Fjern" : "Legg til"} ${escapeHtml(item.name)}">
      <svg><use href="#icon-${selected ? "check" : "plus"}"></use></svg>
    </button>
  `;
  $(".discoveryNameMain", card).addEventListener("click", () => openNameDetail(item));
  $(".discoveryAdd", card).addEventListener("click", () => toggleWorkSelection(item));
  return card;
}

function renderRecentSearches() {
  const rail = $("#recentSearches");
  if (!rail) return;
  const fallback = ["Nora", "Alma", "Olivia", "Elias"];
  rail.replaceChildren(...(state.recent.length ? state.recent : fallback).map((query) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = query;
    button.addEventListener("click", () => {
      state.query = query;
      state.searchShowAll = true;
      openSearchView();
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
  const selected = state.selected.has(item.id);
  const history = hasHistory(item);
  const latest = pointInYear(item, state.latestYear);
  const row = document.createElement("article");
  row.className = `nameRow ${item.sex} ${options.feature ? "featureNameCard" : ""} ${selected ? "selected" : ""} ${history ? "birthData" : "identityData"}`;
  const score = history ? latest?.[1] ?? 0 : null;
  const scoreLabel = history ? `fødte ${state.latestYear}` : "ingen statistikk";
  row.innerHTML = `
    <span class="rank">${options.rank ?? sexIconMarkup(item)}</span>
    <button class="nameMain" type="button">
      <strong>${escapeHtml(item.name)}</strong>
      <small>${history ? `${escapeHtml(itemMood(item))} · toppår ${item.peakYear}` : identityCoverageLabel(item)}</small>
    </button>
    <span class="spark">${history ? sparklineSvg(item) : ""}</span>
    <span class="count nameScore"><b>${score == null ? "–" : formatNumber(score)}</b><small>${scoreLabel}</small></span>
    <button class="addButton ${selected ? "active" : ""}" type="button" aria-label="${selected ? "Valgt, trykk for å fjerne" : "Legg til"} ${escapeHtml(item.name)}">
      <svg><use href="#icon-${selected ? "check" : "plus"}"></use></svg>
    </button>
  `;
  $(".nameMain", row).addEventListener("click", () => openNameDetail(item));
  $(".addButton", row).addEventListener("click", (event) => {
    event.stopPropagation();
    toggleWorkSelection(item);
  });
  return row;
}

function toggleWorkSelection(item) {
  if (!item) return;
  if (state.selected.has(item.id) && !state.status[item.id]) {
    removeFromWork(item.id, `${item.name} fjernet fra listen`);
    return;
  }
  addToWork(item);
}

function addToWork(item) {
  if (!item) return;
  state.selected.add(item.id);
  if (state.status[item.id] === "rejected") delete state.status[item.id];
  resetReviewDeck();
  saveWorkSelection();
  saveStatus();
  toast(`${item.name} lagt til i vår liste`);
  renderAll();
  if (state.subscreenMode === "search") renderSearchResults();
  updateUrl();
}

function removeFromWork(id, message = "") {
  const item = state.itemsById.get(id);
  state.selected.delete(id);
  resetReviewDeck();
  saveWorkSelection();
  renderAll();
  if (state.subscreenMode === "search") renderSearchResults();
  updateUrl();
  if (message) toast(message);
  else if (item) toast(`${item.name} fjernet fra listen`);
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
      neutral: `${item.name} flyttet til kandidater`,
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
  if (state.compare.metric === "index") state.compare.metric = "count";
  $$("[data-metric]").forEach((button) => button.classList.toggle("active", button.dataset.metric === state.compare.metric));
  normalizeComparePeriod();
  const rangeSummary = $("#compareRangeSummary");
  if (rangeSummary) {
    rangeSummary.innerHTML = `
      <span><strong>${state.compare.fromYear}-${state.compare.toYear}</strong><small>${metricLabel(state.compare.metric)} · ${smoothLabel(state.compare.smooth)}</small></span>
      <em>Innst.</em>
    `;
  }
  $("#compareYearLabel").textContent = state.compare.toYear;
  const items = compareItems();
  ensureSimilarReference(items);
  renderCompareChips(items);
  renderCompareStats(items);
  renderChart(items);
  renderCompareInsight(items);
  renderCompareSimilar(items);
  const reviewButton = $("#compareReview");
  if (reviewButton) {
    const count = workItems().length;
    reviewButton.hidden = !count;
    reviewButton.textContent = count ? `Vurder ${formatNumber(count)}` : "Vurder";
  }
}

function renderCompareInsight(items) {
  const panel = $("#compareInsight");
  if (!panel) return;
  if (!items.length) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }
  panel.hidden = false;
  const latestRows = items
    .filter(hasHistory)
    .map((item) => ({ item, point: pointInYear(item, state.latestYear), trend: trendScore(item) }))
    .filter((row) => row.point);
  if (!latestRows.length) {
    panel.innerHTML = `
      <span class="wide"><small>Datadekning</small><strong>Grunnopplysninger</strong><em>Disse navnene kan vurderes og sammenlignes etter skrivemåte, men mangler fødselstall.</em></span>
    `;
    return;
  }
  const largest = latestRows.slice().sort((a, b) => (b.point?.[1] ?? 0) - (a.point?.[1] ?? 0))[0];
  const fastest = latestRows.slice().sort((a, b) => b.trend - a.trend)[0];
  const rarest = latestRows.slice().sort((a, b) => (a.point?.[1] ?? 0) - (b.point?.[1] ?? 0))[0];
  panel.innerHTML = `
    <span class="wide"><small>Slik leses dette</small><strong>${metricLabel(state.compare.metric)}</strong><em>${compareMetricHelp()}</em></span>
    <span><small>Størst nå</small><strong>${escapeHtml(largest?.item.name ?? "-")}</strong><em>${formatNumber(largest?.point?.[1] ?? 0)} i ${state.latestYear}</em></span>
    <span><small>Mest opp</small><strong>${escapeHtml(fastest?.item.name ?? "-")}</strong><em>${fastest?.trend > 0 ? "+" : ""}${formatNumber(fastest?.trend ?? 0)} siste 10 år</em></span>
    <span><small>Mest særpreg</small><strong>${escapeHtml(rarest?.item.name ?? "-")}</strong><em>${formatNumber(rarest?.point?.[1] ?? 0)} i ${state.latestYear}</em></span>
  `;
}

function setComparePeriod(fromYear, toYear) {
  state.compare.fromYear = clampYear(Number(fromYear));
  state.compare.toYear = clampYear(Number(toYear));
  normalizeComparePeriod();
  renderCompare();
  updateUrl();
}

function normalizeComparePeriod() {
  state.compare.fromYear = clampYear(state.compare.fromYear);
  state.compare.toYear = clampYear(state.compare.toYear || state.latestYear);
  if (state.compare.fromYear > state.compare.toYear) {
    const swap = state.compare.fromYear;
    state.compare.fromYear = state.compare.toYear;
    state.compare.toYear = swap;
  }
}

function compareItems() {
  const selected = [...state.selected].map((id) => state.itemsById.get(id)).filter(Boolean);
  return selected.slice(0, MAX_COMPARE_ITEMS);
}

function ensureSimilarReference(items = compareItems()) {
  if (items.some((item) => item.id === state.similarReferenceId)) return;
  state.similarReferenceId = items[0]?.id || "";
}

function renderCompareChips(items) {
  const rail = $("#compareChips");
  if (!items.length) {
    rail.innerHTML = `<span class="emptyChip">Ingen navn valgt</span>`;
    return;
  }
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
    });

    chip.append(open, remove);
    return chip;
  }));
  const total = workItems().length;
  if (total > items.length) {
    const summary = document.createElement("span");
    summary.className = "emptyChip";
    summary.textContent = `Viser ${formatNumber(items.length)} av ${formatNumber(total)}`;
    rail.append(summary);
  }
}

function renderCompareSimilar(items) {
  const panel = $("#compareSimilarPanel");
  if (!panel) return;
  if (!items.length) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }
  panel.hidden = false;
  ensureSimilarReference(items);
  const reference = state.itemsById.get(state.similarReferenceId) || items[0];
  const mode = hasHistory(reference) ? state.similarMode : "text";
  const rows = similarRows(reference, mode, state.similarSex).slice(0, 5);
  const preview = rows.slice(0, state.showAdvancedSimilar ? 5 : 3);
  panel.innerHTML = `
    <div class="similarPanelHead">
      <span><strong>Flere navn i samme gate</strong><small>${similarPreviewLabel(reference)}</small></span>
      <button type="button" data-similar="${reference.id}">Se alle</button>
    </div>
    <p class="similarIntro">Appen finner forslag med lignende utvikling, popularitet eller navneform. Du kan åpne avansert analyse når du vil styre metoden selv.</p>
    ${state.showAdvancedSimilar ? similarControlsMarkup(items, reference) : ""}
    <div class="similarMiniRows"></div>
    <button class="advancedToggle" data-toggle-advanced-similar type="button">${state.showAdvancedSimilar ? "Skjul avansert analyse" : "Vis avansert analyse"}</button>
  `;
  $(".similarMiniRows", panel).replaceChildren(...preview.map((row) => similarResultRow(row, { compact: true })));
  bindSimilarControls(panel, items);
}

function renderChart(items) {
  const chart = $("#compareChart");
  if (!chart) return;
  if (!items.length) {
    chart.hidden = false;
    chart.innerHTML = `
      <div class="emptyState">
        <h2>Ingen navn å sammenligne</h2>
        <p>Legg til minst to kandidater for å se popularitet, trend og skoleestimat side om side.</p>
        <div class="emptyActions">
          <button data-quick-name="Nora" type="button">Nora</button>
          <button data-quick-name="Noah" type="button">Noah</button>
          <button data-go-tab="explore" type="button">Søk</button>
        </div>
        <button class="primaryWide" data-go-tab="explore" type="button">Oppdag navn</button>
      </div>
    `;
    chart.dataset.traces = "0";
    $("#compareLegend").replaceChildren();
    return;
  }
  const historyItems = items.filter(hasHistory);
  const metric = effectiveMetric();
  chart.hidden = !historyItems.length;
  chart.innerHTML = historyItems.length ? lineChartSvg(historyItems, metric, state.compare.fromYear, state.compare.toYear, 344, 250) : "";
  chart.dataset.traces = String(historyItems.length);
  const legend = $("#compareLegend");
  legend.replaceChildren(...historyItems.map((item, index) => {
    const label = document.createElement("span");
    label.innerHTML = `<i style="background:${chartColor(index, item)}"></i>${escapeHtml(item.name)}`;
    return label;
  }));
}

function renderCompareStats(items) {
  const table = $("#compareStats");
  if (!items.length) {
    table.innerHTML = `<p class="mutedEmpty">Utvalget er tomt.</p>`;
    return;
  }
  table.replaceChildren(...items.map((item) => {
    const point = pointInYear(item, state.compare.toYear);
    const history = hasHistory(item);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "statRow";
    row.innerHTML = `
      <span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.sex)} · ${history ? "fødte" : "grunnopplysninger"}</small></span>
      <span>${history ? formatNumber(point?.[1] ?? 0) : "–"}</span>
      <span>${point?.[2] ? formatNumber(point[2]) : "-"}</span>
      <span>${formatPercent(point?.[3])}</span>
      <span>${history ? item.peakYear : "-"}</span>
    `;
    row.addEventListener("click", () => openNameDetail(item));
    return row;
  }));
}

function similarControlsMarkup(items, reference) {
  const modes = similarModes();
  return `
    <div class="similarControlGrid">
      <label>Referanse<select data-sim-reference>${items.map((item) => `<option value="${item.id}" ${item.id === reference.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
      <label>Finn<select data-sim-sex>
        <option value="alle" ${state.similarSex === "alle" ? "selected" : ""}>Alle kjønn</option>
        <option value="same" ${state.similarSex === "same" ? "selected" : ""}>Samme kjønn</option>
        <option value="jente" ${state.similarSex === "jente" ? "selected" : ""}>Jentenavn</option>
        <option value="gutt" ${state.similarSex === "gutt" ? "selected" : ""}>Guttenavn</option>
      </select></label>
    </div>
    <div class="segmented small similarModes" aria-label="Likhetstype">
      ${modes.map(([mode, label]) => `<button class="${mode === state.similarMode ? "active" : ""}" type="button" data-compare-sim-mode="${mode}">${label}</button>`).join("")}
    </div>
  `;
}

function similarModes() {
  return [
    ["curve", "Lik trend"],
    ["curveCount", "Lik størrelse"],
    ["shareLevel", "Lik andel"],
    ["text", "Lik skrivemåte"],
  ];
}

function bindSimilarControls(root, items = compareItems(), render = () => renderCompareSimilar(items)) {
  $("[data-sim-reference]", root)?.addEventListener("change", (event) => {
    state.similarReferenceId = event.target.value;
    render();
  });
  $("[data-sim-sex]", root)?.addEventListener("change", (event) => {
    state.similarSex = event.target.value;
    render();
  });
  $$("[data-compare-sim-mode]", root).forEach((button) => {
    button.addEventListener("click", () => {
      state.similarMode = button.dataset.compareSimMode;
      $$("[data-compare-sim-mode]", root).forEach((modeButton) => modeButton.classList.toggle("active", modeButton === button));
      render();
    });
  });
  bindSubscreenButtons(root);
}

function similarResultRow(row, options = {}) {
  const item = row.item;
  const button = document.createElement("button");
  button.type = "button";
  const sparkWidth = options.compact ? 96 : 132;
  const sparkHeight = options.compact ? 24 : 30;
  button.className = `similarMiniRow ${options.compact ? "" : "large"}`;
  button.innerHTML = `
    <span>
      <strong>${escapeHtml(item.name)} <small class="sexTag ${item.sex}">${escapeHtml(item.sex)}</small></strong>
      <small>${row.reason}</small>
      <b class="inlineSpark">${hasHistory(item) ? sparklineSvg(item, sparkWidth, sparkHeight) : ""}</b>
    </span>
    <em>${formatDecimal(row.similarity * 100, 0)} %</em>
    <i><svg><use href="#icon-plus"></use></svg></i>
  `;
  button.addEventListener("click", () => addToWork(item));
  return button;
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function similarSexLabel(value) {
  return { alle: "alle kjønn", same: "samme kjønn", jente: "jentenavn", gutt: "guttenavn" }[value] || "alle kjønn";
}

function similarPreviewLabel(reference) {
  if (!hasHistory(reference)) return `Basert på skrivemåten til ${escapeHtml(reference.name)}`;
  if (!state.showAdvancedSimilar) return `Basert på ${escapeHtml(reference.name)}, popularitet og andel i årskullet`;
  return `Referanse: ${escapeHtml(reference.name)} · ${similarSexLabel(state.similarSex)}`;
}

function peakShare(item) {
  return allPoints(item).find((point) => point.year === item.peakYear)?.shareSex ?? null;
}

function schoolCardMarkup(item) {
  const estimate = schoolEstimateForCurrentSettings(item);
  return `
    <section class="subCard schoolCard">
      <span>
        <strong>Skoleestimat</strong>
        <small>Født ${state.school.birthYear} · ${formatNumber(state.school.gradeSize)} elever/år · ${formatNumber(state.school.grades)} trinn</small>
      </span>
      <span class="schoolNumbers">
        <b>${formatDecimal(estimate.grade, 2)}</b><small>eget trinn</small>
        <b>${formatDecimal(estimate.school, 2)}</b><small>hele skolen</small>
      </span>
      <button class="schoolEdit" data-school-settings type="button">Endre</button>
    </section>
  `;
}

function openNameDetail(item) {
  openSubscreen(item.name, detailMarkup(item), () => setNameStatus(item.id, "shortlist"));
  $("#subAction").innerHTML = '<svg><use href="#icon-heart"></use></svg>';
  if (hasHistory(item)) requestAnimationFrame(() => renderMiniChart("detailChart", [item], "shareSex", 1900, 3));
}

function detailMarkup(item) {
  if (!hasHistory(item)) return identityNameDetailMarkup(item);
  const latest = pointInYear(item, state.latestYear);
  return `
    <section class="detailHero">
      <div><h2>${escapeHtml(item.name)} ${sexIconMarkup(item)}</h2><p>${escapeHtml(item.sex)}</p></div>
    </section>
    <section class="subCard decisionSummary">
      ${decisionSummaryMarkup(item)}
    </section>
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
    ${schoolCardMarkup(item)}
    ${populationHistoryMarkup(item, latest)}
    ${sourceListMarkup(item)}
    <button class="primaryWide" data-add="${item.id}" type="button">Legg til i vår liste</button>
    <button class="secondaryWide" data-similar="${item.id}" type="button">Finn lignende navn</button>
  `;
}

function identityNameDetailMarkup(item) {
  return `
    <section class="detailHero">
      <div><h2>${escapeHtml(item.name)} ${sexIconMarkup(item)}</h2><p>${escapeHtml(item.sex)}</p></div>
    </section>
    <section class="subCard sourceNote">
      <h3>Grunnopplysninger</h3>
      <p>Navnet og kjønnstilknytningen er dokumentert, men katalogen har foreløpig ikke norske fødselstall for navnet.</p>
    </section>
    ${sourceListMarkup(item)}
    <button class="primaryWide" data-add="${item.id}" type="button">Legg til i vår liste</button>
    <button class="secondaryWide" data-similar="${item.id}" type="button">Finn navn med lignende skrivemåte</button>
  `;
}

function decisionSummaryMarkup(item) {
  const latest = pointInYear(item, state.latestYear);
  const trend = trendScore(item);
  const estimate = schoolEstimateForCurrentSettings(item);
  const rank = latest?.[2] ? `#${formatNumber(latest[2])}` : "uten rang";
  const trendText = trend > 20 ? "tydelig på vei opp" : trend > 0 ? "svakt på vei opp" : trend < -20 ? "på vei ned" : "stabilt";
  const schoolText = estimate.school < 1 ? "svært få i skoleløpet" : estimate.school < 3 ? "lav klasse-risiko" : "flere mulige navnebrødre";
  return `
    <h3>Beslutningskort</h3>
    <div class="decisionPills">
      <span><b>${rank}</b><small>rang ${state.latestYear}</small></span>
      <span><b>${trendText}</b><small>siste 10 år</small></span>
      <span><b>${schoolText}</b><small>${formatDecimal(estimate.school, 1)} i skoleløpet</small></span>
    </div>
  `;
}

function openSimilar(item) {
  if (!item) return;
  state.similarReferenceId = item.id;
  if (!hasHistory(item)) state.similarMode = "text";
  const references = uniqueItems([item, ...compareItems()]);
  openSubscreen("Finn lignende navn", `
    <div class="similarHead">
      <span>Lignende navn: <b>${escapeHtml(item.name)}</b></span>
    </div>
    ${similarControlsMarkup(references, item)}
    <div id="similarList" class="nameRows"></div>
  `);
  const render = () => renderSimilarList(state.itemsById.get(state.similarReferenceId) || item, similarRows(state.itemsById.get(state.similarReferenceId) || item, state.similarMode, state.similarSex).slice(0, 40));
  render();
  bindSimilarControls($("#subContent"), references, render);
}

function renderSimilarList(reference, rows) {
  const list = $("#similarList");
  if (!list) return;
  list.replaceChildren(...rows.map((row) => similarResultRow(row, { compact: false })));
}

function openSearchView() {
  if (!state.data) return;
  openSubscreen("Søk", `
    <section class="searchWorkspace">
      <div class="searchViewBar">
        <svg><use href="#icon-search"></use></svg>
        <input id="searchViewInput" type="search" value="${escapeHtml(state.query)}" placeholder="Søk etter navn..." autocomplete="off" />
        <button id="toggleSearchFilters" class="${state.searchFiltersOpen || state.filters.rules.length ? "active" : ""}" type="button" aria-label="Vis filtre" aria-expanded="${state.searchFiltersOpen}"><svg><use href="#icon-filter"></use>${state.filters.rules.length ? `<span>${state.filters.rules.length}</span>` : ""}</button>
      </div>
      <section id="searchFilterPanel" class="searchFilterPanel" ${state.searchFiltersOpen ? "" : "hidden"}>
        <div class="filterBuilderHead">
          <span>
            <strong>Filtrer navn</strong>
            <small>Alle reglene må stemme</small>
          </span>
          <button id="addSearchRule" class="filterAddButton" type="button"><svg><use href="#icon-plus"></use></svg>Legg til</button>
        </div>
        <div id="searchRuleList" class="filterRuleList"></div>
        <p id="filterBuilderEmpty" class="filterBuilderEmpty">Ingen regler ennå – hele katalogen vises.</p>
        <button id="resetSearchFilters" class="filterClearButton" type="button">Fjern alle filtre</button>
      </section>
      <section id="searchEmptyIntro" class="searchEmptyIntro"></section>
      <section id="searchResults" class="searchResults">
        <div class="searchResultsHead">
          <span><h3 id="searchResultTitle">Treff</h3><small id="searchResultScope"></small></span>
        </div>
        <div id="searchBulkActions" class="candidateBulkActions"></div>
        <p id="searchProgress" class="candidateProgress"></p>
        <div id="searchResultList" class="nameRows"></div>
        <button id="loadMoreSearchResults" class="secondaryWide candidateLoadMore" type="button"></button>
      </section>
    </section>
  `, null, { mode: "search" });
  $("#toggleSearchFilters").addEventListener("click", () => {
    state.searchFiltersOpen = !state.searchFiltersOpen;
    $("#searchFilterPanel").hidden = !state.searchFiltersOpen;
    $("#toggleSearchFilters").classList.toggle("active", state.searchFiltersOpen || state.filters.rules.length > 0);
    $("#toggleSearchFilters").setAttribute("aria-expanded", String(state.searchFiltersOpen));
  });
  $("#searchViewInput").addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.searchShowAll = Boolean(state.query);
    if (state.query) rememberSearch(state.query);
    renderSearchResults();
    updateUrl();
  });
  $("#addSearchRule").addEventListener("click", () => {
    state.filters.rules.push(createSearchRule("name"));
    state.searchShowAll = true;
    renderSearchRuleBuilder();
    renderSearchResults();
    updateSearchFilterBadge();
  });
  $("#searchRuleList").addEventListener("click", handleSearchRuleClick);
  $("#searchRuleList").addEventListener("change", handleSearchRuleChange);
  $("#searchRuleList").addEventListener("input", handleSearchRuleInput);
  $("#resetSearchFilters").addEventListener("click", () => {
    resetLocalSearchFilters();
    state.searchShowAll = Boolean(state.query);
    renderSearchRuleBuilder();
    renderSearchResults();
    updateSearchFilterBadge();
    updateUrl();
  });
  renderSearchRuleBuilder();
  renderSearchResults();
  requestAnimationFrame(() => $("#searchViewInput")?.focus());
}

function createSearchRule(type = "name", overrides = {}) {
  const defaults = {
    gender: { op: "equals", value: "jente", value2: "" },
    name: { op: "contains", value: "", value2: "" },
    birthPeriod: { op: "between", value: "1980", value2: "1999" },
    latestCount: { op: "lte", value: "25", value2: "" },
    latestRank: { op: "lte", value: "50", value2: "" },
    trend: { op: "gte", value: "1", value2: "" },
    school: { op: "lte", value: "2", value2: "" },
  };
  return {
    id: `filter-${Date.now()}-${searchRuleCounter += 1}`,
    type,
    negate: false,
    ...defaults[type],
    ...overrides,
  };
}

function resetLocalSearchFilters() {
  state.filters.rules = [];
}

function renderSearchRuleBuilder() {
  const list = $("#searchRuleList");
  if (!list) return;
  list.innerHTML = state.filters.rules.map((rule, index) => searchRuleMarkup(rule, index)).join("");
  $("#filterBuilderEmpty").hidden = state.filters.rules.length > 0;
  $("#resetSearchFilters").hidden = state.filters.rules.length === 0;
  refreshSearchRuleErrors();
}

function searchRuleMarkup(rule, index) {
  const fieldOptions = [
    ["name", "Navnetekst"],
    ["gender", "Navnetype"],
    ["birthPeriod", "Fødselstall i periode"],
    ["latestCount", `Nyfødte i ${state.latestYear}`],
    ["latestRank", `Rangering i ${state.latestYear}`],
    ["trend", "Endring siste tiår"],
    ["school", "Forventet i skoleløpet"],
  ];
  return `
    <article class="filterRule" data-rule-id="${escapeHtml(rule.id)}">
      <div class="filterRuleHead">
        <small>${index === 0 ? "Vis navn der" : "og"}</small>
        <button class="filterNegate ${rule.negate ? "active" : ""}" data-rule-action="negate" type="button" aria-pressed="${rule.negate}">Ikke</button>
        <button class="filterRemove" data-rule-action="remove" type="button" aria-label="Fjern filter"><svg><use href="#icon-x"></use></svg></button>
      </div>
      <div class="filterRuleControls">
        <label class="srOnly" for="${rule.id}-field">Egenskap</label>
        <select id="${rule.id}-field" data-rule-prop="type">${fieldOptions.map(([value, label]) => `<option value="${value}" ${rule.type === value ? "selected" : ""}>${label}</option>`).join("")}</select>
        ${searchRuleConditionMarkup(rule)}
      </div>
      <p class="filterRuleError" aria-live="polite"></p>
    </article>
  `;
}

function searchRuleConditionMarkup(rule) {
  if (rule.type === "gender") {
    return `
      <span class="filterOperatorText">er</span>
      <select data-rule-prop="value" aria-label="Navnetype">
        <option value="jente" ${rule.value === "jente" ? "selected" : ""}>Jentenavn</option>
        <option value="gutt" ${rule.value === "gutt" ? "selected" : ""}>Guttenavn</option>
      </select>
    `;
  }
  if (rule.type === "birthPeriod") {
    return `
      <span class="filterOperatorText">har publiserte fødselstall mellom</span>
      <div class="filterRange">
        <input data-rule-prop="value" type="number" min="${state.firstYear}" max="${state.latestYear}" inputmode="numeric" value="${escapeHtml(rule.value)}" aria-label="Fra år" />
        <span>og</span>
        <input data-rule-prop="value2" type="number" min="${state.firstYear}" max="${state.latestYear}" inputmode="numeric" value="${escapeHtml(rule.value2)}" aria-label="Til år" />
      </div>
    `;
  }
  if (rule.type === "name") {
    const operators = [
      ["contains", "inneholder"],
      ["starts", "begynner med"],
      ["ends", "slutter med"],
      ["equals", "er nøyaktig"],
      ["regex", "matcher regex"],
    ];
    return `
      <select data-rule-prop="op" aria-label="Sammenligning">${operators.map(([value, label]) => `<option value="${value}" ${rule.op === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      <input data-rule-prop="value" type="text" value="${escapeHtml(rule.value)}" placeholder="${rule.op === "regex" ? "^El|a$" : "Skriv tekst"}" aria-label="Tekstverdi" autocomplete="off" autocapitalize="none" />
    `;
  }
  const operators = [
    ["lte", "er høyst"],
    ["gte", "er minst"],
    ["between", "er mellom"],
  ];
  const step = rule.type === "school" ? "0.1" : "1";
  const suffix = rule.type === "trend" ? "navn" : rule.type === "school" ? "elever" : "";
  return `
    <select data-rule-prop="op" aria-label="Sammenligning">${operators.map(([value, label]) => `<option value="${value}" ${rule.op === value ? "selected" : ""}>${label}</option>`).join("")}</select>
    <div class="filterNumeric">
      <input data-rule-prop="value" type="number" step="${step}" inputmode="decimal" value="${escapeHtml(rule.value)}" aria-label="Tallverdi" />
      ${rule.op === "between" ? `<span>og</span><input data-rule-prop="value2" type="number" step="${step}" inputmode="decimal" value="${escapeHtml(rule.value2)}" aria-label="Øvre tallverdi" />` : ""}
      ${suffix ? `<small>${suffix}</small>` : ""}
    </div>
  `;
}

function handleSearchRuleClick(event) {
  const button = event.target.closest("[data-rule-action]");
  if (!button) return;
  const card = button.closest("[data-rule-id]");
  const index = state.filters.rules.findIndex((rule) => rule.id === card?.dataset.ruleId);
  if (index < 0) return;
  if (button.dataset.ruleAction === "remove") state.filters.rules.splice(index, 1);
  if (button.dataset.ruleAction === "negate") state.filters.rules[index].negate = !state.filters.rules[index].negate;
  state.searchShowAll = true;
  renderSearchRuleBuilder();
  renderSearchResults();
  updateSearchFilterBadge();
}

function handleSearchRuleChange(event) {
  const control = event.target.closest("[data-rule-prop]");
  if (!control) return;
  const rule = state.filters.rules.find((item) => item.id === control.closest("[data-rule-id]")?.dataset.ruleId);
  if (!rule) return;
  if (control.dataset.ruleProp === "type") {
    const replacement = createSearchRule(control.value, { id: rule.id, negate: rule.negate });
    Object.keys(rule).forEach((key) => delete rule[key]);
    Object.assign(rule, replacement);
    renderSearchRuleBuilder();
  } else {
    rule[control.dataset.ruleProp] = control.value;
    if (control.dataset.ruleProp === "op") renderSearchRuleBuilder();
  }
  state.searchShowAll = true;
  renderSearchResults();
  updateSearchFilterBadge();
}

function handleSearchRuleInput(event) {
  const control = event.target.closest("[data-rule-prop]");
  if (!control || control.tagName === "SELECT") return;
  const rule = state.filters.rules.find((item) => item.id === control.closest("[data-rule-id]")?.dataset.ruleId);
  if (!rule) return;
  rule[control.dataset.ruleProp] = control.value;
  state.searchShowAll = true;
  refreshSearchRuleErrors();
  renderSearchResults();
}

function updateSearchFilterBadge() {
  const button = $("#toggleSearchFilters");
  if (!button) return;
  button.classList.toggle("active", state.searchFiltersOpen || state.filters.rules.length > 0);
  button.innerHTML = `<svg><use href="#icon-filter"></use></svg>${state.filters.rules.length ? `<span>${state.filters.rules.length}</span>` : ""}`;
}

function refreshSearchRuleErrors() {
  $$(".filterRule").forEach((card) => {
    const rule = state.filters.rules.find((item) => item.id === card.dataset.ruleId);
    const error = searchRuleError(rule);
    card.classList.toggle("invalid", Boolean(error));
    $(".filterRuleError", card).textContent = error;
  });
}

function searchRuleError(rule) {
  if (!rule || rule.type !== "name" || rule.op !== "regex" || !rule.value.trim()) return "";
  try {
    new RegExp(rule.value, "iu");
    return "";
  } catch {
    return "Regex-uttrykket er ugyldig.";
  }
}

function searchRuleReady(rule) {
  if (!rule || searchRuleError(rule)) return false;
  if (rule.type === "gender") return Boolean(rule.value);
  if (rule.type === "name") return Boolean(rule.value.trim());
  if (rule.type === "birthPeriod") {
    return String(rule.value).trim() !== "" && String(rule.value2).trim() !== "" && Number.isFinite(Number(rule.value)) && Number.isFinite(Number(rule.value2));
  }
  return String(rule.value).trim() !== "" && Number.isFinite(Number(rule.value)) && (rule.op !== "between" || (String(rule.value2).trim() !== "" && Number.isFinite(Number(rule.value2))));
}

function compareRuleNumber(value, rule) {
  const first = Number(rule.value);
  const second = Number(rule.value2);
  if (value == null || !Number.isFinite(Number(value))) return false;
  if (rule.op === "gte") return Number(value) >= first;
  if (rule.op === "between") return Number(value) >= Math.min(first, second) && Number(value) <= Math.max(first, second);
  return Number(value) <= first;
}

function searchRuleMatches(item, rule) {
  let matches = true;
  if (rule.type === "gender") matches = item.sex === rule.value;
  if (rule.type === "name") {
    const name = normalize(item.name);
    const value = normalize(rule.value);
    if (rule.op === "starts") matches = name.startsWith(value);
    else if (rule.op === "ends") matches = name.endsWith(value);
    else if (rule.op === "equals") matches = name === value;
    else if (rule.op === "regex") matches = new RegExp(rule.value, "iu").test(item.name);
    else matches = name.includes(value);
  }
  if (rule.type === "birthPeriod") {
    const from = Math.min(clampYear(Number(rule.value)), clampYear(Number(rule.value2)));
    const to = Math.max(clampYear(Number(rule.value)), clampYear(Number(rule.value2)));
    matches = hasHistory(item) && allPoints(item).some((point) => point.year >= from && point.year <= to && (point.count != null || point.shareSex != null));
  }
  if (rule.type === "latestCount") matches = compareRuleNumber(pointInYear(item, state.latestYear)?.[1], rule);
  if (rule.type === "latestRank") matches = compareRuleNumber(pointInYear(item, state.latestYear)?.[2], rule);
  if (rule.type === "trend") matches = hasHistory(item) && compareRuleNumber(trendScore(item), rule);
  if (rule.type === "school") matches = hasHistory(item) && compareRuleNumber(schoolEstimateForCurrentSettings(item).school, rule);
  return rule.negate ? !matches : matches;
}

function renderSearchResults() {
  const results = $("#searchResults");
  const intro = $("#searchEmptyIntro");
  const shouldShow = state.searchShowAll || hasActiveSearchFilters();
  if (!shouldShow) {
    results.hidden = true;
    intro.hidden = false;
    intro.innerHTML = `
      <div>
        <strong>Søk i ${formatNumber(discoveryBaseRows().length)} navn</strong>
        <p>Skriv et navn, bruk filtre eller åpne hele katalogen.</p>
        <button id="showEntireCatalog" class="primaryWide" type="button">Vis alle navn</button>
      </div>
      ${state.recent.length ? `<div><small>Siste søk</small><div id="searchRecentChips" class="chipRail"></div></div>` : ""}
    `;
    $("#showEntireCatalog").addEventListener("click", () => {
      state.searchShowAll = true;
      renderSearchResults();
    });
    const recent = $("#searchRecentChips");
    if (recent) {
      recent.replaceChildren(...state.recent.map((query) => {
        const button = document.createElement("button");
        button.className = "chip";
        button.type = "button";
        button.textContent = query;
        button.addEventListener("click", () => {
          state.query = query;
          state.searchShowAll = true;
          $("#searchViewInput").value = query;
          renderSearchResults();
        });
        return button;
      }));
    }
    return;
  }
  intro.hidden = true;
  results.hidden = false;
  const rows = filteredRows();
  const filterErrors = state.filters.rules.map(searchRuleError).filter(Boolean);
  state.candidateRows = rows;
  $("#searchResultTitle").textContent = filterErrors.length ? "Sjekk filteret" : `${formatNumber(rows.length)} treff`;
  $("#searchResultScope").textContent = filterErrors.length ? filterErrors[0] : searchScopeLabel();
  const bulk = $("#searchBulkActions");
  bulk.innerHTML = rows.length ? `
    <button class="primaryWide" id="addAllSearchResults" type="button">Legg alle til utvalget</button>
    <button class="secondaryWide" id="reviewAllSearchResults" type="button">Vurder alle</button>
  ` : "";
  $("#addAllSearchResults")?.addEventListener("click", () => addCandidateRowsToWork(rows));
  $("#reviewAllSearchResults")?.addEventListener("click", () => addCandidateRowsToWork(rows, true));
  const list = $("#searchResultList");
  const progress = $("#searchProgress");
  const loadMore = $("#loadMoreSearchResults");
  list.replaceChildren();
  if (!rows.length) {
    progress.textContent = "";
    loadMore.hidden = true;
    list.innerHTML = `<div class="emptyState compact"><p>${filterErrors.length ? "Rett filteret som er markert med rødt." : "Ingen navn matcher søket og filtrene."}</p></div>`;
    return;
  }
  const batchSize = 100;
  let visible = 0;
  let observer = null;
  const renderNextBatch = () => {
    const next = rows.slice(visible, visible + batchSize);
    list.append(...next.map((item) => nameRow(item)));
    visible += next.length;
    progress.textContent = `Viser ${formatNumber(visible)} av ${formatNumber(rows.length)}`;
    const remaining = rows.length - visible;
    loadMore.hidden = remaining <= 0;
    loadMore.textContent = remaining > 0 ? `Vis ${formatNumber(Math.min(batchSize, remaining))} til` : "";
    if (remaining <= 0) observer?.disconnect();
  };
  renderNextBatch();
  loadMore.onclick = renderNextBatch;
  if ("IntersectionObserver" in window && rows.length > batchSize) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) renderNextBatch();
    }, { root: $("#subContent"), rootMargin: "240px 0px" });
    observer.observe(loadMore);
  }
}

function searchScopeLabel() {
  const ready = state.filters.rules.filter(searchRuleReady).length;
  return `fødselstall${ready ? ` · ${formatNumber(ready)} ${ready === 1 ? "filter" : "filtre"}` : ""}`;
}

function openCandidateBuilder(rows = filteredRows(), title = "Alle treff", subtitle = "Hele trefflisten") {
  state.candidateRows = rows;
  openSubscreen(title, `
    <section class="subCard candidateSummary">
      <strong>${formatNumber(rows.length)} navn</strong>
      <small>${escapeHtml(subtitle)}</small>
    </section>
    <div class="candidateBulkActions">
      <button class="primaryWide" id="addAllCandidates" type="button">Legg alle til utvalget</button>
      <button class="secondaryWide" id="reviewAllCandidates" type="button">Vurder alle</button>
    </div>
    <p id="candidateProgress" class="candidateProgress"></p>
    <div id="candidateList" class="nameRows"></div>
    <button class="secondaryWide candidateLoadMore" id="loadMoreCandidates" type="button"></button>
  `);
  const list = $("#candidateList");
  const progress = $("#candidateProgress");
  const loadMore = $("#loadMoreCandidates");
  const batchSize = 100;
  let visible = 0;
  let observer = null;
  const renderNextBatch = () => {
    const next = rows.slice(visible, visible + batchSize);
    list.append(...next.map((item) => nameRow(item)));
    visible += next.length;
    progress.textContent = `Viser ${formatNumber(visible)} av ${formatNumber(rows.length)}`;
    const remaining = rows.length - visible;
    loadMore.hidden = remaining <= 0;
    loadMore.textContent = remaining > 0 ? `Vis ${formatNumber(Math.min(batchSize, remaining))} til` : "";
    if (remaining <= 0) observer?.disconnect();
  };
  renderNextBatch();
  loadMore.addEventListener("click", renderNextBatch);
  if ("IntersectionObserver" in window && rows.length > batchSize) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) renderNextBatch();
    }, { rootMargin: "240px 0px" });
    observer.observe(loadMore);
  }
  $("#addAllCandidates").addEventListener("click", () => addCandidateRowsToWork(rows));
  $("#reviewAllCandidates").addEventListener("click", () => addCandidateRowsToWork(rows, true));
}

function openCompareSettings() {
  openSubscreen("Innstillinger", `
    <form id="compareSettingsForm" class="formStack">
      <label>Fra år<input name="fromYear" type="number" min="${state.firstYear}" max="${state.latestYear}" value="${state.compare.fromYear}" /></label>
      <label>Til år<input name="toYear" type="number" min="${state.firstYear}" max="${state.latestYear}" value="${state.compare.toYear}" /></label>
      <label>Mål<select name="metric"><option value="count">Antall</option><option value="shareSex">Andel (%)</option><option value="rank">Rang</option></select></label>
      <label>Glatting<select name="smooth"><option value="1">Av</option><option value="3">3 år</option><option value="5">5 år</option><option value="7">7 år</option></select></label>
      <button class="primaryWide" type="submit">Oppdater</button>
    </form>
  `);
  $("#compareSettingsForm [name='metric']").value = state.compare.metric;
  $("#compareSettingsForm [name='smooth']").value = String(state.compare.smooth);
  $("#compareSettingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.compare.fromYear = clampYear(Number(form.get("fromYear")));
    state.compare.toYear = clampYear(Number(form.get("toYear")));
    state.compare.metric = String(form.get("metric"));
    state.compare.smooth = Number(form.get("smooth"));
    normalizeComparePeriod();
    closeSubscreen();
    renderCompare();
    updateUrl();
  });
}

function openCompareTable() {
  const years = [state.compare.fromYear, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2024, state.compare.toYear].filter((year, index, arr) => year >= state.compare.fromYear && year <= state.compare.toYear && state.years.includes(year) && arr.indexOf(year) === index);
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
  $(".reviewActions").hidden = !item;
  if (!item) {
    card.innerHTML = `
      <div class="emptyState">
        <h2>Ingen navn å vurdere</h2>
        <p>Utvalget er handlelisten din. Oppdag eller søk etter navn først, så kan du avgjøre dem ett og ett her.</p>
        <div class="emptyActions">
          <button data-quick-name="Nora" type="button">Nora</button>
          <button data-quick-name="Noah" type="button">Noah</button>
        </div>
        <button class="primaryWide" data-go-tab="explore" type="button">Oppdag navn</button>
      </div>
    `;
    return;
  }
  const latest = pointInYear(item, state.latestYear);
  $(".reviewActions").hidden = false;
  if (!hasHistory(item)) {
    card.innerHTML = `
      <div class="reviewNamePlate">
        <p class="cardMeta">${state.review.index + 1} av ${state.review.deck.length}</p>
        <h2>${escapeHtml(item.name)} ${sexIconMarkup(item)}</h2>
        <span class="trendPill">Grunnopplysninger</span>
      </div>
      <section class="reviewIdentityName">
        <span class="sourcePeople"><svg aria-hidden="true"><use href="#icon-list"></use></svg></span>
        <div>
          <small>${escapeHtml(item.sex)}navn</small>
          <strong>${escapeHtml(item.name)}</strong>
          <p>Kan vurderes og sammenlignes etter skrivemåte, men mangler fødselstall.</p>
        </div>
      </section>
      <p class="reviewSourceNote">Trend, rang, toppår og skoleestimat vises først når kilden dokumenterer slike data.</p>
    `;
    bindSubscreenButtons(card);
    return;
  }
  card.innerHTML = `
    <div class="reviewNamePlate">
      <p class="cardMeta">${state.review.index + 1} av ${state.review.deck.length}</p>
      <h2>${escapeHtml(item.name)} ${sexIconMarkup(item)}</h2>
      <span class="trendPill">${trendLabel(item)}</span>
    </div>
    <div class="reviewSpark">${sparklineSvg(item, 420, 120)}</div>
    <div class="reviewStats">
      <span><small>Antall</small><b>${formatNumber(latest?.[1] ?? 0)}</b><em>${item.sex}r i ${state.latestYear}</em></span>
      <span><small>Rang</small><b>${latest?.[2] ? formatNumber(latest[2]) : "-"}</b><em>i ${state.latestYear}</em></span>
      <span><small>Andel</small><b>${formatPercent(latest?.[3])}</b><em>av ${item.sex}r</em></span>
      <span><small>Toppår</small><b>${item.peakYear}</b><em>${formatNumber(item.peakCount)} fødte</em></span>
    </div>
    ${schoolCardMarkup(item)}
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
  const rotation = Math.max(-16, Math.min(16, reviewSwipe.dx / 14));
  card.style.setProperty("--swipe-x", `${reviewSwipe.dx}px`);
  card.style.setProperty("--swipe-y", `${reviewSwipe.dy}px`);
  card.style.setProperty("--swipe-rotate", `${rotation}deg`);
  card.classList.toggle("hintShortlist", reviewSwipe.dx > 70);
  card.classList.toggle("hintReject", reviewSwipe.dx < -70);
  updateReviewSwipeHint(reviewSwipe.dx);
}

function endReviewSwipe(event) {
  if (!reviewSwipe.active || event.pointerId !== reviewSwipe.pointerId) return;
  const card = event.currentTarget;
  const horizontal = Math.abs(reviewSwipe.dx) > 76 && Math.abs(reviewSwipe.dx) > Math.abs(reviewSwipe.dy) * 1.25;
  const status = reviewSwipe.dx > 0 ? "shortlist" : "rejected";
  const direction = reviewSwipe.dx > 0 ? 1 : -1;
  cancelReviewSwipe(event);
  if (horizontal) commitReviewDecision(status, direction);
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
  updateReviewSwipeHint(0);
  if (!card) return;
  card.classList.remove("is-swiping", "hintShortlist", "hintReject", "swipeShortlist", "swipeReject");
  card.style.removeProperty("--swipe-x");
  card.style.removeProperty("--swipe-y");
  card.style.removeProperty("--swipe-rotate");
  card.style.opacity = "";
}

function updateReviewSwipeHint(dx) {
  const hint = $("#reviewSwipeHint");
  if (!hint) return;
  const abs = Math.abs(dx);
  hint.classList.toggle("show", abs > 32);
  hint.classList.toggle("yes", dx > 32);
  hint.classList.toggle("no", dx < -32);
  hint.textContent = dx > 32 ? "Aktuelt" : dx < -32 ? "Uaktuelt" : "";
}

function commitReviewDecision(status, direction) {
  if (state.review.swiping) return;
  const card = $("#reviewCard");
  if (!card || !currentReviewItem()) return;
  state.review.swiping = true;
  card.classList.remove("hintShortlist", "hintReject");
  card.classList.add(status === "shortlist" ? "swipeShortlist" : "swipeReject");
  card.style.setProperty("--swipe-x", `${direction * 170}vw`);
  card.style.setProperty("--swipe-y", "-4vh");
  card.style.setProperty("--swipe-rotate", `${direction * 18}deg`);
  card.style.opacity = "0";
  setTimeout(() => {
    state.review.swiping = false;
    decideCurrent(status);
  }, 180);
}

function ensureReviewDeck() {
  if (state.review.deck.length && state.review.index < state.review.deck.length) return;
  const work = workItems();
  state.review.deck = work.map((item) => item.id);
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
  const work = workItems();
  const shortlist = itemsWithStatus("shortlist");
  const rejected = itemsWithStatus("rejected");
  const groups = { work, shortlist, rejected };
  const all = uniqueItems([...work, ...shortlist, ...rejected]);
  const rows = state.mineFilter === "all" ? all : groups[state.mineFilter] || all;
  $$("[data-mine-filter]").forEach((button) => {
    const count = button.dataset.mineFilter === "all" ? all.length : groups[button.dataset.mineFilter]?.length || 0;
    const labels = { all: "Alle", work: "Kandidater", shortlist: "Aktuelle", rejected: "Uaktuelle" };
    button.textContent = `${labels[button.dataset.mineFilter]} (${formatNumber(count)})`;
    button.classList.toggle("active", button.dataset.mineFilter === state.mineFilter);
  });
  const preview = $("#minePreview");
  preview.replaceChildren(...rows.slice(0, 16).map((item) => listManageRow(item, itemStatusKind(item))));
  if (!rows.length) {
    preview.innerHTML = `
      <div class="emptyState compact">
        <p>${all.length ? "Ingen navn i denne kategorien ennå." : "Listen er tom. Oppdag navn dere vil utforske, så samles de her."}</p>
        <div class="emptyActions"><button data-go-tab="explore" type="button">Oppdag navn</button></div>
      </div>
    `;
  }
  const recent = $("#recentDecisions");
  recent.replaceChildren(...state.history.slice(0, 6).map((entry) => decisionRow(entry)));
  if (!state.history.length) {
    recent.innerHTML = `
      <div class="emptyState compact">
        <p>${work.length ? `${formatNumber(work.length)} kandidater klare til vurdering.` : "Listen er tom. Start med navn dere allerede liker, eller finn kandidater med data."}</p>
        <div class="emptyActions">
          <button data-go-tab="review" type="button">Vurder navn</button>
          <button data-go-tab="explore" type="button">Oppdag flere</button>
        </div>
      </div>
    `;
  }
}

function itemStatusKind(item) {
  return state.status[item.id] === "shortlist" ? "shortlist" : state.status[item.id] === "rejected" ? "rejected" : "work";
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
  const title = kind === "work" ? "Kandidater" : kind === "shortlist" ? "Aktuelle" : "Uaktuelle";
  const rows = kind === "work" ? workItems() : itemsWithStatus(kind);
  openSubscreen(title, `
    <p class="subLead">${kind === "work" ? "Navn dere vurderer videre. Sammenlign dem med data, eller gå gjennom dem ett og ett." : kind === "shortlist" ? "Navn som fortsatt kjennes aktuelle." : "Navn som er valgt bort."}</p>
    <div class="sectionRow"><h3>${formatNumber(rows.length)} navn</h3><button id="listPrimaryAction" type="button">${kind === "work" ? "Utforsk" : "Del liste"}</button></div>
    <div id="mineListRows" class="nameRows"></div>
    ${rows.length ? `<button class="secondaryWide" data-clear-list="${kind}" type="button">${kind === "work" ? "Tøm kandidater" : kind === "shortlist" ? "Tøm aktuelle" : "Tøm uaktuelle"}</button>` : ""}
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

function workItems() {
  return [...state.selected].map((id) => state.itemsById.get(id)).filter((item) => item && !state.status[item.id]);
}

function clearNameList(kind) {
  const rows = kind === "work" ? workItems() : itemsWithStatus(kind);
  if (!rows.length) return;
  if (kind === "work") {
    rows.forEach((item) => state.selected.delete(item.id));
  } else {
    rows.forEach((item) => {
      delete state.status[item.id];
      state.selected.add(item.id);
    });
    state.history = state.history.filter((entry) => state.status[entry.id]);
    saveStatus();
  }
  resetReviewDeck();
  saveWorkSelection();
  closeSubscreen();
  renderAll();
  updateUrl();
  toast(kind === "work" ? "Kandidatlisten tømt" : kind === "shortlist" ? "Aktuelle tømt" : "Uaktuelle tømt");
}

function listManageRow(item, kind) {
  const row = nameRow(item);
  row.classList.add("manageNameRow", `status-${kind}`);
  const statusMeta = {
    work: ["list", "Kandidat"],
    shortlist: ["heart", "Aktuelt"],
    rejected: ["x", "Uaktuelt"],
  }[kind] || ["list", "Kandidat"];
  const rank = $(".rank", row);
  rank.innerHTML = `<svg><use href="#icon-${statusMeta[0]}"></use></svg>`;
  const meta = $(".nameMain small", row);
  meta.textContent = `${statusMeta[1]} · ${meta.textContent}`;
  $(".addButton", row).remove();
  const menu = document.createElement("button");
  menu.type = "button";
  menu.className = "moreButton";
  menu.textContent = "⋯";
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    openSubscreen(item.name, `
      <div class="listMenu">
        <button data-status="${item.id}" data-next="neutral" data-close-after="true" type="button"><span class="miniIcon blue"><svg><use href="#icon-list"></use></svg></span><span><strong>Sett som kandidat</strong><small>Flytt tilbake uten aktuell/uaktuell-status</small></span><em>›</em></button>
        <button data-status="${item.id}" data-next="shortlist" data-close-after="true" type="button"><span class="miniIcon green"><svg><use href="#icon-heart"></use></svg></span><span><strong>Marker aktuell</strong><small>Flytt til favoritter</small></span><em>›</em></button>
        <button data-status="${item.id}" data-next="rejected" data-close-after="true" type="button"><span class="miniIcon red"><svg><use href="#icon-x"></use></svg></span><span><strong>Marker uaktuell</strong><small>Skjul fra vanlige forslag</small></span><em>›</em></button>
        <button data-remove="${item.id}" data-close-after="true" type="button"><span class="miniIcon"><svg><use href="#icon-x"></use></svg></span><span><strong>Fjern fra listen</strong><small>Påvirker ikke vurderingen</small></span><em>›</em></button>
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
  openSubscreen("Innstillinger", `
    <form id="schoolSettingsForm" class="formStack settingsBlock">
      <h3>Skoleestimat</h3>
      <p class="subLead">Anslår hvor mange elever med navnet som kan finnes på barnets trinn og i hele skoleløpet.</p>
      <label>Barnets fødselsår<input name="birthYear" type="number" min="${state.firstYear}" max="${state.latestYear}" value="${state.school.birthYear}" /></label>
      <label>Elever per årskull<input name="gradeSize" type="number" min="1" step="1" value="${state.school.gradeSize}" /></label>
      <label>Antall trinn i skoleløpet<input name="grades" type="number" min="1" step="1" value="${state.school.grades}" /></label>
      <button class="primaryWide" type="submit">Lagre estimat</button>
    </form>
    <div class="listMenu">
      <button id="exportJson" type="button"><span class="miniIcon blue"><svg><use href="#icon-share"></use></svg></span><span><strong>Eksporter beslutninger</strong><small>JSON-fil for import senere</small></span><em>›</em></button>
      <button id="exportStatusCsv" type="button"><span class="miniIcon green"><svg><use href="#icon-list"></use></svg></span><span><strong>Eksporter CSV</strong><small>Aktuelle og uaktuelle navn</small></span><em>›</em></button>
      <button id="importJson" type="button"><span class="miniIcon yellow"><svg><use href="#icon-gear"></use></svg></span><span><strong>Importer beslutninger</strong><small>Slår sammen med lokale valg</small></span><em>›</em></button>
    </div>
  `);
  $("#schoolSettingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.school.birthYear = clampYear(Number(form.get("birthYear")));
    state.school.gradeSize = Math.max(1, Math.round(Number(form.get("gradeSize")) || 100));
    state.school.grades = Math.max(1, Math.round(Number(form.get("grades")) || 7));
    saveSchoolSettings();
    renderAll();
    closeSubscreen(false);
    toast("Skoleestimat lagret");
  });
  $("#exportJson").addEventListener("click", exportDecisionsJson);
  $("#exportStatusCsv").addEventListener("click", exportDecisionsCsv);
  $("#importJson").addEventListener("click", () => $("#importInput").click());
}

function openSubscreen(title, html, action, options = {}) {
  const nextMode = options.mode || "default";
  if (state.subscreenMode === "search" && nextMode !== "search") state.returnToSearch = true;
  state.subscreenMode = nextMode;
  $("#subTitle").textContent = title;
  $("#subContent").innerHTML = html;
  $("#subscreen").classList.add("open");
  $("#subscreen").classList.toggle("searchMode", nextMode === "search");
  $("#subscreen").setAttribute("aria-hidden", "false");
  $("#subAction").onclick = action || null;
  $("#subAction").hidden = !action;
  if (!action) $("#subAction").replaceChildren();
  bindSubscreenButtons();
}

function closeSubscreen(render = true) {
  if (state.subscreenMode !== "search" && state.returnToSearch) {
    state.returnToSearch = false;
    openSearchView();
    return;
  }
  if (state.subscreenMode === "search") state.returnToSearch = false;
  state.subscreenMode = "default";
  $("#subscreen")?.classList.remove("open");
  $("#subscreen")?.classList.remove("searchMode");
  $("#subscreen")?.setAttribute("aria-hidden", "true");
  if (render) renderAll();
}

function bindSubscreenButtons(root = document) {
  $$("[data-quick-name]", root).forEach((button) => button.addEventListener("click", () => addQuickName(button.dataset.quickName)));
  $$("[data-add]", root).forEach((button) => button.addEventListener("click", () => addToWork(state.itemsById.get(button.dataset.add))));
  $$("[data-status]", root).forEach((button) => button.addEventListener("click", () => {
    setNameStatus(button.dataset.status, button.dataset.next);
    if (button.dataset.closeAfter === "true") closeSubscreen();
  }));
  $$("[data-remove]", root).forEach((button) => button.addEventListener("click", () => {
    removeFromWork(button.dataset.remove);
    if (button.dataset.closeAfter === "true") closeSubscreen();
  }));
  $$("[data-clear-list]", root).forEach((button) => button.addEventListener("click", () => clearNameList(button.dataset.clearList)));
  $$("[data-similar]", root).forEach((button) => button.addEventListener("click", () => openSimilar(state.itemsById.get(button.dataset.similar))));
  $$("[data-school-settings]", root).forEach((button) => button.addEventListener("click", openBackup));
}

function addQuickName(name) {
  const item = findNameFromUrlToken(name);
  if (!item) return;
  addToWork(item);
}

function metricLabel(metric) {
  return { count: "Antall", shareSex: "Andel", rank: "Rang" }[metric] || "Antall";
}

function compareMetricHelp() {
  if (state.compare.metric === "rank") return "Lavere kurve betyr høyere plassering.";
  if (state.compare.metric === "shareSex") return "Best for å sammenligne jente- og guttenavn.";
  return "Viser hvor mange barn som fikk navnet hvert år.";
}

function smoothLabel(value) {
  return Number(value) === 1 ? "uten glatting" : `${formatNumber(value)} års glatting`;
}

function filteredRows() {
  let rows = state.query ? searchRows(state.query) : state.data.names.slice();
  rows = rows.filter((item) => state.status[item.id] !== "rejected");
  if (state.filters.rules.some(searchRuleError)) return [];
  state.filters.rules.filter(searchRuleReady).forEach((rule) => {
    rows = rows.filter((item) => searchRuleMatches(item, rule));
  });
  if (state.query) return rows;
  return rows.sort((a, b) => (a.currentRank ?? 9999) - (b.currentRank ?? 9999) || a.name.localeCompare(b.name, "no"));
}

function similarRows(reference, mode, sexFilter = state.similarSex) {
  const targetSex = sexFilter === "same" ? reference.sex : sexFilter;
  return state.data.names
    .filter((item) => item.id !== reference.id && (targetSex === "alle" || item.sex === targetSex) && state.status[item.id] !== "rejected")
    .filter((item) => similarCandidateHasSignal(item, mode))
    .map((item) => {
      if (mode === "text") {
        const distance = levenshtein(normalize(reference.name), normalize(item.name));
        return { item, similarity: 1 / (1 + distance), reason: "tekstlikhet" };
      }
      if (mode === "shareLevel") {
        const latestDiff = Math.abs((pointInYear(reference, state.latestYear)?.[3] ?? 0) - (pointInYear(item, state.latestYear)?.[3] ?? 0));
        const peakDiff = Math.abs((peakShare(reference) ?? 0) - (peakShare(item) ?? 0));
        return { item, similarity: 1 / (1 + latestDiff * 10 + peakDiff * 4), reason: "lik andel i årskullet" };
      }
      if (mode === "popularity") {
        const rankDiff = Math.abs((pointInYear(reference, state.latestYear)?.[2] ?? 999) - (pointInYear(item, state.latestYear)?.[2] ?? 999));
        const peakDiff = Math.abs(reference.peakCount - item.peakCount);
        return { item, similarity: 1 / (1 + rankDiff / 15 + peakDiff / 500), reason: "lik popularitet" };
      }
      const similarity = curveSimilarity(reference, item, mode === "curveCount" ? "count" : "shareSex");
      return { item, similarity, reason: mode === "curveCount" ? "lik antallskurve" : "lik kurveform" };
    })
    .filter((row) => Number.isFinite(row.similarity))
    .sort((a, b) => b.similarity - a.similarity || a.item.name.localeCompare(b.item.name, "no"));
}

function similarCandidateHasSignal(item, mode) {
  if (mode === "text") return true;
  if (!hasHistory(item)) return false;
  const activeYears = allPoints(item).filter((point) => (point.count ?? 0) > 0).length;
  if (mode === "curve") return activeYears >= 12 && (latestCount(item) >= 20 || item.peakCount >= 100);
  return activeYears >= 8 && (latestCount(item) >= 5 || item.peakCount >= 30);
}

function curveSimilarity(a, b, metric = "shareSex") {
  const leftByYear = new Map(allPoints(a).filter((p) => p.year >= state.compare.fromYear && p.year <= state.compare.toYear).map((p) => [p.year, p[metric]]));
  const pairs = allPoints(b)
    .filter((p) => p.year >= state.compare.fromYear && p.year <= state.compare.toYear)
    .map((p) => [leftByYear.get(p.year), p[metric]])
    .filter(([left, right]) => left != null && right != null && Number.isFinite(left) && Number.isFinite(right));
  if (pairs.length < 3) return 0;
  return Math.max(0, Math.min(1, (pearson(zScore(pairs.map(([left]) => left)), zScore(pairs.map(([, right]) => right))) + 1) / 2));
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
  const palette = ["#ff7358", "#79a95b", "#5aa7e8", "#f1b840", "#9f7bdd", "#3daea3", "#d95f91", "#5268d8"];
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
  return (item.series || []).map(([yearIndex, count, rank, shareSex]) => {
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
  return (item.series || []).find(([yearIndex]) => yearIndex === index) ?? null;
}

function latestCount(item) {
  return pointInYear(item, state.latestYear)?.[1] ?? 0;
}

function effectiveMetric() {
  return state.compare.metric;
}

function metricValue(point, item, metric) {
  if (metric === "shareSex") return point.shareSex;
  if (metric === "rank") return point.rank;
  return point.count;
}

function yAxis(metric) {
  const title = { count: "Antall", shareSex: "Andel (%)", rank: "Rang" }[metric] || "Antall";
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
  if (!hasHistory(item)) return "";
  const points = allPoints(item).filter((point) => point.year >= 1950);
  const values = points.map((point) => point.count ?? point.shareSex ?? 0);
  const max = Math.max(...values, 1);
  const coords = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - (value / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = item.sex === "jente" ? "#ff7358" : "#5aa7e8";
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${coords.join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function trendScore(item) {
  const points = allPoints(item).filter((point) => point.year >= state.latestYear - 10);
  const first = points[0]?.count ?? 0;
  const last = points.at(-1)?.count ?? 0;
  return last - first;
}

function trendLabel(item) {
  if (!hasHistory(item)) return hasCapability(item, "norwayUse") ? "Dokumentert i Norge" : "Grunnopplysninger";
  const score = trendScore(item);
  if (score > 20) return "Stigende trend siste år";
  if (score < -20) return "Roligere utvikling siste år";
  return "Historisk utvikling tilgjengelig";
}

function itemMood(item) {
  if (!hasHistory(item)) return hasCapability(item, "norwayUse") ? "i bruk i Norge" : "grunnopplysninger";
  const latest = pointInYear(item, state.latestYear);
  const rank = latest?.[2] ?? 9999;
  const trend = trendScore(item);
  if (trend > 35) return "på vei opp";
  if (latestCount(item) < 25) return "særpreg";
  if (rank <= 20) return "trygt nå";
  if (trend < -25) return "roligere";
  return item.sex;
}

function schoolEstimateForYear(item, birthYear, gradeSize) {
  const point = pointInYear(item, birthYear);
  const share = point?.[3] ?? 0;
  return (share / 100) * gradeSize;
}

function schoolEstimate(item, birthYear, gradeSize, grades) {
  const grade = schoolEstimateForYear(item, birthYear, gradeSize);
  const school = Array.from({ length: Math.max(1, Math.round(grades)) }, (_, index) => birthYear - index)
    .filter((year) => year >= state.firstYear && year <= state.latestYear)
    .reduce((sum, year) => sum + schoolEstimateForYear(item, year, gradeSize), 0);
  return { grade, school };
}

function schoolEstimateForCurrentSettings(item) {
  return schoolEstimate(item, state.school.birthYear, state.school.gradeSize, state.school.grades);
}

function hasCapability(item, key) {
  if (item?.coverage && Object.prototype.hasOwnProperty.call(item.coverage, key)) return Boolean(item.coverage[key]);
  if (key === "identity") return Boolean(item?.name && (item?.gender || item?.sex));
  if (key === "norwayUse") return Boolean(item?.series?.length);
  if (key === "birthSeries") return Boolean(item?.series?.length);
  return false;
}

function hasHistory(item) {
  return hasCapability(item, "birthSeries");
}

function hasPopulationHistory(item) {
  return hasCapability(item, "populationSeries") && Boolean(item?.populationSeries?.length);
}

function populationHistoryStats(item) {
  if (!hasPopulationHistory(item)) return null;
  const first = item.populationSeries[0];
  const last = item.populationSeries[item.populationSeries.length - 1];
  return {
    firstYear: first[0],
    firstCount: first[1],
    lastYear: last[0],
    lastCount: last[1],
    change: last[1] - first[1],
  };
}

function populationHistoryMarkup(item, latestBirthPoint) {
  const stats = populationHistoryStats(item);
  if (!stats) return "";
  const birthRank = latestBirthPoint?.[2] ? `#${formatNumber(latestBirthPoint[2])}` : "–";
  const populationRank = item.populationRank ? `#${formatNumber(item.populationRank)}` : "–";
  return `
    <section class="subCard populationCard">
      <div class="populationHeading">
        <span class="sourcePeople"><svg aria-hidden="true"><use href="#icon-people"></use></svg></span>
        <div>
          <small>I befolkningen</small>
          <h3>${formatNumber(stats.lastCount)} navnebærere i ${stats.lastYear}</h3>
          <p>Alle registrerte personer, uansett alder.</p>
        </div>
      </div>
      <div class="populationRankCompare" aria-label="Rangering blant nyfødte og i befolkningen">
        <span><small>Blant nyfødte</small><b>${birthRank}</b><em>${state.latestYear}</em></span>
        <span><small>I hele befolkningen</small><b>${populationRank}</b><em>${stats.lastYear}</em></span>
      </div>
      <div class="populationMiniChart">${populationSparklineSvg(item)}</div>
      <div class="populationChange">
        <span><small>${stats.firstYear}</small><b>${formatNumber(stats.firstCount)}</b></span>
        <span><small>${stats.lastYear}</small><b>${formatNumber(stats.lastCount)}</b></span>
        <span><small>Endring</small><b>${stats.change > 0 ? "+" : ""}${formatNumber(stats.change)}</b></span>
      </div>
      <p class="populationNote">Dette er bestand ved årets slutt, ikke antall barn som fikk navnet. Kurven påvirkes også av innvandring, dødsfall og navneendringer, og brukes derfor ikke i trend- eller skoleberegningene.</p>
    </section>
  `;
}

function populationSparklineSvg(item, width = 330, height = 150) {
  const rows = item?.populationSeries || [];
  if (!rows.length) return "";
  const padX = 18;
  const padTop = 16;
  const padBottom = 24;
  const minYear = rows[0][0];
  const maxYear = rows[rows.length - 1][0];
  const counts = rows.map((row) => row[1]);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const x = (year) => padX + ((year - minYear) / Math.max(1, maxYear - minYear)) * (width - padX * 2);
  const y = (count) => padTop + (1 - ((count - minCount) / Math.max(1, maxCount - minCount))) * (height - padTop - padBottom);
  const points = rows.map(([year, count]) => `${x(year).toFixed(1)},${y(count).toFixed(1)}`).join(" ");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Navnebærere i befolkningen fra ${minYear} til ${maxYear}">
      <line x1="${padX}" y1="${height - padBottom}" x2="${width - padX}" y2="${height - padBottom}" class="populationAxis"></line>
      <polyline points="${points}" class="populationLine"></polyline>
      <circle cx="${x(rows.at(-1)[0]).toFixed(1)}" cy="${y(rows.at(-1)[1]).toFixed(1)}" r="4" class="populationDot"></circle>
      <text x="${padX}" y="${height - 5}" class="populationAxisLabel">${minYear}</text>
      <text x="${width - padX}" y="${height - 5}" text-anchor="end" class="populationAxisLabel">${maxYear}</text>
    </svg>
  `;
}

function availableTrendScore(item) {
  return hasHistory(item) ? trendScore(item) : 0;
}

function signedNumber(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
}

function identityCoverageLabel(item) {
  const labels = [];
  if (hasCapability(item, "meaning")) labels.push("betydning");
  if (hasCapability(item, "origin")) labels.push("opphav");
  return labels.length ? `Grunnopplysninger · ${labels.join(" og ")}` : "Grunnopplysninger";
}

function sourceListMarkup(item) {
  const catalog = state.data?.meta?.sourceCatalog || {};
  const sources = (item.sourceRefs || []).map((id) => ({ id, ...catalog[id] })).filter((source) => source.label);
  if (!sources.length) return "";
  return `
    <section class="subCard sourceNote">
      <h3>Kilder og datagrunnlag</h3>
      <div class="sourceLinks">
        ${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener"><strong>${escapeHtml(source.label)}</strong><small>${escapeHtml(source.publisher || "")} · ${escapeHtml(source.license || "")}</small></a>`).join("")}
      </div>
    </section>
  `;
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
  items.forEach((item) => allPoints(item).filter((p) => p.year >= state.compare.fromYear && p.year <= state.compare.toYear).forEach((p) => rows.push([item.name, item.sex, p.year, p.count ?? "", p.rank ?? "", p.shareSex ?? ""])));
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

function sexIconMarkup(item) {
  const symbol = item.sex === "jente" ? "female" : "male";
  return `<svg class="sexIcon ${item.sex}" aria-label="${escapeHtml(item.sex)}" role="img"><use href="#icon-${symbol}"></use></svg>`;
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
