
const PUZZLE_PRESETS = {
    easy: { size: 3, timeleft: 180 },
    normal: { size: 4, timeleft: 120 },
    hard: { size: 5, timeleft: 60 },
};

let puzzleConfig = { ...PUZZLE_PRESETS.normal, controlMode: 'tile' };
let puzzleState = {
    board: [], size: 4, moves: 0, startTime: 0, timerGoing: false
};

// ─── Init & Setup ─────────────────────────────────────────────────────

function initPuzzle() {
    puzzleApplyPreset('normal');
    puzzleSetupReady(false);
}

function puzzleApplyPreset(name) {
    const p = PUZZLE_PRESETS[name] || PUZZLE_PRESETS.normal;
    const mode = puzzleConfig.controlMode || 'tile';
    puzzleConfig = { ...p, controlMode: mode };
    document.querySelectorAll('#puzzle-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const timeEl = document.getElementById('puzzle-in-time');
    if (timeEl) timeEl.value = puzzleConfig.timeleft;
    const lblEl = document.getElementById('puzzle-size-label');
    if (lblEl) lblEl.textContent = `${puzzleConfig.size}×${puzzleConfig.size}`;
    const modeEl = document.getElementById('puzzle-in-mode');
    if (modeEl) modeEl.value = puzzleConfig.controlMode;
}

function puzzleReadCustomConfig() {
    const time = parseFloat(document.getElementById('puzzle-in-time')?.value) || 120;
    const modeEl = document.getElementById('puzzle-in-mode');
    if (modeEl) puzzleConfig.controlMode = modeEl.value;
    puzzleConfig.timeleft = time;
}

function puzzleSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        puzzleApplyPreset('normal');
    } else {
        puzzleReadCustomConfig();
    }

    puzzleState = { board: [], size: puzzleConfig.size, moves: 0, startTime: 0, timerGoing: false };
    scramblePuzzle();
    renderPuzzleBoard();

    // Reset timer display
    const textEl = document.getElementById('puzzle-timer-text');
    const barEl = document.getElementById('puzzle-timer-bar');
    if (textEl) textEl.textContent = puzzleConfig.timeleft > 0 ? puzzleConfig.timeleft.toFixed(1) + 's' : 'Bez limitu';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#14b8a6';
    }

    const movesEl = document.getElementById('puzzle-moves');
    if (movesEl) movesEl.textContent = '0';

    // Toggle button visibility
    const startBtn = document.getElementById('puzzle-btn-start');
    const restartBtn = document.getElementById('puzzle-btn-restart');
    const configBtn = document.getElementById('puzzle-btn-config');
    const hintEl = document.getElementById('puzzle-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    showPuzzleMsg('<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>', '');
}

function resetPuzzleGame() {
    clearInterval(sharedState.timerInterval);
    puzzleState = { board: [], size: puzzleConfig.size, moves: 0, startTime: 0, timerGoing: false };
    scramblePuzzle();
    renderPuzzleBoard();
    startPuzzleGame();
}

// ─── Scramble ────────────────────────────────────────────────────────

function scramblePuzzle() {
    const n = puzzleState.size;
    const total = n * n;
    // Start solved
    puzzleState.board = Array.from({ length: total }, (_, i) => (i === total - 1 ? 0 : i + 1));
    let blankIdx = total - 1;
    // Shuffle via random adjacent moves
    for (let i = 0; i < 300; i++) {
        const moves = [];
        const r = Math.floor(blankIdx / n), c = blankIdx % n;
        if (r > 0) moves.push(blankIdx - n);
        if (r < n - 1) moves.push(blankIdx + n);
        if (c > 0) moves.push(blankIdx - 1);
        if (c < n - 1) moves.push(blankIdx + 1);
        const pick = moves[Math.floor(Math.random() * moves.length)];
        puzzleState.board[blankIdx] = puzzleState.board[pick];
        puzzleState.board[pick] = 0;
        blankIdx = pick;
    }
}

// ─── Rendering ────────────────────────────────────────────────────────

function renderPuzzleBoard() {
    const boardEl = document.getElementById('puzzle-board');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    const n = puzzleState.size;
    boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

    puzzleState.board.forEach((val, i) => {
        const tile = document.createElement('div');
        tile.className = 'puzzle-tile' + (val === 0 ? ' empty' : '');
        tile.textContent = val === 0 ? '' : val;
        tile.dataset.idx = i;
        tile.addEventListener('click', () => handlePuzzleClick(i));
        boardEl.appendChild(tile);
    });
}

function showPuzzleMsg(text, cls) {
    const el = document.getElementById('puzzle-message');
    if (!el) return;
    el.innerHTML = text;
    el.className = `puzzle-message ${cls}`;
}

// ─── Interaction ──────────────────────────────────────────────────────

function handlePuzzleClick(idx) {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'puzzle') return;
    const n = puzzleState.size;
    const blankIdx = puzzleState.board.indexOf(0);
    const r1 = Math.floor(idx / n), c1 = idx % n;
    const r2 = Math.floor(blankIdx / n), c2 = blankIdx % n;

    // Must be orthogonally adjacent
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

    // Swap
    puzzleState.board[blankIdx] = puzzleState.board[idx];
    puzzleState.board[idx] = 0;
    puzzleState.moves++;
    const movesEl = document.getElementById('puzzle-moves');
    if (movesEl) movesEl.textContent = puzzleState.moves;

    renderPuzzleBoard();
    checkPuzzleWin();
}

