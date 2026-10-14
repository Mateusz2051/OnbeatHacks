
const ICY_PRESETS = {
    easy: { targetFloors: 25, platW: 120, scrollSpeed: 0.4, gravity: 0.06, time: 0 },
    normal: { targetFloors: 50, platW: 100, scrollSpeed: 0.8, gravity: 0.10, time: 0 },
    hard: { targetFloors: 100, platW: 78, scrollSpeed: 1.0, gravity: 0.16, time: 0 },
    endless: { targetFloors: 0, platW: 90, scrollSpeed: 1.4, gravity: 0.20, time: 0 },
};

let icyConfig = { ...ICY_PRESETS.normal };

let icyState = {
    canvas: null,
    ctx: null,
    animFrame: null,
    timerInterval: null,
    player: {
        x: 195,
        y: 450,
        w: 24,
        h: 32,
        vx: 0,
        vy: 0,
        onGround: false,
        groundPlatform: null,
        facing: 1, // 1: right, -1: left
        runFrame: 0,
    },
    cameraY: 0,
    abyssY: 520,
    scrollActive: false,
    platforms: [],
    particles: [],
    floatingTexts: [],
    keys: {
        left: false,
        right: false,
        jump: false,
    },
    currentFloor: 0,
    lastLandedFloor: 0,
    combo: 0,
    bestFloor: 0,
    timeRemaining: 0,
    hasWon: false,
};

// ─── Init & Setup ─────────────────────────────────────────────────────

function initIcyTower() {
    icyApplyPreset('normal');
    icySetupReady(false);
}

