// ========================================================
// PIZARRA OESTE - ui.js
// Interfaz gráfica: selección de modo de cancha, control de
// orientación, timeline, pasos, solapas, pantalla de carga,
// reproducción, import/export JSON y video.
// Depende de: estado.js, cancha.js, jugadores.js, interaccion.js, audio.js
// ========================================================

// Jugada leída de un archivo que quedó esperando a que termine un cambio
// de modo de cancha (cuando el archivo fue guardado en el otro modo).
let pendingImport = null;

// --------------------------------------------------------
// MODAL DE CONFIRMACIÓN GENÉRICO (mismo cartel para Nueva Jugada,
// Cambiar Modo, y cualquier otra confirmación que haga falta)
// --------------------------------------------------------

let confirmModalCallback = null;

function abrirConfirmModal(titulo, texto, textoBoton, callback) {
    const modal = document.getElementById('confirmModal');
    const t     = document.getElementById('confirmTitle');
    const d     = document.getElementById('confirmText');
    const b     = document.getElementById('confirmAcceptBtn');
    if (t) t.innerText = titulo;
    if (d) d.innerText = texto;
    if (b) b.innerText = textoBoton;
    confirmModalCallback = callback;
    if (modal) modal.style.display = "flex";
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = "none";
    confirmModalCallback = null;
}

function confirmModalAccept() {
    const cb = confirmModalCallback;
    closeConfirmModal();
    if (cb) cb();
}

// --------------------------------------------------------
// MENÚ DESPLEGABLE "ARCHIVO" (Nueva / Guardar / Cargar)
// --------------------------------------------------------

function toggleMenuArchivo(e) {
    if (e) e.stopPropagation();
    const dd  = document.getElementById('menuArchivoDropdown');
    const btn = document.getElementById('menuArchivoBtn');
    if (!dd || !btn) return;

    if (dd.classList.contains('abierto')) {
        dd.classList.remove('abierto');
        return;
    }

    const rect  = btn.getBoundingClientRect();
    const ancho = Math.max(rect.width, 160);
    let left    = rect.left;
    if (left + ancho > window.innerWidth - 8)  left = window.innerWidth - ancho - 8;
    if (left < 8) left = 8;

    dd.style.left  = left + 'px';
    dd.style.top   = (rect.bottom + 4) + 'px';
    dd.style.width = ancho + 'px';
    dd.classList.add('abierto');
}

function cerrarMenuArchivo() {
    const dd = document.getElementById('menuArchivoDropdown');
    if (dd) dd.classList.remove('abierto');
}

document.addEventListener('click', (e) => {
    const dd = document.getElementById('menuArchivoDropdown');
    if (!dd || !dd.classList.contains('abierto')) return;
    const wrap = document.querySelector('.menu-archivo-wrap');
    if (wrap && wrap.contains(e.target)) return;
    if (dd.contains(e.target)) return;
    dd.classList.remove('abierto');
});

// --------------------------------------------------------
// MODAL "ACERCA DE..."
// --------------------------------------------------------

