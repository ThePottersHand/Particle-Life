(() => {
    'use strict';

    // ── Canvas Setup ──────────────────────────────────────────────
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Species Colors ────────────────────────────────────────────
    const SPECIES_COLORS = [
        { h: 340, s: 85, l: 60, hex: '#f2567a' },  // Rose
        { h: 200, s: 90, l: 55, hex: '#1a9dff' },   // Azure
        { h: 145, s: 75, l: 50, hex: '#20c97a' },   // Emerald
        { h: 45,  s: 95, l: 58, hex: '#f5a623' },   // Amber
        { h: 270, s: 80, l: 65, hex: '#a855f7' },   // Violet
        { h: 180, s: 70, l: 55, hex: '#2dd4bf' },   // Teal
        { h: 15,  s: 90, l: 55, hex: '#f06530' },   // Flame
        { h: 310, s: 75, l: 60, hex: '#e455ae' },   // Magenta
    ];

    // ── Simulation State ──────────────────────────────────────────
    let config = {
        numParticles: 300,
        numSpecies: 6,
        interactionRange: 120,
        friction: 0.15,
        forceStrength: 1.0,
        trailAlpha: 0.12,
    };

    let rules = [];       // rules[i][j] = how species i feels about species j (-1 to 1)
    let particles = [];
    let paused = false;
    let mouseDown = false;
    let mouseX = 0, mouseY = 0;

    // ── Spatial Grid for Performance ──────────────────────────────
    let grid = {};
    let gridCellSize = 120;

    function gridKey(cx, cy) {
        return cx * 10000 + cy;
    }

    function buildGrid() {
        grid = {};
        gridCellSize = config.interactionRange;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const cx = Math.floor(p.x / gridCellSize);
            const cy = Math.floor(p.y / gridCellSize);
            const key = gridKey(cx, cy);
            if (!grid[key]) grid[key] = [];
            grid[key].push(i);
        }
    }

    function getNeighbors(px, py) {
        const cx = Math.floor(px / gridCellSize);
        const cy = Math.floor(py / gridCellSize);
        const result = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = gridKey(cx + dx, cy + dy);
                if (grid[key]) {
                    for (let i = 0; i < grid[key].length; i++) {
                        result.push(grid[key][i]);
                    }
                }
            }
        }
        return result;
    }

    // ── Rule Generation ───────────────────────────────────────────
    function randomRules() {
        const n = config.numSpecies;
        rules = [];
        for (let i = 0; i < n; i++) {
            rules[i] = [];
            for (let j = 0; j < n; j++) {
                rules[i][j] = Math.random() * 2 - 1;
            }
        }
    }

    // ── Presets ───────────────────────────────────────────────────
    const PRESETS = {
        symbiosis: () => {
            config.numSpecies = 6;
            config.interactionRange = 140;
            config.friction = 0.12;
            config.forceStrength = 1.0;
            const n = config.numSpecies;
            rules = [];
            for (let i = 0; i < n; i++) {
                rules[i] = [];
                for (let j = 0; j < n; j++) {
                    if (i === j) rules[i][j] = -0.3;              // mild self-repulsion
                    else if (j === (i + 1) % n) rules[i][j] = 0.8; // strongly attracted to next
                    else if (j === (i + n - 1) % n) rules[i][j] = 0.5; // attracted to previous
                    else rules[i][j] = -0.1;
                }
            }
        },
        galaxies: () => {
            config.numSpecies = 4;
            config.interactionRange = 180;
            config.friction = 0.08;
            config.forceStrength = 0.8;
            const n = config.numSpecies;
            rules = [];
            for (let i = 0; i < n; i++) {
                rules[i] = [];
                for (let j = 0; j < n; j++) {
                    if (i === j) rules[i][j] = 0.6;
                    else rules[i][j] = -0.4 + Math.random() * 0.3;
                }
            }
        },
        mitosis: () => {
            config.numSpecies = 3;
            config.interactionRange = 100;
            config.friction = 0.18;
            config.forceStrength = 1.5;
            rules = [
                [ 0.8, -0.5,  0.3],
                [ 0.3,  0.8, -0.5],
                [-0.5,  0.3,  0.8],
            ];
        },
        snakes: () => {
            config.numSpecies = 5;
            config.interactionRange = 80;
            config.friction = 0.05;
            config.forceStrength = 1.2;
            const n = config.numSpecies;
            rules = [];
            for (let i = 0; i < n; i++) {
                rules[i] = [];
                for (let j = 0; j < n; j++) {
                    if (j === (i + 1) % n) rules[i][j] = 1.0;
                    else if (i === j) rules[i][j] = 0.1;
                    else rules[i][j] = -0.2;
                }
            }
        },
        ecosystem: () => {
            config.numSpecies = 6;
            config.interactionRange = 130;
            config.friction = 0.14;
            config.forceStrength = 1.0;
            rules = [
                [ 0.2,  0.6, -0.4,  0.0,  0.3, -0.2],
                [-0.3,  0.1,  0.7, -0.5,  0.0,  0.2],
                [ 0.5, -0.3,  0.0,  0.6, -0.4,  0.1],
                [ 0.0,  0.4, -0.2,  0.3,  0.7, -0.5],
                [-0.4,  0.0,  0.3, -0.2,  0.1,  0.8],
                [ 0.3, -0.5,  0.0,  0.4, -0.3,  0.2],
            ];
        },
        chaos: () => {
            config.numSpecies = 8;
            config.interactionRange = 100;
            config.friction = 0.10;
            config.forceStrength = 1.8;
            const n = config.numSpecies;
            rules = [];
            for (let i = 0; i < n; i++) {
                rules[i] = [];
                for (let j = 0; j < n; j++) {
                    rules[i][j] = Math.random() * 2 - 1;
                }
            }
        }
    };

    // ── Particle Creation ─────────────────────────────────────────
    function createParticles() {
        particles = [];
        for (let i = 0; i < config.numParticles; i++) {
            particles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: 0,
                vy: 0,
                species: Math.floor(Math.random() * config.numSpecies),
            });
        }
    }

    // ── Force Function ────────────────────────────────────────────
    // Bell-curve-like force: repulsive at very close range, then
    // attractive or repulsive based on rule, fading with distance
    function forceMagnitude(r, rule) {
        const rNorm = r / config.interactionRange;
        const minDist = 0.15;  // strong repulsion zone

        if (rNorm < minDist) {
            // Strong repulsion at very close range (prevents overlap)
            return (rNorm / minDist - 1) * 2.0;
        } else {
            // Rule-based force that peaks then fades
            const t = (rNorm - minDist) / (1 - minDist);
            return rule * (1 - Math.abs(2 * t - 1));
        }
    }

    // ── Physics Step ──────────────────────────────────────────────
    function step(dt) {
        buildGrid();

        const range = config.interactionRange;
        const rangeSq = range * range;
        const strength = config.forceStrength;
        const friction = config.friction;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            let fx = 0, fy = 0;

            const neighbors = getNeighbors(p.x, p.y);

            for (let ni = 0; ni < neighbors.length; ni++) {
                const j = neighbors[ni];
                if (i === j) continue;
                const q = particles[j];

                const dx = q.x - p.x;
                const dy = q.y - p.y;
                const distSq = dx * dx + dy * dy;

                if (distSq > 0 && distSq < rangeSq) {
                    const dist = Math.sqrt(distSq);
                    const rule = rules[p.species][q.species];
                    const f = forceMagnitude(dist, rule) * strength;
                    fx += (dx / dist) * f;
                    fy += (dy / dist) * f;
                }
            }

            // Mouse attraction
            if (mouseDown) {
                const dx = mouseX - p.x;
                const dy = mouseY - p.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq + 1);
                const f = 5.0 / (1 + dist * 0.01);
                fx += (dx / dist) * f;
                fy += (dy / dist) * f;
            }

            p.vx += fx * dt;
            p.vy += fy * dt;

            // Friction
            p.vx *= (1 - friction);
            p.vy *= (1 - friction);
        }

        // Update positions
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Wrap around edges
            if (p.x < 0) p.x += W;
            if (p.x >= W) p.x -= W;
            if (p.y < 0) p.y += H;
            if (p.y >= H) p.y -= H;
        }
    }

    // ── Rendering ─────────────────────────────────────────────────
    function render() {
        // Trail effect: semi-transparent overlay instead of full clear
        ctx.fillStyle = `rgba(10, 10, 15, ${config.trailAlpha})`;
        ctx.fillRect(0, 0, W, H);

        // Draw particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const col = SPECIES_COLORS[p.species];
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            const glow = Math.min(1, speed * 0.15 + 0.4);
            const radius = 2.0 + glow * 1.5;

            // Main particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${col.h}, ${col.s}%, ${col.l}%, ${0.6 + glow * 0.4})`;
            ctx.fill();

            // Glow
            if (speed > 1) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius + 2 + speed * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${col.h}, ${col.s}%, ${col.l}%, ${glow * 0.15})`;
                ctx.fill();
            }
        }
    }

    // ── Main Loop ─────────────────────────────────────────────────
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTime = 0;

    function loop(now) {
        requestAnimationFrame(loop);

        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(rawDt, 0.05); // cap delta

        // FPS counter
        frameCount++;
        fpsTime += rawDt;
        if (fpsTime >= 0.5) {
            document.getElementById('fps').textContent =
                Math.round(frameCount / fpsTime) + ' FPS';
            frameCount = 0;
            fpsTime = 0;
        }

        if (!paused) {
            step(dt * 60);  // normalize to ~60fps feel
            render();
        }
    }

    // ── Rule Matrix UI ────────────────────────────────────────────
    function buildMatrixUI() {
        const container = document.getElementById('rule-matrix');
        const n = config.numSpecies;

        let html = '<table><tr><th></th>';
        for (let j = 0; j < n; j++) {
            html += `<th><span class="matrix-dot" style="background:${SPECIES_COLORS[j].hex}"></span></th>`;
        }
        html += '</tr>';

        for (let i = 0; i < n; i++) {
            html += `<tr><th><span class="matrix-dot" style="background:${SPECIES_COLORS[i].hex}"></span></th>`;
            for (let j = 0; j < n; j++) {
                const val = rules[i][j];
                const bg = ruleColor(val);
                html += `<td><div class="matrix-cell" data-i="${i}" data-j="${j}" style="background:${bg}">${val.toFixed(1)}</div></td>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        container.innerHTML = html;

        // Click to cycle values
        container.querySelectorAll('.matrix-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const i = parseInt(e.target.dataset.i);
                const j = parseInt(e.target.dataset.j);
                rules[i][j] = Math.round((rules[i][j] + 0.3) * 10) / 10;
                if (rules[i][j] > 1.0) rules[i][j] = -1.0;
                e.target.textContent = rules[i][j].toFixed(1);
                e.target.style.background = ruleColor(rules[i][j]);
            });

            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const i = parseInt(e.target.dataset.i);
                const j = parseInt(e.target.dataset.j);
                rules[i][j] = Math.round((rules[i][j] - 0.3) * 10) / 10;
                if (rules[i][j] < -1.0) rules[i][j] = 1.0;
                e.target.textContent = rules[i][j].toFixed(1);
                e.target.style.background = ruleColor(rules[i][j]);
            });
        });
    }

    function ruleColor(val) {
        if (val > 0.01) {
            const a = val * 0.5;
            return `rgba(52, 211, 153, ${a})`;  // green
        } else if (val < -0.01) {
            const a = -val * 0.5;
            return `rgba(248, 113, 113, ${a})`;  // red
        }
        return 'rgba(74, 74, 90, 0.3)';
    }

    // ── UI Wiring ─────────────────────────────────────────────────
    function syncSliders() {
        document.getElementById('slider-count').value = config.numParticles;
        document.getElementById('val-count').textContent = config.numParticles;
        document.getElementById('slider-species').value = config.numSpecies;
        document.getElementById('val-species').textContent = config.numSpecies;
        document.getElementById('slider-range').value = config.interactionRange;
        document.getElementById('val-range').textContent = config.interactionRange;
        document.getElementById('slider-friction').value = config.friction;
        document.getElementById('val-friction').textContent = config.friction.toFixed(2);
        document.getElementById('slider-force').value = config.forceStrength;
        document.getElementById('val-force').textContent = config.forceStrength.toFixed(1);
        document.getElementById('slider-trail').value = config.trailAlpha;
        document.getElementById('val-trail').textContent = config.trailAlpha.toFixed(2);
    }

    function init() {
        randomRules();
        createParticles();
        buildMatrixUI();
        syncSliders();

        // Clear canvas fully on init
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);
    }

    // Controls toggle
    document.getElementById('controls-toggle').addEventListener('click', () => {
        document.getElementById('controls-panel').classList.toggle('hidden');
    });

    // Buttons
    document.getElementById('btn-randomize').addEventListener('click', () => {
        randomRules();
        createParticles();
        buildMatrixUI();
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        createParticles();
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);
    });

    document.getElementById('btn-pause').addEventListener('click', (e) => {
        paused = !paused;
        e.target.textContent = paused ? 'Resume' : 'Pause';
    });

    document.getElementById('btn-clear-trails').addEventListener('click', () => {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (PRESETS[preset]) {
                PRESETS[preset]();
                createParticles();
                buildMatrixUI();
                syncSliders();
                ctx.fillStyle = '#0a0a0f';
                ctx.fillRect(0, 0, W, H);
            }
        });
    });

    // Sliders
    document.getElementById('slider-count').addEventListener('input', (e) => {
        config.numParticles = parseInt(e.target.value);
        document.getElementById('val-count').textContent = config.numParticles;
        createParticles();
    });

    document.getElementById('slider-species').addEventListener('input', (e) => {
        config.numSpecies = parseInt(e.target.value);
        document.getElementById('val-species').textContent = config.numSpecies;
        randomRules();
        createParticles();
        buildMatrixUI();
    });

    document.getElementById('slider-range').addEventListener('input', (e) => {
        config.interactionRange = parseInt(e.target.value);
        document.getElementById('val-range').textContent = config.interactionRange;
    });

    document.getElementById('slider-friction').addEventListener('input', (e) => {
        config.friction = parseFloat(e.target.value);
        document.getElementById('val-friction').textContent = config.friction.toFixed(2);
    });

    document.getElementById('slider-force').addEventListener('input', (e) => {
        config.forceStrength = parseFloat(e.target.value);
        document.getElementById('val-force').textContent = config.forceStrength.toFixed(1);
    });

    document.getElementById('slider-trail').addEventListener('input', (e) => {
        config.trailAlpha = parseFloat(e.target.value);
        document.getElementById('val-trail').textContent = config.trailAlpha.toFixed(2);
    });

    // Close panel when tapping on canvas
    canvas.addEventListener('pointerdown', () => {
        const panel = document.getElementById('controls-panel');
        if (!panel.classList.contains('hidden')) {
            panel.classList.add('hidden');
        }
    });

    // Mouse interaction
    canvas.addEventListener('mousedown', (e) => {
        mouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    canvas.addEventListener('mouseup', () => { mouseDown = false; });
    canvas.addEventListener('mouseleave', () => { mouseDown = false; });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mouseDown = true;
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
    });

    canvas.addEventListener('touchend', () => { mouseDown = false; });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        switch (e.key) {
            case ' ':
                e.preventDefault();
                paused = !paused;
                document.getElementById('btn-pause').textContent = paused ? 'Resume' : 'Pause';
                break;
            case 'r':
                randomRules();
                createParticles();
                buildMatrixUI();
                ctx.fillStyle = '#0a0a0f';
                ctx.fillRect(0, 0, W, H);
                break;
            case 'c':
                ctx.fillStyle = '#0a0a0f';
                ctx.fillRect(0, 0, W, H);
                break;
            case 'h':
                document.getElementById('controls-panel').classList.toggle('hidden');
                break;
        }
    });

    // Fade title after a few seconds
    setTimeout(() => {
        document.getElementById('title-bar').style.opacity = '0.3';
    }, 4000);

    // ── Start ─────────────────────────────────────────────────────
    init();
    requestAnimationFrame(loop);

})();
