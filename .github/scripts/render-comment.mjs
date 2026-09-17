#!/usr/bin/env node
// Renders the combined PR comment body from unit coverage + Playwright results.
// Reads from disk, writes markdown to OUTPUT_FILE (default comment-body.md).
// All inputs are optional except nothing — missing files degrade gracefully.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const COVERAGE_DIR = process.env.COVERAGE_DIR ?? "coverage";
const PLAYWRIGHT_RESULTS =
  process.env.PLAYWRIGHT_RESULTS ?? "playwright-report/results.json";
const OUTPUT_FILE = process.env.OUTPUT_FILE ?? "comment-body.md";
const GATE_SKIPPED = process.env.GATE_SKIPPED === "true";
const PREVIEW_URL = process.env.PREVIEW_URL ?? "";
const RUN_URL = process.env.RUN_URL ?? "";
const PAGES_URL = process.env.PAGES_URL ?? "";
const MARKER = "<!-- e2e-preview-report -->";

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function stripAnsi(text) {
  return text.replace(/\[[0-9;]*m/g, "");
}

function statusEmoji(pct) {
  if (pct >= 80) return "🟢";
  if (pct >= 50) return "🟡";
  return "🔴";
}

function normalizePath(absPath) {
  const match = absPath.match(/^.*?\/((?:lib|app)\/.*)$/);
  return match ? match[1] : absPath;
}

function compressLineRanges(lines) {
  if (lines.length === 0) return "";
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === end + 1) {
      end = n;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = n;
    end = n;
  }

  return ranges.join(",");
}

function uncoveredLinesFor(finalCoverage, absPath) {
  const fileData = finalCoverage?.[absPath];
  if (!fileData) return "";

  const lines = Object.entries(fileData.s)
    .filter(([, count]) => count === 0)
    .map(([stmtId]) => fileData.statementMap[stmtId]?.start?.line)
    .filter((line) => typeof line === "number");

  return compressLineRanges(lines);
}

function renderCoverageSection() {
  const summary = readJson(`${COVERAGE_DIR}/coverage-summary.json`);
  const finalCoverage = readJson(`${COVERAGE_DIR}/coverage-final.json`);

  if (!summary) {
    return { headerFragment: "Coverage n/a", body: "_No coverage data available._" };
  }

  const files = Object.keys(summary)
    .filter((k) => k !== "total")
    .sort();

  const rows = [];
  for (const absPath of files) {
    const f = summary[absPath];
    const pct = f.lines.pct;
    // A file with 0 covered lines has nothing meaningful to list — the
    // "uncovered" set is effectively the whole file. Only show explicit
    // line ranges for partially-covered files, where they're actionable.
    const uncovered =
      f.lines.covered === 0 ? "_(untested)_" : uncoveredLinesFor(finalCoverage, absPath) || "—";
    rows.push(
      `| ${statusEmoji(pct)} | \`${normalizePath(absPath)}\` | ${f.statements.pct} | ${f.branches.pct} | ${f.functions.pct} | ${f.lines.pct} | ${uncovered} |`,
    );
  }

  const total = summary.total;
  const totalPct = total.lines.pct;
  const header = [
    "| | File | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines |",
    "|---|---|--:|--:|--:|--:|---|",
    `| ${statusEmoji(totalPct)} | **All files** | ${total.statements.pct} | ${total.branches.pct} | ${total.functions.pct} | ${total.lines.pct} | |`,
    ...rows,
  ];

  let body = header.join("\n");
  if (PAGES_URL) {
    body = `[Browse the annotated HTML report](${PAGES_URL})\n\n` + body;
  }

  return { headerFragment: `Coverage ${statusEmoji(totalPct)} ${totalPct}%`, body };
}

function renderUnitSection() {
  const results = readJson(`${COVERAGE_DIR}/unit-results.json`);
  if (!results) return { headerFragment: "Unit n/a" };

  const passed = results.numPassedTests ?? 0;
  const total = results.numTotalTests ?? 0;
  const ok = (results.numFailedTests ?? 0) === 0;
  return { headerFragment: `Unit ${ok ? "✅" : "❌"} ${passed}/${total}` };
}

