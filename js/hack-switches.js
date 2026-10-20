// ══════════════════════════════════════════════════════════════════
//  SKRZYNKA ELEKTRYCZNA  —  Switches hack
//  Two modes:
//    CEL MATEM.  – toggle switches so their sum equals target
//    SEKWENCJA   – flip switches in the correct order
// ══════════════════════════════════════════════════════════════════

const SW_PRESETS = {
    easy:   { switchCount: 4, valueMin: 1, valueMax: 5,  steps: 3, timeLimit: 120 },
    normal: { switchCount: 6, valueMin: 1, valueMax: 10, steps: 5, timeLimit: 90  },
    hard:   { switchCount: 6, valueMin: 3, valueMax: 15, steps: 7, timeLimit: 60  },
};

let swConfig = { ...SW_PRESETS.normal };
let swState = {
    // mode is per-step — read via swCurrentMode()
    switches: [],
    target: 0,
    steps: [],          // each entry: { mode, vals, target?, solution?, seqClicks? }
    currentStep: 0,
    totalSteps: 0,
    faults: 0,
    seqProgress: 0,     // how many clicks the player has matched so far
    showing: false,     // true while Simon is playing the pattern back
};

// Returns the mode of the current step ('math' | 'sequence')
function swCurrentMode() {
    return swState.steps[swState.currentStep]?.mode || 'math';
}

// Randomly pick 'math' or 'sequence'
function swRandomMode() {
    return Math.random() < 0.5 ? 'math' : 'sequence';
}

function initSwitches() {
    swApplyPreset('normal');
    swSetupReady(false);
}

function swApplyPreset(name) {
    const p = SW_PRESETS[name] || SW_PRESETS.normal;
    swConfig = { ...p };
    document.querySelectorAll('#sw-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const els = {
        'sw-in-count':  swConfig.switchCount,
        'sw-in-valmin': swConfig.valueMin,
        'sw-in-valmax': swConfig.valueMax,
        'sw-in-steps':  swConfig.steps,
        'sw-in-time':   swConfig.timeLimit,
    };
    Object.entries(els).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

function swReadConfig() {
    swConfig = {
        switchCount: Math.min(8, Math.max(2, parseInt(document.getElementById('sw-in-count')?.value) || 6)),
        valueMin:    Math.max(1, parseInt(document.getElementById('sw-in-valmin')?.value) || 1),
        valueMax:    Math.max(2, parseInt(document.getElementById('sw-in-valmax')?.value) || 10),
        steps:       Math.min(10, Math.max(1, parseInt(document.getElementById('sw-in-steps')?.value) || 5)),
        timeLimit:   Math.max(0, parseFloat(document.getElementById('sw-in-time')?.value) || 90),
    };
    if (swConfig.valueMin > swConfig.valueMax) swConfig.valueMin = swConfig.valueMax - 1;
}

function swSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';
    if (!keepConfig) swApplyPreset('normal');
    else swReadConfig();
    swState.faults = 0;
    swState.currentStep = 0;
    swGenerateSwitches();
    swGenerateAllSteps();   // mixed random modes per step
    swRenderSwitches();
    swUpdateUI();
    const timeEl = document.getElementById('sw-timer-text');
    const barEl  = document.getElementById('sw-timer-bar');
    if (timeEl) timeEl.textContent = swConfig.timeLimit > 0 ? swConfig.timeLimit.toFixed(1) + 's' : 'Bez limitu';
    if (barEl)  { barEl.style.width = '100%'; barEl.style.background = '#22c55e'; }
    document.getElementById('sw-btn-start')?.classList.remove('hidden');
    document.getElementById('sw-btn-restart')?.classList.add('hidden');
    document.getElementById('sw-btn-config')?.classList.add('hidden');
    document.getElementById('sw-ready-hint')?.classList.remove('hidden');
    swShowMessage('<span class="ready-status-banner">&#9889; TRYB KONFIGURACJI &middot; Kliknij Rozpocznij lub wcisnij SPACJE / ENTER</span>', '');
}

