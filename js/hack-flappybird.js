
const FB_PRESETS = {
    easy: { targetPipes: 15, gapH: 155, pipeSpeed: 1, gravity: 0.1, jumpForce: -4.6, maxFall: 6.0, pipeW: 52, spawnInterval: 110 },
    normal: { targetPipes: 15, gapH: 135, pipeSpeed: 1, gravity: 0.1, jumpForce: -4.9, maxFall: 6.8, pipeW: 54, spawnInterval: 95 },
    hard: { targetPipes: 15, gapH: 110, pipeSpeed: 1.3, gravity: 0.1, jumpForce: -5.3, maxFall: 7.5, pipeW: 56, spawnInterval: 80 },
};

let fbConfig = { ...FB_PRESETS.normal };
let fbState = {
    canvas: null, ctx: null,
    bird: { x: 80, y: 200, vy: 0, r: 14 },
    pipes: [],
    frame: 0,
    score: 0,       // pipes cleared
    started: false,
    dead: false,
    animFrame: null,
    birdAngle: 0,   // visual tilt
    particles: [],  // death particles
};

// Pipe colors 
const FB_PIPE_COLOR = '#f13a89';
const FB_PIPE_GLOW = 'rgba(241,58,137,0.5)';
const FB_BIRD_COLOR = '#ffffff';
const FB_BG_TOP = '#09090b';
const FB_BG_BOT = '#111113';

// ─── Init ─────────────────────────────────────────────────────────────

function initFlappyBird() {
    fbApplyPreset('normal');
    fbSetupReady(false);
}

