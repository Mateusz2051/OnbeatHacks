

const DOT_PRESETS = {
    easy: { timeLimit: 16, dotCount: 6, stages: 2 },
    normal: { timeLimit: 8, dotCount: 6, stages: 2 },
    hard: { timeLimit: 5, dotCount: 6, stages: 2 },
};

let dotConfig = { ...DOT_PRESETS.normal };
let dotState = {
    dots: [],        // { num, x, y, clicked }
    nextNum: 1,
    stage: 1,
    totalStages: 2,
    gameStarted: false,
    clickedPositions: [], // for line drawing
};

// ─── Init ─────────────────────────────────────────────────────────────

function initDotSequence() {
    dotApplyPreset('normal');
    dotSetupReady(false);
}

function dotApplyPreset(name) {
    const p = DOT_PRESETS[name] || DOT_PRESETS.normal;
    dotConfig = { ...p };
    document.querySelectorAll('#dot-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const timeEl = document.getElementById('dot-in-time');
    if (timeEl) timeEl.value = dotConfig.timeLimit;
    const lblEl = document.getElementById('dot-time-label');
    if (lblEl) lblEl.textContent = `${dotConfig.timeLimit} sek.`;
}

function dotReadCustomConfig() {
    const time = parseFloat(document.getElementById('dot-in-time')?.value) || 8;
    dotConfig.timeLimit = Math.min(30, Math.max(3, time));
}

function dotSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        dotApplyPreset('normal');
    } else {
        dotReadCustomConfig();
    }

    dotState = {
        dots: [], nextNum: 1, stage: 1, totalStages: dotConfig.stages,
        gameStarted: false, clickedPositions: []
    };

    updateDotUI();
    renderDotLines();

    const textEl = document.getElementById('dot-timer-text');
    const barEl = document.getElementById('dot-timer-bar');
    if (textEl) textEl.textContent = dotConfig.timeLimit.toFixed(1) + 's';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#22d3ee';
    }

    const startBtn = document.getElementById('dot-btn-start');
    const restartBtn = document.getElementById('dot-btn-restart');
    const configBtn = document.getElementById('dot-btn-config');
    const hintEl = document.getElementById('dot-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    const msgEl = document.getElementById('dot-message');
    if (msgEl) {
        msgEl.innerHTML = '<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>';
        msgEl.className = 'dot-message';
    }
}

function resetDotGame() {
    dotSetupReady(true);
    startDotGame();
}

function startDotGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('dot-btn-start');
    const restartBtn = document.getElementById('dot-btn-restart');
    const configBtn = document.getElementById('dot-btn-config');
    const hintEl = document.getElementById('dot-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    const msgEl = document.getElementById('dot-message');
    if (msgEl) {
        msgEl.innerHTML = '';
        msgEl.className = 'dot-message';
    }

    showDotStartOverlay(false);
    startCountdown(() => startDotStage());
}

// ─── UI ──────────────────────────────────────────────────────────────

function updateDotUI() {
    const stageEl = document.getElementById('dot-stage-badge');
    const nextEl = document.getElementById('dot-next-badge');
    if (stageEl) stageEl.textContent = `${dotState.stage} / ${dotState.totalStages}`;
    if (nextEl) nextEl.textContent = dotState.nextNum;
}

function showDotStartOverlay(show) {
    const overlay = document.getElementById('dot-start-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function showDotMsg(text, cls) {
    const el = document.getElementById('dot-message');
    if (!el) return;
    el.textContent = text;
    el.className = `dot-message ${cls}`;
}

// ─── Stage Generation ────────────────────────────────────────────────

function generateDots() {
    const area = document.getElementById('dot-play-area');
    if (!area) return;
    const w = area.clientWidth || 400;
    const h = area.clientHeight || 360;
    const r = 22; // dot radius
    const margin = r + 8;

    dotState.dots = [];
    const nums = Array.from({ length: dotConfig.dotCount }, (_, i) => i + 1);
    nums.sort(() => Math.random() - 0.5);

    const positions = [];
    let attempts = 0;
    for (const num of nums) {
        let placed = false;
        while (!placed && attempts < 500) {
            attempts++;
            const x = randomInt(margin, w - margin);
            const y = randomInt(margin, h - margin);
            // Check min distance from others
            const tooClose = positions.some(p => Math.hypot(p.x - x, p.y - y) < r * 2 + 10);
            if (!tooClose) {
                positions.push({ x, y });
                dotState.dots.push({ num, x, y, clicked: false });
                placed = true;
            }
        }
    }
}

function renderDots() {
    const area = document.getElementById('dot-play-area');
    if (!area) return;

    // Remove existing dot elements
    area.querySelectorAll('.dot-circle').forEach(d => d.remove());

    dotState.dots.forEach(dot => {
        if (dot.clicked) return;
        const el = document.createElement('div');
        el.className = 'dot-circle';
        el.id = `dot-${dot.num}`;
        el.textContent = dot.num;
        el.style.left = `${dot.x}px`;
        el.style.top = `${dot.y}px`;
        const isNext = dot.num === dotState.nextNum;
        if (isNext) el.classList.add('dot-next');
        el.addEventListener('click', () => dotHandleClick(dot.num));
        area.appendChild(el);
    });
}

// ─── SVG Lines ───────────────────────────────────────────────────────

function renderDotLines() {
    const svg = document.getElementById('dot-svg-lines');
    if (!svg) return;
    svg.innerHTML = '';
    const pts = dotState.clickedPositions;
    for (let i = 1; i < pts.length; i++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pts[i - 1].x);
        line.setAttribute('y1', pts[i - 1].y);
        line.setAttribute('x2', pts[i].x);
        line.setAttribute('y2', pts[i].y);
        line.setAttribute('stroke', '#22d3ee');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('style', 'filter: drop-shadow(0px 0px 6px #22d3ee)');
        svg.appendChild(line);
    }
}

