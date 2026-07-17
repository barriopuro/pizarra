// ========================================================
// PIZARRA OESTE - interaccion.js
// Motor de interacción: drag & drop multi-dispositivo,
// sistema de undo/redo consolidado, menú flotante.
// Depende de: estado.js, cancha.js, jugadores.js, audio.js
// ========================================================

// --------------------------------------------------------
// UTILIDADES
// --------------------------------------------------------

function getPos(e) {
    const rect    = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function simplifyPath(path) {
    if (!path || path.length < 3) return path;
    const simplified = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const prev    = simplified[simplified.length - 1];
        const current = path[i];
        const next    = path[i + 1];
        const angle1  = Math.atan2(current.y - prev.y,    current.x - prev.x);
        const angle2  = Math.atan2(next.y    - current.y, next.x    - current.x);
        if (Math.abs(angle1 - angle2) > 0.18) simplified.push(current);
    }
    simplified.push(path[path.length - 1]);
    return simplified;
}

// Devuelve la posición actual de la pelota en el paso dado,
// considerando si está imantada a algún jugador en ese paso.
function getBallPosEnPaso(stepIdx) {
    const portadorId = ball.portadorPorPaso[stepIdx] ?? null;
    if (portadorId) {
        const portador = players.find(p => p.id === portadorId);
        if (portador && portador.steps[stepIdx]) {
            const last = portador.steps[stepIdx][portador.steps[stepIdx].length - 1];
            return { x: last.x + (13 * sF), y: last.y - (13 * sF) };
        }
    }
    // Pelota suelta: usa su propio path
    const path = ball.steps[stepIdx];
    if (path && path.length > 0) {
        const last = path[path.length - 1];
        return { x: last.x, y: last.y };
    }
    return null;
}

// --------------------------------------------------------
// DRAG & DROP
// --------------------------------------------------------

function handleStart(e) {
    if (isEditionFinished) return;
    const pos = getPos(e);
    let found = null, minDistance = 35 * sF;

    // Calcular posición real de la pelota (puede estar imantada)
    const ballPos = getBallPosEnPaso(currentStep);

    const all = ball.active ? [...players, ball] : [...players];
    all.forEach(obj => {
        let checkX, checkY;
        if (obj === ball) {
            if (!ballPos) return;
            checkX = ballPos.x;
            checkY = ballPos.y;
        } else {
            const last = obj.steps[currentStep][obj.steps[currentStep].length - 1];
            checkX = last.x;
            checkY = last.y;
        }
        const dist = Math.hypot(checkX - pos.x, checkY - pos.y);
        if (dist < minDistance) { minDistance = dist; found = obj; }
    });

    if (found) {
        // Snapshot para undo
        found._undoSnapshot     = JSON.parse(JSON.stringify(found.steps[currentStep]));
        found._portadorSnapshot = JSON.parse(JSON.stringify(ball.portadorPorPaso));
        // Si agarramos la pelota imantada, actualizamos su path
        // para que arranque desde su posición real (sobre el jugador)
        if (found === ball && ball.portadorPorPaso[currentStep]) {
            if (ballPos) {
                ball.steps[currentStep] = [{
                    x: ballPos.x, y: ballPos.y, isScreen: false, angle: 0
                }];
            }
            // Desimantamos al soltar del jugador anterior
            ball.portadorPorPaso[currentStep] = null;
        }

        // Si es paso > 0 y el path tiene solo el punto heredado, lo expandimos
        if (currentStep > 0 && found.steps[currentStep].length <= 1) {
            const stepPrev = found.steps[currentStep - 1];
            const lastPrev = stepPrev[stepPrev.length - 1];
            const esScreen = found.steps[currentStep]?.[0]?.isScreen ?? lastPrev.isScreen;
            const angulo   = found.steps[currentStep]?.[0]?.angle    ?? lastPrev.angle;
            found.steps[currentStep] = [{ x: lastPrev.x, y: lastPrev.y, isScreen: esScreen, angle: angulo }];
        }

        activeObj  = found;
        isDragging = true;
        updateFloatingUI();
        if (activeObj === ball) playSound('bounceBall'); else playSound('grabJersey');
    } else {
        activeObj = null;
        updateFloatingUI();
    }
    draw();
}

function handleMove(e) {
    if (!isDragging || !activeObj) return;
    e.preventDefault();

    let pos           = getPos(e);
    const path        = activeObj.steps[currentStep];
    const last        = path[path.length - 1];
    const radioMargen = 12 * sF;

    pos.x = Math.max(radioMargen, Math.min(canvas.width  - radioMargen, pos.x));
    pos.y = Math.max(radioMargen, Math.min(canvas.height - radioMargen, pos.y));

    if (currentStep === 0) {
        path[0] = { x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle };
    } else {
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
        if (dist > 30 * sF) {
            path.push({ x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle });
        }
    }

    // Motor magnético: jugador que lleva la pelota → pelota sigue sin path propio
    if (activeObj !== ball && ball.portadorPorPaso[currentStep] === activeObj.id) {
        const playerLast = path[path.length - 1];
        ball.steps[currentStep] = [{
            x: playerLast.x + (13 * sF), y: playerLast.y - (13 * sF),
            isScreen: false, angle: 0
        }];
    }

    draw();
    updateFloatingUI();
}

