#!/usr/bin/env node
/*
 * Checks every Wikipedia URL in data/bmw-models.json against Wikipedia's REST API
 * and sets wikipediaVerified accordingly. Needs internet access and Node 18+.
 *
 * Usage:  node tools/check-wikipedia.js          (report only)
 *         node tools/check-wikipedia.js --write  (also update the JSON, then run build-data.js)
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'bmw-models.json');
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const write = process.argv.includes('--write');

const urls = [...new Set(json.records.map(r => r.wikipedia).filter(Boolean))];
const result = new Map();

async function check(url) {
  const title = url.split('/wiki/')[1];
  const api = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + title;
  try {
    const res = await fetch(api, { redirect: 'follow', headers: { 'User-Agent': 'bmw-tree-link-check/1.0' } });
    if (res.status !== 200) return { ok: false, note: 'HTTP ' + res.status };
    const data = await res.json();
    if (data.type === 'disambiguation') return { ok: false, note: 'disambiguation page' };
    return { ok: true, note: data.title };
  } catch (e) {
    return { ok: false, note: 'network error: ' + e.message };
  }
}

(async () => {
  let i = 0;
  const queue = urls.slice();
  async function worker() {
    while (queue.length) {
      const u = queue.shift();
      result.set(u, await check(u));
      process.stdout.write(`\r${++i}/${urls.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log('');
  const bad = [...result].filter(([, v]) => !v.ok);
  for (const [u, v] of bad) console.log('FAIL', u, '-', v.note);
  console.log(`${urls.length - bad.length}/${urls.length} links OK`);
  if (write) {
    for (const r of json.records) {
      if (r.wikipedia) r.wikipediaVerified = !!(result.get(r.wikipedia) || {}).ok;
    }
    fs.writeFileSync(file, JSON.stringify(json, null, 1) + '\n');
    console.log('Updated wikipediaVerified flags. Now run: node tools/build-data.js');
  }
})();
