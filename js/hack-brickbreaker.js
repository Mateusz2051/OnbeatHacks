
const BB_PRESETS = {
    easy: { rows: 5, cols: 8, ballSpeed: 0.6, paddleW: 100, timeleft: 0, tripleBricks: 3 },
    normal: { rows: 6, cols: 9, ballSpeed: 1.2, paddleW: 80, timeleft: 0, tripleBricks: 3 },
    hard: { rows: 7, cols: 10, ballSpeed: 1.5, paddleW: 60, timeleft: 0, tripleBricks: 3 },
};

let bbConfig = { ...BB_PRESETS.normal };
let bbState = {
    canvas: null, ctx: null,
    ball: { x: 0, y: 0, vx: 0, vy: 0, r: 8 },
    paddle: { x: 0, y: 0, w: 80, h: 12, speed: 7 },
    bricks: [],
    lives: 3,
    score: 0,
    totalBricks: 0,
    started: false,
    paused: false,
};
const bbKeys = { ArrowLeft: false, ArrowRight: false, a: false, d: false };
let bbAnimFrame = null;
let bbTouchX = null; // for touch steering

const BB_COLORS = {
    1: { fill: '#f13a89', glow: '#f13a89' },
    2: { fill: '#f59e0b', glow: '#f59e0b' },
    3: { fill: '#22c55e', glow: '#22c55e' }, // triple bricks start green
};

// ─── Init ─────────────────────────────────────────────────────────────

function initBrickBreaker() {
    bbApplyPreset('normal');
    bbSetupReady(false);
}

function bbApplyPreset(name) {
    const p = BB_PRESETS[name] || BB_PRESETS.normal;
    bbConfig = { ...p };
    document.querySelectorAll('#bb-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const fields = {
        'bb-in-rows': bbConfig.rows,
        'bb-in-cols': bbConfig.cols,
        'bb-in-speed': bbConfig.ballSpeed,
        'bb-in-paddle': bbConfig.paddleW,
        'bb-in-triple': bbConfig.tripleBricks,
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

function bbReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) || def;
    bbConfig = {
        rows: Math.min(12, Math.max(2, v('bb-in-rows', 6))),
        cols: Math.min(14, Math.max(4, v('bb-in-cols', 9))),
        ballSpeed: Math.min(12, Math.max(2, v('bb-in-speed', 5.5))),
        paddleW: Math.min(160, Math.max(40, v('bb-in-paddle', 80))),
        tripleBricks: Math.min(10, Math.max(0, v('bb-in-triple', 3))),
        timeleft: 0,
    };
}

