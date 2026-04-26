#!/usr/bin/env node

/**
 * translate.mjs — Translate English source strings via DeepL or Google Translate.
 *
 * Usage:
 *   node scripts/translate.mjs --dry-run                              # character estimate
 *   node scripts/translate.mjs --provider deepl --langs es,fr,de      # DeepL for European
 *   node scripts/translate.mjs --provider google --langs ja           # Google for Japanese
 *   node scripts/translate.mjs --all                                  # default mapping
 *   node scripts/translate.mjs --all --force                          # re-translate everything
 *
 * Environment variables:
 *   DEEPL_API_KEY             — DeepL API key (free or pro)
 *   GOOGLE_TRANSLATE_API_KEY  — Google Cloud Translation API key
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'frontend/src/locales');
const EN_FILE = resolve(LOCALES_DIR, 'en/translation.json');
const HASHES_FILE = resolve(__dirname, '.translation-hashes.json');

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
const GOOGLE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

// DeepL uses uppercase target codes; Google uses lowercase.
const LANG_MAP = {
  deepl: { es: 'ES', fr: 'FR', de: 'DE', ja: 'JA', pt: 'PT', nl: 'NL', nb: 'NB', it: 'IT' },
  google: { es: 'es', fr: 'fr', de: 'de', ja: 'ja', pt: 'pt', nl: 'nl', nb: 'no', zh: 'zh-CN', it: 'it' },
};

// Default provider assignment per language.
const DEFAULT_PROVIDER = { es: 'deepl', fr: 'deepl', de: 'deepl', ja: 'google', pt: 'deepl', nl: 'deepl', nb: 'deepl', zh: 'google', it: 'deepl' };

const BATCH_SIZE = 50; // strings per API request

// ── Utility functions ──────────────────────────────────────────────────────

/** Flatten nested object to { "a.b.c": value } map. Only string leaves are included. */
function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value, path));
    } else if (typeof value === 'string') {
      result[path] = value;
    }
  }
  return result;
}

/** Unflatten dot-separated keys back to nested object, following keyOrder for ordering. */
function unflatten(flatMap, keyOrder) {
  const root = {};
  for (const dotKey of keyOrder) {
    if (!(dotKey in flatMap)) continue;
    const parts = dotKey.split('.');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in node)) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = flatMap[dotKey];
  }
  return root;
}

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ── API callers ────────────────────────────────────────────────────────────

async function translateDeepL(texts, targetLang, apiKey) {
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const body = new URLSearchParams();
    body.append('source_lang', 'EN');
    body.append('target_lang', targetLang);
    // Preserve interpolation placeholders like {{name}}
    body.append('tag_handling', 'html');
    body.append('ignore_tags', 'keep');
    for (const t of batch) {
      // Wrap i18next interpolation tokens so DeepL skips them
      body.append('text', t.replace(/\{\{(\w+)\}\}/g, '<keep>{{$1}}</keep>'));
    }

    const res = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DeepL API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    for (const t of data.translations) {
      // Strip the wrapper tags we added
      results.push(t.text.replace(/<\/?keep>/g, ''));
    }
  }
  return results;
}

