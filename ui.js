// ========================================================
// PIZARRA OESTE - ui.js
// Interfaz gráfica: selección de modo de cancha, control de
// orientación, timeline, pasos, solapas, pantalla de carga,
// reproducción, import/export JSON y video.
// Depende de: estado.js, cancha.js, jugadores.js, interaccion.js, audio.js
// ========================================================

// Jugada leída de un archivo que quedó esperando a que termine un cambio
// de modo de cancha (cuando el archivo fue guardado en el otro modo).
// Arranca directamente con el borrador del autoguardado si había uno
// (ver borradorAlIniciar en estado.js): así, apenas init() termine de
// preparar el canvas, se aplica solo -sin ningún cartel- exactamente
// igual que si el usuario hubiera elegido "Cargar Jugada" a mano.
let pendingImport = (typeof borradorAlIniciar !== "undefined" && borradorAlIniciar) ? borradorAlIniciar : null;

// Marca que la app se está mostrando después de un cambio de modo manual
// (preservando la jugada), para refrescar la UI una vez que init()
// termine de reescalar las coordenadas.
let vieneDeCambioDeModo = false;

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
    if (modal) modal.classList.add('abierto');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('abierto');
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
    if (modal) modal.classList.add('abierto');
}

function cerrarAcercaDe() {
    const modal = document.getElementById('acercaDeModal');
    if (modal) modal.classList.remove('abierto');
}

// --------------------------------------------------------
// BARRA FLOTANTE DE UTILERÍA (v142)
// --------------------------------------------------------
// Solo se usa/está disponible en el Paso Inicial -ver updateStepUI(),
// que la cierra sola al salir de ahí- y se puebla con agregarUtileria()
// (jugadores.js) al tocar cada objeto.

function toggleUtileriaBar() {
    const bar = document.getElementById('utileria-bar');
    if (bar) bar.classList.toggle('abierto');
}

