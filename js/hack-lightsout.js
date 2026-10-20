
const LO_PRESETS = {
    easy: { size: 5, timeleft: 240 },
    normal: { size: 7, timeleft: 180 },
    hard: { size: 9, timeleft: 120 },
};

let loConfig = { ...LO_PRESETS.normal };
let loState = {
    board: [], size: 7
};

// ─── Init & Setup ─────────────────────────────────────────────────────

function initLightsOut() {
    loApplyPreset('normal');
    loSetupReady(false);
}

function loApplyPreset(name) {
    const p = LO_PRESETS[name] || LO_PRESETS.normal;
    loConfig = { ...p };
    document.querySelectorAll('#lo-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const sizeEl = document.getElementById('lo-in-size');
    const timeEl = document.getElementById('lo-in-time');
    if (sizeEl) sizeEl.value = loConfig.size;
    if (timeEl) timeEl.value = loConfig.timeleft;
    const lblEl = document.getElementById('lo-size-label');
    if (lblEl) lblEl.textContent = `${loConfig.size}×${loConfig.size}`;
}

function loReadCustomConfig() {
    const size = parseInt(document.getElementById('lo-in-size')?.value) || 7;
    const time = parseFloat(document.getElementById('lo-in-time')?.value) || 180;
    loConfig = {
        size: Math.min(12, Math.max(3, size)),
        timeleft: time
    };
}

function loSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        loApplyPreset('normal');
    } else {
        loReadCustomConfig();
    }

    loState = { board: [], size: loConfig.size };
    loGenerateBoard();
    loScramble();
    loRenderBoard();
    updateLoStats();

    const textEl = document.getElementById('lo-timer-text');
    const barEl = document.getElementById('lo-timer-bar');
    if (textEl) textEl.textContent = loConfig.timeleft > 0 ? loConfig.timeleft.toFixed(1) + 's' : 'Bez limitu';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#22c55e';
    }

    const startBtn = document.getElementById('lo-btn-start');
    const restartBtn = document.getElementById('lo-btn-restart');
    const configBtn = document.getElementById('lo-btn-config');
    const hintEl = document.getElementById('lo-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    const msgEl = document.getElementById('lo-message');
    if (msgEl) {
        msgEl.innerHTML = '<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>';
        msgEl.className = 'lo-message';
    }
}

function resetLightsOutGame() {
    loSetupReady(true);
    startLightsOutGame();
}

// ─── Board Generation ────────────────────────────────────────────────

function loGenerateBoard() {
    const n = loState.size;
    const el = document.getElementById('lo-board');
    if (!el) return;
    el.innerHTML = '';
    el.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    el.style.gridTemplateRows = `repeat(${n}, 1fr)`;

    loState.board = [];
    for (let r = 0; r < n; r++) {
        loState.board.push([]);
        for (let c = 0; c < n; c++) {
            loState.board[r].push(false);
            const btn = document.createElement('button');
            btn.className = 'lo-cell';
            btn.dataset.r = r;
            btn.dataset.c = c;
            btn.type = 'button';
            btn.addEventListener('click', () => handleLoClick(r, c));
            el.appendChild(btn);
        }
    }
}

function loScramble() {
    const n = loState.size;
    // Simulate random clicks to guarantee solvable state
    for (let i = 0; i < n * n * 2; i++) {
        const r = randomInt(0, n - 1);
        const c = randomInt(0, n - 1);
        loToggle(r, c);
    }
    // Make sure at least a few are on
    const onCount = loCountOn();
    if (onCount === 0) {
        loToggle(0, 0);
        loToggle(n - 1, n - 1);
    }
}

function loToggle(r, c) {
    const n = loState.size;
    const dirs = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    dirs.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
            loState.board[nr][nc] = !loState.board[nr][nc];
        }
    });
}

function loRenderBoard() {
    const n = loState.size;
    const cells = document.querySelectorAll('#lo-board .lo-cell');
    cells.forEach(btn => {
        const r = parseInt(btn.dataset.r);
        const c = parseInt(btn.dataset.c);
        const isOn = loState.board[r]?.[c] === true;
        btn.classList.toggle('on', isOn);
        btn.classList.toggle('lo-on', isOn);
    });
}

