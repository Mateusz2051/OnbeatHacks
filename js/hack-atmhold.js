
const ATM_PRESETS = {
    easy: { seqLen: 3, zoneSize: [18, 25], fillSpeed: [1800, 2500], maxAttempts: 5, timeleft: 25 },
    normal: { seqLen: 4, zoneSize: [12, 18], fillSpeed: [1200, 1800], maxAttempts: 3, timeleft: 20 },
    hard: { seqLen: 5, zoneSize: [8, 13], fillSpeed: [700, 1200], maxAttempts: 2, timeleft: 15 },
};

let atmConfig = { ...ATM_PRESETS.normal };
let atmState = {
    sequence: [],      // e.g. [3, 7, 1, 5]
    currentIdx: 0,
    attempts: 3,
    isHolding: false,
    activeKey: null,
    startTime: 0,
    fillDuration: 0,
    progressValue: 0,
    zoneStart: 0,
    zoneEnd: 0,
    animFrame: null,
    timerLeft: 0,
};

// ─── Init ─────────────────────────────────────────────────────────────

function initAtmHold() {
    atmApplyPreset('normal');
    buildAtmKeypad();
    atmSetupReady(false);
}

function atmApplyPreset(name) {
    const p = ATM_PRESETS[name] || ATM_PRESETS.normal;
    atmConfig = { ...p };
    // highlight active button
    document.querySelectorAll('#atm-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    // sync custom inputs
    const fields = {
        'atm-in-seqlen': atmConfig.seqLen,
        'atm-in-zonemin': atmConfig.zoneSize[0],
        'atm-in-zonemax': atmConfig.zoneSize[1],
        'atm-in-speedmin': atmConfig.fillSpeed[0],
        'atm-in-speedmax': atmConfig.fillSpeed[1],
        'atm-in-attempts': atmConfig.maxAttempts,
        'atm-in-time': atmConfig.timeleft,
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

function atmReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) || def;
    atmConfig = {
        seqLen: Math.min(9, Math.max(1, v('atm-in-seqlen', 4))),
        zoneSize: [v('atm-in-zonemin', 12), v('atm-in-zonemax', 18)],
        fillSpeed: [v('atm-in-speedmin', 1200), v('atm-in-speedmax', 1800)],
        maxAttempts: Math.max(1, v('atm-in-attempts', 3)),
        timeleft: v('atm-in-time', 20),
    };
}

function atmSetupReady(keepConfig = false) {
    cancelAnimationFrame(atmState.animFrame);
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        atmApplyPreset('normal');
    } else {
        atmReadCustomConfig();
    }

    atmState = {
        sequence: [],
        currentIdx: 0,
        attempts: atmConfig.maxAttempts,
        isHolding: false,
        activeKey: null,
        startTime: 0,
        fillDuration: 0,
        progressValue: 0,
        zoneStart: 0,
        zoneEnd: 0,
        animFrame: null,
        timerLeft: atmConfig.timeleft,
    };

    // Generate sequence (no repeats)
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    for (let i = 0; i < atmConfig.seqLen; i++) {
        const idx = randomInt(0, pool.length - 1);
        atmState.sequence.push(pool.splice(idx, 1)[0]);
    }

    buildAtmSeqDisplay();
    updateAtmUI();
    atmResetAllBars();

    // Timer display
    const textEl = document.getElementById('atm-timer-text');
    const barEl = document.getElementById('atm-timer-bar');
    if (textEl) textEl.textContent = atmConfig.timeleft.toFixed(1) + 's';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = 'var(--pink)';
    }

    // Toggle button visibility
    const startBtn = document.getElementById('atm-btn-start');
    const restartBtn = document.getElementById('atm-btn-restart');
    const configBtn = document.getElementById('atm-btn-config');
    const hintEl = document.getElementById('atm-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    const msgEl = document.getElementById('atm-message');
    if (msgEl) {
        msgEl.innerHTML = '<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>';
        msgEl.className = 'atm-message';
    }
}

