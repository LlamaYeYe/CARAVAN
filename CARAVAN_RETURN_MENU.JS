/*
 * CARAVAN - lightweight post-game menu shell.
 * Owns post-game Play/Bet, Demo and Volume routing so APP stays lean in-game.
 */
(function (api) {
    const fs = api.fs,
        basePath = api.basePath;
    let selection = 0,
        screen = 0,
        removed = 0,
        child = 0,
        ante = api.ante,
        funds = api.funds,
        opponentFunds = api.opponentFunds,
        opponent = api.opponent || "Ringo";

    function reclaim(hard) {
        process.memory(true);
        if (hard) E.defrag()
    }

    function updateState(state) {
        if (!state) return;
        if (state.ante !== undefined) ante = state.ante;
        if (state.funds !== undefined) funds = state.funds;
        if (state.opponentFunds !== undefined) opponentFunds = state.opponentFunds;
        if (state.opponent) opponent = state.opponent
    }

    function drawHeader(title) {
        h.clear().setColor(3).setFontMonofonto16().setFontAlign(0, -1).drawString(title, 240, 10)
            .drawLine(18, 34, 462, 34).setFontAlign(-1, -1)
    }

    function rowY(row) { return 116 + row * 36 }

    function drawRow(text, row, active) {
        const y = rowY(row);
        h.setColor(3).drawString(text, 42, y);
        if (active) h.drawRect(28, y - 5, 452, y + 23)
    }

    function drawMain() {
        if (selection < 0 || selection > 4) selection = 0;
        drawHeader("CARAVAN");
        h.drawString("Fallout: New Vegas Card Game", 42, 48)
            .drawString("Opponent: " + opponent, 42, 68)
            .drawLine(42, 96, 438, 96);
        drawRow("Play Caravan", 0, selection === 0);
        drawRow("Demo / Tutorial", 1, selection === 1);
        drawRow("Rules / Controls", 2, selection === 2);
        drawRow("Volume Adjustment", 3, selection === 3);
        drawRow("< Back", 4, selection === 4)
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
        h.setFontMonofonto16();
        drawRow("< Back", 5, 1)
    }

    function detach() {
        // These menus own the knob events exclusively. Remove the event
        // properties themselves so Espruino cannot retain an empty listener
        // array/name that still anchors this menu closure between games.
        try { Pip.removeAllListeners("knob1") } catch (e) {
            try { Pip.removeListener("knob1", onKnob1) } catch (e2) {}
        }
        try { Pip.removeAllListeners("knob2") } catch (e) {}
    }

    function attach() {
        Pip.onExclusive("knob1", onKnob1)
    }

    function releaseChild() {
        if (child && child.remove) child.remove();
        child = 0
    }

    function backFromPlay(state) {
        updateState(state);
        child = 0;
        if (removed) return;
        selection = 0;
        screen = 0;
        reclaim(1);
        attach();
        drawMain()
    }

    function startGame(state) {
        const callback = api.onStartGame;
        updateState(state);
        child = 0;
        if (removed) return;
        removed = 1;
        detach();
        // Sever the parent callback before handing control back to APP.
        // If Espruino retains any stale menu bookkeeping, it can no longer
        // keep the APP/menu closure graph alive.
        api.onStartGame = 0;
        if (callback) callback({
            ante: ante,
            funds: funds,
            opponentFunds: opponentFunds,
            opponent: opponent
        })
    }

    function openPlay() {
        let sourceCode = 0,
            factory = 0;
        detach();
        reclaim(1);
        sourceCode = fs.readFileSync(basePath + "CARAVAN_PLAY_MENU.MIN.JS");
        factory = eval(sourceCode);
        sourceCode = 0;
        child = factory({
            ante: ante,
            funds: funds,
            opponentFunds: opponentFunds,
            opponent: opponent,
            onStartGame: startGame,
            onBack: backFromPlay
        });
        factory = 0
    }

    function backFromDemo() {
        releaseChild();
        if (removed) return;
        selection = 1;
        screen = 0;
        reclaim(1);
        attach();
        drawMain()
    }

    function openDemo() {
        let sourceCode = 0,
            factory = 0;
        detach();
        reclaim(1);
        h.clear().setColor(3).setFontMonofonto16().setFontAlign(0, -1)
            .drawString("LOADING DEMO...", 240, 146).setFontAlign(-1, -1);
        h.flip();
        Pip.lastFlip = getTime();
        sourceCode = fs.readFileSync(basePath + "CARAVAN_TUTORIAL.MIN.JS");
        factory = eval(sourceCode);
        sourceCode = 0;
        child = factory({ fs: fs, basePath: basePath, onExit: backFromDemo });
        factory = 0
    }

    function backFromVolume() {
        releaseChild();
        if (removed) return;
        selection = 3;
        screen = 0;
        reclaim(1);
        attach();
        drawMain()
    }

    function openVolume() {
        let sourceCode = 0,
            factory = 0;
        detach();
        reclaim(1);
        sourceCode = fs.readFileSync(basePath + "CARAVAN_VOLUME_SOUND.MIN.JS");
        factory = eval(sourceCode);
        sourceCode = 0;
        child = factory({ fs: fs, basePath: basePath, onBack: backFromVolume });
        factory = 0
    }

    function exitHolotape() {
        removed = 1;
        detach();
        try { Pip.changeMenu("MISC.JS") }
        catch (e) {
            try { Pip.changeMenu() } catch (e2) {}
        }
    }

    function onKnob1(direction) {
        if (removed || child) return;
        if (screen === 1) {
            if (!direction) {
                Pip.playSound("SELECT");
                screen = 0;
                selection = 2;
                drawMain()
            }
            return
        }
        if (direction) {
            selection += direction > 0 ? 1 : -1;
            if (selection < 0) selection = 4;
            if (selection > 4) selection = 0;
            Pip.playSound("SCROLL");
            drawMain();
            return
        }
        if (selection !== 0 && selection !== 3) Pip.playSound("SELECT");
        if (selection === 0) openPlay();
        else if (selection === 1) openDemo();
        else if (selection === 2) {
            screen = 1;
            drawRules()
        } else if (selection === 3) openVolume();
        else exitHolotape()
    }

    function remove() {
        if (removed) return;
        removed = 1;
        detach();
        releaseChild();
        api.onStartGame = 0
    }

    attach();
    drawMain();
    return { remove: remove }
})