function cerrarBarraUtileria() {
    const bar = document.getElementById('utileria-bar');
    if (bar) bar.classList.remove('abierto');
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

    if (modeScreen)      modeScreen.classList.toggle('abierto',      bloqueo === 'mode-select-screen');
    if (landscapeForcer) landscapeForcer.classList.toggle('abierto', bloqueo === 'landscape-forcer');
    if (portraitForcer)  portraitForcer.classList.toggle('abierto',  bloqueo === 'portrait-forcer');

    if (!bloqueo && courtMode) {
        // El cambio de cancha (si lo hubo) quedó confirmado: ya no hace
        // falta la foto de "por si cancelan" (ver changeCourtMode() /
        // cancelarCambioDeCancha()).
        estadoPrevioCambioCancha = null;

        if (appWrapper) appWrapper.style.display = 'flex';
        activarInterfaz();
        if (typeof init === 'function') init();

        // Si veníamos de un cambio de modo manual (preservando la jugada):
        // init() ya reescala solo las coordenadas de jugadores/pelota
        // según la proporción de ancho nueva (lo hace desde antes, para
        // cuando cambia el tamaño de ventana). Acá solo refrescamos la UI.
        if (vieneDeCambioDeModo) {
            vieneDeCambioDeModo = false;
            updateStepUI();
            renderTimeline();
            draw();
            // Cambio de modo de cancha confirmado (o revertido por
            // "Cancelar"): autoguardado silencioso del nuevo estado.
            if (typeof guardarBorradorSilencioso === "function") guardarBorradorSilencioso();
        }

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
    const colIzqCont = document.getElementById('col-izquierda-container');
    const colDerCont = document.getElementById('col-linea-tiempo-container');

    // La medición por contenido (alto = lo que ocupan los controles) solo
    // tiene sentido cuando las barras son franjas horizontales arriba/abajo
    // (Cancha Completa en celu/tablet). En cualquier otro caso -Media
    // Cancha, o Cancha Completa en PC- las barras son columnas laterales
    // y deben ocupar el 100% del alto disponible, tal como ya lo define
    // el CSS por defecto. Si veníamos de haber fijado un alto explícito
    // (por ejemplo, tras cambiar de modo de cancha) lo limpiamos acá para
    // que ese 100% de altura vuelva a aplicarse.
    if (!esLayoutFullVertical()) {
        [colIzqCont, colDerCont].forEach(cont => {
            if (!cont) return;
            cont.style.height    = '';
            cont.style.maxHeight = '';
        });
        return;
    }

    medirYFijarAltura(colIzqCont, document.getElementById('col-izquierda'));
    medirYFijarAltura(colDerCont, document.getElementById('col-linea-tiempo'));
}

// Muestra/oculta un elemento con un fundido + leve escala. El ESPACIO que
// ocupa (display) se resuelve al instante -para no romper el cálculo de
// ajustarAlturaBarras()-, solo la apariencia visual queda animada: al
// ocultar, primero se desvanece y recién después de la transición se le
// saca el espacio; al mostrar, se le da el espacio al instante y aparece
// desvanecido, apareciendo enseguida.
function mostrarConFade(el, mostrar, displayVisible) {
    if (!el) return;
    el.classList.add('fade-el');
    if (mostrar) {
        const yaVisible = el.style.display !== 'none' && !el.classList.contains('oculto-fade');
        el.style.display = displayVisible || '';
        if (!yaVisible) void el.offsetWidth; // fuerza reflow solo si hacía falta animar la entrada
        el.classList.remove('oculto-fade');
    } else {
        if (el.classList.contains('oculto-fade')) return; // ya está ocultándose/oculto
        el.classList.add('oculto-fade');
        setTimeout(() => {
            if (el.classList.contains('oculto-fade')) el.style.display = 'none';
        }, 190);
    }
}

// Se ejecuta una única vez, la primera vez que la app queda visible:
// despierta las solapas y, en Cancha Completa, activa el layout de barras
// horizontales (arriba/abajo) en vez de verticales (izq/der).
// En escritorio (mouse, pantalla grande) las barras siempre van a los
// costados, aunque estemos en Cancha Completa: ahí sobra ancho de sobra
// y ponerlas arriba/abajo solo le resta alto al dibujo de la cancha. En
// celu/tablet se mantiene el comportamiento adaptativo de siempre.
function esDispositivoDeEscritorio() {
    return window.matchMedia('(pointer: fine) and (hover: hover)').matches;
}

function actualizarClaseModoFull() {
    const appWrapper = document.getElementById('app-wrapper');
    if (!appWrapper) return;
    const usarLayoutVertical = (courtMode === 'full') && !esDispositivoDeEscritorio();
    appWrapper.classList.toggle('modo-full', usarLayoutVertical);
    return usarLayoutVertical;
}

// Único punto de verdad para saber si la interfaz está usando el layout
// de barras arriba/abajo (Cancha Completa en celu/tablet). Es lo mismo
// que la clase .modo-full que ya se le aplica a #app-wrapper.
// IMPORTANTE: en PC, Cancha Completa usa barras laterales (igual que
// Media Cancha), así que esto devuelve false en ese caso: cualquier
// lógica que deba comportarse "como en Media Cancha" cuando las barras
// están a los costados (sea por estar en Media Cancha, o por estar en
// Cancha Completa pero en PC) debe consultar esta función en vez de
// mirar directamente `courtMode`.
function esLayoutFullVertical() {
    const appWrapper = document.getElementById('app-wrapper');
    return !!(appWrapper && appWrapper.classList.contains('modo-full'));
}

function activarInterfaz() {
    if (solapasActivadas) return;
    solapasActivadas = true;

    const appWrapper = document.getElementById('app-wrapper');
    const sIzq = document.getElementById('solapa-izq');
    const sDer = document.getElementById('solapa-der');
    if (sIzq) sIzq.classList.add('solapa-activa');
    if (sDer) sDer.classList.add('solapa-activa');

    const usaLayoutVertical = actualizarClaseModoFull();
    if (usaLayoutVertical) {
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
    stepCount         = 1;
    players           = [];
    balls = [{
        id:     'ball-0',
        active: true,
        team:   'ball',
        steps:  [[{ x: 0, y: 0, isScreen: false, angle: 0 }]],
        portadorPorPaso: [null]
    }];
    nextBallId = 1;
    props      = [];
    nextPropId = 1;

    // Reset total también de Pizarra Rápida (ambas caras), por prolijidad:
    // este reset solo ocurre al cargar una jugada de otro modo, algo que
    // ya está bloqueado desde el menú mientras Pizarra Rápida está activa.
    lienzosLibres = {
        full: { trazos: [], deshechos: [], sF: null },
        half: { trazos: [], deshechos: [], sF: null }
    };
    trazoActual = null;
    if (typeof redibujarLienzoLibre === "function") redibujarLienzoLibre();

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

// Cambio de modo manual (botón 🔁): preserva la jugada actual, remapeando
// las coordenadas al nuevo tamaño de cancha. Ya no hace falta confirmar
// nada porque no se pierde nada.
function changeCourtMode() {
    const otroModo = (courtMode === 'full') ? 'half' : 'full';
    const estabaEnReproduccion = isEditionFinished;

    // Foto de cómo estaba todo ANTES de tocar nada: si el cartel de
    // rotación que puede aparecer a continuación se cancela, se restaura
    // exactamente desde acá (ver cancelarCambioDeCancha()).
    const colIzqContPrevio = document.getElementById('col-izquierda-container');
    const colDerContPrevio = document.getElementById('col-linea-tiempo-container');
    estadoPrevioCambioCancha = {
        courtMode:  courtMode,
        undoStack:  undoStack.slice(),
        redoStack:  redoStack.slice(),
        izqColapsado: colIzqContPrevio ? colIzqContPrevio.classList.contains('colapsado') : false,
        derColapsado: colDerContPrevio ? colDerContPrevio.classList.contains('colapsado') : false,
    };

    if (!estabaEnReproduccion) {
        shouldStopLoop = true; isLooping = false; isPlaying = false; isEditionFinished = false;
        setPlayButtonsState(false); setLoopButtonsColor(false);
        factorVelocidad = 1;
        const spdSel = document.getElementById('speedSelect');
        if (spdSel) spdSel.value = "1";
        document.getElementById('playback-controls').style.display = "none";
        document.getElementById('edit-controls').style.display     = "flex";
        if (addStepBtn) addStepBtn.style.display = "block";
    }
    // Si estaba reproduciéndose (o pausada en modo reproducción), no
    // tocamos nada de lo anterior: sigue reproduciéndose después del
    // cambio de modo, sin volver a "editar pasos".
    activeObj = null; isDragging = false; undoStack = []; redoStack = [];

    const appWrapper = document.getElementById('app-wrapper');
    const colIzqCont = document.getElementById('col-izquierda-container');
    const colDerCont = document.getElementById('col-linea-tiempo-container');
    [colIzqCont, colDerCont].forEach(c => { if (c) c.classList.add('sin-transicion'); });
    courtMode = otroModo;
    actualizarClaseModoFull();
    if (appWrapper) appWrapper.style.display = 'none';
    [colIzqCont, colDerCont].forEach(cont => {
        if (!cont) return;
        // En Modo Táctico, cambiar de cancha siempre vuelve a mostrar
        // ambas barras (reorienta al usuario tras un cambio grande). En
        // Pizarra Rápida, en cambio, respetamos tal cual el estado de
        // colapso que tenía cada barra: si estaba oculta para tener más
        // lugar para dibujar, debe seguir oculta después del cambio.
        if (!modoPizarraRapida) cont.classList.remove('colapsado');
        cont.style.height = ''; cont.style.maxHeight = '';
    });
    sincronizarIconoSolapa('izq');
    sincronizarIconoSolapa('der');
    verificarMenuFlotante();
    requestAnimationFrame(() => {
        [colIzqCont, colDerCont].forEach(c => { if (c) c.classList.remove('sin-transicion'); });
    });

    vieneDeCambioDeModo = true;
    solapasActivadas = false;
    checkOrientationForMode();
}

// Se dispara desde el botón "✕ Cancelar" de los carteles de rotación
// (#landscape-forcer / #portrait-forcer). Dos escenarios posibles:
//
// 1) Había una jugada en curso y el cartel apareció por un toque
//    accidental en "Cambiar Cancha": restauramos exactamente el modo de
//    cancha, el historial de deshacer/rehacer y el estado de las barras
//    que había ANTES de ese toque (estadoPrevioCambioCancha, capturado al
//    principio de changeCourtMode()). Nada de la jugada se pierde porque
//    nunca se llegó a tocar: el bloqueo por orientación corta el flujo
//    antes de reescalar coordenadas o redibujar nada.
// 2) No había ningún cambio de cancha en curso (el cartel apareció recién
//    al elegir modo por primera vez, desde la pantalla de selección):
//    no hay nada que "revertir", así que simplemente se vuelve a mostrar
//    esa misma pantalla para elegir de nuevo.
function cancelarCambioDeCancha() {
    if (!estadoPrevioCambioCancha) {
        courtMode = null;
        checkOrientationForMode();
        return;
    }

    const previo = estadoPrevioCambioCancha;
    estadoPrevioCambioCancha = null;

    const colIzqCont = document.getElementById('col-izquierda-container');
    const colDerCont = document.getElementById('col-linea-tiempo-container');
    [colIzqCont, colDerCont].forEach(c => { if (c) c.classList.add('sin-transicion'); });

    courtMode = previo.courtMode;
    undoStack = previo.undoStack;
    redoStack = previo.redoStack;
    actualizarClaseModoFull();
    if (colIzqCont) {
        colIzqCont.classList.toggle('colapsado', previo.izqColapsado);
        colIzqCont.style.height = ''; colIzqCont.style.maxHeight = '';
    }
    if (colDerCont) {
        colDerCont.classList.toggle('colapsado', previo.derColapsado);
        colDerCont.style.height = ''; colDerCont.style.maxHeight = '';
    }
    sincronizarIconoSolapa('izq');
    sincronizarIconoSolapa('der');

    // El modo de cancha al que volvemos es, por definición, el que ya
    // se estaba usando antes del toque accidental: la orientación actual
    // del dispositivo ya era compatible con él, así que checkOrientation-
    // ForMode() va a cerrar los carteles y mostrar la app de nuevo sin
    // pedir ninguna rotación.
    vieneDeCambioDeModo = true;
    checkOrientationForMode();

    requestAnimationFrame(() => {
        [colIzqCont, colDerCont].forEach(c => { if (c) c.classList.remove('sin-transicion'); });
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
    if (modoPizarraRapida) {
        // El "paso" táctico queda congelado (no se toca) mientras se
        // dibuja: toda esta función (que depende de currentStep) no
        // aplica. Deshacer/Rehacer, eso sí, deben quedar SIEMPRE
        // visibles acá (aplican a los trazos), sin importar en qué paso
        // haya quedado la jugada de fondo.
        const undoRow = document.getElementById('undoBtn')?.closest('.icon-row');
        if (undoRow) undoRow.style.display = '';
        ajustarAlturaBarras();
        return;
    }

    const delBtn = document.getElementById('delStepBtn');
    if (delBtn) delBtn.style.display = (currentStep > 0 && !isEditionFinished) ? "" : "none";

    const esPasoInicial       = (currentStep === 0 && !isEditionFinished);
    const controlesOcultables = [rs, bs, fs, document.getElementById('ballBtn'), document.getElementById('utileriaBtn')];
    controlesOcultables.forEach(ctrl => {
        if (!ctrl) return;
        ctrl.style.display = esPasoInicial ? "" : "none";
    });

    // La barra flotante de Utilería (y cualquier objeto de utilería que
    // haya quedado seleccionado) tampoco tienen sentido fuera del Paso
    // Inicial: se agregan/mueven/eliminan únicamente ahí.
    if (!esPasoInicial) {
        if (typeof cerrarBarraUtileria === "function") cerrarBarraUtileria();
        if (esUtileria(activeObj)) { activeObj = null; isDragging = false; }
    }
    if (typeof updatePropFloatingUI === "function") updatePropFloatingUI();

    // Deshacer/Rehacer/Historial no tienen ningún uso en el paso 0 NI
    // durante la reproducción de una jugada finalizada (isEditionFinished):
    // sin este segundo chequeo, al clickear un paso de la lista mientras
    // se reproduce una jugada terminada, currentStep > 0 hacía que estos
    // controles de EDICIÓN reaparecieran indebidamente.
    const mostrarHistorial = currentStep > 0 && !isEditionFinished;
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

    for (let i = 0; i < stepCount; i++) {
        const btn = document.createElement('button');
        const color = stepColors[i % stepColors.length];
        btn.className  = `step-btn snd-btn ${i === currentStep ? 'active' : ''}`;
        // Abreviado ("INI"/"P1") solo hace falta en el layout de barras
        // horizontales de celu/tablet, donde el espacio es limitado. En
        // PC, aunque estemos en Cancha Completa, las barras son laterales
        // y hay lugar de sobra para el texto completo.
        btn.innerText  = esLayoutFullVertical()
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
    }

    if (addStepBtn) {
        addStepBtn.style.display = isEditionFinished ? "none" : "";
        if (!isEditionFinished) timelineList.appendChild(addStepBtn);
    }

    // Auto-scroll para que +PASO (al final de la lista) quede siempre
    // visible, sin que haga falta scrollear manualmente para alcanzarlo.
    // La lista es horizontal solo en el layout de barras arriba/abajo
    // (Cancha Completa en celu/tablet); en cualquier otro caso -incluida
    // Cancha Completa en PC- es una columna vertical.
    if (esLayoutFullVertical()) {
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

    // Cada pelota hereda el punto final de su propio portador (o su
    // propia posición si está suelta) -son independientes entre sí-
    balls.forEach(b => {
        const portadorActual = b.portadorPorPaso[currentStep] ?? null;
        if (portadorActual) {
            const portador     = players.find(p => p.id === portadorActual);
            const portadorLast = portador
                ? portador.steps[currentStep][portador.steps[currentStep].length - 1]
                : b.steps[currentStep][b.steps[currentStep].length - 1];
            b.steps.push([{ x: portadorLast.x + 13*sF, y: portadorLast.y - 13*sF, isScreen: false, angle: 0 }]);
        } else {
            const last = b.steps[currentStep][b.steps[currentStep].length - 1];
            b.steps.push([{ x: last.x, y: last.y, isScreen: false, angle: 0 }]);
        }
        // Propagamos el portador al nuevo paso (el jugador sigue teniendo esta pelota)
        b.portadorPorPaso.push(portadorActual);
    });

    currentStep++;
    stepCount++;
    updateStepUI();
    renderTimeline();
    draw();
    attachButtonSounds();
    guardarBorradorSilencioso(); // se agregó un paso a la línea de tiempo
}

function deleteLastStep() {
    if (currentStep === 0) return;
    redoStack = [];
    players.forEach(p => p.steps.pop());
    balls.forEach(b => { b.steps.pop(); b.portadorPorPaso.pop(); });
    currentStep--;
    stepCount--;
    updateStepUI();
    renderTimeline();
    draw();
    attachButtonSounds();
    guardarBorradorSilencioso(); // se borró un paso de la línea de tiempo
}

// --------------------------------------------------------
// FINALIZAR / VOLVER A EDICIÓN
// --------------------------------------------------------

function finishEdition() {
    isEditionFinished = true;
    activeObj         = null;
    if (typeof cerrarBarraUtileria === "function") cerrarBarraUtileria();
    updateFloatingUI();

    document.getElementById('playback-controls').style.display = "flex";
    document.getElementById('edit-controls').style.display     = "none";
    if (addStepBtn) addStepBtn.style.display = "none";

    // Deshacer/Rehacer son acciones de EDICIÓN: no deben quedar disponibles
    // en modo reproducción (permitía deshacer movimientos sin haber
    // entrado a "Editar"). Se restauran en backToEdit() vía updateStepUI().
    const undoRow = document.getElementById('undoBtn')?.closest('.icon-row');
    if (undoRow) undoRow.style.display = 'none';

    const spdSel = document.getElementById('speedSelect');
    if (spdSel) { spdSel.disabled = false; spdSel.style.opacity = "1"; spdSel.style.pointerEvents = "auto"; }

    verificarMenuFlotante();
    attachButtonSounds();
    ajustarAlturaBarras();
    guardarBorradorSilencioso(); // pasó a modo reproducción (jugada finalizada)
}

function backToEdit() {
    shouldStopLoop    = true;
    isLooping         = false;
    isPlaying         = false;
    isEditionFinished = false;

    setPlayButtonsState(false);
    setLoopButtonsColor(false);

    // Si la barra de la línea de tiempo estaba colapsada, la volvemos a
    // abrir: hace falta verla para poder editar los pasos.
    const derCont = document.getElementById('col-linea-tiempo-container');
    if (derCont && derCont.classList.contains('colapsado')) {
        toggleSidebar('der');
    }

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
    guardarBorradorSilencioso(); // volvió a modo edición
    ajustarAlturaBarras();
}

// --------------------------------------------------------
// SOLAPAS LATERALES
// --------------------------------------------------------

// Actualiza el ícono (▶◀ o ▲▼, según el layout activo) de la solapa que
// colapsa/expande una barra, sin tocar el estado de colapso en sí.
// Separado de toggleSidebar() para poder reusarlo también después de un
// cambio de modo de cancha (que puede alterar qué layout corresponde sin
// que el usuario haya tocado la solapa).
function sincronizarIconoSolapa(lado) {
    const contenedor = document.getElementById(lado === 'izq' ? 'col-izquierda-container' : 'col-linea-tiempo-container');
    const boton      = document.getElementById(lado === 'izq' ? 'solapa-izq' : 'solapa-der');
    if (!contenedor || !boton) return;
    const colapsado = contenedor.classList.contains('colapsado');
    if (esLayoutFullVertical()) {
        if (lado === 'izq') boton.innerText = colapsado ? "▼" : "▲";
        else                boton.innerText = colapsado ? "▲" : "▼";
    } else {
        if (lado === 'izq') boton.innerText = colapsado ? "▶" : "◀";
        else                boton.innerText = colapsado ? "◀" : "▶";
    }
}

function verificarMenuFlotante() {
    const izqCont = document.getElementById('col-izquierda-container');
    const derCont = document.getElementById('col-linea-tiempo-container');
    const izqEscondido = izqCont ? izqCont.classList.contains('colapsado') : false;
    const derEscondido = derCont ? derCont.classList.contains('colapsado') : false;

    const menuFlotante = document.getElementById('fullscreen-floating-menu');
    if (menuFlotante) {
        // El menú flotante de Play/Loop/Editar es puramente táctico: no
        // tiene sentido mostrarlo en Pizarra Rápida aunque ambas barras
        // estén colapsadas.
        menuFlotante.classList.toggle('abierto', !modoPizarraRapida && isEditionFinished && derEscondido);
    }

    // Modo Pizarra Rápida: si una barra queda oculta, sus controles
    // imprescindibles reaparecen como un mini menú flotante, para no
    // perder acceso a la herramienta activa mientras se dibuja a
    // pantalla completa. Cada uno es independiente del otro.
    const floatIzq = document.getElementById('floatMenuIzqLibre');
    const floatDer = document.getElementById('floatMenuDerLibre');
    if (floatIzq) floatIzq.classList.toggle('abierto', modoPizarraRapida && izqEscondido);
    if (floatDer) floatDer.classList.toggle('abierto', modoPizarraRapida && derEscondido);
}

function toggleSidebar(lado) {
    const contenedor = document.getElementById(
        lado === 'izq' ? 'col-izquierda-container' : 'col-linea-tiempo-container'
    );
    if (!contenedor) return;

    contenedor.classList.toggle('colapsado');
    sincronizarIconoSolapa(lado);
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
        for (let i = 0; i < stepCount; i++) {
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

                    [...players, ...balls].forEach(p => {
                        if (!p.steps[i]) return;
                        const s = pathEfectivo(p, i);
                        if (s.length === 0) return;

                        // Una pelota omite su path propio SOLO si no tiene recorrido
                        // (un único punto = siempre estuvo pegada a un jugador).
                        // Si tiene más de un punto significa que viajó antes de imantarse:
                        // en ese caso sí interpolamos su path y _render() usa ax/ay.
                        if (p.team === 'ball' && p.portadorPorPaso[i] && s.length <= 1) return;

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
    // En Pizarra Rápida, "Nueva Jugada" pasa a actuar como "Limpiar
    // Pizarra": borra los trazos del lienzo activo, sin tocar la jugada
    // táctica (que sigue intacta, oculta, esperando a que se vuelva a
    // Modo Táctico).
    if (modoPizarraRapida) { confirmarLimpiarPizarraLibre(); return; }
    abrirConfirmModal("¿BORRAR JUGADA?", "Se perderá toda la jugada actual.", "BORRAR", confirmNewPlay);
}

function confirmNewPlay() {
    currentStep       = 0;
    isEditionFinished = false;
    activeObj         = null;
    undoStack         = [];
    redoStack         = [];
    if (typeof cerrarBarraUtileria === "function") cerrarBarraUtileria();

    if (canvas) {
        const hRef = (courtMode === 'full') ? canvas.height / 2 : canvas.height;
        balls = [{
            id:     'ball-0',
            active: true,
            team:   'ball',
            steps:  [[{ x: canvas.width / 2, y: yPorFraccion(0.45, hRef), isScreen: false, angle: 0 }]],
            portadorPorPaso: [null]
        }];
        nextBallId = 1;
    }
    props      = [];
    nextPropId = 1;
    stepCount  = 1;

    players = [];
    syncPlayers();

    document.getElementById('playback-controls').style.display = "none";
    document.getElementById('edit-controls').style.display     = "flex";
    if (addStepBtn) addStepBtn.style.display = "block";

    updateFloatingUI();
    updateStepUI();
    renderTimeline();
    draw();

    // "Nueva Jugada" borra explícitamente el borrador guardado: si no,
    // al cerrar y reabrir la app después de vaciar la pizarra, el
    // autoguardado la volvería a llenar sola con la jugada anterior.
    if (typeof borrarBorradorGuardado === "function") borrarBorradorGuardado();
}

// --------------------------------------------------------
// MODO "PIZARRA RÁPIDA" (dibujo libre tipo acrílico)
// --------------------------------------------------------

function togglePizarraLibre() {
    modoPizarraRapida = !modoPizarraRapida;
    aplicarModoPizarraLibre();
}

// Único punto de entrada que sincroniza TODA la interfaz con el estado
// de modoPizarraRapida: clases CSS (barras + menú Archivo), captura de
// eventos del lienzo de dibujo, textos, y un refresco general.
function aplicarModoPizarraLibre() {
    const appWrapper = document.getElementById('app-wrapper');
    const checkbox    = document.getElementById('pizarraLibreCheckbox');
    if (checkbox) checkbox.checked = modoPizarraRapida;

    // Clase en <body> (alcanza al menú Archivo, que vive fuera de
    // #app-wrapper) y en #app-wrapper (barras laterales).
    document.body.classList.toggle('pizarra-libre-activa', modoPizarraRapida);
    if (appWrapper) appWrapper.classList.toggle('pizarra-libre-activa', modoPizarraRapida);

    // El lienzo de dibujo solo debe capturar clics/toques mientras el
    // modo está activo; en Modo Táctico queda completamente "transparente"
    // a los clics para no interferir con el arrastre de fichas.
    if (drawCanvas) drawCanvas.style.pointerEvents = modoPizarraRapida ? 'auto' : 'none';

    // "Nueva Jugada" cambia de rótulo para reflejar que en este modo
    // actúa como "Limpiar Pizarra".
    const nuevaJugadaItem = document.getElementById('nuevaJugadaMenuItem');
    if (nuevaJugadaItem) nuevaJugadaItem.innerText = modoPizarraRapida ? '🧹 Limpiar Pizarra' : '📄 Nueva Jugada';

    // Soltamos cualquier arrastre/trazo a medio hacer al cambiar de modo.
    activeObj       = null;
    isDragging      = false;
    trazoActual     = null;
    dibujandoLibre  = false;
    borrandoConGoma = false;
    if (typeof cerrarBarraUtileria === "function") cerrarBarraUtileria();

    actualizarHerramientaUI();
    redibujarLienzoLibre();

    draw();               // refresca el canvas táctico (oculta/muestra fichas)
    updateStepUI();        // restaura/oculta según corresponda (ver updateStepUI)
    updateFloatingUI();
    verificarMenuFlotante();
    attachButtonSounds();
    guardarBorradorSilencioso(); // cambió el modo Táctico/Pizarra Rápida
}

// --- SELECCIÓN DE COLOR / HERRAMIENTA ---
// (El grosor de trazo se simplificó a un único valor medio fijo -ver
// grosorTrazoActivo en estado.js-, ya no hay selector para elegirlo.)

function elegirColorTrazo(color) {
    colorTrazoActivo = color;
    // Por data-color (no por el botón clickeado): el mismo color existe
    // duplicado en la barra derecha Y en el menú flotante, y ambos deben
    // quedar en sincro sin importar desde cuál de los dos se eligió.
    document.querySelectorAll('.plib-color-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.color === color);
    });
    // Elegir un color da a entender que se quiere dibujar: si estábamos
    // con la goma puesta, volvemos solos al pincel (como agarrar un
    // fibrón de color en la mano).
    elegirHerramienta('pincel');
}

function elegirHerramienta(herramienta) {
    herramientaActiva = herramienta; // 'pincel' | 'goma'
    // querySelectorAll en vez de IDs fijos: así sincroniza por igual los
    // botones de la barra derecha Y los del menú flotante (mismo atributo
    // data-herramienta en ambos), sin tener que mantener dos copias de
    // esta función.
    document.querySelectorAll('[data-herramienta]').forEach(b => {
        b.classList.toggle('activo', b.dataset.herramienta === herramienta);
    });
    if (drawCanvas) drawCanvas.style.cursor = (herramienta === 'goma') ? 'cell' : 'crosshair';
}

// Sincroniza los botones de color/herramienta con el estado actual (hace
// falta al reactivar el modo, o al cambiar de cara).
function actualizarHerramientaUI() {
    elegirHerramienta(herramientaActiva);
    document.querySelectorAll('.plib-color-btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.color === colorTrazoActivo);
    });
}

// --- LIMPIAR PIZARRA (borra todos los trazos del lienzo activo) ---

function confirmarLimpiarPizarraLibre() {
    abrirConfirmModal("¿LIMPIAR PIZARRA?", "Se borrarán todos los trazos de este lienzo.", "LIMPIAR", limpiarPizarraLibreActiva);
}

function limpiarPizarraLibreActiva() {
    const l = lienzoActivo();
    l.trazos    = [];
    l.deshechos = [];
    trazoActual = null;
    redibujarLienzoLibre();
    actualizarBotonesUndoRedo();
    guardarBorradorSilencioso(); // se vació el lienzo de dibujo libre activo
}

// --- EXPORTAR IMAGEN (Modo Pizarra Rápida) ---
// Las líneas de la cancha viven en el SVG (#court-layer), no en el
// canvas: para exportar una imagen completa armamos, sobre el mismo
// canvas que usa la app, un frame "quemado" con cancha + logo + trazos
// -igual que ya se hace para el video (ver drawCourtOnCanvas)-, lo
// exportamos, y volvemos a dejar todo como estaba (draw() restaura la
// vista normal, con las líneas otra vez a cargo del SVG).
function exportarImagenPizarra() {
    const btn = document.getElementById('plibExportarBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#c19a6b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawParquetTexture();
    drawCourtOnCanvas();
    drawLogo();
    lienzoActivo().trazos.forEach(t => dibujarTrazoLibre(ctx, t));

    let dataUrl = null;
    try {
        dataUrl = canvas.toDataURL('image/png');
    } catch (err) {
        alert("Error al generar la imagen: " + err.message);
    }

    draw(); // vuelve a la vista normal (SVG a cargo de las líneas otra vez)
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
    if (!dataUrl) return;

    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = 'pizarra_oeste.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// --------------------------------------------------------
// EXPORT / IMPORT JSON
// --------------------------------------------------------

function exportPlay() {
    const d = {
        a: rs.value, d: bs.value,
        b: balls, p: players,
        u: props,        // utilería (nuevo en v142; ausente en archivos más viejos)
        t: stepCount,    // cantidad total de pasos (nuevo en v142)
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

    // Compatibilidad: hasta v141 se guardaba una única pelota (objeto),
    // no un arreglo. La convertimos a balls[] con un único elemento.
    const bolasImportadas = Array.isArray(d.b) ? d.b : (d.b ? [d.b] : []);
    balls = bolasImportadas.map((b, i) => {
        b.id   = b.id || ('ball-' + i);
        b.team = 'ball';
        if (b.active === undefined) b.active = true;
        b.steps.forEach(s => s.forEach(p => { p.x *= sX; p.y *= sY; }));
        // Compatibilidad con jugadas guardadas antes de portadorPorPaso
        if (!b.portadorPorPaso) b.portadorPorPaso = b.steps.map(() => null);
        return b;
    });
    if (balls.length === 0) {
        // Por si el archivo trae un arreglo vacío: dejamos al menos una
        // pelota de arranque para no partir de una cancha sin ninguna.
        const hRef = (courtMode === 'full') ? canvas.height / 2 : canvas.height;
        balls = [{
            id: 'ball-0', active: true, team: 'ball',
            steps: [[{ x: canvas.width / 2, y: yPorFraccion(0.45, hRef), isScreen: false, angle: 0 }]],
            portadorPorPaso: [null]
        }];
    }
    nextBallId = balls.length;

    // Utilería (nuevo en v142): ausente en jugadas guardadas antes.
    props = Array.isArray(d.u) ? d.u.map((p, i) => {
        p.id = p.id || ('prop-' + i);
        p.x *= sX; p.y *= sY;
        return p;
    }) : [];
    nextPropId = props.length;

    players = d.p;
    players.forEach(pl => {
        pl.steps.forEach(s => s.forEach(p => { p.x *= sX; p.y *= sY; }));
        if (!pl.label) pl.label = '';
    });

    // Compatibilidad: si el archivo no trae el total de pasos guardado
    // (versiones previas a v142), lo derivamos de la cantidad de pasos
    // del primer jugador o pelota disponible.
    stepCount = d.t || (players[0] && players[0].steps.length) || (balls[0] && balls[0].steps.length) || 1;

    undoStack   = [];
    redoStack   = [];
    // El paso en el que quedó trabajando el entrenador: "Cargar Jugada"
    // siempre vuelve al Paso Inicial (comportamiento de siempre), pero el
    // AUTOGUARDADO sí trae guardado en qué paso había quedado (d.cs) y lo
    // reabre exactamente ahí -ver serializarBorradorActual() en estado.js-.
    // Ausente en un archivo .json de toda la vida → cae a 0, sin cambios.
    currentStep = (typeof d.cs === "number" && d.cs >= 0 && d.cs < stepCount) ? d.cs : 0;
    activeObj   = null;
    // Ídem con el estado de reproducción: si el autoguardado había
    // quedado con la jugada "Finalizada" (viendo la reproducción), la
    // reabrimos en ese mismo modo en vez de volver siempre a Editar.
    isEditionFinished = !!d.ef;
    updateFormationOptions();
    renderTimeline();
    updateStepUI();
    draw();
    attachButtonSounds();
    if (isEditionFinished) finishEdition();

    // Campos exclusivos del autoguardado (ausentes en un archivo .json
    // exportado a mano): estado de la Pizarra Rápida. Los trazos en sí
    // (lienzosLibres) ya quedaron restaurados ANTES de init() -ver
    // estado.js-, acá solo falta sincronizar la interfaz con ellos.
    if (d.pl !== undefined) {
        modoPizarraRapida = !!d.pl;
        if (d.ct) colorTrazoActivo  = d.ct;
        if (d.ht) herramientaActiva = d.ht;
        aplicarModoPizarraLibre();
    }

    // La jugada recién cargada (a mano, o restaurada del autoguardado)
    // pasa a ser el nuevo "borrador actual".
    if (typeof guardarBorradorSilencioso === "function") guardarBorradorSilencioso();
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

    for (let i = 0; i < stepCount; i++) {
        currentStep = i;
        renderTimeline();

        if (i === 0) {
            [...players, ...balls].forEach(p => { delete p.ax; delete p.ay; delete p.as; delete p.aa; });
            renderAnim();
            await new Promise(r => setTimeout(r, 700));
            continue;
        }

        await new Promise(res => {
            let totalFrames = 170, f = 0;
            function frame() {
                const t    = f / totalFrames;
                const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

                [...players, ...balls].forEach(p => {
                    if (!p.steps[i]) return;
                    const s = pathEfectivo(p, i); if (s.length === 0) return;

                    // Misma lógica que playFullPlay: pelota sin recorrido → la pinta _render()
                    if (p.team === 'ball' && p.portadorPorPaso[i] && s.length <= 1) return;
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