function icyApplyPreset(name) {
    const p = ICY_PRESETS[name] || ICY_PRESETS.normal;
    icyConfig = { ...p };
    document.querySelectorAll('#icy-preset-btns button').forEach(b => {
        b.classList.toggle('preset-active', b.dataset.preset === name);
    });

    const fields = {
        'icy-in-floors': icyConfig.targetFloors,
        'icy-in-platw': icyConfig.platW,
        'icy-in-scroll': icyConfig.scrollSpeed,
        'icy-in-gravity': icyConfig.gravity || 0.20,
        'icy-in-time': icyConfig.time,
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

function icyReadCustomConfig() {
    const v = (id, def) => parseFloat(document.getElementById(id)?.value) ?? def;
    const floors = Math.max(0, Math.min(500, Math.round(v('icy-in-floors', 50))));
    const platW = Math.max(50, Math.min(180, v('icy-in-platw', 100)));
    const scroll = Math.max(0, Math.min(8, v('icy-in-scroll', 1.2)));
    const grav = Math.max(0.08, Math.min(0.50, v('icy-in-gravity', 0.20)));
    const time = Math.max(0, Math.min(300, v('icy-in-time', 0)));

    icyConfig = {
        targetFloors: floors,
        platW: platW,
        scrollSpeed: scroll,
        gravity: grav,
        jumpBoost: 1.5,
        time: time,
    };
}

function icySetupReady(keepConfig = false) {
    if (icyState.animFrame) {
        cancelAnimationFrame(icyState.animFrame);
        icyState.animFrame = null;
    }
    clearInterval(sharedState.timerInterval);
    sharedState.status = 'READY';

    if (!keepConfig) {
        icyApplyPreset('normal');
    } else {
        icyReadCustomConfig();
    }

    const canvas = document.getElementById('icy-canvas');
    if (!canvas) return;
    icyState.canvas = canvas;
    icyState.ctx = canvas.getContext('2d');

    const cw = canvas.width = 420;
    const ch = canvas.height = 520;

    // Reset game state
    icyState.cameraY = 0;
    icyState.abyssY = ch + 20;
    icyState.scrollActive = false;
    icyState.particles = [];
    icyState.floatingTexts = [];
    icyState.currentFloor = 0;
    icyState.lastLandedFloor = 0;
    icyState.combo = 0;
    icyState.hasWon = false;
    icyState.keys = { left: false, right: false, jump: false };

    // Reset Player on ground floor
    const groundY = ch - 50;
    icyState.player = {
        x: Math.round(cw / 2 - 12),
        y: groundY - 32,
        w: 24,
        h: 32,
        vx: 0,
        vy: 0,
        onGround: true,
        groundPlatform: null,
        facing: 1,
        runFrame: 0,
    };

    // Generate platforms
    icyGeneratePlatforms(cw, groundY);

    // Update UI elements
    updateIcyUI();

    const textEl = document.getElementById('icy-timer-text');
    const barEl = document.getElementById('icy-timer-bar');
    if (textEl) textEl.textContent = icyConfig.time > 0 ? icyConfig.time.toFixed(1) + 's' : 'Bez limitu';
    if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#38bdf8';
    }

    const startBtn = document.getElementById('icy-btn-start');
    const restartBtn = document.getElementById('icy-btn-restart');
    const configBtn = document.getElementById('icy-btn-config');
    const hintEl = document.getElementById('icy-ready-hint');

    if (startBtn) startBtn.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
    if (configBtn) configBtn.classList.add('hidden');
    if (hintEl) hintEl.classList.remove('hidden');

    const msgEl = document.getElementById('icy-message');
    if (msgEl) {
        msgEl.innerHTML = '<span class="ready-status-banner">⚡ TRYB KONFIGURACJI · Kliknij Rozpocznij lub wciśnij SPACJĘ / ENTER</span>';
        msgEl.className = 'icy-message';
    }

    // Render single preview frame
    icyRender();
}

function resetIcyGame() {
    icySetupReady(true);
    startIcyGame();
}

// ─── Platform Generation ─────────────────────────────────────────────

function icyGeneratePlatforms(cw, groundY) {
    icyState.platforms = [];

    // Floor 0: Ground platform
    const groundPlat = {
        floor: 0,
        x: 0,
        y: groundY,
        w: cw,
        h: 50,
        type: 'ground',
    };
    icyState.platforms.push(groundPlat);
    icyState.player.groundPlatform = groundPlat;

    // Generate floors upwards (at least 200 floors, or target + 50)
    const totalFloorsToGen = Math.max(150, (icyConfig.targetFloors || 0) + 30);
    const spacing = 72; // vertical gap between platforms
    let lastX = cw / 2 - icyConfig.platW / 2;

    for (let f = 1; f <= totalFloorsToGen; f++) {
        const platY = groundY - f * spacing;
        let w = icyConfig.platW;
        let type = 'normal';

        if (icyConfig.targetFloors > 0 && f === icyConfig.targetFloors) {
            type = 'goal';
            w = Math.max(160, w + 40);
        } else if (f % 7 === 0) {
            type = 'bouncy';
        } else if (f % 5 === 0) {
            type = 'ice';
        }

        // Generate staggered, accessible X position
        const minX = 20;
        const maxX = cw - w - 20;
        let x;
        // Alternate sides with random variance to create rhythm
        if (Math.random() < 0.65) {
            const shift = (Math.random() * 120 + 80) * (Math.random() < 0.5 ? 1 : -1);
            x = Math.max(minX, Math.min(maxX, lastX + shift));
        } else {
            x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
        }
        lastX = x;

        icyState.platforms.push({
            floor: f,
            x: x,
            y: platY,
            w: w,
            h: 14,
            type: type,
        });
    }
}

// ─── UI & HUD ────────────────────────────────────────────────────────

function updateIcyUI() {
    const fEl = document.getElementById('icy-floor');
    const tfEl = document.getElementById('icy-target-floor');
    const bEl = document.getElementById('icy-best-floor');
    const cEl = document.getElementById('icy-combo');

    if (fEl) fEl.textContent = icyState.currentFloor;
    if (tfEl) tfEl.textContent = icyConfig.targetFloors > 0 ? icyConfig.targetFloors : '∞ (Endless)';
    if (bEl) bEl.textContent = icyState.bestFloor;
    if (cEl) {
        if (icyState.combo > 1) {
            cEl.textContent = `Combo ×${icyState.combo} 🔥`;
            cEl.style.color = '#f59e0b';
        } else {
            cEl.textContent = '—';
            cEl.style.color = '#71717a';
        }
    }
}

function showIcyMsg(text, cls) {
    const el = document.getElementById('icy-message');
    if (!el) return;
    el.innerHTML = text;
    el.className = `icy-message ${cls}`;
}

// ─── Game Loop & Physics ─────────────────────────────────────────────

function startIcyGame() {
    if (sharedState.status === 'PREPARING') return;

    const startBtn = document.getElementById('icy-btn-start');
    const restartBtn = document.getElementById('icy-btn-restart');
    const configBtn = document.getElementById('icy-btn-config');
    const hintEl = document.getElementById('icy-ready-hint');

    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');
    if (hintEl) hintEl.classList.add('hidden');

    const msgEl = document.getElementById('icy-message');
    if (msgEl) {
        msgEl.innerHTML = '';
        msgEl.className = 'icy-message';
    }

    startCountdown(() => {
        if (sharedState.currentHack === 'icytower') {
            sharedState.status = 'PLAYING';
            if (icyConfig.time > 0) startIcyTimer();
            icyState.animFrame = requestAnimationFrame(icyGameLoop);
        }
    });
}

function startIcyTimer() {
    const textEl = document.getElementById('icy-timer-text');
    const barEl = document.getElementById('icy-timer-bar');
    startGenericTimer(icyConfig.time, textEl, barEl, () => {
        if (sharedState.status === 'PLAYING') {
            icyGameOver('Czas minął!');
        }
    }, (rem, frac) => {
        if (barEl) barEl.style.background = frac > 0.4 ? '#38bdf8' : frac > 0.2 ? '#f59e0b' : '#ef4444';
    });
}

function icyGameLoop() {
    if (sharedState.status !== 'PLAYING') return;

    icyUpdate();
    icyRender();

    icyState.animFrame = requestAnimationFrame(icyGameLoop);
}

function icyUpdate() {
    const p = icyState.player;
    const canvas = icyState.canvas;
    const cw = canvas.width;
    const ch = canvas.height;

    // Horizontal Movement & Acceleration (slower, smoother left-to-right control)
    const isIce = p.onGround && p.groundPlatform && p.groundPlatform.type === 'ice';
    const accel = 0.42;
    const friction = isIce ? 0.975 : (p.onGround ? 0.85 : 0.92);
    const maxSpeed = 4.8;

    if (icyState.keys.left) {
        p.vx -= accel;
        p.facing = -1;
        p.runFrame += 0.20;
    } else if (icyState.keys.right) {
        p.vx += accel;
        p.facing = 1;
        p.runFrame += 0.20;
    } else {
        p.vx *= friction;
        p.runFrame = 0;
    }

    // Clamp speed
    p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx));

    // Vertical Movement & Slower Floatier Gravity
    const gravity = icyConfig.gravity || 0.10;
    p.vy += gravity;
    if (p.vy > 7.5) p.vy = 7.5; // Slower terminal fall velocity (gives much better airborne control)

    // Jump Input
    if (icyState.keys.jump && p.onGround) {
        // High speed sprint gives massive momentum jump bonus!
        const speedRatio = Math.abs(p.vx) / maxSpeed;
        const baseJump = -Math.sqrt(2 * gravity * 135);
        const bonus = speedRatio * Math.abs(baseJump) * 0.55;
        p.vy = baseJump - bonus;
        p.onGround = false;
        p.groundPlatform = null;

        // Visual takeoff effect
        const sparkColor = speedRatio > 0.6 ? '#f59e0b' : '#38bdf8';
        icySpawnSparks(p.x + p.w / 2, p.y + p.h, Math.round(6 + speedRatio * 10), sparkColor);

        if (speedRatio > 0.7) {
            icyAddFloatingText(p.x + p.w / 2, p.y - 10, 'HIGH JUMP!', '#f59e0b');
        }
    }

    // Apply Velocity
    const prevY = p.y;
    p.x += p.vx;
    p.y += p.vy;

    // Wall Bouncing & Collision (ONLY bounce if moving INTO the wall to prevent sticking/vibrating)
    if (p.x <= 0) {
        p.x = 0;
        if (p.vx < 0) {
            if (Math.abs(p.vx) > 1.2) {
                p.vx = -p.vx * 0.85;
                icySpawnSparks(p.x + 2, p.y + p.h / 2, 8, '#38bdf8');
            } else {
                p.vx = 0;
            }
        }
    } else if (p.x + p.w >= cw) {
        p.x = cw - p.w;
        if (p.vx > 0) {
            if (p.vx > 1.2) {
                p.vx = -p.vx * 0.85;
                icySpawnSparks(p.x + p.w - 2, p.y + p.h / 2, 8, '#38bdf8');
            } else {
                p.vx = 0;
            }
        }
    }

    // Platform Collisions (only when falling downwards)
    p.onGround = false;
    p.groundPlatform = null;

    if (p.vy >= 0) {
        const footPrev = prevY + p.h;
        const footCurr = p.y + p.h;

        for (const plat of icyState.platforms) {
            // Check horizontal bounds
            if (p.x + p.w - 4 >= plat.x && p.x + 4 <= plat.x + plat.w) {
                // Check if crossed the top of platform this frame
                if (footPrev <= plat.y + 4 && footCurr >= plat.y) {
                    p.y = plat.y - p.h;
                    p.vy = 0;
                    p.onGround = true;
                    p.groundPlatform = plat;

                    // Handle Bouncy Pad (scaled smoothly with gravity)
                    if (plat.type === 'bouncy') {
                        p.vy = -Math.sqrt(2 * gravity * 280);
                        p.onGround = false;
                        p.groundPlatform = null;
                        icySpawnSparks(p.x + p.w / 2, plat.y, 14, '#d946ef');
                        icyAddFloatingText(p.x + p.w / 2, plat.y - 15, 'BOUNCE! 🚀', '#d946ef');
                    }

                    // Floor progress & Combo check
                    if (plat.floor > icyState.currentFloor) {
                        const skipped = plat.floor - icyState.lastLandedFloor;
                        icyState.currentFloor = plat.floor;
                        if (plat.floor > icyState.bestFloor) {
                            icyState.bestFloor = plat.floor;
                        }

                        // Check combo (skipping floors)
                        if (skipped >= 2) {
                            icyState.combo++;
                            let comboMsg = `+${skipped} FLOORS!`;
                            let comboColor = '#38bdf8';
                            if (skipped === 2) { comboMsg = 'GOOD! +2'; comboColor = '#38bdf8'; }
                            else if (skipped === 3) { comboMsg = 'SWEET! +3'; comboColor = '#10b981'; }
                            else if (skipped === 4) { comboMsg = 'GREAT! +4'; comboColor = '#f59e0b'; }
                            else if (skipped >= 5) { comboMsg = 'SUPER JUMP! 🔥'; comboColor = '#ef4444'; }

                            icyAddFloatingText(p.x + p.w / 2, plat.y - 20, comboMsg, comboColor);
                        } else if (skipped === 1) {
                            icyState.combo = 0;
                        }

                        icyState.lastLandedFloor = plat.floor;
                        updateIcyUI();

                        // Check Win condition
                        if (icyConfig.targetFloors > 0 && plat.floor >= icyConfig.targetFloors && !icyState.hasWon) {
                            icyWin();
                            return;
                        }
                    }
                    break;
                }
            }
        }
    }

    // Camera Tracking (Smooth follow up)
    const targetCamY = p.y - ch * 0.45;
    if (targetCamY < icyState.cameraY) {
        icyState.cameraY += (targetCamY - icyState.cameraY) * 0.15;
    }

    // Auto-scroll / Rising Corruption Abyss
    if (icyState.currentFloor >= 3 && icyConfig.scrollSpeed > 0) {
        icyState.scrollActive = true;
        icyState.cameraY -= (icyConfig.scrollSpeed * 0.6);
    }

    // Abyss line follows camera bottom
    icyState.abyssY = icyState.cameraY + ch;

    // Check Death (Fell into abyss below camera view)
    if (p.y > icyState.cameraY + ch + 25) {
        icyGameOver('Spadłeś w otchłań!');
        return;
    }

    // Update Particles
    for (let i = icyState.particles.length - 1; i >= 0; i--) {
        const pt = icyState.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= pt.decay;
        if (pt.life <= 0) {
            icyState.particles.splice(i, 1);
        }
    }

    // Update Floating Texts
    for (let i = icyState.floatingTexts.length - 1; i >= 0; i--) {
        const ft = icyState.floatingTexts[i];
        ft.y -= 1.2;
        ft.life -= 0.025;
        if (ft.life <= 0) {
            icyState.floatingTexts.splice(i, 1);
        }
    }
}