function resetAtmGame() {
    atmSetupReady(true);
    startAtmGame();
}

// ─── UI Builders ─────────────────────────────────────────────────────

function buildAtmKeypad() {
    const container = document.getElementById('atm-keypad-container');
    if (!container) return;
    container.innerHTML = '';
    // Layout: 1-9 then empty, 0, empty
    const layout = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, ''];
    layout.forEach(k => {
        const wrapper = document.createElement('div');
        wrapper.className = 'atm-key-wrapper';
        if (k === '') {
            wrapper.innerHTML = `<div></div><div class="atm-mini-bar-wrap" style="visibility:hidden"><div></div><div></div></div>`;
        } else {
            wrapper.innerHTML = `
                <button class="atm-key" id="atm-key-${k}" data-key="${k}">${k}</button>
                <div class="atm-mini-bar-wrap" id="atm-bar-wrap-${k}">
                    <div class="atm-zone" id="atm-zone-${k}"></div>
                    <div class="atm-fill" id="atm-fill-${k}"></div>
                </div>
            `;
        }
        container.appendChild(wrapper);
    });

    // Attach events
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(k => {
        const btn = document.getElementById(`atm-key-${k}`);
        if (!btn) return;
        btn.addEventListener('mousedown', () => atmHandleHoldStart(k));
        btn.addEventListener('touchstart', e => { e.preventDefault(); atmHandleHoldStart(k); });
    });
}

function buildAtmSeqDisplay() {
    const disp = document.getElementById('atm-seq-display');
    if (!disp) return;
    disp.innerHTML = '';
    for (let i = 0; i < (atmState.sequence.length || atmConfig.seqLen); i++) {
        const span = document.createElement('span');
        span.id = `atm-seq-${i}`;
        span.className = 'atm-seq-digit';
        span.textContent = '?';
        disp.appendChild(span);
    }
}

function updateAtmUI() {
    // Sequence display
    if (atmState.sequence.length > 0) {
        atmState.sequence.forEach((digit, i) => {
            const span = document.getElementById(`atm-seq-${i}`);
            if (!span) return;
            if (i < atmState.currentIdx) {
                span.textContent = digit;
                span.classList.add('atm-seq-done');
                span.classList.remove('atm-seq-active', 'atm-seq-future');
            } else if (i === atmState.currentIdx) {
                span.textContent = digit;
                span.classList.add('atm-seq-active');
                span.classList.remove('atm-seq-done', 'atm-seq-future');
            } else {
                span.textContent = '?';
                span.classList.add('atm-seq-future');
                span.classList.remove('atm-seq-done', 'atm-seq-active');
            }
        });
    }
    // Attempts
    const attEl = document.getElementById('atm-attempts');
    if (attEl) attEl.textContent = atmState.attempts;
    // Step indicator
    const stepEl = document.getElementById('atm-step');
    if (stepEl) stepEl.textContent = `${atmState.currentIdx + 1} / ${atmConfig.seqLen}`;
}

function atmResetAllBars() {
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(k => {
        const zone = document.getElementById(`atm-zone-${k}`);
        const fill = document.getElementById(`atm-fill-${k}`);
        if (zone) { zone.style.display = 'none'; }
        if (fill) { fill.style.width = '0%'; fill.style.background = 'var(--atm-fill)'; }
        const btn = document.getElementById(`atm-key-${k}`);
        if (btn) { btn.classList.remove('atm-key-active'); btn.style.removeProperty('box-shadow'); }
    });
}

// ─── Round Logic ─────────────────────────────────────────────────────

function startAtmGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('atm-btn-start');
    const restartBtn = document.getElementById('atm-btn-restart');
    const configBtn = document.getElementById('atm-btn-config');
    const hintEl = document.getElementById('atm-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    const msgEl = document.getElementById('atm-message');
    if (msgEl) {
        msgEl.innerHTML = '';
        msgEl.className = 'atm-message';
    }

    startAtmRound();
}