function swGenerateSwitches() {
    const n = swConfig.switchCount;
    swState.switches = [];
    for (let i = 0; i < n; i++) {
        swState.switches.push({ id: i, value: randomInt(swConfig.valueMin, swConfig.valueMax), on: false });
    }
}

// Generate ALL steps at once, each with a randomly chosen mode
function swGenerateAllSteps() {
    const steps = [];
    for (let s = 0; s < swConfig.steps; s++) {
        const mode = swRandomMode();
        const vals = swState.switches.map(() => randomInt(swConfig.valueMin, swConfig.valueMax));
        if (mode === 'math') {
            let subset;
            do {
                subset = swState.switches.map((_, i) => Math.random() > 0.5 ? i : -1).filter(i => i >= 0);
            } while (subset.length === 0);
            const target = subset.reduce((acc, i) => acc + vals[i], 0);
            steps.push({ mode, vals, target, solution: subset });
        } else {
            // Simon sequence: 4–6 random clicks, switches CAN repeat
            const seqLen    = randomInt(4, 6);
            const seqClicks = Array.from({ length: seqLen }, () =>
                randomInt(0, swState.switches.length - 1)
            );
            steps.push({ mode, vals, seqClicks });
        }
    }
    swState.steps = steps;
    swState.totalSteps = steps.length;
    swLoadStep(0);
}

// Load a step (resets switch state and prepares seq progress)
function swLoadStep(idx) {
    const step = swState.steps[idx];
    if (!step) return;
    swState.switches.forEach((sw, i) => { sw.value = step.vals[i]; sw.on = false; });
    swState.target      = step.target ?? 0;
    swState.seqProgress = 0;
    swState.showing     = false;
    // For sequence steps: play the Simon pattern after a short delay
    if (step.mode === 'sequence' && sharedState.status === 'PLAYING') {
        swState.showing = true;
        swShowMessage('&#128064; Obserwuj sekwencję!', 'sw-msg-info');
        setTimeout(() => swPlaySimonSequence(step.seqClicks), 600);
    }
}

function swRenderSwitches() {
    const grid = document.getElementById('sw-grid');
    if (!grid) return;
    grid.innerHTML = '';
    swState.switches.forEach((sw, i) => {
        const card = document.createElement('div');
        card.className = 'sw-card' + (sw.on ? ' sw-on' : '');
        card.id = 'sw-card-' + i;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'sw-label';
        const swIdSpan = document.createElement('span');
        swIdSpan.className = 'sw-id';
        swIdSpan.textContent = 'S' + (i + 1);
        const swBadge = document.createElement('span');
        swBadge.className = 'sw-badge';
        swBadge.textContent = (i + 1);
        labelDiv.appendChild(swIdSpan);
        labelDiv.appendChild(swBadge);

        const valRowDiv = document.createElement('div');
        valRowDiv.className = 'sw-val-row';
        const valLabel = document.createElement('span');
        valLabel.className = 'sw-val-label';
        valLabel.textContent = 'WARTOSC';
        valRowDiv.appendChild(valLabel);

        const valNum = document.createElement('div');
        valNum.className = 'sw-val-num';
        valNum.id = 'sw-val-' + i;
        valNum.textContent = sw.value;

        const toggle = document.createElement('button');
        toggle.className = 'sw-toggle' + (sw.on ? ' sw-toggle-on' : '');
        toggle.id = 'sw-toggle-' + i;
        toggle.setAttribute('aria-label', 'Switch S' + (i + 1));
        const thumb = document.createElement('span');
        thumb.className = 'sw-thumb';
        toggle.appendChild(thumb);
        toggle.addEventListener('click', () => swHandleToggle(i));

        card.appendChild(labelDiv);
        card.appendChild(valRowDiv);
        card.appendChild(valNum);
        card.appendChild(toggle);
        grid.appendChild(card);
    });
}

