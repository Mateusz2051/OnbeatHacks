
const HACKS = ['atmhold', 'cables', 'puzzle', 'lightsout', 'slider', 'dotsequence', 'brickbreaker', 'flappybird', 'arrows', 'breach', 'icytower', 'switches'];

const hackMeta = {
    atmhold:      { label: 'ATM Hold',          color: 'pink'   },
    cables:       { label: 'Kabelki',            color: 'blue'   },
    puzzle:       { label: '15-Puzzle',          color: 'teal'   },
    lightsout:    { label: 'Lights Out',         color: 'green'  },
    slider:       { label: 'Slider',             color: 'orange' },
    dotsequence:  { label: 'Kropki',             color: 'cyan'   },
    brickbreaker: { label: 'Brick Breaker',      color: 'amber'  },
    flappybird:   { label: 'Flappy Bird',        color: 'pink'   },
    arrows:       { label: 'Strzałki',           color: 'pink'   },
    breach:       { label: 'Protokół włamania',  color: 'green'  },
    icytower:     { label: 'Icy Tower',          color: 'cyan'   },
    switches:     { label: 'Skrzynka Elektryczna', color: 'yellow' },
};

// Global shared state (each hack reads/writes what it needs)
const sharedState = {
    currentHack: null,
    status: 'IDLE', // IDLE | READY | PREPARING | PLAYING | PAUSED | WON | GAMEOVER
    timerInterval: null,
    countdownInterval: null,
    animFrame: null,
};

// ─── Navigation ──────────────────────────────────────────────────────

