
const CABLE_PRESETS = {
    easy: { cableCount: 4, timeleft: 30 },
    normal: { cableCount: 5, timeleft: 15 },
    hard: { cableCount: 8, timeleft: 10 },
};

let cableConfig = { ...CABLE_PRESETS.normal };
let cablesState = {
    leftNodes: [], rightNodes: [], connections: {},
    selectedLeft: null, mouseX: undefined, mouseY: undefined
};

// ─── Init ─────────────────────────────────────────────────────────────

function initCables() {
    cableApplyPreset('normal');
    cablesSetupReady(false);
}

function cableApplyPreset(name) {
    const p = CABLE_PRESETS[name] || CABLE_PRESETS.normal;
    cableConfig = { ...p };
    document.querySelectorAll('#cable-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const countEl = document.getElementById('cable-in-count');
    const timeEl = document.getElementById('cable-in-time');
    if (countEl) countEl.value = cableConfig.cableCount;
    if (timeEl) timeEl.value = cableConfig.timeleft;
}

function cableReadCustomConfig() {
    const count = parseInt(document.getElementById('cable-in-count')?.value) || 5;
    const time = parseFloat(document.getElementById('cable-in-time')?.value) || 15;
    cableConfig = { cableCount: Math.min(8, Math.max(3, count)), timeleft: time };
}

function cablesSetupReady(keepConfig = false) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        cableApplyPreset('normal');
    } else {
        cableReadCustomConfig();
    }

    cablesState = {
        leftNodes: [], rightNodes: [], connections: {},
        selectedLeft: null, mouseX: undefined, mouseY: undefined
    };

    const colors = ['#f13a89', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ef4444'];
    const num = Math.min(cableConfig.cableCount, colors.length);
    for (let i = 0; i < num; i++) cablesState.leftNodes.push({ id: i, color: colors[i] });
    cablesState.leftNodes.sort(() => Math.random() - 0.5);
    for (let i = 0; i < num; i++) cablesState.rightNodes.push({ id: i, color: colors[i] });
    cablesState.rightNodes.sort(() => Math.random() - 0.5);

    buildCablesDOM();
    drawCables();

    const textEl = document.getElementById('cables-timer-text');
    const barEl = document.getElementById('cables-timer-bar');
    if (textEl) textEl.textContent = cableConfig.timeleft.toFixed(1) + 's';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#3b82f6';
    }

    const connEl = document.getElementById('cables-connected');
    if (connEl) connEl.textContent = `0 / ${cablesState.leftNodes.length}`;

    const startBtn = document.getElementById('cables-btn-start');
    const restartBtn = document.getElementById('cables-btn-restart');
    const configBtn = document.getElementById('cables-btn-config');
    const hintEl = document.getElementById('cables-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    const msgEl = document.getElementById('cables-message');
    if (msgEl) {
        msgEl.innerHTML = '<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>';
        msgEl.className = 'cables-message';
    }
}

function resetCablesGame() {
    cablesSetupReady(true);
    startCablesGame();
}

// ─── DOM Builder ─────────────────────────────────────────────────────

function buildCablesDOM() {
    const leftCol = document.getElementById('cables-left');
    const rightCol = document.getElementById('cables-right');
    if (!leftCol || !rightCol) return;
    leftCol.innerHTML = ''; rightCol.innerHTML = '';

    cablesState.leftNodes.forEach(node => {
        const btn = document.createElement('button');
        btn.className = 'cable-node';
        btn.id = `cable-left-${node.id}`;
        btn.dataset.id = node.id;
        btn.dataset.color = node.color;
        btn.style.color = node.color;
        btn.innerHTML = `<span class="cable-node-inner"></span>`;
        btn.addEventListener('pointerdown', e => {
            if (sharedState.status !== 'PLAYING') return;
            cablesState.selectedLeft = node.id;
            const rect = document.getElementById('cables-board').getBoundingClientRect();
            cablesState.mouseX = e.clientX - rect.left;
            cablesState.mouseY = e.clientY - rect.top;
            delete cablesState.connections[node.id];
            updateCablesUI(); drawCables(); highlightCableNodes();
        });
        leftCol.appendChild(btn);
    });

    cablesState.rightNodes.forEach(node => {
        const btn = document.createElement('button');
        btn.className = 'cable-node';
        btn.id = `cable-right-${node.id}`;
        btn.dataset.id = node.id;
        btn.dataset.color = node.color;
        btn.style.color = node.color;
        btn.innerHTML = `<span class="cable-node-inner"></span>`;
        btn.addEventListener('pointerup', () => {
            if (sharedState.status !== 'PLAYING' || cablesState.selectedLeft === null) return;
            if (cablesState.selectedLeft === node.id) {
                cablesState.connections[cablesState.selectedLeft] = node.id;
                cablesState.selectedLeft = null;
                drawCables(); updateCablesUI(); checkCablesWin();
            } else {
                cablesState.selectedLeft = null;
                drawCables(); highlightCableNodes();
                showCablesMsg('Zły kabel! Połącz z tym samym kolorem.', 'cables-msg-fail');
                setTimeout(() => { if (sharedState.status === 'PLAYING') showCablesMsg('', ''); }, 1200);
            }
        });
        rightCol.appendChild(btn);
    });

    // Pointer move for drag line
    const board = document.getElementById('cables-board');
    if (board) {
        board.onpointermove = e => {
            if (sharedState.status !== 'PLAYING' || cablesState.selectedLeft === null) return;
            const rect = board.getBoundingClientRect();
            cablesState.mouseX = e.clientX - rect.left;
            cablesState.mouseY = e.clientY - rect.top;
            drawCables();
        };
    }
}

