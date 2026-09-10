# Caravan v1.0.0

Playable Fallout: New Vegas Caravan card game for the Wand Company Pip-Boy 3000 / 3000a, targeting firmware 1.1.6. Play against Ringo, learn the rules through the guided Demo / Tutorial, configure game audio and music, and finish matches with animated cap win/loss results.



## v1.0.0 release

- First stable public release of Caravan for the Wand Company Pip-Boy 3000 / 3000a.
- Player-vs-CPU Caravan with randomized 54-card decks, betting, face cards, Jokers, win/loss detection, rematches, and a guided Demo / Tutorial.
- Low-memory modular runtime designed around the Pip-Boy 3000 firmware 1.1.6 limits.
- Configurable Playing Card, Discard, Bottle Cap, and Lazy Days Tired audio with persistent Volume 0-15 settings.
- Smooth three-stage Bottle Cap result audio and animated happy/sad cap result art.
- Native repeating background music begins and loops at the selected volume without the previous brief loud onset.
- Stable runtime path: `HOLO/CARAVAN/`.

## v0.8.26 Bottle Cap label + music loop-volume boundary fix

- Renamed the Volume Adjustment item `Bottle Cap Sound` to `Bottle Cap` (detail title: `BOTTLE CAP`).
- Fixed the brief full-volume burst at the beginning of `Lazy Days Tired` and again whenever the native repeating stream loops.
- Root cause: the song begins audibly inside 2048-byte IMA-ADPCM block 2, whose predictor/index header is still zero because that block starts with silence. Header-only volume scaling therefore could not affect the later audible samples inside that same block.
- `CARAVAN_MUSIC_LEVELS.BIN` now retains the existing sparse 3-byte header tables and appends one true 2048-byte encoded onset block for each Volume 0-15 level.
- `CARAVAN_MUSIC_APPLY.JS` still performs the low-memory sparse header update, then replaces only that one onset block with the selected level before gameplay opens the native repeating stream.
- Since the WAV itself is corrected before `Pip.audioStart(..., {repeat:true})`, both first playback and every native loop restart begin at the selected volume with no delayed gain correction.
- Bottle Cap WAV sequence/volume matching, Discard SFX, cap-number animation, Happy/Sad artwork, gameplay, CPU, and unrelated audio remain unchanged from v0.8.25.

## v0.8.25 native WAV Bottle Cap replacement

- Uses the newly supplied 16 kHz mono WAV sources for Bottle Cap 1, Bottle Cap 2, Bottle Cap 4, and the Nuka-Cola Volume Adjustment Preview.
- Bottle Cap 1/2/4 are gain-matched to the Nuka-Cola Preview's effective Volume-15 loudness (decoded masters approximately -28.2 dB RMS).
- The same Bottle Cap Sound Volume 0-15 curve applies to Preview and all three in-game stages.
- Result sequence remains Bottle Cap 1 -> Bottle Cap 2 loop -> Bottle Cap 4 on one continuous queued 16 kHz stream.
- Dead-air at the stage boundaries is trimmed so Bottle Cap 2 repeats do not introduce silence/stutter gaps.
- Existing Discard SFX, smooth cap-number animation, Happy/Sad art, gameplay, CPU, and unrelated audio are unchanged.

## Architecture

- `app.js` — readable holotape shell and lifecycle entry point.
- `CARAVAN_GAME.JS` — readable match state, deck generation, rules, input, turn flow.
- `CARAVAN_RENDERER.JS` — readable 480×320 game renderer.
- `CARAVAN_DEMO.JS` — guided tutorial, loaded only while Demo / Tutorial is active.
- `CARAVAN_RESULTS.JS` — 12 FPS post-match cap reward/penalty animation.
- `CARAVAN_SOUND.JS` — low-memory Volume Adjustment / Sound Effects menu, loaded only while sound settings are open.
- `CARD_PLAY.WAV` / `CARD_DISCARD.WAV` — streamed card action sound effects; they are not preloaded into RAM.
- `CAP.IMG` — one 120x120 transparent 1-bit runtime bottle-cap image used by the low-memory results animation.
- `SUIT_*.IMG` — tiny cached suit images derived from the user-provided suit artwork.
- `app.min.js` and `assets/*.MIN.JS` — device runtime copies installed through `metadata.json`.

The stable device path remains `HOLO/CARAVAN/`.

## Controls

### Menus
- Left wheel: move selection.
- Left wheel press: select.
- On the bet screen, right wheel adjusts the current ante.

