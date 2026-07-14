// ========================================================
// PIZARRA OESTE - jugadores.js
// Gestión de jugadores: sync, formaciones, etiquetas,
// dibujo de camisetas y pelota.
// Depende de: estado.js, cancha.js
// ========================================================

// --- CAMISETA ---
function drawJersey(color, radius, label) {
    ctx.fillStyle = color;
    const w = radius * 1.1, h = radius * 1.35;
    ctx.beginPath();
    ctx.moveTo(-w * 0.7, -h);
    ctx.lineTo(-w * 0.4, -h);
    ctx.bezierCurveTo(-w * 0.2, -h + 4 * sF, w * 0.2, -h + 4 * sF, w * 0.4, -h);
    ctx.lineTo(w * 0.7, -h);
    ctx.bezierCurveTo( w * 0.55, -h + h * 0.2,  w * 0.55, -h + h * 0.4,  w * 0.7, -h + h * 0.5);
    ctx.lineTo(w * 0.7, h);
    ctx.lineTo(-w * 0.7, h);
    ctx.lineTo(-w * 0.7, -h + h * 0.5);
    ctx.bezierCurveTo(-w * 0.55, -h + h * 0.4, -w * 0.55, -h + h * 0.2, -w * 0.7, -h);
    ctx.closePath();
    ctx.fill();
    if (label) {
        ctx.fillStyle = "white";
        ctx.font = `bold ${radius * 0.95}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 0, h * 0.1);
    }
}

// --- OPCIONES DE FORMACIÓN ---
function updateFormationOptions() {
    if (!rs || !fs) return;
    const n = parseInt(rs.value);
    fs.innerHTML = '<option value="custom">-- FORMACIÓN --</option>';
    if (n === 0) return;
    for (let i = n; i >= 0; i--) {
        fs.add(new Option(`${i} INT / ${n - i} EXT`, `${i}-${n - i}`));
    }
}

// --- SINCRONIZACIÓN DE JUGADORES ---
function syncPlayers() {
    if (!rs || !bs) return;
    const rCount = parseInt(rs.value);
    const bCount = parseInt(bs.value);
    const savedLabels = JSON.parse(localStorage.getItem('pizarraLabels') || '{"red":[], "blue":[]}');
    const radius = 15 * sF;

    // En Cancha Completa la referencia vertical es la altura de UNA media
    // cancha (mitad del canvas), para que la formación inicial aparezca
    // cerca del aro de arriba, igual que en Media Cancha.
    const hRef = (courtMode === 'full') ? canvas.height / 2 : canvas.height;

    const updateTeam = (team, count, defaultX) => {
        let teamList = players.filter(p => p.team === team);

        if (teamList.length > count) {
            // Si el jugador que llevaba la pelota fue eliminado, la liberamos
            if (imantadoA && imantadoA.startsWith(team)) {
                const indexImantado = parseInt(imantadoA.split('-')[1]);
                if (indexImantado >= count) imantadoA = null;
            }
            players = players.filter(p => !(p.team === team && teamList.indexOf(p) >= count));
        } else {
            for (let i = teamList.length; i < count; i++) {
                let tx = defaultX * sF;
                let ty = 50 + i * (radius * 2.8);

                if (team === 'red') {
                    const posicionesExteriores = [
                        { x: canvas.width * 0.12, y: hRef * 0.38 },
                        { x: canvas.width * 0.22, y: hRef * 0.70 },
                        { x: canvas.width * 0.50, y: hRef * 0.82 },
                        { x: canvas.width * 0.78, y: hRef * 0.70 },
                        { x: canvas.width * 0.88, y: hRef * 0.38 },
                    ];
                    if (posicionesExteriores[i]) {
                        tx = posicionesExteriores[i].x;
                        ty = posicionesExteriores[i].y;
                    }
                }

                if (team === 'blue') {
                    const redPlayers = players.filter(p => p.team === 'red');
                    if (redPlayers[i]) {
                        tx = redPlayers[i].steps[0][0].x + (25 * sF);
                        ty = redPlayers[i].steps[0][0].y;
                    }
                }

                const steps = [];
                for (let j = 0; j <= currentStep; j++) {
                    steps.push([{ x: tx, y: ty, isScreen: false, angle: 0 }]);
                }

                players.push({
                    id:    `${team}-${i}`,
                    team:  team,
                    steps: steps,
                    label: savedLabels[team][i] || ''
                });
            }
        }
    };

    updateTeam('red',  rCount, 40);
    updateTeam('blue', bCount, 460);
    updateFormationOptions();
    draw();
    attachButtonSounds();
}

// --- GUARDAR ETIQUETAS ---
function saveLabels() {
    const labels = {
        red:  players.filter(p => p.team === 'red').map(p => p.label),
        blue: players.filter(p => p.team === 'blue').map(p => p.label),
    };
    localStorage.setItem('pizarraLabels', JSON.stringify(labels));
}

// --- APLICAR FORMACIÓN ---
function applyFormation() {
    if (currentStep !== 0 || fs.value === "custom") return;
    const [ic, ec] = fs.value.split('-').map(Number);
    const w = canvas.width;
    // Misma referencia vertical que syncPlayers(): en Cancha Completa la
    // formación se ubica dentro de la mitad superior de la cancha.
    const h = (courtMode === 'full') ? canvas.height / 2 : canvas.height;
    const redP  = players.filter(p => p.team === 'red');
    const blueP = players.filter(p => p.team === 'blue');

    const iL = [
        { x: w * 0.35, y: h * 0.28 }, { x: w * 0.65, y: h * 0.28 },
        { x: w * 0.35, y: h * 0.48 }, { x: w * 0.65, y: h * 0.48 },
        { x: w * 0.50, y: h * 0.22 },
    ];
    const eL = [
        { x: w * 0.12, y: h * 0.38 }, { x: w * 0.88, y: h * 0.38 },
        { x: w * 0.22, y: h * 0.70 }, { x: w * 0.78, y: h * 0.70 },
        { x: w * 0.50, y: h * 0.82 },
    ];

    let fP = [];
    if (ic === 1) fP.push(iL[4]);
    else if (ic === 2) fP.push(iL[0], iL[1]);
    else if (ic === 3) fP.push(iL[0], iL[1], iL[4]);
    else if (ic === 4) fP.push(iL[0], iL[1], iL[2], iL[3]);
    else if (ic === 5) fP.push(...iL);

    if (ec === 1) fP.push(eL[4]);
    else if (ec === 2) fP.push(eL[0], eL[1]);
    else if (ec === 3) fP.push(eL[0], eL[1], eL[4]);
    else if (ec === 4) fP.push(eL[0], eL[1], eL[2], eL[3]);
    else if (ec === 5) fP.push(...eL);

    redP.forEach((p, i) => {
        if (fP[i]) {
            p.steps[0][0] = { x: fP[i].x, y: fP[i].y, isScreen: false, angle: 0 };
            if (blueP[i]) {
                blueP[i].steps[0][0] = { x: fP[i].x + (25 * sF), y: fP[i].y, isScreen: false, angle: 0 };
            }
        }
    });

    draw();
}

// --- VISIBILIDAD DE LA PELOTA ---
function toggleBall() {
    ball.active = !ball.active;
    draw();
    const bBtn = document.getElementById('ballBtn');
    if (bBtn) bBtn.style.background = ball.active ? "#333" : "#111";
}
