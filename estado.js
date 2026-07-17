// ========================================================
// PIZARRA OESTE - estado.js
// Variables globales y estado compartido de la aplicación.
// DEBE cargarse primero que todos los demás módulos.
// ========================================================

// --- REFERENCIAS AL DOM ---
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const wrap          = document.getElementById('canvas-wrap');
const statusLabel   = document.getElementById('status-box');
const floatingUI    = document.getElementById('floating-ui');
const rotBtn        = document.getElementById('rot-btn');
const timelineList  = document.getElementById('steps-list');
const addStepBtn    = document.getElementById('addStepBtn');
const historyToggle = document.getElementById('historyToggle');

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

// --- OBJETOS DEL JUEGO ---
// ball.portadorPorPaso[i] = ID del jugador que lleva la pelota en el paso i,
//                           o null si la pelota está suelta en ese paso.
// Esta estructura es la fuente de verdad para el imán, en lugar de imantadoA global.
let ball = {
    active:         true,
    team:           'ball',
    steps:          [[{ x: 0, y: 0, isScreen: false, angle: 0 }]],
    portadorPorPaso: [null]   // índice sincronizado con steps
};
let players = [];

// --- DRAG & DROP ---
let isDragging = false;
let activeObj  = null;

// --- CONTROL TÁCTICO (alias conveniente = portador en el paso actual) ---
// Se mantiene como propiedad derivada; la fuente de verdad es ball.portadorPorPaso
Object.defineProperty(window, 'imantadoA', {
    get() { return ball.portadorPorPaso[currentStep] ?? null; },
    set(v) { ball.portadorPorPaso[currentStep] = v; }
});

// --- ESCALA Y AUDIO ---
let sF      = 1;
let isMuted = localStorage.getItem('pizarraMuted') === 'true';

// --- HISTORIAL DE DESHACER / REHACER ---
let undoStack = [];
let redoStack = [];

// --- PALETA DE COLORES POR PASO ---
const stepColors = ["#ffffff", "#38b000", "#00b4d8", "#ffb703", "#e040fb", "#ff5722"];

// --- IMAGEN DEL LOGO EN CANCHA ---
const logoCanchaImg = new Image();
logoCanchaImg.src   = "logocancha.svg";
logoCanchaImg.onload = () => { if (typeof draw === "function") draw(); };

// --- INICIALIZACIÓN DE SELECTORES ---
if (rs && bs) {
    for (let i = 0; i <= 5; i++) {
        rs.add(new Option('🔴 ' + i, i));
        bs.add(new Option('🔵 ' + i, i));
    }
    rs.value = 5;
    bs.value = 0;
}
