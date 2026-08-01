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
      await page.selectOption(".filterRule [data-rule-prop='value']", "snl");
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
    if (mode === "review" || mode === "review-identity" || mode === "swipe") {
      await page.fill("#searchViewInput", mode === "review-identity" ? "Bjartmar" : "Ferdinand");
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
    if (mode === "mine") {
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
    const tabs = [...document.querySelectorAll(".tabBar button")].map((button) => {
      const rect = button.getBoundingClientRect();
      const label = button.querySelector("span");
      const labelRect = label?.getBoundingClientRect();
      const iconRect = button.querySelector("svg")?.getBoundingClientRect();
      return {
        label: label?.textContent,
        button: [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height],
        labelRect: labelRect && [labelRect.left, labelRect.top, labelRect.right, labelRect.bottom, labelRect.width, labelRect.height],
        iconRect: iconRect && [iconRect.left, iconRect.top, iconRect.right, iconRect.bottom, iconRect.width, iconRect.height],
        labelWidth: [label?.scrollWidth, label?.clientWidth],
        topmost: Boolean(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest("button") === button),
      };
    });
    const titleStyle = getComputedStyle(document.querySelector("#subTitle"));
    const iconButtons = [...document.querySelectorAll("button:has(svg)")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((button) => {
        const rect = button.getBoundingClientRect();
        const iconRect = button.querySelector("svg").getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          id: button.id,
          className: button.className,
          label: button.getAttribute("aria-label") || button.textContent.replace(/\s+/g, " ").trim(),
          button: [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height],
          icon: [iconRect.left, iconRect.top, iconRect.right, iconRect.bottom, iconRect.width, iconRect.height],
          radius: style.borderRadius,
          iconOffset: [
            (iconRect.left + iconRect.right - rect.left - rect.right) / 2,
            (iconRect.top + iconRect.bottom - rect.top - rect.bottom) / 2,
          ],
        };
      });
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
      tabs,
      iconButtons,
      titleFont: [titleStyle.fontFamily, titleStyle.fontStyle, titleStyle.fontWeight],
    };
  });
  console.log(JSON.stringify({ output, metrics }));
} finally {
  await browser.close();
}
