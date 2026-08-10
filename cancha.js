// ========================================================
// PIZARRA OESTE - cancha.js
// Motor gráfico: init, resize, cancha SVG, parquet,
// draw() y renderAnim() unificados en _render().
// Soporta dos modos de cancha:
//   - 'half' (Media Cancha): un aro, canvas horizontal (comportamiento original)
//   - 'full' (Cancha Completa): dos aros espejados, canvas vertical
// Depende de: estado.js, audio.js, jugadores.js, ui.js
// ========================================================

// Relación ancho/alto de referencia para UNA media cancha (apaisada).
// La cancha completa usa el doble de alto (dos medias canchas apiladas).
const COURT_ASPECT = 1.45;

// --- PULSO SUTIL AL IMANTAR/DESIMANTAR LA PELOTA ---
let pulsoImanHasta = 0;
function activarPulsoIman() {
    pulsoImanHasta = performance.now() + 350;
    requestAnimationFrame(function tick() {
        draw();
        if (performance.now() < pulsoImanHasta) requestAnimationFrame(tick);
    });
}

// --- MAPEO INTELIGENTE DE CANCHA (MINICÍRCULOS) ---
// Convención: una ficha "vive" siempre en su coordenada real, aunque esa
// coordenada quede fuera del canvas visible. En Media Cancha, si la Y de
// un jugador (o de la pelota suelta) cae por debajo del borde del canvas,
// significa que esa ficha está en la mitad de cancha que no se ve en este
// modo: en vez de la ficha normal, se dibuja un minicírculo flotante
// sobre el borde inferior. No hace falta ninguna bandera extra: el
// remapeo de coordenadas entre modos ya deja la Y "fuera de rango" sola,
// de forma consistente, así que la clasificación es puramente geométrica.

function posicionMiniCirculo(x) {
    const r = 13 * sF;
    const cx = Math.max(r + 4*sF, Math.min(canvas.width - r - 4*sF, x));
    const cy = canvas.height - r - 6*sF;
    return { cx, cy, r };
}

