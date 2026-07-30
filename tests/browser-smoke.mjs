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
    assert(Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, "")) === 932, "SSB dataset filter did not isolate birth names");
    await secondRule.locator("[data-rule-prop='value']").selectOption("snl-4024");
    assert(Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, "")) === 2728, "SNL dataset filter did not isolate the boys overview");
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
    for (const name of ["Noah", "Nora"]) {
      await page.fill("#searchViewInput", name);
      await page.locator("#searchResultList .addButton").first().click();
    }
    await page.click(".tabBar [data-tab='review']");

    const firstCard = await page.locator("#reviewCard").boundingBox();
    const firstName = await page.locator("#reviewCard h2").textContent();
    await page.mouse.move(firstCard.x + firstCard.width / 2, firstCard.y + firstCard.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstCard.x + firstCard.width / 2 + 40, firstCard.y + firstCard.height / 2 + 150, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(180);
    assert((await page.locator("#reviewCard h2").textContent()) === firstName, "Neutral middle zone accepted an ambiguous swipe");

    await page.mouse.move(firstCard.x + firstCard.width / 2, firstCard.y + firstCard.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstCard.x + firstCard.width / 2 + 55, firstCard.y + firstCard.height / 2 + 150, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(380);
    assert((await page.locator("#reviewCard h2").textContent()) !== firstName, "Diagonal thumb swipe toward the right edge snapped back");

    const secondCard = await page.locator("#reviewCard").boundingBox();
    await page.mouse.move(secondCard.x + secondCard.width / 2, secondCard.y + secondCard.height / 2);
    await page.mouse.down();
    await page.mouse.move(secondCard.x + secondCard.width / 2 - 90, secondCard.y + secondCard.height / 2, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(380);
    const decisions = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("navnestatistikk:nameStatus:v1") || "{}")));
    assert(decisions.includes("shortlist") && decisions.includes("rejected"), `Review swipes did not record both directions: ${decisions.join(", ")}`);
    assert(errors.length === 0, `Review swipe JS errors: ${errors.join("; ")}`);
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
    assert(detail.includes("Grunnopplysninger"), "Identity-only name has no graceful detail state");
    assert(detail.includes("ikke norske fødselstall"), "Identity-only name was misrepresented as birth statistics");
    assert(errors.length === 0, `Identity-only JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  console.log("Browser smoke tests passed");
} finally {
  await browser.close();
}
