// ════════════════════════════════════════════════════════════════════════
// HACK: PROTOKÓŁ WŁAMANIA (Cyberpunk Breach Protocol)
// ════════════════════════════════════════════════════════════════════════

const BREACH_HEX_POOL = ['7A', 'FF', 'A0', '3D', '91', '1C', 'C2', 'BD', 'E9', '55'];

const BREACH_PRESETS = {
    easy:   { size: 5, seqLen: 4, maxErrors: 3, timeleft: 60 },
    normal: { size: 6, seqLen: 5, maxErrors: 2, timeleft: 45 },
    hard:   { size: 7, seqLen: 6, maxErrors: 1, timeleft: 30 },
};

let breachConfig = { ...BREACH_PRESETS.hard };
let breachState = {
    grid: [],          // [r][c] -> { hex, used, r, c }
    size: 7,
    sequence: [],      // array of hex strings
    matchedCount: 0,
    axis: 'any',       // 'any' | 'col' | 'row'
    lastPick: null,    // { r, c }
    errors: 0,
    stage: 1,
    totalStages: 1,
};

// ─── Init & Setup ─────────────────────────────────────────────────────

function initBreach() {
    breachApplyPreset('hard');
    breachSetupReady(false);
}

function breachApplyPreset(name) {
    const p = BREACH_PRESETS[name] || BREACH_PRESETS.hard;
    breachConfig = { ...p };
    document.querySelectorAll('#breach-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const sizeEl = document.getElementById('breach-in-size');
    const seqEl = document.getElementById('breach-in-seq');
    const errEl = document.getElementById('breach-in-errors');
    const timeEl = document.getElementById('breach-in-time');
    if (sizeEl) sizeEl.value = breachConfig.size;
    if (seqEl) seqEl.value = breachConfig.seqLen;
    if (errEl) errEl.value = breachConfig.maxErrors;
    if (timeEl) timeEl.value = breachConfig.timeleft;
}

function breachReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) || def;
    breachConfig = {
        size: Math.min(8, Math.max(4, Math.round(v('breach-in-size', 7)))),
        seqLen: Math.min(8, Math.max(3, Math.round(v('breach-in-seq', 6)))),
        maxErrors: Math.min(5, Math.max(0, Math.round(v('breach-in-errors', 1)))),
        timeleft: Math.max(10, v('breach-in-time', 30)),
    };
}

function breachSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        breachApplyPreset('hard');
    } else {
        breachReadCustomConfig();
    }

    breachState = {
        grid: [],
        size: breachConfig.size,
        sequence: [],
        matchedCount: 0,
        axis: 'any',
        lastPick: null,
        errors: 0,
        stage: 1,
        totalStages: 1,
    };

    generateBreachPuzzle();
    renderBreachBoard();
    renderBreachSequence();
    updateBreachStats();

    // Reset timer display
    const textEl = document.getElementById('breach-timer-text');
    const barEl = document.getElementById('breach-timer-bar');
    if (textEl) textEl.textContent = breachConfig.timeleft.toFixed(1) + 's';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#10b981';
    }

    // Toggle button visibility
    const startBtn = document.getElementById('breach-btn-start');
    const restartBtn = document.getElementById('breach-btn-restart');
    const configBtn = document.getElementById('breach-btn-config');
    const hintEl = document.getElementById('breach-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    showBreachMsg('<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>', '');
}

// ─── Solvable Generation ──────────────────────────────────────────────

function generateBreachPuzzle() {
    const n = breachState.size;
    const pool = BREACH_HEX_POOL;

    // 1. Fill random grid
    breachState.grid = [];
    for (let r = 0; r < n; r++) {
        breachState.grid.push([]);
        for (let c = 0; c < n; c++) {
            const hex = pool[Math.floor(Math.random() * pool.length)];
            breachState.grid[r].push({ hex, used: false, r, c });
        }
    }

    // 2. Generate guaranteed path
    let pathFound = false;
    let attempts = 0;

    while (!pathFound && attempts < 100) {
        attempts++;
        const path = [];
        const visited = new Set();

        // Start anywhere
        let curR = Math.floor(Math.random() * n);
        let curC = Math.floor(Math.random() * n);
        path.push({ r: curR, c: curC, hex: breachState.grid[curR][curC].hex });
        visited.add(`${curR},${curC}`);

        let curAxis = 'col'; // next must pick in same column

        for (let step = 1; step < breachConfig.seqLen; step++) {
            const candidates = [];
            if (curAxis === 'col') {
                for (let r = 0; r < n; r++) {
                    if (r !== curR && !visited.has(`${r},${curC}`)) {
                        candidates.push({ r, c: curC });
                    }
                }
            } else {
                for (let c = 0; c < n; c++) {
                    if (c !== curC && !visited.has(`${curR},${c}`)) {
                        candidates.push({ r: curR, c });
                    }
                }
            }

            if (candidates.length === 0) break; // dead end, retry

            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            curR = pick.r;
            curC = pick.c;
            path.push({ r: curR, c: curC, hex: breachState.grid[curR][curC].hex });
            visited.add(`${curR},${curC}`);
            curAxis = (curAxis === 'col') ? 'row' : 'col';
        }

        if (path.length === breachConfig.seqLen) {
            breachState.sequence = path.map(p => p.hex);
            pathFound = true;
        }
    }

    // Fallback if loop timed out
    if (!pathFound) {
        breachState.sequence = Array.from({ length: breachConfig.seqLen }, () => pool[Math.floor(Math.random() * pool.length)]);
    }
}

