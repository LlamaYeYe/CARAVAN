# Caravan v1.0.0

Playable Fallout: New Vegas Caravan card game for the Wand Company Pip-Boy 3000, targeting firmware 1.1.6. Play against Ringo, learn the rules through the guided Demo / Tutorial, configure game audio and music, and finish matches with animated cap win/loss results.



## v1.0.0 release

- First stable public release of Caravan for the Wand Company Pip-Boy 3000 / 3000a.
- Player-vs-CPU Caravan with randomized 54-card decks, betting, face cards, Jokers, win/loss detection, rematches, and a guided Demo / Tutorial.
- Low-memory modular runtime designed around the Pip-Boy 3000 firmware 1.1.6 limits.
- Configurable Playing Card, Discard, Bottle Cap, and Lazy Days Tired audio with persistent Volume 0-15 settings.
- Native repeating background music begins and loops at the selected volume without the previous brief loud onset.
- Stable runtime path: `HOLO/CARAVAN/`.

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
