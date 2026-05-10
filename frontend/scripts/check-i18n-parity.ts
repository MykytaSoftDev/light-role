/**
 * Compare every messages/{locale}.json against messages/en.json (the reference)
 * and report missing or extra keys per locale. Exits 1 on any mismatch.
 *
 * Run: npm run i18n:check
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MESSAGES_DIR = resolve(process.cwd(), "messages");
const REFERENCE = "en";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function flattenKeys(obj: JsonValue, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return [prefix];
  }
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(...flattenKeys(v, path));
  }
  return keys;
}

function loadLocaleKeys(locale: string): Set<string> {
  const filePath = join(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as JsonValue;
  return new Set(flattenKeys(parsed));
}

function listLocales(): string[] {
  return readdirSync(MESSAGES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

function diffSets<T>(a: Set<T>, b: Set<T>): T[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

function main(): number {
  const referenceKeys = loadLocaleKeys(REFERENCE);
  const locales = listLocales().filter((l) => l !== REFERENCE);

  let hasMismatch = false;
  console.log(`i18n parity check (reference: ${REFERENCE}.json — ${referenceKeys.size} keys)\n`);

  for (const locale of locales) {
    let localeKeys: Set<string>;
    try {
      localeKeys = loadLocaleKeys(locale);
    } catch (err) {
      console.error(`  ${locale}: failed to load — ${(err as Error).message}`);
      hasMismatch = true;
      continue;
    }

    const missing = diffSets(referenceKeys, localeKeys);
    const extra = diffSets(localeKeys, referenceKeys);

    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ${locale}: OK (${localeKeys.size} keys)`);
      continue;
    }

    hasMismatch = true;
    console.log(`  ${locale}: MISMATCH (${localeKeys.size} keys)`);
    if (missing.length > 0) {
      console.log(`    missing (${missing.length}):`);
      for (const k of missing) console.log(`      - ${k}`);
    }
    if (extra.length > 0) {
      console.log(`    extra (${extra.length}):`);
      for (const k of extra) console.log(`      + ${k}`);
    }
  }

  console.log("");
  if (hasMismatch) {
    console.error("i18n parity check FAILED");
    return 1;
  }
  console.log("i18n parity check PASSED");
  return 0;
}

process.exit(main());
