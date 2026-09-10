# Caravan v1.0.0 Build Notes

## v1.0.0 release

- Public release identity is v1.0.0.
- Runtime/gameplay/audio behavior is preserved from the hardware-tested v0.8.26 baseline.
- `metadata.json` and `APPINFO/CARAVAN.info` identify the release as 1.0.0.
- Test-only build artifacts are excluded from the public package.
- Device runtime remains rooted at `HOLO/CARAVAN/`.

## v0.8.26 Bottle Cap label + music onset/loop volume fix

- Volume Adjustment now displays `Bottle Cap` / `BOTTLE CAP`.
- Lazy Days Tired remains one native 16 kHz IMA-ADPCM WAV using `Pip.audioStart(..., {repeat:true})`; the playback architecture is unchanged.
- The first audible material occurs inside 2048-byte ADPCM block 2, after silence at the beginning of that block. Predictor/index-only scaling could not attenuate that intra-block onset, which created the brief loud start and the same burst on each native repeat.
- CARAVAN_MUSIC_LEVELS.BIN keeps its original 16 x 1209-byte sparse header table and appends 16 x 2048-byte true encoded variants of block 2.
- Music apply reads the selected 1209-byte header set plus only one 2048-byte onset block, patches the 403 sparse headers, then writes that complete selected onset block.
- This keeps the patch low-memory while ensuring first play and every native loop restart are already at the selected volume.
- All v0.8.25 Bottle Cap native-WAV queue behavior and unrelated systems are preserved.

# v0.8.25 native WAV Bottle Cap replacement

- Replaced MP3-derived result audio with the user-supplied native 16 kHz mono WAV sources.
- Runtime remains IMA-ADPCM WAV, 16 kHz mono, blockAlign 256 for the Pip-Boy audioStartVar path.
- Nuka-Cola remains Preview-only and is the Volume-15 loudness reference.
- Bottle Cap masters decode to approximately: Start -28.26 dB RMS, Loop -28.03 dB RMS, Finish -28.16 dB RMS, Preview -28.17 dB RMS.
- Stage dead-air was trimmed to block-aligned content windows: Start 17 blocks, Loop 7 blocks, Finish 57 blocks.
- Shared 0-15 sparse header tables were rebuilt from those masters with the same scaling formula used by Preview.
- Continuous queued 1 -> 2 repeats -> 4 logic remains unchanged except for the updated block counts.

# v0.8.24 Bottle Cap volume + seamless queue fix

- Renamed the Volume Adjustment entry from `Coin Sound` to `Bottle Cap Sound`.
- Rebuilt Bottle Cap 1/2/4 from the active left channel instead of averaging the silent right channel.
- Matched each Bottle Cap stage to the Nuka-Cola preview's effective mean level at Volume 15 before generating the shared 0-15 ADPCM header tables.
- Bottle Cap 1 and the first Bottle Cap 2 are queued back-to-back with `Pip.audioStartVar(..., overlap:false)`.
- Bottle Cap 2 repeats are appended before the hardware ring drains instead of reopening a WAV on a fixed timer.
- Bottle Cap 4 is streamed into that same live queue in 2 KB chunks after the counter finishes.
- This removes the repeated native audio stop/start boundaries that could create gaps or stutters.
- The Nuka-Cola file remains preview-only; its selected Bottle Cap Sound volume is shared by all three in-game stages.
- Playing Card/Discard level-table bytes are preserved.

# Caravan Build Notes

## Target
- Wand Company Pip-Boy 3000
- Firmware 1.1.6
- Display: 480×320
- Runtime: Espruino JavaScript

## Source/runtime convention
Readable source files are the source of truth. The holotape entry point follows the repository convention as `app.js` / `app.min.js`; supporting readable modules remain at the root and device-facing minified module copies live in `assets/`. `metadata.json` installs them to the normal `HOLO/CARAVAN/*.JS` runtime filenames.

## Runtime module map
```text
HOLO/CARAVAN/APP.JS
    -> CARAVAN_GAME.JS
        -> CARAVAN_RENDERER.JS
    -> CARAVAN_DEMO.JS (tutorial only)
        -> CARAVAN_RENDERER.JS
    -> CARAVAN_RESULTS.JS (results screen only, loaded after game cleanup)
    -> CARAVAN_SOUND.JS (Volume Adjustment only; unloaded on return)
```

The renderer also loads these tiny cached assets once per active game/demo:
```text
HOLO/CARAVAN/SUIT_S.IMG
HOLO/CARAVAN/SUIT_H.IMG
HOLO/CARAVAN/SUIT_D.IMG
HOLO/CARAVAN/SUIT_C.IMG
```

The results module loads one transparent 1-bit `CAP.IMG` derived from the exact supplied `CAP_SOURCE.IMG`. The one 120x120 runtime image is scaled by `drawImage` for the pop/pulse sizes and display intensity is used for the fade, so the animation keeps one cap asset without holding an 11.9 KB packed frame buffer in RAM.

## Deck and rules
Each match generates a full randomized 54-card deck: all 52 standard cards (A through K in all four suits) plus two Jokers. Opening caravan cards are forced to be numeric.

