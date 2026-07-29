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
    const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(searchOverflow <= 1, `${width}px modular filters overflow by ${searchOverflow}px`);
    await page.fill("#searchViewInput", "Nora");
    await page.locator("#searchResultList .nameMain").first().click();
    await page.locator(".populationCard").scrollIntoViewIfNeeded();
    const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(detailOverflow <= 1, `${width}px enriched detail overflows by ${detailOverflow}px`);
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
      };
    });
    assert(catalogue.names === 1974 && catalogue.boys === 932, `Population enrichment changed the birth catalogue: ${JSON.stringify(catalogue)}`);
    assert(catalogue.enriched > 1900, `Too few birth names were enriched: ${catalogue.enriched}`);
    assert(catalogue.invalidPopulationOnly === 0, `Population-only names leaked into the catalogue: ${catalogue.invalidPopulationOnly}`);
    await page.click("#subBack");
    assert((await page.locator("#searchViewInput").inputValue()) === "Nora", "Search state was not restored after detail");

    await page.fill("#searchViewInput", "");
    await page.click("#toggleSearchFilters");
    await page.click("#addSearchRule");
    await page.selectOption(".filterRule [data-rule-prop='type']", "gender");
    await page.selectOption(".filterRule [data-rule-prop='value']", "gutt");
    const boyCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(boyCount === 932, `Expected 932 boy names, got ${boyCount}`);

    await page.click("#addSearchRule");
    const secondRule = page.locator(".filterRule").nth(1);
    await secondRule.locator("[data-rule-prop='op']").selectOption("starts");
    await secondRule.locator("[data-rule-prop='value']").fill("A");
    const aBoyCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(aBoyCount > 0 && aBoyCount < boyCount, `AND rule did not narrow boy names: ${aBoyCount} of ${boyCount}`);

    await page.click("#addSearchRule");
    const thirdRule = page.locator(".filterRule").nth(2);
    await thirdRule.locator("[data-rule-prop='op']").selectOption("regex");
    await thirdRule.locator("[data-rule-prop='value']").fill("r$");
    await thirdRule.locator("[data-rule-action='negate']").click();
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
    assert(Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, "")) === 932, "Removing rules did not restore the gender result set");
    await page.click("#reviewAllSearchResults");
    assert((await page.locator("#reviewCounter").textContent()) === "1 av 932", "Bulk review did not retain complete result set");
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
