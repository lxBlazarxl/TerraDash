import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { themes } from "../client/src/theme.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = path.join(ROOT, "client");

const cssFiles = [];
const collectCss = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectCss(full);
    else if (entry.name.endsWith(".css")) cssFiles.push(full);
  }
};
collectCss(path.join(CLIENT, "src"));

const indexCss = fs.readFileSync(path.join(CLIENT, "src", "index.css"), "utf8");
const themeSource = fs.readFileSync(path.join(CLIENT, "src", "theme.js"), "utf8");

const rootBlock = indexCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const definedInRoot = new Set(
  [...rootBlock.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
);

const definedInThemes = new Set(
  [...themeSource.matchAll(/^\s*['"]?(--[a-z0-9-]+)['"]?\s*:/gm)].map((m) => m[1]),
);

test("every custom property referenced in CSS is defined", () => {
  const referenced = new Map();

  for (const file of cssFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!referenced.has(m[1])) referenced.set(m[1], new Set());
      referenced.get(m[1]).add(path.relative(CLIENT, file));
    }
  }

  const undefinedRefs = [...referenced.entries()]
    .filter(([name]) => !definedInRoot.has(name) && !definedInThemes.has(name))
    .map(([name, files]) => `${name} (used in ${[...files].join(", ")})`);

  assert.deepEqual(undefinedRefs, [], `Undefined custom properties: ${undefinedRefs.join("; ")}`);
});

test("every token defined in :root is actually used or intentionally reserved", () => {
  // Declared up front as part of the token contract, consumed by later phases.
  const reserved = new Map([
    ["--state-online", "read from JS via getComputedStyle (stateColors.js)"],
    ["--state-offline", "read from JS via getComputedStyle (stateColors.js)"],
    ["--state-booting", "read from JS via getComputedStyle (stateColors.js)"],
    ["--state-creating", "read from JS via getComputedStyle (stateColors.js)"],
    ["--state-menu", "read from JS via getComputedStyle (stateColors.js)"],
    ["--warn", "Phase 3 badges (warn states)"],
    ["--warn-soft", "Phase 3 badges (warn states)"],
    ["--warn-border", "Phase 3 badges (warn states)"],
    ["--z-base", "Phase 2/3 layered surfaces"],
    ["--z-sticky", "Phase 5 console composer / table headers"],
    ["--z-drawer", "Phase 2 mobile sidebar drawer"],
    ["--z-toast", "Phase 3 toast stack"],
  ]);

  const allCss = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const js = fs
    .readdirSync(path.join(CLIENT, "src"), { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".js"))
    .map((f) => fs.readFileSync(path.join(CLIENT, "src", f), "utf8"))
    .join("\n");

  const unused = [...definedInRoot].filter(
    (name) => !reserved.has(name) && !allCss.includes(`var(${name})`) && !js.includes(name),
  );

  assert.deepEqual(unused, [], `Unused tokens: ${unused.join(", ")}`);
});

test("each theme defines the full monochrome token contract", () => {
  const contract = [
    "--bg",
    "--panel",
    "--text",
    "--border",
    "--accent",
  ];

  assert.deepEqual(Object.keys(themes).sort(), ["allowlist", "console", "home", "players", "worlds"]);

  for (const [name, values] of Object.entries(themes)) {
    for (const token of contract) {
      assert.ok(values[token], `theme "${name}" is missing ${token}`);
    }
  }
});

test("the :root bootstrap fallback mirrors themes.home", () => {
  const home = themes.home;
  const rootValues = Object.fromEntries(
    [...rootBlock.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]),
  );

  for (const [token, value] of Object.entries(home)) {
    assert.equal(
      rootValues[token],
      value,
      `:root ${token} (${rootValues[token]}) drifted from themes.home (${value}). ` +
        "index.css bootstrap colors must mirror client/src/theme.js themes.home.",
    );
  }
});

test("no theme leaks an undefined var() into its own values", () => {
  for (const [name, values] of Object.entries(themes)) {
    for (const [token, value] of Object.entries(values)) {
      assert.ok(!value.includes("var("), `theme "${name}" ${token} contains var(): ${value}`);
    }
  }
});
