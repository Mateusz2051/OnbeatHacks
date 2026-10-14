
const ARROWS_PRESETS = {
    easy: { count: 6, stages: 1, timeleft: 20 },
    normal: { count: 8, stages: 1, timeleft: 15 },
    hard: { count: 12, stages: 2, timeleft: 12 },
};

const ARROW_DIRS = {
    up: { symbol: '↑', label: 'GÓRA', sub: 'W / GÓRA', keyCodes: ['KeyW', 'ArrowUp', 'w', 'W'] },
    down: { symbol: '↓', label: 'DÓŁ', sub: 'S / DÓŁ', keyCodes: ['KeyS', 'ArrowDown', 's', 'S'] },
    left: { symbol: '←', label: 'LEWO', sub: 'A / LEWO', keyCodes: ['KeyA', 'ArrowLeft', 'a', 'A'] },
    right: { symbol: '→', label: 'PRAWO', sub: 'D / PRAWO', keyCodes: ['KeyD', 'ArrowRight', 'd', 'D'] },
};

const ARROW_KEYS_LIST = ['up', 'down', 'left', 'right'];

let arrowsConfig = { ...ARROWS_PRESETS.normal };
let arrowsState = {
    sequence: [],
    currentIdx: 0,
    stage: 1,
    totalStages: 1,
};

// ─── Init & Setup ─────────────────────────────────────────────────────

function initArrows() {
    arrowsApplyPreset('normal');
    arrowsSetupReady(false);
}

function arrowsApplyPreset(name) {
    const p = ARROWS_PRESETS[name] || ARROWS_PRESETS.normal;
    arrowsConfig = { ...p };
    document.querySelectorAll('#arrows-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const countEl = document.getElementById('arrows-in-count');
    const stagesEl = document.getElementById('arrows-in-stages');
    const timeEl = document.getElementById('arrows-in-time');
    if (countEl) countEl.value = arrowsConfig.count;
    if (stagesEl) stagesEl.value = arrowsConfig.stages;
    if (timeEl) timeEl.value = arrowsConfig.timeleft;
}

function arrowsReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) || def;
    arrowsConfig = {
        count: Math.min(16, Math.max(4, Math.round(v('arrows-in-count', 8)))),
        stages: Math.min(5, Math.max(1, Math.round(v('arrows-in-stages', 1)))),
        timeleft: Math.max(5, v('arrows-in-time', 15)),
    };
}

function arrowsSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        arrowsApplyPreset('normal');
    } else {
        arrowsReadCustomConfig();
    }

    arrowsState = {
        sequence: [],
        currentIdx: 0,
        stage: 1,
        totalStages: arrowsConfig.stages,
    };

    generateArrowsSequence();
    renderArrowsUI();

    // Reset timer display to full
    const textEl = document.getElementById('arrows-timer-text');
    const barEl = document.getElementById('arrows-timer-bar');
    if (textEl) textEl.textContent = arrowsConfig.timeleft.toFixed(1) + 's';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = 'var(--pink)';
    }

    // Toggle button visibility
    const startBtn = document.getElementById('arrows-btn-start');
    const restartBtn = document.getElementById('arrows-btn-restart');
    const configBtn = document.getElementById('arrows-btn-config');
    const hintEl = document.getElementById('arrows-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    showArrowsMsg('<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>', '');
}

function generateArrowsSequence() {
    arrowsState.sequence = [];
    arrowsState.currentIdx = 0;
    for (let i = 0; i < arrowsConfig.count; i++) {
        const randDir = ARROW_KEYS_LIST[Math.floor(Math.random() * ARROW_KEYS_LIST.length)];
        arrowsState.sequence.push(randDir);
    }
}

// ─── Rendering ────────────────────────────────────────────────────────

function renderArrowsUI() {
    // Header tags
    const stageEl = document.getElementById('arrows-stage-badge');
    if (stageEl) stageEl.textContent = `ETAP ${arrowsState.stage}/${arrowsState.totalStages}`;

    // Progress counter
    const progressEl = document.getElementById('arrows-progress-text');
    if (progressEl) progressEl.textContent = `${arrowsState.currentIdx}/${arrowsState.sequence.length}`;

    // Progress bar fill
    const progressBar = document.getElementById('arrows-progress-fill');
    if (progressBar) {
        const pct = arrowsState.sequence.length ? (arrowsState.currentIdx / arrowsState.sequence.length) * 100 : 0;
        progressBar.style.width = `${pct}%`;
    }

    // Render sequence boxes
    const container = document.getElementById('arrows-sequence-box');
    if (!container) return;
    container.innerHTML = '';

    arrowsState.sequence.forEach((dir, i) => {
        const box = document.createElement('div');
        box.className = 'arrows-seq-item';
        box.textContent = ARROW_DIRS[dir].symbol;

        if (i < arrowsState.currentIdx) {
            box.classList.add('done');
        } else if (i === arrowsState.currentIdx) {
            box.classList.add('active');
        } else {
            box.classList.add('future');
        }

        container.appendChild(box);
    });

    // Update active highlight on bottom direction buttons
    const curDir = arrowsState.sequence[arrowsState.currentIdx];
    ARROW_KEYS_LIST.forEach(dir => {
        const btn = document.getElementById(`arrows-btn-${dir}`);
        if (btn) {
            btn.classList.toggle('hint-active', dir === curDir);
        }
    });
}

function showArrowsMsg(text, cls) {
    const el = document.getElementById('arrows-message');
    if (!el) return;
    el.innerHTML = text;
    el.className = `arrows-message ${cls}`;
}

// ─── Input Handling ───────────────────────────────────────────────────

