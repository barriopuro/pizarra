// ========================================================
// PIZARRA OESTE - estado.js
// Variables globales y estado compartido de la aplicación.
// DEBE cargarse primero que todos los demás módulos.
// ========================================================

// --- REFERENCIAS AL DOM ---
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const wrap          = document.getElementById('canvas-wrap');
const floatingUI    = document.getElementById('floating-ui');
const rotBtn        = document.getElementById('rot-btn');
const timelineList  = document.getElementById('steps-list');
const addStepBtn    = document.getElementById('addStepBtn');
const historyToggle = document.getElementById('historyToggle');

// Lienzo de dibujo libre (Modo Pizarra Rápida): capa independiente,
// superpuesta exactamente sobre #canvas. Ver más abajo.
const drawCanvas    = document.getElementById('drawCanvas');
const drawCtx       = drawCanvas.getContext('2d');

const rs = document.getElementById('countRed');
const bs = document.getElementById('countBlue');
const fs = document.getElementById('formationSelect');

// --- ESTADO DE LA JUGADA ---
let currentStep       = 0;
let isLooping         = false;
let shouldStopLoop    = false;
let isPlaying         = false;
let isEditionFinished = false;
let isExporting       = false;
let factorVelocidad   = 1;

// --- MODO DE CANCHA (nuevo) ---
// 'full' = Cancha Completa (vertical, dos aros) | 'half' = Media Cancha (horizontal, un aro)
// Se define en la pantalla de selección de modo, antes de inicializar el canvas.
let courtMode        = null;
let solapasActivadas = false;
let cargaCompleta    = false;

// --- OBJETOS DEL JUEGO: PELOTAS (arreglo unificado balls[], v142) ---
// balls[].portadorPorPaso[i] = ID del jugador que lleva ESA pelota en el
// paso i, o null si está suelta en ese paso. Ya no existe una única
// variable global `ball`: balls[] admite cero, una o varias pelotas en
// cancha (Refactor de Pelotas Múltiples). El botón 🏀 de la barra
// principal agrega una pelota nueva al arreglo (ver addBall() en
// jugadores.js); cada una se puede eliminar de forma independiente sin
// afectar la renderización ni el arrastre de las demás.
let balls = [{
    id:              'ball-0',
    active:          true,
    team:            'ball',
    steps:           [[{ x: 0, y: 0, isScreen: false, angle: 0 }]],
    portadorPorPaso: [null]   // índice sincronizado con steps
}];
let nextBallId = 1;
let players    = [];

// Cantidad total de pasos de la jugada. Antes se derivaba de
// ball.steps.length (la única pelota siempre existía y su longitud era
// fuente de verdad confiable); ahora que balls[] puede tener 0 o varios
// elementos, se lleva aparte como fuente de verdad independiente (ver
// addNewStep/deleteLastStep/renderTimeline en ui.js).
let stepCount = 1;

// --- UTILERÍA Y OBJETOS TÁCTICOS DE ENTRENAMIENTO (nuevo en v142) ---
// Capa estática de fondo: cada objeto es un único punto (x,y) + tipo,
// sin pasos ni trayectoria (a diferencia de jugadores/pelotas), así que
// no se anima ni se guarda en la línea de tiempo. Solo se pueden agregar,
// mover o eliminar en el Paso Inicial -ver updateStepUI() en ui.js-, pero
// se dibujan igual en TODOS los pasos (capa de fondo fija).
const PROP_TYPES = ['cono', 'escalera', 'valla', 'obstaculo'];
function esUtileria(obj) {
    return !!obj && PROP_TYPES.includes(obj.type);
}
let props      = [];
let nextPropId = 1;

// --- DRAG & DROP ---
let isDragging = false;
let activeObj  = null;

// --- ESCALA Y AUDIO ---
let sF      = 1;
let isMuted = localStorage.getItem('pizarraMuted') === 'true';

// --- HISTORIAL DE DESHACER / REHACER ---
let undoStack = [];
let redoStack = [];