function collectSpecs(suites, ancestry = []) {
  return suites.flatMap((suite) => {
    const specs = (suite.specs ?? []).map((spec) => ({ spec, ancestry }));
    const nested = collectSpecs(suite.suites ?? [], [...ancestry, suite.title]);
    return [...specs, ...nested];
  });
}

function renderE2eSection() {
  if (GATE_SKIPPED) {
    return {
      headerFragment: "E2E ⏭️ skipped",
      body: "⏭️ Skipped — lint, typecheck, or unit tests failed for this commit.",
    };
  }

  const results = readJson(PLAYWRIGHT_RESULTS);
  if (!results) {
    return { headerFragment: "E2E n/a", body: "_No e2e results available._" };
  }

  const bySpecFile = new Map();
  for (const suite of results.suites ?? []) {
    // `suite` is the top-level, one per spec file. Its own `.title` equals
    // the filename, so ancestry starts from its children, not itself.
    const topLevel = (suite.specs ?? []).map((spec) => ({ spec, ancestry: [] }));
    const nested = collectSpecs(suite.suites ?? [], []);
    const entries = [...topLevel, ...nested];
    for (const { spec, ancestry } of entries) {
      const key = suite.file;
      if (!bySpecFile.has(key)) bySpecFile.set(key, { ancestry: [], rows: [] });
      const group = bySpecFile.get(key);
      if (ancestry.length > group.ancestry.length) group.ancestry = ancestry;

      const test = spec.tests?.[0];
      const status = test?.status ?? "unknown";
      const emoji =
        status === "expected" ? "✅" : status === "flaky" ? "🟡" : status === "skipped" ? "⏭️" : "❌";
      // Retries produce multiple `results` entries; only the last one is the
      // decisive outcome — summing/duplicating earlier attempts is noise.
      const lastResult = test?.results?.[test.results.length - 1];
      const durationMs = lastResult?.duration ?? 0;
      const errors = lastResult?.errors ?? [];

      group.rows.push({
        title: spec.title,
        emoji,
        duration: (durationMs / 1000).toFixed(1) + "s",
        error: stripAnsi(errors.map((e) => e.message ?? String(e)).join("\n")),
      });
    }
  }

  let totalPassed = 0;
  let totalCount = 0;
  const sections = [];

  for (const [file, group] of bySpecFile) {
    const heading = group.ancestry.length
      ? `**\`${file}\`** › ${group.ancestry.join(" › ")}`
      : `**\`${file}\`**`;
    const tableRows = group.rows.map(
      (r) => `| ${r.title} | ${r.emoji} | ${r.duration} |`,
    );
    const failures = group.rows.filter((r) => r.error);

    totalCount += group.rows.length;
    totalPassed += group.rows.filter((r) => r.emoji === "✅").length;

    let block = [
      heading,
      "| Test | Result | Time |",
      "|---|---|---|",
      ...tableRows,
    ].join("\n");

    if (failures.length) {
      block +=
        "\n\n<details><summary>Failure details</summary>\n\n" +
        failures.map((f) => `**${f.title}**\n\`\`\`\n${f.error}\n\`\`\``).join("\n\n") +
        "\n\n</details>";
    }

    sections.push(block);
  }

  const allPassed = totalPassed === totalCount;
  const summaryLine = `${allPassed ? "✅" : "❌"} **${totalPassed}/${totalCount} passed**`;

  const links = [];
  if (PREVIEW_URL) links.push(`Preview tested: ${PREVIEW_URL}`);
  if (RUN_URL) links.push(`[Full HTML report](${RUN_URL}) (download the \`playwright-report\` artifact)`);

  const body = [summaryLine, "", sections.join("\n\n"), "", ...links].join("\n");

  return {
    headerFragment: `E2E ${allPassed ? "✅" : "❌"} ${totalPassed}/${totalCount}`,
    body,
  };
}

const coverage = renderCoverageSection();
const unit = renderUnitSection();
const e2e = renderE2eSection();

const header = [coverage.headerFragment, unit.headerFragment, e2e.headerFragment].join(" · ");

const body = [
  MARKER,
  "## 🎭 CI Report — Preview Deployment",
  "",
  header,
  "",
  "### Coverage (unit tests)",
  coverage.body,
  "",
  "### E2E",
  e2e.body,
].join("\n");

writeFileSync(OUTPUT_FILE, body);
console.log(`Wrote ${OUTPUT_FILE} (${body.length} bytes)`);
