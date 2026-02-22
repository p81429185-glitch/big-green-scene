import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Check file size (~200MB limit)
    if (video.size > 200 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Plik jest za duży (max 200MB)" }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Download video file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("videos")
      .download(video.storage_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download video" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Video = btoa(binary);

    // Determine MIME type from file extension
    const ext = video.storage_path.split(".").pop()?.toLowerCase() || "mp4";
    const mimeMap: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
    };
    const mimeType = mimeMap[ext] || "video/mp4";

    // Call Lovable AI Gateway with video
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
                {
                  type: "text",
                  text: "Transkrybuj dokładnie wszystkie słowa wypowiedziane w tym nagraniu wideo. Zwróć samą transkrypcję bez dodatkowych komentarzy. Jeśli w nagraniu nie ma mowy, napisz: 'Brak mowy w nagraniu.'",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Video}`,
                  },
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
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Brak środków na koncie AI. Doładuj kredyty." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Błąd podczas transkrypcji" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
