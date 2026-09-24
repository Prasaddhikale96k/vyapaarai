// P8 VERIFY (node): Supabase Realtime postgres_changes on sales.
// Reads frontend/.env.local. Run: node verify_p8.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(p) {
  const out = {};
  try {
    let text = fs.readFileSync(p, "utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* missing file -> handled below */
  }
  return out;
}

const env = loadEnv(path.join(__dirname, ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("FAIL — frontend/.env.local missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

// 1. one product id (anon read, RLS off)
const { data: prods, error: e1 } = await sb.from("products").select("id").limit(1);
if (e1 || !prods || prods.length === 0) {
  console.error("FAIL — products anon read:", e1 ? e1.message : "no rows (seed PG first?)");
  process.exit(1);
}
const product_id = prods[0].id;

// 2. listen INSERT on sales
let got = null;
const ch = sb
  .channel("p8-verify")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, (p) => {
    got = p;
  });

await new Promise((resolve, reject) => {
  const to = setTimeout(() => reject(new Error("subscribe timeout")), 15000);
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      clearTimeout(to);
      resolve();
    }
  });
}).catch((e) => {
  console.error("FAIL — subscribe:", e.message);
  process.exit(1);
});

// 3. insert probe row
const today = new Date().toISOString().slice(0, 10);
const { data: ins, error: e2 } = await sb
  .from("sales")
  .insert({
    owner_id: 1,
    date: today,
    product_id,
    qty: 1,
    unit_price: 1,
    amount: 1,
    source: "verify_p8",
  })
  .select("id");
if (e2 || !ins || ins.length === 0) {
  console.error("FAIL — probe insert:", e2 ? e2.message : "no id returned");
  try {
    await sb.removeChannel(ch);
  } catch {}
  process.exit(1);
}
const probeId = ins[0].id;

// 4. wait for the change event (<= 10s)
const t0 = Date.now();
while (!got && Date.now() - t0 < 10000) {
  await new Promise((r) => setTimeout(r, 250));
}

// 5. cleanup probe row
try {
  await sb.from("sales").delete().eq("id", probeId);
} catch {}
try {
  await sb.removeChannel(ch);
} catch {}

if (got) {
  console.log("P8 VERIFY: realtime OK");
} else {
  console.error("FAIL — check Replication toggles in Supabase Dashboard");
  process.exit(1);
}
