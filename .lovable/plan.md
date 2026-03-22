

# Fix: Dual-audio (MP4+MP3) embed broken — black screen + audio issues

## Root Cause

**Bug 1 (CRITICAL): Audio autoplay blocked by browser**
The `audioSyncScript` plays audio via `v.addEventListener("play", function(){ a.play(); })`. But this event fires asynchronously after `v.play()` resolves — by then the user gesture context is lost. Browsers block `a.play()` as an unauthorized autoplay attempt. Result: video plays muted, audio never starts (or starts inconsistently).

**Bug 2: `a.play()` promise not caught**
`a.play()` returns a promise that can reject (autoplay policy). The rejection is unhandled, causing console errors and inconsistent behavior.

**Bug 3: Loading overlay hides before audio is ready**
The loading overlay only listens for video element events (`canplay`, `loadeddata`). For dual-audio embeds, it should also wait for the audio element to be ready. If video loads but audio CDN is slow, user clicks play and gets no sound.

**Bug 4: Seek bar doesn't sync audio**
The progress bar click handler (line 278) sets `v.currentTime` but doesn't sync `a.currentTime`. The audioSyncScript only listens for "seeked" event which may not fire reliably on all browsers from programmatic seeks.

## Fix Plan

### File: `src/components/dashboard/EmbedDialog.tsx`

All changes inside `generateCustomPlayerCode()`:

**1. Move audio play/pause into toggle() directly** (keeps user gesture context):

For dual-audio embeds, modify the `toggle()` function to also reference `a` (audio element) and play/pause it directly alongside the video:
```javascript
function toggle(){
  if(v.paused){
    var p=v.play();if(p&&p.catch)p.catch(function(){bb.style.opacity="1";});
    var ap=a.play();if(ap&&ap.catch)ap.catch(function(){});
    a.currentTime=v.currentTime;
    bb.style.opacity="0";
  } else {
    v.pause();a.pause();bb.style.opacity="1";
  }
}
```

This requires `a` to be defined in the main IIFE scope. Add `a=document.getElementById("${audId}")` to the variable declarations at line 263.

**2. Simplify audioSyncScript** — remove play/pause listeners (now handled by toggle), keep only:
- `v.muted=true`
- seeked sync: `v.addEventListener("seeked", function(){ a.currentTime=v.currentTime; })`
- drift correction interval (every 5s)

**3. Wait for both video AND audio canplay before hiding overlay**:

For dual-audio embeds, change the hide logic:
```javascript
var vReady=false, aReady=false;
function checkBothReady(){ if(vReady&&aReady) hideLoading(); }
v.addEventListener("canplay",function(){ vReady=true; checkBothReady(); });
a.addEventListener("canplay",function(){ aReady=true; checkBothReady(); });
```
Keep the 5s timeout fallback as safety net.

**4. Sync audio on progress bar seek**:

Update the bar click handler to also set audio currentTime:
```javascript
bar.addEventListener("click",function(e){
  var r=bar.getBoundingClientRect();
  var t=(e.clientX-r.left)/r.width*v.duration;
  v.currentTime=t;
  if(a) a.currentTime=t;
});
```

**5. Sync audio on skip button clicks**:

The skip-back and skip-forward buttons (lines 218-226) only set `v.currentTime`. For dual-audio, they need to also sync `a.currentTime`. Since these are inline onclick handlers, they need to reference the audio element by ID.

### Implementation approach

Since all these changes are conditional on `hasAudio`, the cleanest approach is:
- In the main IIFE, conditionally add `a` to the variable declarations when `hasAudio`
- Generate a different `toggle()` function body when `hasAudio`
- Generate different event listeners for loading when `hasAudio`
- Update seek/skip handlers to include audio sync when `hasAudio`
- Simplify `audioSyncScript` to only contain drift correction and seeked sync

No changes to any other files. No database changes.