## Performance notes
- Suit icons use `drawImage` instead of repeated `setPixel` loops.
- CPU logic loads after the first board render.
- Selection movement uses partial border/scroller redraws.
- Player-to-CPU transition avoids a redundant full-board render.
- Demo rendering is staged with short timers to avoid watchdog starvation.

## Runtime-file generation
The included `.MIN.JS` files are conservative stripped runtime copies. Before public repository submission, regenerate them with the repository-approved minification / pretokenisation workflow and retest on hardware.


## Results animation
- The source HUDCaps-style timeline remains 112 source frames at approximately 30 FPS, but the Pip-Boy renderer outputs it at 12 FPS.
- Source-frame time is preserved by advancing 2.5 source frames per displayed frame, producing about 45 displayed frames over the same ~3.7 second duration.
- The 12 FPS scheduler uses an 83/83/84 ms repeating cadence for a 250 ms / 3-frame average.
- The supplied reference AVI is 480x320 at 12 FPS; it is used only as a display/timing reference and is not included in runtime storage.
- Frames 5-13: cap icon pop/pulse.
- Frames 9-19: counter slides in and bounces horizontally.
- Frames 16-49: CAPS label drops in, bounces, then fades/moves away.
- Frames 101-111: icon/counter fade-out approximation using dithered 1-bit cap frames and display intensity levels.
- The numerical reward/penalty counts rapidly from zero to the actual current ante. Static result text contains no cap amount.

## v0.5.16 cap asset packing
- Source artwork: exact uploaded `IMAGE (2).IMG`, retained byte-for-byte as `CAP_SOURCE.IMG`.
- Runtime artwork: transparent 1-bit Pip-Boy conversion with source aspect ratio preserved inside the existing 96/108/114/120 animation canvases.
- Eight former `CAP_NUKA_*.IMG` runtime files are concatenated into one `CAP_ANIM.BIN` (11,899 bytes).
- `CARAVAN_RESULTS.JS` hardcodes the frame offsets/lengths and creates a temporary slice only when the visible cap frame changes.
- 12 FPS scheduling and the existing reward/penalty counter timeline are unchanged.

## v0.5.17 low-memory results handoff
- Hardware log showed `LOW_MEMORY, MEMORY` at the Ringo-win/result transition.
- `onGameFinish` now tears down the game without attempting an in-stack defrag, draws the static results UI, then waits 100 ms before loading the results animation. This lets the old game timer callback and its closure return before new allocations begin.
- The deferred callback runs `E.defrag()` only after the game callback has unwound.
- Runtime cap storage is now one `CAP.IMG` (1,804 bytes) instead of `CAP_ANIM.BIN` (11,899 bytes).
- The 12 FPS 83/83/84 ms cadence, source-frame sampling, counter motion, cap pop sizes, and result layout are retained.

## v0.5.18 results artwork/layout

- Source artwork: exact uploaded `IMAGE (1)(2).IMG`, retained byte-for-byte as `CAP_SOURCE.IMG`.
- Runtime artwork: the same 120x120 1-bit conversion pipeline used by v0.5.17.
- Cap center X: 202 (was 180).
- Counter X animation: shifted 5 px left with all relative motion preserved.
- CAPS label: shifted 5 px left and the full Y trajectory shifted 22 px upward.
- 12 FPS timing and all frame/state thresholds are unchanged.


## v0.5.19 sound-effects architecture
- `CARD_PLAY.WAV`: supplied 16 kHz mono PCM WAV, streamed when either side successfully plays a card.
- `CARD_DISCARD.WAV`: supplied 16 kHz mono PCM WAV, streamed when either side discards.
- The first menu now includes `Volume Adjustment`. Its `SOUND EFFECTS` screen lazy-loads `CARAVAN_SOUND.JS`, keeping sound-settings UI code out of RAM during matches.
- `Playing Card` and `Discard` each have independent ON/OFF and 0-15 level values.
- `SOUND.JSON` is created only when the user changes a sound setting; no default settings asset is installed.
- Per-effect volume is scaled against `Pip.settings.volume`, applied with `Pip.setVol`, then restored with a short timer after streamed playback.
- The game does not `Pip.audioRead` the WAVs, avoiding persistent audio buffers on the memory-constrained device.


## v0.5.20 sound preview controls
- `CARAVAN_SOUND.JS` adds a fourth detail row: `Preview: PLAY / STOP`.
- The settings module calls back into APP.JS for streamed preview playback rather than loading WAV data itself.
- APP.JS reuses the existing per-effect volume scaling path with a preview override so preview can audition a sound even when its gameplay ON/OFF flag is disabled.
- Preview stop clears the short restore timer, calls `Pip.audioStop()`, and restores the prior master volume only when Caravan owns an active effect playback.
- The settings module tracks only one short preview timer and clears it on submenu/menu exit to avoid lingering callbacks.


