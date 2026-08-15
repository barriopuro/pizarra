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

// Devuelve la posición actual de UNA pelota en el paso dado,
// considerando si está imantada a algún jugador en ese paso.
function getBallPosEnPaso(ballObj, stepIdx) {
    const portadorId = ballObj.portadorPorPaso[stepIdx] ?? null;
    if (portadorId) {
        const portador = players.find(p => p.id === portadorId);
        if (portador && portador.steps[stepIdx]) {
            const last = portador.steps[stepIdx][portador.steps[stepIdx].length - 1];
            return { x: last.x + (13 * sF), y: last.y - (13 * sF) };
        }
    }
    // Pelota suelta: usa su propio path
    const path = ballObj.steps[stepIdx];
    if (path && path.length > 0) {
        const last = path[path.length - 1];
        return { x: last.x, y: last.y };
    }
    return null;
}

// Un jugador es un objeto de equipo 'red'/'blue' (a diferencia de una
// pelota -team:'ball'- o un objeto de utilería -ver esUtileria() en
// estado.js-).
function esJugador(obj) {
    return !!obj && (obj.team === 'red' || obj.team === 'blue');
}

// --------------------------------------------------------
// SNAPSHOT DE PORTADORES (para deshacer/rehacer con varias pelotas)
// --------------------------------------------------------
// Antes se guardaba una única "foto" de ball.portadorPorPaso. Con
// balls[] hace falta guardar la de CADA pelota, identificada por su id
// (para poder restaurarla aunque el orden del arreglo cambie mientras
// tanto por un agregado/eliminado).
function snapshotPortadores() {
    return balls.map(b => ({ id: b.id, arr: JSON.parse(JSON.stringify(b.portadorPorPaso)) }));
}
function restaurarPortadores(snapshot) {
    if (!snapshot) return;
    snapshot.forEach(entry => {
        const b = balls.find(x => x.id === entry.id);
        if (b) b.portadorPorPaso = JSON.parse(JSON.stringify(entry.arr));
    });
}

// --------------------------------------------------------
// PROPAGACIÓN DEL PORTADOR HACIA ADELANTE (corrige bug de edición)
// --------------------------------------------------------
// Cada paso "hereda" el portador del paso anterior al crearse (ver
// addNewStep en ui.js): portadorPorPaso[N+1] arranca como una COPIA de
// portadorPorPaso[N] en ese momento. El problema: si más tarde editamos
// el pase en el paso N (p.ej. "el jugador 1 le pasa al jugador 3" en vez
// de al jugador 2), esa copia en el paso N+1 queda vieja/huérfana -sigue
// apuntando al jugador 2-, y la pelota se "olvida" de seguir al nuevo
// portador cuando ese paso se mueve.
//
// La solución: al cambiar el portador en el paso `desdeStep`, recorremos
// los pasos siguientes y, mientras sigan teniendo el portador VIEJO tal
// cual (es decir, nunca fueron tocados a mano después = solo heredaron
// el valor), los actualizamos al portador NUEVO. Nos detenemos apenas
// encontramos un paso distinto: ahí hubo una acción propia del usuario
// (otro pase, otra suelta) que no debemos pisar.
//
// Devuelve el detalle de los pasos afectados (para poder deshacer el
// cambio con precisión desde undoLastMove).
function propagarCambioDePortador(ballObj, desdeStep, portadorViejo) {
    const portadorNuevo = ballObj.portadorPorPaso[desdeStep] ?? null;
    if (portadorNuevo === portadorViejo) return [];

    // Posición real donde quedó la pelota al final del paso editado: la
    // usamos como ancla si el nuevo estado es "suelta" (sin portador).
    const pathEdit  = ballObj.steps[desdeStep];
    const posSuelta = pathEdit ? pathEdit[pathEdit.length - 1] : null;
    const afectados = [];

    for (let j = desdeStep + 1; j < ballObj.steps.length; j++) {
        if ((ballObj.portadorPorPaso[j] ?? null) !== portadorViejo) break;

        // Guardamos el estado previo de este paso por si hay que deshacer
        afectados.push({
            step:     j,
            portador: ballObj.portadorPorPaso[j] ?? null,
            steps:    JSON.parse(JSON.stringify(ballObj.steps[j]))
        });

        ballObj.portadorPorPaso[j] = portadorNuevo;

        // Solo recalculamos la posición anclada si ese paso nunca fue
        // tocado a mano (un único punto = heredado; con más de un punto
        // hay un trazo propio dibujado ahí, y no lo tocamos).
        if (ballObj.steps[j] && ballObj.steps[j].length === 1) {
            if (portadorNuevo) {
                const portador = players.find(p => p.id === portadorNuevo);
                if (portador && portador.steps[j]) {
                    const pLast = portador.steps[j][portador.steps[j].length - 1];
                    ballObj.steps[j] = [{ x: pLast.x + 13*sF, y: pLast.y - 13*sF, isScreen: false, angle: 0 }];
                }
            } else if (posSuelta) {
                ballObj.steps[j] = [{ x: posSuelta.x, y: posSuelta.y, isScreen: false, angle: 0 }];
            }
        }
    }
    return afectados;
}

