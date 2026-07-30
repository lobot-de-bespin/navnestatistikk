import { chromium } from "/home/openclaw/.openclaw/workspace/tools/mobile-visual/node_modules/playwright/index.mjs";

const url = process.argv[2] || "http://127.0.0.1:4173/";
const mode = process.argv[3] || "home";
const output = process.argv[4] || `/tmp/navnestatistikk-${mode}.png`;
const width = Number(process.argv[5] || 390);
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "no-NO",
    serviceWorkers: "block",
  });
  if (mode === "empty-recent") {
    await context.addInitScript((recent) => {
      localStorage.setItem("navnestatistikk:recentSearches:v2", JSON.stringify(recent));
    }, ["Fe", "Fer", "Ferd", "Al", "Alo", "Alon"]);
  }
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".discoverySection");
  if (mode !== "home") {
    await page.click("#openSearchView");
    if (mode === "results") await page.fill("#searchViewInput", "e");
    if (mode === "dataset") {
      await page.click("#toggleSearchFilters");
      await page.click("#addSearchRule");
      await page.selectOption(".filterRule [data-rule-prop='type']", "dataset");
      await page.selectOption(".filterRule [data-rule-prop='value']", "snl-4024");
    }
    if (mode === "filters") {
      await page.click("#toggleSearchFilters");
      await page.click("#addSearchRule");
      await page.selectOption(".filterRule [data-rule-prop='type']", "gender");
      await page.selectOption(".filterRule [data-rule-prop='value']", "gutt");
      await page.click("#addSearchRule");
      await page.locator(".filterRule").nth(1).locator("[data-rule-prop='op']").selectOption("starts");
      await page.locator(".filterRule").nth(1).locator("[data-rule-prop='value']").fill("A");
      await page.click("#addSearchRule");
      await page.locator(".filterRule").nth(2).locator("[data-rule-prop='op']").selectOption("regex");
      await page.locator(".filterRule").nth(2).locator("[data-rule-prop='value']").fill("r$");
      await page.locator(".filterRule").nth(2).locator("[data-rule-action='negate']").click();
    }
    if (mode === "review" || mode === "swipe") {
      await page.fill("#searchViewInput", "Ferdinand");
      await page.locator("#searchResultList .addButton").first().click();
      await page.click(".tabBar [data-tab='review']");
      await page.waitForTimeout(1800);
      if (mode === "swipe") {
        const card = await page.locator("#reviewCard").boundingBox();
        await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
        await page.mouse.down();
        await page.mouse.move(card.x + card.width / 2 + 55, card.y + card.height / 2 + 150, { steps: 3 });
      }
    }
  }
  await page.screenshot({ path: output, fullPage: false });
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".searchMode .subscreenPanel")?.getBoundingClientRect();
    const workspace = document.querySelector(".searchWorkspace")?.getBoundingClientRect();
    const filterPanel = document.querySelector(".searchFilterPanel")?.getBoundingClientRect();
    const filterRules = [...document.querySelectorAll(".filterRule")].map((node) => node.getBoundingClientRect().height);
    const reviewCard = document.querySelector("#reviewCard")?.getBoundingClientRect();
    const reviewActions = document.querySelector("#view-review .reviewActions")?.getBoundingClientRect();
    const tabBar = document.querySelector(".tabBar")?.getBoundingClientRect();
    const titleStyle = getComputedStyle(document.querySelector("#subTitle"));
    return {
      viewport: [innerWidth, innerHeight],
      documentWidth: document.documentElement.scrollWidth,
      panel: panel && [panel.left, panel.right, panel.width],
      workspace: workspace && [workspace.left, workspace.right, workspace.width],
      filterPanelHeight: filterPanel?.height || 0,
      filterRuleHeights: filterRules,
      reviewCard: reviewCard && [reviewCard.top, reviewCard.bottom, reviewCard.height],
      reviewActions: reviewActions && [reviewActions.top, reviewActions.bottom, reviewActions.height],
      tabBarTop: tabBar?.top || 0,
      titleFont: [titleStyle.fontFamily, titleStyle.fontStyle, titleStyle.fontWeight],
    };
  });
  console.log(JSON.stringify({ output, metrics }));
} finally {
  await browser.close();
}
