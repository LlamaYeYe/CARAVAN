# Caravan v1.0.0

A playable recreation of **Caravan from Fallout: New Vegas** for **The Wand Company Pip-Boy 3000**, built for firmware **1.1.6** and designed around the device's limited Espruino memory.

## Features

- Player-vs-CPU Caravan gameplay
- Randomized 54-card decks
- Number cards, Aces, Jacks, Queens, Kings, and Jokers
- Three caravans per player
- Ascending and descending caravan rules
- Same-suit override behavior
- 21–26 selling range
- Proper tie handling
- Two-of-three caravan win detection
- Disband Caravan support
- Opening discard/redraw support
- 14 randomized Fallout: New Vegas Caravan opponents
- Demo / Tutorial mode
- Rematch support
- Challenge New Opponent
- Player and opponent bottle-cap bankrolls
- Betting limited by available bottle caps
- Bottle-cap reset flow when funds run out
- Animated win/loss result screen
- Game Over Win sound
- Configurable sound effects and background music
- Persistent volume settings

## Opponents

Caravan randomly selects from 14 Fallout: New Vegas Caravan players:

- Cliff Briscoe
- Dale Barton
- Ambassador Dennis Crocker
- Isaac
- Private Jake Erwin
- Johnson Nash
- Jules
- Keith
- Lacey
- Little Buster
- Quartermaster Mayes
- No-bark Noonan
- Ringo
- Jed Masterson

**Rematch** keeps the current opponent.

**Challenge New Opponent** selects a different opponent without requiring the entire game to be reloaded.

## Gameplay

Caravan includes the major card mechanics from Fallout: New Vegas:

- **Jack** removes a targeted numbered card and its attached face cards.
- **Queen** reverses caravan direction and changes its effective suit.
- **King** doubles the value of the targeted numbered card.
- **Joker** removes matching ranks or suits depending on the targeted card.

A caravan must total **21–26** and beat the opposing caravan to count as **SOLD**.

Equal totals remain tied.

## Bottle Caps

The player and opponent both maintain their own bottle-cap totals.

Winning and losing updates each bankroll based on the current wager, and bets cannot exceed the available funds of either side.

If the player runs out of caps, Caravan provides a reset flow that restores both bankrolls so another game can be started.

If the opponent runs out of caps, the player can return to the Caravan menu and reset the bankrolls before starting another game.

## Low-Memory Runtime

Caravan is split into multiple runtime modules to reduce memory pressure on the Pip-Boy's limited Espruino environment.

The game uses cleanup, garbage collection, and memory defragmentation around heavier menu, gameplay, audio, and result transitions.

The gameplay runtime is designed to avoid repeatedly rebuilding large modules between matches. The Engine and idled Game Audio runtime can remain resident across menu visits, while the Renderer can be released when additional menu headroom is required and loaded again when gameplay resumes.

This architecture allows repeated rematches and menu-to-game cycles while keeping memory usage as stable as possible on real hardware.

The result screen also uses a dedicated compact graphics bank:

`CARAVAN_RESULT_CAPS.BIN`

This allows the bottle-cap result artwork to be displayed without loading the larger gameplay graphics bank during an already memory-heavy transition.

## Audio

Caravan includes:

- Playing Card sound
- Discard sound
- Bottle Cap result audio
- Game Over Win sound
- Background music
- Separate sound-effect and music volume settings
- Persistent audio configuration

### Music

**Lazy Day - Tired** — Geoff Harvey from Pixabay

### Playing Card and Discard Sounds

**Alex from Pixabay**

### Bottle Cap Result Audio

**The Wand Company Pip-Boy 3000**

### Game Over Win Audio

**Sound Distributed From Wand Company MK V (TV Series) PIP-BOY**

## Thank You

Holotape artwork by **Goji!**

He put work into the Caravan cover artwork and it turned out awesome.