function dibujarMiniCirculo(x, color, label, seleccionado) {
    const { cx, cy, r } = posicionMiniCirculo(x);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 * sF;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    if (label) {
        ctx.fillStyle = "white";
        ctx.font = `bold ${r * 0.9}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label, cx, cy + 1);
    }
    if (seleccionado) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4*sF, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2.5 * sF; ctx.setLineDash([3, 3]); ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.restore();
    return { cx, cy, r };
}

// Reescala TODAS las coordenadas guardadas (jugadores y pelota, en todos
// los pasos) según la proporción de ancho entre el canvas anterior y el
// nuevo. Como ambos anchos representan el mismo ancho real de cancha
// (~15m), esto preserva la posición proporcional real de cada ficha al
// cambiar de modo, sin perder ni reiniciar nada.
function remapearCoordenadas(factor) {
    if (!factor || !isFinite(factor) || factor <= 0 || factor === 1) return;
    players.forEach(p => {
        p.steps.forEach(pathArr => {
            pathArr.forEach(pt => { pt.x *= factor; pt.y *= factor; });
        });
    });
    ball.steps.forEach(pathArr => {
        pathArr.forEach(pt => { pt.x *= factor; pt.y *= factor; });
    });
}

// Convierte una fracción "0 = pegado al aro, ~0.8-0.9 = cerca de la mitad de
// cancha" en una coordenada Y real. En Media Cancha el aro está arriba
// (fracción chica = y chico). En Cancha Completa el equipo arranca desde SU
// PROPIO aro (el de abajo), así que la coordenada se refleja hacia la mitad
// inferior de la cancha, como si fuera a sacar el equipo desde su aro.
function yPorFraccion(fraccion, hRef) {
    if (courtMode === 'full') {
        return canvas.height - (hRef * fraccion);
    }
    return hRef * fraccion;
}

// --- INICIALIZACIÓN Y RE-ESCALADO ---
function init() {
    const container = document.getElementById('canvas-wrap-outer');
    if (!container) return;
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;

    const oldSF = sF;
    const modo  = (courtMode === 'full') ? 'full' : 'half';

    let availableW = container.clientWidth  - 10;
    let availableH = container.clientHeight - 10;
    let finalW, finalH;

    if (modo === 'full') {
        // Cancha completa: vertical (más alta que ancha)
        finalW = availableW;
        finalH = finalW * (2 / COURT_ASPECT);
        if (finalH > availableH) { finalH = availableH; finalW = finalH * (COURT_ASPECT / 2); }
    } else {
        // Media cancha: horizontal (comportamiento original)
        finalW = availableW;
        finalH = finalW / COURT_ASPECT;
        if (finalH > availableH) { finalH = availableH; finalW = finalH * COURT_ASPECT; }
    }

    wrap.style.width  = finalW + "px";
    wrap.style.height = finalH + "px";
    canvas.width  = finalW;
    canvas.height = finalH;
    // El lienzo de dibujo libre siempre acompaña al mismo tamaño de
    // #canvas (están superpuestos exactamente). Cambiar width/height de
    // un canvas borra su contenido, así que más abajo se redibuja.
    if (drawCanvas) { drawCanvas.width = finalW; drawCanvas.height = finalH; }

    const scaleMultiplier = (oldSF !== 1 && oldSF !== 0) ? (finalW / 500) / oldSF : 1;
    sF = finalW / 500;

    if (ball && ball.steps && scaleMultiplier !== 1 && oldSF !== 1) {
        ball.steps.forEach(sp => sp.forEach(pt => { pt.x *= scaleMultiplier; pt.y *= scaleMultiplier; }));
        if (ball.ax !== undefined) ball.ax *= scaleMultiplier;
        if (ball.ay !== undefined) ball.ay *= scaleMultiplier;
    }

    if (players && players.length > 0 && scaleMultiplier !== 1 && oldSF !== 1) {
        players.forEach(pl => {
            if (pl.steps) pl.steps.forEach(sp => sp.forEach(pt => { pt.x *= scaleMultiplier; pt.y *= scaleMultiplier; }));
            if (pl.ax !== undefined) pl.ax *= scaleMultiplier;
            if (pl.ay !== undefined) pl.ay *= scaleMultiplier;
        });
    }

    // Reescala el lienzo libre de LA CARA ACTIVA para que sus trazos
    // mantengan su tamaño/posición proporcional en el nuevo canvas.
    // IMPORTANTE: a diferencia de jugadores/pelota (arriba, que son un
    // único estado compartido), cada cara del acrílico es autónoma, así
    // que la comparación se hace contra la ÚLTIMA escala propia de ESTA
    // cara (caraLibre.sF) -no contra `oldSF`, que puede pertenecer a la
    // OTRA cara si lo que acaba de pasar fue un cambio de modo de cancha,
    // y comparar contra eso deformaría los trazos sin sentido-. Así, ni
    // un resize de ventana ni un cambio de modo de cancha estiran o
    // deforman el dibujo: cada cara solo se reescala contra sí misma.
    if (typeof lienzosLibres !== 'undefined') {
        const caraLibre = lienzosLibres[modo];
        if (caraLibre) {
            if (caraLibre.sF && caraLibre.sF !== sF) {
                const factorPropio = sF / caraLibre.sF;
                caraLibre.trazos.forEach(t => t.puntos.forEach(pt => { pt.x *= factorPropio; pt.y *= factorPropio; }));
                caraLibre.deshechos.forEach(t => t.puntos.forEach(pt => { pt.x *= factorPropio; pt.y *= factorPropio; }));
            }
            caraLibre.sF = sF;
        }
    }

    updateCourtDrawing(finalW, finalH);
    updateMuteBtnUI();

    if (ball.steps[0][0].x === 0) {
        const hRefBall = (modo === 'full') ? finalH / 2 : finalH;
        ball.steps[0] = [{ x: finalW / 2, y: yPorFraccion(0.45, hRefBall), isScreen: false, angle: 0 }];
    }
    if (players.length === 0) syncPlayers();

    updateFormationOptions();
    renderTimeline();
    updateStepUI();
    draw();
    attachButtonSounds();
    if (typeof updateFloatingUI === "function") updateFloatingUI();
    // El resize de drawCanvas (arriba) borra su contenido: lo redibujamos
    // siempre, sea que Pizarra Rápida esté activa (se ven los trazos) o
    // no (redibujarLienzoLibre() lo deja simplemente limpio).
    if (typeof redibujarLienzoLibre === "function") redibujarLienzoLibre();
}

// --- LÍNEAS DE CANCHA (SVG OVERLAY) ---

// Dibuja las marcas de UN aro (tablero, aro, pintura, tiro libre, triple)
// dentro de un área lógica de w x hLocal, sobre el set de elementos SVG
// indicado en "ids". Se usa tanto para media cancha como para cada uno
// de los dos aros de la cancha completa (el segundo va dentro de un <g>
// espejado con transform, así que la geometría de cálculo es siempre la misma).
function dibujarMarcasDeAro(w, hLocal, ids) {
    const pW = w * 0.33, radiusLibre = pW / 2, pH = hLocal * 0.52;
    const sX = w * 0.06, tR = (w / 2) - sX, stH = pH + radiusLibre - tR;
    const startX = (w - pW) / 2, endX = (w + pW) / 2;

    document.getElementById(ids.paint).setAttribute('x', startX);
    document.getElementById(ids.paint).setAttribute('width', pW);
    document.getElementById(ids.paint).setAttribute('height', pH);

    document.getElementById(ids.keyMarkers).setAttribute('d', `
        M ${startX} ${pH*0.35} L ${startX-8} ${pH*0.35}
        M ${startX} ${pH*0.55} L ${startX-8} ${pH*0.55}
        M ${startX} ${pH*0.75} L ${startX-8} ${pH*0.75}
        M ${endX}   ${pH*0.35} L ${endX+8}   ${pH*0.35}
        M ${endX}   ${pH*0.55} L ${endX+8}   ${pH*0.55}
        M ${endX}   ${pH*0.75} L ${endX+8}   ${pH*0.75}
    `);
    document.getElementById(ids.freeThrow).setAttribute('d',
        `M ${(w/2)-radiusLibre} ${pH} A ${radiusLibre} ${radiusLibre} 0 0 0 ${(w/2)+radiusLibre} ${pH}`);
    document.getElementById(ids.freeThrowDashed).setAttribute('d',
        `M ${(w/2)-radiusLibre} ${pH} A ${radiusLibre} ${radiusLibre} 0 0 1 ${(w/2)+radiusLibre} ${pH}`);
    document.getElementById(ids.triple).setAttribute('d',
        `M ${sX} 0 L ${sX} ${stH} A ${tR} ${tR} 0 0 0 ${w-sX} ${stH} L ${w-sX} 0`);

    const boardY = 25*sF, rimY = 42*sF, boardW = 65*sF, rimRadius = 11*sF;
    document.getElementById(ids.backboard).setAttribute('x1', (w/2)-(boardW/2));
    document.getElementById(ids.backboard).setAttribute('y1', boardY);
    document.getElementById(ids.backboard).setAttribute('x2', (w/2)+(boardW/2));
    document.getElementById(ids.backboard).setAttribute('y2', boardY);
    document.getElementById(ids.rim).setAttribute('cx', w/2);
    document.getElementById(ids.rim).setAttribute('cy', rimY);
    document.getElementById(ids.rim).setAttribute('r',  rimRadius);
}

const IDS_ARO_1 = {
    paint: 'paint', keyMarkers: 'key-markers', freeThrow: 'free-throw',
    freeThrowDashed: 'free-throw-dashed', triple: 'triple',
    backboard: 'backboard', rim: 'rim'
};
const IDS_ARO_2 = {
    paint: 'paint-2', keyMarkers: 'key-markers-2', freeThrow: 'free-throw-2',
    freeThrowDashed: 'free-throw-dashed-2', triple: 'triple-2',
    backboard: 'backboard-2', rim: 'rim-2'
};

// Deja en su estado invisible por defecto todos los elementos SVG que
// solo se usan en Cancha Completa (segundo aro, línea y círculo central).
// Hace falta llamarla al volver a Media Cancha, porque al cambiar de modo
// sin recargar la página esos elementos quedan con los últimos valores
// que tenían (y sin esto se seguirían viendo).
function limpiarMarcasSegundoAro() {
    const paint2 = document.getElementById('paint-2');
    if (paint2) { paint2.setAttribute('width', 0); paint2.setAttribute('height', 0); }

    ['key-markers-2', 'free-throw-2', 'free-throw-dashed-2', 'triple-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('d', '');
    });

    const bb2 = document.getElementById('backboard-2');
    if (bb2) { bb2.setAttribute('x1', 0); bb2.setAttribute('y1', 0); bb2.setAttribute('x2', 0); bb2.setAttribute('y2', 0); }

    const rim2 = document.getElementById('rim-2');
    if (rim2) rim2.setAttribute('r', 0);

    const hl = document.getElementById('halfcourt-line');
    if (hl) { hl.setAttribute('x1', 0); hl.setAttribute('y1', 0); hl.setAttribute('x2', 0); hl.setAttribute('y2', 0); }

    const cc = document.getElementById('center-circle');
    if (cc) cc.setAttribute('r', 0);
}

function updateHalfCourtDrawing(w, h) {
    limpiarMarcasSegundoAro();
    dibujarMarcasDeAro(w, h, IDS_ARO_1);
}

function updateFullCourtDrawing(w, h) {
    const halfH = h / 2;

    // Aro de arriba: normal
    dibujarMarcasDeAro(w, halfH, IDS_ARO_1);

    // Aro de abajo: mismos cálculos, pero el <g> que lo contiene está
    // espejado verticalmente con un transform, así que se dibuja igual
    // y aparece reflejado en la parte inferior de la cancha.
    const mirrorGroup = document.getElementById('mirror-group');
    if (mirrorGroup) mirrorGroup.setAttribute('transform', `translate(0, ${h}) scale(1, -1)`);
    dibujarMarcasDeAro(w, halfH, IDS_ARO_2);

    // Línea y círculo de mitad de cancha
    // Círculo central: en FIBA mide 1.80m de radio sobre una cancha de 15m
    // de ancho (misma proporción que el círculo de tiro libre en la
    // realidad, aunque acá el semicírculo de tiro libre está dibujado más
    // grande por estilo). 1.80/15 = 0.12 del ancho de la cancha.
    const radiusCentral = w * 0.12;
    document.getElementById('halfcourt-line').setAttribute('x1', 0);
    document.getElementById('halfcourt-line').setAttribute('y1', halfH);
    document.getElementById('halfcourt-line').setAttribute('x2', w);
    document.getElementById('halfcourt-line').setAttribute('y2', halfH);
    document.getElementById('center-circle').setAttribute('cx', w / 2);
    document.getElementById('center-circle').setAttribute('cy', halfH);
    document.getElementById('center-circle').setAttribute('r', radiusCentral);
}

function updateCourtDrawing(w, h) {
    if (courtMode === 'full') {
        updateFullCourtDrawing(w, h);
    } else {
        updateHalfCourtDrawing(w, h);
    }
}

// --- TEXTURA PARQUET ---
function drawParquetTexture() {
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth   = 1 * sF;
    const pw = 16 * sF;
    for (let x = 0; x < canvas.width; x += pw) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvas.height); ctx.stroke();
        for (let y = (x%3)*20*sF; y < canvas.height; y += 80*sF) {
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+pw,y); ctx.stroke();
        }
    }
}

// --- LOGO ---
function drawLogo() {
    if (!logoCanchaImg.complete || logoCanchaImg.naturalWidth === 0) return;
    ctx.save();
    const prop = logoCanchaImg.naturalHeight / logoCanchaImg.naturalWidth;
    let yLogo, aw, ah;

    if (courtMode === 'full') {
        // El logo debe entrar completo (ancho Y alto) dentro del círculo
        // central, con un margen para no tocar el borde.
        yLogo = canvas.height / 2;
        const radioCentral = canvas.width * 0.12;
        const maxDiametro  = radioCentral * 2 * 0.78;
        aw = maxDiametro;
        ah = aw * prop;
        if (ah > maxDiametro) { ah = maxDiametro; aw = ah / prop; }
    } else {
        // Mismo criterio que en Cancha Completa: el logo ocupa el 78% del
        // diámetro del círculo de referencia (acá, el de tiro libre) para
        // que se vea más grande sin llegar a tocar sus líneas.
        yLogo = canvas.height * 0.52;
        const radioLibre  = canvas.width * 0.165;
        const maxDiametro = radioLibre * 2 * 0.78;
        aw = maxDiametro;
        ah = aw * prop;
        if (ah > maxDiametro) { ah = maxDiametro; aw = ah / prop; }
    }

    ctx.translate(canvas.width / 2, yLogo);
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter      = 'brightness(0.3) contrast(1.2)';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(logoCanchaImg, -aw / 2, -ah / 2, aw, ah);
    ctx.restore();
}

// --- CANCHA EN CANVAS (solo export video) ---
function dibujarCanchaEnCanvas(w, hLocal, espejar, hTotal) {
    ctx.save();
    if (espejar) {
        ctx.translate(0, hTotal);
        ctx.scale(1, -1);
    }
    // El canvas 2D tiende a renderizar los trazos más "pesados" que el SVG
    // que se ve normalmente en pantalla (se nota sobre todo en PC/Edge con
    // escalado de pantalla). Compensamos con un grosor levemente menor.
    const grosor = 0.8;

    ctx.strokeStyle = "white"; ctx.lineWidth = 4*sF*grosor; ctx.fillStyle = "rgba(0,0,0,0.05)";
    const pW = w*0.33, rl = pW/2, pH = hLocal*0.52;
    const sX = w*0.06, tR = (w/2)-sX, stH = pH+rl-tR, sx = (w-pW)/2;
    ctx.fillRect(sx,0,pW,pH); ctx.strokeRect(sx,0,pW,pH);
    ctx.beginPath(); ctx.moveTo(sX,0); ctx.lineTo(sX,stH);
    ctx.arc(w/2,stH,tR,Math.PI,0,true); ctx.lineTo(w-sX,0); ctx.stroke();

    // Círculo de tiro libre: mitad sólida (lejos del aro)...
    ctx.beginPath(); ctx.arc(w/2,pH,rl,0,Math.PI); ctx.stroke();
    // ...y mitad punteada (hacia el aro, entra en la pintura)
    ctx.setLineDash([4*sF, 4*sF]);
    ctx.beginPath(); ctx.arc(w/2,pH,rl,Math.PI,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // Marcas de reboteadores: 3 rayitas a cada lado de la pintura
    const anchoLW = ctx.lineWidth;
    ctx.lineWidth = 3*sF*grosor;
    ctx.beginPath();
    [0.35, 0.55, 0.75].forEach(f => {
        ctx.moveTo(sx, pH*f);      ctx.lineTo(sx - 8, pH*f);
        ctx.moveTo(sx + pW, pH*f); ctx.lineTo(sx + pW + 8, pH*f);
    });
    ctx.stroke();
    ctx.lineWidth = anchoLW;
    const by=25*sF, ry=42*sF, bw=65*sF, rr=11*sF;
    ctx.lineWidth=5*sF*grosor; ctx.beginPath();
    ctx.moveTo((w/2)-(bw/2),by); ctx.lineTo((w/2)+(bw/2),by); ctx.stroke();
    ctx.lineWidth=3.5*sF*grosor; ctx.strokeStyle="#c01c33";
    ctx.beginPath(); ctx.arc(w/2,ry,rr,0,Math.PI*2); ctx.stroke();
    ctx.restore();
}

function drawCourtOnCanvas() {
    const w = canvas.width, h = canvas.height;

    if (courtMode === 'full') {
        const halfH = h / 2;
        dibujarCanchaEnCanvas(w, halfH, false);
        dibujarCanchaEnCanvas(w, halfH, true, h);

        ctx.save();
        ctx.strokeStyle = "white"; ctx.lineWidth = 4*sF;
        ctx.beginPath(); ctx.moveTo(0, halfH); ctx.lineTo(w, halfH); ctx.stroke();
        const radiusCentral = w * 0.12;
        ctx.beginPath(); ctx.arc(w/2, halfH, radiusCentral, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    } else {
        dibujarCanchaEnCanvas(w, h, false);
    }
}

// --- TRAYECTORIA SUAVIZADA ---
function drawSmoothPath(path, color, width, dashed=false) {
    if (!path || path.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [5,5] : []);
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length-1; i++) {
        const c = path[i], n = path[i+1];
        ctx.quadraticCurveTo(c.x, c.y, c.x+(n.x-c.x)*0.35, c.y+(n.y-c.y)*0.35);
    }
    ctx.lineTo(path[path.length-1].x, path[path.length-1].y);
    ctx.stroke(); ctx.setLineDash([]);
}

// --------------------------------------------------------
// HELPER: posición de la pelota en un paso (imantada o libre)
// en modo estático (editor). En animación se usa getBallAnimPos().
// --------------------------------------------------------
function getBallDrawPos(stepIdx) {
    const portadorId = ball.portadorPorPaso[stepIdx] ?? null;
    if (portadorId) {
        const p = players.find(pl => pl.id === portadorId);
        if (p && p.steps[stepIdx]) {
            const last = p.steps[stepIdx][p.steps[stepIdx].length - 1];
            return { x: last.x + 13*sF, y: last.y - 13*sF };
        }
    }
    const path = ball.steps[stepIdx];
    if (path && path.length > 0) return { x: path[path.length-1].x, y: path[path.length-1].y };
    return null;
}

// Helper animación: posición de la pelota en modo reproducción.
// Si la pelota tiene recorrido propio (ax/ay seteados por el interpolador), lo usa.
// Si no (un único punto, siempre pegada), deriva la posición del jugador portador.
function getBallAnimPos() {
    const portadorId = ball.portadorPorPaso[currentStep] ?? null;
    const bPath      = ball.steps[currentStep];
    const tieneRecorrido = bPath && bPath.length > 1;

    if (portadorId && !tieneRecorrido) {
        // Pelota que estuvo pegada todo el paso: sigue al jugador
        const p = players.find(pl => pl.id === portadorId);
        if (p) {
            const px = (p.ax !== undefined) ? p.ax : p.steps[currentStep][p.steps[currentStep].length-1].x;
            const py = (p.ay !== undefined) ? p.ay : p.steps[currentStep][p.steps[currentStep].length-1].y;
            return { x: px + 13*sF, y: py - 13*sF };
        }
    }
    // Pelota con recorrido propio (suelta o que viajó antes de imantarse):
    // el interpolador ya cargó ax/ay, los usamos directamente.
    return {
        x: (ball.ax !== undefined) ? ball.ax : bPath[bPath.length-1].x,
        y: (ball.ay !== undefined) ? ball.ay : bPath[bPath.length-1].y
    };
}

// --------------------------------------------------------
// MOTOR DE RENDER UNIFICADO
// modoAnim : true  → animación interpolada (usa ax/ay)
//            false → editor estático (usa último punto del path)
// paraVideo: true  → dibuja la cancha en canvas (sin SVG overlay)
// --------------------------------------------------------
function _render(modoAnim, paraVideo) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (paraVideo) {
        ctx.fillStyle = "#c19a6b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawParquetTexture();
        drawCourtOnCanvas();
    } else {
        drawParquetTexture();
    }
    drawLogo();

    // --------------------------------------------------
    // MODO PIZARRA RÁPIDA: las fichas/pelota/pasos se invisibilizan (no
    // se dibuja nada de lo que sigue), pero sus datos (players, ball,
    // currentStep, etc.) quedan intactos en memoria sin tocarse. El
    // parquet y el logo de arriba sí se siguen dibujando normalmente,
    // para que la cancha se vea "completa" debajo del dibujo libre.
    // --------------------------------------------------
    if (typeof modoPizarraRapida !== 'undefined' && modoPizarraRapida) {
        if (!modoAnim && typeof actualizarBotonesUndoRedo === "function") actualizarBotonesUndoRedo();
        return;
    }

    const radius      = 15 * sF;
    const showHistory = historyToggle ? historyToggle.checked : true;

    // --------------------------------------------------
    // HISTORIAL DE PASOS
    // --------------------------------------------------
    // Nos lo salteamos mientras se arrastra algo: este bloque recorre
    // TODOS los pasos anteriores x TODOS los jugadores en cada frame, y
    // durante un arrastre no cambia nada de lo que dibuja, así que es
    // trabajo desperdiciado justo cuando más importa que cada frame sea
    // rápido. Se vuelve a dibujar normal apenas se suelta.
    if (showHistory && !isDragging) {
        ctx.save();
        for (let si = 0; si <= currentStep; si++) {
            const color        = stepColors[si % stepColors.length];
            const esPasoActual = (si === currentStep);
            ctx.globalAlpha   = esPasoActual ? 1.0 : 0.22;

            // — Trazos de jugadores —
            players.forEach(p => {
                const path = p.steps[si];
                if (!path || path.length === 0) return;
                // Trazo: solo si hay desplazamiento real (más de 1 punto)
                if (si > 0 && path.length > 1) {
                    drawSmoothPath(path, color, esPasoActual ? 3.5*sF : 2*sF, false);
                }
                // Fantasma en pasos anteriores (no en el actual)
                if (!modoAnim && !esPasoActual) {
                    const last = path[path.length-1];
                    ctx.save();
                    ctx.translate(last.x, last.y);
                    if (last.isScreen) {
                        ctx.rotate(last.angle * Math.PI/180);
                        ctx.fillStyle = p.team === 'red' ? '#c01c33' : '#0044CC';
                        ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                        ctx.strokeStyle = "#c01c33"; ctx.lineWidth = 2*sF;
                        ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                    } else {
                        drawJersey(p.team === 'red' ? '#c01c33' : '#0044CC', radius, p.label);
                    }
                    ctx.restore();
                }
            });

            // — Trazo y posición de la pelota —
            if (ball.active) {
                const bPath = ball.steps[si];
                // Siempre dibujamos el trazo propio de la pelota si tiene recorrido,
                // tanto si está suelta como si al final del path se imantó a un jugador.
                if (bPath && si > 0 && bPath.length > 1) {
                    drawSmoothPath(bPath, color, esPasoActual ? 3.5*sF : 2*sF, true);
                }
                // Fantasma de posición final en pasos anteriores
                if (!modoAnim && !esPasoActual) {
                    const pos = getBallDrawPos(si);
                    if (pos) {
                        ctx.save();
                        ctx.translate(pos.x, pos.y);
                        ctx.font = `${radius*1.3}px Arial`;
                        ctx.textAlign = "center"; ctx.textBaseline = "middle";
                        ctx.fillText("🏀", 0, 0);
                        ctx.restore();
                    }
                }
            }
        }
        ctx.restore();
    }

    // --------------------------------------------------
    // PASO ACTIVO — jugadores
    // --------------------------------------------------
    const activeColor = stepColors[currentStep % stepColors.length];

    players.forEach(p => {
        let posX, posY, isScr, ang, path, last;

        if (modoAnim) {
            posX = (p.ax !== undefined) ? p.ax : p.steps[currentStep][p.steps[currentStep].length-1].x;
            posY = (p.ay !== undefined) ? p.ay : p.steps[currentStep][p.steps[currentStep].length-1].y;
            isScr = p.as !== undefined ? p.as : false;
            ang   = p.aa !== undefined ? p.aa : 0;
        } else {
            path = p.steps[currentStep];
            if (!path || path.length === 0) return;
            last = path[path.length-1];
            posX = last.x; posY = last.y; isScr = last.isScreen; ang = last.angle;
        }

        // Mapeo inteligente: si en Media Cancha la Y real cae fuera del
        // canvas visible, el jugador está en la mitad de cancha que no
        // se ve en este modo -> minicírculo flotante en vez de ficha.
        if (courtMode === 'half' && posY > canvas.height) {
            const colorMini = p.team === 'red' ? '#c01c33' : '#0044CC';
            dibujarMiniCirculo(posX, colorMini, p.label, activeObj === p);
            return;
        }

        if (!modoAnim) {
            // Círculo de selección
            if (activeObj === p) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(last.x, last.y, radius*1.6, 0, Math.PI*2);
                ctx.strokeStyle = "rgba(255,255,255,0.85)";
                ctx.lineWidth = 3*sF; ctx.setLineDash([4,4]); ctx.stroke();
                ctx.restore();
            }
            // Trazo del paso activo (si arrancó fuera de foco -recién
            // "traído" de un minicírculo- no arrastramos una línea gigante)
            if (currentStep > 0 && path.length > 1 && path[0].y <= canvas.height) {
                drawSmoothPath(path, activeColor, 3.5*sF, false);
            }
        }

        ctx.save();
        ctx.translate(posX, posY);
        if (isScr) {
            ctx.rotate(ang * Math.PI/180);
            ctx.fillStyle = p.team === 'red' ? '#c01c33' : '#0044CC';
            ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
            ctx.strokeStyle = "#c01c33"; ctx.lineWidth = 2*sF;
            ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
            if (p.label) {
                ctx.rotate(-ang * Math.PI/180);
                ctx.fillStyle = "white";
                ctx.font = `bold ${radius*0.8}px sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(p.label, 0, 1);
            }
        } else {
            drawJersey(p.team === 'red' ? '#c01c33' : '#0044CC', radius, p.label);
        }
        ctx.restore();
    });

    // --------------------------------------------------
    // PASO ACTIVO — pelota
    // --------------------------------------------------
    if (ball.active) {
        let ballX, ballY;

        if (modoAnim) {
            const bp = getBallAnimPos();
            ballX = bp.x; ballY = bp.y;
        } else {
            // Mientras se arrastra la pelota libre, la mostramos en su posición real
            if (activeObj === ball) {
                const path = ball.steps[currentStep];
                const last = path[path.length-1];
                ballX = last.x; ballY = last.y;

                // Círculo de selección sobre la pelota
                ctx.save();
                ctx.beginPath();
                ctx.arc(ballX, ballY, radius*0.9, 0, Math.PI*2);
                ctx.strokeStyle = "rgba(255,255,255,0.85)";
                ctx.lineWidth = 3*sF; ctx.setLineDash([4,4]); ctx.stroke();
                ctx.restore();

                // Trazo de la pelota suelta en el paso activo
                if (currentStep > 0 && ball.steps[currentStep].length > 1) {
                    drawSmoothPath(ball.steps[currentStep], activeColor, 3.5*sF, true);
                }
            } else {
                const pos = getBallDrawPos(currentStep);
                if (!pos) return;
                ballX = pos.x; ballY = pos.y;
            }
        }

        const tieneCarrier = !!(ball.portadorPorPaso[currentStep] ?? null);
        const fueraDeFoco  = courtMode === 'half' && ballY > canvas.height;

        if (fueraDeFoco && tieneCarrier) {
            // La pelota "viaja" implícita dentro del minicírculo de su
            // portador: no se dibuja aparte para no duplicar el indicador.
        } else if (fueraDeFoco) {
            dibujarMiniCirculo(ballX, '#c07a00', '🏀', activeObj === ball);
        } else {
            ctx.save();
            ctx.translate(ballX, ballY);
            ctx.font = `${radius*1.6}px Arial`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("🏀", 0, 0);
            ctx.restore();

            // Pulso sutil al imantar/desimantar (dura ~350ms)
            if (performance.now() < pulsoImanHasta) {
                const restante = (pulsoImanHasta - performance.now()) / 350;
                ctx.save();
                ctx.globalAlpha = Math.max(0, restante) * 0.55;
                ctx.beginPath();
                ctx.arc(ballX, ballY, radius * (1.25 + (1 - restante) * 0.7), 0, Math.PI * 2);
                ctx.strokeStyle = "#c01c33";
                ctx.lineWidth = 2.2 * sF;
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    if (!modoAnim && typeof actualizarBotonesUndoRedo === "function") actualizarBotonesUndoRedo();
}

// --- API PÚBLICA ---
function draw()       { _render(false, false); }
function renderAnim() { _render(true,  isExporting); }

// ========================================================
// MOTOR DE DIBUJO LIBRE (Modo Pizarra Rápida)
// ========================================================

// Devuelve el lienzo (trazos + pila de rehacer) de la cara de cancha
// actualmente activa. Es la única fuente de verdad: nunca se mezclan
// los trazos de Cancha Completa con los de Media Cancha.
function lienzoActivo() {
    return lienzosLibres[(courtMode === 'full') ? 'full' : 'half'];
}

// Dibuja un trazo (ya terminado o en progreso) sobre el contexto 2D que
// se le pase. Con puntas y uniones redondeadas, para que se sienta como
// un marcador/fibrón real y no como una polilínea angulosa.
function dibujarTrazoLibre(ctxDestino, trazo) {
    const pts = trazo.puntos;
    if (!pts || pts.length === 0) return;
    const ancho = trazo.grosor * sF;

    ctxDestino.save();
    ctxDestino.strokeStyle = trazo.color;
    ctxDestino.fillStyle   = trazo.color;
    ctxDestino.lineWidth   = ancho;
    ctxDestino.lineCap     = 'round';
    ctxDestino.lineJoin    = 'round';

    if (pts.length === 1) {
        // Toque sin arrastre: un puntito, no una línea invisible.
        ctxDestino.beginPath();
        ctxDestino.arc(pts[0].x, pts[0].y, ancho / 2, 0, Math.PI * 2);
        ctxDestino.fill();
        ctxDestino.restore();
        return;
    }

    ctxDestino.beginPath();
    ctxDestino.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
        const c = pts[i], n = pts[i + 1];
        ctxDestino.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
    }
    ctxDestino.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctxDestino.stroke();
    ctxDestino.restore();
}

// Redibuja por completo el lienzo de dibujo libre (drawCanvas) a partir
// de los datos en memoria: todos los trazos guardados de la cara activa,
// más el trazo en curso (si hay uno a medio dibujar). Se llama después
// de cualquier cambio: nuevo punto, trazo terminado, borrado, undo/redo,
// cambio de cara, resize, o al activar/desactivar el modo.
function redibujarLienzoLibre() {
    if (!drawCtx || !drawCanvas) return;
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    if (!modoPizarraRapida) return; // oculto por completo en Modo Táctico

    const l = lienzoActivo();
    l.trazos.forEach(t => dibujarTrazoLibre(drawCtx, t));
    if (trazoActual) dibujarTrazoLibre(drawCtx, trazoActual);
}

// --- ÍCONOS SVG COMPARTIDOS (pantalla completa y cambiar modo de cancha) ---
const SVG_FULLSCREEN_ENTER =
    '<svg viewBox="0 0 24 24" width="16" height="16" style="display:block;margin:auto;">' +
    '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SVG_FULLSCREEN_EXIT =
    '<svg viewBox="0 0 24 24" width="16" height="16" style="display:block;margin:auto;">' +
    '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function svgIconoCanchaCompleta(w, h) {
    return `<svg viewBox="0 0 40 64" width="${w}" height="${h}" style="display:block;margin:auto;">
        <rect x="2" y="2" width="36" height="60" fill="none" stroke="currentColor" stroke-width="3"/>
        <line x1="2" y1="32" x2="38" y2="32" stroke="currentColor" stroke-width="2"/>
        <circle cx="20" cy="32" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
        <rect x="10" y="2" width="20" height="15" fill="none" stroke="currentColor" stroke-width="2"/>
        <rect x="10" y="47" width="20" height="15" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`;
}
function svgIconoMediaCancha(w, h) {
    return `<svg viewBox="0 0 40 34" width="${w}" height="${h}" style="display:block;margin:auto;">
        <rect x="2" y="2" width="36" height="30" fill="none" stroke="currentColor" stroke-width="3"/>
        <rect x="10" y="2" width="20" height="14" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M 6 32 A 14 14 0 0 1 34 32" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`;
}

