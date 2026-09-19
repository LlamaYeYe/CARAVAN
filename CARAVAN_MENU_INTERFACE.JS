/*
 * CARAVAN - CARAVAN_MENU_INTERFACE.JS
 * Main menus, submenus, demo launch, and loading UI. Results are handled lazily by APP.JS.
 * Readable source only; installed runtime remains in the matching minified file.
 */
(function (api) {
    function pickOpponent() {
        const names = "Cliff Briscoe|Dale Barton|Amb. Dennis Crocker|Isaac|Private Jake Erwin|Johnson Nash|Jules|Keith|Lacey|Little Buster|Quartermaster Mayes|No-bark Noonan|Ringo|Jed Masterson".split("|");
        return names[(Date.now() >>> 0) % names.length]
    }

    const fs = api.fs,
        appPath = api.basePath;
    let screen = api.screen === undefined ? 0 : api.screen,
        menuSelection = api.menuSelection || 0,
        ante = api.ante === undefined ? 50 : api.ante,
        funds = api.funds === undefined ? 500 : api.funds,
        opponentFunds = api.opponentFunds === undefined ? 500 : api.opponentFunds,
        opponent = api.opponent || pickOpponent(),
        demoModule = 0,
        soundModule = 0,
        knob1Attached = 0,
        knob2Attached = 0,
        removed = 0;

    // --- Drawing primitives and menu screens ---
    function drawHeader(title) {
        h.clear().setColor(3).setFontMonofonto16().setFontAlign(0, -1).drawString(title, 240, 10)
            .drawLine(18, 34, 462, 34).setFontAlign(-1, -1)
    }

    function menuRowY(row) {
        return (screen === 0 ? 116 : 92) + row * 36
    }

    function drawMenuRow(text, row, selected) {
        const y = menuRowY(row);
        h.setColor(3).drawString(text, 42, y);
        if (selected) h.drawRect(28, y - 5, 452, y + 23)
    }

    function drawMainMenu() {
        if (menuSelection < 0 || menuSelection > 4) menuSelection = 0;
        drawHeader("CARAVAN");
        h.drawString("Fallout: New Vegas Card Game", 42, 48).drawString("Opponent: " + opponent, 42, 68)
            .drawLine(42, 96, 438, 96);
        drawMenuRow("Play Caravan", 0, menuSelection === 0);
        drawMenuRow("Demo / Tutorial", 1, menuSelection === 1);
        drawMenuRow("Rules / Controls", 2, menuSelection === 2);
        drawMenuRow("Volume Adjustment", 3, menuSelection === 3);
        drawMenuRow("< Back", 4, menuSelection === 4)
    }

    function betLimit() {
        return funds < opponentFunds ? funds : opponentFunds
    }

    function drawBetMenu() {
        if (funds < 10 || opponentFunds < 10) {
            ante = 0;
            menuSelection = 0
        } else if (menuSelection < 0 || menuSelection > 3) menuSelection = 0;
        drawHeader("CARAVAN - BET");
        h.drawRect(22, 48, 458, 138).drawString(opponent + "'s Current Ante: " + opponentFunds, 38, 60)
            .drawString("Your Current Ante: " + ante, 38, 86)
            .drawString("Your Total Funds: " + funds, 38, 112);
        if (funds < 10) {
            drawMenuRow("Not enough bottle caps to play...CLICK HERE!", 3, 1);
            return
        }
        if (opponentFunds < 10) {
            drawMenuRow("Opponent has no bottle caps...CLICK HERE!", 3, 1);
            return
        }
        drawMenuRow("Auto-Match", 2, menuSelection === 0);
        drawMenuRow("Raise", 3, menuSelection === 1);
        drawMenuRow("Accept", 4, menuSelection === 2);
        drawMenuRow("Exit", 5, menuSelection === 3)
    }

    function drawResetPopup() {
        drawBetMenu();
        h.setColor(0).fillRect(70, 70, 410, 200)
            .setColor(3).drawRect(70, 70, 410, 200)
            .setFontMonofonto16().setFontAlign(0, -1).drawString("RESET", 240, 82)
            .drawLine(90, 108, 390, 108)
            .drawString("Reset Total Ante", 240, 138)
            .setFontAlign(-1, -1).drawRect(104, 131, 376, 165)
    }

    function drawDeckMenu() {
        if (menuSelection < 0 || menuSelection > 1) menuSelection = 0;
        drawHeader("CARAVAN - BUILD DECK");
        h.drawRect(22, 48, 458, 126).drawString("Cards in Deck: 54", 38, 62)
            .drawString("Total Cards: 54", 38, 88)
            .drawString("Caravan Deck", 326, 62);
        drawMenuRow("Play Caravan", 3, menuSelection === 0);
        drawMenuRow("< Back", 4, menuSelection === 1)
    }

    function drawRules() {
        drawHeader("CARAVAN - CONTROLS");
        h.setFont("6x8", 1).drawString("BOTH WHEELS", 30, 46)
            .drawString("Turn either wheel to move selection.", 46, 59)
            .drawString("Cards, tracks, menus and targets all scroll.", 46, 71)
            .drawString("LEFT WHEEL PRESS", 30, 89)
            .drawString("Press to open or confirm an action.", 46, 102)
            .drawString("NORMAL PLAY", 30, 120)
            .drawString("Scroll LEFT past first card -> caravan tracks.", 46, 133)
            .drawString("Click card: Play / Discard / Cancel.", 46, 145)
            .drawString("Click track: Disband Caravan / Cancel.", 46, 157)
            .drawString("PLAY CARD", 30, 175)
            .drawString("Play: scroll track; LEFT place; edge = Back.", 46, 188)
            .drawString("FACE CARDS", 30, 206)
            .drawString("Choose board, scroll target, LEFT press.", 46, 219)
            .drawString("21-26; win 2 of 3. Empty deck+hand = loss.", 46, 237);
        drawMenuRow("< Back", 5, 1)
    }

    function menuRowForSelection(selection) {
        if (screen === 0) return selection;
        if (screen === 1) return selection + 2;
        if (screen === 2) return selection + 3;
        return 5
    }

    function menuTextForSelection(selection) {
        if (screen === 0) return selection === 0 ? "Play Caravan" : selection === 1
            ? "Demo / Tutorial" : selection === 2 ? "Rules / Controls" : selection === 3
            ? "Volume Adjustment" : "< Back";
        if (screen === 1) return funds < 10 ? "Not enough bottle caps to play...CLICK HERE!"
            : opponentFunds < 10 ? "Opponent has no bottle caps...CLICK HERE!"
            : selection === 0 ? "Auto-Match" : selection === 1 ? "Raise"
            : selection === 2 ? "Accept" : "Exit";
        if (screen === 2) return selection === 0 ? "Play Caravan" : "< Back";
        return "< Back"
    }

    function redrawMenuSelection(previousSelection) {
        let row,
            y;
        row = menuRowForSelection(previousSelection);
        y = menuRowY(row);
        h.clearRect(24, y - 7, 456, y + 25);
        drawMenuRow(menuTextForSelection(previousSelection), row, 0);
        row = menuRowForSelection(menuSelection);
        y = menuRowY(row);
        h.clearRect(24, y - 7, 456, y + 25);
        drawMenuRow(menuTextForSelection(menuSelection), row, 1)
    }

    function redrawBetValues() {
        h.clearRect(30, 54, 448, 132).setColor(3).drawString(opponent + "'s Current Ante: " + opponentFunds, 38, 60)
            .drawString("Your Current Ante: " + ante, 38, 86).drawString("Your Total Funds: "
                + funds, 38, 112)
    }

    function drawCurrentScreen() {
        if (screen === 0) drawMainMenu();
        else if (screen === 1) drawBetMenu();
        else if (screen === 2) drawDeckMenu();
        else if (screen === 5) drawResetPopup();
        else drawRules()
    }

    // --- Game-loading handoff ---
    function handoffGame() {
        const startGameCallback = api.onStartGame;
        api.onStartGame = 0;
        if (startGameCallback) {
            startGameCallback({
                ante: ante,
                funds: funds,
                opponentFunds: opponentFunds,
                opponent: opponent
            })
        }
    }

    // --- Volume Adjustment submenu lifecycle ---
    function unloadSoundMenu(defragment) {
        if (soundModule && soundModule.remove) soundModule.remove();
        soundModule = 0;
        if (defragment) E.defrag()
    }

    function onSoundMenuExit() {
        unloadSoundMenu(0);
        screen = 0;
        menuSelection = 3;
        attachMenuListeners();
        drawMainMenu()
    }

    function startSoundMenu() {
        let sourceCode,
            soundFactory;
        detachMenuListeners();
        /*
         * Avoid a visible multi-second defrag pause when opening Volume
         * Adjustment. The critical menu->game defrag remains untouched.
         */
        try {
            sourceCode = fs.readFileSync(appPath + "CARAVAN_VOLUME_SOUND.MIN.JS");
            soundFactory = eval(sourceCode);
            sourceCode = 0;
            soundModule = soundFactory({
                fs: fs,
                basePath: appPath,
                onBack: onSoundMenuExit
            });
            soundFactory = 0
        } catch (error) {
            sourceCode = 0;
            soundFactory = 0;
            soundModule = 0;
            menuSelection = 3;
            attachMenuListeners();
            drawMainMenu()
        }
    }

    // --- Menu input listeners ---
    function detachMenuListeners() {
        if (knob1Attached) {
            Pip.removeListener("knob1", onKnob1);
            knob1Attached = 0
        }
        if (knob2Attached) {
            Pip.removeListener("knob2", onKnob2);
            knob2Attached = 0
        }
    }

    function attachMenuListeners() {
        if (!knob1Attached) {
            Pip.onExclusive("knob1", onKnob1);
            knob1Attached = 1
        }
        if (!knob2Attached) {
            try {
                Pip.onExclusive("knob2", onKnob2);
                knob2Attached = 1
            } catch (error) {
                if (knob1Attached) {
                    Pip.removeListener("knob1", onKnob1);
                    knob1Attached = 0
                }
                throw error
            }
        }
    }

    // --- Game and demo launch flow ---
    function musicVolumeNeedsApply() {
        let config = "",
            target = 0,
            applied = 15;
        try {
            config = fs.readFileSync(appPath + "VOLUME_SOUND.CFG") || ""
        } catch (error) {
            return 0
        }
        if (config.length < 8 || config.charAt(6) !== "1") return 0;
        target = parseInt(config.charAt(7), 16);
        if (isNaN(target) || target <= 0) return 0;
        if (target > 15) target = 15;
        if (config.length >= 9) {
            applied = parseInt(config.charAt(8), 16);
            if (isNaN(applied) || applied < 1 || applied > 15) applied = 15
        }
        return target !== applied
    }

    function startGame() {
        let sourceCode = 0,
            applyFactory = 0,
            applyModule = 0;
        if (removed || funds < 10 || opponentFunds < 10 || ante < 10 || ante > betLimit()) return;
        unloadSoundMenu(0);
        detachMenuListeners();
        // The heavy volume patcher is needed only when the requested music
        // level differs from the level already written into the WAV. Normal
        // repeated games now skip this eval-loaded module entirely.
        if (!musicVolumeNeedsApply()) {
            handoffGame();
            return
        }
        function afterApply() {
            sourceCode = 0;
            applyFactory = 0;
            applyModule = 0;
            handoffGame()
        }
        try {
            sourceCode = fs.readFileSync(appPath + "CARAVAN_VOLUME_APPLY.MIN.JS");
            applyFactory = eval(sourceCode);
            sourceCode = 0;
            applyModule = applyFactory({
                fs: fs,
                basePath: appPath
            });
            applyFactory = 0;
            if (applyModule && applyModule.apply) {
                if (applyModule.apply(afterApply) === 2) return
            }
        } catch (error) {
        }
        afterApply()
    }

    function unloadDemo(defragment) {
        if (demoModule && demoModule.remove) demoModule.remove();
        demoModule = 0;
        if (defragment) E.defrag()
    }

    function onDemoExit() {
        unloadDemo(1);
        screen = 0;
        menuSelection = 1;
        attachMenuListeners();
        drawMainMenu()
    }

    function startDemo() {
        let sourceCode,
            demoFactory;
        detachMenuListeners();
        E.defrag();
        h.clear().setColor(3).setFontMonofonto16().setFontAlign(0, -1).drawString("LOADING DEMO...", 240, 146)
            .setFontAlign(-1, -1);
        sourceCode = fs.readFileSync(appPath + "CARAVAN_TUTORIAL.MIN.JS");
        demoFactory = eval(sourceCode);
        sourceCode = 0;
        demoModule = demoFactory({
            fs: fs,
            basePath: appPath,
            onExit: onDemoExit
        });
        demoFactory = 0
    }

    // --- Top-level navigation and input ---
    function exitHolotape() {
        try {
            Pip.changeMenu("MISC.JS")
        } catch (error) {
            try {
                Pip.changeMenu()
            } catch (fallbackError) {
            }
        }
    }

    function onKnob2(direction) {
        let maxAnte;
        if (screen !== 1 || !direction || funds < 10 || opponentFunds < 10) return;
        maxAnte = betLimit();
        ante += direction > 0 ? 10 : -10;
        if (ante < 10) ante = 10;
        if (ante > maxAnte) ante = maxAnte;
        Pip.playSound("SCROLL");
        redrawBetValues()
    }

    function onKnob1(direction) {
        let optionCount;
        if (direction) {
            const previousSelection = menuSelection;
            optionCount = screen === 0 ? 5 : screen === 1 ? (funds < 10 || opponentFunds < 10 ? 1 : 4)
                : screen === 2 ? 2 : 1;
            menuSelection += direction > 0 ? 1 : -1;
            if (menuSelection < 0) menuSelection = optionCount - 1;
            if (menuSelection >= optionCount) menuSelection = 0;
            Pip.playSound("SCROLL");
            if (optionCount > 1) redrawMenuSelection(previousSelection);
            return
        }
        /*
         * Do not fire SELECT immediately before handing control to either
         * Volume Adjustment or the game. The game music and custom SFX are
         * 16 kHz; Play/Rematch transition silently so a firmware UI cue cannot
         * overlap the first game-audio stream.
         *
         * All other SELECT sounds stay enabled.
         */
        if (!(screen === 2 && menuSelection === 0)) {
            Pip.playSound("SELECT")
        }
        if (screen === 0) {
            if (menuSelection === 0) {
                screen = 1;
                menuSelection = 0
            } else if (menuSelection === 1) {
                startDemo();
                return
            } else if (menuSelection === 2) {
                screen = 4;
                menuSelection = 0
            } else if (menuSelection === 3) {
                startSoundMenu();
                return
            } else {
                exitHolotape();
                return
            }
        } else if (screen === 1) {
            if (funds < 10 || opponentFunds < 10) {
                screen = 5;
                menuSelection = 0
            } else if (menuSelection === 0) {
                ante = Math.min(50, betLimit())
            } else if (menuSelection === 1) {
                ante += 10;
                if (ante > betLimit()) ante = betLimit()
            } else if (menuSelection === 2) {
                if (ante < 10 || ante > betLimit()) {
                    drawBetMenu();
                    return
                }
                screen = 2;
                menuSelection = 0
            } else {
                screen = 0;
                menuSelection = 0
            }
        } else if (screen === 5) {
            funds = 500;
            opponentFunds = 500;
            ante = Math.min(50, betLimit());
            screen = 1;
            menuSelection = 0
        } else if (screen === 2) {
            if (menuSelection === 0) {
                startGame();
                return
            }
            screen = 1;
            menuSelection = 2
        } else {
            screen = 0;
            menuSelection = 1
        }
        drawCurrentScreen()
    }

    // --- Final cleanup ---
    function removeApp() {
        if (removed) return;
        removed = 1;
        detachMenuListeners();
        if (demoModule && demoModule.remove) demoModule.remove();
        demoModule = 0;
        if (soundModule && soundModule.remove) soundModule.remove();
        soundModule = 0;
        api.onStartGame = 0;
    }
    attachMenuListeners();
    drawCurrentScreen();
    return {
        id: "CARAVAN_MENU",
        remove: removeApp
    }
});
