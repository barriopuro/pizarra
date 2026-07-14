// ========================================================
// PIZARRA OESTE - ui.js
// Interfaz gráfica: selección de modo de cancha, control de
// orientación, timeline, pasos, solapas, pantalla de carga,
// reproducción, import/export JSON y video.
// Depende de: estado.js, cancha.js, jugadores.js, interaccion.js, audio.js
// ========================================================

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
    } else if (appWrapper) {
        appWrapper.style.display = 'none';
    }
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
}

function selectCourtMode(modo) {
    courtMode = modo; // 'full' | 'half'
    checkOrientationForMode();
}

function changeCourtMode() {
    if (confirm("¿Cambiar el modo de cancha? Se perderá la jugada actual.")) {
        location.reload();
    }
}

window.addEventListener('resize', checkOrientationForMode);
window.addEventListener('orientationchange', () => setTimeout(checkOrientationForMode, 60));

// --------------------------------------------------------
// ESTADO DEL PASO ACTIVO (status bar + bloqueos)
// --------------------------------------------------------

function updateStepUI() {
    if (!statusLabel) return;

    if (isEditionFinished) {
        statusLabel.innerText      = "REPRODUCCIÓN";
        statusLabel.style.borderColor = "#28a745";
        statusLabel.style.color       = "#28a745";
    } else {
        statusLabel.innerText      = currentStep === 0 ? "UBICACIÓN" : `PASO ${currentStep}`;
        statusLabel.style.borderColor = "#ff6600";
        statusLabel.style.color       = "#ff6600";
    }

    const delBtn = document.getElementById('delStepBtn');
    if (delBtn) delBtn.style.display = (currentStep > 0 && !isEditionFinished) ? "block" : "none";

    const esPasoInicial       = (currentStep === 0 && !isEditionFinished);
    const controlesBloqueables = [rs, bs, fs, document.getElementById('ballBtn')];
    controlesBloqueables.forEach(ctrl => {
        if (!ctrl) return;
        ctrl.disabled           = !esPasoInicial;
        ctrl.style.opacity      = esPasoInicial ? "1"    : "0.35";
        ctrl.style.pointerEvents = esPasoInicial ? "auto" : "none";
    });
}

// --------------------------------------------------------
// TIMELINE DE PASOS
// --------------------------------------------------------

function renderTimeline() {
    if (!timelineList) return;
    timelineList.innerHTML = '';

    ball.steps.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className  = `step-btn snd-btn ${i === currentStep ? 'active' : ''}`;
        btn.innerText  = i === 0 ? "INICIO" : `PASO ${i}`;
        btn.style.borderLeft = `4px solid ${stepColors[i % stepColors.length]}`;
        btn.onclick = () => {
            currentStep = i;
            updateStepUI();
            draw();
            renderTimeline();
            attachButtonSounds();
        };
        timelineList.appendChild(btn);
    });

    if (addStepBtn && !isEditionFinished) timelineList.appendChild(addStepBtn);

    const stepsCont = document.getElementById('steps-container');
    if (stepsCont) stepsCont.scrollTop = stepsCont.scrollHeight;
}

function addNewStep() {
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

    statusLabel.innerText         = "REPRODUCCIÓN";
    statusLabel.style.borderColor = "#28a745";
    statusLabel.style.color       = "#28a745";

    const spdSel = document.getElementById('speedSelect');
    if (spdSel) { spdSel.disabled = false; spdSel.style.opacity = "1"; spdSel.style.pointerEvents = "auto"; }

    verificarMenuFlotante();
    attachButtonSounds();
}

function backToEdit() {
    shouldStopLoop    = true;
    isLooping         = false;
    isPlaying         = false;
    isEditionFinished = false;

    const playBtn = document.getElementById('mainPlayBtn');
    if (playBtn) playBtn.innerText = "▶ PLAY";
    const mainLoopBtn = document.getElementById('mainLoopBtn');
    if (mainLoopBtn) mainLoopBtn.innerText = "🔄 LOOP";

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
        if (typeof updateFloatingUI === "function") updateFloatingUI();
    });
}

// --------------------------------------------------------
// REPRODUCCIÓN Y ANIMACIÓN
// --------------------------------------------------------

function togglePlay() {
    const playBtn = document.getElementById('mainPlayBtn');
    if (isPlaying) {
        shouldStopLoop = true;
        isLooping      = false;
        isPlaying      = false;
        if (playBtn) playBtn.innerText = "▶ PLAY";
        const mainLoopBtn = document.getElementById('mainLoopBtn');
        if (mainLoopBtn) mainLoopBtn.style.background = "#333";
        draw();
        return;
    }
    isPlaying = true;
    if (playBtn) playBtn.innerText = "⏹ STOP";
    playFullPlay(false);
}

async function playFullPlay(loopMode) {
    shouldStopLoop = false;
    const playBtn  = document.getElementById('mainPlayBtn');

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
    if (playBtn) playBtn.innerText = "▶ PLAY";
}

function toggleLoop() {
    isLooping = !isLooping;
    const mL  = document.getElementById('mainLoopBtn');
    if (mL) mL.style.background = isLooping ? "#ff6600" : "#333";
}

function changeSpeed() {
    const selector = document.getElementById('speedSelect');
    if (selector) factorVelocidad = parseFloat(selector.value);
}

// --------------------------------------------------------
// NUEVA JUGADA
// --------------------------------------------------------

function newPlay() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = "flex";
}

function confirmNewPlay() {
    currentStep       = 0;
    isEditionFinished = false;
    activeObj         = null;
    undoStack         = [];

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
    closeConfirmModal();
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.display = "none";
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
        const d  = JSON.parse(e.target.result);

        if (d.m && d.m !== courtMode) {
            alert("Esta jugada se guardó en modo " +
                (d.m === 'full' ? "CANCHA COMPLETA" : "MEDIA CANCHA") +
                ". Para verla correctamente, cargala estando en ese mismo modo.");
        }

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
        currentStep = 0;
        updateFormationOptions();
        renderTimeline();
        updateStepUI();
        draw();
        attachButtonSounds();
    };
    reader.readAsText(event.target.files[0]);
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

    const codecsAProbar = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    let mimeTypeElegido = '';
    for (const codec of codecsAProbar) {
        if (MediaRecorder.isTypeSupported(codec)) { mimeTypeElegido = codec; break; }
    }
    if (!mimeTypeElegido) {
        alert("Tu browser no soporta ningún formato de grabación estándar.");
        return;
    }

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
    try { recorder = new MediaRecorder(stream, { mimeType: mimeTypeElegido, videoBitsPerSecond: 4000000 }); }
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
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'jugada_oeste.mp4';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        currentStep = stepAntes; isLooping = loopingAntes;
        resetBtn(); draw(); renderTimeline();
    };

    recorder.start(100);
    shouldStopLoop = false;

    const velocidadOriginal = factorVelocidad;
    factorVelocidad = 1;

    for (let i = 0; i < ball.steps.length; i++) {
        currentStep = i;
        renderTimeline();

        if (i === 0) { draw(); await new Promise(r => setTimeout(r, 700)); continue; }

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