function abrirAcercaDe() {
    const modal = document.getElementById('acercaDeModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarAcercaDe() {
    const modal = document.getElementById('acercaDeModal');
    if (modal) modal.style.display = 'none';
}

// --------------------------------------------------------
// PANTALLA DE CARGA
// --------------------------------------------------------

function startLoadingSequence() {
    const bar        = document.getElementById('loading-bar');
    const container  = document.getElementById('logo-container');
    const screen     = document.getElementById('loading-screen');
    const percentTxt = document.getElementById('loading-percentage');

    setTimeout(() => {
        if (bar)       bar.style.width = "100%";
        if (container) container.classList.add('loaded');
    }, 100);

    let currentPercent = 0;
    const interval = setInterval(() => {
        currentPercent += 2;
        if (currentPercent <= 100) {
            if (percentTxt) percentTxt.innerText = currentPercent + "%";
        } else {
            clearInterval(interval);
        }
    }, 35);

    setTimeout(() => {
        if (screen) {
            screen.style.opacity   = "0";
            screen.style.transform = "scale(1.03)";
            setTimeout(() => {
                screen.style.display = "none";
                cargaCompleta = true;
                // Habilita sonido en los botones de la pantalla de selección de modo
                if (typeof attachButtonSounds === "function") attachButtonSounds();
                checkOrientationForMode();
            }, 500);
        }
    }, 2400);
}

// --------------------------------------------------------
// SELECCIÓN DE MODO DE CANCHA Y CONTROL DE ORIENTACIÓN
// --------------------------------------------------------

// Decide qué pantalla de bloqueo debe mostrarse en este momento
// (o null si no hay que bloquear nada y se puede mostrar la app).
function getOrientationBlockedScreenId() {
    if (!courtMode) return 'mode-select-screen';

    // El bloqueo de orientación es una ayuda pensada para celulares/tablets
    // (pantallas táctiles). En PC/notebook (sin touch) nunca se fuerza nada,
    // así se puede usar y probar cualquiera de los dos modos sin tener que
    // "rotar" el monitor (muchas PC tienen menos de 1023px de alto en la
    // ventana aunque el ancho sea grande, y eso no significa que sea un celu).
    const esTactil = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
    if (!esTactil) return null;

    // Además, solo aplica en pantallas chicas (tablets/celus), no en
    // monitores táctiles grandes.
    const smallDevice = Math.min(window.innerWidth, window.innerHeight) <= 1023;
    if (!smallDevice) return null;

    const esVertical = window.innerHeight > window.innerWidth;
    if (courtMode === 'half' && esVertical)  return 'landscape-forcer';
    if (courtMode === 'full' && !esVertical) return 'portrait-forcer';
    return null;
}

function checkOrientationForMode() {
    if (!cargaCompleta) return;

    const appWrapper      = document.getElementById('app-wrapper');
    const modeScreen      = document.getElementById('mode-select-screen');
    const landscapeForcer = document.getElementById('landscape-forcer');
    const portraitForcer  = document.getElementById('portrait-forcer');

    const bloqueo = getOrientationBlockedScreenId();

    if (modeScreen)      modeScreen.style.display      = (bloqueo === 'mode-select-screen') ? 'flex' : 'none';
    if (landscapeForcer) landscapeForcer.style.display = (bloqueo === 'landscape-forcer')    ? 'flex' : 'none';
    if (portraitForcer)  portraitForcer.style.display  = (bloqueo === 'portrait-forcer')     ? 'flex' : 'none';

    if (!bloqueo && courtMode) {
        if (appWrapper) appWrapper.style.display = 'flex';
        activarInterfaz();
        if (typeof init === 'function') init();
        ajustarAlturaBarras();

        if (pendingImport) {
            const datos = pendingImport;
            pendingImport = null;
            aplicarJugadaImportada(datos);
        }

        mostrarTipDorsal();
    } else if (appWrapper) {
        appWrapper.style.display = 'none';
    }
}

// Mide el alto real del contenido de una barra (sin la limitación de alto
// fijo) y lo aplica como alto explícito del contenedor, para que la barra
// nunca quede más alta de lo que su contenido necesita (ni le falte
// espacio). Funciona aunque la barra esté colapsada en este momento.
function medirYFijarAltura(container, inner) {
    if (!container || !inner) return;
    const eraColapsado = container.classList.contains('colapsado');
    container.classList.remove('colapsado');
    container.style.height    = 'auto';
    container.style.maxHeight = 'none';

    const maxPermitido = Math.round(window.innerHeight * 0.42);
    const necesaria     = Math.min(inner.scrollHeight + 6, maxPermitido);

    container.style.height    = necesaria + 'px';
    container.style.maxHeight = necesaria + 'px';

    if (eraColapsado) container.classList.add('colapsado');
}

function ajustarAlturaBarras() {
    if (courtMode !== 'full') return;
    medirYFijarAltura(document.getElementById('col-izquierda-container'),    document.getElementById('col-izquierda'));
    medirYFijarAltura(document.getElementById('col-linea-tiempo-container'), document.getElementById('col-linea-tiempo'));
}

// Se ejecuta una única vez, la primera vez que la app queda visible:
// despierta las solapas y, en Cancha Completa, activa el layout de barras
// horizontales (arriba/abajo) en vez de verticales (izq/der).
function activarInterfaz() {
    if (solapasActivadas) return;
    solapasActivadas = true;

    const appWrapper = document.getElementById('app-wrapper');
    const sIzq = document.getElementById('solapa-izq');
    const sDer = document.getElementById('solapa-der');
    if (sIzq) sIzq.classList.add('solapa-activa');
    if (sDer) sDer.classList.add('solapa-activa');

    if (courtMode === 'full') {
        if (appWrapper) appWrapper.classList.add('modo-full');
        // Íconos iniciales para el layout arriba/abajo (barras expandidas)
        if (sIzq) sIzq.innerText = '▲';
        if (sDer) sDer.innerText = '▼';
    }

    if (typeof actualizarIconoCambiarModo === 'function') actualizarIconoCambiarModo();
}

// Aviso de uso único (guardado en el dispositivo, no vuelve a aparecer):
// una flecha que apunta a un jugador real en la cancha, explicando el
// doble clic/toque para el dorsal. Se llama después de init(), una vez
// que ya existen jugadores para poder señalar a uno.
function mostrarTipDorsal() {
    if (localStorage.getItem('pizarraDorsalTipVisto') === 'true') return;
    if (!players || players.length === 0 || !canvas) return;
    localStorage.setItem('pizarraDorsalTipVisto', 'true');

    setTimeout(() => {
        const jugador = players[0];
        const p = jugador.steps[0][0];
        const rect = canvas.getBoundingClientRect();
        const x = rect.left + p.x;
        const y = rect.top + p.y;

        const tip = document.createElement('div');
        tip.id = 'dorsal-tip';
        tip.innerHTML =
            '<div class="dorsal-tip-globo">Doble clic (o doble toque) acá<br>para ponerle el dorsal</div>' +
            '<div class="dorsal-tip-flecha">👇</div>';
        tip.style.left = x + 'px';
        tip.style.top  = y + 'px';
        document.body.appendChild(tip);

        requestAnimationFrame(() => tip.classList.add('visible'));
        setTimeout(() => {
            tip.classList.remove('visible');
            setTimeout(() => tip.remove(), 500);
        }, 5500);
    }, 500);
}

function selectCourtMode(modo) {
    courtMode = modo; // 'full' | 'half'
    checkOrientationForMode();
}

// Deja la app en blanco (sin jugada, sin barras colapsadas, con las
// solapas por reactivar) para poder mostrar el selector de modo de nuevo
// o cambiar directamente a otro modo, sin recargar la página.
function resetAEstadoVacio() {
    shouldStopLoop    = true;
    isLooping         = false;
    isPlaying         = false;
    isExporting       = false;
    isEditionFinished = false;
    activeObj         = null;
    isDragging         = false;
    undoStack         = [];
    redoStack         = [];
    currentStep       = 0;
    players           = [];
    ball = {
        active: true,
        team: 'ball',
        steps: [[{ x: 0, y: 0, isScreen: false, angle: 0 }]],
        portadorPorPaso: [null]
    };

    setPlayButtonsState(false);
    setLoopButtonsColor(false);
    factorVelocidad = 1;
    const spdSel = document.getElementById('speedSelect');
    if (spdSel) spdSel.value = "1";

    const pc = document.getElementById('playback-controls');
    const ec = document.getElementById('edit-controls');
    if (pc) pc.style.display = "none";
    if (ec) ec.style.display = "flex";
    if (addStepBtn) addStepBtn.style.display = "block";

    const appWrapper = document.getElementById('app-wrapper');
    const colIzqCont = document.getElementById('col-izquierda-container');
    const colDerCont = document.getElementById('col-linea-tiempo-container');

    // Apagamos momentáneamente las transiciones de las barras: si no,
    // el cambio de ancho/alto queda animándose durante 0.35s y el
    // siguiente init() puede medir el canvas a mitad de esa animación,
    // resultando en una cancha diminuta.
    [colIzqCont, colDerCont].forEach(c => { if (c) c.classList.add('sin-transicion'); });

    if (appWrapper) {
        appWrapper.classList.remove('modo-full');
        appWrapper.style.display = 'none';
    }
    [colIzqCont, colDerCont].forEach(cont => {
        if (cont) {
            cont.classList.remove('colapsado');
            cont.style.height    = '';
            cont.style.maxHeight = '';
        }
    });
    const sIzq = document.getElementById('solapa-izq');
    const sDer = document.getElementById('solapa-der');
    if (sIzq) sIzq.innerText = '◀';
    if (sDer) sDer.innerText = '▶';

    solapasActivadas = false;

    requestAnimationFrame(() => {
        [colIzqCont, colDerCont].forEach(c => { if (c) c.classList.remove('sin-transicion'); });
    });
}

// Cambio de modo manual (botón 🔁): pide confirmación con el mismo cartel
// que "Nueva Jugada" y vuelve al selector, sin recargar la página.
function changeCourtMode() {
    const otroModo = (courtMode === 'full') ? 'half' : 'full';
    abrirConfirmModal("¿CAMBIAR MODO?", "Se perderá la jugada actual.", "CAMBIAR", () => {
        cambiarModoSilencioso(otroModo);
    });
}

// Cambio de modo automático (al cargar una jugada de otro modo): no pide
// confirmación de nuevo, porque elegir el archivo ya fue la confirmación.
function cambiarModoSilencioso(modo) {
    resetAEstadoVacio();
    courtMode = modo;
    checkOrientationForMode();
}

window.addEventListener('resize', checkOrientationForMode);
window.addEventListener('orientationchange', () => setTimeout(checkOrientationForMode, 60));

// --------------------------------------------------------
// ESTADO DEL PASO ACTIVO (status bar + bloqueos)
// --------------------------------------------------------

function updateStepUI() {
    const delBtn = document.getElementById('delStepBtn');
    if (delBtn) delBtn.style.display = (currentStep > 0 && !isEditionFinished) ? "" : "none";

    const esPasoInicial       = (currentStep === 0 && !isEditionFinished);
    const controlesOcultables = [rs, bs, fs, document.getElementById('ballBtn')];
    controlesOcultables.forEach(ctrl => {
        if (!ctrl) return;
        ctrl.style.display = esPasoInicial ? "" : "none";
    });

    // Deshacer/Rehacer/Historial no tienen ningún uso en el paso 0
    const mostrarHistorial = currentStep > 0;
    const undoRow = document.getElementById('undoBtn')?.closest('.icon-row');
    if (undoRow) undoRow.style.display = mostrarHistorial ? "" : "none";
    const histToggle = document.getElementById('historialToggle');
    if (histToggle) histToggle.style.display = mostrarHistorial ? "" : "none";

    ajustarAlturaBarras();
}

// --------------------------------------------------------
// TIMELINE DE PASOS
// --------------------------------------------------------

function renderTimeline() {
    if (!timelineList) return;
    timelineList.innerHTML = '';

    function hexARgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    ball.steps.forEach((_, i) => {
        const btn = document.createElement('button');
        const color = stepColors[i % stepColors.length];
        btn.className  = `step-btn snd-btn ${i === currentStep ? 'active' : ''}`;
        btn.innerText  = (courtMode === 'full')
            ? (i === 0 ? "INI" : `P${i}`)
            : (i === 0 ? "INICIO" : `PASO ${i}`);
        btn.style.borderLeft = `4px solid ${color}`;
        if (i === currentStep) {
            btn.style.boxShadow = `0 0 0 2px ${color}, 0 0 8px 1px ${hexARgba(color, 0.65)}`;
        }
        btn.onclick = () => {
            currentStep = i;
            updateStepUI();
            draw();
            renderTimeline();
            attachButtonSounds();
        };
        timelineList.appendChild(btn);
    });

    if (addStepBtn) {
        addStepBtn.style.display = isEditionFinished ? "none" : "";
        if (!isEditionFinished) timelineList.appendChild(addStepBtn);
    }

    // Auto-scroll para que +PASO (al final de la lista) quede siempre
    // visible, sin que haga falta scrollear manualmente para alcanzarlo.
    if (courtMode === 'full') {
        timelineList.scrollLeft = timelineList.scrollWidth;
    } else {
        timelineList.scrollTop = timelineList.scrollHeight;
    }
}

function addNewStep() {
    redoStack = [];
    players.forEach(p => {
        const last = p.steps[currentStep][p.steps[currentStep].length - 1];
        p.steps.push([{ x: last.x, y: last.y, isScreen: last.isScreen, angle: last.angle }]);
    });

    // La pelota hereda el punto final de su portador (o su propia posición si está suelta)
    const portadorActual = ball.portadorPorPaso[currentStep] ?? null;
    if (portadorActual) {
        const portador     = players.find(p => p.id === portadorActual);
        const portadorLast = portador
            ? portador.steps[currentStep][portador.steps[currentStep].length - 1]
            : ball.steps[currentStep][ball.steps[currentStep].length - 1];
        ball.steps.push([{ x: portadorLast.x + 13*sF, y: portadorLast.y - 13*sF, isScreen: false, angle: 0 }]);
    } else {
        const last = ball.steps[currentStep][ball.steps[currentStep].length - 1];
        ball.steps.push([{ x: last.x, y: last.y, isScreen: false, angle: 0 }]);
    }
    // Propagamos el portador al nuevo paso (el jugador sigue teniendo la pelota)
    ball.portadorPorPaso.push(portadorActual);

    currentStep++;
    updateStepUI();
    renderTimeline();
    draw();
    attachButtonSounds();
}

function deleteLastStep() {
    if (currentStep === 0) return;
    redoStack = [];
    players.forEach(p => p.steps.pop());
    ball.steps.pop();
    ball.portadorPorPaso.pop();
    currentStep--;
    updateStepUI();
    renderTimeline();
    draw();
    attachButtonSounds();
}

// --------------------------------------------------------
// FINALIZAR / VOLVER A EDICIÓN
// --------------------------------------------------------

function finishEdition() {
    isEditionFinished = true;
    activeObj         = null;
    updateFloatingUI();

    document.getElementById('playback-controls').style.display = "flex";
    document.getElementById('edit-controls').style.display     = "none";
    if (addStepBtn) addStepBtn.style.display = "none";

    const spdSel = document.getElementById('speedSelect');
    if (spdSel) { spdSel.disabled = false; spdSel.style.opacity = "1"; spdSel.style.pointerEvents = "auto"; }

    verificarMenuFlotante();
    attachButtonSounds();
    ajustarAlturaBarras();
}

function backToEdit() {
    shouldStopLoop    = true;
    isLooping         = false;
    isPlaying         = false;
    isEditionFinished = false;

    setPlayButtonsState(false);
    setLoopButtonsColor(false);

    document.getElementById('playback-controls').style.display = "none";
    document.getElementById('edit-controls').style.display     = "flex";
    if (addStepBtn) addStepBtn.style.display = "block";

    factorVelocidad = 1;
    const spdSel = document.getElementById('speedSelect');
    if (spdSel) spdSel.value = "1";

    verificarMenuFlotante();
    updateStepUI();
    draw();
    renderTimeline();
    attachButtonSounds();
    ajustarAlturaBarras();
}

// --------------------------------------------------------
// SOLAPAS LATERALES
// --------------------------------------------------------

function verificarMenuFlotante() {
    const derEscondido = document.getElementById('col-linea-tiempo-container')
        .classList.contains('colapsado');
    const menuFlotante = document.getElementById('fullscreen-floating-menu');
    if (menuFlotante) {
        menuFlotante.style.display = (isEditionFinished && derEscondido) ? "flex" : "none";
    }
}

function toggleSidebar(lado) {
    const contenedor = document.getElementById(
        lado === 'izq' ? 'col-izquierda-container' : 'col-linea-tiempo-container'
    );
    const boton = document.getElementById(lado === 'izq' ? 'solapa-izq' : 'solapa-der');
    if (!contenedor || !boton) return;

    contenedor.classList.toggle('colapsado');
    const colapsado = contenedor.classList.contains('colapsado');

    if (courtMode === 'full') {
        if (lado === 'izq') boton.innerText = colapsado ? "▼" : "▲";
        else                boton.innerText = colapsado ? "▲" : "▼";
    } else {
        if (lado === 'izq') boton.innerText = colapsado ? "▶" : "◀";
        else                boton.innerText = colapsado ? "◀" : "▶";
    }

    verificarMenuFlotante();

    // Esperamos a que termine la transición CSS para recalcular el canvas
    contenedor.addEventListener('transitionend', function onEnd() {
        contenedor.removeEventListener('transitionend', onEnd);
        init();
        ajustarAlturaBarras();
        if (typeof updateFloatingUI === "function") updateFloatingUI();
    });
}

// --------------------------------------------------------
// REPRODUCCIÓN Y ANIMACIÓN
// --------------------------------------------------------

// El botón de Play existe dos veces (barra normal + menú flotante que
// aparece cuando ambas barras están colapsadas): los mantenemos sincronizados.
// Actualiza ícono y texto por separado para poder ocultar el texto en
// Cancha Completa sin perder el cambio play/stop.
function setPlayButtonsState(reproduciendo) {
    document.querySelectorAll('#mainPlayBtn .play-icon, #floatPlayBtn .play-icon')
        .forEach(el => { el.textContent = reproduciendo ? "⏹" : "▶"; });
    document.querySelectorAll('#mainPlayBtn .play-text, #floatPlayBtn .play-text')
        .forEach(el => { el.textContent = reproduciendo ? " STOP" : " PLAY"; });
}

function setLoopButtonsColor(activo) {
    const color = activo ? "#c01c33" : "#333";
    const b1 = document.getElementById('mainLoopBtn');
    const b2 = document.getElementById('floatLoopBtn');
    if (b1) b1.style.background = color;
    if (b2) b2.style.background = color;
}

function togglePlay() {
    if (isPlaying) {
        shouldStopLoop = true;
        isLooping      = false;
        isPlaying      = false;
        setPlayButtonsState(false);
        setLoopButtonsColor(false);
        draw();
        return;
    }
    isPlaying = true;
    setPlayButtonsState(true);
    playFullPlay(false);
}

async function playFullPlay(loopMode) {
    shouldStopLoop = false;

    do {
        for (let i = 0; i < ball.steps.length; i++) {
            if (shouldStopLoop) break;
            currentStep = i;
            renderTimeline();

            if (i === 0) { draw(); await new Promise(r => setTimeout(r, 600)); continue; }

            await new Promise(res => {
                let totalFrames = Math.round(170 / factorVelocidad), f = 0;
                function frame() {
                    if (shouldStopLoop) return res();
                    const t    = f / totalFrames;
                    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

                    [...players, ball].forEach(p => {
                        if (!p.steps[i]) return;
                        const s = p.steps[i];
                        if (s.length === 0) return;

                        // La pelota omite su path propio SOLO si no tiene recorrido
                        // (un único punto = siempre estuvo pegada a un jugador).
                        // Si tiene más de un punto significa que viajó antes de imantarse:
                        // en ese caso sí interpolamos su path y _render() usa ax/ay.
                        if (p === ball && imantadoA && s.length <= 1) return;

                        const progFlot = ease * (s.length - 1);
                        const idxBase  = Math.floor(progFlot);
                        const idxSig   = Math.min(s.length - 1, idxBase + 1);
                        const factor   = progFlot - idxBase;
                        const ptoA = s[idxBase], ptoB = s[idxSig];

                        p.ax = ptoA.x + (ptoB.x - ptoA.x) * factor;
                        p.ay = ptoA.y + (ptoB.y - ptoA.y) * factor;

                        const startPt = s[0], endPt = s[s.length - 1];
                        const seMueve = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y) > 2;
                        if (seMueve) {
                            if (f < totalFrames) { p.as = false; p.aa = 0; }
                            else { p.as = endPt.isScreen; p.aa = endPt.angle; }
                        } else {
                            p.as = endPt.isScreen; p.aa = endPt.angle;
                        }
                    });

                    renderAnim();
                    f++;
                    if (f <= totalFrames) requestAnimationFrame(frame); else res();
                }
                frame();
            });

            if (!shouldStopLoop) await new Promise(r => setTimeout(r, 350));
        }
        if (!isLooping) break;
    } while (isLooping && !shouldStopLoop);

    isPlaying = false;
    setPlayButtonsState(false);
}

