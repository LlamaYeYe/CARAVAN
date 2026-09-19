/*
 * CARAVAN - CARAVAN_RESULT_MENU.JS
 * Low-memory result screen, cap counter animation, and result audio.
 * Readable source only; installed runtime remains in the matching minified file.
 */
(function (api) {
    const fs = api.fs,
        basePath = api.basePath;
    let shown = 0,
        ready = 0,
        selection = 0,
        timer = 0,
        step = 0,
        animationSteps = 20,
        animationDelay = 100,
        capDuration = 1913,
        animationStartedAt = 0,
        outcome = "DRAW",
        delta = 0,
        opponent = "Ringo",
        canContinue = 1,
        opponentCanContinue = 1,
        rematchCallback = 0,
        newOpponentCallback = 0,
        backCallback = 0,
        restoreTimer = 0,
        savedVolume = 0,
        masterVolume = 15;

    function pickOpponent(currentOpponent) {
        const names = "Cliff Briscoe|Dale Barton|Amb. Dennis Crocker|Isaac|Private Jake Erwin|Johnson Nash|Jules|Keith|Lacey|Little Buster|Quartermaster Mayes|No-bark Noonan|Ringo|Jed Masterson".split("|");
        let index = (Date.now() >>> 0) % names.length;
        if (names[index] === currentOpponent) index = (index + 1) % names.length;
        return names[index]
    }

    // --- Drawing and cap-audio helpers ---
    function strong(text, x, y) {
        h.setColor(3).setFont("6x8", 2).setFontAlign(0, -1).drawString(text, x, y).drawString(text, x + 1, y)
            .setFontAlign(-1, -1)
    }

    function restoreVolume() {
        if (restoreTimer) {
            clearTimeout(restoreTimer);
            restoreTimer = 0
        }
        if (!savedVolume) return;
        savedVolume = 0;
        try {
            Pip.setVol(masterVolume)
        } catch (volumeError) {
        }
    }

    function stopCapAudio() {
        try {
            Pip.audioStop()
        } catch (audioStopError) {
        }
        restoreVolume()
    }

    function playCap() {
        let config = "",
            level = 15,
            amount = Math.abs(delta),
            fileName = "BOTTLE_CAP_RESULT1.WAV",
            scaled = 0;
        try {
            config = fs.readFileSync(basePath + "VOLUME_SOUND.CFG") || ""
        } catch (configError) {
        }
        if (config.length >= 6) {
            if (config.charAt(4) !== "1") return;
            level = parseInt(config.charAt(5), 16);
            if (isNaN(level) || level <= 0) return
        }
        if (!amount) return;
        if (amount > 24) {
            fileName = "BOTTLE_CAP_RESULT3.WAV"
        } else if (amount > 12) {
            fileName = "BOTTLE_CAP_RESULT2.WAV"
        }
        restoreVolume();
        try {
            masterVolume = Pip.settings && typeof Pip.settings.volume === "number" ? Pip.settings
                .volume : 15;
            savedVolume = 1;
            scaled = Math.round(masterVolume * level / 15);
            if (scaled < 0) scaled = 0;
            Pip.setVol(scaled);
            Pip.audioStart(basePath + fileName);
            restoreTimer = setTimeout(restoreVolume, capDuration + 1600)
        } catch (audioError) {
            restoreVolume()
        }
    }

    // --- Result animation and input ---
    function drawChoices() {
        h.setColor(0).fillRect(20, 220, 460, 319).setColor(3).setFontMonofonto16().setFontAlign(-1, -1);
        if (!canContinue) {
            h.drawString("Not enough bottle caps to play...EXIT GAME!", 42, 258)
                .drawRect(28, 253, 452, 281);
            return
        }
        if (!opponentCanContinue) {
            h.drawString("Oops! You have won to much! GET OUT!", 42, 258)
                .drawRect(28, 253, 452, 281);
            return
        }
        h.drawString("Rematch", 42, 226);
        if (selection === 0) h.drawRect(28, 221, 452, 249);
        h.drawString("Challenge New Opponent", 42, 258);
        if (selection === 1) h.drawRect(28, 253, 452, 281);
        h.drawString("Back", 42, 290);
        if (selection === 2) h.drawRect(28, 285, 452, 313)
    }

    function tick() {
        let amount = Math.abs(delta),
            value = 0,
            text = "0",
            now = 0,
            elapsed = 0,
            targetStep = 1,
            nextDelay = 1;
        timer = 0;
        if (!shown) return;
        now = getTime() * 1000;
        if (!animationStartedAt) {
            animationStartedAt = now;
            step = 1;
            playCap()
        } else {
            elapsed = now - animationStartedAt;
            targetStep = 1 + Math.floor(elapsed * (animationSteps - 1) / capDuration);
            if (targetStep <= step) targetStep = step + 1;
            if (targetStep > animationSteps) targetStep = animationSteps;
            step = targetStep
        }
        if (amount) value = Math.floor((amount * step + Math.floor(animationSteps / 2)) / animationSteps);
        if (value > amount) value = amount;
        text = !value ? "0" : delta < 0 ? "-" + value : "+" + value;
        h.setColor(0).fillRect(250, 116, 360, 145);
        strong(text, 305, 122);
        if (step >= animationSteps) {
            ready = 1;
            drawChoices();
            return
        }
        nextDelay = Math.round(animationStartedAt + (step * capDuration / (animationSteps - 1)) - getTime() * 1000);
        if (nextDelay < 1) nextDelay = 1;
        timer = setTimeout(tick, nextDelay)
    }

    function onKnob1(direction) {
        let callback = 0,
            nextOpponent = 0;
        if (!shown || !ready) return;
        if (!canContinue || !opponentCanContinue) {
            if (!direction) {
                Pip.playSound("SELECT");
                callback = backCallback;
                hide();
                if (callback) callback()
            }
            return
        }
        if (direction) {
            selection += direction > 0 ? 1 : -1;
            if (selection < 0) selection = 2;
            if (selection > 2) selection = 0
            Pip.playSound("SCROLL");
            drawChoices();
            return
        }
        Pip.playSound("SELECT");
        if (selection === 0) callback = rematchCallback;
        else if (selection === 1) {
            callback = newOpponentCallback;
            nextOpponent = pickOpponent(opponent)
        } else callback = backCallback;
        hide();
        if (callback) {
            if (nextOpponent) callback(nextOpponent);
            else callback()
        }
    }


    function drawCapImage(capOffset) {
        let capImage = 0,
            graphicsFile = 0;
        try {
            process.memory(true);
            graphicsFile = E.openFile(basePath + "CARAVAN_RESULT_CAPS.BIN", "r");
            if (!graphicsFile) return;
            graphicsFile.seek(capOffset);
            capImage = graphicsFile.read(2140);
            if (graphicsFile.close) graphicsFile.close();
            graphicsFile = 0;
            if (capImage) h.setColor(3).drawImage(capImage, 154, 105)
        } catch (imageError) {
            try {
                if (graphicsFile && graphicsFile.close) graphicsFile.close()
            } catch (closeError) {
            }
        }
        graphicsFile = 0;
        capImage = 0
    }

    // --- Result lifecycle ---
    function hide() {
        if (!shown) return;
        shown = 0;
        ready = 0;
        if (timer) {
            clearTimeout(timer);
            timer = 0
        }
        try {
            Pip.removeListener("knob1", onKnob1)
        } catch (listenerError) {
        }
        stopCapAudio();
        rematchCallback = 0;
        newOpponentCallback = 0;
        backCallback = 0
    }

    function show(state) {
        let capOffset = 0;
        hide();
        shown = 1;
        ready = 0;
        selection = 0;
        step = 0;
        animationStartedAt = 0;
        outcome = state.outcome || "DRAW";
        delta = state.delta || 0;
        if (Math.abs(delta) > 24) {
            animationSteps = 30;
            animationDelay = 98;
            capDuration = 2934
        } else if (Math.abs(delta) > 12) {
            animationSteps = 20;
            animationDelay = 96;
            capDuration = 1913
        } else {
            animationSteps = 10;
            animationDelay = 89;
            capDuration = 893
        }
        opponent = state.opponent || "Ringo";
        canContinue = state.funds === undefined || state.funds >= 10;
        opponentCanContinue = state.opponentFunds === undefined || state.opponentFunds >= 10;
        rematchCallback = state.onRematch || 0;
        newOpponentCallback = state.onNewOpponent || 0;
        backCallback = state.onBack || 0;
        h.clear().setColor(3).setFontMonofonto16().setFontAlign(0, -1)
            .drawString("CARAVAN - RESULTS", 240, 10)
            .drawLine(18, 34, 462, 34).setFontAlign(-1, -1);
        if (outcome === "PLAYER") {
            strong("YOU WIN", 240, 56);
            capOffset = 2140
        } else if (outcome === "CPU") {
            strong(opponent + " WINS", 240, 46);
            strong("YOU LOSE", 240, 66);
            capOffset = 4280
        } else strong("DRAW", 240, 56);
        drawCapImage(capOffset);
        strong("0", 305, 122);
        strong("CAPS", 305, 162);
        Pip.onExclusive("knob1", onKnob1);
        timer = setTimeout(tick, animationDelay)
    }

    function remove() {
        hide()
    }
    return {
        show: show,
        hide: hide,
        remove: remove
    }
})
