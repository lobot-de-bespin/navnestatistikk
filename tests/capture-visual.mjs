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
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".discoverySection");
  if (mode !== "home") {
    await page.click("#openSearchView");
    if (mode === "results") await page.fill("#searchViewInput", "e");
  }
  await page.screenshot({ path: output, fullPage: false });
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".searchMode .subscreenPanel")?.getBoundingClientRect();
    const workspace = document.querySelector(".searchWorkspace")?.getBoundingClientRect();
    const titleStyle = getComputedStyle(document.querySelector("#subTitle"));
    return {
      viewport: [innerWidth, innerHeight],
      documentWidth: document.documentElement.scrollWidth,
      panel: panel && [panel.left, panel.right, panel.width],
      workspace: workspace && [workspace.left, workspace.right, workspace.width],
      titleFont: [titleStyle.fontFamily, titleStyle.fontStyle, titleStyle.fontWeight],
    };
  });
  console.log(JSON.stringify({ output, metrics }));
} finally {
  await browser.close();
}