// --------------------------------------------------------
// DRAG & DROP
// --------------------------------------------------------

function handleStart(e) {
    if (isEditionFinished) return;
    const pos = getPos(e);
    let found = null, minDistance = 35 * sF;

    // Posición real (imantada o suelta) de cada pelota activa en este paso
    const ballPosMap = new Map();
    balls.forEach(b => { if (b.active) ballPosMap.set(b, getBallPosEnPaso(b, currentStep)); });

    // Los objetos de utilería solo son clicables/arrastrables en el Paso Inicial
    const propsClicables = (currentStep === 0) ? props : [];
    const all = [...players, ...balls.filter(b => b.active), ...propsClicables];

    all.forEach(obj => {
        let checkX, checkY;
        if (obj.team === 'ball') {
            const bp = ballPosMap.get(obj);
            if (!bp) return;
            checkX = bp.x;
            checkY = bp.y;
        } else if (esUtileria(obj)) {
            checkX = obj.x;
            checkY = obj.y;
        } else {
            const last = obj.steps[currentStep][obj.steps[currentStep].length - 1];
            checkX = last.x;
            checkY = last.y;
        }
        // Si la ficha está "fuera de foco" en Media Cancha, el punto
        // clickeable real es el del minicírculo (donde se ve), no su
        // coordenada verdadera (que está fuera del canvas).
        if (courtMode === 'half' && checkY > canvas.height) {
            const mini = posicionMiniCirculo(checkX);
            checkX = mini.cx; checkY = mini.cy;
        }
        const dist = Math.hypot(checkX - pos.x, checkY - pos.y);
        if (dist < minDistance) { minDistance = dist; found = obj; }
    });

    // --- Objeto de utilería: arrastre simple, sin pasos ni deshacer ---
    if (found && esUtileria(found)) {
        activeObj  = found;
        isDragging = true;
        activarPulsoSeleccion(found);
        updateFloatingUI();
        playSound('grabJersey');
        draw();
        return;
    }

    if (found) {
        // Snapshot para undo (del estado real, no del minicírculo)
        found._undoSnapshot     = JSON.parse(JSON.stringify(found.steps[currentStep]));
        found._portadorSnapshot = snapshotPortadores();

        // Si lo que agarramos era un minicírculo (fuera de foco en Media
        // Cancha), arrancamos el arrastre desde su posición visual: así
        // el trazo no "salta" desde un punto invisible fuera del canvas.
        const ultimoPunto = found.steps[currentStep][found.steps[currentStep].length - 1];
        if (courtMode === 'half' && ultimoPunto.y > canvas.height) {
            const mini = posicionMiniCirculo(ultimoPunto.x);
            found.steps[currentStep] = [{ x: mini.cx, y: mini.cy, isScreen: false, angle: 0 }];
        }

        // Si agarramos una pelota imantada, actualizamos su path
        // para que arranque desde su posición real (sobre el jugador)
        if (found.team === 'ball' && found.portadorPorPaso[currentStep]) {
            const bp = ballPosMap.get(found);
            if (bp) {
                found.steps[currentStep] = [{
                    x: bp.x, y: bp.y, isScreen: false, angle: 0
                }];
            }
            // Desimantamos al soltar del jugador anterior
            found.portadorPorPaso[currentStep] = null;
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
        activarPulsoSeleccion(found);
        updateFloatingUI();
        if (activeObj.team === 'ball') playSound('bounceBall'); else playSound('grabJersey');
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
    const radioMargen = 12 * sF;
    pos.x = Math.max(radioMargen, Math.min(canvas.width  - radioMargen, pos.x));
    pos.y = Math.max(radioMargen, Math.min(canvas.height - radioMargen, pos.y));

    // --- Objeto de utilería: posición única (x,y), sin pasos ---
    if (esUtileria(activeObj)) {
        activeObj.x = pos.x;
        activeObj.y = pos.y;
        solicitarRedibujo();
        if (typeof updatePropFloatingUI === "function") updatePropFloatingUI();
        return;
    }

    const path = activeObj.steps[currentStep];
    const last = path[path.length - 1];

    if (currentStep === 0) {
        path[0] = { x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle };
    } else {
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
        if (dist > 30 * sF) {
            path.push({ x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle });
        }
    }

    // Motor magnético: jugador que lleva alguna(s) pelota(s) → esas
    // pelotas siguen sin path propio (recorremos TODAS: nada impide que
    // dos pelotas distintas estén imantadas al mismo jugador a la vez).
    if (activeObj.team !== 'ball') {
        const playerLast = path[path.length - 1];
        balls.forEach(b => {
            if (b.portadorPorPaso[currentStep] === activeObj.id) {
                b.steps[currentStep] = [{
                    x: playerLast.x + (13 * sF), y: playerLast.y - (13 * sF),
                    isScreen: false, angle: 0
                }];
            }
        });
    }

    solicitarRedibujo();
    // Las pelotas no usan el menú flotante de jugador (cortina/imán, es
    // solo para jugadores) pero sí necesitan que su propio panel -el
    // botón "🗑️ Eliminar"- la siga en tiempo real durante el arrastre;
    // si no, el botón queda fijo en la posición inicial de la pelota.
    if (activeObj.team !== 'ball') {
        updateFloatingUI();
    } else if (typeof updatePropFloatingUI === "function") {
        updatePropFloatingUI();
    }
}

// Agrupa los redibujados en el siguiente frame disponible, en vez de uno
// por cada evento de mouse/touch (que puede disparar mucho más seguido
// que la tasa de refresco de la pantalla). Evita el "trabado" al arrastrar
// rápido, sobre todo notorio en algunos navegadores de PC.
let _redibujoPendiente = false;
function solicitarRedibujo() {
    if (_redibujoPendiente) return;
    _redibujoPendiente = true;
    requestAnimationFrame(() => {
        _redibujoPendiente = false;
        draw();
    });
}

function handleEnd() {
    if (!isDragging || !activeObj) { isDragging = false; return; }

    // --- Objeto de utilería: soltar simple, sin pasos ni deshacer ---
    if (esUtileria(activeObj)) {
        isDragging = false;
        playSound('dropJersey');
        draw();
        guardarBorradorSilencioso(); // se soltó un objeto de utilería (fin de arrastre)
        return;
    }

    const path   = activeObj.steps[currentStep];
    const inicio = path[0];
    const fin    = path[path.length - 1];
    const huboMovimiento = Math.hypot(fin.x - inicio.x, fin.y - inicio.y) > 5;

    // Simplificar trazado
    if (path.length > 2) activeObj.steps[currentStep] = simplifyPath(path);

    // Si el jugador que llevaba alguna pelota terminó de moverse →
    // actualizamos el punto de esa(s) pelota(s) (puede haber más de una)
    if (activeObj.team !== 'ball') {
        const playerLast = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];
        balls.forEach(b => {
            if (b.portadorPorPaso[currentStep] === activeObj.id) {
                b.steps[currentStep] = [{
                    x: playerLast.x + (13 * sF), y: playerLast.y - (13 * sF),
                    isScreen: false, angle: 0
                }];
            }
        });
    }

    // Lógica de imán al soltar la pelota activa
    if (activeObj.team === 'ball') {
        playSound('bounceBall');

        const portadorAntes = activeObj.portadorPorPaso[currentStep] ?? null;
        const bLast       = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];
        let minDistance   = 28 * sF;
        let jugadorCercano = null;

        players.forEach(p => {
            const pLast = p.steps[currentStep][p.steps[currentStep].length - 1];
            const dist  = Math.hypot(pLast.x - bLast.x, pLast.y - bLast.y);
            if (dist < minDistance) { minDistance = dist; jugadorCercano = p; }
        });

        // Imán al aro: revisamos el/los aro(s) según el modo de cancha
        const aros = [{ x: canvas.width / 2, y: 42 * sF }];
        if (courtMode === 'full') aros.push({ x: canvas.width / 2, y: canvas.height - 42 * sF });
        const UMBRAL_ARO = 30 * sF;
        let aroCercano = null, distAro = Infinity;
        aros.forEach(a => {
            const d = Math.hypot(a.x - bLast.x, a.y - bLast.y);
            if (d < distAro) { distAro = d; aroCercano = a; }
        });
        const seImantaAlAro = aroCercano && distAro < UMBRAL_ARO && distAro < minDistance;

        if (seImantaAlAro) {
            // Imantamos al aro: la pelota queda apoyada justo en su
            // posición, sin portador (no la lleva ningún jugador).
            activeObj.portadorPorPaso[currentStep] = null;
            const bPath = activeObj.steps[currentStep];
            if (bPath.length > 1) {
                bPath[bPath.length - 1] = { x: aroCercano.x, y: aroCercano.y, isScreen: false, angle: 0 };
            } else {
                activeObj.steps[currentStep] = [{ x: aroCercano.x, y: aroCercano.y, isScreen: false, angle: 0 }];
            }
            activarPulsoIman(activeObj);
        } else if (jugadorCercano && !jugadorCercano.steps[currentStep][jugadorCercano.steps[currentStep].length - 1].isScreen) {
            // Imantamos al jugador nuevo:
            // Conservamos el path recorrido durante el drag y solo ajustamos
            // el último punto para que quede exactamente sobre el jugador.
            activeObj.portadorPorPaso[currentStep] = jugadorCercano.id;
            const pLast  = jugadorCercano.steps[currentStep][jugadorCercano.steps[currentStep].length - 1];
            const snapX  = pLast.x + (13 * sF);
            const snapY  = pLast.y - (13 * sF);
            const bPath  = activeObj.steps[currentStep];
            if (bPath.length > 1) {
                // Hay trayectoria: ajustamos solo el último punto
                bPath[bPath.length - 1] = { x: snapX, y: snapY, isScreen: false, angle: 0 };
            } else {
                // La pelota no se movió (estaba pegada y no hubo drag real):
                // dejamos un punto único sobre el nuevo jugador
                activeObj.steps[currentStep] = [{ x: snapX, y: snapY, isScreen: false, angle: 0 }];
            }
            if (portadorAntes !== jugadorCercano.id) activarPulsoIman(activeObj);
        } else {
            activeObj.portadorPorPaso[currentStep] = null;
            if (portadorAntes !== null) activarPulsoIman(activeObj);
        }

        // Si el portador cambió, propagamos el cambio hacia adelante a
        // los pasos siguientes que lo habían heredado sin tocar (corrige
        // el bug de la pelota que "se olvida" de seguir al nuevo portador).
        var afectadosPropagacion = propagarCambioDePortador(activeObj, currentStep, portadorAntes);
    } else {
        playSound('dropJersey');
    }

    // Guardar en undoStack
    if (huboMovimiento && activeObj._undoSnapshot) {
        undoStack = undoStack.filter(item => !(item.obj === activeObj && item.step === currentStep));
        undoStack.push({
            obj:              activeObj,
            step:             currentStep,
            snapshot:         activeObj._undoSnapshot,
            portadorSnapshot: activeObj._portadorSnapshot,
            propagados:       afectadosPropagacion || []
        });
        // Un movimiento nuevo invalida el historial de "rehacer" pendiente
        redoStack = [];
        updateRedoButton();
    }

    delete activeObj._undoSnapshot;
    delete activeObj._portadorSnapshot;
    isDragging = false;
    draw();
    guardarBorradorSilencioso(); // se soltó una ficha o la pelota (fin de arrastre)
}