// ─── Rendering ────────────────────────────────────────────────────────

function renderBreachBoard() {
    const boardEl = document.getElementById('breach-grid');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const n = breachState.size;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

    const isPlaying = sharedState.status === 'PLAYING';
    const isReady = sharedState.status === 'READY';

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const cellData = breachState.grid[r][c];
            const btn = document.createElement('button');
            btn.className = 'breach-cell';
            btn.textContent = cellData.hex;
            btn.dataset.r = r;
            btn.dataset.c = c;

            // Highlight eligibility
            if (cellData.used) {
                btn.classList.add('used');
            } else if (isPlaying) {
                if (breachState.axis === 'any') {
                    btn.classList.add('eligible');
                } else if (breachState.axis === 'col' && c === breachState.lastPick.c) {
                    btn.classList.add('eligible');
                } else if (breachState.axis === 'row' && r === breachState.lastPick.r) {
                    btn.classList.add('eligible');
                }
            } else if (isReady) {
                btn.classList.add('eligible'); // preview all selectable
            }

            btn.addEventListener('click', () => handleBreachCellClick(r, c));
            boardEl.appendChild(btn);
        }
    }

    const badgeEl = document.getElementById('breach-size-badge');
    if (badgeEl) badgeEl.textContent = `${n}X${n}`;
}

function renderBreachSequence() {
    const listEl = document.getElementById('breach-seq-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    breachState.sequence.forEach((hex, i) => {
        const item = document.createElement('div');
        item.className = 'breach-seq-item';

        if (i < breachState.matchedCount) {
            item.classList.add('matched');
        } else if (i === breachState.matchedCount && (sharedState.status === 'PLAYING' || sharedState.status === 'READY')) {
            item.classList.add('active');
        }

        const stepNum = String(i + 1).padStart(2, '0');
        item.innerHTML = `
            <span class="breach-seq-num">${stepNum}</span>
            <span class="breach-seq-hex">${hex}</span>
        `;
        listEl.appendChild(item);
    });
}

function updateBreachStats() {
    const axisEl = document.getElementById('breach-axis-val');
    if (axisEl) {
        if (breachState.axis === 'any') axisEl.textContent = 'DOWOLNE';
        else if (breachState.axis === 'col') axisEl.textContent = `KOLUMNA ${breachState.lastPick.c + 1}`;
        else if (breachState.axis === 'row') axisEl.textContent = `WIERSZ ${breachState.lastPick.r + 1}`;
    }

    const errEl = document.getElementById('breach-errors-val');
    if (errEl) {
        errEl.textContent = breachState.errors;
    }
}

function showBreachMsg(text, cls) {
    const el = document.getElementById('breach-message');
    if (!el) return;
    el.innerHTML = text;
    el.className = `breach-message ${cls}`;
}

// ─── Interaction ──────────────────────────────────────────────────────

