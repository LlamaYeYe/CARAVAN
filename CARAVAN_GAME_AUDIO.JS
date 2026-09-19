/*
 * CARAVAN - CARAVAN_GAME_AUDIO.JS
 * Resident in-game music/SFX controller and reusable audio buffers.
 * Readable source only; installed runtime remains in the matching minified file.
 */
(function (api) {
    const fs = api[0],
        basePath = api[1],
        bankPath = basePath + "CARAVAN_SFX.BIN",
        gameBankOffset = 818700,
        levelStride = 4284,
        playWavLength = 2654,
        dataOffset = 94,
        playLength = 2560,
        discardLength = 1536,
        chunkSize = 256,
        audioOptions = {
        encoding: "adpcm",
        sampleRate: 16000,
        blockAlign: 256,
        overlap: true
    };
    let removed = 0,
        active = 0,
        audioConfig = "1F1F1F1F",
        bankFile = 0,
        soundBuffer = 0,
        discardView = 0,
        bufferAddress = 0,
        pendingKind = -1,
        playTimer = 0,
        loadedKind = -1,
        loadedLevel = 0;

    // --- Configuration and reusable resources ---
    function loadConfig() {
        try {
            const text = fs.readFileSync(basePath + "VOLUME_SOUND.CFG");
            if (text && text.length >= 8) audioConfig = text
        } catch (error) {
        }
    }

    function openBank() {
        if (bankFile) return 1;
        try {
            bankFile = E.openFile(bankPath, "r")
        } catch (error) {
            bankFile = 0
        }
        return bankFile ? 1 : 0
    }

    function closeBank() {
        if (!bankFile) return;
        try {
            bankFile.close()
        } catch (error) {
        }
        bankFile = 0
    }

    function allocateBuffer() {
        if (soundBuffer) return 1;
        try {
            soundBuffer = new Uint8Array(playLength);
            discardView = new Uint8Array(soundBuffer.buffer, 0, discardLength);
            bufferAddress = E.getAddressOf(soundBuffer.buffer, true);
            if (!bufferAddress) throw new Error("SFX BUFFER");
            return 1
        } catch (error) {
            soundBuffer = discardView = 0;
            bufferAddress = 0;
            return 0
        }
    }

    // --- Volume/state helpers ---
    function soundLevel(kind) {
        const enabledPosition = kind ? 2 : 0,
            volumePosition = kind ? 3 : 1;
        let level;
        if (audioConfig.charAt(enabledPosition) !== "1") return 0;
        level = parseInt(audioConfig.charAt(volumePosition), 16);
        if (isNaN(level) || level <= 0) return 0;
        return level > 15 ? 15 : level
    }

    function musicEnabled() {
        const level = parseInt(audioConfig.charAt(7), 16);
        return audioConfig.charAt(6) === "1" && !isNaN(level) && level > 0
    }

    // --- SFX buffer loading ---
    function fillSound(kind, level) {
        const length = kind ? discardLength : playLength,
            sourceOffset = gameBankOffset + (level - 1) * levelStride + (kind ? playWavLength
                : 0) + dataOffset;
        let position = 0,
            chunk = 0,
            count = 0;
        if (loadedKind === kind && loadedLevel === level && soundBuffer) return 1;
        if (!allocateBuffer() || !openBank()) return 0;
        try {
            bankFile.seek(sourceOffset);
            while (position < length) {
                count = length - position > chunkSize ? chunkSize : length - position;
                chunk = bankFile.read(count);
                if (!chunk || chunk.length !== count) throw new Error("SFX READ");
                poke8(bufferAddress + position, chunk);
                chunk = 0;
                position += count
            }
            loadedKind = kind;
            loadedLevel = level;
            return 1
        } catch (error) {
            chunk = 0;
            loadedKind = -1;
            loadedLevel = 0;
            return 0
        }
    }

    // --- Audio runtime ---
    function start() {
        if (removed || active) return;
        active = 1;
        loadConfig();
        allocateBuffer();
        openBank();
        // Pip.audioStart() replaces the active file stream itself. Do not reset the
        // codec immediately before starting the 16 kHz music stream.
        if (musicEnabled()) {
            try {
                Pip.audioStart(basePath + "LAZY_DAYZ-TIRED.WAV", {
                    repeat: true
                })
            } catch (error) {
            }
        }
    }

    function submitSound() {
        if (removed || !active || pendingKind < 0) return;
        const kind = pendingKind,
            freeLimit = kind ? 13354 : 11334;
        playTimer = 0;
        if (musicEnabled() && Pip.audioGetFree) {
            try {
                if (Pip.audioGetFree() > freeLimit) {
                    playTimer = setTimeout(submitSound, 8);
                    return
                }
            } catch (error) {
            }
        }
        pendingKind = -1;
        try {
            Pip.audioStartVar(kind ? discardView : soundBuffer, audioOptions)
        } catch (error) {
        }
    }

    function play(kind) {
        const level = soundLevel(kind);
        if (removed || !active || !level) return;
        if (!fillSound(kind, level)) return;
        pendingKind = kind;
        if (playTimer) clearTimeout(playTimer);
        // Keep the card sound clear of the short firmware SCROLL/SELECT cue that
        // may have just been mixed by the controls. Both streams are 16 kHz, but
        // starting two overlap streams on the same instant can change perceived
        // level/tone on the hardware mixer.
        playTimer = setTimeout(submitSound, 90)
    }

    function idle() {
        if (removed) return;
        active = 0;
        if (playTimer) clearTimeout(playTimer);
        playTimer = 0;
        pendingKind = -1;
        try {
            Pip.audioStop()
        } catch (error) {
        }
        closeBank();
        soundBuffer = discardView = 0;
        bufferAddress = 0;
        loadedKind = -1;
        loadedLevel = 0
    }

    // --- Final cleanup ---
    function remove() {
        if (removed) return;
        idle();
        removed = 1
    }
    return [start, play, idle, remove]
})