function icySpawnSparks(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        icyState.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color || '#38bdf8',
            life: 1.0,
            decay: Math.random() * 0.04 + 0.03,
            size: Math.random() * 2.5 + 1.5,
        });
    }
}

function icyAddFloatingText(x, y, text, color) {
    icyState.floatingTexts.push({
        x, y, text,
        color: color || '#f59e0b',
        life: 1.0,
    });
}

function icyWin() {
    icyState.hasWon = true;
    sharedState.status = 'WON';
    clearInterval(sharedState.timerInterval);
    if (icyState.animFrame) cancelAnimationFrame(icyState.animFrame);

    // Massive fireworks
    for (let i = 0; i < 40; i++) {
        icySpawnSparks(icyState.player.x + 12, icyState.player.y + 16, 2, '#10b981');
    }

    showIcyMsg(`🎉 MISJA ZAKOŃCZONA! Zdobyto ${icyConfig.targetFloors} piętro wieży!`, 'icy-msg-success');

    const startBtn = document.getElementById('icy-btn-start');
    const restartBtn = document.getElementById('icy-btn-restart');
    const configBtn = document.getElementById('icy-btn-config');
    if (startBtn) startBtn.classList.add('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');

    icyRender();
}

function icyGameOver(reason) {
    sharedState.status = 'GAMEOVER';
    clearInterval(sharedState.timerInterval);
    if (icyState.animFrame) cancelAnimationFrame(icyState.animFrame);

    showIcyMsg(`💀 ${reason} Osiągnięte piętro: ${icyState.currentFloor}`, 'icy-msg-fail');

    const restartBtn = document.getElementById('icy-btn-restart');
    const configBtn = document.getElementById('icy-btn-config');
    if (restartBtn) restartBtn.classList.remove('hidden');
    if (configBtn) configBtn.classList.remove('hidden');

    icyRender();
}