function handleBreachCellClick(r, c) {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'breach') return;

    const cell = breachState.grid[r][c];
    if (cell.used) return;

    // Check axis eligibility
    if (breachState.axis === 'col' && c !== breachState.lastPick.c) return;
    if (breachState.axis === 'row' && r !== breachState.lastPick.r) return;

    // Mark as used
    cell.used = true;
    breachState.lastPick = { r, c };

    // Toggle alternating axis
    if (breachState.axis === 'any') {
        breachState.axis = 'col'; // next must be in this column
    } else if (breachState.axis === 'col') {
        breachState.axis = 'row'; // next must be in this row
    } else {
        breachState.axis = 'col';
    }

    // Check if match target sequence
    const expectedHex = breachState.sequence[breachState.matchedCount];

    if (cell.hex === expectedHex) {
        // Correct step!
        breachState.matchedCount++;
        renderBreachBoard();
        renderBreachSequence();
        updateBreachStats();

        if (breachState.matchedCount >= breachState.sequence.length) {
            // Solved!
            breachVictory();
        }
    } else {
        // Mismatch!
        breachState.errors++;
        updateBreachStats();
        renderBreachBoard();

        if (breachState.errors > breachConfig.maxErrors) {
            breachGameOver('PRZEKROCZONO LIMIT BŁĘDÓW! PROTOKÓŁ ZABLOKOWANY');
        } else {
            showBreachMsg(`BŁĄD! Wybrano ${cell.hex} zamiast ${expectedHex} (pozostało ${breachConfig.maxErrors - breachState.errors + 1})`, 'breach-msg-fail');
            setTimeout(() => {
                if (sharedState.status === 'PLAYING') showBreachMsg('', '');
            }, 1200);
        }
    }
}

function breachVictory() {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'WON';
    renderBreachBoard();
    renderBreachSequence();
    showBreachMsg('PROTOKÓŁ ZAŁADOWANY! DOSTĘP PRZYZNANY 🔓', 'breach-msg-success');

    const startBtn = document.getElementById('breach-btn-start');
    const restartBtn = document.getElementById('breach-btn-restart');
    const configBtn = document.getElementById('breach-btn-config');
    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
}

function breachGameOver(msg) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'GAMEOVER';
    renderBreachBoard();
    showBreachMsg(msg, 'breach-msg-fail');

    const restartBtn = document.getElementById('breach-btn-restart');
    const configBtn = document.getElementById('breach-btn-config');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
}

// ─── Flow & Timer ────────────────────────────────────────────────────

function startBreachGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('breach-btn-start');
    const restartBtn = document.getElementById('breach-btn-restart');
    const configBtn = document.getElementById('breach-btn-config');
    const hintEl = document.getElementById('breach-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    showBreachMsg('', '');

    startCountdown(() => {
        if (sharedState.currentHack === 'breach') {
            sharedState.status = 'PLAYING';
            renderBreachBoard();
            startBreachTimer();
        }
    });
}

function startBreachTimer() {
    const textEl = document.getElementById('breach-timer-text');
    const barEl = document.getElementById('breach-timer-bar');
    startGenericTimer(breachConfig.timeleft, textEl, barEl, () => {
        breachGameOver('CZAS MINĄŁ! PROTOKÓŁ PRZERWANY');
    }, (rem, frac) => {
        if (barEl) {
            barEl.style.background = frac > 0.4 ? '#10b981' : frac > 0.2 ? '#f59e0b' : '#ef4444';
        }
    });
}

// ─── Event Wiring ────────────────────────────────────────────────────

function breachWireEvents() {
    // ESC key / button
    const handleEsc = () => {
        if (sharedState.currentHack !== 'breach') return;
        breachSetupReady(true);
    };

    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'breach') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        // Space / Enter to start when in READY mode
        if (sharedState.status === 'READY' && (e.code === 'Space' || e.key === 'Enter')) {
            e.preventDefault();
            startBreachGame();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            handleEsc();
        }
    });

    document.getElementById('breach-btn-esc')?.addEventListener('click', handleEsc);

    // Preset buttons
    document.querySelectorAll('#breach-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            breachApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#breach-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            breachSetupReady(true);
        });
    });

    // Inputs — live update matrix & sequence in ready mode
    ['breach-in-size', 'breach-in-seq', 'breach-in-errors', 'breach-in-time'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#breach-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            breachReadCustomConfig();
            if (sharedState.status === 'READY') {
                breachSetupReady(true);
            }
        });
    });

    // Start button
    document.getElementById('breach-btn-start')?.addEventListener('click', () => {
        breachReadCustomConfig();
        startBreachGame();
    });

    // Restart button
    document.getElementById('breach-btn-restart')?.addEventListener('click', () => {
        breachReadCustomConfig();
        breachState.matchedCount = 0;
        breachState.errors = 0;
        breachState.axis = 'any';
        breachState.lastPick = null;
        generateBreachPuzzle();
        renderBreachBoard();
        renderBreachSequence();
        updateBreachStats();
        startBreachGame();
    });

    // Config button
    document.getElementById('breach-btn-config')?.addEventListener('click', () => {
        breachSetupReady(true);
    });
}