function handleEnd() {
    if (!isDragging || !activeObj) { isDragging = false; return; }

    const path   = activeObj.steps[currentStep];
    const inicio = path[0];
    const fin    = path[path.length - 1];
    const huboMovimiento = Math.hypot(fin.x - inicio.x, fin.y - inicio.y) > 5;

    // Simplificar trazado
    if (path.length > 2) activeObj.steps[currentStep] = simplifyPath(path);

    // Si el jugador que llevaba la pelota terminó de moverse → actualizamos el punto de la pelota
    if (activeObj !== ball && ball.portadorPorPaso[currentStep] === activeObj.id) {
        const playerLast = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];
        ball.steps[currentStep] = [{
            x: playerLast.x + (13 * sF), y: playerLast.y - (13 * sF),
            isScreen: false, angle: 0
        }];
    }

    // Lógica de imán al soltar la pelota
    if (activeObj === ball) {
        playSound('bounceBall');

        const bLast       = ball.steps[currentStep][ball.steps[currentStep].length - 1];
        let minDistance   = 28 * sF;
        let jugadorCercano = null;

        players.forEach(p => {
            const pLast = p.steps[currentStep][p.steps[currentStep].length - 1];
            const dist  = Math.hypot(pLast.x - bLast.x, pLast.y - bLast.y);
            if (dist < minDistance) { minDistance = dist; jugadorCercano = p; }
        });

        if (jugadorCercano && !jugadorCercano.steps[currentStep][jugadorCercano.steps[currentStep].length - 1].isScreen) {
            // Imantamos al jugador nuevo:
            // Conservamos el path recorrido durante el drag y solo ajustamos
            // el último punto para que quede exactamente sobre el jugador.
            ball.portadorPorPaso[currentStep] = jugadorCercano.id;
            const pLast  = jugadorCercano.steps[currentStep][jugadorCercano.steps[currentStep].length - 1];
            const snapX  = pLast.x + (13 * sF);
            const snapY  = pLast.y - (13 * sF);
            const bPath  = ball.steps[currentStep];
            if (bPath.length > 1) {
                // Hay trayectoria: ajustamos solo el último punto
                bPath[bPath.length - 1] = { x: snapX, y: snapY, isScreen: false, angle: 0 };
            } else {
                // La pelota no se movió (estaba pegada y no hubo drag real):
                // dejamos un punto único sobre el nuevo jugador
                ball.steps[currentStep] = [{ x: snapX, y: snapY, isScreen: false, angle: 0 }];
            }
        } else {
            ball.portadorPorPaso[currentStep] = null;
        }
    } else {
        playSound('dropJersey');
    }

    // Guardar en undoStack
    if (huboMovimiento && activeObj._undoSnapshot) {
        undoStack = undoStack.filter(item => !(item.obj === activeObj && item.step === currentStep));
        undoStack.push({
            obj:             activeObj,
            step:            currentStep,
            snapshot:        activeObj._undoSnapshot,
            portadorSnapshot: activeObj._portadorSnapshot
        });
        // Un movimiento nuevo invalida el historial de "rehacer" pendiente
        redoStack = [];
        updateRedoButton();
    }

    delete activeObj._undoSnapshot;
    delete activeObj._portadorSnapshot;
    isDragging = false;
    draw();
}

canvas.addEventListener('mousedown',  handleStart);
canvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('mousemove',  handleMove);
window.addEventListener('touchmove',  handleMove,  { passive: false });
window.addEventListener('mouseup',    handleEnd);
window.addEventListener('touchend',   handleEnd);

// --------------------------------------------------------
// ASIGNAR DORSAL: doble clic (mouse) / doble toque (táctil)
// --------------------------------------------------------

function encontrarJugadorEnPosicion(pos) {
    let found = null, minDistance = 35 * sF;
    players.forEach(p => {
        const last = p.steps[currentStep][p.steps[currentStep].length - 1];
        const dist = Math.hypot(last.x - pos.x, last.y - pos.y);
        if (dist < minDistance) { minDistance = dist; found = p; }
    });
    return found;
}

let jugadorEditandoDorsal = null;

function pedirDorsal(jugador) {
    if (!jugador || currentStep !== 0 || isEditionFinished) return;
    jugadorEditandoDorsal = jugador;

    const modal = document.getElementById('dorsalModal');
    const input = document.getElementById('dorsalInput');
    if (input) input.value = jugador.label || '';
    if (modal) modal.style.display = 'flex';
    if (input) setTimeout(() => { input.focus(); input.select(); }, 50);
}

