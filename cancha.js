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

function updateHalfCourtDrawing(w, h) {
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
    const aw = 95*sF, prop = logoCanchaImg.naturalHeight / logoCanchaImg.naturalWidth;
    const yLogo = (courtMode === 'full') ? canvas.height / 2 : canvas.height * 0.52;
    ctx.translate(canvas.width/2, yLogo);
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter      = 'brightness(0.3) contrast(1.2)';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(logoCanchaImg, -aw/2, -(aw*prop)/2, aw, aw*prop);
    ctx.restore();
}

// --- CANCHA EN CANVAS (solo export video) ---
function dibujarCanchaEnCanvas(w, hLocal, espejar, hTotal) {
    ctx.save();
    if (espejar) {
        ctx.translate(0, hTotal);
        ctx.scale(1, -1);
    }
    ctx.strokeStyle = "white"; ctx.lineWidth = 4*sF; ctx.fillStyle = "rgba(0,0,0,0.05)";
    const pW = w*0.33, rl = pW/2, pH = hLocal*0.52;
    const sX = w*0.06, tR = (w/2)-sX, stH = pH+rl-tR, sx = (w-pW)/2;
    ctx.fillRect(sx,0,pW,pH); ctx.strokeRect(sx,0,pW,pH);
    ctx.beginPath(); ctx.moveTo(sX,0); ctx.lineTo(sX,stH);
    ctx.arc(w/2,stH,tR,Math.PI,0,true); ctx.lineTo(w-sX,0); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2,pH,rl,0,Math.PI); ctx.stroke();
    const by=25*sF, ry=42*sF, bw=65*sF, rr=11*sF;
    ctx.lineWidth=5*sF; ctx.beginPath();
    ctx.moveTo((w/2)-(bw/2),by); ctx.lineTo((w/2)+(bw/2),by); ctx.stroke();
    ctx.lineWidth=3.5*sF; ctx.strokeStyle="#ff6600";
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

    const radius      = 15 * sF;
    const showHistory = historyToggle ? historyToggle.checked : true;

    // --------------------------------------------------
    // HISTORIAL DE PASOS
    // --------------------------------------------------
    if (showHistory) {
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
                        ctx.fillStyle = p.team === 'red' ? '#CC0000' : '#0044CC';
                        ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                        ctx.strokeStyle = "#CC0000"; ctx.lineWidth = 2*sF;
                        ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                    } else {
                        drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', radius, p.label);
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
        let posX, posY, isScr, ang;

        if (modoAnim) {
            posX = (p.ax !== undefined) ? p.ax : p.steps[currentStep][p.steps[currentStep].length-1].x;
            posY = (p.ay !== undefined) ? p.ay : p.steps[currentStep][p.steps[currentStep].length-1].y;
            isScr = p.as !== undefined ? p.as : false;
            ang   = p.aa !== undefined ? p.aa : 0;
        } else {
            const path = p.steps[currentStep];
            if (!path || path.length === 0) return;
            const last = path[path.length-1];
            posX = last.x; posY = last.y; isScr = last.isScreen; ang = last.angle;

            // Círculo de selección
            if (activeObj === p) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(last.x, last.y, radius*1.6, 0, Math.PI*2);
                ctx.strokeStyle = "rgba(255,255,255,0.85)";
                ctx.lineWidth = 3*sF; ctx.setLineDash([4,4]); ctx.stroke();
                ctx.restore();
            }
            // Trazo del paso activo
            if (currentStep > 0 && path.length > 1) {
                drawSmoothPath(path, activeColor, 3.5*sF, false);
            }
        }

        ctx.save();
        ctx.translate(posX, posY);
        if (isScr) {
            ctx.rotate(ang * Math.PI/180);
            ctx.fillStyle = p.team === 'red' ? '#CC0000' : '#0044CC';
            ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
            ctx.strokeStyle = "#cc0000"; ctx.lineWidth = 2*sF;
            ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
            if (p.label) {
                ctx.rotate(-ang * Math.PI/180);
                ctx.fillStyle = "white";
                ctx.font = `bold ${radius*0.8}px sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(p.label, 0, 1);
            }
        } else {
            drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', radius, p.label);
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
                ctx.arc(ballX, ballY, radius*1.15, 0, Math.PI*2);
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

        ctx.save();
        ctx.translate(ballX, ballY);
        ctx.font = `${radius*1.6}px Arial`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🏀", 0, 0);
        ctx.restore();
    }

    if (!modoAnim) { updateUndoButton(); updateRedoButton(); }
}

// --- API PÚBLICA ---
function draw()       { _render(false, false); }
function renderAnim() { _render(true,  isExporting); }

// --- RESIZE Y FULLSCREEN ---
window.addEventListener('resize', () => { init(); setTimeout(init, 200); });

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('realFsBtn');
    if (btn) btn.innerText = document.fullscreenElement ? "❌" : "⤢";
    setTimeout(init, 150); setTimeout(init, 500);
});

function toggleRealFullscreen() {
    const btn = document.getElementById('realFsBtn');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
            .then(() => { if (btn) btn.innerText = "❌"; setTimeout(init,150); setTimeout(init,450); })
            .catch(err => console.log(`Error fullscreen: ${err.message}`));
    } else {
        document.exitFullscreen()
            .then(() => { if (btn) btn.innerText = "⤢"; setTimeout(init,150); setTimeout(init,450); });
    }
}
