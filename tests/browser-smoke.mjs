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
    assert((await page.locator(".discovery-documented .discoverySectionHead button").textContent()).includes("143"), "Population-only suggestion set is incomplete");
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
    const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(searchOverflow <= 1, `${width}px search overflows by ${searchOverflow}px`);
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

    await page.fill("#searchViewInput", "Alona");
    await page.locator("#searchResultList .nameMain").first().click();
    assert((await page.locator("#subTitle").textContent()) === "Alona", "Name detail did not open from search");
    await page.click("#subBack");
    assert((await page.locator("#searchViewInput").inputValue()) === "Alona", "Search state was not restored after detail");

    await page.fill("#searchViewInput", "");
    await page.click("#toggleSearchFilters");
    await page.selectOption("#searchFilterForm [name='sex']", "gutt");
    await page.selectOption("#searchFilterForm [name='coverage']", "alle");
    await page.click("#searchFilterForm button[type='submit']");
    const boyCount = Number((await page.locator("#searchResultTitle").textContent()).replace(/\D/g, ""));
    assert(boyCount === 1005, `Expected 1005 boy names, got ${boyCount}`);
    await page.click("#reviewAllSearchResults");
    assert((await page.locator("#reviewCounter").textContent()) === "1 av 1005", "Bulk review did not retain complete result set");
    assert(errors.length === 0, `Search JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  {
    const { context, page, errors } = await openPage();
    await page.click("#openSearchView");
    await page.fill("#searchViewInput", "Alona");
    await page.locator("#searchResultList .addButton").click();
    await page.fill("#searchViewInput", "Nora");
    await page.locator("#searchResultList .addButton").first().click();
    await page.click(".tabBar [data-tab='compare']");
    assert(!(await page.locator("#compareChart").isHidden()), "Birth-series comparison chart is hidden");
    assert(!(await page.locator("#comparePopulationPanel").isHidden()), "Population-series comparison panel is hidden");
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
        registrySeries: [],
        coverage: {
          identity: true,
          norwayUse: true,
          birthSeries: false,
          populationSeries: false,
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
    assert(!detail.includes("personer med norsk personnummer"), "Identity-only name was misrepresented as population data");
    assert(errors.length === 0, `Identity-only JS errors: ${errors.join("; ")}`);
    await context.close();
  }

  console.log("Browser smoke tests passed");
} finally {
  await browser.close();
}