function cerrarDorsalModal() {
    const modal = document.getElementById('dorsalModal');
    if (modal) modal.style.display = 'none';
    jugadorEditandoDorsal = null;
}

function aceptarDorsalModal() {
    if (!jugadorEditandoDorsal) { cerrarDorsalModal(); return; }
    const input       = document.getElementById('dorsalInput');
    const nuevoDorsal = input ? input.value : '';
    const jugador     = jugadorEditandoDorsal;

    jugador.label = nuevoDorsal;
    const savedLabels = JSON.parse(localStorage.getItem('pizarraLabels') || '{"red":[],"blue":[]}');
    savedLabels[jugador.team][parseInt(jugador.id.split('-')[1])] = nuevoDorsal;
    localStorage.setItem('pizarraLabels', JSON.stringify(savedLabels));
    draw();

    cerrarDorsalModal();
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('dorsalInput');
    if (!input) return;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  aceptarDorsalModal();
        if (e.key === 'Escape') cerrarDorsalModal();
    });
});

function handleDoubleClick(e) {
    const jugador = encontrarJugadorEnPosicion(getPos(e));
    if (jugador) pedirDorsal(jugador);
}

let lastTapTime = 0;
let lastTapPos  = null;
function handleTouchEndDobleToque(e) {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const pos  = {
        x: e.changedTouches[0].clientX - rect.left,
        y: e.changedTouches[0].clientY - rect.top
    };
    const ahora = Date.now();
    if (lastTapPos && (ahora - lastTapTime) < 350 &&
        Math.hypot(pos.x - lastTapPos.x, pos.y - lastTapPos.y) < 30 * sF) {
        const jugador = encontrarJugadorEnPosicion(pos);
        if (jugador) pedirDorsal(jugador);
        lastTapTime = 0;
        lastTapPos  = null;
    } else {
        lastTapTime = ahora;
        lastTapPos  = pos;
    }
}

canvas.addEventListener('dblclick', handleDoubleClick);
canvas.addEventListener('touchend', handleTouchEndDobleToque);

// --------------------------------------------------------
// SISTEMA DE DESHACER / REHACER
// --------------------------------------------------------

function undoLastMove() {
    let index = -1;
    for (let i = undoStack.length - 1; i >= 0; i--) {
        if (undoStack[i].step === currentStep) { index = i; break; }
    }

    if (index === -1) {
        // No hay un movimiento puntual para deshacer en este paso:
        // deshacemos el paso completo (volvemos al anterior), guardando
        // todo lo necesario para poder rehacerlo después.
        if (currentStep > 0) {
            redoStack.push({
                type: 'deleteStep',
                step: currentStep,
                playersSnapshot: players.map(p => ({
                    id:   p.id,
                    data: JSON.parse(JSON.stringify(p.steps[currentStep]))
                })),
                ballSnapshot: JSON.parse(JSON.stringify(ball.steps[currentStep])),
                portador:     ball.portadorPorPaso[currentStep] ?? null
            });

            [...players, ball].forEach(p => p.steps.pop());
            ball.portadorPorPaso.pop();
            currentStep--;
            renderTimeline();
            updateStepUI();
            draw();
            updateRedoButton();
        }
        return;
    }

    const lastAction = undoStack.splice(index, 1)[0];

    // Guardamos el estado actual (el que se va a pisar) para poder rehacerlo
    redoStack.push({
        type:             'move',
        obj:              lastAction.obj,
        step:             lastAction.step,
        snapshot:         JSON.parse(JSON.stringify(lastAction.obj.steps[lastAction.step])),
        portadorSnapshot: JSON.parse(JSON.stringify(ball.portadorPorPaso))
    });

    lastAction.obj.steps[lastAction.step] = JSON.parse(JSON.stringify(lastAction.snapshot));

    // Restaurar estado del imán
    if (lastAction.portadorSnapshot) {
        ball.portadorPorPaso = JSON.parse(JSON.stringify(lastAction.portadorSnapshot));
        // Re-pegar la pelota si en el snapshot este jugador la tenía
        const portadorId = ball.portadorPorPaso[lastAction.step];
        if (portadorId) {
            const portador = players.find(p => p.id === portadorId);
            if (portador) {
                const pLast = portador.steps[lastAction.step][portador.steps[lastAction.step].length - 1];
                ball.steps[lastAction.step] = [{
                    x: pLast.x + (13 * sF), y: pLast.y - (13 * sF),
                    isScreen: false, angle: 0
                }];
            }
        }
    }

    activeObj  = null;
    isDragging = false;
    draw();
    updateFloatingUI();
    updateUndoButton();
    updateRedoButton();
}