### Volume Adjustment
- Main menu -> `Volume Adjustment` -> `Playing Card`, `Discard`, `Bottle Cap`, or `Lazy Days Tired`.
- Playing Card, Discard, and Bottle Cap each have an independent `Sound: ON/OFF` toggle.
- Select `Volume` and turn the left wheel to adjust from `0` to `15`; press again to finish editing.
- Each sound submenu includes `Preview: PLAY / STOP` so the current sound can be auditioned at the selected volume without leaving the menu. Preview is available even if the gameplay Sound toggle is OFF.
- Sound settings are saved to `HOLO/CARAVAN/SOUND.CFG` and reused next time.

### Game
- Left wheel: choose one of your three caravans.
- Left wheel press: open / confirm the CARD ACTION popup.
- Right wheel: scroll cards in your hand; while the popup is open, scroll its three options.
- Discard ends the player's turn and draws a replacement when cards remain.

## Current gameplay scope

Implemented:
- Player vs CPU.
- Three caravans per side.
- Full randomized 54-card deck for each player (52 standard cards + 2 Jokers).
- Four Aces guaranteed in each deck; Ace value is 1.
- Number cards 2–10.
- Jacks, Queens, Kings, and two Jokers in each test deck.
- Jack removes the currently targeted numeric card group and its attached face cards.
- Queen reverses the current caravan direction and changes the effective suit.
- King doubles the value of the targeted numeric card group; multiple Kings multiply again.
- Joker on an Ace removes the other numeric cards of that Ace's suit from both boards.
- Joker on a 2–10 removes the other numeric cards of that rank from both boards.
- Eight-card hands.
- Numeric-only automatic opening card on each caravan.
- Ascending / descending play with same-suit override.
- 21–26 selling range and two-of-three win detection.
- CPU heuristic support for number cards and face/Joker cards.
- Guided Demo / Tutorial.

Current targeting limitation:
- Face cards and Jokers use the current implementation's selected-caravan / top-numeric-card targeting model. Exact FNV per-card targeting across either player's full board is still a future expansion.

Not yet implemented:
- Disband-caravan action.
- Exact `FalloutNV.esm` opponent decks and exact Ringo AI.
- Exact original FNV card artwork on the Pip-Boy display.
- Full deck-builder / collected-card UI.
- Persistent caps / deck configuration.

## Performance / packaging

- Replaced repeated per-pixel suit drawing with four tiny cached `.IMG` suit assets and `drawImage`.

- Replaced the bottle-cap artwork with the newly supplied `IMAGE (2).IMG` source.
- The results animation now uses one transparent `CAP.IMG` runtime image, reducing device file/metadata count without changing the 12 FPS animation timeline.
- The cap image is loaded only while the results widget is active and is released when the results module is removed.
- The board is drawn before the CPU module is lazy-loaded, reducing the blank delay when entering a match.
- Removed the extra full-board redraw between the player action and the CPU response.
- Kept border-only hand and caravan selection redraws.
- Kept the staged Demo / Tutorial first render so the firmware can service the watchdog between expensive draws.

## Hardware test priorities

1. Enter a normal match and confirm the first screen appears quickly and fully.
2. Scroll hand and caravan selections repeatedly and check for smooth input.
3. Play J / Q / K / Joker cards and verify totals and removal effects.
4. Confirm `Total Cards = #` starts below 30 after the opening three cards and decreases as cards are played/discarded.
5. Enter / exit Demo several times.
6. Test repeated matches and other Pip-Boy tabs for memory or watchdog resets.


## Results animation
After a match, Caravan runs the cap reward/penalty widget at a Pip-Boy-friendly 12 FPS while preserving the original ~3.7 second animation duration. The bottle-cap artwork comes from the supplied cap image and is rendered from a single low-memory `CAP.IMG` runtime asset. `YOU WIN`, or `RINGO WINS` plus `YOU LOSE`, is drawn above the widget. The static result text never shows a cap amount; only the animated widget counts from `0` to `+ante` for a win or `0` to `-ante` for a loss. Rematch/Back remain near the bottom. The supplied 480x320, 12 FPS reference AVI was used only as a timing/display reference and is not installed or played by Caravan.


### v0.5.17 results-memory fix
The results animation now uses a single 120x120 transparent cap image with runtime scaling and a deferred post-game handoff, reducing the peak RAM allocation at the win/loss transition while retaining the 12 FPS animation and animated cap counter.

### v0.5.18 tighter results widget
The bottle cap, animated +/- amount, and CAPS label are grouped closer together around screen center. The cap/counter/label animation timings and the 12 FPS schedule are unchanged; only their widget placement and the supplied cap artwork changed.