function bbSetupReady(keepConfig = false) {
    cancelAnimationFrame(bbAnimFrame);
    clearInterval(sharedState.timerInterval);
    bbAnimFrame = null;
    sharedState.status = 'READY';

    if (!keepConfig) {
        bbApplyPreset('normal');
    } else {
        bbReadCustomConfig();
    }

    const canvas = document.getElementById('bb-canvas');
    if (!canvas) return;
    bbState.canvas = canvas;
    bbState.ctx = canvas.getContext('2d');

    const cw = canvas.width = canvas.offsetWidth || 480;
    const ch = canvas.height = canvas.offsetHeight || 360;

    // Paddle
    bbState.paddle = {
        x: cw / 2 - bbConfig.paddleW / 2,
        y: ch - 30,
        w: bbConfig.paddleW,
        h: 12,
        speed: 7
    };

    // Ball
    bbState.ball = {
        x: cw / 2, y: ch - 60,
        vx: (Math.random() < 0.5 ? 1 : -1) * bbConfig.ballSpeed * 0.7,
        vy: -bbConfig.ballSpeed,
        r: 8
    };

    // Build bricks
    buildBricks(cw, ch);

    bbState.lives = 3;
    bbState.score = 0;
    bbState.started = false;
    bbState.paused = false;

    updateBbUI();
    bbDraw();

    const startBtn = document.getElementById('bb-btn-start');
    const restartBtn = document.getElementById('bb-btn-restart');
    const configBtn = document.getElementById('bb-btn-config');
    const hintEl = document.getElementById('bb-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    showBbOverlay('⚡ Gotowy do gry! Skonfiguruj parametry i kliknij Rozpocznij', '#f59e0b');
}

function resetBrickBreakerGame() {
    bbSetupReady(true);
    startBbGame();
}

// ─── Brick Building ──────────────────────────────────────────────────

function buildBricks(cw, ch) {
    const rows = bbConfig.rows;
    const cols = bbConfig.cols;
    const padX = 20;
    const padY = 40;
    const gap = 5;
    const bw = (cw - padX * 2 - gap * (cols - 1)) / cols;
    const bh = Math.min(22, (ch * 0.45 - padY - gap * (rows - 1)) / rows);

    const bricks = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            bricks.push({
                x: padX + c * (bw + gap),
                y: padY + r * (bh + gap),
                w: bw, h: bh,
                hp: 1,      // default 1 hit
                maxHp: 1,
                alive: true,
                row: r, col: c
            });
        }
    }

    // Randomly pick tripleBricks bricks and set hp=3
    const total = bricks.length;
    const tripleCount = Math.min(bbConfig.tripleBricks, total);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let i = 0; i < tripleCount; i++) {
        bricks[indices[i]].hp = 3;
        bricks[indices[i]].maxHp = 3;
    }

    bbState.bricks = bricks;
    bbState.totalBricks = total;
}

// ─── Game Loop ────────────────────────────────────────────────────────

function startBbGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('bb-btn-start');
    const restartBtn = document.getElementById('bb-btn-restart');
    const configBtn = document.getElementById('bb-btn-config');
    const hintEl = document.getElementById('bb-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    hideBbOverlay();

    startCountdown(() => {
        if (sharedState.currentHack === 'brickbreaker') {
            bbState.started = true;
            sharedState.status = 'PLAYING';
            bbLoop();
        }
    });
}

