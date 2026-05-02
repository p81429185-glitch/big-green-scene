# Plan: Playback speed control (0.25x – 4x)

Add a speed selector to the video player, available for every video. Uses the native `HTMLMediaElement.playbackRate` API, which does not affect quality (no re-encoding, no resolution change — only playback timing).

## Speed presets
0.25x, 0.5x, 0.75x, 1x (Normal), 1.25x, 1.5x, 1.75x, 2x, 3x, 4x

## Changes

### 1. `src/components/video/BrandedVideoPlayer.tsx` (in-app player)
- Add state `playbackRate` (default 1) and `showSpeedMenu`.
- Add a new control button in the bottom bar (next to Quality) showing current speed (e.g. "1x").
- On selection: set `videoRef.current.playbackRate = rate`. If `hasAudioTrack`, also set `audioRef.current.playbackRate = rate` to keep MP3 in sync. Also enable `preservesPitch` (and `mozPreservesPitch`/`webkitPreservesPitch`) on both elements so audio stays natural at non-1x speeds.
- Reset to 1x when source changes.
- Close menu on outside click (consistent with existing quality menu pattern).

### 2. `src/components/dashboard/EmbedDialog.tsx` (embeddable HTML snippet)
- Inject a speed button + menu next to the Quality button using the same inline-style pattern already used for `qbtn${uid}` / `qualMenu`.
- Menu lists the same 10 presets; clicking calls inline JS that sets `v.playbackRate` (and audio element's `playbackRate` when `hasAudio`), updates label text, and toggles `preservesPitch` on both elements.
- Default label "1x".

## Why it doesn't affect quality
`playbackRate` only changes how fast frames are presented and audio is sampled. The original bytes streamed (HLS levels for Mux, MP4 source otherwise) are unchanged. Setting `preservesPitch = true` keeps audio pitch natural at non-1x speeds without altering the source.

## Out of scope
No DB changes. No changes to upload/transcode/auth/audio-sync drift logic. Quality menu untouched.