function startAtmRound() {
    buildAtmSeqDisplay();
    updateAtmUI();
    startCountdown(() => {
        if (sharedState.currentHack === 'atmhold') {
            sharedState.status = 'PLAYING';
            atmPrepareCurrentKey();
            startAtmTimer();
        }
    });
}

function atmPrepareCurrentKey() {
    atmResetAllBars();
    if (atmState.currentIdx >= atmConfig.seqLen) return;

    const expectedKey = atmState.sequence[atmState.currentIdx];
    const zoneWidth = randomInt(atmConfig.zoneSize[0], atmConfig.zoneSize[1]);
    atmState.zoneStart = randomInt(10, 90 - zoneWidth);
    atmState.zoneEnd = atmState.zoneStart + zoneWidth;
    atmState.fillDuration = randomInt(atmConfig.fillSpeed[0], atmConfig.fillSpeed[1]);

    const zone = document.getElementById(`atm-zone-${expectedKey}`);
    const fill = document.getElementById(`atm-fill-${expectedKey}`);
    if (zone) {
        zone.style.display = 'block';
        zone.style.left = `${atmState.zoneStart}%`;
        zone.style.width = `${zoneWidth}%`;
    }
    if (fill) {
        fill.style.width = '0%';
        fill.style.background = 'var(--atm-fill)';
    }
}

function startAtmTimer() {
    const textEl = document.getElementById('atm-timer-text');
    const barEl = document.getElementById('atm-timer-bar');
    startGenericTimer(atmConfig.timeleft, textEl, barEl, () => {
        atmFail('Czas minął!');
    }, (rem, frac) => {
        if (barEl) {
            barEl.style.background = frac > 0.4
                ? 'var(--color-fuchsia)'
                : frac > 0.2 ? '#f59e0b' : '#ef4444';
        }
    });
}

// ─── Hold / Release ──────────────────────────────────────────────────

function atmHandleHoldStart(keyNum) {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'atmhold') return;

    const expected = atmState.sequence[atmState.currentIdx];
    atmState.activeKey = parseInt(keyNum);

    if (atmState.activeKey !== expected) {
        atmFail('Zły przycisk!');
        return;
    }

    atmState.isHolding = true;
    const btn = document.getElementById(`atm-key-${keyNum}`);
    if (btn) btn.classList.add('atm-key-active');

    const fill = document.getElementById(`atm-fill-${keyNum}`);
    if (fill) { fill.style.width = '0%'; fill.style.background = 'var(--atm-fill)'; }

    atmState.startTime = performance.now();
    atmState.animFrame = requestAnimationFrame(atmAnimateProgress);
}

function atmAnimateProgress(timestamp) {
    if (!atmState.isHolding || atmState.activeKey === null) return;
    const elapsed = timestamp - atmState.startTime;
    atmState.progressValue = Math.min((elapsed / atmState.fillDuration) * 100, 100);
    const fill = document.getElementById(`atm-fill-${atmState.activeKey}`);
    if (fill) fill.style.width = `${atmState.progressValue}%`;
    if (atmState.progressValue >= 100) {
        atmHandleHoldRelease();
        return;
    }
    atmState.animFrame = requestAnimationFrame(atmAnimateProgress);
}

function atmHandleHoldRelease() {
    if (!atmState.isHolding || sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'atmhold') return;
    atmState.isHolding = false;
    cancelAnimationFrame(atmState.animFrame);

    const key = atmState.activeKey;
    atmState.activeKey = null;
    const btn = document.getElementById(`atm-key-${key}`);
    if (btn) btn.classList.remove('atm-key-active');

    if (atmState.progressValue >= atmState.zoneStart && atmState.progressValue <= atmState.zoneEnd) {
        atmSuccessStep(key);
    } else {
        atmFail('Pudło! Zwolnij w zielonej strefie.');
    }
}

// ─── Success / Fail ──────────────────────────────────────────────────

