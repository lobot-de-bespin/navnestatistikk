import { chromium } from "/home/openclaw/.openclaw/workspace/tools/mobile-visual/node_modules/playwright/index.mjs";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/";
const widths = [360, 390, 430];
const browser = await chromium.launch({ headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openPage(width = 390, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    serviceWorkers: "block",
  });
  if (options.recent?.length) {
    await context.addInitScript((recent) => {
      localStorage.setItem("navnestatistikk:recentSearches:v2", JSON.stringify(recent));
    }, options.recent);
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector(".discoverySection", { timeout: 15000 });
  return { context, page, errors };
}

try {
  for (const width of widths) {
    const { context, page, errors } = await openPage(width, {
      recent: ["Fe", "Fer", "Ferd", "Al", "Alo", "Alon"],
    });
    assert(await page.locator(".tabBar [data-tab='explore'] span").textContent() === "Oppdag", "Oppdag label missing");
    assert(await page.locator(".discoverySection").count() >= 4, "Discovery sections missing");
    assert(await page.locator(".discoveryNameCard").count() >= 20, "Discovery cards missing");
    const discoveryFont = await page.locator(".discoveryNameMain strong").first().evaluate((node) => getComputedStyle(node).fontFamily);
    assert(!/Georgia|Times|(^|,)\s*serif/i.test(discoveryFont), `Discovery names still use serif: ${discoveryFont}`);
    const homeSearchAppearance = await page.locator("#openSearchView").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const labelStyle = getComputedStyle(node.querySelector("#homeSearchLabel"));
      return {
        height: rect.height,
        radius: Number.parseFloat(style.borderRadius),
        borderWidth: Number.parseFloat(style.borderTopWidth),
        label: node.textContent.replace(/\s+/g, " ").trim(),
        labelWeight: Number(labelStyle.fontWeight),
        helperCount: node.querySelectorAll("small, em").length,
      };
    });
    assert(homeSearchAppearance.height <= 54 && homeSearchAppearance.radius <= 16 && homeSearchAppearance.borderWidth >= 1, `${width}px Oppdag search does not look like an input: ${JSON.stringify(homeSearchAppearance)}`);
    assert(homeSearchAppearance.label === "Søk etter navn" && homeSearchAppearance.helperCount === 0 && homeSearchAppearance.labelWeight < 700, `${width}px Oppdag search still reads like a feature card: ${JSON.stringify(homeSearchAppearance)}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `${width}px home overflows by ${overflow}px`);
    await page.click("#openSearchView");
    const emptyGeometry = await page.evaluate(() => {
      const bar = document.querySelector(".searchViewBar").getBoundingClientRect();
      const intro = document.querySelector(".searchEmptyIntro").getBoundingClientRect();
      const workspace = document.querySelector(".searchWorkspace").getBoundingClientRect();
      const rail = document.querySelector(".searchEmptyIntro .chipRail").getBoundingClientRect();
      return {
        bar: { left: bar.left, right: bar.right, width: bar.width },
        intro: { left: intro.left, right: intro.right, width: intro.width },
        rail: { left: rail.left, right: rail.right, width: rail.width },
        workspace: { left: workspace.left, right: workspace.right, width: workspace.width },
        viewport: innerWidth,
      };
    });
    assert(Math.abs(emptyGeometry.bar.width - emptyGeometry.workspace.width) <= 1, `${width}px empty search bar changes workspace width`);
    assert(emptyGeometry.intro.width < emptyGeometry.workspace.width, `${width}px empty search prompt is still too wide`);
    assert(emptyGeometry.bar.right <= emptyGeometry.viewport, `${width}px empty search bar is clipped`);
    assert(emptyGeometry.intro.right <= emptyGeometry.viewport, `${width}px empty search prompt is clipped`);
    assert(Math.abs(emptyGeometry.intro.left - (emptyGeometry.viewport - emptyGeometry.intro.right)) <= 1, `${width}px empty prompt is not centered`);
    assert(emptyGeometry.rail.left >= emptyGeometry.intro.left && emptyGeometry.rail.right <= emptyGeometry.intro.right, `${width}px recent-search rail escapes prompt`);
    await page.fill("#searchViewInput", "Alona");
    const resultBarWidth = await page.locator(".searchViewBar").evaluate((node) => node.getBoundingClientRect().width);
    assert(Math.abs(resultBarWidth - emptyGeometry.bar.width) <= 1, `${width}px search bar width changes after typing`);
    await page.click("#toggleSearchFilters");
    await page.click("#addSearchRule");
    await page.click("#addSearchRule");
    await page.click("#addSearchRule");
    assert(await page.locator(".filterRule").count() === 3, `${width}px filter builder did not retain three rules`);
    const compactFilterGeometry = await page.evaluate(() => ({
      panelHeight: document.querySelector(".searchFilterPanel").getBoundingClientRect().height,
      ruleHeights: [...document.querySelectorAll(".filterRule")].map((node) => node.getBoundingClientRect().height),
      negateLabels: [...document.querySelectorAll(".filterNegate")].map((node) => node.textContent.replace(/\s+/g, " ").trim()),
    }));
    assert(compactFilterGeometry.panelHeight <= 410, `${width}px filter panel is still too tall: ${compactFilterGeometry.panelHeight}px`);
    assert(compactFilterGeometry.ruleHeights.every((height) => height <= 100), `${width}px rules are not compact: ${compactFilterGeometry.ruleHeights.join(", ")}px`);
    assert(compactFilterGeometry.negateLabels.every((label) => label === "– Ikke: av"), `${width}px inactive negation is ambiguous: ${compactFilterGeometry.negateLabels.join(", ")}`);
    const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(searchOverflow <= 1, `${width}px modular filters overflow by ${searchOverflow}px`);
    await page.fill("#searchViewInput", "Nora");
    await page.locator("#searchResultList .nameMain").first().click();
    await page.locator(".populationCard").scrollIntoViewIfNeeded();
    const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(detailOverflow <= 1, `${width}px enriched detail overflows by ${detailOverflow}px`);
    await page.click("#subBack");
    await page.fill("#searchViewInput", "Ferdinand");
    await page.locator("#searchResultList .addButton").first().click();
    await page.click(".tabBar [data-tab='review']");
    const reviewGeometry = await page.evaluate(() => {
      const card = document.querySelector("#reviewCard").getBoundingClientRect();
      const actions = document.querySelector("#view-review .reviewActions").getBoundingClientRect();
      const tab = document.querySelector(".tabBar").getBoundingClientRect();
      return {
        card: { top: card.top, bottom: card.bottom, height: card.height },
        actions: { top: actions.top, bottom: actions.bottom, height: actions.height },
        tabTop: tab.top,
        viewport: innerHeight,
        progressDisplay: getComputedStyle(document.querySelector("#reviewCounter")).display,
        visibleActions: [...document.querySelectorAll("#view-review .reviewAction")].filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).length,
      };
    });
    assert(reviewGeometry.progressDisplay === "none", `${width}px duplicate review progress is still visible`);
    assert(reviewGeometry.visibleActions === 3, `${width}px review actions are not all visible`);
    assert(reviewGeometry.card.bottom <= reviewGeometry.actions.top + 1, `${width}px review actions overlap the card: ${JSON.stringify(reviewGeometry)}`);
    assert(reviewGeometry.actions.bottom <= reviewGeometry.tabTop - 4 && reviewGeometry.actions.bottom <= reviewGeometry.viewport, `${width}px review actions are clipped by navigation: ${JSON.stringify(reviewGeometry)}`);
    assert(reviewGeometry.tabTop - reviewGeometry.actions.bottom >= 10 && reviewGeometry.tabTop - reviewGeometry.actions.bottom <= 16, `${width}px review actions are not anchored directly above navigation: ${JSON.stringify(reviewGeometry)}`);
    assert(reviewGeometry.actions.top - reviewGeometry.card.bottom >= 8 && reviewGeometry.actions.top - reviewGeometry.card.bottom <= 18, `${width}px review card does not fill the space down to the actions: ${JSON.stringify(reviewGeometry)}`);
    assert(errors.length === 0, `${width}px home JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    assert(await page.locator("#subscreen").evaluate((node) => node.classList.contains("searchMode")), "Dedicated search mode did not open");
    assert(await page.locator(".tabBar [data-tab='explore']").evaluate((node) => node.classList.contains("active")), "Oppdag tab is not active in search");
    assert(await page.locator(".tabBar").isVisible(), "Bottom navigation is hidden in search");
    const navIsTopmost = await page.locator(".tabBar").evaluate((nav) => {
      const rect = nav.getBoundingClientRect();
      return Boolean(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest(".tabBar"));
    });
    assert(navIsTopmost, "Search workspace covers the bottom navigation");
    await page.fill("#searchViewInput", "e");
    await page.waitForTimeout(80);
    const eCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(eCount > 900, `Expected broad e-search, got ${eCount}`);
    const renderedRows = await page.locator("#searchResultList .nameRow").count();
    assert(renderedRows >= 100 && renderedRows < eCount, `Search rendered an invalid progressive batch: ${renderedRows} of ${eCount}`);

    await page.fill("#searchViewInput", "Nora");
    await page.locator("#searchResultList .nameMain").first().click();
    assert((await page.locator("#subTitle").textContent()) === "Nora", "Name detail did not open from search");
    const populationDetail = await page.locator(".populationCard").textContent();
    assert(populationDetail.includes("I befolkningen"), "Population enrichment is missing from name detail");
    assert(populationDetail.includes("Blant nyfødte") && populationDetail.includes("I hele befolkningen"), "Birth and population ranks are not clearly separated");
    assert(populationDetail.includes("ikke antall barn som fikk navnet"), "Population caveat is missing");
    assert(await page.locator(".populationMiniChart svg").count() === 1, "Population history chart is missing");
    const catalogue = await page.evaluate(async () => {
      const data = await (await fetch("assets/names-data.json")).json();
      return {
        names: data.names.length,
        boys: data.names.filter((item) => item.sex === "gutt").length,
        enriched: data.names.filter((item) => item.coverage?.populationSeries).length,
        invalidPopulationOnly: data.names.filter((item) => item.coverage?.populationSeries && !item.coverage?.birthSeries).length,
        snlBoys: data.names.filter((item) => item.sourceRefs?.includes("snl-4024")).length,
        snlGirls: data.names.filter((item) => item.sourceRefs?.includes("snl-4025")).length,
        snlOnly: data.names.filter((item) => item.sourceRefs?.some((source) => source.startsWith("snl-")) && !item.coverage?.birthSeries).length,
      };
    });
    assert(catalogue.names === 6007 && catalogue.boys === 2870, `SNL catalogue merge produced unexpected counts: ${JSON.stringify(catalogue)}`);
    assert(catalogue.enriched > 1900, `Too few birth names were enriched: ${catalogue.enriched}`);
    assert(catalogue.invalidPopulationOnly === 0, `Population-only names leaked into the catalogue: ${catalogue.invalidPopulationOnly}`);
    assert(catalogue.snlBoys === 2728 && catalogue.snlGirls === 3046 && catalogue.snlOnly === 4033, `SNL overview names were not merged cleanly: ${JSON.stringify(catalogue)}`);
    await page.click("#subBack");
    assert((await page.locator("#searchViewInput").inputValue()) === "Nora", "Search state was not restored after detail");

    await page.fill("#searchViewInput", "");
    await page.click("#toggleSearchFilters");
    await page.click("#addSearchRule");
    await page.selectOption(".filterRule [data-rule-prop='type']", "gender");
    await page.selectOption(".filterRule [data-rule-prop='value']", "gutt");
    const boyCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(boyCount === 2870, `Expected 2870 boy names, got ${boyCount}`);

    await page.click("#addSearchRule");
    const secondRule = page.locator(".filterRule").nth(1);
    await secondRule.locator("[data-rule-prop='type']").selectOption("dataset");
    const datasetOptions = await secondRule.locator("[data-rule-prop='value'] option").evaluateAll((options) => options.map((option) => [option.value, option.textContent]));
    assert(JSON.stringify(datasetOptions) === JSON.stringify([
      ["ssb-10467", "SSB · fødselstall"],
      ["ssb-10501", "SSB · befolkning"],
      ["snl", "Store norske leksikon"],
    ]), `Dataset filter exposes redundant source variants: ${JSON.stringify(datasetOptions)}`);
    assert(Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, "")) === 932, "SSB dataset filter did not isolate birth names");
    await secondRule.locator("[data-rule-prop='value']").selectOption("snl");
    assert(Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, "")) === 2728, "Combined SNL dataset filter did not respect the separate boy-name rule");
    await secondRule.locator("[data-rule-action='remove']").click();

    await page.click("#addSearchRule");
    const nameRule = page.locator(".filterRule").nth(1);
    await nameRule.locator("[data-rule-prop='op']").selectOption("starts");
    await nameRule.locator("[data-rule-prop='value']").fill("A");
    const aBoyCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(aBoyCount > 0 && aBoyCount < boyCount, `AND rule did not narrow boy names: ${aBoyCount} of ${boyCount}`);

    await page.click("#addSearchRule");
    const thirdRule = page.locator(".filterRule").nth(2);
    await thirdRule.locator("[data-rule-prop='op']").selectOption("regex");
    await thirdRule.locator("[data-rule-prop='value']").fill("r$");
    await thirdRule.locator("[data-rule-action='negate']").click();
    assert((await page.locator(".filterRule").nth(2).locator(".filterNegate").textContent()).replace(/\s+/g, " ").trim() === "✓ Ikke: på", "Active negation is not explicit");
    assert(await page.locator(".filterRule").nth(2).locator(".filterNegate").getAttribute("aria-pressed") === "true", "Active negation lacks pressed state");
    const negatedRegexCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(negatedRegexCount > 0 && negatedRegexCount < aBoyCount, `Negated regex did not narrow AND results: ${negatedRegexCount} of ${aBoyCount}`);
    const visibleNames = await page.locator("#searchResultList .nameMain strong").allTextContents();
    assert(visibleNames.every((name) => /^a/iu.test(name) && !/r$/iu.test(name)), `Visible rows violate modular filters: ${visibleNames.join(", ")}`);

    await page.locator(".filterRule").nth(2).locator("[data-rule-prop='value']").fill("[");
    assert((await page.locator("#searchResultTitle").textContent()) === "Sjekk filteret", "Invalid regex was silently accepted");
    assert(await page.locator(".filterRule.invalid .filterRuleError").isVisible(), "Invalid regex has no inline error");
    await page.locator(".filterRule").nth(2).locator("[data-rule-prop='value']").fill("r$");
    await page.locator(".filterRemove").last().click();
    await page.locator(".filterRemove").last().click();
    assert(Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, "")) === 2870, "Removing rules did not restore the gender result set");
    await page.click("#reviewAllSearchResults");
    assert((await page.locator("#reviewCounter").textContent()) === "1 av 2870", "Bulk review did not retain complete result set");
    assert(errors.length === 0, `Search JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    for (const name of ["Nora", "Noah", "Emma", "Oliver", "Alma", "Elias", "Sofie"]) {
      await page.fill("#searchViewInput", name);
      await page.locator("#searchResultList .addButton").first().click();
    }
    await page.click(".tabBar [data-tab='review']");
    await page.click("#reviewShortlist");
    await page.waitForTimeout(380);
    await page.click("#reviewReject");
    await page.waitForTimeout(380);
    await page.click(".tabBar [data-tab='mine']");
    assert((await page.locator("#view-mine h1").textContent()) === "Våre navn", "Våre navn heading is missing");
    assert((await page.locator(".tabBar [data-tab='mine'] span").textContent()) === "Våre navn", "Våre navn tab label is missing");
    assert(await page.locator("#minePreview .manageNameRow").count() === 5, "Våre navn overview does not use the shorter five-name preview");
    assert((await page.locator("#openMineList").textContent()) === "Se alle (7)", "All-names full-list action has the wrong count");
    assert(await page.locator("#recentDecisions .decisionRow .moreButton").count() === 2, "Recent decisions cannot be moved between lists");

    await page.click("#openMineList");
    assert((await page.locator("#subTitle").textContent()) === "Alle navn", "All-names full list did not open");
    assert(await page.locator("#mineListRows .manageNameRow").count() === 7, "All-names full list is incomplete");
    assert(await page.locator("#mineListRows .manageNameRow .moreButton").count() === 7, "Full-list names cannot be moved between lists");
    assert(await page.locator("[data-clear-list]").count() === 0, "All-names full list exposes a clear-all action");
    await page.locator("#mineListRows .moreButton").first().click();
    await page.locator(".listMenu [data-next='shortlist']").click();
    assert((await page.locator("[data-mine-filter='shortlist']").textContent()).includes("(2)"), "Moving a full-list name to Aktuelle failed");

    await page.click("#openHistory");
    assert(await page.locator("#historyRows .decisionRow").count() === 3, "Complete review history is missing decisions");
    assert(await page.locator("#historyRows .decisionRow .moreButton").count() === 3, "Complete review history cannot move names between lists");
    await page.locator("#historyRows .moreButton").first().click();
    await page.locator(".listMenu [data-next='neutral']").click();
    assert((await page.locator("[data-mine-filter='work']").textContent()).startsWith("Til vurdering"), "Moving a recent decision back to Til vurdering failed");
    assert(errors.length === 0, `Våre navn JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    for (const name of ["Nora", "Noah", "Emma", "Oliver", "Alma", "Elias"]) {
      await page.fill("#searchViewInput", name);
      await page.locator("#searchResultList .addButton").first().click();
    }
    await page.click(".tabBar [data-tab='review']");
    for (const action of ["#reviewShortlist", "#reviewShortlist", "#reviewReject", "#reviewReject"]) {
      await page.click(action);
      await page.waitForTimeout(380);
    }
    await page.click(".tabBar [data-tab='mine']");

    const listState = () => page.evaluate(() => {
      const selected = new Set(JSON.parse(localStorage.getItem("navnestatistikk:workSelection:v2") || "[]"));
      const status = JSON.parse(localStorage.getItem("navnestatistikk:nameStatus:v1") || "{}");
      return {
        work: [...selected].filter((id) => !status[id]).sort(),
        shortlist: Object.keys(status).filter((id) => status[id] === "shortlist").sort(),
        rejected: Object.keys(status).filter((id) => status[id] === "rejected").sort(),
      };
    });
    const before = await listState();
    assert(before.work.length === 2 && before.shortlist.length === 2 && before.rejected.length === 2, `Clear-list setup failed: ${JSON.stringify(before)}`);

    await page.click("[data-mine-filter='work']");
    await page.click("#openMineList");
    assert(await page.locator("[data-clear-list='work']").isVisible(), "Til vurdering clear action is not visible at the top of the full list");
    const clearTop = await page.locator("[data-clear-list='work']").evaluate((node) => node.getBoundingClientRect().top);
    const firstRowTop = await page.locator("#mineListRows .manageNameRow").first().evaluate((node) => node.getBoundingClientRect().top);
    assert(clearTop < firstRowTop, "Til vurdering clear action is still below the list rows");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.click("[data-clear-list='work']");
    assert(JSON.stringify(await listState()) === JSON.stringify(before), "Dismissed confirmation changed a list");
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-clear-list='work']");
    const afterWork = await listState();
    assert(afterWork.work.length === 0, "Til vurdering was not emptied");
    assert(JSON.stringify(afterWork.shortlist) === JSON.stringify(before.shortlist) && JSON.stringify(afterWork.rejected) === JSON.stringify(before.rejected), "Emptying Til vurdering changed another list");

    await page.click("[data-mine-filter='shortlist']");
    await page.click("#openMineList");
    assert(await page.locator("[data-clear-list='shortlist']").isVisible(), "Aktuelle clear action is missing");
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-clear-list='shortlist']");
    const afterShortlist = await listState();
    assert(afterShortlist.shortlist.length === 0, "Aktuelle was not emptied");
    assert(afterShortlist.work.length === 0 && JSON.stringify(afterShortlist.rejected) === JSON.stringify(before.rejected), "Emptying Aktuelle changed another list");

    await page.click("[data-mine-filter='rejected']");
    await page.click("#openMineList");
    assert(await page.locator("[data-clear-list='rejected']").isVisible(), "Uaktuelle clear action is missing");
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-clear-list='rejected']");
    const afterRejected = await listState();
    assert(afterRejected.work.length === 0 && afterRejected.shortlist.length === 0 && afterRejected.rejected.length === 0, `Uaktuelle was not emptied cleanly: ${JSON.stringify(afterRejected)}`);
    assert(errors.length === 0, `Clear-list JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    await page.fill("#searchViewInput", "Noah");
    await page.locator("#searchResultList .addButton").click();
    await page.fill("#searchViewInput", "Nora");
    await page.locator("#searchResultList .addButton").first().click();
    await page.click(".tabBar [data-tab='compare']");
    assert(!(await page.locator("#compareChart").isHidden()), "Birth-series comparison chart is hidden");
    assert((await page.locator("#compareChart").getAttribute("data-traces")) === "2", "Two birth-series traces were not rendered");
    assert(errors.length === 0, `Mixed comparison JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    for (const name of ["Nora", "Bjartmar", "Ferdinand"]) {
      await page.fill("#searchViewInput", name);
      await page.locator("#searchResultList .addButton").first().click();
    }
    await page.click(".tabBar [data-tab='review']");
    assert(JSON.stringify(await page.locator(".reviewActions .reviewAction span").allTextContents()) === JSON.stringify(["Uaktuelt", "Hopp over", "Aktuelt"]), "Review buttons do not match left/right swipe directions");
    assert(JSON.stringify(await page.locator(".reviewOrder button").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))) === JSON.stringify(["Alfabetisk", "Stokket", "Popularitet"]), "Review order controls are incomplete or exposed as text");
    assert(await page.locator("[data-review-order='alpha']").getAttribute("aria-pressed") === "true", "Alphabetical review order is not the default");
    assert((await page.locator("#reviewCard h2").textContent()).trim().startsWith("Bjartmar"), "Alphabetical review order did not put Bjartmar first");
    const identityTitleTop = await page.locator("#reviewCard h2").evaluate((node) => node.getBoundingClientRect().top);
    await page.click("[data-review-order='popular']");
    assert((await page.locator("#reviewCard h2").textContent()).trim().startsWith("Nora"), "Popularity review order did not put Nora first");
    const historyTitleTop = await page.locator("#reviewCard h2").evaluate((node) => node.getBoundingClientRect().top);
    assert(Math.abs(identityTitleTop - historyTitleTop) <= 1, `Review names are not top-aligned across data profiles: ${identityTitleTop} vs ${historyTitleTop}`);
    await page.evaluate(() => { Math.random = () => 0; });
    await page.click("[data-review-order='shuffle']");
    assert(await page.locator("[data-review-order='shuffle']").getAttribute("aria-pressed") === "true", "Shuffle review order did not activate");
    assert(await page.evaluate(() => localStorage.getItem("navnestatistikk:reviewOrder:v1")) === "shuffle", "Review order was not persisted");
    await page.click("[data-review-order='alpha']");
    assert((await page.locator("#reviewCard h2").textContent()).trim().startsWith("Bjartmar"), "Returning to alphabetical review order failed");

    const firstCard = await page.locator("#reviewCard").boundingBox();
    const firstName = await page.locator("#reviewCard h2").textContent();
    await page.mouse.move(firstCard.x + firstCard.width / 2, firstCard.y + firstCard.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstCard.x + firstCard.width / 2 + 40, firstCard.y + firstCard.height / 2 + 150, { steps: 3 });
    const neutralSwipe = await page.evaluate(() => ({
      y: document.querySelector("#reviewCard").style.getPropertyValue("--swipe-y"),
      reject: document.querySelector("#reviewReject").classList.contains("is-swipe-active"),
      shortlist: document.querySelector("#reviewShortlist").classList.contains("is-swipe-active"),
    }));
    assert(Number.parseFloat(neutralSwipe.y) > 0 && Number.parseFloat(neutralSwipe.y) < 10, `Review card did not start on a gentle downward curve: ${neutralSwipe.y}`);
    assert(!neutralSwipe.reject && !neutralSwipe.shortlist, "Neutral swipe activated a review action");
    await page.mouse.move(firstCard.x + firstCard.width / 2 + 160, firstCard.y + firstCard.height / 2 + 150, { steps: 3 });
    const extendedCurveY = Number.parseFloat(await page.locator("#reviewCard").evaluate((node) => node.style.getPropertyValue("--swipe-y")));
    assert(extendedCurveY > Number.parseFloat(neutralSwipe.y) * 8, `Review curve flattened instead of continuing downward: ${neutralSwipe.y} -> ${extendedCurveY}`);
    await page.mouse.move(firstCard.x + firstCard.width / 2 + 40, firstCard.y + firstCard.height / 2 + 150, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(180);
    assert((await page.locator("#reviewCard h2").textContent()) === firstName, "Neutral middle zone accepted an ambiguous swipe");

    await page.mouse.move(firstCard.x + firstCard.width / 2, firstCard.y + firstCard.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstCard.x + firstCard.width / 2 + 55, firstCard.y + firstCard.height / 2 + 150, { steps: 3 });
    assert(await page.locator("#reviewShortlist").evaluate((node) => node.classList.contains("is-swipe-active")), "Right swipe did not visibly activate Aktuelt");
    assert(!(await page.locator("#reviewReject").evaluate((node) => node.classList.contains("is-swipe-active"))), "Right swipe also activated Uaktuelt");
    await page.mouse.up();
    await page.waitForTimeout(380);
    assert((await page.locator("#reviewCard h2").textContent()) !== firstName, "Diagonal thumb swipe toward the right edge snapped back");

    const secondCard = await page.locator("#reviewCard").boundingBox();
    await page.mouse.move(secondCard.x + secondCard.width / 2, secondCard.y + secondCard.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondCard.x + secondCard.width / 2 - 90, secondCard.y + secondCard.height / 2, { steps: 3 });
    assert(await page.locator("#reviewReject").evaluate((node) => node.classList.contains("is-swipe-active")), "Left swipe did not visibly activate Uaktuelt");
    assert(!(await page.locator("#reviewShortlist").evaluate((node) => node.classList.contains("is-swipe-active"))), "Left swipe also activated Aktuelt");
    await page.mouse.up();
    await page.waitForTimeout(380);
    const decisions = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("navnestatistikk:nameStatus:v1") || "{}")));
    assert(decisions.includes("shortlist") && decisions.includes("rejected"), `Review swipes did not record both directions: ${decisions.join(", ")}`);
    assert(errors.length === 0, `Review swipe JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    await page.fill("#searchViewInput", "Bjartmar");
    await page.locator("#searchResultList .addButton").first().click();
    await page.click(".tabBar [data-tab='review']");
    const identityCard = await page.locator("#reviewCard").textContent();
    assert(identityCard.includes("Bjartmar") && identityCard.includes("Uten fødselstall") && identityCard.includes("Store norske leksikon"), `SNL-only review card lacks concise essentials: ${identityCard}`);
    assert(!/Grunnopplysninger|Kan vurderes|Trend, rang|dokumenterer slike data/.test(identityCard), `SNL-only review card still contains technical TMI: ${identityCard}`);
    assert(await page.locator(".reviewTitleLine").evaluate((node) => node.firstElementChild?.tagName === "H2" && node.lastElementChild?.classList.contains("trendPill")), "Review name does not precede its data badge");
    assert(errors.length === 0, `SNL-only review JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    await page.route("**/assets/names-data.json", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.meta.sourceCatalog["open-test"] = {
        label: "Åpen testkilde",
        publisher: "Test",
        url: "https://example.test/",
        license: "CC BY 4.0",
      };
      data.names.push({
        id: "open-test-name",
        key: "testnavn",
        name: "Testnavn",
        sex: "jente",
        gender: "jente",
        series: [],
        coverage: {
          identity: true,
          norwayUse: true,
          birthSeries: false,
          meaning: false,
          origin: false,
          pronunciation: false,
        },
        sourceRefs: ["open-test"],
        factSources: { identity: ["open-test"], gender: ["open-test"], norwayUse: ["open-test"] },
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(data),
      });
    });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(".discoverySection", { timeout: 15000 });
    await page.click("#openSearchView");
    await page.fill("#searchViewInput", "Testnavn");
    await page.locator("#searchResultList .nameMain").click();
    const detail = await page.locator("#subContent").textContent();
    assert(detail.includes("Om navnet"), "Identity-only name has no graceful detail state");
    assert(detail.includes("ikke fødselstall"), "Identity-only name was misrepresented as birth statistics");
    assert(!detail.includes("Grunnopplysninger"), "Identity-only detail still exposes a technical coverage label");
    assert(errors.length === 0, `Identity-only JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  console.log("Browser smoke tests passed");
} finally {
  await browser.close();
}