## v0.5.21 louder maximum sound level
- The two streamed WAV assets are peak-normalized to about -1.5 dBFS so Volume 15 is substantially louder without requesting an out-of-range Pip-Boy master-volume value.
- Runtime format is unchanged: 16 kHz, mono, 16-bit PCM WAV.
- `CARD_PLAY.WAV` source gain is approximately +15.2 dB; `CARD_DISCARD.WAV` source gain is approximately +9.8 dB.
- The 0-15 per-effect setting, ON/OFF state, PLAY/STOP preview, streamed playback, and volume restoration logic are unchanged.

## v0.5.22 sound-effect credit text
- Both per-sound detail menus now show `Sound Effect by Alex from Pixabay` instead of the old preview helper sentence.
- Runtime sound behavior is unchanged.


## v0.8.18 discard gameplay SFX reliability
- V0.8.17 results/cap-counter files are unchanged.
- `CARD_DISCARD_OVERLAP.WAV` keeps the audible discard transient and enough tail, but trims unused trailing silence at an IMA-ADPCM block boundary: 20 blocks -> 12 blocks.
- `CARAVAN_SFX_APPLY` patches only the 12 retained discard blocks when the user changes Discard volume.
- The separate 8 kHz `CARD_DISCARD_PREVIEW.WAV` is unchanged.

## v0.8.19 result cap-count coin loop
- Uses the exact supplied `Coin Sound.wav` as installed `CAP_COUNT.WAV` (16 kHz mono PCM, 1.418 s).
- The sound begins on the first actual displayed counter change for both PLAYER wins and CPU losses.
- While the number is still changing, the audible portion is replayed at ~1.18 s intervals; the source file's final ~0.24 s is mostly quiet tail.
- When the final cap value is reached, no further replay is queued, so the active sound continues through its full natural ending instead of being cut off.
- Playback uses native `Pip.audioStart()` streaming rather than `Pip.audioRead()`/`audioStartVar()`, avoiding a ~45 KB JavaScript buffer allocation.
- V0.8.18 discard SFX behavior and V0.8.17 result visuals/counter timing are otherwise unchanged.

## v0.8.20 coin half-loop + volume control
- `CAP_COUNT_LOOP.WAV` is the first ~0.709 seconds of the supplied sound and is repeated only while the cap number is changing.
- `CAP_COUNT_END.WAV` is the second ~0.709 seconds and plays once after the last loop boundary when counting has completed.
- `CAP_COUNT.WAV` remains the complete ~1.418-second effect and is used by Volume Adjustment Preview.
- Coin Sound is appended to `SOUND.CFG` as ON/OFF + Volume chars 6-7; existing chars 0-5 keep their prior meanings.
- Runtime coin loop/end volume uses sparse IMA-ADPCM header patches and does not load the audio files into JS RAM.

## v0.8.22 coin +7 dB master
- Coin master gain is increased another +5 dB over V0.8.21, yielding approximately +7 dB total relative to the originally supplied Coin Sound.
- `CAP_COUNT.WAV`, `CAP_COUNT_LOOP.WAV`, and `CAP_COUNT_END.WAV` keep their V0.8.21 timing/split behavior; only gain is changed.
- Coin loop/end 0-15 sparse ADPCM tables are regenerated for the louder master. Existing Playing Card and Discard table bytes remain unchanged.
- Runtime result timing remains ~348 ms per quarter-loop; no results JS behavior changed.

## v0.8.21 coin quarter-loop tuning
- `CAP_COUNT.WAV`: full-length Coin Sound Preview, now with a modest +2 dB source gain.
- `CAP_COUNT_LOOP.WAV`: first ~0.347 s encoded playback / ~quarter of the effect, with tiny edge fades for cleaner repeating.
- `CAP_COUNT_END.WAV`: remaining tail beginning at the quarter split, with a tiny fade-in for a smoother loop-to-finish handoff.
- Results loop boundary timer is ~348 ms (lets all 11 ADPCM blocks drain).
- Coin runtime volume patch tables were rebuilt for 11 loop blocks and 35 tail blocks; the existing Playing Card/Discard table bytes were not changed.

## v0.8.23 three-stage Bottle Cap result audio
- `CAP_COUNT_START.WAV`: supplied Bottle Cap 1, 16 kHz mono IMA-ADPCM, 20 blocks, encoded boundary ~632 ms.
- `CAP_COUNT_LOOP.WAV`: supplied Bottle Cap 2, 16 kHz mono IMA-ADPCM, 9 blocks, encoded boundary ~285 ms. Repeats only while the displayed cap count is still changing.
- `CAP_COUNT_END.WAV`: supplied `bottle cap 4.mp3`, used as the requested finishing stage, 16 kHz mono IMA-ADPCM, 59 blocks.
- `CAP_COUNT.WAV`: supplied Nuka-Cola audio, 16 kHz mono IMA-ADPCM, used only as the Coin Sound Volume Adjustment Preview.
- Coin Sound `SOUND.CFG` chars 6-7 remain the shared ON/OFF + Volume 0-15 control for the Nuka preview and all three result-stage files.
- Sparse result-audio volume tables now patch Start + Loop + End together before game load; Playing Card and Discard table bytes remain unchanged.
- Current credit text: Sound Distributed From Wand Company PIP-BOY 3000.