// Guarda una "foto" mínima de cómo estaba todo justo antes de un cambio
// de modo de cancha (courtMode anterior + estado de las barras + historial
// de deshacer/rehacer), para poder revertir sin pérdidas si el cartel de
// "girá tu celular" se cancela. null cuando no hay ningún cambio de
// cancha pendiente de confirmar por rotación.
let estadoPrevioCambioCancha = null;

// ========================================================
// MODO "PIZARRA RÁPIDA" (acrílico digital de doble cara)
// ========================================================
// Dibujo libre a mano alzada, pensado para tiempos muertos. Convive con
// el Modo Táctico sin pisarlo: al activarse, las fichas/pelotas/utilería/
// pasos se invisibilizan (no se dibujan) pero sus datos (players, balls,
// props, etc. de arriba) quedan intactos en memoria, listos para cuando
// se vuelva a desactivar.
let modoPizarraRapida = false;

// Herramienta y estilo de trazo actualmente seleccionados. Negro por
// defecto: el blanco se confunde con las líneas de la cancha.
let colorTrazoActivo  = "#000000";
let grosorTrazoActivo = 5; // grosor único (medio), ya no es seleccionable
let herramientaActiva = 'pincel'; // 'pincel' | 'goma'

// Trazo que se está dibujando en este momento (mientras dura el
// mousedown/touchstart -> mouseup/touchend), o null si no hay ninguno activo.
let trazoActual    = null;
let dibujandoLibre = false;
let borrandoConGoma = false;

// Lienzos independientes por cara de cancha ("doble cara" del acrílico
// físico): los trazos de Cancha Completa y Media Cancha nunca se mezclan
// ni se convierten entre sí. Cada trazo: { color, grosor, puntos:[{x,y}] }.
// `deshechos` es la pila de "rehacer" de ESE lienzo en particular.
// `sF` guarda la escala (sF) del canvas a la que están calibrados los
// puntos de ESTA cara ahora mismo (null hasta que se dibuja o se
// reescala por primera vez): permite reubicar sus trazos proporcio-
// nalmente cuando esta cara vuelve a activarse con un tamaño de canvas
// distinto (resize de ventana mientras tanto, u otro tamaño de pantalla),
// sin depender de lo que le haya pasado a la OTRA cara mientras tanto.
let lienzosLibres = {
    full: { trazos: [], deshechos: [], sF: null },
    half: { trazos: [], deshechos: [], sF: null }
};

// --- PALETA DE COLORES POR PASO ---
const stepColors = ["#ffffff", "#38b000", "#00b4d8", "#ffb703", "#e040fb", "#ff5722"];

// --- IMAGEN DEL LOGO EN CANCHA ---
const logoCanchaImg = new Image();
logoCanchaImg.src   = "logocancha.svg";
logoCanchaImg.onload = () => { if (typeof draw === "function") draw(); };

// ========================================================
// AUTOGUARDADO / RESTAURACIÓN SILENCIOSA (nuevo en v143)
// ========================================================
// "Borrador de emergencia" en localStorage: si la app se cierra sin
// querer, se recibe una llamada, o se refresca la página, al reabrir
// se encuentra exactamente la última jugada en el estado en que había
// quedado, sin ningún cartel ni confirmación de por medio. No reemplaza
// a "Guardar/Cargar Jugada" (que sigue produciendo un archivo .json
// aparte, pensado para compartir): esto es automático y en segundo plano.
//
// CRÍTICO PARA LA FLUIDEZ (60 FPS): guardarBorradorSilencioso() NUNCA
// se llama durante el arrastre (pointermove/touchmove) ni mientras se
// dibuja un trazo en curso -eso rompería la fluidez-. Solo se invoca al
// FINALIZAR una acción concreta y puntual (soltar una ficha, terminar
// un trazo, agregar/borrar un paso, cambiar de modo de cancha, y otras
// acciones de un solo click: agregar/eliminar pelota o utilería,
// deshacer/rehacer, etc.). Ver los llamados a esta función en
// interaccion.js, ui.js y jugadores.js.
const AUTOSAVE_KEY = 'pizarra_borrador_actual';