canvas.addEventListener('mousedown',  handleStart);
canvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('mousemove',  handleMove);
window.addEventListener('touchmove',  handleMove,  { passive: false });
window.addEventListener('mouseup',    handleEnd);
window.addEventListener('touchend',   handleEnd);

// --------------------------------------------------------
// DIBUJO LIBRE (Modo Pizarra Rápida)
// --------------------------------------------------------
// drawCanvas está superpuesto exactamente a #canvas, así que getPos(e)
// (que usa canvas.getBoundingClientRect()) sirve tal cual para ubicar el
// puntero también sobre el lienzo de dibujo libre.

const RADIO_GOMA = 18; // px lógicos, umbral de "contacto" de la goma (fijo,
                        // no *sF, por la misma razón que el grosor del pincel:
                        // debe sentirse igual en cualquier modo de cancha)

function handleDrawStart(e) {
    if (!modoPizarraRapida) return;
    e.preventDefault();
    const pos = getPos(e);

    if (herramientaActiva === 'goma') {
        borrandoConGoma = true;
        borrarTrazosEnPunto(pos);
        return;
    }

    trazoActual    = { color: colorTrazoActivo, grosor: grosorTrazoActivo, puntos: [pos] };
    dibujandoLibre = true;
    redibujarLienzoLibre();
}

