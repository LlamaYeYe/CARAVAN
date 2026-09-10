(function(api) {
    const fs = api.fs,
        basePath = api.basePath,
        delta = api.delta | 0,
        absDelta = Math.abs(delta),
        outcome = api.outcome,
        opponent = api.opponent || "RINGO",
        capFile = outcome === "PLAYER" ? "CAP_HAPPY.IMG" :
            outcome === "CPU" ? "CAP_SAD.IMG" : "CAP.IMG";

    let capImage = 0,
        animFrame = 0,
        delayPhase = 0,
        timer = 0,
        coinTimer = 0,
        coinStarted = 0,
        coinEnabled = 1,
        coinLevel = 15,
        coinTailStarted = 0,
        coinLoopData = 0,
        coinEndFile = 0,
        coinEndRemaining = 0,
        coinOpts = { encoding: "adpcm", sampleRate: 16000, blockAlign: 256, overlap: false },
        visualDone = 0,
        completed = 0,
        countFinished = 0,
        removed = 0,
        lastCounter = -2147483648,
        lastCounterColor = -1,
        lastCapsY = -1,
        lastCapsColor = -1,
        lastCapKey = "";

    function loadCoinConfig() {
        let cfg = "";
        try { cfg = fs.readFileSync(basePath + "SOUND.CFG") } catch (error) {}
        if (cfg && cfg.length >= 8) {
            coinEnabled = cfg.charAt(6) === "1" ? 1 : 0;
            coinLevel = parseInt(cfg.charAt(7), 16);
            if (isNaN(coinLevel) || coinLevel < 0 || coinLevel > 15) coinLevel = 15
        }
        if (!coinLevel) coinEnabled = 0
    }

    function strong(text, x, y, scale, color) {
        h.setColor(color === undefined ? 3 : color)
            .setFont("6x8", scale)
            .setFontAlign(0, -1)
            .drawString(text, x, y)
            .drawString(text, x + 1, y)
            .setFontAlign(-1, -1)
    }

    function signedValue(value) {
        if (!value) return "0";
        return delta < 0 ? "-" + value : "+" + value
    }

    function counterForFrame(f) {
        let countFrames, step;
        if (f < 8 || !absDelta) return 0;

        /*
         * Keep the count fast, linear, and visually even at the Pip-Boy's
         * 12 FPS update limit. Small antes get one-number-at-a-time motion;
         * larger antes distribute their integer jumps evenly across at most
         * 36 displayed frames instead of bunching jumps in the middle.
         */
        countFrames = absDelta < 12 ? 12 : absDelta > 36 ? 36 : absDelta;
        step = f - 8;
        if (step >= countFrames) return absDelta;
        return Math.floor((absDelta * step + (countFrames >> 1)) / countFrames)
    }

    function counterColorForFrame(f) {
        /*
         * No counter fade/bounce while digits are changing. A fixed, fully
         * bright baseline makes rapid +/- counting read cleanly.
         */
        return f < 8 ? 0 : 3
    }

    function capsStateForFrame(f) {
        let y;

        if (f < 13) return 0;

        /*
         * Smoothly slide CAPS upward, then leave it visible.
         */
        if (f <= 22) {
            y = 180 - ((f - 13) * 2);
            return [y, f < 15 ? 1 : f < 17 ? 2 : 3]
        }

        return [162, 3]
    }

    function capStateForFrame(f) {
        let size;

        if (f < 2) return 0;

        /*
         * 12-FPS smooth pop:
         * 88 -> 120 in small increments, then a soft settle/pulse to 108.
         * No fade-out at the end.
         */
        if (f === 2) size = 88;
        else if (f === 3) size = 94;
        else if (f === 4) size = 100;
        else if (f === 5) size = 106;
        else if (f === 6) size = 112;
        else if (f === 7) size = 117;
        else if (f === 8) size = 120;
        else if (f === 9) size = 119;
        else if (f === 10) size = 117;
        else if (f === 11) size = 115;
        else if (f === 12) size = 113;
        else if (f === 13) size = 111;
        else if (f === 14) size = 109;
        else if (f === 15) size = 108;
        else if (f === 16) size = 109;
        else if (f === 17) size = 110;
        else if (f === 18) size = 111;
        else if (f === 19) size = 110;
        else if (f === 20) size = 109;
        else size = 108;

        return [size, 3, "" + size]
    }

    function redrawCap(f) {
        const state = capStateForFrame(f);
        let size, color, key, x, y;
        if (!state) {
            if (lastCapKey) {
                h.setColor(0).fillRect(138, 88, 266, 218).setColor(3);
                lastCapKey = ""
            }
            return
        }
        size = state[0];
        color = state[1];
        key = state[2];
        if (key === lastCapKey) return;
        /*
         * Win -> happy bottle-cap mascot.
         * Loss -> sad bottle-cap mascot.
         * Draw keeps the previous neutral/fallback CAP.IMG.
         * Only one image is loaded, preserving the low-memory results path.
         */
        if (!capImage) capImage = fs.readFileSync(basePath + capFile);
        h.setColor(0).fillRect(138, 88, 266, 218);
        /*
         * Happy/Sad cap art is 120x111. Center either expression during
         * the smoother pop/pulse animation. Final frame remains visible.
         */
        x = 202 - (size >> 1);
        y = 150 - Math.round((111 * size / 120) / 2);
        h.setColor(color).drawImage(capImage, x, y, { scale: size / 120 });
        h.setColor(3);
        lastCapKey = key
    }

    function finishResult() {
        if (completed) return;
        completed = 1;
        if (api.onComplete) api.onComplete()
    }

    function closeCoinEnd() {
        try { if (coinEndFile) coinEndFile.close() } catch (error) {}
        coinEndFile = 0
    }

    function maybeFinishResult() {
        if (!visualDone) return;
        if (!coinStarted || !coinEnabled || coinTailStarted === 2) finishResult()
    }

    function scheduleCoinPump(delay) {
        if (coinTimer) clearTimeout(coinTimer);
        coinTimer = setTimeout(coinPump, delay || 15)
    }

    function beginCoinEnd() {
        if (removed || coinTailStarted) return;
        coinTailStarted = 1;
        coinLoopData = 0;

        try {
            coinEndFile = E.openFile(basePath + "CAP_COUNT_END.WAV", "r");
            if (!coinEndFile) throw new Error("CAP END OPEN");
            coinEndFile.seek(94);
            coinEndRemaining = 57 * 256;
            scheduleCoinPump(1)
        } catch (error) {
            closeCoinEnd();
            coinEndRemaining = 0;
            coinTailStarted = 2;
            maybeFinishResult()
        }
    }

    function coinPump() {
        let free = 0, count = 0, part = 0;

        coinTimer = 0;
        if (removed || !coinEnabled || !absDelta) {
            closeCoinEnd();
            coinLoopData = 0;
            return
        }

        try { free = Pip.audioGetFree() } catch (error) { free = 0 }

        /*
         * Once counting finishes, stop adding Bottle Cap 2 repeats and append
         * Bottle Cap 4 to the SAME audioStartVar queue. The end file is fed
         * in small ADPCM chunks so the Pip-Boy ring never has to cold-start
         * between loop and finish.
         */
        if (coinTailStarted === 1) {
            if (coinEndRemaining <= 0) {
                closeCoinEnd();
                coinTailStarted = 2;
                maybeFinishResult();
                return
            }

            if (free < 12000) {
                scheduleCoinPump(15);
                return
            }

            count = coinEndRemaining > 2048 ? 2048 : coinEndRemaining;

            try {
                part = coinEndFile.read(count);
                if (!part || part.length !== count) throw new Error("CAP END READ");
                coinEndRemaining -= part.length;
                Pip.audioStartVar(part, coinOpts);
                part = 0
            } catch (error) {
                part = 0;
                closeCoinEnd();
                coinEndRemaining = 0;
                coinTailStarted = 2;
                maybeFinishResult();
                return
            }

            if (coinEndRemaining <= 0) {
                closeCoinEnd();
                coinTailStarted = 2;
                maybeFinishResult();
                return
            }

            scheduleCoinPump(15);
            return
        }

        if (countFinished) {
            beginCoinEnd();
            return
        }

        /*
         * Bottle Cap 2 stays preloaded (~2.3 KB) and is appended before the
         * current queued audio drains. Using overlap:false keeps every repeat
         * contiguous instead of reopening a native WAV every ~264 ms.
         */
        if (free >= 12000 && coinLoopData) {
            try { Pip.audioStartVar(coinLoopData, coinOpts) } catch (error) {}
        }

        scheduleCoinPump(15)
    }

    function playCoinStart() {
        let startData = 0;

        if (removed || !coinEnabled || !absDelta) return;

        try {
            startData = Pip.audioRead(basePath + "CAP_COUNT_START.WAV");
            coinLoopData = Pip.audioRead(basePath + "CAP_COUNT_LOOP.WAV");
            if (!startData || !coinLoopData) throw new Error("CAP AUDIO READ");

            /*
             * Queue Bottle Cap 1 and the first Bottle Cap 2 back-to-back in
             * one live 16 kHz ADPCM stream. Together they decode to less than
             * the Pip-Boy's 16,384-sample ring, so the 1 -> 2 handoff does
             * not need a stop/restart boundary.
             */
            Pip.audioStartVar(startData, coinOpts);
            startData = 0;
            Pip.audioStartVar(coinLoopData, coinOpts);
            scheduleCoinPump(15)
        } catch (error) {
            startData = 0;
            coinLoopData = 0;
            coinTailStarted = 2;
            maybeFinishResult()
        }
    }

    function redrawCounter(f) {
        const value = counterForFrame(f),
            color = counterColorForFrame(f),
            changed = value !== lastCounter;
        if (!changed && color === lastCounterColor) return;
        h.setColor(0).fillRect(250, 116, 360, 142).setColor(3);
        /*
         * Keep the counter centered at one fixed X coordinate. Moving the
         * text while its digit width changes made the count look jittery.
         */
        if (color) strong(signedValue(value), 305, 122, 2, color);

        /*
         * Start Bottle Cap 1 only when the displayed number really begins
         * moving (not when the initial 0 merely becomes visible). Bottle Cap
         * 2 is then queued continuously and Bottle Cap 4 is appended after
         * counting ends. This same path is shared by +win and -loss counters.
         */
        if (changed && value > 0 && !coinStarted) {
            coinStarted = 1;
            playCoinStart()
        }
        if (absDelta && value >= absDelta) countFinished = 1;

        lastCounter = value;
        lastCounterColor = color
    }

    function redrawCapsLabel(f) {
        const state = capsStateForFrame(f);
        let y = -1, color = 0;
        if (state) { y = state[0]; color = state[1] }
        if (y === lastCapsY && color === lastCapsColor) return;
        h.setColor(0).fillRect(264, 148, 346, 198).setColor(3);
        if (color) strong("CAPS", 305, y, 2, color);
        lastCapsY = y;
        lastCapsColor = color
    }

    function drawOutcome() {
        h.setColor(0).fillRect(104, 42, 376, 86).setColor(3);
        if (outcome === "PLAYER") {
            strong("YOU WIN", 240, 56, 2, 3)
        } else if (outcome === "CPU") {
            strong(opponent + " WINS", 240, 46, 2, 3);
            strong("YOU LOSE", 240, 66, 2, 3)
        } else {
            strong("DRAW", 240, 56, 2, 3)
        }
    }

    function scheduleNext() {
        /*
         * Pip-Boy sweet spot/max for this animation remains 12 FPS.
         * 83/84 ms alternating keeps the average very close to 12 FPS.
         */
        const delay = delayPhase === 2 ? 84 : 83;
        delayPhase++;
        if (delayPhase > 2) delayPhase = 0;
        timer = setTimeout(tick, delay)
    }

    function tick() {
        if (removed) return;

        animFrame++;
        if (animFrame > 46) animFrame = 46;

        redrawCap(animFrame);
        redrawCounter(animFrame);
        redrawCapsLabel(animFrame);

        if (animFrame < 46) {
            scheduleNext()
        } else {
            /*
             * HOLD FINAL RESULT:
             * Do not clear the cap/counter/CAPS and do not fade them.
             * The pixels stay on screen while the menu regains the memory.
             */
            timer = 0;
            drawOutcome();

            /*
             * Release the ~3.3 KB IMG buffer; the LCD keeps the already
             * rendered happy/sad cap visible until Rematch/Back redraws.
             */
            capImage = 0;

            /*
             * Keep the small results closure alive only until Bottle Cap 4
             * has been fully queued. The remaining decoded audio can finish
             * from the hardware ring after the results module is released.
             */
            visualDone = 1;
            maybeFinishResult()
        }
    }

    function remove() {
        if (removed) return;
        removed = 1;
        if (timer) { clearTimeout(timer); timer = 0 }
        if (coinTimer) { clearTimeout(coinTimer); coinTimer = 0 }
        closeCoinEnd();
        coinLoopData = 0;
        capImage = 0
    }

    loadCoinConfig();
    drawOutcome();
    redrawCap(0);
    redrawCounter(0);
    redrawCapsLabel(0);
    scheduleNext();
    return { remove: remove }
});
