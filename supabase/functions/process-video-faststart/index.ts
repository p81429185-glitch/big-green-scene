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
    const { videoId, storagePath } = await req.json();
    
    if (!videoId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "videoId and storagePath are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from("videos")
      .update({ processing_status: "processing" })
      .eq("id", videoId);

    console.log(`Processing video ${videoId} at path ${storagePath}`);

    // Download the video file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("videos")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      await supabase
        .from("videos")
        .update({ processing_status: "failed" })
        .eq("id", videoId);
      return new Response(
        JSON.stringify({ error: "Failed to download video file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Downloaded file size: ${fileData.size} bytes`);

    // Convert blob to ArrayBuffer for processing
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Check if file is MP4 and find moov atom position
    const moovInfo = findMoovAtom(uint8Array);
    
    if (!moovInfo.found) {
      console.log("No moov atom found or file is not MP4, marking as ready");
      await supabase
        .from("videos")
        .update({ is_processed: true, processing_status: "ready" })
        .eq("id", videoId);
      return new Response(
        JSON.stringify({ success: true, message: "File processed (no moov relocation needed)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (moovInfo.isAtStart) {
      console.log("Moov atom already at start, marking as ready");
      await supabase
        .from("videos")
        .update({ is_processed: true, processing_status: "ready" })
        .eq("id", videoId);
      return new Response(
        JSON.stringify({ success: true, message: "File already optimized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Relocate moov atom to the beginning (faststart)
    console.log(`Relocating moov atom from position ${moovInfo.moovStart} to start`);
    const processedData = relocateMoovAtom(uint8Array, moovInfo);

    if (!processedData) {
      console.error("Failed to relocate moov atom");
      await supabase
        .from("videos")
        .update({ processing_status: "failed" })
        .eq("id", videoId);
      return new Response(
        JSON.stringify({ error: "Failed to process video" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload the processed file back to storage (overwrite)
    const processedBlob = new Blob([processedData], { type: "video/mp4" });
    
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(storagePath, processedBlob, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      await supabase
        .from("videos")
        .update({ processing_status: "failed" })
        .eq("id", videoId);
      return new Response(
        JSON.stringify({ error: "Failed to upload processed video" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processed
    await supabase
      .from("videos")
      .update({ is_processed: true, processing_status: "ready" })
      .eq("id", videoId);

    console.log(`Video ${videoId} processed successfully`);
    
    return new Response(
      JSON.stringify({ success: true, message: "Video processed with faststart" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("process-video-faststart error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

// Helper: Read 64-bit big-endian integer (for extended size atoms)
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

// Find moov and mdat atoms in the file
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

    // Handle extended size atoms (size == 1)
    if (atomSize === 1 && offset + 16 <= data.length) {
      const extSize = readUint64BE(data, offset + 8);
      atomSize = Number(extSize);
    }

    // Handle atoms that extend to end of file (size == 0)
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

  // moov is at start if it comes before mdat
  result.isAtStart = moovBeforeMdat;

  return result;
}

// Relocate moov atom to the beginning of the file (after ftyp)
function relocateMoovAtom(data: Uint8Array, info: MoovInfo): Uint8Array | null {
  try {
    const moov = data.slice(info.moovStart, info.moovStart + info.moovSize);
    
    // Calculate offset adjustment for all chunk offsets in moov
    // After relocation, mdat will be pushed back by moovSize
    const offsetAdjustment = info.moovSize;
    
    // Update stco (32-bit chunk offsets) and co64 (64-bit chunk offsets) in moov
    const adjustedMoov = adjustChunkOffsets(moov, offsetAdjustment);
    
    if (!adjustedMoov) {
      return null;
    }

    // Build new file: ftyp + moov + (everything between ftyp and moov, excluding moov) + data after moov
    const ftyp = data.slice(0, info.ftypEnd);
    const beforeMoov = data.slice(info.ftypEnd, info.moovStart);
    const afterMoov = data.slice(info.moovStart + info.moovSize);
    
    const result = new Uint8Array(data.length);
    let writeOffset = 0;
    
    // Write ftyp
    result.set(ftyp, writeOffset);
    writeOffset += ftyp.length;
    
    // Write adjusted moov
    result.set(adjustedMoov, writeOffset);
    writeOffset += adjustedMoov.length;
    
    // Write content that was between ftyp and moov
    result.set(beforeMoov, writeOffset);
    writeOffset += beforeMoov.length;
    
    // Write content after moov
    result.set(afterMoov, writeOffset);
    
    return result;
  } catch (e) {
    console.error("Error relocating moov:", e);
    return null;
  }
}

// Adjust chunk offsets in moov atom
function adjustChunkOffsets(moov: Uint8Array, adjustment: number): Uint8Array | null {
  const result = new Uint8Array(moov);
  
  // Find and adjust stco atoms (32-bit chunk offsets)
  adjustStcoAtoms(result, adjustment);
  
  // Find and adjust co64 atoms (64-bit chunk offsets)
  adjustCo64Atoms(result, BigInt(adjustment));
  
  return result;
}

// Find and adjust stco (sample table chunk offset) atoms
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
      // stco structure: size(4) + type(4) + version(1) + flags(3) + entry_count(4) + entries
      const entryCount = readUint32BE(data, offset + 12);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 16 + i * 4;
        if (entryOffset + 4 <= data.length) {
          const currentOffset = readUint32BE(data, entryOffset);
          writeUint32BE(data, entryOffset, currentOffset + adjustment);
        }
      }
    }
    
    // Recurse into container atoms
    if (["moov", "trak", "mdia", "minf", "stbl"].includes(atomType)) {
      offset += 8;
    } else {
      offset += atomSize;
    }
  }
}

// Find and adjust co64 (64-bit chunk offset) atoms
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
      // co64 structure: size(4) + type(4) + version(1) + flags(3) + entry_count(4) + entries(8 each)
      const entryCount = readUint32BE(data, offset + 12);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 16 + i * 8;
        if (entryOffset + 8 <= data.length) {
          const currentOffset = readUint64BE(data, entryOffset);
          const newOffset = currentOffset + adjustment;
          // Write 64-bit big-endian
          writeUint32BE(data, entryOffset, Number(newOffset >> 32n));
          writeUint32BE(data, entryOffset + 4, Number(newOffset & 0xffffffffn));
        }
      }
    }
    
    // Recurse into container atoms
    if (["moov", "trak", "mdia", "minf", "stbl"].includes(atomType)) {
      offset += 8;
    } else {
      offset += atomSize;
    }
  }
}
