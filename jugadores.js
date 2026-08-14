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

    // En Cancha Completa las formaciones son de "salida" (quiénes esperan
    // cerca del aro propio y quiénes ya están adelantados en los carriles),
    // no de ataque a un solo aro.
    const [etA, etB] = (courtMode === 'full') ? ['ATRÁS', 'ADELANTE'] : ['INT', 'EXT'];

    for (let i = n; i >= 0; i--) {
        fs.add(new Option(`${i} ${etA} / ${n - i} ${etB}`, `${i}-${n - i}`));
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
    // cancha (mitad del canvas). yPorFraccion() se encarga de reflejar esa
    // posición hacia la mitad inferior (el aro propio), como si el equipo
    // fuera a sacar la pelota desde su aro.
    const hRef = (courtMode === 'full') ? canvas.height / 2 : canvas.height;

    const updateTeam = (team, count, defaultX) => {
        let teamList = players.filter(p => p.team === team);

        if (teamList.length > count) {
            // Si el jugador que llevaba alguna pelota fue eliminado, la liberamos
            // (recorremos TODAS las pelotas: cualquiera podría estar imantada a él)
            balls.forEach(b => {
                const portador = b.portadorPorPaso[currentStep] ?? null;
                if (portador && portador.startsWith(team)) {
                    const indexImantado = parseInt(portador.split('-')[1]);
                    if (indexImantado >= count) b.portadorPorPaso[currentStep] = null;
                }
            });
            players = players.filter(p => !(p.team === team && teamList.indexOf(p) >= count));
        } else {
            for (let i = teamList.length; i < count; i++) {
                let tx = defaultX * sF;
                let ty = 50 + i * (radius * 2.8);

                if (team === 'red') {
                    const posicionesExteriores = [
                        { x: canvas.width * 0.12, y: yPorFraccion(0.38, hRef) },
                        { x: canvas.width * 0.22, y: yPorFraccion(0.70, hRef) },
                        { x: canvas.width * 0.50, y: yPorFraccion(0.82, hRef) },
                        { x: canvas.width * 0.78, y: yPorFraccion(0.70, hRef) },
                        { x: canvas.width * 0.88, y: yPorFraccion(0.38, hRef) },
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
    const [c1, c2] = fs.value.split('-').map(Number);
    const w = canvas.width;
    const h = canvas.height;
    const redP  = players.filter(p => p.team === 'red');
    const blueP = players.filter(p => p.team === 'blue');

    let fP = [];

    if (courtMode === 'full') {
        // Formaciones de "salida" desde el aro propio: un grupo espera
        // atrás (cerca del aro de abajo) y el resto ya está adelantado en
        // los carriles, listo para recibir el pase de salida.
        const aL = [ // ATRÁS (cerca del aro propio)
            { x: w * 0.50, y: h * 0.88 },
            { x: w * 0.25, y: h * 0.80 },
            { x: w * 0.75, y: h * 0.80 },
            { x: w * 0.15, y: h * 0.92 },
            { x: w * 0.85, y: h * 0.92 },
        ];
        const dL = [ // ADELANTE (carriles de salida)
            { x: w * 0.50, y: h * 0.55 },
            { x: w * 0.15, y: h * 0.42 },
            { x: w * 0.85, y: h * 0.42 },
            { x: w * 0.30, y: h * 0.28 },
            { x: w * 0.70, y: h * 0.28 },
        ];

        if      (c1 === 1) fP.push(aL[0]);
        else if (c1 === 2) fP.push(aL[0], aL[1]);
        else if (c1 === 3) fP.push(aL[0], aL[1], aL[2]);
        else if (c1 === 4) fP.push(aL[0], aL[1], aL[2], aL[3]);
        else if (c1 === 5) fP.push(...aL);

        if      (c2 === 1) fP.push(dL[0]);
        else if (c2 === 2) fP.push(dL[0], dL[1]);
        else if (c2 === 3) fP.push(dL[0], dL[1], dL[2]);
        else if (c2 === 4) fP.push(dL[0], dL[1], dL[2], dL[3]);
        else if (c2 === 5) fP.push(...dL);
    } else {
        // Formaciones de ataque a un aro (comportamiento original de Media Cancha)
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

        if      (c1 === 1) fP.push(iL[4]);
        else if (c1 === 2) fP.push(iL[0], iL[1]);
        else if (c1 === 3) fP.push(iL[0], iL[1], iL[4]);
        else if (c1 === 4) fP.push(iL[0], iL[1], iL[2], iL[3]);
        else if (c1 === 5) fP.push(...iL);

        if      (c2 === 1) fP.push(eL[4]);
        else if (c2 === 2) fP.push(eL[0], eL[1]);
        else if (c2 === 3) fP.push(eL[0], eL[1], eL[4]);
        else if (c2 === 4) fP.push(eL[0], eL[1], eL[2], eL[3]);
        else if (c2 === 5) fP.push(...eL);
    }

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

// --- AGREGAR PELOTA (balls[], v142) ---
// El botón 🏀 ya no muestra/oculta una única pelota: agrega una pelota
// nueva e independiente al arreglo balls[] (Refactor de Pelotas Múltiples).
// Solo tiene sentido en el Paso Inicial (el botón mismo ya se oculta fuera
// de ahí -ver updateStepUI() en ui.js-; el chequeo de acá es una guarda
// extra, igual que en pedirDorsal()).
function addBall() {
    if (currentStep !== 0 || isEditionFinished) return;

    const hRef   = (courtMode === 'full') ? canvas.height / 2 : canvas.height;
    // Pequeño desplazamiento por cada pelota nueva para que no queden
    // todas apiladas exactamente en el mismo punto.
    const jitter = (balls.length % 5) * 18 * sF;

    const nuevaBola = {
        id:     'ball-' + (nextBallId++),
        active: true,
        team:   'ball',
        steps:  [[{ x: (canvas.width / 2) + jitter, y: yPorFraccion(0.45, hRef) + jitter, isScreen: false, angle: 0 }]],
        portadorPorPaso: [null]
    };
    balls.push(nuevaBola);

    // La dejamos seleccionada: aparecen enseguida sus controles flotantes
    // (por ahora solo "Eliminar"), lista para arrastrarla a su lugar.
    activeObj  = nuevaBola;
    isDragging = false;
    updateFloatingUI();
    draw();
    playSound('bounceBall');
}

// --- UTILERÍA Y OBJETOS TÁCTICOS DE ENTRENAMIENTO (v142) ---
// Agrega un objeto estático nuevo (cono/escalera/valla/obstáculo) al
// arreglo props[]. Solo disponible en el Paso Inicial (la barra flotante
// que llama a esta función ya está oculta fuera de ahí).
function agregarUtileria(tipo) {
    if (currentStep !== 0 || isEditionFinished || !PROP_TYPES.includes(tipo)) return;

    const hRef   = (courtMode === 'full') ? canvas.height / 2 : canvas.height;
    const jitter = (props.length % 5) * 16 * sF;

    const nuevoObjeto = {
        id:    'prop-' + (nextPropId++),
        type:  tipo,
        // Los aparecemos hacia el centro de la cancha (no pegados arriba):
        // como la barra de Utilería ahora queda abierta tras agregar cada
        // objeto (ver comentario más abajo), conviene que no nazcan justo
        // debajo de ella.
        x:     (canvas.width / 2) + jitter,
        y:     yPorFraccion(0.45, hRef) + jitter,
        angle: 0
    };
    if (tipo === 'cono')      nuevoObjeto.color = '#ff7a00';
    if (tipo === 'obstaculo') nuevoObjeto.color = '#555555';
    if (tipo === 'escalera')  nuevoObjeto.size  = 'mediana';

    props.push(nuevoObjeto);

    // La dejamos seleccionada: aparecen enseguida sus controles flotantes,
    // lista para arrastrarla y ajustarla sin pasos extra. A propósito NO
    // cerramos la barra de Utilería acá: así se pueden agregar varios
    // objetos seguidos sin tener que volver a tocar el botón 🧰 cada vez.
    activeObj  = nuevoObjeto;
    isDragging = false;
    updateFloatingUI();
    draw();
    playSound('grabJersey');
}
