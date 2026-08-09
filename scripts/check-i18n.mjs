/**
 * i18n health check (CI gate).
 *
 * 1. Verifies en.json / ar.json have exactly the same key sets (parity).
 * 2. Verifies every statically-referenced translation key in src/ exists in
 *    both files. Resolves namespaces per binding:
 *      - const t = useTranslations("ns") / useTranslations()
 *      - const t = await getTranslations("ns")
 *      - const t = await getTranslations({ locale, namespace: "ns" })
 *      - template-literal keys with a literal prefix (t(`nav.${x}`))
 * 3. Scans for hardcoded English user-facing attributes.
 *
 * Usage: node scripts/check-i18n.mjs
 * Exit code 1 on any problem — wired into `npm run check:i18n` and CI.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const en = read("src/messages/en.json");
const ar = read("src/messages/ar.json");

const get = (obj, key) =>
  key.split(".").reduce((acc, part) => (acc && acc[part]) ?? undefined, obj);

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const enFlat = flatten(en);
const arFlat = flatten(ar);

const errors = [];

// --- 1. Parity --------------------------------------------------------------
for (const key of Object.keys(enFlat)) {
  if (!(key in arFlat)) errors.push(`Missing in ar.json: ${key}`);
}
for (const key of Object.keys(arFlat)) {
  if (!(key in enFlat)) errors.push(`Missing in en.json: ${key}`);
}

// --- 2. Referenced keys exist -----------------------------------------------
const srcDir = path.join(root, "src");
const SOURCE_RE = /\.(ts|tsx)$/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (SOURCE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(srcDir);

/**
 * Collect translation usages with nearest-preceding-binding namespace
 * resolution. Returns [{ key }] plus a count of unresolved (dynamic) usages.
 */
function collectReferences(source) {
  const refs = [];
  // bindings: { name, ns, index } in source order.
  const bindings = [];
  const nsRe = /(\bt\w*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(([^)]*)\)/g;
  let m;
  while ((m = nsRe.exec(source))) {
    const raw = m[2].trim();
    let ns = "";
    if (raw.startsWith("{")) {
      // Object form: getTranslations({ locale, namespace: "audit" })
      const nsMatch = /namespace\s*:\s*["'`]([^"'`]+)["'`]/.exec(raw);
      ns = nsMatch?.[1] ?? "";
    } else {
      ns = raw.replace(/["'`]/g, "");
    }
    bindings.push({ name: m[1], ns, index: m.index });
  }

  // t('literal.key') and t("literal.key") — only calls on a registered
  // useTranslations/getTranslations binding count (avoids false positives
  // from helper functions such as toRbacError("service-error")).
  const callRe = /(\bt\w*)\(\s*["'`]([^"'`${}]+)["'`]/g;
  while ((m = callRe.exec(source))) {
    const binding = [...bindings]
      .reverse()
      .find((b) => b.name === m[1] && b.index < m.index);
    if (!binding) continue;
    const ns = binding.ns ?? "";
    refs.push(ns ? `${ns}.${m[2]}` : m[2]);
  }

  // Template literals with a literal prefix + expression suffix:
  // t(`nav.${item.labelKey}`) → validate the static prefix only.
  const tmplRe = /(\bt\w*)\(\s*`([^`$]*)\$\{/g;
  while ((m = tmplRe.exec(source))) {
    const binding = [...bindings]
      .reverse()
      .find((b) => b.name === m[1] && b.index < m.index);
    if (!binding) continue;
    const ns = binding.ns ?? "";
    const prefix = m[2].replace(/\.$/, "");
    if (prefix) refs.push(ns ? `${ns}.${prefix}` : prefix);
  }

  return refs;
}

const missing = new Set();
const referenced = new Set();
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const ref of collectReferences(source)) {
    referenced.add(ref);
    if (get(en, ref) === undefined) {
      missing.add(`en.json missing key referenced in ${path.relative(root, file)}: ${ref}`);
    }
    if (get(ar, ref) === undefined) {
      missing.add(`ar.json missing key referenced in ${path.relative(root, file)}: ${ref}`);
    }
  }
}

for (const err of missing) errors.push(err);

// --- 3. Hardcoded English attributes ----------------------------------------
const hardcodedAttrRe =
  /\b(?:placeholder|aria-label|title|alt)="([A-Za-z][A-Za-z ]{2,})"/g;
for (const file of files) {
  if (!file.endsWith(".tsx")) continue;
  const source = fs.readFileSync(file, "utf8");
  let m;
  while ((m = hardcodedAttrRe.exec(source))) {
    if (/Church CRM|Submit|Reset/.test(m[1])) continue;
    errors.push(`Hardcoded English attribute in ${path.relative(root, file)}: ${m[1]}`);
  }
}

// --- Output -----------------------------------------------------------------
console.log(
  `\ni18n check — en:${Object.keys(enFlat).length} ar:${Object.keys(arFlat).length} keys · ${referenced.size} referenced`,
);
if (errors.length) {
  console.log(`\n✖ ${errors.length} problem(s):`);
  for (const e of [...new Set(errors)].slice(0, 80)) console.log(`  ✖ ${e}`);
  const rest = [...new Set(errors)].length - 80;
  if (rest > 0) console.log(`  … and ${rest} more`);
  process.exit(1);
}
console.log("✓ en/ar parity OK · ✓ all referenced keys exist · ✓ no hardcoded attributes\n");