// ─── Rendering ────────────────────────────────────────────────────────

function icyRender() {
    const ctx = icyState.ctx;
    const canvas = icyState.canvas;
    if (!ctx || !canvas) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const camY = icyState.cameraY;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, '#060b14');
    bgGrad.addColorStop(1, '#0c162c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Draw Cyber Tower side walls & grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    const offsetY = (-camY) % gridSpacing;
    for (let y = offsetY; y < ch; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
    }

    // Side wall borders
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1, 0); ctx.lineTo(1, ch);
    ctx.moveTo(cw - 1, 0); ctx.lineTo(cw - 1, ch);
    ctx.stroke();
    ctx.restore();

    // Draw Platforms
    for (const plat of icyState.platforms) {
        const screenY = plat.y - camY;
        // Cull platforms off-screen
        if (screenY + plat.h < -20 || screenY > ch + 40) continue;

        ctx.save();
        if (plat.type === 'ground') {
            // Ground floor
            ctx.fillStyle = '#111827';
            ctx.fillRect(plat.x, screenY, plat.w, plat.h);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.strokeRect(plat.x, screenY, plat.w, plat.h);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 12px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('// POZIOM BAZOWY (START)', cw / 2, screenY + 28);
        } else if (plat.type === 'goal') {
            // Mainframe Goal roof
            const gGrad = ctx.createLinearGradient(plat.x, screenY, plat.x, screenY + plat.h);
            gGrad.addColorStop(0, '#10b981');
            gGrad.addColorStop(1, '#064e3b');
            ctx.fillStyle = gGrad;
            ctx.fillRect(plat.x, screenY, plat.w, plat.h);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.strokeRect(plat.x, screenY, plat.w, plat.h);

            // Goal beacon label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`🏆 MAINFRAME [#${plat.floor}]`, plat.x + plat.w / 2, screenY + 10);
        } else if (plat.type === 'bouncy') {
            // Bouncy Pad (Magenta)
            const bGrad = ctx.createLinearGradient(plat.x, screenY, plat.x, screenY + plat.h);
            bGrad.addColorStop(0, '#d946ef');
            bGrad.addColorStop(1, '#701a75');
            ctx.fillStyle = bGrad;
            ctx.fillRect(plat.x, screenY, plat.w, plat.h);
            ctx.strokeStyle = '#f472b6';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(plat.x, screenY, plat.w, plat.h);

            // Spring indicator
            ctx.fillStyle = '#ffffff';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`▲ BOUNCE [#${plat.floor}] ▲`, plat.x + plat.w / 2, screenY + 10);
        } else if (plat.type === 'ice') {
            // Ice platform (Slippery cyan)
            const iGrad = ctx.createLinearGradient(plat.x, screenY, plat.x, screenY + plat.h);
            iGrad.addColorStop(0, '#67e8f9');
            iGrad.addColorStop(1, '#0e7490');
            ctx.fillStyle = iGrad;
            ctx.fillRect(plat.x, screenY, plat.w, plat.h);
            ctx.strokeStyle = '#a5f3fc';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(plat.x, screenY, plat.w, plat.h);

            ctx.fillStyle = '#083344';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`❄ ICE [#${plat.floor}]`, plat.x + plat.w / 2, screenY + 10);
        } else {
            // Normal Platform
            const nGrad = ctx.createLinearGradient(plat.x, screenY, plat.x, screenY + plat.h);
            nGrad.addColorStop(0, '#1e293b');
            nGrad.addColorStop(1, '#0f172a');
            ctx.fillStyle = nGrad;
            ctx.fillRect(plat.x, screenY, plat.w, plat.h);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(plat.x, screenY, plat.w, plat.h);

            // Glowing top edge
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(plat.x + 2, screenY, plat.w - 4, 2);

            // Floor number tag
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`[ ${plat.floor} ]`, plat.x + plat.w / 2, screenY + 10);
        }
        ctx.restore();
    }

    // Draw Rising Abyss / Danger Hazard Bar at bottom
    if (icyState.scrollActive) {
        const abyssScreenY = icyState.abyssY - camY;
        if (abyssScreenY < ch) {
            ctx.save();
            const hazardGrad = ctx.createLinearGradient(0, abyssScreenY, 0, ch);
            hazardGrad.addColorStop(0, 'rgba(239, 68, 68, 0.6)');
            hazardGrad.addColorStop(1, 'rgba(153, 27, 27, 0.95)');
            ctx.fillStyle = hazardGrad;
            ctx.fillRect(0, abyssScreenY, cw, ch - abyssScreenY);

            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, abyssScreenY);
            ctx.lineTo(cw, abyssScreenY);
            ctx.stroke();

            ctx.fillStyle = '#fee2e2';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠ OTCHŁAŃ / SYSTEM FAILURE ⚠', cw / 2, abyssScreenY + 16);
            ctx.restore();
        }
    }

    // Draw Particles
    for (const pt of icyState.particles) {
        const screenY = pt.y - camY;
        ctx.save();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.beginPath();
        ctx.arc(pt.x, screenY, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Draw Player
    const p = icyState.player;
    const playerScreenY = p.y - camY;

    ctx.save();
    ctx.translate(p.x + p.w / 2, playerScreenY + p.h / 2);
    if (p.facing === -1) {
        ctx.scale(-1, 1);
    }

    // Cyber Runner Avatar
    // Body / Coat
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-10, -10, 20, 20);

    // Head / Helmet
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-8, -16, 16, 10);

    // Glowing Neon Visor
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.fillRect(0, -14, 8, 4);
    ctx.shadowBlur = 0;

    // Running legs / Jump stance
    ctx.fillStyle = '#1e293b';
    if (!p.onGround) {
        // Jump pose: tucked legs
        ctx.fillRect(-8, 10, 6, 6);
        ctx.fillRect(2, 8, 6, 8);
    } else if (Math.abs(p.vx) > 0.5) {
        // Running leg animation
        const legOffset = Math.sin(p.runFrame * 2) * 5;
        ctx.fillRect(-8, 10, 6, 6 - legOffset);
        ctx.fillRect(2, 10, 6, 6 + legOffset);
    } else {
        // Idle stance
        ctx.fillRect(-8, 10, 6, 6);
        ctx.fillRect(2, 10, 6, 6);
    }

    // Scarf / energy trail
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-12, -8, 4, 8);
    ctx.restore();

    // Draw Floating Texts
    for (const ft of icyState.floatingTexts) {
        const screenY = ft.y - camY;
        ctx.save();
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.textAlign = 'center';
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 8;
        ctx.fillText(ft.text, ft.x, screenY);
        ctx.restore();
    }

    // Top HUD in-canvas
    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 20, 0.85)';
    ctx.fillRect(0, 0, cw, 28);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cw, 28);

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(`PIĘTRO: ${icyState.currentFloor} / ${icyConfig.targetFloors > 0 ? icyConfig.targetFloors : '∞'}`, 12, 18);

    ctx.textAlign = 'right';
    if (icyState.combo > 1) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`COMBO ×${icyState.combo}!`, cw - 12, 18);
    } else {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`REKORD: ${icyState.bestFloor}`, cw - 12, 18);
    }
    ctx.restore();
}

