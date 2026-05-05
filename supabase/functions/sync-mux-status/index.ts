import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID");
    const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET");
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return new Response(JSON.stringify({ error: "Mux credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let video_id: string | null = null;
    try {
      const body = await req.json();
      video_id = body?.video_id ?? null;
    } catch (_) {
      // no body — sync all stuck
    }

    let query = supabaseAdmin
      .from("videos")
      .select("id, mux_asset_id, mux_status")
      .not("mux_asset_id", "is", null);

    if (video_id) {
      query = query.eq("id", video_id);
    } else {
      query = query.in("mux_status", ["processing", "pending"]);
    }

    const { data: videos, error } = await query;
    if (error) {
      console.error("Fetch error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const v of videos ?? []) {
      try {
        const r = await fetch(`https://api.mux.com/video/v1/assets/${v.mux_asset_id}`, {
          headers: { Authorization: `Basic ${muxAuth}` },
        });
        if (!r.ok) {
          const t = await r.text();
          console.error("Mux GET asset failed:", v.id, r.status, t);
          results.push({ id: v.id, ok: false, status: r.status });
          continue;
        }
        const j = await r.json();
        const asset = j.data;
        const status = asset.status as string;
        const playbackId = asset.playback_ids?.[0]?.id || null;

        let update: Record<string, unknown> = {};
        if (status === "ready") {
          update = {
            mux_status: "ready",
            mux_playback_id: playbackId,
            is_processed: true,
            processing_status: "ready",
          };
        } else if (status === "errored") {
          update = {
            mux_status: "error",
            is_processed: false,
            processing_status: "failed",
          };
        } else {
          update = { mux_status: "processing", processing_status: "processing" };
        }

        const { error: upErr } = await supabaseAdmin.from("videos").update(update).eq("id", v.id);
        if (upErr) console.error("DB update error:", v.id, upErr);
        results.push({ id: v.id, status, playbackId });
      } catch (e) {
        console.error("Sync error for", v.id, e);
        results.push({ id: v.id, ok: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-mux-status error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
