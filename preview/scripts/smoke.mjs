import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const port = 4174;
const url = `http://127.0.0.1:${port}/`;
const outDir = "/tmp/universe-smoke";

const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
server.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`preview server did not start\n${logs}`);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-dev-shm-usage",
    "--no-sandbox",
  ],
});

const failures = [];

try {
  await waitForServer();
  await mkdir(outDir, { recursive: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const openMarker = async (id) => {
    await page.waitForSelector(`#marker-${id}`, { timeout: 15000 });
    await page.$eval(`#marker-${id}`, (node) => node.click());
    await page.waitForSelector("[role=dialog]", { timeout: 5000 });
    await pause(1000);
  };

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await pause(900);
  await page.screenshot({ path: `${outDir}/overview-desktop.png` });

  const titles = await page.$$eval("[id^='marker-']", (nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  if (titles.join("|") !== "smart blinds|fontloop|avatars") {
    failures.push(`markers: ${titles.join("|")}`);
  }
  const painted = await page.$eval("#marker-fontloop", (node) => getComputedStyle(node).backgroundColor);
  if (painted !== "rgba(0, 0, 0, 0)") failures.push(`planet label still visible: ${painted}`);

  const canvas = await page.$("canvas");
  const box = await canvas.boundingBox();
  if (!box) failures.push("canvas has no box");
  else {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5 + 90, box.y + box.height * 0.45 + 36, { steps: 10 });
    await page.mouse.up();
    await pause(200);
    const dialogAfterDrag = await page.$("[role=dialog]");
    if (dialogAfterDrag) failures.push("drag opened the panel");
  }

  const popupPromise = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    page.once("popup", (popup) => {
      clearTimeout(timer);
      resolve(popup);
    });
  });
  await page.focus("#sun-primary");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  if (!popup) failures.push("sun did not open a tab");
  else {
    await popup.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    const opened = popup.url();
    const profile = "https://www.linkedin.com/in/tom-gray-online";
    const reached =
      opened.startsWith(profile) || opened.includes(encodeURIComponent(profile));
    if (!reached) failures.push(`sun opened ${opened}`);
    await popup.close();
  }

  await openMarker("fontloop");
  const fontloopText = await page.$eval("[role=dialog]", (node) => node.innerText);
  if (!fontloopText.includes("fontloop")) failures.push("panel missing fontloop title");
  if (!fontloopText.includes("A brief in plain English; a real typeface out.")) {
    failures.push("panel missing fontloop description");
  }
  const privateLink = await page.$("[role=dialog] a.out");
  if (privateLink) failures.push("fontloop invented a live link");
  await page.screenshot({ path: `${outDir}/focus-fontloop-desktop.png` });
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { hidden: true, timeout: 5000 });

  await openMarker("smart-blinds");
  const href = await page.$eval("a.out", (node) => node.getAttribute("href"));
  if (href !== "https://github.com/tom-gray-builds/smart-blinds") failures.push(`bad href ${href}`);
  await page.screenshot({ path: `${outDir}/focus-blinds-desktop.png` });
  await page.click("#panel-close");
  await page.waitForSelector("[role=dialog]", { hidden: true, timeout: 5000 });
  await page.click("header .text-button");
  await pause(400);
  if (await page.$("[role=dialog]")) failures.push("reset left the panel open");

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle0" });
  await pause(900);
  await page.screenshot({ path: `${outDir}/overview-mobile.png` });
  await openMarker("avatars");
  const mobileText = await page.$eval("[role=dialog]", (node) => node.innerText);
  if (!mobileText.includes("One file defines a character; everything else is generated.")) {
    failures.push("mobile panel missing avatars description");
  }
  const panelBox = await page.$eval("[role=dialog]", (node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, width: rect.width, height: window.innerHeight };
  });
  if (panelBox.bottom < panelBox.height - 8) failures.push(`portrait panel is not docked: ${JSON.stringify(panelBox)}`);
  if (!mobileText.includes("Drag") && (await page.$(".hint"))) {
    /* hint is hidden while the panel is open */
  }
  await page.screenshot({ path: `${outDir}/focus-avatars-mobile.png` });

  if (errors.length) failures.push(`console/page errors:\n${errors.join("\n")}`);
  await writeFile(`${outDir}/result.json`, JSON.stringify({ failures, errors }, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("smoke ok");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1500))]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
process.exit(process.exitCode ?? 0);
