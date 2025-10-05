/**
 * Scarlet/Violet TM catalog builder (robust).
 * - Source of truth: /machine (filtered by version_group="scarlet-violet")
 * - Bounded concurrency + progress logs
 * - Enrich with move meta
 * - Output: public/data/sv_tm_catalog_v1.json
 *
 * Node 18+ (global fetch) required.
 */
import fs from "fs";
import path from "path";

const BASE = "https://pokeapi.co/api/v2";
const OUT  = path.join(process.cwd(), "public", "data", "sv_tm_catalog_v1.json");
const VERSION_GROUP = (process.argv.find(a => a.startsWith("--vg="))?.split("=")[1]) || "scarlet-violet";
const CONCURRENCY   = Number(process.argv.find(a => a.startsWith("--cc="))?.split("=")[1]) || 12;
const FETCH_TIMEOUT = 12000;

if (typeof fetch !== "function") {
  console.error("❌ Node 18+ required (global fetch is missing).");
  process.exit(1);
}

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

function parseTmNumber(name) {
  const m = /^tm(\d+)$/i.exec(name || "");
  return m ? Number(m[1].replace(/^0+/, "")) : null;
}

async function fetchJSON(url, {signal}={}) {
  const r = await fetch(url, { signal, headers: { "User-Agent": "paldea-team-planner/1.0" }});
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), FETCH_TIMEOUT);
  try { return await fetchJSON(url, {signal: ctrl.signal}); }
  finally { clearTimeout(t); }
}

async function build() {
  console.log(`⏳ Indexing /machine for version_group="${VERSION_GROUP}" …`);
  const index = await fetchWithTimeout(`${BASE}/machine?limit=100000`);
  const urls  = index.results.map(r => r.url);

  // Phase 1: fetch machines, filter to SV TMs, dedupe by TM number
  let processed = 0;
  const tmMap = new Map(); // tm_number -> { item, moveUrl }
  let cursor = 0;

  const spin = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  let si = 0;
  const tick = setInterval(()=>{
    process.stdout.write(`\r${spin[si++%spin.length]} machines processed: ${processed}/${urls.length}  kept: ${tmMap.size}   `);
  }, 120);

  async function machineWorker() {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) break;

      try {
        const m = await fetchWithTimeout(urls[i]);
        if (m?.version_group?.name === VERSION_GROUP && m?.item?.name?.startsWith("tm")) {
          const tmn = parseTmNumber(m.item.name);
          if (tmn && !tmMap.has(tmn)) {
            tmMap.set(tmn, { item: m.item.name, moveUrl: m.move?.url || null });
          }
        }
      } catch (_) {
        // ignore individual failures and continue
      } finally {
        processed++;
        await sleep(8);
      }
    }
  }

  await Promise.all(Array.from({length: CONCURRENCY}, () => machineWorker()));
  clearInterval(tick); process.stdout.write("\r");

  const entries = [...tmMap.entries()]
    .sort((a,b)=>a[0]-b[0])
    .map(([tm_number, v]) => ({ tm_number, item: v.item, moveUrl: v.moveUrl }));

  console.log(`⏳ Fetching move meta for ${entries.length} TMs …`);
  let done = 0; si = 0;
  const tick2 = setInterval(()=>{
    process.stdout.write(`\r${spin[si++%spin.length]} moves fetched: ${done}/${entries.length}   `);
  }, 120);

  let mCursor = 0;
  const outEntries = [];
  async function moveWorker() {
    while (true) {
      const i = mCursor++;
      if (i >= entries.length) break;
      const e = entries[i];
      try {
        let mv = null;
        if (e.moveUrl) {
          const j = await fetchWithTimeout(e.moveUrl);
          mv = {
            name: j.name, id: j.id,
            type: j.type?.name ?? null,
            damage_class: j.damage_class?.name ?? null,
            power: j.power ?? null,
            accuracy: j.accuracy ?? null,
            pp: j.pp ?? null,
          };
        }
        outEntries.push({
          machine_id: e.tm_number, // we use TM number as key
          item: e.item,            // "tm123"
          tm_number: e.tm_number,
          move: mv ?? { name:null,id:null,type:null,damage_class:null,power:null,accuracy:null,pp:null }
        });
      } catch (_) {
        // keep going
      } finally {
        done++;
        await sleep(6);
      }
    }
  }

  await Promise.all(Array.from({length: CONCURRENCY}, () => moveWorker()));
  clearInterval(tick2); process.stdout.write("\r");

  outEntries.sort((a,b)=>a.tm_number-b.tm_number);

  // Write JSON
  const out = {
    version: "sv_tm_catalog_v1",
    source: "pokeapi.co",
    version_group: VERSION_GROUP,
    generatedAt: new Date().toISOString(),
    count: outEntries.length,
    tms: outEntries
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

  // Summaries
  const max = outEntries.reduce((m,e)=>Math.max(m, e.tm_number), 0);
  const present = new Set(outEntries.map(e=>e.tm_number));
  const missing = [];
  for (let n=1; n<=max; n++) if (!present.has(n)) missing.push(n);

  console.log(`✅ Wrote ${OUT} (count=${out.count}, maxTM=${max})`);
  console.log(missing.length ? `ℹ️ Missing TM numbers in 1..${max}: ${missing.join(", ")}` : "ℹ️ No gaps in 1.."+max);
}

build().catch(e=>{
  console.error("\n❌ build-tm-catalog failed:", e.stack || e);
  process.exit(1);
});
