
const SLIDER_PRESETS = {
    easy: { gapWidth: 120, fallSpeed: 0.2, targetScore: 5, maxAttempts: 5 },
    normal: { gapWidth: 80, fallSpeed: 1, targetScore: 10, maxAttempts: 3 },
    hard: { gapWidth: 55, fallSpeed: 3, targetScore: 15, maxAttempts: 2 },
};

let sliderConfig = { ...SLIDER_PRESETS.normal };
let sliderState = {
    player: { x: 190, y: 340, w: 22, h: 28, speed: 5 },
    bars: [], passed: 0, barSpacing: 180, attempts: 3
};
const sliderKeys = { a: false, d: false, ArrowLeft: false, ArrowRight: false };
let sliderLoopActive = false;

// ─── Init ─────────────────────────────────────────────────────────────

function initSlider() {
    sliderApplyPreset('normal');
    sliderSetupReady(false);
}

function sliderApplyPreset(name) {
    const p = SLIDER_PRESETS[name] || SLIDER_PRESETS.normal;
    sliderConfig = { ...p };
    document.querySelectorAll('#slider-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const fields = {
        'slider-in-gap': sliderConfig.gapWidth,
        'slider-in-speed': sliderConfig.fallSpeed,
        'slider-in-target': sliderConfig.targetScore,
        'slider-in-attempts': sliderConfig.maxAttempts,
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

function sliderReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) || def;
    sliderConfig = {
        gapWidth: Math.min(180, Math.max(30, v('slider-in-gap', 80))),
        fallSpeed: Math.min(10, Math.max(1, v('slider-in-speed', 3))),
        targetScore: Math.max(1, v('slider-in-target', 10)),
        maxAttempts: Math.max(1, v('slider-in-attempts', 3)),
    };
}

function sliderSetupReady(keepConfig = false) {
    cancelAnimationFrame(sharedState.animFrame);
    clearInterval(sharedState.timerInterval);
    sliderLoopActive = false;
    sharedState.status = 'READY';

    if (!keepConfig) {
        sliderApplyPreset('normal');
    } else {
        sliderReadCustomConfig();
    }

    sliderState = {
        player: { x: 190, y: 340, w: 22, h: 28, speed: 5 },
        bars: [], passed: 0, barSpacing: 180,
        attempts: sliderConfig.maxAttempts
    };
    Object.keys(sliderKeys).forEach(k => sliderKeys[k] = false);
    updateSliderUI();
    drawSliderCanvas();

    const startBtn = document.getElementById('slider-btn-start');
    const restartBtn = document.getElementById('slider-btn-restart');
    const configBtn = document.getElementById('slider-btn-config');
    const hintEl = document.getElementById('slider-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    const msgEl = document.getElementById('slider-message');
    if (msgEl) {
        msgEl.innerHTML = '<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>';
        msgEl.className = 'slider-message';
    }
}

function resetSliderGame() {
    sliderSetupReady(true);
    startSliderGame();
}

// ─── Game Flow ────────────────────────────────────────────────────────

function startSliderGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('slider-btn-start');
    const restartBtn = document.getElementById('slider-btn-restart');
    const configBtn = document.getElementById('slider-btn-config');
    const hintEl = document.getElementById('slider-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    const msgEl = document.getElementById('slider-message');
    if (msgEl) {
        msgEl.innerHTML = '';
        msgEl.className = 'slider-message';
    }

    startCountdown(() => {
        if (sharedState.currentHack === 'slider') {
            spawnSliderBar(-20);
            sliderLoop();
        }
    });
}

function startSliderRound() {
    sliderState.player.x = 190;
    sliderState.bars = [];
    sliderState.passed = 0;
    spawnSliderBar(-20);
    updateSliderUI();
    sliderLoop();
}

function spawnSliderBar(startY) {
    const gapX = randomInt(10, 400 - sliderConfig.gapWidth - 10);
    sliderState.bars.push({
        y: startY, h: 16, gapX, gapW: sliderConfig.gapWidth, passed: false
    });
}

function sliderLoop() {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'slider') return;
    sliderLoopActive = true;

    const p = sliderState.player;
    if (sliderKeys.a || sliderKeys.ArrowLeft) p.x -= p.speed;
    if (sliderKeys.d || sliderKeys.ArrowRight) p.x += p.speed;
    p.x = Math.max(0, Math.min(400 - p.w, p.x));

    let hit = false;
    for (const b of sliderState.bars) {
        b.y += sliderConfig.fallSpeed;
        // Collision
        if (p.y < b.y + b.h && p.y + p.h > b.y) {
            if (p.x < b.gapX || p.x + p.w > b.gapX + b.gapW) {
                hit = true;
                break;
            }
        }
        // Score
        if (!b.passed && b.y > p.y + p.h) {
            b.passed = true;
            sliderState.passed++;
            updateSliderUI();
            if (sliderState.passed >= sliderConfig.targetScore) {
                drawSliderCanvas();
                clearInterval(sharedState.timerInterval);
                showSliderMsg('HACKOWANIE UDANE! 🏁', 'slider-msg-success');
                sharedState.status = 'WON';
                setTimeout(() => { if (sharedState.currentHack === 'slider') showHub(); }, 2500);
                return;
            }
        }
    }

    // Remove off-screen bars
    sliderState.bars = sliderState.bars.filter(b => b.y < 450);

    // Spawn new bar
    const last = sliderState.bars[sliderState.bars.length - 1];
    if (!last || last.y >= sliderState.barSpacing) {
        spawnSliderBar(last ? last.y - sliderState.barSpacing : -20);
    }

    drawSliderCanvas();

    if (hit) {
        sliderHit();
        return;
    }

    sharedState.animFrame = requestAnimationFrame(sliderLoop);
}