function fbApplyPreset(name) {
    const p = FB_PRESETS[name] || FB_PRESETS.normal;
    fbConfig = { ...p };
    document.querySelectorAll('#fb-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });
    const fields = {
        'fb-in-pipes': fbConfig.targetPipes,
        'fb-in-gap': fbConfig.gapH,
        'fb-in-speed': fbConfig.pipeSpeed,
        'fb-in-gravity': fbConfig.gravity,
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

function fbReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) || def;
    const pipes = Math.max(1, Math.min(50, Math.round(v('fb-in-pipes', 15))));
    const gapH = Math.max(70, Math.min(220, v('fb-in-gap', 135)));
    const speed = Math.max(1.5, Math.min(8, v('fb-in-speed', 2.5)));
    const gravity = Math.max(0.10, Math.min(0.5, v('fb-in-gravity', 0.22)));
    const jumpForce = -Math.sqrt(2 * gravity * 55);
    const maxFall = Math.max(5.5, gravity * 30);
    fbConfig = {
        targetPipes: pipes,
        gapH, pipeSpeed: speed, gravity, jumpForce, maxFall,
        pipeW: fbConfig.pipeW || 54,
        spawnInterval: Math.round(95 * (2.5 / speed)),
    };
}

function fbSetupReady(keepConfig = false) {
    cancelAnimationFrame(fbState.animFrame);
    fbState.animFrame = null;
    sharedState.status = 'READY';

    if (!keepConfig) {
        fbApplyPreset('normal');
    } else {
        fbReadCustomConfig();
    }

    const canvas = document.getElementById('fb-canvas');
    if (!canvas) return;
    fbState.canvas = canvas;
    fbState.ctx = canvas.getContext('2d');

    const cw = canvas.width = canvas.offsetWidth || 420;
    const ch = canvas.height = canvas.offsetHeight || 380;

    fbState.bird = { x: Math.round(cw * 0.2), y: Math.round(ch / 2), vy: 0, r: 14 };
    fbState.pipes = [];
    fbState.frame = 0;
    fbState.score = 0;
    fbState.started = false;
    fbState.dead = false;
    fbState.birdAngle = 0;
    fbState.particles = [];

    updateFbUI();
    fbDraw();
    showFbOverlay('⚡ Gotowy do lotu! Skonfiguruj parametry i kliknij Rozpocznij', '#f13a89');

    const startBtn = document.getElementById('fb-btn-start');
    const restartBtn = document.getElementById('fb-btn-restart');
    const configBtn = document.getElementById('fb-btn-config');
    const hintEl = document.getElementById('fb-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');
}

function resetFlappyBird() {
    fbSetupReady(true);
    startFbGame();
}

// ─── Game Loop ────────────────────────────────────────────────────────

function startFbGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('fb-btn-start');
    const restartBtn = document.getElementById('fb-btn-restart');
    const configBtn = document.getElementById('fb-btn-config');
    const hintEl = document.getElementById('fb-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    hideFbOverlay();

    startCountdown(() => {
        if (sharedState.currentHack === 'flappybird') {
            fbState.started = true;
            sharedState.status = 'PLAYING';
            fbJump();
            fbLoop();
        }
    });
}

function fbStart() {
    if (sharedState.status === 'READY') {
        startFbGame();
        return;
    }
    if (fbState.started) return;
    fbState.started = true;
    hideFbOverlay();
    sharedState.status = 'PLAYING';
    fbLoop();
}

function fbLoop() {
    if (sharedState.currentHack !== 'flappybird') return;
    if (sharedState.status !== 'PLAYING') return;

    const { canvas, ctx, bird, pipes } = fbState;
    const cw = canvas.width, ch = canvas.height;

    fbState.frame++;

    // ── Physics ──
    bird.vy = Math.min(bird.vy + fbConfig.gravity, fbConfig.maxFall || 6.8);
    bird.y += bird.vy;

    // Angle tilt: smooth rotation
    if (bird.vy < 0) {
        fbState.birdAngle = Math.max(-24, fbState.birdAngle - 5.5);
    } else {
        fbState.birdAngle = Math.min(70, fbState.birdAngle + 2.8);
    }

    // ── Spawn pipes ──
    if (fbState.frame % fbConfig.spawnInterval === 0) {
        const minGapY = 50;
        const maxGapY = ch - fbConfig.gapH - 50;
        const gapY = randomInt(minGapY, maxGapY);
        fbState.pipes.push({
            x: cw + fbConfig.pipeW,
            gapY,
            gapH: fbConfig.gapH,
            w: fbConfig.pipeW,
            passed: false,
        });
    }

    // ── Move pipes ──
    for (const pipe of fbState.pipes) {
        pipe.x -= fbConfig.pipeSpeed;

        // Score when bird passes pipe center
        if (!pipe.passed && pipe.x + pipe.w < bird.x - bird.r) {
            pipe.passed = true;
            fbState.score++;
            updateFbUI();

            if (fbState.score >= fbConfig.targetPipes) {
                fbWin();
                return;
            }
        }
    }

    // Remove off-screen pipes
    fbState.pipes = fbState.pipes.filter(p => p.x + p.w > 0);

    // ── Particles ──
    fbState.particles = fbState.particles
        .filter(p => p.life > 0)
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - 1 }));

    // ── Collision detection ──
    // Ceiling: gentle clamp instead of instant death
    if (bird.y - bird.r < 4) {
        bird.y = bird.r + 4;
        bird.vy = 0;
    }
    // Floor
    if (bird.y + bird.r >= ch - 4) {
        fbDie();
        return;
    }
    // Pipes with fair circular radius
    const hitR = bird.r * 0.78;
    for (const pipe of fbState.pipes) {
        if (
            bird.x + hitR > pipe.x &&
            bird.x - hitR < pipe.x + pipe.w
        ) {
            // Top pipe
            if (bird.y - hitR < pipe.gapY) { fbDie(); return; }
            // Bottom pipe
            if (bird.y + hitR > pipe.gapY + pipe.gapH) { fbDie(); return; }
        }
    }

    fbDraw();
    fbState.animFrame = requestAnimationFrame(fbLoop);
}

// ─── Win / Die ────────────────────────────────────────────────────────

function fbDie() {
    cancelAnimationFrame(fbState.animFrame);
    fbState.dead = true;
    sharedState.status = 'GAMEOVER';

    // Spawn particles
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        fbState.particles.push({
            x: fbState.bird.x, y: fbState.bird.y,
            vx: Math.cos(angle) * randomInt(2, 6),
            vy: Math.sin(angle) * randomInt(2, 6),
            life: 30, color: '#f13a89',
        });
    }
    fbDraw(); // Draw final frame with particles
    showFbOverlay(`CRASH! Przeleciałeś ${fbState.score}/${fbConfig.targetPipes} rur\nKliknij lub Spacja, by zagrać ponownie`, '#ef4444');
}