async function translateGoogle(texts, targetLang, apiKey) {
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    // Wrap interpolation tokens in <span translate="no"> to preserve them
    const wrapped = batch.map((t) =>
      t.replace(/\{\{(\w+)\}\}/g, '<span translate="no">{{$1}}</span>')
    );

    const res = await fetch(`${GOOGLE_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: wrapped,
        source: 'en',
        target: targetLang,
        format: 'html',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Translate API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    for (const t of data.data.translations) {
      // Decode HTML entities that Google returns and strip wrapper spans
      let text = t.translatedText;
      text = text.replace(/<span translate="no">(.*?)<\/span>/gi, '$1');
      text = text.replace(/&quot;/g, '"');
      text = text.replace(/&#39;/g, "'");
      text = text.replace(/&amp;/g, '&');
      text = text.replace(/&lt;/g, '<');
      text = text.replace(/&gt;/g, '>');
      results.push(text);
    }
  }
  return results;
}

// ── CLI parsing ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, force: false, all: false, provider: null, langs: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--all':
        opts.all = true;
        break;
      case '--provider':
        opts.provider = args[++i];
        break;
      case '--langs':
        opts.langs = args[++i].split(',').map((l) => l.trim());
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!opts.all && !opts.provider && !opts.dryRun) {
    console.error('Usage: translate.mjs --dry-run | --all | --provider <deepl|google> --langs <lang,...>');
    process.exit(1);
  }

  return opts;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // Load English source and flatten
  const enData = loadJSON(EN_FILE);
  const enFlat = flatten(enData);
  const enKeys = Object.keys(enFlat);
  console.log(`English source: ${enKeys.length} keys`);

  // Load previous hashes
  const prevHashes = existsSync(HASHES_FILE) ? loadJSON(HASHES_FILE) : {};

  // Compute current hashes
  const curHashes = {};
  for (const [k, v] of Object.entries(enFlat)) {
    curHashes[k] = sha256(v);
  }

  // Determine which languages to process and with which provider
  let langProviderPairs;
  if (opts.all) {
    langProviderPairs = Object.entries(DEFAULT_PROVIDER);
  } else if (opts.dryRun) {
    langProviderPairs = Object.entries(DEFAULT_PROVIDER);
  } else {
    if (!opts.provider || !opts.langs) {
      console.error('Specify --provider and --langs, or use --all');
      process.exit(1);
    }
    langProviderPairs = opts.langs.map((l) => [l, opts.provider]);
  }

  let totalCharsUsed = 0;
  const summary = [];

  for (const [lang, provider] of langProviderPairs) {
    const targetFile = resolve(LOCALES_DIR, lang, 'translation.json');
    const existingFlat = existsSync(targetFile) ? flatten(loadJSON(targetFile)) : {};

    // Find keys needing translation
    const toTranslate = {};
    for (const key of enKeys) {
      if (opts.force) {
        // Force mode: translate everything
        toTranslate[key] = enFlat[key];
      } else if (!(key in existingFlat)) {
        // Missing key
        toTranslate[key] = enFlat[key];
      } else if (prevHashes[key] && prevHashes[key] !== curHashes[key]) {
        // English value changed since last translation
        toTranslate[key] = enFlat[key];
      }
    }

    const keys = Object.keys(toTranslate);
    const texts = Object.values(toTranslate);
    const charCount = texts.reduce((sum, t) => sum + t.length, 0);

    if (keys.length === 0) {
      summary.push({ lang, provider, translated: 0, chars: 0, skipped: enKeys.length });
      continue;
    }

    if (opts.dryRun) {
      summary.push({ lang, provider, translated: keys.length, chars: charCount, skipped: enKeys.length - keys.length });
      totalCharsUsed += charCount;
      continue;
    }

    // Translate via API
    console.log(`\nTranslating ${keys.length} keys to ${lang} via ${provider} (${charCount} chars)...`);

    let translated;
    if (provider === 'deepl') {
      const apiKey = process.env.DEEPL_API_KEY;
      if (!apiKey) {
        console.error('DEEPL_API_KEY environment variable is required');
        process.exit(1);
      }
      const targetCode = LANG_MAP.deepl[lang];
      if (!targetCode) {
        console.error(`Unsupported DeepL language: ${lang}`);
        process.exit(1);
      }
      translated = await translateDeepL(texts, targetCode, apiKey);
    } else if (provider === 'google') {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        console.error('GOOGLE_TRANSLATE_API_KEY environment variable is required');
        process.exit(1);
      }
      const targetCode = LANG_MAP.google[lang];
      if (!targetCode) {
        console.error(`Unsupported Google Translate language: ${lang}`);
        process.exit(1);
      }
      translated = await translateGoogle(texts, targetCode, apiKey);
    } else {
      console.error(`Unknown provider: ${provider}`);
      process.exit(1);
    }

    // Merge translations into existing flat map
    const mergedFlat = { ...existingFlat };
    for (let j = 0; j < keys.length; j++) {
      mergedFlat[keys[j]] = translated[j];
    }

    // Remove keys that no longer exist in English source
    for (const key of Object.keys(mergedFlat)) {
      if (!(key in enFlat)) {
        delete mergedFlat[key];
      }
    }

    // Unflatten using English key order for consistent structure
    const result = unflatten(mergedFlat, enKeys);
    writeFileSync(targetFile, JSON.stringify(result, null, 2) + '\n', 'utf8');

    summary.push({ lang, provider, translated: keys.length, chars: charCount, skipped: enKeys.length - keys.length });
    totalCharsUsed += charCount;
  }

  // Save hashes (skip in dry-run)
  if (!opts.dryRun) {
    writeFileSync(HASHES_FILE, JSON.stringify(curHashes, null, 2) + '\n', 'utf8');
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(opts.dryRun ? 'DRY RUN — no API calls made' : 'Translation complete');
  console.log('='.repeat(60));
  console.log(
    `${'Lang'.padEnd(6)}${'Provider'.padEnd(10)}${'Translated'.padEnd(12)}${'Skipped'.padEnd(10)}${'Chars'.padEnd(10)}`
  );
  console.log('-'.repeat(48));
  for (const s of summary) {
    console.log(
      `${s.lang.padEnd(6)}${s.provider.padEnd(10)}${String(s.translated).padEnd(12)}${String(s.skipped).padEnd(10)}${String(s.chars).padEnd(10)}`
    );
  }
  console.log('-'.repeat(48));
  console.log(`Total characters: ${totalCharsUsed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