function handleArrowInput(dir) {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'arrows') return;

    // Visual button press feedback
    const btn = document.getElementById(`arrows-btn-${dir}`);
    if (btn) {
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
    }

    const expected = arrowsState.sequence[arrowsState.currentIdx];

    if (dir === expected) {
        // Correct input
        arrowsState.currentIdx++;
        renderArrowsUI();

        if (arrowsState.currentIdx >= arrowsState.sequence.length) {
            // Stage completed!
            arrowsStageComplete();
        }
    } else {
        // Error!
        arrowsFail();
    }
}

function arrowsStageComplete() {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'PAUSED';

    if (arrowsState.stage >= arrowsState.totalStages) {
        showArrowsMsg('SEKWENCJA POPRAWNA! ✅', 'arrows-msg-success');
        sharedState.status = 'WON';

        // Show restart and config buttons
        const startBtn = document.getElementById('arrows-btn-start');
        const restartBtn = document.getElementById('arrows-btn-restart');
        const configBtn = document.getElementById('arrows-btn-config');
        if (startBtn) startBtn.classList.add('hidden');
        if (restartBtn) restartBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
    } else {
        arrowsState.stage++;
        showArrowsMsg(`Etap ${arrowsState.stage - 1} ukończony! Następny etap...`, 'arrows-msg-info');
        setTimeout(() => {
            if (sharedState.currentHack !== 'arrows') return;
            showArrowsMsg('', '');
            generateArrowsSequence();
            renderArrowsUI();
            startArrowsGame(true); // continue next stage
        }, 1000);
    }
}

function arrowsFail() {
    // Flash red
    const container = document.getElementById('arrows-sequence-box');
    if (container) {
        container.classList.add('shake-error');
        setTimeout(() => container.classList.remove('shake-error'), 400);
    }

    showArrowsMsg('BŁĄD! RESETOWANIE SEKWENCJI...', 'arrows-msg-fail');

    // Reset progress to 0
    arrowsState.currentIdx = 0;
    renderArrowsUI();

    setTimeout(() => {
        if (sharedState.currentHack === 'arrows' && sharedState.status === 'PLAYING') {
            showArrowsMsg('', '');
        }
    }, 800);
}

// ─── Flow & Timer ────────────────────────────────────────────────────

function startArrowsGame(skipCountdown = false) {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('arrows-btn-start');
    const restartBtn = document.getElementById('arrows-btn-restart');
    const configBtn = document.getElementById('arrows-btn-config');
    const hintEl = document.getElementById('arrows-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    showArrowsMsg('', '');

    if (skipCountdown) {
        sharedState.status = 'PLAYING';
        startArrowsTimer();
    } else {
        startCountdown(() => {
            if (sharedState.currentHack === 'arrows') {
                sharedState.status = 'PLAYING';
                startArrowsTimer();
            }
        });
    }
}

function startArrowsTimer() {
    const textEl = document.getElementById('arrows-timer-text');
    const barEl = document.getElementById('arrows-timer-bar');
    startGenericTimer(arrowsConfig.timeleft, textEl, barEl, () => {
        sharedState.status = 'GAMEOVER';
        showArrowsMsg('Czas minął! PRZERWANO.', 'arrows-msg-fail');

        const restartBtn = document.getElementById('arrows-btn-restart');
        const configBtn = document.getElementById('arrows-btn-config');
        if (restartBtn) restartBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
    }, (rem, frac) => {
        if (barEl) {
            barEl.style.background = frac > 0.4 ? 'var(--pink)' : frac > 0.2 ? '#f59e0b' : '#ef4444';
        }
    });
}

// ─── Event Wiring ────────────────────────────────────────────────────

function arrowsWireEvents() {
    // Keyboard controls (WASD & Arrows)
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'arrows') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        // Space / Enter to start when in READY mode
        if (sharedState.status === 'READY' && (e.code === 'Space' || e.key === 'Enter')) {
            e.preventDefault();
            startArrowsGame();
            return;
        }

        if (sharedState.status !== 'PLAYING') return;

        const k = e.key.toLowerCase();
        let dir = null;
        if (k === 'w' || e.key === 'ArrowUp') dir = 'up';
        else if (k === 's' || e.key === 'ArrowDown') dir = 'down';
        else if (k === 'a' || e.key === 'ArrowLeft') dir = 'left';
        else if (k === 'd' || e.key === 'ArrowRight') dir = 'right';

        if (dir) {
            e.preventDefault();
            handleArrowInput(dir);
        }
    });

    // Direction button clicks
    ARROW_KEYS_LIST.forEach(dir => {
        const btn = document.getElementById(`arrows-btn-${dir}`);
        if (btn) {
            const trigger = e => {
                e.preventDefault();
                handleArrowInput(dir);
            };
            btn.addEventListener('pointerdown', trigger);
        }
    });

    // Preset buttons
    document.querySelectorAll('#arrows-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            arrowsApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#arrows-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            arrowsSetupReady(true);
        });
    });

    // Inputs — live update in ready mode
    ['arrows-in-count', 'arrows-in-stages', 'arrows-in-time'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#arrows-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            arrowsReadCustomConfig();
            if (sharedState.status === 'READY') {
                arrowsSetupReady(true);
            }
        });
    });

    // Start button
    document.getElementById('arrows-btn-start')?.addEventListener('click', () => {
        arrowsReadCustomConfig();
        startArrowsGame();
    });

    // Restart button
    document.getElementById('arrows-btn-restart')?.addEventListener('click', () => {
        arrowsReadCustomConfig();
        arrowsState.stage = 1;
        generateArrowsSequence();
        renderArrowsUI();
        startArrowsGame();
    });

    // Config button
    document.getElementById('arrows-btn-config')?.addEventListener('click', () => {
        arrowsSetupReady(true);
    });
}
