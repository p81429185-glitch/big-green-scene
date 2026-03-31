import { createClient } from "@supabase/supabase-js";

function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  return val === undefined ? fallback : val;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;

const thresholdHours = Number(getArg("--thresholdHours", process.env.THRESHOLD_HOURS || "24"));
const limit = Number(getArg("--limit", process.env.LIMIT || "200"));
const dryRun = (getArg("--dry-run", process.env.DRY_RUN || "true") || "true").toLowerCase() === "true";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  console.error("Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET in env.");
  process.exit(1);
}
if (!Number.isFinite(thresholdHours) || thresholdHours <= 0) {
  console.error("Invalid --thresholdHours");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const muxAuth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString("base64");
const muxBaseUrl = "https://api.mux.com/video/v1";

const thresholdMs = thresholdHours * 60 * 60 * 1000;
const nowMs = Date.now();

function parseTimestamp(s) {
  if (!s) return 0;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : 0;
}

async function getMuxAsset(assetId) {
  const res = await fetch(`${muxBaseUrl}/assets/${assetId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${muxAuth}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mux GET asset failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json?.data;
}

async function submitToMux(videoId, storagePath) {
  // submit-to-mux uses verify_jwt=false, and it has service role key server-side.
  // We still call through the Supabase function invoke method using the admin client.
  const { error } = await supabaseAdmin.functions.invoke("submit-to-mux", {
    body: { video_id: videoId, storage_path: storagePath },
  });
  if (error) throw error;
}

function mapMuxStatusToDb(status) {
  const st = String(status || "").toLowerCase();
  if (st === "ready") {
    return { mux_status: "ready", processing_status: "ready", is_processed: true };
  }
  if (st === "errored") {
    return { mux_status: "error", processing_status: "failed", is_processed: false };
  }

  // preparing / unknown => processing
  return { mux_status: "processing", processing_status: "processing", is_processed: false };
}

async function main() {
  const { data: videos, error } = await supabaseAdmin
    .from("videos")
    .select("id,storage_path,created_at,mux_asset_id,mux_playback_id,mux_status,processing_status,is_processed")
    .in("mux_status", ["pending", "processing", "error"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("DB query failed:", error);
    process.exit(1);
  }

  if (!videos || videos.length === 0) {
    console.log("No candidate videos found.");
    return;
  }

  const stuck = videos.filter((v) => {
    const createdMs = parseTimestamp(v.created_at);
    if (!createdMs) return false;
    const ageMs = nowMs - createdMs;
    // Ignore brand-new videos to reduce race with first ingestion.
    if (ageMs < thresholdMs) return false;
    return v.processing_status !== "ready";
  });

  console.log(`Found ${stuck.length}/${videos.length} stuck candidates. dryRun=${dryRun}`);

  let updated = 0;
  let resubmitted = 0;
  let muxChecked = 0;

  for (const v of stuck) {
    const id = v.id;
    const ageHours = (nowMs - parseTimestamp(v.created_at)) / (60 * 60 * 1000);
    try {
      if (!v.mux_asset_id) {
        console.log(`[RESUBMIT] ${id} ageHours=${ageHours.toFixed(1)} mux_asset_id=null`);
        if (!dryRun) {
          await submitToMux(id, v.storage_path);
          resubmitted += 1;
        }
        continue;
      }

      console.log(`[CHECK] ${id} ageHours=${ageHours.toFixed(1)} asset=${v.mux_asset_id} mux_status=${v.mux_status}`);
      muxChecked += 1;

      const asset = await getMuxAsset(v.mux_asset_id);
      const status = asset?.status;
      const mapping = mapMuxStatusToDb(status);
      const playbackId = asset?.playback_ids?.[0]?.id || null;

      const next = {
        mux_status: mapping.mux_status,
        mux_playback_id: mapping.mux_status === "ready" ? playbackId : null,
        processing_status: mapping.processing_status,
        is_processed: mapping.is_processed,
      };

      console.log(`  -> mux status=${status} next=${JSON.stringify(next)}`);

      if (!dryRun) {
        const { error: updErr } = await supabaseAdmin
          .from("videos")
          .update(next)
          .eq("id", id);
        if (updErr) throw updErr;
        updated += 1;
      }
    } catch (err) {
      console.error(`  Error for video ${id}:`, err?.message || err);
    }
  }

  console.log(`Done. updated=${updated} resubmitted=${resubmitted} muxChecked=${muxChecked}`);
}

main().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(1);
});