function loCountOn() {
    return loState.board.reduce((acc, row) => acc + row.filter(Boolean).length, 0);
}

function updateLoStats() {
    const countEl = document.getElementById('lo-lights-on');
    if (countEl) countEl.textContent = loCountOn();
}

function showLoMsg(text, cls) {
    const el = document.getElementById('lo-message');
    if (!el) return;
    el.innerHTML = text;
    el.className = `lo-message ${cls}`;
}

// ─── Interaction ──────────────────────────────────────────────────────

function handleLoClick(r, c) {
    if (sharedState.currentHack !== 'lightsout') return;
    if (sharedState.status === 'READY') {
        startLightsOutGame();
        return;
    }
    if (sharedState.status !== 'PLAYING') return;

    loToggle(r, c);
    loRenderBoard();
    updateLoStats();

    if (loCountOn() === 0) {
        clearInterval(sharedState.timerInterval);
        sharedState.status = 'WON';
        showLoMsg('WSZYSTKIE LAMPY WYŁĄCZONE! 🎉', 'lo-msg-success');

        const startBtn = document.getElementById('lo-btn-start');
        const restartBtn = document.getElementById('lo-btn-restart');
        const configBtn = document.getElementById('lo-btn-config');
        if (startBtn) startBtn.classList.add('hidden');
        if (restartBtn) restartBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
    }
}

// ─── Flow ────────────────────────────────────────────────────────────

function startLightsOutGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('lo-btn-start');
    const restartBtn = document.getElementById('lo-btn-restart');
    const configBtn = document.getElementById('lo-btn-config');
    const hintEl = document.getElementById('lo-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    const msgEl = document.getElementById('lo-message');
    if (msgEl) {
        msgEl.innerHTML = '';
        msgEl.className = 'lo-message';
    }

    startCountdown(() => {
        if (sharedState.currentHack === 'lightsout') {
            sharedState.status = 'PLAYING';
            if (loConfig.timeleft > 0) startLoTimer();
        }
    });
}

function startLoTimer() {
    const textEl = document.getElementById('lo-timer-text');
    const barEl = document.getElementById('lo-timer-bar');
    startGenericTimer(loConfig.timeleft, textEl, barEl, () => {
        sharedState.status = 'GAMEOVER';
        showLoMsg('Czas minął! PRZERWANO.', 'lo-msg-fail');

        const restartBtn = document.getElementById('lo-btn-restart');
        const configBtn = document.getElementById('lo-btn-config');
        if (restartBtn) restartBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
    }, (rem, frac) => {
        if (barEl) barEl.style.background = frac > 0.4 ? '#10b981' : frac > 0.2 ? '#f59e0b' : '#ef4444';
    });
}

// ─── Event wiring ────────────────────────────────────────────────────

function loWireEvents() {
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'lightsout') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && e.key === 'Enter') {
            e.preventDefault();
            startLightsOutGame();
        }
    });

    document.querySelectorAll('#lo-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            loApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#lo-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            loSetupReady(true);
        });
    });

    ['lo-in-size', 'lo-in-time'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#lo-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            loReadCustomConfig();
            if (sharedState.status === 'READY') {
                loSetupReady(true);
            }
        });
    });

    document.getElementById('lo-btn-start')?.addEventListener('click', () => {
        loReadCustomConfig();
        startLightsOutGame();
    });

    document.getElementById('lo-btn-restart')?.addEventListener('click', () => {
        loReadCustomConfig();
        resetLightsOutGame();
    });

    document.getElementById('lo-btn-config')?.addEventListener('click', () => {
        loSetupReady(true);
    });

    document.getElementById('lo-btn-clear')?.addEventListener('click', () => {
        if (sharedState.currentHack !== 'lightsout') return;
        loState.board.forEach(row => row.fill(false));
        loRenderBoard();
        updateLoStats();
    });

    document.getElementById('lo-btn-randomize')?.addEventListener('click', () => {
        if (sharedState.currentHack !== 'lightsout') return;
        loReadCustomConfig();
        loState.board.forEach(row => row.fill(false));
        loScramble();
        loRenderBoard();
        updateLoStats();
    });
}