function toggleLoop() {
    isLooping = !isLooping;
    setLoopButtonsColor(isLooping);
}

function changeSpeed() {
    const selector = document.getElementById('speedSelect');
    if (selector) factorVelocidad = parseFloat(selector.value);
}

// --------------------------------------------------------
// NUEVA JUGADA
// --------------------------------------------------------

function newPlay() {
    abrirConfirmModal("¿BORRAR JUGADA?", "Se perderá toda la jugada actual.", "BORRAR", confirmNewPlay);
}

function confirmNewPlay() {
    currentStep       = 0;
    isEditionFinished = false;
    activeObj         = null;
    undoStack         = [];
    redoStack         = [];

    if (canvas) {
        const hRef = (courtMode === 'full') ? canvas.height / 2 : canvas.height;
        ball.steps          = [[{ x: canvas.width / 2, y: yPorFraccion(0.45, hRef), isScreen: false, angle: 0 }]];
        ball.portadorPorPaso = [null];
    }

    players = [];
    syncPlayers();

    document.getElementById('playback-controls').style.display = "none";
    document.getElementById('edit-controls').style.display     = "flex";
    if (addStepBtn) addStepBtn.style.display = "block";

    updateFloatingUI();
    updateStepUI();
    renderTimeline();
    draw();
}