function handleDrawMove(e) {
    if (!modoPizarraRapida) return;
    if (!dibujandoLibre && !borrandoConGoma) return;
    e.preventDefault();
    const pos = getPos(e);

    if (borrandoConGoma) {
        borrarTrazosEnPunto(pos);
        return;
    }

    if (trazoActual) {
        const ultimo = trazoActual.puntos[trazoActual.puntos.length - 1];
        // Evita amontonar puntos redundantes cuando el puntero casi no se
        // movió entre dos eventos (más liviano de dibujar y de guardar).
        if (Math.hypot(pos.x - ultimo.x, pos.y - ultimo.y) > 1.5) {
            trazoActual.puntos.push(pos);
            redibujarLienzoLibre();
        }
    }
}

function handleDrawEnd() {
    if (borrandoConGoma) {
        borrandoConGoma = false;
        guardarBorradorSilencioso(); // fin del gesto de borrado con goma
        return;
    }
    if (!dibujandoLibre) return;
    dibujandoLibre = false;

    if (trazoActual) {
        if (trazoActual.puntos.length > 1) trazoActual.puntos = simplifyPath(trazoActual.puntos);
        const l = lienzoActivo();
        l.trazos.push(trazoActual);
        l.deshechos = []; // un trazo nuevo invalida el "rehacer" pendiente
    }
    trazoActual = null;
    redibujarLienzoLibre();
    actualizarBotonesUndoRedo();
    playSound('dropJersey');
    guardarBorradorSilencioso(); // se terminó de dibujar un trazo libre
}