// ─── Click Handler ───────────────────────────────────────────────────

function dotHandleClick(num) {
    if (sharedState.status !== 'PLAYING') return;
    if (num !== dotState.nextNum) {
        // Wrong order - fail
        dotFail('Zła kolejność! Zacznij od 1.');
        return;
    }

    // Mark clicked
    const dot = dotState.dots.find(d => d.num === num);
    if (!dot) return;
    dot.clicked = true;
    dotState.clickedPositions.push({ x: dot.x, y: dot.y });
    dotState.nextNum++;

    renderDots();
    renderDotLines();
    updateDotUI();

    // Animate the removed dot
    const el = document.getElementById(`dot-${num}`);
    if (el) {
        el.classList.add('dot-clicked');
        setTimeout(() => el.remove(), 300);
    }

    // Check if stage complete
    if (dotState.nextNum > dotConfig.dotCount) {
        dotStageComplete();
    }
}

function dotStageComplete() {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'PAUSED';

    if (dotState.stage >= dotState.totalStages) {
        showDotMsg('HACKOWANIE UDANE! ✅', 'dot-msg-success');
        sharedState.status = 'WON';
        setTimeout(() => { if (sharedState.currentHack === 'dotsequence') showHub(); }, 2500);
    } else {
        dotState.stage++;
        showDotMsg(`Etap ${dotState.stage - 1} zaliczony! Następny...`, 'dot-msg-info');
        setTimeout(() => {
            if (sharedState.currentHack !== 'dotsequence') return;
            showDotMsg('', '');
            startDotStage();
        }, 900);
    }
}

function dotFail(msg) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'PAUSED';
    showDotMsg(msg, 'dot-msg-fail');
    // Flash red briefly then restart from stage 1
    setTimeout(() => {
        if (sharedState.currentHack !== 'dotsequence') return;
        showDotMsg('', '');
        dotState.stage = 1;
        startDotStage();
    }, 1200);
}

// ─── Stage Loop ──────────────────────────────────────────────────────

function startDotStage() {
    dotState.nextNum = 1;
    dotState.clickedPositions = [];
    sharedState.status = 'PLAYING';
    generateDots();
    renderDots();
    renderDotLines();
    updateDotUI();
    startDotTimer();
}

function startDotTimer() {
    const textEl = document.getElementById('dot-timer-text');
    const barEl = document.getElementById('dot-timer-bar');
    startGenericTimer(dotConfig.timeLimit, textEl, barEl, () => {
        dotFail('Czas minął! Zaczynasz od etapu 1.');
    }, (rem, frac) => {
        if (barEl) barEl.style.background = frac > 0.5 ? '#22d3ee' : frac > 0.25 ? '#f59e0b' : '#ef4444';
    });
}

// ─── Event wiring ────────────────────────────────────────────────────

function dotWireEvents() {
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'dotsequence') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && (e.code === 'Space' || e.key === 'Enter')) {
            e.preventDefault();
            startDotGame();
        }
    });

    document.getElementById('dot-btn-start')?.addEventListener('click', () => {
        startDotGame();
    });

    document.getElementById('dot-btn-start-overlay')?.addEventListener('click', () => {
        startDotGame();
    });

    document.getElementById('dot-btn-restart')?.addEventListener('click', () => {
        dotReadCustomConfig();
        resetDotGame();
    });

    document.getElementById('dot-btn-config')?.addEventListener('click', () => {
        dotSetupReady(true);
    });

    document.querySelectorAll('#dot-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            dotApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#dot-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            dotSetupReady(true);
        });
    });

    document.getElementById('dot-in-time')?.addEventListener('input', e => {
        document.querySelectorAll('#dot-preset-btns button').forEach(b => b.classList.remove('preset-active'));
        dotReadCustomConfig();
        const lblEl = document.getElementById('dot-time-label');
        if (lblEl) lblEl.textContent = `${dotConfig.timeLimit} sek.`;
        if (sharedState.status === 'READY') {
            dotSetupReady(true);
        }
    });
}