// ─── Simon playback ──────────────────────────────────────────────
// Flashes each card in seqClicks one by one, then unlocks input.
function swPlaySimonSequence(seqClicks) {
    if (sharedState.currentHack !== 'switches') return;
    const FLASH_ON  = 500;   // ms card stays highlighted
    const FLASH_GAP = 250;   // ms gap between flashes
    const STEP_DUR  = FLASH_ON + FLASH_GAP;

    seqClicks.forEach((switchIdx, pos) => {
        // Light up
        setTimeout(() => {
            if (sharedState.currentHack !== 'switches') return;
            const card   = document.getElementById('sw-card-' + switchIdx);
            const toggle = document.getElementById('sw-toggle-' + switchIdx);
            if (card)   card.classList.add('sw-simon-show');
            if (toggle) toggle.classList.add('sw-toggle-on');
        }, pos * STEP_DUR);
        // Light off
        setTimeout(() => {
            if (sharedState.currentHack !== 'switches') return;
            const card   = document.getElementById('sw-card-' + switchIdx);
            const toggle = document.getElementById('sw-toggle-' + switchIdx);
            if (card)   card.classList.remove('sw-simon-show');
            if (toggle) toggle.classList.remove('sw-toggle-on');
        }, pos * STEP_DUR + FLASH_ON);
    });

    // After all flashes: unlock player input
    setTimeout(() => {
        if (sharedState.currentHack !== 'switches') return;
        swState.showing = false;
        swShowMessage('&#9989; Twoja kolej! Powtórz sekwencję.', 'sw-msg-info');
        swUpdateUI();
    }, seqClicks.length * STEP_DUR + 100);
}

function swUpdateSwitchVisual(i) {
    const sw = swState.switches[i];
    const card   = document.getElementById('sw-card-' + i);
    const toggle = document.getElementById('sw-toggle-' + i);
    const valEl  = document.getElementById('sw-val-' + i);
    if (card)   card.classList.toggle('sw-on', sw.on);
    if (toggle) toggle.classList.toggle('sw-toggle-on', sw.on);
    if (valEl)  valEl.textContent = sw.value;
}

function swUpdateUI() {
    const mode    = swCurrentMode();
    const stepEl  = document.getElementById('sw-step');
    const faultEl = document.getElementById('sw-faults');
    const modeEl  = document.getElementById('sw-mode-label');
    const targetEl = document.getElementById('sw-target');
    const resultEl = document.getElementById('sw-result');
    if (stepEl)  stepEl.textContent  = (swState.currentStep + 1) + '/' + swState.totalSteps;
    if (faultEl) faultEl.textContent = swState.faults;
    if (modeEl) {
        const newText  = mode === 'math' ? 'CEL MATEM.' : 'SEKWENCJA';
        const newColor = mode === 'math' ? 'var(--pink)' : '#22d3ee';
        if (modeEl.textContent !== newText) {
            modeEl.classList.add('sw-mode-flash');
            setTimeout(() => modeEl.classList.remove('sw-mode-flash'), 600);
        }
        modeEl.textContent = newText;
        modeEl.style.color = newColor;
    }
    if (mode === 'math') {
        if (targetEl) targetEl.textContent = swState.target;
        if (resultEl) {
            const sum = swState.switches.filter(s => s.on).reduce((a, s) => a + s.value, 0);
            resultEl.textContent = sum;
            resultEl.style.color = sum === swState.target ? 'var(--success)' : 'var(--text)';
        }
        document.getElementById('sw-target-row')?.classList.remove('hidden');
        document.getElementById('sw-result-row')?.classList.remove('hidden');
        document.getElementById('sw-set-btn')?.classList.remove('hidden');
    } else {
        // Sequence (Simon) mode
        const step      = swState.steps[swState.currentStep];
        const seqClicks = step?.seqClicks || [];
        const done      = swState.seqProgress;
        const total     = seqClicks.length;
        if (targetEl) targetEl.textContent = swState.showing ? '?' : (done + 1) + '/' + total;
        if (resultEl) {
            resultEl.innerHTML = '';
            seqClicks.forEach((_, pos) => {
                const sp = document.createElement('span');
                if (pos < done) {
                    sp.style.color = 'var(--success)';
                    sp.textContent = '\u2713';
                } else if (pos === done && !swState.showing) {
                    sp.style.color = '#facc15';
                    sp.textContent = '\u25cf';   // current target dot
                } else {
                    sp.style.color = 'var(--border2)';
                    sp.textContent = '\u2014';
                }
                resultEl.appendChild(sp);
                if (pos < seqClicks.length - 1) resultEl.append(' ');
            });
        }
        document.getElementById('sw-target-row')?.classList.remove('hidden');
        document.getElementById('sw-result-row')?.classList.remove('hidden');
        document.getElementById('sw-set-btn')?.classList.add('hidden');
    }
}