// Goma "de contacto": tocar/pasar por encima de un trazo lo borra por
// completo (como pasar el trapo sobre una línea del acrílico), en vez de
// borrar píxel por píxel.
function borrarTrazosEnPunto(pos) {
    const l = lienzoActivo();
    const radio = RADIO_GOMA;
    const antes = l.trazos.length;

    l.trazos = l.trazos.filter(t => {
        return !t.puntos.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < radio);
    });

    if (l.trazos.length !== antes) {
        redibujarLienzoLibre();
        actualizarBotonesUndoRedo();
        playSound('dropJersey');
    }
}

drawCanvas.addEventListener('mousedown',  handleDrawStart);
drawCanvas.addEventListener('touchstart', handleDrawStart, { passive: false });
window.addEventListener('mousemove',  handleDrawMove);
window.addEventListener('touchmove',  handleDrawMove,  { passive: false });
window.addEventListener('mouseup',    handleDrawEnd);
window.addEventListener('touchend',   handleDrawEnd);

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
    if (modal) modal.classList.add('abierto');
    if (input) setTimeout(() => { input.focus(); input.select(); }, 50);
}

function cerrarDorsalModal() {
    const modal = document.getElementById('dorsalModal');
    if (modal) modal.classList.remove('abierto');
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
    guardarBorradorSilencioso(); // se editó el dorsal de un jugador

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
    if (modoPizarraRapida) { undoTrazoLibre(); return; }

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
                ballsSnapshot: balls.map(b => ({
                    id:       b.id,
                    data:     JSON.parse(JSON.stringify(b.steps[currentStep])),
                    portador: b.portadorPorPaso[currentStep] ?? null
                }))
            });

            players.forEach(p => p.steps.pop());
            balls.forEach(b => { b.steps.pop(); b.portadorPorPaso.pop(); });
            currentStep--;
            stepCount--;
            renderTimeline();
            updateStepUI();
            draw();
            updateRedoButton();
            guardarBorradorSilencioso(); // deshacer borró el paso completo
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
        portadorSnapshot: snapshotPortadores()
    });

    lastAction.obj.steps[lastAction.step] = JSON.parse(JSON.stringify(lastAction.snapshot));

    // Restaurar estado del imán (de TODAS las pelotas)
    if (lastAction.portadorSnapshot) {
        restaurarPortadores(lastAction.portadorSnapshot);
        // Re-pegar cada pelota si en el snapshot algún jugador la tenía
        balls.forEach(b => {
            const portadorId = b.portadorPorPaso[lastAction.step];
            if (portadorId) {
                const portador = players.find(p => p.id === portadorId);
                if (portador) {
                    const pLast = portador.steps[lastAction.step][portador.steps[lastAction.step].length - 1];
                    b.steps[lastAction.step] = [{
                        x: pLast.x + (13 * sF), y: pLast.y - (13 * sF),
                        isScreen: false, angle: 0
                    }];
                }
            }
        });
    }

    // Revertir la propagación hacia adelante: si el movimiento deshecho
    // había cambiado el portador y arrastrado consigo pasos posteriores
    // que lo heredaban, esos pasos vuelven a su estado previo también.
    if (lastAction.propagados && lastAction.propagados.length > 0) {
        lastAction.propagados.forEach(pr => {
            lastAction.obj.portadorPorPaso[pr.step] = pr.portador;
            lastAction.obj.steps[pr.step]           = JSON.parse(JSON.stringify(pr.steps));
        });
    }

    activeObj  = null;
    isDragging = false;
    draw();
    updateFloatingUI();
    updateUndoButton();
    updateRedoButton();
    guardarBorradorSilencioso(); // deshacer un movimiento puntual
}