// ─── Event Wiring ────────────────────────────────────────────────────

function icyWireEvents() {
    window.addEventListener('keydown', e => {
        if (sharedState.currentHack !== 'icytower') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

        // Space / Enter starts game when in READY mode
        if (sharedState.status === 'READY') {
            if (e.code === 'Space' || e.key === 'Enter') {
                e.preventDefault();
                startIcyGame();
                return;
            }
        }

        if (sharedState.status !== 'PLAYING') return;

        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            icyState.keys.left = true;
            e.preventDefault();
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            icyState.keys.right = true;
            e.preventDefault();
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
            icyState.keys.jump = true;
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', e => {
        if (sharedState.currentHack !== 'icytower') return;

        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            icyState.keys.left = false;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            icyState.keys.right = false;
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
            icyState.keys.jump = false;
        }
    });

    // Preset buttons
    document.querySelectorAll('#icy-preset-btns button').forEach(btn => {
        btn.addEventListener('click', () => {
            icyApplyPreset(btn.dataset.preset);
            document.querySelectorAll('#icy-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            btn.classList.add('preset-active');
            icySetupReady(true);
        });
    });

    // Custom config inputs live preview
    ['icy-in-floors', 'icy-in-platw', 'icy-in-scroll', 'icy-in-gravity', 'icy-in-time'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            document.querySelectorAll('#icy-preset-btns button').forEach(b => b.classList.remove('preset-active'));
            icyReadCustomConfig();
            if (sharedState.status === 'READY') {
                icySetupReady(true);
            }
        });
    });

    // Action buttons
    document.getElementById('icy-btn-start')?.addEventListener('click', () => {
        icyReadCustomConfig();
        startIcyGame();
    });

    document.getElementById('icy-btn-restart')?.addEventListener('click', () => {
        icyReadCustomConfig();
        resetIcyGame();
    });

    document.getElementById('icy-btn-config')?.addEventListener('click', () => {
        icySetupReady(true);
    });
}
