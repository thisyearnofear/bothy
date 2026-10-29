#!/usr/bin/env node
/**
 * Bothy look-and-fix loop: screenshot key pages, run QA checks, score against a rubric.
 * Usage: node scripts/qa-visual.mjs [--base http://localhost:3000] [--out qa/shots]
 * Exit code: 0 if all pages pass, 1 if any page fails.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : process.env.QA_BASE || "http://localhost:3000";
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "qa/shots";

const PAGES = [
  { name: "landing", path: "/", wait: ".hero h1" },
  { name: "defense", path: "/defense", wait: "main" },
  { at: 390, name: "defense-mobile", path: "/defense", wait: "main" },
  { name: "watch", path: "/watch", wait: "main" },
  { name: "pilot", path: "/pilot", wait: "main" },
  { name: "stories", path: "/defense/stories", wait: "main" },
  { name: "digest", path: "/digest", wait: "main" },
  { name: "gallium", path: "/experience/gallium", wait: "main" },
];

// Rubric weights — docs/design.md principles, each check maps to a design-doc rule.
const RUBRIC = {
  "no-horizontal-overflow": 2,
  "focus-visible-present": 2,
  "reduced-motion-safe": 1,
  "images-load": 2,
  "console-errors": 2,
  "honesty-copy-present": 1,
};

const STRICT = process.argv.includes("--strict");

const HONESTY_PATTERNS = [
  /unapproved analysis/i,
  /demonstrations, not predictive/i,
  /not an authenticated signature/i,
  /illustrative/i,
];

function score(results) {
  let total = 0, lost = 0;
  for (const [k, w] of Object.entries(RUBRIC)) {
    total += w;
    if (!results[k]) lost += w;
  }
  return { total, lost, pct: Math.round(((total - lost) / total) * 100) };
}

const browser = await chromium.launch();
const report = [];

for (const p of PAGES) {
  const width = p.at ?? 1440;
  const entry = { page: p.name, path: p.path, width, checks: {}, issues: [] };
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce", // test the worst case: all animations off
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  // API failures split by design: a 5xx with a JSON error body is the agent's
  // documented "degrade, don't lie" contract (Postgres/TuringDB/OIDC absent in
  // local dev). A 5xx with no JSON means something is actually down.
  const apiFailures = [];
  page.on("response", (r) => {
    if (r.status() < 500) return;
    const json = (r.headers()["content-type"] ?? "").includes("json");
    apiFailures.push({ url: r.url(), status: r.status(), designed: json });
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/.test(m.text())) return; // covered by apiFailures
    consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 300)));

  try {
    await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(p.wait, { timeout: 15000 });

    // Scroll through the page so lazy-loaded content (GSAP ScrollTrigger,
    // loading="lazy" images) has had its trigger fired before we check it.
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    });

    // 1. horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    entry.checks["no-horizontal-overflow"] = overflow <= 1;
    if (overflow > 1) entry.issues.push(`horizontal overflow: ${overflow}px`);

    // 2. focus visible on first tab — the design system signals focus with
    // either an outline or a box-shadow ring (see .btn:focus-visible), so both
    // count as a visible indicator.
    await page.keyboard.press("Tab");
    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const s = getComputedStyle(el);
      const outlined = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const ringed = s.boxShadow !== "none";
      return outlined || ringed;
    });
    entry.checks["focus-visible-present"] = focusVisible;
    if (!focusVisible) entry.issues.push("first Tab press shows no visible focus outline");

    // 3. reduced-motion: entrance animations must not leave content invisible
    const invisible = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("main *")) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.matches(":disabled") || el.closest("fieldset:disabled") || el.getAttribute("aria-disabled") === "true") continue;
        if (parseFloat(s.opacity) < 0.5 && !el.closest("[aria-hidden]")) bad.push(el.tagName + "." + String(el.className).slice(0, 40));
      }
      return bad;
    });
    entry.checks["reduced-motion-safe"] = invisible.length === 0;
    if (invisible.length) entry.issues.push(`elements stuck at low opacity under reduced motion: ${invisible.slice(0, 5).join(", ")}`);

    // 4. images load — let lazy images kicked off during the scroll pass settle,
    // then only flag ones that actually errored (complete && no pixels). An
    // incomplete image is pending, not broken.
    await page.evaluate(() =>
      Promise.race([
        Promise.all(
          [...document.images]
            .filter((i) => !i.complete)
            .map(
              (i) =>
                new Promise((r) => {
                  i.addEventListener("load", r, { once: true });
                  i.addEventListener("error", r, { once: true });
                })
            )
        ),
        new Promise((r) => setTimeout(r, 8000)),
      ])
    );
    const brokenImages = await page.evaluate(() =>
      [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(-60))
    );
    entry.checks["images-load"] = brokenImages.length === 0;
    if (brokenImages.length) entry.issues.push(`broken images: ${brokenImages.join(", ")}`);

    // 5. console errors + API failures
    const hardApi = apiFailures.filter((f) => !f.designed);
    const degraded = [...new Set(apiFailures.filter((f) => f.designed).map((f) => `${f.status} ${new URL(f.url).pathname}`))];
    if (degraded.length) entry.degraded = degraded;
    const apiIssues = hardApi.map((f) => `${f.status} ${f.url}`);
    if (apiIssues.length) consoleErrors.push(`5xx without designed-degradation body: ${apiIssues.slice(0, 3).join(" | ")}`);
    if (STRICT && degraded.length) consoleErrors.push(`degraded endpoints (strict): ${degraded.join(" | ")}`);
    entry.checks["console-errors"] = consoleErrors.length === 0;
    if (consoleErrors.length) entry.issues.push(`console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);

    // 6. honesty copy present on public pages
    const text = await page.evaluate(() => document.body.innerText);
    entry.checks["honesty-copy-present"] = HONESTY_PATTERNS.some((re) => re.test(text));
    if (!entry.checks["honesty-copy-present"]) entry.issues.push("no honesty/limitation copy found on page");

    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
  } catch (err) {
    entry.issues.push(`page load failed: ${String(err).slice(0, 200)}`);
  }
  entry.score = score(entry.checks);
  report.push(entry);
  await ctx.close();
}

await browser.close();
await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));

// console summary
let failed = 0;
for (const r of report) {
  const ok = r.issues.length === 0;
  if (!ok) failed++;
  const note = r.degraded?.length ? ` [degraded: ${r.degraded.join(", ")}]` : "";
  console.log(`${ok ? (r.degraded?.length ? "PASS~" : "PASS ") : "FAIL "}  ${r.page.padEnd(16)} ${r.score.pct}%  ${r.issues.join("; ")}${note}`);
}
console.log(failed ? `\n${failed}/${report.length} pages need fixes` : `\nAll ${report.length} pages pass.`);
process.exit(failed ? 1 : 0);