function redoLastMove() {
    if (modoPizarraRapida) { redoTrazoLibre(); return; }

    if (redoStack.length === 0) return;
    const accion = redoStack.pop();

    if (accion.type === 'move') {
        // Guardamos el estado actual para poder volver a deshacer este redo
        undoStack = undoStack.filter(item => !(item.obj === accion.obj && item.step === accion.step));
        undoStack.push({
            obj:              accion.obj,
            step:             accion.step,
            snapshot:         JSON.parse(JSON.stringify(accion.obj.steps[accion.step])),
            portadorSnapshot: snapshotPortadores()
        });

        accion.obj.steps[accion.step] = JSON.parse(JSON.stringify(accion.snapshot));
        // portadorSnapshot es una foto COMPLETA (todos los pasos) tomada
        // en el momento posterior a la edición original -incluida la
        // propagación hacia adelante-, así que restaura correctamente el
        // portador tanto del paso editado como de los pasos propagados,
        // sin necesidad de volver a correr propagarCambioDePortador acá.
        if (accion.portadorSnapshot) {
            restaurarPortadores(accion.portadorSnapshot);
        }
    } else if (accion.type === 'deleteStep') {
        // Reconstruimos el paso que se había quitado con "deshacer"
        players.forEach(p => {
            const snap = accion.playersSnapshot.find(s => s.id === p.id);
            const last = p.steps[p.steps.length - 1];
            p.steps.push(snap ? JSON.parse(JSON.stringify(snap.data)) : JSON.parse(JSON.stringify(last)));
        });
        balls.forEach(b => {
            // accion.ballsSnapshot puede no existir en un redoStack muy
            // viejo (no debería pasar en la práctica, pero por las dudas
            // degradamos con gracia en vez de romper la ejecución)
            const snap = accion.ballsSnapshot ? accion.ballsSnapshot.find(s => s.id === b.id) : null;
            const last = b.steps[b.steps.length - 1];
            b.steps.push(snap ? JSON.parse(JSON.stringify(snap.data)) : JSON.parse(JSON.stringify(last)));
            b.portadorPorPaso.push(snap ? (snap.portador ?? null) : null);
        });
        currentStep = accion.step;
        stepCount++;
        renderTimeline();
        updateStepUI();
    }

    activeObj  = null;
    isDragging = false;
    draw();
    updateFloatingUI();
    updateUndoButton();
    updateRedoButton();
    guardarBorradorSilencioso(); // rehacer un movimiento o un paso
}

let _undoBtnCache = null, _redoBtnCache = null;
let _undoEnabledPrev = null, _redoEnabledPrev = null;

// Aplica el estado visual (habilitado/deshabilitado) a un botón de
// deshacer/rehacer. Compartido entre el circuito táctico y el de dibujo
// libre, que solo difieren en CÓMO deciden si `enabled` es true o false.
function _setUndoRedoBtnState(btn, enabled, prevCacheKey) {
    if (!btn) return enabled;
    if (enabled === prevCacheKey) return enabled; // nada cambió, no tocamos el estilo
    btn.style.opacity       = enabled ? "1"       : "0.3";
    btn.style.pointerEvents = enabled ? "auto"    : "none";
    btn.style.cursor        = enabled ? "pointer" : "default";
    return enabled;
}

function updateUndoButton() {
    if (!_undoBtnCache) _undoBtnCache = document.getElementById('undoBtn');
    const enabled = undoStack.some(item => item.step === currentStep) || currentStep > 0;
    _undoEnabledPrev = _setUndoRedoBtnState(_undoBtnCache, enabled, _undoEnabledPrev);
}

function updateRedoButton() {
    if (!_redoBtnCache) _redoBtnCache = document.getElementById('redoBtn');
    const enabled = redoStack.length > 0;
    _redoEnabledPrev = _setUndoRedoBtnState(_redoBtnCache, enabled, _redoEnabledPrev);
}

// --------------------------------------------------------
// DESHACER / REHACER DE TRAZOS (Modo Pizarra Rápida)
// --------------------------------------------------------
// Reutiliza los mismos botones #undoBtn/#redoBtn de la barra izquierda,
// pero operando sobre los trazos del lienzo activo en vez de sobre los
// movimientos de fichas. El borrado con la goma NO pasa por acá (queda
// fuera del historial), igual que en un acrílico físico.

function undoTrazoLibre() {
    const l = lienzoActivo();
    if (l.trazos.length === 0) return;
    l.deshechos.push(l.trazos.pop());
    redibujarLienzoLibre();
    actualizarBotonesUndoRedo();
    guardarBorradorSilencioso(); // deshacer un trazo libre
}

function redoTrazoLibre() {
    const l = lienzoActivo();
    if (l.deshechos.length === 0) return;
    l.trazos.push(l.deshechos.pop());
    redibujarLienzoLibre();
    actualizarBotonesUndoRedo();
    guardarBorradorSilencioso(); // rehacer un trazo libre
}

