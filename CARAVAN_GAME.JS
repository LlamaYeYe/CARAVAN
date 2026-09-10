(function(api) {
    const fs = api.fs,
        basePath = api.basePath;

    let playerDeck = [],
        cpuDeck = [],
        playerDeckPos = 0,
        cpuDeckPos = 0,
        playerHand = [],
        cpuHand = [],
        playerCaravans = [[], [], []],
        cpuCaravans = [[], [], []],
        playerDirection = [0, 0, 0],
        cpuDirection = [0, 0, 0],
        handIndex = 0,
        targetIndex = 0,
        cpuTurn = 0,
        turnCount = 0,
        finished = 0,
        removed = 0,
        renderer = 0,
        actionMenuOpen = 0,
        actionSelection = 0,
        cpuTimer = 0,
        bootTimer = 0,
        finishTimer = 0,
        musicTimer = 0,
        effectDelayTimer = 0,
        effectTimer = 0,
        pendingEffect = -1,
        effectOptions = {
            encoding: "adpcm",
            sampleRate: 16000,
            blockAlign: 256,
            overlap: true
        },
        musicWarmOptions = {
            encoding: "adpcm",
            sampleRate: 16000,
            blockAlign: 256,
            overlap: false
        },
        audioCfg = "1F1F1F",
        audioMaster = 15,
        ready = 0,
        knob1Attached = 0,
        knob2Attached = 0,
        shuffleSeed = ((Date.now() & 0x7fffffff) ^ 0x5A17C9E3) >>> 0,
        message = "YOUR TURN",
        renderState = {
            opponent: api.opponent,
            playerHand: playerHand,
            cpuHand: cpuHand,
            playerCaravans: playerCaravans,
            cpuCaravans: cpuCaravans,
            handIndex: 0,
            targetIndex: 0,
            cpuTurn: 0,
            actionMenuOpen: 0,
            actionSelection: 0,
            totalCards: 0,
            message: "YOUR TURN"
        };

    function loadAudioConfig() {
        let value;

        try {
            value = fs.readFileSync(basePath + "SOUND.CFG");
            if (value && value.length >= 6) audioCfg = value
        } catch (error) {}

        try {
            if (Pip.settings && typeof Pip.settings.volume === "number") audioMaster = Pip.settings.volume;
            Pip.setVol(audioMaster)
        } catch (error) {}
    }

    function startBackgroundMusic() {
        let level,
            warmData = 0;

        musicTimer = 0;
        level = parseInt(audioCfg.charAt(5), 16);

        if (removed || finished || audioCfg.charAt(4) !== "1" ||
            isNaN(level) || level <= 0) return;

        /*
         * Entire live game audio now runs at the firmware-native 16 kHz:
         * background music, card SFX, SCROLL and SELECT.
         */
        try {
            if (Pip.audioIsPlaying()) {
                musicTimer = setTimeout(startBackgroundMusic, 20);
                return
            }
        } catch (error) {}

        try {
            /*
             * Cold-start I2S with real 16 kHz digital silence first.
             * Six ADPCM blocks give enough decoded samples to completely
             * fill both DMA buffers. The native music stream is then opened
             * immediately while I2S is already PLAYING at the same 16 kHz,
             * preventing the music itself from causing the start click.
             */
            warmData = Pip.audioRead(basePath + "GAME_AUDIO_WARM_16K.WAV");
            if (warmData) {
                Pip.audioStartVar(warmData, musicWarmOptions);
                warmData = 0
            }

            Pip.audioStart(basePath + "LAZY_DAYS_TIRED.WAV", { repeat: true })
        } catch (error) {
            warmData = 0;
            try {
                Pip.audioStart(basePath + "LAZY_DAYS_TIRED.WAV", { repeat: true })
            } catch (ignore) {}
        }
    }

    function finishCardEffect() {
        effectTimer = 0
    }

    function runQueuedEffect() {
        let kind = pendingEffect,
            data = 0,
            level,
            enabled,
            fileName;

        effectDelayTimer = 0;
        pendingEffect = -1;
        if (removed || kind < 0) return;

        if (kind) {
            enabled = audioCfg.charAt(2) === "1";
            level = parseInt(audioCfg.charAt(3), 16);
            fileName = "CARD_DISCARD_OVERLAP.WAV"
        } else {
            enabled = audioCfg.charAt(0) === "1";
            level = parseInt(audioCfg.charAt(1), 16);
            fileName = "CARD_PLAY_OVERLAP.WAV"
        }

        if (!enabled || isNaN(level) || level <= 0) return;

        /*
         * LOW-MEMORY GAMEPLAY PATH:
         * The selected 16 kHz gameplay WAV was already volume-patched before
         * CARAVAN_GAME loaded. Read only the one sound needed for this action,
         * queue it, then release it immediately.
         *
         * This avoids keeping both ~4-5 KB WAV payloads resident for the
         * entire game and fixes Discard failing to load as the second buffer.
         */
        try {
            data = Pip.audioRead(basePath + fileName);
            if (data) Pip.audioStartVar(data, effectOptions)
        } catch (error) {}

        data = 0;
        effectTimer = setTimeout(finishCardEffect, kind ? 460 : 520)
    }

    function playCardEffect(kind) {
        /*
         * One completed card action per turn means no extra effect queue is
         * needed. A 1 ms handoff lets the board redraw finish first.
         */
        pendingEffect = kind;
        if (effectDelayTimer) clearTimeout(effectDelayTimer);
        effectDelayTimer = setTimeout(runQueuedEffect, 1)
    }

    function rank(card) {
        return card & 15
    }

    function suit(card) {
        return card >> 4 & 3
    }

    function isNumber(card) {
        return rank(card) <= 10
    }

    function isJack(card) {
        return rank(card) === 11
    }

    function isQueen(card) {
        return rank(card) === 12
    }

    function isKing(card) {
        return rank(card) === 13
    }

    function isJoker(card) {
        return rank(card) === 14
    }

    function baseCount(cards) {
        let i, count = 0;
        for (i = 0; i < cards.length; i++) if (isNumber(cards[i])) count++;
        return count
    }

    function lastNumberIndex(cards) {
        let i;
        for (i = cards.length - 1; i >= 0; i--) if (isNumber(cards[i])) return i;
        return -1
    }

    function lastNumberRank(cards) {
        const i = lastNumberIndex(cards);
        return i >= 0 ? rank(cards[i]) : 0
    }

    function lastEffectiveSuit(cards) {
        let i, queenSuit = -1;
        for (i = cards.length - 1; i >= 0; i--) {
            if (isNumber(cards[i])) return queenSuit >= 0 ? queenSuit : suit(cards[i]);
            if (isQueen(cards[i]) && queenSuit < 0) queenSuit = suit(cards[i]);
        }
        return 0
    }

    function groupValueAt(cards, baseIndex) {
        let i, value;

        if (baseIndex < 0 || baseIndex >= cards.length || !isNumber(cards[baseIndex])) return 0;
        value = rank(cards[baseIndex]);
        for (i = baseIndex + 1; i < cards.length && !isNumber(cards[i]); i++) if (isKing(cards[i])) value <<= 1;
        return value
    }

    function lastGroupValue(cards) {
        return groupValueAt(cards, lastNumberIndex(cards))
    }

    function groupEndIndex(cards, baseIndex) {
        let i = baseIndex + 1;
        while (i < cards.length && !isNumber(cards[i])) i++;
        return i
    }

    function removeGroupAt(cards, baseIndex) {
        const end = groupEndIndex(cards, baseIndex);
        cards.splice(baseIndex, end - baseIndex)
    }

    function computeDirection(cards) {
        let i,
            previousRank = 0,
            direction = 0;

        for (i = 0; i < cards.length; i++) {
            if (isNumber(cards[i])) {
                if (previousRank) {
                    if (rank(cards[i]) > previousRank) direction = 1;
                    else if (rank(cards[i]) < previousRank) direction = -1
                }
                previousRank = rank(cards[i]);
            } else if (isQueen(cards[i]) && direction) direction = -direction;
        }

        return direction
    }

    function removeLastGroup(cards) {
        const i = lastNumberIndex(cards);
        if (i < 0) cards.length = 0;
        else removeGroupAt(cards, i)
    }

    function refreshAllDirections() {
        let lane;
        for (lane = 0; lane < 3; lane++) {
            playerDirection[lane] = computeDirection(playerCaravans[lane]);
            cpuDirection[lane] = computeDirection(cpuCaravans[lane])
        }
    }

    function removeJokerMatches(cards, keepCards, keepBase, targetRank, targetSuit, bySuit) {
        let i;

        for (i = cards.length - 1; i >= 0; i--) {
            if (!isNumber(cards[i])) continue;
            if (cards === keepCards && i === keepBase) continue;
            if (bySuit ? suit(cards[i]) === targetSuit : rank(cards[i]) === targetRank) removeGroupAt(cards, i)
        }
    }

    function playJoker(cards, card) {
        const baseIndex = lastNumberIndex(cards),
            targetRank = baseIndex >= 0 ? rank(cards[baseIndex]) : 0,
            targetSuit = baseIndex >= 0 ? suit(cards[baseIndex]) : 0,
            bySuit = targetRank === 1;
        let lane;

        if (baseIndex < 0) return;
        cards.push(card);

        for (lane = 0; lane < 3; lane++) {
            removeJokerMatches(playerCaravans[lane], cards, baseIndex, targetRank, targetSuit, bySuit);
            removeJokerMatches(cpuCaravans[lane], cards, baseIndex, targetRank, targetSuit, bySuit)
        }

        refreshAllDirections()
    }

    function jokerScoreForCpu(pileIndex) {
        const targetCards = cpuCaravans[pileIndex],
            baseIndex = lastNumberIndex(targetCards),
            targetRank = baseIndex >= 0 ? rank(targetCards[baseIndex]) : 0,
            targetSuit = baseIndex >= 0 ? suit(targetCards[baseIndex]) : 0,
            bySuit = targetRank === 1;
        let lane, i, playerRemoved = 0, cpuRemoved = 0;

        if (baseIndex < 0) return -1000;

        for (lane = 0; lane < 3; lane++) {
            for (i = 0; i < playerCaravans[lane].length; i++) {
                if (isNumber(playerCaravans[lane][i]) && (bySuit ? suit(playerCaravans[lane][i]) === targetSuit : rank(playerCaravans[lane][i]) === targetRank)) {
                    playerRemoved += groupValueAt(playerCaravans[lane], i)
                }
            }
            for (i = 0; i < cpuCaravans[lane].length; i++) {
                if (!isNumber(cpuCaravans[lane][i])) continue;
                if (cpuCaravans[lane] === targetCards && i === baseIndex) continue;
                if (bySuit ? suit(cpuCaravans[lane][i]) === targetSuit : rank(cpuCaravans[lane][i]) === targetRank) cpuRemoved += groupValueAt(cpuCaravans[lane], i)
            }
        }

        return playerRemoved * 4 - cpuRemoved * 3
    }

    function random32() {
        if (!shuffleSeed) shuffleSeed = 0x6D2B79F5;
        shuffleSeed ^= shuffleSeed << 13;
        shuffleSeed ^= shuffleSeed >>> 17;
        shuffleSeed ^= shuffleSeed << 5;
        return shuffleSeed >>> 0
    }

    function thinkDelay() {
        return 1500 + random32() % 1501
    }

    function shuffleDeck(deck) {
        let index,
            swapIndex,
            card;

        for (index = deck.length - 1; index > 0; index--) {
            swapIndex = random32() % (index + 1);
            card = deck[index];
            deck[index] = deck[swapIndex];
            deck[swapIndex] = card
        }

        return deck
    }

    function makeDeck(cpu) {
        let deck = [],
            suitValue,
            rankValue,
            suitOffset = cpu ? 1 : 0;

        for (suitValue = 0; suitValue < 4; suitValue++) {
            for (rankValue = 1; rankValue <= 13; rankValue++) {
                deck.push((((suitValue + suitOffset) & 3) << 4) | rankValue)
            }
        }

        deck.push(((cpu ? 2 : 0) << 4) | 14);
        deck.push(((cpu ? 3 : 1) << 4) | 14);
        return deck
    }

    function total(cards) {
        let index = 0,
            value = 0,
            groupValue,
            cardRank;

        while (index < cards.length) {
            cardRank = cards[index] & 15;
            if (cardRank <= 10) {
                groupValue = cardRank;
                index++;
                while (index < cards.length && (cards[index] & 15) > 10) {
                    if ((cards[index] & 15) === 13) groupValue <<= 1;
                    index++
                }
                value += groupValue
            } else index++
        }

        return value
    }

    function canPlay(caravans, directions, pileIndex, card) {
        const cards = caravans[pileIndex],
            cardRank = card & 15;

        let lastRank,
            direction;

        if (cardRank > 10) return lastNumberIndex(cards) >= 0;
        if (!cards.length) return 1;

        lastRank = lastNumberRank(cards);
        if (cardRank === lastRank) return 0;
        if (baseCount(cards) === 1) return 1;
        if ((card >> 4 & 3) === lastEffectiveSuit(cards)) return 1;

        direction = directions[pileIndex];
        if (direction > 0) return cardRank > lastRank;
        if (direction < 0) return cardRank < lastRank;
        return 1
    }

    function updateDirection(caravans, directions, pileIndex) {
        directions[pileIndex] = computeDirection(caravans[pileIndex])
    }

    function playCard(caravans, directions, pileIndex, card) {
        const cards = caravans[pileIndex];

        if (isJoker(card)) {
            playJoker(cards, card);
            return
        }

        if (isJack(card)) removeLastGroup(cards);
        else {
            cards.push(card);
            if (isQueen(card)) directions[pileIndex] = directions[pileIndex] ? -directions[pileIndex] : computeDirection(cards)
        }

        if (isNumber(card) || isJack(card)) updateDirection(caravans, directions, pileIndex)
    }

    function drawPlayerCard() {
        if (playerDeckPos < playerDeck.length) {
            playerHand.push(playerDeck[playerDeckPos++])
        }
    }

    function drawCpuCard() {
        if (cpuDeckPos < cpuDeck.length) cpuHand.push(cpuDeck[cpuDeckPos++])
    }

    function fillHands() {
        while (playerHand.length < 8 && playerDeckPos < playerDeck.length) drawPlayerCard();
        while (cpuHand.length < 8 && cpuDeckPos < cpuDeck.length) drawCpuCard()
    }

    function dealOpeningCaravans() {
        let lane, index, card;

        for (lane = 0; lane < 3; lane++) {
            for (index = playerDeckPos; index < playerDeck.length; index++) {
                if (isNumber(playerDeck[index])) {
                    card = playerDeck[playerDeckPos];
                    playerDeck[playerDeckPos] = playerDeck[index];
                    playerDeck[index] = card;
                    break
                }
            }
            playerCaravans[lane].push(playerDeck[playerDeckPos++]);

            for (index = cpuDeckPos; index < cpuDeck.length; index++) {
                if (isNumber(cpuDeck[index])) {
                    card = cpuDeck[cpuDeckPos];
                    cpuDeck[cpuDeckPos] = cpuDeck[index];
                    cpuDeck[index] = card;
                    break
                }
            }
            cpuCaravans[lane].push(cpuDeck[cpuDeckPos++])
        }
    }

    function laneWinner(playerTotal, cpuTotal) {
        const playerQualified = playerTotal >= 21 && playerTotal <= 26,
            cpuQualified = cpuTotal >= 21 && cpuTotal <= 26;

        if (!playerQualified && !cpuQualified) return 0;
        if (playerQualified && !cpuQualified) return 1;
        if (!playerQualified && cpuQualified) return -1;
        if (playerTotal === cpuTotal) return 0;
        return playerTotal > cpuTotal ? 1 : -1
    }

    function checkWinner() {
        let lane,
            sold = 0,
            playerWins = 0,
            cpuWins = 0,
            winner;

        for (lane = 0; lane < 3; lane++) {
            winner = laneWinner(total(playerCaravans[lane]), total(cpuCaravans[lane]));
            if (winner) sold++;
            if (winner > 0) playerWins++;
            if (winner < 0) cpuWins++
        }

        if (sold === 3) {
            if (playerWins >= 2) return "PLAYER";
            if (cpuWins >= 2) return "CPU"
        }

        if (turnCount > 120 || !playerHand.length && !cpuHand.length) {
            if (playerWins > cpuWins) return "PLAYER";
            if (cpuWins > playerWins) return "CPU";
            return "DRAW"
        }

        return ""
    }

    function drawGame() {
        renderState.handIndex = handIndex;
        renderState.targetIndex = targetIndex;
        renderState.cpuTurn = cpuTurn;
        renderState.actionMenuOpen = actionMenuOpen;
        renderState.actionSelection = actionSelection;
        renderState.totalCards = playerDeck.length - playerDeckPos + playerHand.length;
        renderState.message = message;
        if (renderer && renderer.draw) renderer.draw(renderState)
    }

    function detachInput() {
        if (knob1Attached) {
            Pip.removeListener("knob1", onKnob1);
            knob1Attached = 0
        }

        if (knob2Attached) {
            Pip.removeListener("knob2", onKnob2);
            knob2Attached = 0
        }
    }

    function attachInput() {
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

    function returnResult() {
        const result = checkWinner() || "DRAW";
        finishTimer = 0;
        if (api.onFinish) api.onFinish(result)
    }

    function finishGame(result) {
        if (finished) return;
        finished = 1;
        cpuTurn = 0;
        detachInput();
        message = result === "PLAYER" ? "YOU WIN" : result === "CPU" ? api.opponent + " WINS" : "DRAW";
        drawGame();
        finishTimer = setTimeout(returnResult, 1200)
    }

    function afterMove(effectKind) {
        const result = checkWinner();

        turnCount++;
        if (result) {
            finishGame(result);
            playCardEffect(effectKind);
            return
        }

        cpuTurn = 1;
        message = api.opponent + "'S TURN";
        syncActionState();
        renderState.cpuTurn = 1;
        drawGame();
        playCardEffect(effectKind);
        cpuTimer = setTimeout(runCpuTurn, thinkDelay())
    }

    function syncActionState() {
        renderState.actionMenuOpen = actionMenuOpen;
        renderState.actionSelection = actionSelection;
        renderState.totalCards = playerDeck.length - playerDeckPos + playerHand.length;
        renderState.message = message
    }

    function openActionMenu() {
        if (finished || cpuTurn || !playerHand.length) return;
        actionMenuOpen = 1;
        actionSelection = 0;
        syncActionState();
        Pip.playSound("SELECT");
        if (renderer && renderer.drawActionMenu) renderer.drawActionMenu(renderState)
    }

    function closeActionMenu(redraw) {
        actionMenuOpen = 0;
        actionSelection = 0;
        syncActionState();
        if (redraw) drawGame()
    }

    function confirmAction() {
        let played;

        if (!actionMenuOpen) return;
        if (actionSelection === 0) {
            played = playSelectedCard();
            if (!played) syncActionState();
            return
        }

        if (actionSelection === 1) {
            actionMenuOpen = 0;
            actionSelection = 0;
            discardSelectedCard();
            return
        }

        Pip.playSound("SELECT");
        closeActionMenu(1)
    }

    function playSelectedCard() {
        const card = playerHand[handIndex];

        if (finished || cpuTurn || card === undefined) return 0;

        if (!canPlay(playerCaravans, playerDirection, targetIndex, card)) {
            message = "INVALID PLAY";
            syncActionState();
            Pip.playSound("SCROLL");
            if (renderer && renderer.redrawStatusTitle) renderer.redrawStatusTitle(renderState);
            return 0
        }

        actionMenuOpen = 0;
        actionSelection = 0;
        playCard(playerCaravans, playerDirection, targetIndex, card);
        playerHand.splice(handIndex, 1);
        drawPlayerCard();
        if (handIndex >= playerHand.length) handIndex = Math.max(0, playerHand.length - 1);
        message = "CARD PLAYED";
        afterMove(0);
        return 1
    }

    function discardSelectedCard() {
        if (finished || cpuTurn || !playerHand.length) return;

        playerHand.splice(handIndex, 1);
        drawPlayerCard();
        if (handIndex >= playerHand.length) handIndex = Math.max(0, playerHand.length - 1);
        message = "CARD DISCARDED";
        afterMove(1)
    }

    function chooseCpuMove() {
        let hand,
            pile,
            card,
            cardRank,
            current,
            projected,
            score,
            bestScore = -10000,
            bestMove = -1;

        for (hand = 0; hand < cpuHand.length; hand++) {
            card = cpuHand[hand];
            cardRank = card & 15;

            for (pile = 0; pile < 3; pile++) {
                if (!canPlay(cpuCaravans, cpuDirection, pile, card)) continue;

                current = total(cpuCaravans[pile]);

                if (cardRank <= 10) {
                    projected = current + cardRank;
                    score = projected > 26 ? -700 - projected :
                        projected >= 21 ? 250 + projected : projected * 3
                } else if (cardRank === 11) {
                    projected = current - lastGroupValue(cpuCaravans[pile]);
                    score = current > 26 && projected <= 26 ? 300 :
                        current >= 21 && current <= 26 ? -160 : 10
                } else if (cardRank === 13) {
                    projected = current + lastGroupValue(cpuCaravans[pile]);
                    score = projected > 26 ? -500 :
                        projected >= 21 ? 180 + projected : projected * 2
                } else if (cardRank === 12) {
                    score = current >= 16 && current < 21 ? 30 : 8
                } else {
                    score = jokerScoreForCpu(pile)
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = hand << 2 | pile
                }
            }
        }

        return bestScore < -200 ? -1 : bestMove
    }

    function beginPlayerTurn() {
        cpuTimer = 0;
        if (finished) return;
        cpuTurn = 0;
        message = "YOUR TURN";
        syncActionState();
        renderState.cpuTurn = 0;
        if (renderer && renderer.redrawStatusTitle) renderer.redrawStatusTitle(renderState);
        if (renderer && renderer.redrawTargetSelection) renderer.redrawTargetSelection(renderState, -1)
    }

    function runCpuTurn() {
        let move,
            hand,
            pile,
            card,
            result,
            effectKind;

        cpuTimer = 0;
        if (finished) return;

        move = chooseCpuMove();

        if (move < 0 || !cpuHand.length) {
            if (cpuHand.length) cpuHand.splice(0, 1);
            drawCpuCard();
            message = api.opponent + " DISCARDED";
            effectKind = 1
        } else {
            hand = move >> 2;
            pile = move & 3;
            card = cpuHand[hand];
            playCard(cpuCaravans, cpuDirection, pile, card);
            cpuHand.splice(hand, 1);
            drawCpuCard();
            message = api.opponent + " PLAYED";
            effectKind = 0
        }

        turnCount++;
        result = checkWinner();

        if (result) {
            finishGame(result);
            playCardEffect(effectKind);
            return
        }

        cpuTurn = 1;
        drawGame();
        playCardEffect(effectKind);
        cpuTimer = setTimeout(beginPlayerTurn, thinkDelay())
    }

    function onKnob1(direction) {
        let previousTarget;

        if (!ready || finished || cpuTurn) return;

        if (actionMenuOpen) {
            if (!direction) confirmAction();
            return
        }

        if (direction) {
            previousTarget = targetIndex;
            targetIndex += direction > 0 ? 1 : -1;
            if (targetIndex < 0) targetIndex = 2;
            if (targetIndex > 2) targetIndex = 0;
            renderState.targetIndex = targetIndex;
            Pip.playSound("SCROLL");
            if (renderer && renderer.redrawTargetSelection) renderer.redrawTargetSelection(renderState, previousTarget);
            return
        }

        openActionMenu()
    }

    function onKnob2(direction) {
        let previousHand,
            previousAction;

        if (!ready || finished || cpuTurn) return;

        if (actionMenuOpen) {
            if (!direction) return;
            previousAction = actionSelection;
            actionSelection += direction > 0 ? 1 : -1;
            if (actionSelection < 0) actionSelection = 2;
            if (actionSelection > 2) actionSelection = 0;
            syncActionState();
            Pip.playSound("SCROLL");
            if (renderer && renderer.redrawActionSelection) renderer.redrawActionSelection(renderState, previousAction);
            return
        }

        if (!direction || !playerHand.length) return;
        previousHand = handIndex;
        handIndex += direction > 0 ? 1 : -1;
        if (handIndex < 0) handIndex = playerHand.length - 1;
        if (handIndex >= playerHand.length) handIndex = 0;
        renderState.handIndex = handIndex;
        Pip.playSound("SCROLL");
        if (renderer && renderer.redrawHandSelection) renderer.redrawHandSelection(renderState, previousHand)
    }

    function loadRenderer() {
        let sourceCode,
            rendererFactory;

        sourceCode = fs.readFileSync(basePath + "CARAVAN_RENDERER.MIN.JS");
        rendererFactory = eval(sourceCode);
        sourceCode = 0;
        renderer = rendererFactory({ fs: fs, basePath: basePath });
        rendererFactory = 0
    }

    function removeGame() {
        if (removed) return;
        removed = 1;

        if (cpuTimer) {
            clearTimeout(cpuTimer);
            cpuTimer = 0
        }

        if (finishTimer) {
            clearTimeout(finishTimer);
            finishTimer = 0
        }

        if (bootTimer) {
            clearTimeout(bootTimer);
            bootTimer = 0
        }

        if (musicTimer) {
            clearTimeout(musicTimer);
            musicTimer = 0
        }

        if (effectDelayTimer) {
            clearTimeout(effectDelayTimer);
            effectDelayTimer = 0
        }

        if (effectTimer) {
            clearTimeout(effectTimer);
            effectTimer = 0
        }

        pendingEffect = -1;

        try {
            Pip.audioStop();
            Pip.setVol(audioMaster)
        } catch (error) {}

        ready = 0;
        detachInput();


        if (renderer && renderer.remove) renderer.remove();
        renderer = 0;
        playerDeck = [];
        cpuDeck = [];
        playerHand = [];
        cpuHand = [];
        playerCaravans = [[], [], []];
        cpuCaravans = [[], [], []]
    }

    bootTimer = setTimeout(function() {
        bootTimer = 0;
        if (removed) return;

        try { E.defrag() } catch (error) {}
        loadRenderer();
        if (removed) return;

        playerDeck = shuffleDeck(makeDeck(0));
        cpuDeck = shuffleDeck(makeDeck(1));
        dealOpeningCaravans();
        fillHands();
        loadAudioConfig();

        /*
         * Draw the entire board first. No partial YOUR TURN/header has been
         * shown by APP. The two tiny card sounds are loaded only after the
         * renderer has returned, avoiding the v0.5.44 renderer memory spike.
         */
        drawGame();

        /*
         * Card SFX are no longer preloaded. This returns roughly 9 KB of
         * heap headroom to the live game on the 16 kHz build.
         */
        ready = 1;
        attachInput();
        musicTimer = setTimeout(startBackgroundMusic, 1)
    }, 1);

    return {
        id: "CARAVANGAME",
        remove: removeGame
    }
});