function movePuzzleByDirection(dir) {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'puzzle') return;
    const n = puzzleState.size;
    const blankIdx = puzzleState.board.indexOf(0);
    const blankR = Math.floor(blankIdx / n);
    const blankC = blankIdx % n;

    const mode = puzzleConfig.controlMode || 'tile';

    let targetR = blankR;
    let targetC = blankC;

    if (mode === 'tile') {
        if (dir === 'up') targetR = blankR + 1;
        else if (dir === 'down') targetR = blankR - 1;
        else if (dir === 'left') targetC = blankC + 1;
        else if (dir === 'right') targetC = blankC - 1;
    } else {
        if (dir === 'up') targetR = blankR - 1;
        else if (dir === 'down') targetR = blankR + 1;
        else if (dir === 'left') targetC = blankC - 1;
        else if (dir === 'right') targetC = blankC + 1;
    }

    if (targetR >= 0 && targetR < n && targetC >= 0 && targetC < n) {
        const targetIdx = targetR * n + targetC;
        handlePuzzleClick(targetIdx);
    }
}

function checkPuzzleWin() {
    const total = puzzleState.size * puzzleState.size;
    for (let i = 0; i < total - 1; i++) {
        if (puzzleState.board[i] !== i + 1) return;
    }
    // Last tile must be 0
    if (puzzleState.board[total - 1] !== 0) return;

    clearInterval(sharedState.timerInterval);
    sharedState.status = 'WON';
    showPuzzleMsg(`UKOŃCZONO W ${puzzleState.moves} RUCHACH! 🎉`, 'puzzle-msg-success');

    const startBtn = document.getElementById('puzzle-btn-start');
    const restartBtn = document.getElementById('puzzle-btn-restart');
    const configBtn = document.getElementById('puzzle-btn-config');
    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
}

// ─── Flow ────────────────────────────────────────────────────────────

function startPuzzleGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('puzzle-btn-start');
    const restartBtn = document.getElementById('puzzle-btn-restart');
    const configBtn = document.getElementById('puzzle-btn-config');
    const hintEl = document.getElementById('puzzle-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    showPuzzleMsg('', '');

    startCountdown(() => {
        if (sharedState.currentHack === 'puzzle') {
            sharedState.status = 'PLAYING';
            startPuzzleTimer();
        }
    });
}

function startPuzzleTimer() {
    if (puzzleConfig.timeleft <= 0) return; // no limit
    const textEl = document.getElementById('puzzle-timer-text');
    const barEl = document.getElementById('puzzle-timer-bar');
    startGenericTimer(puzzleConfig.timeleft, textEl, barEl, () => {
        sharedState.status = 'GAMEOVER';
        showPuzzleMsg('Czas minął! PRZERWANO.', 'puzzle-msg-fail');

        const restartBtn = document.getElementById('puzzle-btn-restart');
        const configBtn = document.getElementById('puzzle-btn-config');
        if (restartBtn) restartBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
    }, (rem, frac) => {
        if (barEl) barEl.style.background = frac > 0.4 ? '#14b8a6' : frac > 0.2 ? '#f59e0b' : '#ef4444';
    });
}

// ─── Event wiring ────────────────────────────────────────────────────

function puzzleWireEvents() {
    // Keyboard controls (WASD & Arrow Keys)
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'puzzle') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        // Space / Enter to start when in READY mode
        if (sharedState.status === 'READY' && (e.code === 'Space' || e.key === 'Enter')) {
            e.preventDefault();
            startPuzzleGame();
            return;
        }

        if (sharedState.status !== 'PLAYING') return;

        const key = e.key.toLowerCase();
        let dir = null;
        if (key === 'w' || e.key === 'ArrowUp') dir = 'up';
        else if (key === 's' || e.key === 'ArrowDown') dir = 'down';
        else if (key === 'a' || e.key === 'ArrowLeft') dir = 'left';
        else if (key === 'd' || e.key === 'ArrowRight') dir = 'right';

        if (dir) {
            e.preventDefault();
            movePuzzleByDirection(dir);
        }
    });

    document.querySelectorAll('#puzzle-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            puzzleApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#puzzle-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            puzzleSetupReady(true);
        });
    });

    document.getElementById('puzzle-in-time')?.addEventListener('input', () => {
        document.querySelectorAll('#puzzle-preset-btns button').forEach(b => b.classList.remove('preset-active'));
        puzzleReadCustomConfig();
        if (sharedState.status === 'READY') {
            const textEl = document.getElementById('puzzle-timer-text');
            if (textEl) textEl.textContent = puzzleConfig.timeleft > 0 ? puzzleConfig.timeleft.toFixed(1) + 's' : 'Bez limitu';
        }
    });

    document.getElementById('puzzle-in-mode')?.addEventListener('change', () => {
        puzzleReadCustomConfig();
    });

    document.getElementById('puzzle-btn-start')?.addEventListener('click', () => {
        puzzleReadCustomConfig();
        startPuzzleGame();
    });

    document.getElementById('puzzle-btn-shuffle')?.addEventListener('click', () => {
        puzzleReadCustomConfig();
        scramblePuzzle();
        renderPuzzleBoard();
    });

    document.getElementById('puzzle-btn-restart')?.addEventListener('click', () => {
        puzzleReadCustomConfig();
        resetPuzzleGame();
    });

    document.getElementById('puzzle-btn-config')?.addEventListener('click', () => {
        puzzleSetupReady(true);
    });
}