// Único punto de entrada para refrescar el estado visual de Deshacer/
// Rehacer: decide solo, según el modo activo, si esos botones reflejan
// el historial táctico o el de trazos del lienzo libre.
function actualizarBotonesUndoRedo() {
    if (modoPizarraRapida) {
        if (!_undoBtnCache) _undoBtnCache = document.getElementById('undoBtn');
        if (!_redoBtnCache) _redoBtnCache = document.getElementById('redoBtn');
        const l = lienzoActivo();
        _undoEnabledPrev = _setUndoRedoBtnState(_undoBtnCache, l.trazos.length > 0,    _undoEnabledPrev);
        _redoEnabledPrev = _setUndoRedoBtnState(_redoBtnCache, l.deshechos.length > 0, _redoEnabledPrev);
    } else {
        updateUndoButton();
        updateRedoButton();
    }
}

// --------------------------------------------------------
// MENÚ FLOTANTE SOBRE JUGADOR ACTIVO
// --------------------------------------------------------

function updateFloatingUI() {
    // Mantiene sincronizada la UI flotante de utilería/pelotas sin
    // importar por cuál de las dos rutas (jugador o no) termine esta
    // función: se llama primero, siempre.
    updatePropFloatingUI();

    if (modoPizarraRapida || !esJugador(activeObj) || isEditionFinished) {
        mostrarConFade(floatingUI, false, 'flex');
        return;
    }

    const last = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];

    floatingUI.style.flexDirection = "row";
    floatingUI.style.gap           = "6px";
    floatingUI.style.position      = "absolute";
    floatingUI.style.left          = last.x + "px";
    floatingUI.style.top           = (last.y - 56) + "px";
    floatingUI.style.transform     = "translateX(-50%)";
    mostrarConFade(floatingUI, true, 'flex');

    Array.from(floatingUI.children).forEach(hijo => {
        if (hijo !== rotBtn && hijo.id !== 'spin-btn') {
            hijo.style.display = "none";
        }
    });

    // Este jugador es "portador" si CUALQUIERA de las pelotas está imantada a él
    const esteEsPortador = balls.some(b => b.portadorPorPaso[currentStep] === activeObj.id);

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
        rotBtn.textContent         = last.isScreen ? "🏃" : "🧱";
        rotBtn.title                = last.isScreen ? "Quitar Cortina" : "Poner Cortina";
        rotBtn.onclick = () => {
            last.isScreen = !last.isScreen;
            if (!last.isScreen) last.angle = 0;
            draw();
            updateFloatingUI();
            guardarBorradorSilencioso(); // se puso/quitó una cortina
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
        spinBtn.textContent   = "🗘";
        spinBtn.title         = "Rotar Cortina";
        spinBtn.onclick = () => { last.angle = (last.angle + 45) % 360; draw(); guardarBorradorSilencioso(); };
        mostrarConFade(spinBtn, true, 'block');
    } else {
        // Ocultamos al instante (no con fundido): si no, al pasar de un
        // jugador con cortina a uno sin cortina se ve este botón "de más"
        // por un momento antes de desvanecerse.
        spinBtn.classList.remove('oculto-fade');
        spinBtn.style.display = 'none';
    }
}

// --------------------------------------------------------
// CONTROLES FLOTANTES DE UTILERÍA Y PELOTAS (v142)
// --------------------------------------------------------
// Análogo a updateFloatingUI() (jugadores) pero para objetos de
// utilería (color/tamaño/rotar/eliminar) y para pelotas (solo eliminar).
// Igual que la utilería, solo disponible en el Paso Inicial: eliminar
// una pelota en un paso intermedio dejaría sus arreglos steps[]/
// portadorPorPaso[] desincronizados del resto de la jugada.

// Solo 2 colores (antes 4): con menos botones el panel entra cómodo en
// una sola fila incluso en celular, y de paso evitamos el rojo/azul que
// ya identifican a los equipos en cancha (podría confundirse con eso).
const PALETA_UTILERIA = [
    { nombre: 'Naranja',  hex: '#ff7a00' },
    { nombre: 'Amarillo', hex: '#ffc107' }
];
const TAMANOS_ESCALERA = ['chica', 'mediana', 'grande'];

function crearBotonPropFlotante(icono, titulo, onClick) {
    const btn = document.createElement('button');
    btn.className   = 'f-btn snd-btn';
    btn.textContent = icono;
    btn.title       = titulo;
    btn.onclick     = onClick;
    return btn;
}

function eliminarPropActivo() {
    if (!esUtileria(activeObj)) return;
    const idx = props.indexOf(activeObj);
    if (idx !== -1) props.splice(idx, 1);
    activeObj  = null;
    isDragging = false;
    updateFloatingUI();
    draw();
    guardarBorradorSilencioso(); // se eliminó un objeto de utilería
}

