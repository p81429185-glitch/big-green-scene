import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyMuxSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    // Mux signature format: "t=<timestamp>,v1=<hash>".
    // Signed payload: "<timestamp>.<raw_request_body>"
    const parts = signatureHeader.split(",");
    let timestamp: string | null = null;
    const v1Signatures: string[] = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("t=")) {
        timestamp = trimmed.slice(2);
      } else if (trimmed.startsWith("v1=")) {
        v1Signatures.push(trimmed.slice(3).toLowerCase());
      }
    }

    if (!timestamp || v1Signatures.length === 0) return false;

    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) return false;

    // Default Mux tolerance is 5 minutes.
    const toleranceMs = 5 * 60 * 1000;
    const nowMs = Date.now();
    if (Math.abs(nowMs - tsNum * 1000) > toleranceMs) return false;

    const payload = `${timestamp}.${rawBody}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase();

    return v1Signatures.includes(computed);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Verify webhook signature
    const MUX_WEBHOOK_SECRET = Deno.env.get("MUX_WEBHOOK_SECRET");
    const signatureHeader = req.headers.get("mux-signature");

    if (MUX_WEBHOOK_SECRET && signatureHeader) {
      const valid = await verifyMuxSignature(rawBody, signatureHeader, MUX_WEBHOOK_SECRET);
      if (!valid) {
        console.error("Invalid Mux webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (MUX_WEBHOOK_SECRET && !signatureHeader) {
      console.error("Missing mux-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = JSON.parse(rawBody);
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
        .update({
          mux_status: "error",
          mux_playback_id: null,
          is_processed: false,
          processing_status: "failed",
        })
        .eq("mux_asset_id", assetId);

      if (error) console.error("DB update error on errored:", error);
      else console.log("Video marked as error, asset:", assetId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("mux-webhook error:", err);
    return new Response(JSON.stringify({ received: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