// ─── Game Flow ────────────────────────────────────────────────────────

function startCablesGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('cables-btn-start');
    const restartBtn = document.getElementById('cables-btn-restart');
    const configBtn = document.getElementById('cables-btn-config');
    const hintEl = document.getElementById('cables-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    const msgEl = document.getElementById('cables-message');
    if (msgEl) {
        msgEl.innerHTML = '';
        msgEl.className = 'cables-message';
    }

    startCountdown(() => {
        if (sharedState.currentHack === 'cables') {
            sharedState.status = 'PLAYING';
            updateCablesUI();
            startCablesTimer();
        }
    });
}

function startCablesTimer() {
    const textEl = document.getElementById('cables-timer-text');
    const barEl = document.getElementById('cables-timer-bar');
    startGenericTimer(cableConfig.timeleft, textEl, barEl, () => {
        cableFail('Czas minął!');
    }, (rem, frac) => {
        if (barEl) barEl.style.background = frac > 0.4 ? '#3b82f6' : frac > 0.2 ? '#f59e0b' : '#ef4444';
    });
}

function updateCablesUI() {
    const connected = Object.keys(cablesState.connections).length;
    const total = cablesState.leftNodes.length;
    const el = document.getElementById('cables-connected');
    if (el) el.textContent = `${connected} / ${total}`;
}

function checkCablesWin() {
    if (Object.keys(cablesState.connections).length === cablesState.leftNodes.length) {
        clearInterval(sharedState.timerInterval);
        showCablesMsg('POŁĄCZENIE UDANE! ⚡', 'cables-msg-success');
        sharedState.status = 'WON';
        setTimeout(() => { if (sharedState.currentHack === 'cables') showHub(); }, 2500);
    }
}

function cableFail(msg) {
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'GAMEOVER';
    showCablesMsg(msg + ' PRZERWANO.', 'cables-msg-fail');
    setTimeout(() => { if (sharedState.currentHack === 'cables') showHub(); }, 2500);
}

function showCablesMsg(text, cls) {
    const el = document.getElementById('cables-message');
    if (!el) return;
    el.textContent = text;
    el.className = `cables-message ${cls}`;
}

// ─── Drawing ─────────────────────────────────────────────────────────

function drawCables() {
    const svg = document.getElementById('cables-svg');
    const board = document.getElementById('cables-board');
    if (!svg || !board) return;
    const rect = board.getBoundingClientRect();
    svg.innerHTML = '';

    // Draw established connections
    for (let leftIdx in cablesState.connections) {
        const rightIdx = cablesState.connections[leftIdx];
        const leftNode = document.getElementById(`cable-left-${leftIdx}`);
        const rightNode = document.getElementById(`cable-right-${rightIdx}`);
        if (!leftNode || !rightNode) continue;
        const lr = leftNode.getBoundingClientRect();
        const rr = rightNode.getBoundingClientRect();
        const x1 = lr.left - rect.left + lr.width / 2;
        const y1 = lr.top - rect.top + lr.height / 2;
        const x2 = rr.left - rect.left + rr.width / 2;
        const y2 = rr.top - rect.top + rr.height / 2;
        const color = leftNode.dataset.color;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '4');
        path.setAttribute('fill', 'none');
        path.setAttribute('style', `filter: drop-shadow(0px 0px 6px ${color})`);
        svg.appendChild(path);
    }

    // Draw dragging line
    if (cablesState.selectedLeft !== null && cablesState.mouseX !== undefined) {
        const leftNode = document.getElementById(`cable-left-${cablesState.selectedLeft}`);
        if (leftNode) {
            const lr = leftNode.getBoundingClientRect();
            const x1 = lr.left - rect.left + lr.width / 2;
            const y1 = lr.top - rect.top + lr.height / 2;
            const x2 = cablesState.mouseX;
            const y2 = cablesState.mouseY;
            const color = leftNode.dataset.color;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '4');
            path.setAttribute('stroke-dasharray', '6,4');
            path.setAttribute('fill', 'none');
            path.setAttribute('style', `filter: drop-shadow(0px 0px 5px ${color})`);
            svg.appendChild(path);
        }
    }
}

function highlightCableNodes() {
    document.querySelectorAll('#cables-left .cable-node').forEach(node => {
        const nodeId = parseInt(node.dataset.id);
        node.classList.toggle('active-start', cablesState.selectedLeft === nodeId);
    });
}

// ─── Global pointer-up to cancel drag ────────────────────────────────

function cablePointerUp() {
    if (sharedState.currentHack !== 'cables') return;
    setTimeout(() => {
        if (cablesState.selectedLeft !== null) {
            cablesState.selectedLeft = null;
            drawCables(); highlightCableNodes();
        }
    }, 100);
}
window.addEventListener('pointerup', cablePointerUp);

// ─── Event wiring ────────────────────────────────────────────────────

function cablesWireEvents() {
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'cables') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && e.key === 'Enter') {
            e.preventDefault();
            startCablesGame();
        }
    });

    document.querySelectorAll('#cable-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            cableApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#cable-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            cablesSetupReady(true);
        });
    });

    ['cable-in-count', 'cable-in-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            document.querySelectorAll('#cable-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            cableReadCustomConfig();
            if (sharedState.status === 'READY') {
                cablesSetupReady(true);
            }
        });
    });

    document.getElementById('cables-btn-start')?.addEventListener('click', () => {
        cableReadCustomConfig();
        startCablesGame();
    });

    document.getElementById('cables-btn-restart')?.addEventListener('click', () => {
        cableReadCustomConfig();
        resetCablesGame();
    });

    document.getElementById('cables-btn-config')?.addEventListener('click', () => {
        cablesSetupReady(true);
    });
}