function redoLastMove() {
    if (redoStack.length === 0) return;
    const accion = redoStack.pop();

    if (accion.type === 'move') {
        // Guardamos el estado actual para poder volver a deshacer este redo
        undoStack = undoStack.filter(item => !(item.obj === accion.obj && item.step === accion.step));
        undoStack.push({
            obj:              accion.obj,
            step:             accion.step,
            snapshot:         JSON.parse(JSON.stringify(accion.obj.steps[accion.step])),
            portadorSnapshot: JSON.parse(JSON.stringify(ball.portadorPorPaso))
        });

        accion.obj.steps[accion.step] = JSON.parse(JSON.stringify(accion.snapshot));
        if (accion.portadorSnapshot) {
            ball.portadorPorPaso = JSON.parse(JSON.stringify(accion.portadorSnapshot));
        }
    } else if (accion.type === 'deleteStep') {
        // Reconstruimos el paso que se había quitado con "deshacer"
        players.forEach(p => {
            const snap = accion.playersSnapshot.find(s => s.id === p.id);
            const last = p.steps[p.steps.length - 1];
            p.steps.push(snap ? JSON.parse(JSON.stringify(snap.data)) : JSON.parse(JSON.stringify(last)));
        });
        ball.steps.push(JSON.parse(JSON.stringify(accion.ballSnapshot)));
        ball.portadorPorPaso.push(accion.portador ?? null);
        currentStep = accion.step;
        renderTimeline();
        updateStepUI();
    }

    activeObj  = null;
    isDragging = false;
    draw();
    updateFloatingUI();
    updateUndoButton();
    updateRedoButton();
}

function updateUndoButton() {
    const undoBtn = document.getElementById('undoBtn');
    if (!undoBtn) return;
    const enabled = undoStack.some(item => item.step === currentStep) || currentStep > 0;
    undoBtn.style.opacity       = enabled ? "1"       : "0.3";
    undoBtn.style.pointerEvents = enabled ? "auto"    : "none";
    undoBtn.style.cursor        = enabled ? "pointer" : "default";
}

function updateRedoButton() {
    const redoBtn = document.getElementById('redoBtn');
    if (!redoBtn) return;
    const enabled = redoStack.length > 0;
    redoBtn.style.opacity       = enabled ? "1"       : "0.3";
    redoBtn.style.pointerEvents = enabled ? "auto"    : "none";
    redoBtn.style.cursor        = enabled ? "pointer" : "default";
}

// --------------------------------------------------------
// MENÚ FLOTANTE SOBRE JUGADOR ACTIVO
// --------------------------------------------------------

function updateFloatingUI() {
    if (!activeObj || activeObj === ball || isEditionFinished) {
        floatingUI.style.display = "none";
        return;
    }

    const last = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];

    floatingUI.style.display       = "flex";
    floatingUI.style.flexDirection = "row";
    floatingUI.style.gap           = "6px";
    floatingUI.style.position      = "absolute";
    floatingUI.style.left          = last.x + "px";
    floatingUI.style.top           = (last.y - 56) + "px";
    floatingUI.style.transform     = "translateX(-50%)";

    Array.from(floatingUI.children).forEach(hijo => {
        if (hijo !== rotBtn && hijo.id !== 'spin-btn') {
            hijo.style.display = "none";
        }
    });

    const esteEsPortador = ball.portadorPorPaso[currentStep] === activeObj.id;

    // Botón cortina / indicador de imán
    rotBtn.style.display = "block";
    if (esteEsPortador) {
        rotBtn.textContent         = "🏀";
        rotBtn.title                = "Lleva la pelota";
        rotBtn.style.opacity       = "0.5";
        rotBtn.style.pointerEvents = "none";
    } else {
        rotBtn.style.opacity       = "1";
        rotBtn.style.pointerEvents = "auto";
        rotBtn.textContent         = last.isScreen ? "❌" : "🛡️";
        rotBtn.title                = last.isScreen ? "Quitar Cortina" : "Poner Cortina";
        rotBtn.onclick = () => {
            last.isScreen = !last.isScreen;
            if (!last.isScreen) last.angle = 0;
            draw();
            updateFloatingUI();
        };
    }

    // Botón girar cortina
    let spinBtn = document.getElementById('spin-btn');
    if (!spinBtn) {
        spinBtn           = document.createElement('button');
        spinBtn.id        = 'spin-btn';
        spinBtn.className = 'f-btn';
        floatingUI.appendChild(spinBtn);
    }
    if (last.isScreen && !esteEsPortador) {
        spinBtn.style.display = "block";
        spinBtn.textContent   = "🔄";
        spinBtn.title         = "Rotar Cortina";
        spinBtn.onclick = () => { last.angle = (last.angle + 45) % 360; draw(); };
    } else {
        spinBtn.style.display = "none";
    }
}