// Arma el "paquete" a guardar. Reutiliza el mismo formato compacto que
// ya usa exportPlay() en ui.js (a/d/b/p/u/t/s/m) y le suma los campos
// propios del autoguardado (cs/ef/pl/lz/ct/ht) para poder reabrir
// exactamente en el mismo estado -incluida la Pizarra Rápida-, algo que
// un archivo .json exportado a mano no necesita guardar.
function serializarBorradorActual() {
    if (!courtMode || !canvas || canvas.width <= 0 || canvas.height <= 0) return null;
    return {
        a:  rs ? rs.value : 5,
        d:  bs ? bs.value : 0,
        b:  balls,
        p:  players,
        u:  props,
        t:  stepCount,
        s:  { w: canvas.width, h: canvas.height },
        m:  courtMode,
        cs: currentStep,
        ef: isEditionFinished,
        pl: modoPizarraRapida,
        lz: lienzosLibres,
        ct: colorTrazoActivo,
        ht: herramientaActiva
    };
}

function guardarBorradorSilencioso() {
    // No hay nada útil que guardar todavía mientras se está eligiendo el
    // modo de cancha o durante la pantalla de carga inicial.
    if (!cargaCompleta || !courtMode) return;
    try {
        const datos = serializarBorradorActual();
        if (!datos) return;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(datos));
    } catch (e) {
        // localStorage lleno, en modo privado, o no disponible: el
        // autoguardado es una mejora, no algo crítico. Fallamos en
        // silencio, sin interrumpir al usuario con ningún error.
    }
}

// Se dispara al presionar "Nueva Jugada" (o al confirmar el borrado):
// si no, al cerrar y reabrir la app después de vaciar la pizarra, el
// borrador viejo la volvería a llenar sola.
function borrarBorradorGuardado() {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* nada que hacer */ }
}

// --- LECTURA TEMPRANA DEL BORRADOR, PARA RESTAURACIÓN SILENCIOSA ---
// Se lee y valida ACÁ, apenas arranca estado.js (antes que cualquier
// otro módulo), para poder saltear directo la pantalla "ELEGÍ EL MODO
// DE CANCHA" si ya había una jugada en curso. `courtMode` y
// `lienzosLibres` se sobreescriben directamente en este mismo momento
// (antes de que exista ningún canvas todavía) porque init() -en
// cancha.js- necesita encontrarlos ya en su valor final para reescalar
// bien los trazos de Pizarra Rápida en el primer dibujo del canvas (ver
// el bloque "Reescala el lienzo libre de LA CARA ACTIVA..." en init()).
// El resto de los campos (fichas, pelota, utilería, paso actual, etc.)
// se aplican más tarde, ya con el canvas listo, a través del mismo
// mecanismo que usa "Cargar Jugada" (pendingImport + aplicarJugada-
// Importada(), ambos en ui.js) -ver checkOrientationForMode().
let borradorAlIniciar = null;
try {
    const crudoBorrador = localStorage.getItem(AUTOSAVE_KEY);
    if (crudoBorrador) {
        const datosBorrador = JSON.parse(crudoBorrador);
        if (datosBorrador && (datosBorrador.m === 'full' || datosBorrador.m === 'half') &&
            datosBorrador.s && datosBorrador.b && datosBorrador.p) {
            borradorAlIniciar = datosBorrador;
            courtMode = datosBorrador.m;
            if (datosBorrador.lz && datosBorrador.lz.full && datosBorrador.lz.half) {
                lienzosLibres = datosBorrador.lz;
            }
        }
    }
} catch (e) {
    // Borrador corrupto o localStorage no disponible: arrancamos normal,
    // con la pantalla de selección de modo de cancha de siempre.
    borradorAlIniciar = null;
}

// --- INICIALIZACIÓN DE SELECTORES ---
if (rs && bs) {
    for (let i = 0; i <= 5; i++) {
        rs.add(new Option('🔴 ' + i, i));
        bs.add(new Option('🔵 ' + i, i));
    }
    rs.value = 5;
    bs.value = 0;
}