function eliminarBallActivo() {
    if (!activeObj || activeObj.team !== 'ball' || currentStep !== 0) return;
    const idx = balls.indexOf(activeObj);
    if (idx !== -1) balls.splice(idx, 1); // no rompe el render/arrastre de las demás
    activeObj  = null;
    isDragging = false;
    updateFloatingUI();
    draw();
    guardarBorradorSilencioso(); // se eliminó una pelota
}

function ciclarTamanoProp() {
    if (!activeObj || activeObj.type !== 'escalera') return;
    const idx = TAMANOS_ESCALERA.indexOf(activeObj.size);
    activeObj.size = TAMANOS_ESCALERA[(idx + 1) % TAMANOS_ESCALERA.length];
    draw();
    updatePropFloatingUI();
    guardarBorradorSilencioso(); // cambió el tamaño de una escalera
}

function agregarBotonesColorProp(cont) {
    PALETA_UTILERIA.forEach(c => {
        const b = crearBotonPropFlotante('', c.nombre, () => {
            activeObj.color = c.hex;
            draw();
            updatePropFloatingUI();
            guardarBorradorSilencioso(); // cambió el color de un objeto de utilería
        });
        b.style.background = c.hex;
        if (activeObj.color === c.hex) {
            b.style.boxShadow = '0 0 0 3px #fff, 0 0 10px rgba(0,0,0,0.8)';
        }
        cont.appendChild(b);
    });
}

function updatePropFloatingUI() {
    const cont = document.getElementById('prop-floating-ui');
    if (!cont) return;

    const esProp = esUtileria(activeObj);
    const esBola = !!activeObj && activeObj.team === 'ball';

    // Tanto los objetos de utilería como las pelotas solo se pueden
    // agregar/mover/eliminar en el Paso Inicial: si el usuario ya avanzó
    // a otro paso, este panel de controles no debe mostrarse.
    const debeOcultarse = modoPizarraRapida || isEditionFinished || !activeObj ||
        currentStep !== 0 || (!esProp && !esBola);

    if (debeOcultarse) {
        mostrarConFade(cont, false, 'flex');
        return;
    }

    const x = esProp ? activeObj.x : activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1].x;
    const y = esProp ? activeObj.y : activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1].y;

    // Separación entre el panel y el objeto: para utilería usamos su
    // tamaño real (una escalera grande necesita más despegue que un
    // cono, si no el panel termina tapándola y provocando toques
    // accidentales); para la pelota un valor fijo alcanza de sobra.
    const separacion = esProp && typeof medioTamanoProp === "function"
        ? medioTamanoProp(activeObj) + 38
        : 56;

    let topPos = y - separacion;
    // Si el objeto está cerca del borde superior y el panel no entra
    // arriba, lo mostramos abajo en su lugar (mejor que cortarlo).
    if (topPos < 4) {
        const abajo = esProp && typeof medioTamanoProp === "function"
            ? medioTamanoProp(activeObj) + 18
            : 20;
        topPos = y + abajo;
    }

    // Clamp horizontal aproximado: que el panel no quede cortado contra
    // los bordes del canvas en pantallas angostas (celular).
    let leftPos = x;
    if (canvas) {
        const mitadPanel = 95; // ancho aproximado máximo del panel / 2
        leftPos = Math.max(mitadPanel, Math.min(canvas.width - mitadPanel, x));
    }

    cont.style.position  = "absolute";
    cont.style.left      = leftPos + "px";
    cont.style.top       = topPos + "px";
    cont.style.transform = "translateX(-50%)";
    mostrarConFade(cont, true, 'flex');

    cont.innerHTML = '';

    if (esBola) {
        cont.appendChild(crearBotonPropFlotante('🗑️', 'Eliminar pelota', eliminarBallActivo));
        return;
    }

    if (activeObj.type === 'cono' || activeObj.type === 'obstaculo') {
        agregarBotonesColorProp(cont);
    }
    if (activeObj.type === 'escalera') {
        cont.appendChild(crearBotonPropFlotante('📐', 'Tamaño: ' + activeObj.size, ciclarTamanoProp));
    }
    if (activeObj.type === 'escalera' || activeObj.type === 'valla' || activeObj.type === 'obstaculo') {
        cont.appendChild(crearBotonPropFlotante('🔄', 'Girar 45°', () => {
            activeObj.angle = ((activeObj.angle || 0) + 45) % 360;
            draw();
            guardarBorradorSilencioso(); // se rotó un objeto de utilería
        }));
    }
    cont.appendChild(crearBotonPropFlotante('🗑️', 'Eliminar', eliminarPropActivo));
}