function fbWin() {
    cancelAnimationFrame(fbState.animFrame);
    sharedState.status = 'WON';
    fbDraw();
    showFbOverlay(`HACKOWANIE UDANE! 🐦\n${fbConfig.targetPipes} rur przelecianych!`, '#22c55e');
    setTimeout(() => { if (sharedState.currentHack === 'flappybird') showHub(); }, 3000);
}

// ─── Drawing ─────────────────────────────────────────────────────────

function fbDraw() {
    const { canvas, ctx, bird, pipes, particles } = fbState;
    if (!ctx) return;
    const cw = canvas.width, ch = canvas.height;

    // ── Background gradient ──
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(1, '#0f0f12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
    for (let y = 0; y < ch; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }

    // ── Pipes ──
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = FB_PIPE_GLOW;
    for (const pipe of pipes) {
        // Top pipe body
        ctx.fillStyle = '#1a1a1f';
        fbRoundRectPath(ctx, pipe.x + 3, 0, pipe.w - 6, pipe.gapY - 10, 0, 0, 4, 4);
        ctx.fill();
        ctx.fillStyle = FB_PIPE_COLOR;
        ctx.shadowBlur = 14;
        // Cap top
        fbRoundRectPath(ctx, pipe.x, pipe.gapY - 20, pipe.w, 20, 4, 4, 0, 0);
        ctx.fill();
        // Stripe on top pipe
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(pipe.x + pipe.w * 0.3, 0, pipe.w * 0.12, pipe.gapY - 20);

        // Bottom pipe body
        ctx.fillStyle = '#1a1a1f';
        ctx.shadowBlur = 0;
        fbRoundRectPath(ctx, pipe.x + 3, pipe.gapY + pipe.gapH + 10, pipe.w - 6, ch - (pipe.gapY + pipe.gapH + 10), 4, 4, 0, 0);
        ctx.fill();
        ctx.fillStyle = FB_PIPE_COLOR;
        ctx.shadowBlur = 14;
        // Cap bottom
        fbRoundRectPath(ctx, pipe.x, pipe.gapY + pipe.gapH, pipe.w, 20, 0, 0, 4, 4);
        ctx.fill();
        // Stripe on bottom pipe
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.shadowBlur = 0;
        ctx.fillRect(pipe.x + pipe.w * 0.3, pipe.gapY + pipe.gapH + 20, pipe.w * 0.12, ch - (pipe.gapY + pipe.gapH + 20));
    }
    ctx.restore();

    // ── Particles ──
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ── Bird ──
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(fbState.birdAngle * Math.PI / 180);
    // Body glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffffff';
    // Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.r, bird.r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wing
    ctx.fillStyle = 'rgba(241,58,137,0.9)';
    ctx.shadowColor = '#f13a89';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(-3, 4, bird.r * 0.65, bird.r * 0.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(5, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(6, -4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(bird.r * 0.7, -1);
    ctx.lineTo(bird.r + 5, 1);
    ctx.lineTo(bird.r * 0.7, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ── Score overlay ──
    ctx.fillStyle = 'rgba(241,58,137,0.15)';
    ctx.fillRect(cw - 80, 8, 72, 28);
    ctx.strokeStyle = 'rgba(241,58,137,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cw - 80, 8, 72, 28);
    ctx.fillStyle = '#f13a89';
    ctx.font = 'bold 13px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${fbState.score}/${fbConfig.targetPipes}`, cw - 12, 22);
}

// Helper: rounded rect with individual corner radii
function fbRoundRectPath(ctx, x, y, w, h, tlr, trr, brr, blr) {
    ctx.beginPath();
    ctx.moveTo(x + tlr, y);
    ctx.lineTo(x + w - trr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + trr);
    ctx.lineTo(x + w, y + h - brr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - brr, y + h);
    ctx.lineTo(x + blr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - blr);
    ctx.lineTo(x, y + tlr);
    ctx.quadraticCurveTo(x, y, x + tlr, y);
    ctx.closePath();
}

// ─── Overlay ─────────────────────────────────────────────────────────

function showFbOverlay(text, color) {
    const overlay = document.getElementById('fb-overlay');
    const textEl = document.getElementById('fb-overlay-text');
    if (!overlay || !textEl) return;
    textEl.textContent = text;
    textEl.style.color = color || '#fff';
    overlay.style.display = 'flex';
}

function hideFbOverlay() {
    const el = document.getElementById('fb-overlay');
    if (el) el.style.display = 'none';
}

function updateFbUI() {
    const scoreEl = document.getElementById('fb-score');
    const targetEl = document.getElementById('fb-target');
    const barEl = document.getElementById('fb-progress-bar');
    if (scoreEl) scoreEl.textContent = fbState.score;
    if (targetEl) targetEl.textContent = fbConfig.targetPipes;
    if (barEl) {
        const pct = (fbState.score / fbConfig.targetPipes) * 100;
        barEl.style.width = pct + '%';
    }
}

// ─── Input ───────────────────────────────────────────────────────────

function fbJump() {
    if (sharedState.currentHack !== 'flappybird') return;
    if (fbState.dead) {
        resetFlappyBird();
        fbStart();
        fbState.bird.vy = fbConfig.jumpForce;
        fbState.birdAngle = -24;
        return;
    }
    if (sharedState.status === 'IDLE') {
        fbStart();
        fbState.bird.vy = fbConfig.jumpForce;
        fbState.birdAngle = -24;
        return;
    }
    if (sharedState.status !== 'PLAYING') return;
    fbState.bird.vy = fbConfig.jumpForce;
    fbState.birdAngle = -24;
}

// ─── Resize canvas on window resize ──────────────────────────────────

function fbResizeCanvas() {
    const canvas = document.getElementById('fb-canvas');
    if (!canvas || sharedState.currentHack !== 'flappybird') return;
    const oldW = canvas.width, oldH = canvas.height;
    const newW = canvas.offsetWidth || oldW;
    const newH = canvas.offsetHeight || oldH;
    if (newW === oldW && newH === oldH) return;
    // Scale bird and pipes proportionally
    const scaleX = newW / oldW, scaleY = newH / oldH;
    fbState.bird.x *= scaleX;
    fbState.bird.y *= scaleY;
    fbState.pipes.forEach(p => {
        p.x *= scaleX;
        p.gapY *= scaleY;
        p.gapH = fbConfig.gapH; // keep gap absolute
    });
    canvas.width = newW;
    canvas.height = newH;
}

// ─── Event wiring ────────────────────────────────────────────────────

function fbWireEvents() {
    const canvas = document.getElementById('fb-canvas');
    if (!canvas) return;

    canvas.addEventListener('click', fbJump);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); fbJump(); }, { passive: false });

    const overlay = document.getElementById('fb-overlay');
    if (overlay) {
        overlay.addEventListener('click', fbJump);
        overlay.addEventListener('touchstart', e => { e.preventDefault(); fbJump(); }, { passive: false });
    }

    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'flappybird') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (sharedState.status === 'READY' && e.key === 'Enter') {
            e.preventDefault();
            startFbGame();
            return;
        }

        if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            fbJump();
        }
    });

    window.addEventListener('resize', fbResizeCanvas);

    // Preset buttons
    document.querySelectorAll('#fb-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            fbApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#fb-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            if (sharedState.status === 'READY') {
                fbSetupReady(true);
            }
        });
    });

    // Custom inputs
    ['fb-in-pipes', 'fb-in-gap', 'fb-in-speed', 'fb-in-gravity'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#fb-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            fbReadCustomConfig();
            if (sharedState.status === 'READY') {
                updateFbUI();
            }
        });
    });

    // Start button
    document.getElementById('fb-btn-start')?.addEventListener('click', () => {
        fbReadCustomConfig();
        startFbGame();
    });

    // Restart button
    document.getElementById('fb-btn-restart')?.addEventListener('click', () => {
        fbReadCustomConfig();
        resetFlappyBird();
    });

    // Config button
    document.getElementById('fb-btn-config')?.addEventListener('click', () => {
        fbSetupReady(true);
    });
}
