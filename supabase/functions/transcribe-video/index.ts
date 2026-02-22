import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_DOWNLOAD_SIZE = 20 * 1024 * 1024; // 20MB max for AI processing

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    if (!videoId) {
      return new Response(JSON.stringify({ error: "videoId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch video record
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("storage_path, size")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(JSON.stringify({ error: "Video not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL and download with range header for large files
    const { data: urlData } = supabase.storage
      .from("videos")
      .getPublicUrl(video.storage_path);

    const publicUrl = urlData.publicUrl;
    console.log("Downloading video, size:", video.size);

    // Download file (partial if too large)
    const isLarge = video.size > MAX_DOWNLOAD_SIZE;
    const fetchHeaders: Record<string, string> = {};
    if (isLarge) {
      fetchHeaders["Range"] = `bytes=0-${MAX_DOWNLOAD_SIZE - 1}`;
      console.log("Large file, downloading first 20MB only");
    }

    const downloadResp = await fetch(publicUrl, { headers: fetchHeaders });
    if (!downloadResp.ok && downloadResp.status !== 206) {
      console.error("Download failed:", downloadResp.status);
      return new Response(
        JSON.stringify({ error: "Nie udało się pobrać pliku wideo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await downloadResp.arrayBuffer();
    console.log("Downloaded bytes:", arrayBuffer.byteLength);

    // Convert to base64 in chunks to avoid stack overflow
    const uint8Array = new Uint8Array(arrayBuffer);
    const chunkSize = 32768;
    let binary = "";
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Video = btoa(binary);
    console.log("Base64 length:", base64Video.length);

    // Determine MIME type
    const ext = video.storage_path.split(".").pop()?.toLowerCase() || "mp4";
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
      avi: "video/x-msvideo", mkv: "video/x-matroska",
    };
    const mimeType = mimeMap[ext] || "video/mp4";

    const promptNote = isLarge
      ? "Transkrybuj dokładnie wszystkie słowa wypowiedziane w tym fragmencie nagrania wideo. Zwróć samą transkrypcję bez dodatkowych komentarzy. Jeśli w nagraniu nie ma mowy, napisz: 'Brak mowy w nagraniu.'"
      : "Transkrybuj dokładnie wszystkie słowa wypowiedziane w tym nagraniu wideo. Zwróć samą transkrypcję bez dodatkowych komentarzy. Jeśli w nagraniu nie ma mowy, napisz: 'Brak mowy w nagraniu.'";

    // Call Lovable AI Gateway
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptNote },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64Video}` },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Zbyt wiele żądań. Spróbuj ponownie za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Brak środków na koncie AI. Doładuj kredyty." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Błąd AI (${aiResponse.status}): ${errorText.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const transcription =
      aiData.choices?.[0]?.message?.content?.trim() || "Brak transkrypcji";

    // Save transcription to database
    const { error: updateError } = await supabase
      .from("videos")
      .update({ transcription })
      .eq("id", videoId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(JSON.stringify({ transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