function bbLoop() {
    if (sharedState.status !== 'PLAYING' || sharedState.currentHack !== 'brickbreaker') return;

    const { canvas, ctx, ball, paddle, bricks } = bbState;
    const cw = canvas.width, ch = canvas.height;

    // ── Move paddle ──
    const spd = paddle.speed;
    if (bbKeys.ArrowLeft || bbKeys.a) paddle.x -= spd;
    if (bbKeys.ArrowRight || bbKeys.d) paddle.x += spd;
    if (bbTouchX !== null) paddle.x = bbTouchX - paddle.w / 2;
    paddle.x = Math.max(0, Math.min(cw - paddle.w, paddle.x));

    // ── Move ball ──
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounces
    if (ball.x - ball.r <= 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.r >= cw) { ball.x = cw - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    // Bottom — lose life
    if (ball.y + ball.r >= ch) {
        bbLoseBall();
        return;
    }

    // Paddle bounce
    if (
        ball.y + ball.r >= paddle.y &&
        ball.y - ball.r <= paddle.y + paddle.h &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.w &&
        ball.vy > 0
    ) {
        // Angle based on hit position
        const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1 to 1
        const angle = hitPos * 60; // max 60deg
        const speed = Math.hypot(ball.vx, ball.vy);
        const rad = (angle - 90) * Math.PI / 180;
        ball.vx = Math.cos(rad) * speed;
        ball.vy = Math.sin(rad) * speed;
        if (ball.vy > 0) ball.vy = -ball.vy; // ensure upward
        ball.y = paddle.y - ball.r - 1;
    }

    // Brick collision
    let brickAlive = false;
    for (const brick of bricks) {
        if (!brick.alive) continue;
        brickAlive = true;
        if (
            ball.x + ball.r >= brick.x &&
            ball.x - ball.r <= brick.x + brick.w &&
            ball.y + ball.r >= brick.y &&
            ball.y - ball.r <= brick.y + brick.h
        ) {
            // Which face?
            const overlapLeft = (ball.x + ball.r) - brick.x;
            const overlapRight = (brick.x + brick.w) - (ball.x - ball.r);
            const overlapTop = (ball.y + ball.r) - brick.y;
            const overlapBottom = (brick.y + brick.h) - (ball.y - ball.r);
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            if (minOverlap === overlapLeft || minOverlap === overlapRight) ball.vx = -ball.vx;
            else ball.vy = -ball.vy;

            brick.hp--;
            bbState.score += 10;
            if (brick.hp <= 0) {
                brick.alive = false;
                bbState.score += 20; // bonus for clearing
            }
            updateBbUI();
            break; // only one brick per frame
        }
    }

    // Check win
    const anyAlive = bricks.some(b => b.alive);
    if (!anyAlive) {
        bbWin();
        return;
    }

    bbDraw();
    bbAnimFrame = requestAnimationFrame(bbLoop);
}

// ─── Ball lost / Lives ───────────────────────────────────────────────

function bbLoseBall() {
    cancelAnimationFrame(bbAnimFrame);
    bbState.lives--;
    bbState.started = false;
    sharedState.status = 'PAUSED';
    updateBbUI();

    if (bbState.lives <= 0) {
        bbDraw();
        showBbOverlay('SYSTEM ZABLOKOWANY 🔒\nKliknij Restart', '#ef4444');
        sharedState.status = 'GAMEOVER';
    } else {
        // Reset ball & paddle position only
        const cw = bbState.canvas.width, ch = bbState.canvas.height;
        bbState.ball = {
            x: cw / 2, y: ch - 60,
            vx: (Math.random() < 0.5 ? 1 : -1) * bbConfig.ballSpeed * 0.7,
            vy: -bbConfig.ballSpeed,
            r: 8
        };
        bbState.paddle.x = cw / 2 - bbConfig.paddleW / 2;
        bbDraw();
        showBbOverlay(`Życie utracone! Pozostało: ${bbState.lives} ❤\nKliknij, aby kontynuować`, '#f59e0b');
        sharedState.status = 'IDLE';
    }
}

function bbWin() {
    cancelAnimationFrame(bbAnimFrame);
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'WON';
    bbDraw();
    showBbOverlay('HACKOWANIE UDANE! 🏆\nWszystkie bloki zniszczone!', '#22c55e');
    setTimeout(() => { if (sharedState.currentHack === 'brickbreaker') showHub(); }, 3000);
}

// ─── Drawing ─────────────────────────────────────────────────────────

function bbDraw() {
    const { canvas, ctx, ball, paddle, bricks } = bbState;
    if (!ctx) return;
    const cw = canvas.width, ch = canvas.height;

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, cw, ch);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
    for (let y = 0; y < ch; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }

    // Bricks
    bricks.forEach(brick => {
        if (!brick.alive) return;
        const hpFrac = brick.hp / brick.maxHp;
        let color, glow;
        if (brick.maxHp === 1) {
            color = '#f13a89'; glow = '#f13a89';
        } else {
            // Triple brick: green=3hp, yellow=2hp, red=1hp
            if (brick.hp === 3) { color = '#22c55e'; glow = '#22c55e'; }
            else if (brick.hp === 2) { color = '#f59e0b'; glow = '#f59e0b'; }
            else { color = '#ef4444'; glow = '#ef4444'; }
        }

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = glow;
        ctx.fillStyle = color;
        roundRect(ctx, brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2, 4);
        ctx.fill();

        // HP pips on triple bricks
        if (brick.maxHp === 3) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            for (let i = 0; i < 3; i++) {
                const px = brick.x + brick.w / 2 + (i - 1) * 8;
                const py = brick.y + brick.h - 4;
                ctx.beginPath();
                ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = brick.hp >= 3 ? '#fff' : brick.hp >= 2 ? '#fff' : 'rgba(255,255,255,0.3)';
            for (let i = 0; i < brick.hp; i++) {
                const px = brick.x + brick.w / 2 + (i - Math.floor(brick.hp / 2 + 0.5) + 0.5 + (brick.hp % 2 === 0 ? 0.5 : 0)) * 8;
                // Simpler: show hp count text
            }
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.font = `bold ${Math.min(brick.h - 4, 12)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`×${brick.hp}`, brick.x + brick.w / 2, brick.y + brick.h / 2);
        }

        ctx.restore();
    });

    // Paddle
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#f13a89';
    ctx.fillStyle = '#f13a89';
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();
    ctx.restore();

    // Ball
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─── Overlay ─────────────────────────────────────────────────────────

function showBbOverlay(text, color) {
    const overlay = document.getElementById('bb-overlay');
    const textEl = document.getElementById('bb-overlay-text');
    if (!overlay || !textEl) return;
    textEl.textContent = text;
    textEl.style.color = color || '#fff';
    overlay.style.display = 'flex';
}

function hideBbOverlay() {
    const overlay = document.getElementById('bb-overlay');
    if (overlay) overlay.style.display = 'none';
}

function updateBbUI() {
    const livesEl = document.getElementById('bb-lives');
    const scoreEl = document.getElementById('bb-score');
    const bricksEl = document.getElementById('bb-bricks-left');
    const alive = bbState.bricks.filter(b => b.alive).length;
    if (livesEl) livesEl.textContent = '❤'.repeat(bbState.lives) || '💀';
    if (scoreEl) scoreEl.textContent = bbState.score;
    if (bricksEl) bricksEl.textContent = alive;
}

// ─── Input ───────────────────────────────────────────────────────────

window.addEventListener('keydown', e => {
    if (Object.prototype.hasOwnProperty.call(bbKeys, e.key)) bbKeys[e.key] = true;
    if (e.key === 'a' || e.key === 'A') bbKeys.a = true;
    if (e.key === 'd' || e.key === 'D') bbKeys.d = true;
});
window.addEventListener('keyup', e => {
    if (Object.prototype.hasOwnProperty.call(bbKeys, e.key)) bbKeys[e.key] = false;
    if (e.key === 'a' || e.key === 'A') bbKeys.a = false;
    if (e.key === 'd' || e.key === 'D') bbKeys.d = false;
});

// ─── Event wiring ────────────────────────────────────────────────────

function bbWireEvents() {
    const canvas = document.getElementById('bb-canvas');
    if (!canvas) return;

    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'brickbreaker') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && e.key === 'Enter') {
            e.preventDefault();
            startBbGame();
        }
    });

    // Touch steering
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (sharedState.status !== 'PLAYING') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        bbTouchX = (e.touches[0].clientX - rect.left) * scaleX;
    }, { passive: false });
    canvas.addEventListener('touchend', () => { bbTouchX = null; });

    // Mouse steering on canvas
    canvas.addEventListener('mousemove', e => {
        if (sharedState.status !== 'PLAYING') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        bbState.paddle.x = (e.clientX - rect.left) * scaleX - bbState.paddle.w / 2;
        bbState.paddle.x = Math.max(0, Math.min(canvas.width - bbState.paddle.w, bbState.paddle.x));
    });

    // Preset buttons
    document.querySelectorAll('#bb-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            bbApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#bb-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            if (sharedState.status === 'READY') {
                bbSetupReady(true);
            }
        });
    });

    // Custom inputs
    ['bb-in-rows', 'bb-in-cols', 'bb-in-speed', 'bb-in-paddle', 'bb-in-triple'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#bb-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            bbReadCustomConfig();
            if (sharedState.status === 'READY') {
                bbSetupReady(true);
            }
        });
    });

    // Start button
    document.getElementById('bb-btn-start')?.addEventListener('click', () => {
        bbReadCustomConfig();
        startBbGame();
    });

    // Restart button
    document.getElementById('bb-btn-restart')?.addEventListener('click', () => {
        bbReadCustomConfig();
        resetBrickBreakerGame();
    });

    // Config button
    document.getElementById('bb-btn-config')?.addEventListener('click', () => {
        bbSetupReady(true);
    });
}
