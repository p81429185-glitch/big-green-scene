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
    const { video_id, storage_path } = await req.json();

    if (!video_id || !storage_path) {
      return new Response(
        JSON.stringify({ error: "video_id and storage_path required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID");
    const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET");

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return new Response(
        JSON.stringify({ error: "Mux credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate a signed URL for the video (1 hour expiry)
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(storage_path, 3600);

    if (signError || !signedData?.signedUrl) {
      console.error("Signed URL error:", signError);
      return new Response(
        JSON.stringify({ error: "Failed to create signed URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Submit to Mux
    const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    const muxResponse = await fetch("https://api.mux.com/video/v1/assets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${muxAuth}`,
      },
      body: JSON.stringify({
        input: [{ url: signedData.signedUrl }],
        playback_policy: ["public"],
        mp4_support: "standard",
      }),
    });

    if (!muxResponse.ok) {
      const errText = await muxResponse.text();
      console.error("Mux API error:", muxResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Mux API error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const muxData = await muxResponse.json();
    const asset = muxData.data;

    // Update DB
    const { error: updateError } = await supabaseAdmin
      .from("videos")
      .update({
        mux_asset_id: asset.id,
        mux_playback_id: asset.playback_ids?.[0]?.id || null,
        mux_status: "processing",
      })
      .eq("id", video_id);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, asset_id: asset.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-to-mux error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