function swHandleToggle(i) {
    if (sharedState.currentHack !== 'switches') return;
    if (sharedState.status === 'READY') { startSwitchesGame(); return; }
    if (sharedState.status !== 'PLAYING') return;
    if (swState.showing) return;   // block input during Simon playback
    const sw   = swState.switches[i];
    const mode = swCurrentMode();
    if (mode === 'math') {
        sw.on = !sw.on;
        swUpdateSwitchVisual(i);
        swUpdateUI();
    } else {
        // Simon sequence input
        const step      = swState.steps[swState.currentStep];
        const seqClicks = step.seqClicks;
        const nextIdx   = swState.seqProgress;
        if (nextIdx >= seqClicks.length) return;
        if (seqClicks[nextIdx] === i) {
            // Correct! Flash the card green briefly
            swState.seqProgress++;
            const card = document.getElementById('sw-card-' + i);
            if (card) {
                card.classList.add('sw-flash-ok');
                setTimeout(() => card.classList.remove('sw-flash-ok'), 350);
            }
            swUpdateUI();
            if (swState.seqProgress === seqClicks.length) {
                // All clicks matched
                setTimeout(() => swAdvanceStep(), 350);
            }
        } else {
            // Wrong switch
            swState.faults++;
            swUpdateUI();
            const card = document.getElementById('sw-card-' + i);
            if (card) { card.classList.add('sw-flash-err'); setTimeout(() => card.classList.remove('sw-flash-err'), 400); }
            swShowMessage('Błąd! Resetuję sekwencję…', 'sw-msg-fail');
            // Reset progress and replay the sequence
            setTimeout(() => {
                if (sharedState.currentHack !== 'switches' || sharedState.status !== 'PLAYING') return;
                swState.seqProgress = 0;
                swState.showing = true;
                // Reset all switch visuals
                swState.switches.forEach((s, idx) => { s.on = false; swUpdateSwitchVisual(idx); });
                swShowMessage('&#128064; Obserwuj sekwencję!', 'sw-msg-info');
                setTimeout(() => swPlaySimonSequence(seqClicks), 400);
            }, 600);
        }
    }
}

function swHandleSetSwitches() {
    if (sharedState.currentHack !== 'switches') return;
    if (sharedState.status !== 'PLAYING') return;
    if (swCurrentMode() !== 'math') return;
    const sum = swState.switches.filter(s => s.on).reduce((a, s) => a + s.value, 0);
    if (sum === swState.target) {
        swAdvanceStep();
    } else {
        swState.faults++;
        swUpdateUI();
        const btn = document.getElementById('sw-set-btn');
        if (btn) { btn.classList.add('sw-btn-shake'); setTimeout(() => btn.classList.remove('sw-btn-shake'), 500); }
        swShowMessage('Suma ' + sum + ' nie rowna sie ' + swState.target, 'sw-msg-fail');
        setTimeout(() => swShowMessage('', ''), 900);
    }
}

