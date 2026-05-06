import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function submitSingleVideoToMux(
  supabaseAdmin: ReturnType<typeof createClient>,
  muxAuth: string,
  videoId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string; asset_id?: string }> {
  // Generate signed URL
  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from("videos")
    .createSignedUrl(storagePath, 3600);

  if (signError || !signedData?.signedUrl) {
    console.error("Signed URL error for", videoId, signError);
    const status = (signError as any)?.statusCode || (signError as any)?.status;
    if (status === "404" || status === 404 || status === 400) {
      await supabaseAdmin
        .from("videos")
        .update({ processing_status: "failed", mux_status: "error" })
        .eq("id", videoId);
    }
    return { success: false, error: "Failed to create signed URL" };
  }

  // Submit to Mux
  const muxResponse = await fetch("https://api.mux.com/video/v1/assets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${muxAuth}`,
    },
    body: JSON.stringify({
      input: [{ url: signedData.signedUrl }],
      playback_policy: ["public"],
      mp4_support: "capped-1080p",
    }),
  });

  if (!muxResponse.ok) {
    const errText = await muxResponse.text();
    console.error("Mux API error for", videoId, muxResponse.status, errText);
    return { success: false, error: `Mux API: ${muxResponse.status}` };
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
      processing_status: "processing",
      is_processed: false,
    })
    .eq("id", videoId);

  if (updateError) {
    console.error("DB update error for", videoId, updateError);
  }

  return { success: true, asset_id: asset.id };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { video_id, storage_path, backfill_all } = await req.json();

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

    const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

    // If backfill_all mode — process all videos without mux_asset_id
    if (backfill_all) {
      const { data: videos, error: fetchError } = await supabaseAdmin
        .from("videos")
        .select("id, storage_path")
        .is("mux_asset_id", null);

      if (fetchError) {
        console.error("Fetch videos error:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch videos" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!videos || videos.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No videos to process", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Backfilling ${videos.length} videos to Mux`);
      let processed = 0;
      let errors = 0;

      for (const video of videos) {
        const result = await submitSingleVideoToMux(supabaseAdmin, muxAuth, video.id, video.storage_path);
        if (result.success) {
          processed++;
        } else {
          errors++;
        }
        // 500ms delay between requests
        if (videos.indexOf(video) < videos.length - 1) {
          await delay(500);
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed, errors, total: videos.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single video mode
    if (!video_id || !storage_path) {
      return new Response(
        JSON.stringify({ error: "video_id and storage_path required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await submitSingleVideoToMux(supabaseAdmin, muxAuth, video_id, storage_path);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, asset_id: result.asset_id }),
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