### v0.5.19 card sound effects / volume menu
- Added the supplied `Playing Card.wav` when either the player or Ringo successfully plays a card.
- Added the supplied `Discard.wav` when either the player or Ringo discards.
- Actual play/discard actions use the custom WAV instead of also stacking the built-in SELECT sound.
- Added `Volume Adjustment` to the first Caravan menu.
- `SOUND EFFECTS` contains highlighted `Playing Card` and `Discard` submenus.
- Each sound has independent ON/OFF and 0-15 volume controls. The per-effect level is applied relative to the Pip-Boy master volume, then the master volume is restored after the short WAV completes.
- Audio streams from storage with `Pip.audioStart`, so the WAVs are not held in RAM.


### v0.5.20 sound preview controls
- Added `Preview: PLAY / STOP` to both sound-effect submenus.
- Preview streams the selected WAV using the current 0-15 per-effect volume and can be stopped immediately.
- Leaving the submenu or Volume Adjustment screen stops the preview and restores the Pip-Boy master volume.
- Preview is independent of the gameplay ON/OFF toggle so a disabled effect can still be auditioned before enabling it.


### Background Music
- **Lazy Days Tired** — Music by [Geoff Harvey](https://pixabay.com/users/geoffharvey-9096471/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=385887) from [Pixabay](https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=385887).


## v0.8.18 discard gameplay SFX reliability
The accepted v0.8.17 results/cap animation is unchanged. The live 16 kHz discard overlap WAV now removes only its long post-sound trailing silence, reducing the on-demand RAM allocation from about 5.2 KB to 3.1 KB. The full separate discard Preview asset is unchanged.

## v0.8.19 result cap-count coin loop
- Uses the exact supplied `Bottle Cap Sound.wav` as installed `CAP_COUNT.WAV` (16 kHz mono PCM, 1.418 s).
- The sound begins on the first actual displayed counter change for both PLAYER wins and CPU losses.
- While the number is still changing, the audible portion is replayed at ~1.18 s intervals; the source file's final ~0.24 s is mostly quiet tail.
- When the final cap value is reached, no further replay is queued, so the active sound continues through its full natural ending instead of being cut off.
- Playback uses native `Pip.audioStart()` streaming rather than `Pip.audioRead()`/`audioStartVar()`, avoiding a ~45 KB JavaScript buffer allocation.
- V0.8.18 discard SFX behavior and V0.8.17 result visuals/counter timing are otherwise unchanged.



## v0.8.22 Bottle Cap Sound +7 dB tuning
- Preserves the accepted V0.8.21 quarter-length loop (~0.347 s), smooth loop edges, finishing tail, Volume 0-15 behavior, full Preview, and attribution.
- Raises only the Bottle Cap Sound master another +5 dB over V0.8.21, for approximately +7 dB total relative to the original supplied Coin source.
- Rebuilds only the Coin loop/end sparse ADPCM level tables so in-game Volume 1-15 continues to scale from the new louder maximum; Playing Card and Discard tables are unchanged.
- The full Coin Preview uses the same louder master and still scales with the selected Volume 0-15 setting.

## v0.8.21 Bottle Cap Sound tuning
Volume 15 for Bottle Cap Sound is modestly louder than v0.8.20. During win/loss cap counting, approximately the first quarter of the effect repeats with softened splice edges; after the final displayed cap value, the remaining tail plays once so the sound exits into its natural ending. The same Bottle Cap Sound Volume 0-15 setting controls both result playback and the full-length Volume Adjustment Preview.

## v0.8.23 three-stage Bottle Cap result sound
- Result audio is now `Bottle Cap 1 -> Bottle Cap 2 loop -> Bottle Cap 4/Finish`.
- `Bottle Cap 1` plays once when the cap counter begins moving.
- `Bottle Cap 2` repeats while the displayed +/- cap number is still counting. The current repeat is never cut mid-segment.
- When the count reaches its final value, the active Bottle Cap 2 repeat completes and the supplied `bottle cap 4.mp3` finishing sound plays once.
- The Bottle Cap Sound Preview in Volume Adjustment is the supplied Nuka-Cola sound, not a stitched preview of the three result stages.
- One Bottle Cap Sound ON/OFF + Volume 0-15 setting controls the Nuka-Cola Preview and all three in-game Bottle Cap stages.
- Sound Distributed From Wand Company PIP-BOY 3000.
- Previous +7 dB tuning belonged to the retired Bottle Cap Sound source and is not baked into these replacement files; Volume 15 uses the supplied replacement audio level and levels 1-14 scale from it.
