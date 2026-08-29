#!/usr/bin/env node
/*
 * Translation coverage checker.
 *
 * For every *.html page in the project:
 *  1. Finds every data-t / data-t-hi / data-t-ph attribute value used in the markup.
 *  2. Finds every key actually defined in that page's own `const T = {...}` object,
 *     per language (en/es/nl/pt).
 *  3. Reports any key used in markup but missing from one or more languages, and
 *     any page that has no translation object at all.
 *
 * This only catches "used a key that isn't defined". It cannot detect visible text
 * that was never wrapped in data-t in the first place -- that needs a human read.
 *
 * Usage: node scripts/check-translations.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LANGS = ['en', 'es', 'nl', 'pt'];

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

function extractUsedKeys(html) {
  const keys = new Set();
  const re = /data-t(?:-hi|-ph)?="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) keys.add(m[1]);
  return keys;
}

function findMatchingBrace(str, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return i;
    } else if (str[i] === '"' || str[i] === "'") {
      // skip over string literals so braces inside them don't confuse the count
      const quote = str[i];
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\') i++;
        i++;
      }
    }
  }
  return -1;
}

function extractDefinedKeys(langBlock) {
  const keys = new Set();
  const re = /(?:^|[,{])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let m;
  while ((m = re.exec(langBlock))) keys.add(m[1]);
  return keys;
}

function extractLangObject(html) {
  const tIdx = html.search(/const\s+T\s*=\s*\{/);
  if (tIdx === -1) return null;
  const openIdx = html.indexOf('{', tIdx);
  const closeIdx = findMatchingBrace(html, openIdx);
  if (closeIdx === -1) return null;
  const body = html.slice(openIdx + 1, closeIdx);

  const result = {};
  for (const lang of LANGS) {
    const langIdx = body.search(new RegExp(`(?:^|[,{\\s])${lang}\\s*:\\s*\\{`));
    if (langIdx === -1) { result[lang] = null; continue; }
    const langOpen = body.indexOf('{', langIdx);
    const langClose = findMatchingBrace(body, langOpen);
    if (langClose === -1) { result[lang] = null; continue; }
    result[lang] = extractDefinedKeys(body.slice(langOpen + 1, langClose));
  }
  return result;
}

let totalProblems = 0;

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const used = extractUsedKeys(html);
  const langObj = extractLangObject(html);

  if (!langObj) {
    if (used.size > 0) {
      console.log(`\n${file}`);
      console.log(`  ERROR: ${used.size} data-t key(s) used but no "const T = {...}" object found on this page.`);
      totalProblems++;
    }
    continue;
  }

  const pageProblems = [];
  for (const lang of LANGS) {
    const defined = langObj[lang];
    if (defined === null) {
      pageProblems.push(`  ${lang}: block not found in T object`);
      continue;
    }
    const missing = [...used].filter(k => !defined.has(k)).sort();
    if (missing.length) {
      pageProblems.push(`  ${lang}: missing ${missing.length} key(s) -> ${missing.join(', ')}`);
    }
  }

  if (pageProblems.length) {
    console.log(`\n${file}  (${used.size} keys used)`);
    pageProblems.forEach(l => console.log(l));
    totalProblems += pageProblems.length;
  }
}

console.log('');
if (totalProblems === 0) {
  console.log('OK — every data-t/data-t-hi/data-t-ph key used in markup is defined in en/es/nl/pt on every page.');
  process.exit(0);
} else {
  console.log(`FAILED — ${totalProblems} problem(s) found across the pages above.`);
  process.exit(1);
}
