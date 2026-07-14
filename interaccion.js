// ========================================================
// PIZARRA OESTE - interaccion.js
// Motor de interacción: drag & drop, undo/redo, menú flotante.
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
        const current = path[i], next = path[i + 1];
        const a1 = Math.atan2(current.y - prev.y,    current.x - prev.x);
        const a2 = Math.atan2(next.y    - current.y, next.x    - current.x);
        if (Math.abs(a1 - a2) > 0.18) simplified.push(current);
    }
    simplified.push(path[path.length - 1]);
    return simplified;
}

// Posición real de la pelota en el paso actual (puede estar imantada)
function getBallPosEnPaso(stepIdx) {
    const portadorId = ball.portadorPorPaso[stepIdx] ?? null;
    if (portadorId) {
        const portador = players.find(p => p.id === portadorId);
        if (portador && portador.steps[stepIdx]) {
            const last = portador.steps[stepIdx][portador.steps[stepIdx].length - 1];
            return { x: last.x + 13*sF, y: last.y - 13*sF };
        }
    }
    const path = ball.steps[stepIdx];
    if (path && path.length > 0) return { x: path[path.length-1].x, y: path[path.length-1].y };
    return null;
}

// --------------------------------------------------------
// DRAG & DROP
// --------------------------------------------------------

