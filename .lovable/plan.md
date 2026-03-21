

# Audit: Embed Black Screen + Audio Issues

## Bugs Found

### Bug 1: Loading overlay blocks ALL clicks (ROOT CAUSE)
The loading overlay (`z-index:15`) sits on top of the big play button (`z-index:6`). The `click` handler for `hideLoading()` + `toggle()` is only on the big play button (`bb`), NOT on the overlay. If `loadedmetadata`/`canplay` events don't fire quickly, the overlay stays visible and the user cannot click through it to play the video. They see a black screen with a spinner that never goes away.

**Fix**: Add click handler on the loading overlay itself: `lo.addEventListener("click", function(){ hideLoading(); toggle(); });`

### Bug 2: No timeout fallback for Mux HLS path
Line 264: the 3-second `setTimeout(hideLoading, 3000)` is ONLY added for non-Mux videos. For Mux videos, the overlay hides only on `MANIFEST_PARSED`. If HLS loading fails silently (CDN blocked, hls.js fails to load), the overlay stays forever — permanent black screen.

**Fix**: Always add a timeout fallback (e.g. 5s for Mux, 3s for direct).

### Bug 3: `v.play()` promise not handled
`toggle()` calls `v.play()` without catching the rejected promise. If autoplay policy blocks playback, the big play button's opacity is set to 0 (hidden) but the video isn't actually playing. User sees nothing and has no way to retry.

**Fix**: Wrap `v.play()` in a `.catch()` that restores the big play button visibility.

### Bug 4: Missing `playsinline` attribute
The `<video>` tag in embed HTML has no `playsinline` attribute. On iOS Safari, videos without this attribute open in fullscreen native player instead of playing inline, breaking the custom controls and audio sync entirely.

**Fix**: Add `playsinline` attribute to the video element.

### Bug 5: Dual-audio embed — video "play" event may not fire on stall
For dual-audio embeds, the audio sync script waits for the video's "play" event to start audio. If the video element can't decode the file (stalls on black), the audio never starts — or if it somehow does start (e.g., via the `play()` call resolving), the audio plays while video stays black with no visual feedback to the user.

**Fix**: Add error handling — if video fires "error" event, show a visible error message instead of black screen. Also add `loadeddata` event as additional trigger to hide overlay.

### Bug 6: HLS CDN script may fail to load silently
The hls.js CDN `<script>` tag (line 172) is added BEFORE the main `<script>` block, but there's no `onerror` handler. If CDN is blocked (corporate firewall, China, etc.), `Hls` is undefined, and the `hlsInitScript` checks `typeof Hls !== "undefined"` — so it silently falls through without setting any video source. Result: permanent black screen, no error shown.

**Fix**: Add fallback in HLS init — if Hls is not available and native HLS not supported, fall back to direct MP4 URL.

## Implementation Plan

### File: `src/components/dashboard/EmbedDialog.tsx`

All changes inside `generateCustomPlayerCode()`:

1. **Video element**: Add `playsinline` attribute (line 211)

2. **Loading overlay**: Make it clickable — add click handler on `lo` element in the main script (around line 265):
   ```javascript
   lo.addEventListener("click", function(){ hideLoading(); toggle(); });
   ```

3. **Always add timeout fallback** (line 264): Remove the conditional, always add `setTimeout(hideLoading, 5000);` for all paths

4. **Handle play() promise** in `toggle()` (line 262):
   ```javascript
   function toggle(){
     if(v.paused){
       var p=v.play();
       if(p&&p.catch) p.catch(function(){bb.style.opacity="1";});
       bb.style.opacity="0";
     } else {v.pause();bb.style.opacity="1";}
   }
   ```

5. **Add video error handler** in main script:
   ```javascript
   v.addEventListener("error", function(){
     hideLoading();
     // Show error overlay or fallback message
   });
   ```

6. **HLS fallback**: In `hlsInitScript`, add fallback to direct URL if HLS not available and native not supported. Pass `directUrl` as parameter to the HLS init block.

7. **Add `loadeddata` event** as additional overlay-hiding trigger:
   ```javascript
   v.addEventListener("loadeddata", hideLoading);
   ```

No changes to any other files. No database changes. No changes to player controls, layout, or other functionality.

