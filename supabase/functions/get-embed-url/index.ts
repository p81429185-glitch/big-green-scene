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
    const { video_id, skip_domain_check } = await req.json();
    if (!video_id) {
      return new Response(JSON.stringify({ error: "video_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get video info
    const { data: video, error: videoErr } = await supabase
      .from("videos")
      .select("storage_path")
      .eq("id", video_id)
      .single();

    if (videoErr || !video) {
      return new Response(JSON.stringify({ error: "Video not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check embed settings (skip if skip_domain_check is true)
    if (!skip_domain_check) {
      const { data: embedSettings } = await supabase
        .from("video_embed_settings")
        .select("restrict_domain, allowed_domains")
        .eq("video_id", video_id)
        .maybeSingle();

      if (embedSettings?.restrict_domain && embedSettings.allowed_domains?.length) {
        const origin = req.headers.get("origin") || req.headers.get("referer") || "";
        let hostname = "";
        try {
          hostname = new URL(origin).hostname;
        } catch {
          hostname = origin;
        }

        const allowed = embedSettings.allowed_domains.some((domain: string) => {
          return hostname === domain || hostname.endsWith("." + domain);
        });

        if (!allowed) {
          return new Response(
            JSON.stringify({ error: "Domain not allowed" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Generate signed URL (4 hours)
    const { data: signedData, error: signErr } = await supabase.storage
      .from("videos")
      .createSignedUrl(video.storage_path, 14400);

    if (signErr || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signedData.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
