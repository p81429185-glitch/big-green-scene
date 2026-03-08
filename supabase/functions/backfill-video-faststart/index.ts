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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Query all unprocessed videos
    const { data: videos, error: queryError } = await supabase
      .from("videos")
      .select("id, title, size, storage_path")
      .or("is_processed.is.null,is_processed.eq.false")
      .order("created_at", { ascending: true });

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query videos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ total: 0, success: 0, failed: 0, failed_ids: [], message: "No videos to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${videos.length} unprocessed videos`);

    let success = 0;
    let failed = 0;
    const failedIds: string[] = [];

    // Process videos one at a time sequentially
    for (const video of videos) {
      try {
        console.log(`Processing: ${video.title} (${formatSize(video.size)})`);

        // Update status to processing
        await supabase
          .from("videos")
          .update({ processing_status: "processing" })
          .eq("id", video.id);

        // Download the video file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("videos")
          .download(video.storage_path);

        if (downloadError || !fileData) {
          throw new Error(`Download failed: ${downloadError?.message || "No data"}`);
        }

        // Convert blob to ArrayBuffer for processing
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Check if file is MP4 and find moov atom position
        const moovInfo = findMoovAtom(uint8Array);

        if (!moovInfo.found || moovInfo.isAtStart) {
          // No relocation needed - just mark as processed
          await supabase
            .from("videos")
            .update({ is_processed: true, processing_status: "ready" })
            .eq("id", video.id);
          
          console.log(`Processed: ${video.title} (${formatSize(video.size)}) - no relocation needed`);
          success++;
          continue;
        }

        // Relocate moov atom to the beginning (faststart)
        const processedData = relocateMoovAtom(uint8Array, moovInfo);

        if (!processedData) {
          throw new Error("Failed to relocate moov atom");
        }

        // Upload the processed file back to storage (overwrite)
        const processedBlob = new Blob([processedData], { type: "video/mp4" });

        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(video.storage_path, processedBlob, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Mark as processed
        await supabase
          .from("videos")
          .update({ is_processed: true, processing_status: "ready" })
          .eq("id", video.id);

        console.log(`Processed: ${video.title} (${formatSize(video.size)})`);
        success++;

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to process video ${video.id} (${video.title}): ${errorMsg}`);
        
        // Mark as failed but continue to next video
        await supabase
          .from("videos")
          .update({ processing_status: "failed" })
          .eq("id", video.id);

        failed++;
        failedIds.push(video.id);
      }
    }

    const summary = {
      total: videos.length,
      success,
      failed,
      failed_ids: failedIds,
    };

    console.log(`Backfill complete: ${success}/${videos.length} successful, ${failed} failed`);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("backfill-video-faststart error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

// Helper: Read 32-bit big-endian integer
function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  ) >>> 0;
}

// Helper: Write 32-bit big-endian integer
function writeUint32BE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

// Helper: Read 64-bit big-endian integer
function readUint64BE(data: Uint8Array, offset: number): bigint {
  const high = BigInt(readUint32BE(data, offset));
  const low = BigInt(readUint32BE(data, offset + 4));
  return (high << 32n) | low;
}

// Helper: Get atom type as string
function getAtomType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

interface MoovInfo {
  found: boolean;
  isAtStart: boolean;
  moovStart: number;
  moovSize: number;
  mdatStart: number;
  mdatSize: number;
  ftypEnd: number;
}

function findMoovAtom(data: Uint8Array): MoovInfo {
  const result: MoovInfo = {
    found: false,
    isAtStart: false,
    moovStart: 0,
    moovSize: 0,
    mdatStart: 0,
    mdatSize: 0,
    ftypEnd: 0,
  };

  let offset = 0;
  let moovBeforeMdat = false;

  while (offset < data.length - 8) {
    let atomSize = readUint32BE(data, offset);
    const atomType = getAtomType(data, offset + 4);

    if (atomSize === 1 && offset + 16 <= data.length) {
      const extSize = readUint64BE(data, offset + 8);
      atomSize = Number(extSize);
    }

    if (atomSize === 0) {
      atomSize = data.length - offset;
    }

    if (atomSize < 8) break;

    if (atomType === "ftyp") {
      result.ftypEnd = offset + atomSize;
    } else if (atomType === "moov") {
      result.found = true;
      result.moovStart = offset;
      result.moovSize = atomSize;
      if (result.mdatStart === 0) {
        moovBeforeMdat = true;
      }
    } else if (atomType === "mdat") {
      result.mdatStart = offset;
      result.mdatSize = atomSize;
    }

    offset += atomSize;
  }

  result.isAtStart = moovBeforeMdat;
  return result;
}

function relocateMoovAtom(data: Uint8Array, info: MoovInfo): Uint8Array | null {
  try {
    const moov = data.slice(info.moovStart, info.moovStart + info.moovSize);
    const offsetAdjustment = info.moovSize;
    const adjustedMoov = adjustChunkOffsets(moov, offsetAdjustment);

    if (!adjustedMoov) {
      return null;
    }

    const ftyp = data.slice(0, info.ftypEnd);
    const beforeMoov = data.slice(info.ftypEnd, info.moovStart);
    const afterMoov = data.slice(info.moovStart + info.moovSize);

    const result = new Uint8Array(data.length);
    let writeOffset = 0;

    result.set(ftyp, writeOffset);
    writeOffset += ftyp.length;

    result.set(adjustedMoov, writeOffset);
    writeOffset += adjustedMoov.length;

    result.set(beforeMoov, writeOffset);
    writeOffset += beforeMoov.length;

    result.set(afterMoov, writeOffset);

    return result;
  } catch (e) {
    console.error("Error relocating moov:", e);
    return null;
  }
}

function adjustChunkOffsets(moov: Uint8Array, adjustment: number): Uint8Array | null {
  const result = new Uint8Array(moov);
  adjustStcoAtoms(result, adjustment);
  adjustCo64Atoms(result, BigInt(adjustment));
  return result;
}

function adjustStcoAtoms(data: Uint8Array, adjustment: number): void {
  let offset = 0;

  while (offset < data.length - 8) {
    const atomType = getAtomType(data, offset + 4);
    let atomSize = readUint32BE(data, offset);

    if (atomSize === 1 && offset + 16 <= data.length) {
      atomSize = Number(readUint64BE(data, offset + 8));
    }
    if (atomSize === 0) atomSize = data.length - offset;
    if (atomSize < 8) break;

    if (atomType === "stco") {
      const entryCount = readUint32BE(data, offset + 12);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 16 + i * 4;
        if (entryOffset + 4 <= data.length) {
          const currentOffset = readUint32BE(data, entryOffset);
          writeUint32BE(data, entryOffset, currentOffset + adjustment);
        }
      }
    }

    if (["moov", "trak", "mdia", "minf", "stbl"].includes(atomType)) {
      offset += 8;
    } else {
      offset += atomSize;
    }
  }
}

function adjustCo64Atoms(data: Uint8Array, adjustment: bigint): void {
  let offset = 0;

  while (offset < data.length - 8) {
    const atomType = getAtomType(data, offset + 4);
    let atomSize = readUint32BE(data, offset);

    if (atomSize === 1 && offset + 16 <= data.length) {
      atomSize = Number(readUint64BE(data, offset + 8));
    }
    if (atomSize === 0) atomSize = data.length - offset;
    if (atomSize < 8) break;

    if (atomType === "co64") {
      const entryCount = readUint32BE(data, offset + 12);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 16 + i * 8;
        if (entryOffset + 8 <= data.length) {
          const currentOffset = readUint64BE(data, entryOffset);
          const newOffset = currentOffset + adjustment;
          writeUint32BE(data, entryOffset, Number(newOffset >> 32n));
          writeUint32BE(data, entryOffset + 4, Number(newOffset & 0xffffffffn));
        }
      }
    }

    if (["moov", "trak", "mdia", "minf", "stbl"].includes(atomType)) {
      offset += 8;
    } else {
      offset += atomSize;
    }
  }
}