function openHack(hackId) {
    // Cancel any ongoing countdown or timers
    if (sharedState.countdownInterval) {
        clearInterval(sharedState.countdownInterval);
        sharedState.countdownInterval = null;
    }
    clearInterval(sharedState.timerInterval);
    cancelAnimationFrame(sharedState.animFrame);
    if (typeof bbAnimFrame !== 'undefined' && bbAnimFrame) { cancelAnimationFrame(bbAnimFrame); bbAnimFrame = null; }
    if (typeof fbState !== 'undefined' && fbState.animFrame) { cancelAnimationFrame(fbState.animFrame); fbState.animFrame = null; }
    if (typeof icyState !== 'undefined' && icyState.animFrame) { cancelAnimationFrame(icyState.animFrame); icyState.animFrame = null; }
    document.querySelectorAll('.countdown-overlay').forEach(el => el.style.display = 'none');

    sharedState.currentHack = hackId;
    sharedState.status = 'READY';
    document.getElementById('hub-view').classList.add('hidden');
    document.getElementById('tool-view').classList.remove('hidden');

    // Hide all sections, show the requested one
    document.querySelectorAll('.hack-section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    const currentSection = document.getElementById(`hack-${hackId}`);
    if (currentSection) {
        currentSection.classList.remove('hidden');
        currentSection.classList.add('active');
    }

    // Update badge
    const badge = document.getElementById('current-hack-badge');
    if (badge) {
        badge.textContent = hackMeta[hackId]?.label || hackId;
    }

    // Init the hack (each hack prepares its READY state and waits for user to start)
    switch (hackId) {
        case 'atmhold':      initAtmHold();      break;
        case 'cables':       initCables();       break;
        case 'puzzle':       initPuzzle();       break;
        case 'lightsout':    initLightsOut();    break;
        case 'slider':       initSlider();       break;
        case 'dotsequence':  initDotSequence();  break;
        case 'brickbreaker': initBrickBreaker(); break;
        case 'flappybird':   initFlappyBird();   break;
        case 'arrows':       initArrows();       break;
        case 'breach':       initBreach();       break;
        case 'icytower':     initIcyTower();     break;
        case 'switches':     initSwitches();     break;
    }
}

function showHub() {
    // Stop any running countdown
    if (sharedState.countdownInterval) {
        clearInterval(sharedState.countdownInterval);
        sharedState.countdownInterval = null;
    }
    // Stop any running game
    clearInterval(sharedState.timerInterval);
    cancelAnimationFrame(sharedState.animFrame);
    // Cancel game-specific animation frames
    if (typeof bbAnimFrame !== 'undefined' && bbAnimFrame) { cancelAnimationFrame(bbAnimFrame); bbAnimFrame = null; }
    if (typeof fbState !== 'undefined' && fbState.animFrame) { cancelAnimationFrame(fbState.animFrame); fbState.animFrame = null; }
    if (typeof icyState !== 'undefined' && icyState.animFrame) { cancelAnimationFrame(icyState.animFrame); icyState.animFrame = null; }
    
    // Hide all countdown overlays
    document.querySelectorAll('.countdown-overlay').forEach(el => el.style.display = 'none');

    sharedState.status = 'IDLE';
    sharedState.currentHack = null;

    document.querySelectorAll('.hack-section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });

    document.getElementById('hub-view').classList.remove('hidden');
    document.getElementById('tool-view').classList.add('hidden');
}

// ─── Utilities ───────────────────────────────────────────────────────

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function formatTime(ms) {
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    const s = (total % 60).toFixed(1).padStart(4, '0');
    return m > 0 ? `${m}:${s}` : `${parseFloat(s).toFixed(1)}s`;
}

function startCountdown(onDone) {
    if (sharedState.countdownInterval) {
        clearInterval(sharedState.countdownInterval);
        sharedState.countdownInterval = null;
    }

    sharedState.status = 'PREPARING';
    const targetHack = sharedState.currentHack;
    const hackEl = document.getElementById(`hack-${targetHack}`);
    if (!hackEl) {
        sharedState.status = 'PLAYING';
        onDone();
        return;
    }

    let overlay = hackEl.querySelector('.countdown-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'countdown-overlay';
        hackEl.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    let count = 3;
    overlay.innerHTML = `<div class="countdown-num">${count}</div>`;

    const iv = setInterval(() => {
        // If user navigated away or changed hack
        if (sharedState.currentHack !== targetHack) {
            clearInterval(iv);
            overlay.style.display = 'none';
            return;
        }
        count--;
        if (count > 0) {
            overlay.innerHTML = `<div class="countdown-num">${count}</div>`;
        } else {
            clearInterval(iv);
            sharedState.countdownInterval = null;
            overlay.style.display = 'none';
            if (sharedState.currentHack === targetHack) {
                sharedState.status = 'PLAYING';
                onDone();
            }
        }
    }, 800);

    sharedState.countdownInterval = iv;
}

// ─── Generic countdown timer helper ──────────────────────────────────
// Calls onTick(remaining, fraction) every 100ms, calls onExpire() at 0

function startGenericTimer(seconds, textEl, barEl, onExpire, onTick) {
    clearInterval(sharedState.timerInterval);
    let remaining = seconds;
    const total = seconds;

    const update = () => {
        if (textEl) textEl.textContent = remaining.toFixed(1) + 's';
        if (barEl) barEl.style.width = ((remaining / total) * 100) + '%';
        if (onTick) onTick(remaining, remaining / total);
    };
    update();

    sharedState.timerInterval = setInterval(() => {
        if (sharedState.status !== 'PLAYING') return;
        remaining = Math.max(0, parseFloat((remaining - 0.1).toFixed(1)));
        update();
        if (remaining <= 0) {
            clearInterval(sharedState.timerInterval);
            onExpire();
        }
    }, 100);
}

// Global Enter shortcut to start current hack when in READY mode
window.addEventListener('keydown', e => {
    if (sharedState.status !== 'READY' || !sharedState.currentHack) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Enter') {
        const btn = document.getElementById(`${sharedState.currentHack}-btn-start`);
        if (btn && !btn.classList.contains('hidden')) {
            e.preventDefault();
            btn.click();
        }
    }
});