function swAdvanceStep() {
    swState.currentStep++;
    if (swState.currentStep >= swState.totalSteps) { swWin(); return; }
    swLoadStep(swState.currentStep);
    swRenderSwitches();
    swUpdateUI();
    // Only show the 'next step' message if it's not a sequence (which shows its own)
    const nextMode = swCurrentMode();
    if (nextMode === 'math') {
        swShowMessage('DOBRA ROBOTA! Nastepny etap...', 'sw-msg-success');
        setTimeout(() => swShowMessage('', ''), 700);
    }
}

function swWin() {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'WON';
    swShowMessage('OBWOD ZAAKCEPTOWANY!', 'sw-msg-success');
    document.getElementById('sw-btn-restart')?.classList.remove('hidden');
    document.getElementById('sw-btn-config')?.classList.remove('hidden');
    document.getElementById('sw-btn-start')?.classList.add('hidden');
    document.getElementById('sw-ready-hint')?.classList.add('hidden');
    document.querySelectorAll('.sw-card').forEach(c => {
        c.classList.add('sw-flash-ok');
        setTimeout(() => c.classList.remove('sw-flash-ok'), 600);
    });
}

function swLose() {
    sharedState.status = 'GAMEOVER';
    swShowMessage('Czas minal! AWARIA OBWODU.', 'sw-msg-fail');
    document.getElementById('sw-btn-restart')?.classList.remove('hidden');
    document.getElementById('sw-btn-config')?.classList.remove('hidden');
    document.getElementById('sw-btn-start')?.classList.add('hidden');
}

function startSwitchesGame() {
    if (sharedState.status === 'PREPARING') return;
    swReadConfig();
    document.getElementById('sw-btn-start')?.classList.add('hidden');
    document.getElementById('sw-btn-restart')?.classList.remove('hidden');
    document.getElementById('sw-btn-config')?.classList.remove('hidden');
    document.getElementById('sw-ready-hint')?.classList.add('hidden');
    swShowMessage('', '');
    startCountdown(() => {
        if (sharedState.currentHack !== 'switches') return;
        sharedState.status = 'PLAYING';
        if (swConfig.timeLimit > 0) swStartTimer();
    });
}

function swStartTimer() {
    const textEl = document.getElementById('sw-timer-text');
    const barEl  = document.getElementById('sw-timer-bar');
    startGenericTimer(swConfig.timeLimit, textEl, barEl, () => {
        swLose();
    }, (rem, frac) => {
        if (barEl) barEl.style.background = frac > 0.4 ? '#22c55e' : frac > 0.2 ? '#f59e0b' : '#ef4444';
    });
}

function resetSwitchesGame() {
    swReadConfig();
    swSetupReady(true);
    startSwitchesGame();
}

function swShowMessage(html, cls) {
    const el = document.getElementById('sw-message');
    if (!el) return;
    el.innerHTML = html;
    el.className = 'sw-message ' + cls;
}

function switchesWireEvents() {
    document.querySelectorAll('#sw-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            swApplyPreset(btn.dataset.preset);
            if (sharedState.currentHack === 'switches' && sharedState.status === 'READY') swSetupReady(true);
        });
    });
    ['sw-in-count','sw-in-valmin','sw-in-valmax','sw-in-steps','sw-in-time'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#sw-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            if (sharedState.currentHack === 'switches' && sharedState.status === 'READY') swSetupReady(true);
        });
    });
    // mode-select removed — mode is now randomised per step automatically
    document.getElementById('sw-btn-start')?.addEventListener('click', () => {
        swReadConfig(); swSetupReady(true); startSwitchesGame();
    });
    document.getElementById('sw-btn-restart')?.addEventListener('click', () => resetSwitchesGame());
    document.getElementById('sw-btn-config')?.addEventListener('click', () => swSetupReady(true));
    document.getElementById('sw-set-btn')?.addEventListener('click', () => swHandleSetSwitches());
}