function atmSuccessStep(key) {
    const fill = document.getElementById(`atm-fill-${key}`);
    if (fill) { fill.style.background = '#22c55e'; }

    atmState.currentIdx++;
    sharedState.status = 'PAUSED';
    clearInterval(sharedState.timerInterval);

    if (atmState.currentIdx >= atmConfig.seqLen) {
        showAtmMessage('HACKOWANIE UDANE! 🔓', 'atm-msg-success');
        sharedState.status = 'WON';
        setTimeout(() => { if (sharedState.currentHack === 'atmhold') showHub(); }, 2500);
    } else {
        updateAtmUI();
        showAtmMessage('Trafiłeś! Następna cyfra...', 'atm-msg-info');
        setTimeout(() => {
            if (sharedState.currentHack !== 'atmhold') return;
            showAtmMessage('', '');
            sharedState.status = 'PLAYING';
            atmPrepareCurrentKey();
            startAtmTimer();
        }, 800);
    }
}

function atmFail(msg) {
    clearInterval(sharedState.timerInterval);
    cancelAnimationFrame(atmState.animFrame);
    atmState.isHolding = false;
    sharedState.status = 'PAUSED';

    // Flash red on active key
    if (atmState.activeKey !== null) {
        const fill = document.getElementById(`atm-fill-${atmState.activeKey}`);
        if (fill) { fill.style.background = '#ef4444'; if (atmState.progressValue === 0) fill.style.width = '100%'; }
        const btn = document.getElementById(`atm-key-${atmState.activeKey}`);
        if (btn) btn.classList.remove('atm-key-active');
        atmState.activeKey = null;
    }

    atmState.attempts--;
    updateAtmUI();
    showAtmMessage(msg, 'atm-msg-fail');

    setTimeout(() => {
        if (sharedState.currentHack !== 'atmhold') return;
        if (atmState.attempts <= 0) {
            showAtmMessage('SYSTEM ZABLOKOWANY 🔒', 'atm-msg-fail');
            sharedState.status = 'GAMEOVER';
            setTimeout(() => { if (sharedState.currentHack === 'atmhold') showHub(); }, 2500);
        } else {
            showAtmMessage('', '');
            // Reset to beginning of sequence
            atmState.currentIdx = 0;
            sharedState.status = 'PLAYING';
            updateAtmUI();
            atmPrepareCurrentKey();
            startAtmTimer();
        }
    }, 1200);
}

function showAtmMessage(text, cls) {
    const el = document.getElementById('atm-message');
    if (!el) return;
    el.textContent = text;
    el.className = `atm-message ${cls}`;
}

// ─── Event wiring (called once on DOM ready) ─────────────────────────

function atmWireEvents() {
    // Release on mouseup / touchend anywhere
    window.addEventListener('mouseup', atmHandleHoldRelease);
    window.addEventListener('touchend', atmHandleHoldRelease);

    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'atmhold') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && e.key === 'Enter') {
            e.preventDefault();
            startAtmGame();
        }
    });

    // Preset buttons
    document.querySelectorAll('#atm-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            atmApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#atm-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            atmSetupReady(true);
        });
    });

    // Custom inputs mark custom
    ['atm-in-seqlen', 'atm-in-zonemin', 'atm-in-zonemax', 'atm-in-speedmin', 'atm-in-speedmax', 'atm-in-attempts', 'atm-in-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            document.querySelectorAll('#atm-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            atmReadCustomConfig();
            if (sharedState.status === 'READY') {
                atmSetupReady(true);
            }
        });
    });

    // Start button
    document.getElementById('atm-btn-start')?.addEventListener('click', () => {
        atmReadCustomConfig();
        startAtmGame();
    });

    // Restart button
    document.getElementById('atm-btn-restart')?.addEventListener('click', () => {
        atmReadCustomConfig();
        resetAtmGame();
    });

    // Config button
    document.getElementById('atm-btn-config')?.addEventListener('click', () => {
        atmSetupReady(true);
    });
}