function handleStart(e) {
    if (isEditionFinished) return;
    const pos = getPos(e);
    let found = null, minDistance = 35 * sF;

    const ballPos = getBallPosEnPaso(currentStep);
    const all     = ball.active ? [...players, ball] : [...players];

    all.forEach(obj => {
        let cx, cy;
        if (obj === ball) {
            if (!ballPos) return;
            cx = ballPos.x; cy = ballPos.y;
        } else {
            const last = obj.steps[currentStep][obj.steps[currentStep].length - 1];
            cx = last.x; cy = last.y;
        }
        const dist = Math.hypot(cx - pos.x, cy - pos.y);
        if (dist < minDistance) { minDistance = dist; found = obj; }
    });

    if (found) {
        found._undoSnapshot      = JSON.parse(JSON.stringify(found.steps[currentStep]));
        found._portadorSnapshot  = JSON.parse(JSON.stringify(ball.portadorPorPaso));
        found._ballStepSnapshot  = JSON.parse(JSON.stringify(ball.steps[currentStep]));

        // Al agarrar la pelota imantada: copiamos su posición real al path y desimantamos
        if (found === ball && ball.portadorPorPaso[currentStep]) {
            if (ballPos) {
                ball.steps[currentStep] = [{ x: ballPos.x, y: ballPos.y, isScreen: false, angle: 0 }];
            }
            ball.portadorPorPaso[currentStep] = null;
        }

        // Paso > 0: expandir path si solo tiene el punto heredado
        if (currentStep > 0 && found.steps[currentStep].length <= 1) {
            const stepPrev = found.steps[currentStep - 1];
            const lastPrev = stepPrev[stepPrev.length - 1];
            const esScreen = found.steps[currentStep]?.[0]?.isScreen ?? lastPrev.isScreen;
            const angulo   = found.steps[currentStep]?.[0]?.angle    ?? lastPrev.angle;
            found.steps[currentStep] = [{ x: lastPrev.x, y: lastPrev.y, isScreen: esScreen, angle: angulo }];
        }

        activeObj  = found;
        isDragging = true;
        // Cualquier nueva acción limpia el redo
        redoStack  = [];
        updateRedoButton();
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

    // Jugador que lleva la pelota: la pelota sigue como punto único sobre él
    if (activeObj !== ball && ball.portadorPorPaso[currentStep] === activeObj.id) {
        const playerLast = path[path.length - 1];
        ball.steps[currentStep] = [{
            x: playerLast.x + 13*sF, y: playerLast.y - 13*sF,
            isScreen: false, angle: 0
        }];
    }

    draw();
    updateFloatingUI();
}

function handleEnd() {
    if (!isDragging || !activeObj) { isDragging = false; return; }

    const path           = activeObj.steps[currentStep];
    const inicio         = path[0];
    const fin            = path[path.length - 1];
    const huboMovimiento = Math.hypot(fin.x - inicio.x, fin.y - inicio.y) > 5;

    if (path.length > 2) activeObj.steps[currentStep] = simplifyPath(path);

    // Jugador con pelota: actualizar punto de la pelota al último punto simplificado
    if (activeObj !== ball && ball.portadorPorPaso[currentStep] === activeObj.id) {
        const playerLast = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];
        ball.steps[currentStep] = [{
            x: playerLast.x + 13*sF, y: playerLast.y - 13*sF,
            isScreen: false, angle: 0
        }];
    }

    // Lógica de imán al soltar la pelota
    if (activeObj === ball) {
        playSound('bounceBall');
        const bLast        = ball.steps[currentStep][ball.steps[currentStep].length - 1];
        let minDistance    = 28 * sF;
        let jugadorCercano = null;

        players.forEach(p => {
            const pLast = p.steps[currentStep][p.steps[currentStep].length - 1];
            const dist  = Math.hypot(pLast.x - bLast.x, pLast.y - bLast.y);
            if (dist < minDistance) { minDistance = dist; jugadorCercano = p; }
        });

        if (jugadorCercano && !jugadorCercano.steps[currentStep][jugadorCercano.steps[currentStep].length - 1].isScreen) {
            ball.portadorPorPaso[currentStep] = jugadorCercano.id;
            const pLast = jugadorCercano.steps[currentStep][jugadorCercano.steps[currentStep].length - 1];
            const snapX = pLast.x + 13*sF, snapY = pLast.y - 13*sF;
            const bPath = ball.steps[currentStep];
            if (bPath.length > 1) {
                bPath[bPath.length - 1] = { x: snapX, y: snapY, isScreen: false, angle: 0 };
            } else {
                ball.steps[currentStep] = [{ x: snapX, y: snapY, isScreen: false, angle: 0 }];
            }
        } else {
            ball.portadorPorPaso[currentStep] = null;
        }
    } else {
        playSound('dropJersey');
    }

    // Guardar en undoStack si hubo movimiento real
    if (huboMovimiento && activeObj._undoSnapshot) {
        undoStack = undoStack.filter(item => !(item.obj === activeObj && item.step === currentStep));
        undoStack.push({
            obj:             activeObj,
            step:            currentStep,
            snapshot:        activeObj._undoSnapshot,
            portadorSnapshot: activeObj._portadorSnapshot,
            ballStepSnapshot: activeObj._ballStepSnapshot
        });
    }

    delete activeObj._undoSnapshot;
    delete activeObj._portadorSnapshot;
    delete activeObj._ballStepSnapshot;
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
// UNDO
// --------------------------------------------------------

function undoLastMove() {
    let index = -1;
    for (let i = undoStack.length - 1; i >= 0; i--) {
        if (undoStack[i].step === currentStep) { index = i; break; }
    }

    if (index === -1) {
        // Sin movimientos en este paso: retroceder un paso completo
        if (currentStep > 0) {
            // Guardar estado actual en redoStack antes de retroceder
            redoStack.push({ type: 'step' });
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

    // Guardar estado actual en redoStack para poder rehacerlo
    redoStack.push({
        type:            'move',
        obj:             lastAction.obj,
        step:            lastAction.step,
        snapshot:        JSON.parse(JSON.stringify(lastAction.obj.steps[lastAction.step])),
        portadorSnapshot: JSON.parse(JSON.stringify(ball.portadorPorPaso)),
        ballStepSnapshot: JSON.parse(JSON.stringify(ball.steps[lastAction.step]))
    });

    // Restaurar
    lastAction.obj.steps[lastAction.step] = JSON.parse(JSON.stringify(lastAction.snapshot));
    if (lastAction.portadorSnapshot) {
        ball.portadorPorPaso = JSON.parse(JSON.stringify(lastAction.portadorSnapshot));
    }
    if (lastAction.ballStepSnapshot) {
        ball.steps[lastAction.step] = JSON.parse(JSON.stringify(lastAction.ballStepSnapshot));
    }

    // Re-pegar la pelota si en el snapshot había portador
    const portadorId = ball.portadorPorPaso[lastAction.step];
    if (portadorId) {
        const portador = players.find(p => p.id === portadorId);
        if (portador) {
            const pLast = portador.steps[lastAction.step][portador.steps[lastAction.step].length - 1];
            ball.steps[lastAction.step] = [{
                x: pLast.x + 13*sF, y: pLast.y - 13*sF, isScreen: false, angle: 0
            }];
        }
    }

    activeObj = null; isDragging = false;
    draw(); updateFloatingUI(); updateUndoButton(); updateRedoButton();
}

// --------------------------------------------------------
// REDO
// --------------------------------------------------------

function redoLastMove() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();

    if (action.type === 'step') {
        // Rehacer un paso completo que fue deshecho
        [...players, ball].forEach(p => {
            const last = p.steps[currentStep][p.steps[currentStep].length - 1];
            p.steps.push([{ x: last.x, y: last.y, isScreen: last.isScreen, angle: last.angle }]);
        });
        const portadorActual = ball.portadorPorPaso[currentStep] ?? null;
        ball.portadorPorPaso.push(portadorActual);
        currentStep++;
        renderTimeline();
        updateStepUI();
        draw();
    } else {
        // Rehacer un movimiento
        // Guardar estado actual en undoStack para poder deshacerlo de nuevo
        undoStack.push({
            obj:              action.obj,
            step:             action.step,
            snapshot:         JSON.parse(JSON.stringify(action.obj.steps[action.step])),
            portadorSnapshot: JSON.parse(JSON.stringify(ball.portadorPorPaso)),
            ballStepSnapshot: JSON.parse(JSON.stringify(ball.steps[action.step]))
        });

        action.obj.steps[action.step] = JSON.parse(JSON.stringify(action.snapshot));
        ball.portadorPorPaso          = JSON.parse(JSON.stringify(action.portadorSnapshot));
        ball.steps[action.step]       = JSON.parse(JSON.stringify(action.ballStepSnapshot));

        activeObj = null; isDragging = false;
        draw(); updateFloatingUI();
    }

    updateUndoButton(); updateRedoButton();
}

// --------------------------------------------------------
// ACTUALIZAR BOTONES
// --------------------------------------------------------

function updateUndoButton() {
    const btn     = document.getElementById('undoBtn');
    if (!btn) return;
    const enabled = undoStack.some(item => item.step === currentStep) || currentStep > 0;
    btn.style.opacity       = enabled ? "1"       : "0.3";
    btn.style.pointerEvents = enabled ? "auto"    : "none";
    btn.style.cursor        = enabled ? "pointer" : "default";
}

function updateRedoButton() {
    const btn     = document.getElementById('redoBtn');
    if (!btn) return;
    const enabled = redoStack.length > 0;
    btn.style.opacity       = enabled ? "1"       : "0.3";
    btn.style.pointerEvents = enabled ? "auto"    : "none";
    btn.style.cursor        = enabled ? "pointer" : "default";
}

// --------------------------------------------------------
// MENÚ FLOTANTE
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
        if (hijo !== rotBtn && hijo !== txtBtn && hijo.id !== 'spin-btn') {
            hijo.style.display = "none";
        }
    });

    const esteEsPortador = ball.portadorPorPaso[currentStep] === activeObj.id;

    rotBtn.style.display = "block";
    if (esteEsPortador) {
        rotBtn.textContent         = "🏀";
        rotBtn.style.opacity       = "0.5";
        rotBtn.style.pointerEvents = "none";
    } else {
        rotBtn.style.opacity       = "1";
        rotBtn.style.pointerEvents = "auto";
        rotBtn.textContent         = last.isScreen ? "❌" : "🛡️";
        rotBtn.onclick = () => {
            last.isScreen = !last.isScreen;
            if (!last.isScreen) last.angle = 0;
            draw(); updateFloatingUI();
        };
    }

    let spinBtn = document.getElementById('spin-btn');
    if (!spinBtn) {
        spinBtn = document.createElement('button');
        spinBtn.id        = 'spin-btn';
        spinBtn.className = 'f-btn';
        floatingUI.appendChild(spinBtn);
    }
    if (last.isScreen && !esteEsPortador) {
        spinBtn.style.display = "block";
        spinBtn.textContent   = "🔄";
        spinBtn.onclick = () => { last.angle = (last.angle + 45) % 360; draw(); };
    } else {
        spinBtn.style.display = "none";
    }

    if (currentStep === 0) {
        txtBtn.style.display = "block";
        txtBtn.textContent   = "🅰️";
        txtBtn.onclick = () => {
            const nuevoDorsal = prompt("Número:", activeObj.label || "");
            if (nuevoDorsal !== null) {
                activeObj.label = nuevoDorsal;
                const saved = JSON.parse(localStorage.getItem('pizarraLabels') || '{"red":[],"blue":[]}');
                saved[activeObj.team][parseInt(activeObj.id.split('-')[1])] = nuevoDorsal;
                localStorage.setItem('pizarraLabels', JSON.stringify(saved));
                draw();
            }
        };
    } else {
        txtBtn.style.display = "none";
    }
}
