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
    const body = await req.json();
    const eventType = body.type;
    const assetId = body.data?.id;

    console.log("Mux webhook event:", eventType, "asset:", assetId);

    if (!assetId) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (eventType === "video.asset.ready") {
      const playbackId = body.data?.playback_ids?.[0]?.id || null;

      const { error } = await supabaseAdmin
        .from("videos")
        .update({
          mux_status: "ready",
          mux_playback_id: playbackId,
          is_processed: true,
          processing_status: "ready",
        })
        .eq("mux_asset_id", assetId);

      if (error) console.error("DB update error on ready:", error);
      else console.log("Video marked as ready, asset:", assetId);
    } else if (eventType === "video.asset.errored") {
      const { error } = await supabaseAdmin
        .from("videos")
        .update({ mux_status: "error" })
        .eq("mux_asset_id", assetId);

      if (error) console.error("DB update error on errored:", error);
      else console.log("Video marked as error, asset:", assetId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mux-webhook error:", err);
    // Always return 200 so Mux doesn't retry endlessly
    return new Response(JSON.stringify({ received: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