function sliderHit() {
    sliderLoopActive = false;
    sliderState.attempts--;
    updateSliderUI();
    drawSliderCanvas(); // Show collision state

    if (sliderState.attempts <= 0) {
        showSliderMsg('BRAK ŻYĆ! PRZERWANO.', 'slider-msg-fail');
        sharedState.status = 'GAMEOVER';
        setTimeout(() => { if (sharedState.currentHack === 'slider') showHub(); }, 2500);
    } else {
        showSliderMsg('Zderzenie! Restartuję...', 'slider-msg-fail');
        sharedState.status = 'PAUSED';
        setTimeout(() => {
            if (sharedState.currentHack !== 'slider') return;
            showSliderMsg('', '');
            sharedState.status = 'PLAYING';
            startSliderRound();
        }, 1200);
    }
}

// ─── Drawing ─────────────────────────────────────────────────────────

function drawSliderCanvas() {
    const canvas = document.getElementById('slider-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 400, 400);

    // Bars
    ctx.fillStyle = '#f13a89';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#f13a89';
    sliderState.bars.forEach(b => {
        ctx.fillRect(0, b.y, b.gapX, b.h);
        ctx.fillRect(b.gapX + b.gapW, b.y, 400 - (b.gapX + b.gapW), b.h);
    });

    // Player (arrow shape)
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    const p = sliderState.player;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w / 2, p.y);
    ctx.lineTo(p.x + p.w, p.y + p.h / 2);
    ctx.lineTo(p.x + p.w * 0.75, p.y + p.h / 2);
    ctx.lineTo(p.x + p.w * 0.75, p.y + p.h);
    ctx.lineTo(p.x + p.w * 0.25, p.y + p.h);
    ctx.lineTo(p.x + p.w * 0.25, p.y + p.h / 2);
    ctx.lineTo(p.x, p.y + p.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
}

function updateSliderUI() {
    const passedEl = document.getElementById('slider-passed');
    const targetEl = document.getElementById('slider-target');
    const attemptsEl = document.getElementById('slider-attempts');
    if (passedEl) passedEl.textContent = sliderState.passed;
    if (targetEl) targetEl.textContent = sliderConfig.targetScore;
    if (attemptsEl) attemptsEl.textContent = sliderState.attempts;
}

function showSliderMsg(text, cls) {
    const el = document.getElementById('slider-message');
    if (!el) return;
    el.textContent = text;
    el.className = `slider-message ${cls}`;
}

// ─── Key events ──────────────────────────────────────────────────────

window.addEventListener('keydown', e => {
    if (Object.prototype.hasOwnProperty.call(sliderKeys, e.key)) sliderKeys[e.key] = true;
    if (e.key === 'a' || e.key === 'A') sliderKeys.a = true;
    if (e.key === 'd' || e.key === 'D') sliderKeys.d = true;
});
window.addEventListener('keyup', e => {
    if (Object.prototype.hasOwnProperty.call(sliderKeys, e.key)) sliderKeys[e.key] = false;
    if (e.key === 'a' || e.key === 'A') sliderKeys.a = false;
    if (e.key === 'd' || e.key === 'D') sliderKeys.d = false;
});

// ─── Touch & Mouse steering ──────────────────────────────────────────

function sliderWireTouchSteering() {
    const canvas = document.getElementById('slider-canvas');
    if (!canvas) return;
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (sharedState.status !== 'PLAYING') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = 400 / rect.width;
        const touchX = (e.touches[0].clientX - rect.left) * scaleX;
        sliderState.player.x = Math.max(0, Math.min(400 - sliderState.player.w, touchX - sliderState.player.w / 2));
    }, { passive: false });

    canvas.addEventListener('mousemove', e => {
        if (sharedState.status !== 'PLAYING') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = 400 / rect.width;
        const mouseX = (e.clientX - rect.left) * scaleX;
        sliderState.player.x = Math.max(0, Math.min(400 - sliderState.player.w, mouseX - sliderState.player.w / 2));
    });
}

// ─── Event wiring ────────────────────────────────────────────────────

function sliderWireEvents() {
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'slider') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && e.key === 'Enter') {
            e.preventDefault();
            startSliderGame();
        }
    });

    document.querySelectorAll('#slider-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            sliderApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#slider-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            sliderSetupReady(true);
        });
    });

    ['slider-in-gap', 'slider-in-speed', 'slider-in-target', 'slider-in-attempts'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#slider-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            sliderReadCustomConfig();
            if (sharedState.status === 'READY') {
                sliderSetupReady(true);
            }
        });
    });

    document.getElementById('slider-btn-start')?.addEventListener('click', () => {
        sliderReadCustomConfig();
        startSliderGame();
    });

    document.getElementById('slider-btn-restart')?.addEventListener('click', () => {
        sliderReadCustomConfig();
        resetSliderGame();
    });

    document.getElementById('slider-btn-config')?.addEventListener('click', () => {
        sliderSetupReady(true);
    });

    sliderWireTouchSteering();
}