// Muestra el ícono de la cancha a la que se pasaría al tocar el botón
// (si estoy en Cancha Completa, muestra el ícono de Media Cancha, y viceversa).
function actualizarIconoCambiarModo() {
    const btn = document.getElementById('changeCourtModeBtn');
    if (!btn) return;
    btn.innerHTML = (courtMode === 'full') ? svgIconoMediaCancha(20, 17) : svgIconoCanchaCompleta(15, 24);
}

// --- RESIZE Y FULLSCREEN ---
window.addEventListener('resize', () => { init(); setTimeout(init, 200); });

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('realFsBtn');
    if (btn) btn.innerHTML = document.fullscreenElement ? SVG_FULLSCREEN_EXIT : SVG_FULLSCREEN_ENTER;
    setTimeout(init, 150); setTimeout(init, 500);
});

function toggleRealFullscreen() {
    const btn = document.getElementById('realFsBtn');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
            .then(() => { if (btn) btn.innerHTML = SVG_FULLSCREEN_EXIT; setTimeout(init,150); setTimeout(init,450); })
            .catch(err => console.log(`Error fullscreen: ${err.message}`));
    } else {
        document.exitFullscreen()
            .then(() => { if (btn) btn.innerHTML = SVG_FULLSCREEN_ENTER; setTimeout(init,150); setTimeout(init,450); });
    }
}