// --------------------------------------------------------
// EXPORT / IMPORT JSON
// --------------------------------------------------------

function exportPlay() {
    const d = {
        a: rs.value, d: bs.value,
        b: ball, p: players,
        s: { w: canvas.width, h: canvas.height },
        m: courtMode
    };
    const blob = new Blob([JSON.stringify(d)], { type: "application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "pizarra_oeste.json";
    a.click();
}

function importPlay(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const d = JSON.parse(e.target.result);

        if (d.m && d.m !== courtMode) {
            // La jugada fue guardada en el otro modo: cambiamos de modo
            // solos y, apenas termine, la aplicamos automáticamente.
            pendingImport = d;
            cambiarModoSilencioso(d.m);
        } else {
            aplicarJugadaImportada(d);
        }
    };
    reader.readAsText(event.target.files[0]);
    event.target.value = ''; // permite volver a importar el mismo archivo después
}

function aplicarJugadaImportada(d) {
    rs.value = d.a;
    bs.value = d.d;

    const sX = canvas.width  / d.s.w;
    const sY = canvas.height / d.s.h;

    ball = d.b;
    ball.steps.forEach(s => s.forEach(p => { p.x *= sX; p.y *= sY; }));
    // Compatibilidad con jugadas guardadas antes de portadorPorPaso
    if (!ball.portadorPorPaso) {
        ball.portadorPorPaso = ball.steps.map(() => null);
    }

    players = d.p;
    players.forEach(pl => {
        pl.steps.forEach(s => s.forEach(p => { p.x *= sX; p.y *= sY; }));
        if (!pl.label) pl.label = '';
    });

    undoStack   = [];
    redoStack   = [];
    currentStep = 0;
    updateFormationOptions();
    renderTimeline();
    updateStepUI();
    draw();
    attachButtonSounds();
}

// --------------------------------------------------------
// EXPORTACIÓN A VIDEO (WebM / MP4 para WhatsApp)
// --------------------------------------------------------

async function exportVideo() {
    if (isExporting) return;

    if (!canvas.captureStream || !window.MediaRecorder) {
        alert("Tu browser no soporta grabación de video. Probá con Chrome o Edge actualizado.");
        return;
    }

    const codecsAProbar = [
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    let mimeTypeElegido = '';
    for (const codec of codecsAProbar) {
        if (MediaRecorder.isTypeSupported(codec)) { mimeTypeElegido = codec; break; }
    }
    if (!mimeTypeElegido) {
        alert("Tu browser no soporta ningún formato de grabación estándar.");
        return;
    }
    const esMp4     = mimeTypeElegido.startsWith('video/mp4');
    const extension = esMp4 ? 'mp4' : 'webm';

    const exportBtn = document.getElementById('exportVideoBtn');
    isExporting = true;
    if (exportBtn) { exportBtn.innerText = "⏳ GRABANDO..."; exportBtn.disabled = true; exportBtn.style.opacity = "0.6"; }

    const stepAntes    = currentStep;
    const loopingAntes = isLooping;

    shouldStopLoop = true; isLooping = false; isPlaying = false;
    await new Promise(r => setTimeout(r, 80));

    const resetBtn = () => {
        isExporting = false;
        if (exportBtn) { exportBtn.innerText = "🎬 EXPORTAR VIDEO"; exportBtn.disabled = false; exportBtn.style.opacity = "1"; }
    };

    let stream;
    try { stream = canvas.captureStream(30); }
    catch (err) { alert("Error al capturar el canvas: " + err.message); resetBtn(); return; }

    let recorder;
    try { recorder = new MediaRecorder(stream, { mimeType: mimeTypeElegido, videoBitsPerSecond: 8000000 }); }
    catch (err) { alert("Error al iniciar el grabador: " + err.message); resetBtn(); return; }

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    recorder.onerror = () => {
        resetBtn();
        currentStep = stepAntes; isLooping = loopingAntes;
        draw(); renderTimeline();
        alert("Error durante la grabación.");
    };

    recorder.onstop = () => {
        if (chunks.length === 0) {
            alert("No se capturaron datos de video.");
            resetBtn(); currentStep = stepAntes; isLooping = loopingAntes;
            draw(); renderTimeline(); return;
        }
        const blob = new Blob(chunks, { type: esMp4 ? 'video/mp4' : 'video/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'jugada_oeste.' + extension;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        currentStep = stepAntes; isLooping = loopingAntes;
        resetBtn(); draw(); renderTimeline();
        if (!esMp4) {
            alert("Tu navegador grabó el video en formato WebM (no pudo generar MP4 directamente). WebM se puede compartir por WhatsApp como archivo sin problema. Para lograr MP4 nativo probá desde Chrome/Edge actualizado o desde Safari en iPhone/Mac.");
        }
    };

    recorder.start(100);
    shouldStopLoop = false;

    const velocidadOriginal = factorVelocidad;
    factorVelocidad = 1;

    for (let i = 0; i < ball.steps.length; i++) {
        currentStep = i;
        renderTimeline();

        if (i === 0) {
            [...players, ball].forEach(p => { delete p.ax; delete p.ay; delete p.as; delete p.aa; });
            renderAnim();
            await new Promise(r => setTimeout(r, 700));
            continue;
        }

        await new Promise(res => {
            let totalFrames = 170, f = 0;
            function frame() {
                const t    = f / totalFrames;
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

                [...players, ball].forEach(p => {
                    if (!p.steps[i]) return;
                    const s = p.steps[i]; if (s.length === 0) return;

                    // Misma lógica que playFullPlay: pelota sin recorrido → la pinta _render()
                    if (p === ball && imantadoA && s.length <= 1) return;
                    const progFlot = ease * (s.length - 1);
                    const idxBase  = Math.floor(progFlot);
                    const idxSig   = Math.min(s.length - 1, idxBase + 1);
                    const factor   = progFlot - idxBase;
                    const ptoA = s[idxBase], ptoB = s[idxSig];
                    p.ax = ptoA.x + (ptoB.x - ptoA.x) * factor;
                    p.ay = ptoA.y + (ptoB.y - ptoA.y) * factor;
                    const startPt = s[0], endPt = s[s.length - 1];
                    const seMueve = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y) > 2;
                    if (seMueve) {
                        if (f < totalFrames) { p.as = false; p.aa = 0; }
                        else { p.as = endPt.isScreen; p.aa = endPt.angle; }
                    } else { p.as = endPt.isScreen; p.aa = endPt.angle; }
                });

                renderAnim();
                f++;
                if (f <= totalFrames) requestAnimationFrame(frame); else res();
            }
            frame();
        });
        await new Promise(r => setTimeout(r, 400));
    }

    await new Promise(r => setTimeout(r, 800));
    factorVelocidad = velocidadOriginal;
    recorder.stop();
}

// --------------------------------------------------------
// ARRANQUE
// --------------------------------------------------------

window.onload = () => {
    startLoadingSequence();
};
