// ========================================================
// PIZARRA OESTE v117.6 - PARTE 1 DE 5 (VARIABLES Y AUDIO)
// ========================================================

const canvas = document.getElementById('canvas'), 
      ctx = canvas.getContext('2d'), 
      wrap = document.getElementById('canvas-wrap'), 
      statusLabel = document.getElementById('status-box'), 
      floatingUI = document.getElementById('floating-ui'), 
      rotBtn = document.getElementById('rot-btn'), 
      txtBtn = document.getElementById('txt-btn'), 
      timelineList = document.getElementById('steps-list'), 
      addStepBtn = document.getElementById('addStepBtn'), 
      historyToggle = document.getElementById('historyToggle');

let currentStep = 0, 
    isLooping = false, 
    shouldStopLoop = false, 
    ball = { active: true, team: 'ball', steps: [[{x:0, y:0, isScreen:false, angle:0}]] }, 
    players = [], 
    isDragging = false, 
    activeObj = null, 
    isEditionFinished = false;

let sF = 1, 
    isMuted = localStorage.getItem('pizarraMuted') === 'true';

const stepColors = ["#ffffff", "#38b000", "#00b4d8", "#ffb703", "#e040fb", "#ff5722"];
let audioCtx = null;

function initAudio() { 
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
}

function playSound(type) {
    if (isMuted) return;
    initAudio(); 
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'grabJersey') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.70, now); gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
        osc.start(now); osc.stop(now + 0.06);
    } else if (type === 'dropJersey') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(460, now); osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
        gain.gain.setValueAtTime(0.50, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'bounceBall') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(170, now); osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);
        gain.gain.setValueAtTime(0.85, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now); osc.stop(now + 0.06);
    } else if (type === 'btnHover') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.12, now); gain.gain.linearRampToValueAtTime(0.0001, now + 0.015);
        osc.start(now); osc.stop(now + 0.015);
    } else if (type === 'btnClick') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(340, now);
        gain.gain.setValueAtTime(0.55, now); gain.gain.linearRampToValueAtTime(0.001, now + 0.035);
        osc.start(now); osc.stop(now + 0.035);
    }
}
// --- SECUENCIA DE PANTALLA DE CARGA ---
function startLoadingSequence() {
    const bar = document.getElementById('loading-bar'), 
          container = document.getElementById('logo-container'), 
          screen = document.getElementById('loading-screen'), 
          percentTxt = document.getElementById('loading-percentage');
          
    setTimeout(() => { 
        if(bar) bar.style.width = "100%"; 
        if(container) container.classList.add('loaded'); 
    }, 100);

    let currentPercent = 0;
    const interval = setInterval(() => {
        currentPercent += 2;
        if (currentPercent <= 100) { 
            if(percentTxt) percentTxt.innerText = currentPercent + "%"; 
        } else { 
            clearInterval(interval); 
        }
    }, 35);

    setTimeout(() => { 
        if(screen) { 
            screen.style.opacity = "0"; 
            screen.style.transform = "scale(1.03)"; 
            setTimeout(() => screen.style.display = "none", 500); 
        } 
    }, 2400);
}

const rs = document.getElementById('countRed'), 
      bs = document.getElementById('countBlue'), 
      fs = document.getElementById('formationSelect');

if(rs && bs) {
    for(let i=0; i<=5; i++) { 
        rs.add(new Option('ATAC: ' + i, i)); 
        bs.add(new Option('DEF: ' + i, i)); 
    }
    rs.value = 5; 
    bs.value = 0;
}
// --- RE-ESCALADO PROPORCIONAL Y CONTROL DE ENTORNO ---
function init() {
    const container = document.getElementById('canvas-wrap-outer');
    if(!container) return; 
    
    const oldSF = sF;

    let availableW = container.clientWidth - 10, availableH = container.clientHeight - 10;
    let finalW = availableW, finalH = availableW / 1.45;
    if (finalH > availableH) { finalH = availableH; finalW = finalH * 1.45; }
    
    wrap.style.width = finalW + "px"; wrap.style.height = finalH + "px";
    canvas.width = finalW; canvas.height = finalH;
    
    sF = finalW / 500;
    const scaleMultiplier = sF / oldSF;

    // 1. Re-ubicación de la pelota (Trayectorias y animación)
    if (ball && ball.steps) {
        ball.steps.forEach(stepPath => {
            stepPath.forEach(pt => {
                if (oldSF !== 1 && scaleMultiplier !== 1) {
                    pt.x *= scaleMultiplier;
                    pt.y *= scaleMultiplier;
                }
            });
        });
        if (oldSF !== 1 && scaleMultiplier !== 1) {
            if (ball.ax !== undefined) ball.ax *= scaleMultiplier;
            if (ball.ay !== undefined) ball.ay *= scaleMultiplier;
        }
    }

    // 2. Re-ubicación de los jugadores (Trayectorias y animación)
    if (players && players.length > 0) {
        players.forEach(pl => {
            if (pl.steps) {
                pl.steps.forEach(stepPath => {
                    stepPath.forEach(pt => {
                        if (oldSF !== 1 && scaleMultiplier !== 1) {
                            pt.x *= scaleMultiplier;
                            pt.y *= scaleMultiplier;
                        }
                    });
                });
            }
            if (oldSF !== 1 && scaleMultiplier !== 1) {
                if (pl.ax !== undefined) pl.ax *= scaleMultiplier;
                if (pl.ay !== undefined) pl.ay *= scaleMultiplier;
            }
        });
    }

    updateCourtDrawing(finalW, finalH);
    updateMuteBtnUI();
    
    if(ball.steps[0][0].x === 0) ball.steps[0] = [{x: finalW/2, y: finalH * 0.45, isScreen:false, angle:0}];
    if(players.length === 0) syncPlayers();
    
    updateFormationOptions(); 
    renderTimeline(); 
    updateStepUI(); 
    draw(); 
    attachButtonSounds();
}

// --- DIBUJADO DE LÍNEAS RE-ESCALABLES (SVG) ---
function updateCourtDrawing(w, h) {
    const pW = w * 0.33, radiusLibre = pW / 2, pH = h * 0.52;                 
    const sX = w * 0.06, tR = (w / 2) - sX, stH = pH + radiusLibre - tR;   
    document.getElementById('paint').setAttribute('x', (w - pW) / 2); 
    document.getElementById('paint').setAttribute('width', pW); document.getElementById('paint').setAttribute('height', pH);
    const startX = (w - pW) / 2, endX = (w + pW) / 2;
    document.getElementById('key-markers').setAttribute('d', `
        M ${startX} ${pH * 0.35} L ${startX - 8} ${pH * 0.35} M ${startX} ${pH * 0.55} L ${startX - 8} ${pH * 0.55} M ${startX} ${pH * 0.75} L ${startX - 8} ${pH * 0.75}
        M ${endX} ${pH * 0.35} L ${endX + 8} ${pH * 0.35} M ${endX} ${pH * 0.55} L ${endX + 8} ${pH * 0.55} M ${endX} ${pH * 0.75} L ${endX + 8} ${pH * 0.75}
    `);
    document.getElementById('free-throw').setAttribute('d', `M ${(w/2) - radiusLibre} ${pH} A ${radiusLibre} ${radiusLibre} 0 0 0 ${(w/2) + radiusLibre} ${pH}`);
    document.getElementById('free-throw-dashed').setAttribute('d', `M ${(w/2) - radiusLibre} ${pH} A ${radiusLibre} ${radiusLibre} 0 0 1 ${(w/2) + radiusLibre} ${pH}`);
    document.getElementById('triple').setAttribute('d', `M ${sX} 0 L ${sX} ${stH} A ${tR} ${tR} 0 0 0 ${w - sX} ${stH} L ${w - sX} 0`);
    const boardY = 25 * sF, rimY = 42 * sF, boardW = 65 * sF, rimRadius = 11 * sF;
    document.getElementById('backboard').setAttribute('x1', (w / 2) - (boardW / 2)); document.getElementById('backboard').setAttribute('y1', boardY);
    document.getElementById('backboard').setAttribute('x2', (w / 2) + (boardW / 2)); document.getElementById('backboard').setAttribute('y2', boardY);
    document.getElementById('rim').setAttribute('cx', w/2); document.getElementById('rim').setAttribute('cy', rimY); document.getElementById('rim').setAttribute('r', rimRadius);
}

// --- TEXTURA DEL PARQUET ---
function drawParquetTexture() {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)"; ctx.lineWidth = 1 * sF; const plankWidth = 16 * sF;
    for (let x = 0; x < canvas.width; x += plankWidth) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        for (let y = (x % 3) * 20 * sF; y < canvas.height; y += 80 * sF) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + plankWidth, y); ctx.stroke();
        }
    }
}

// --- CREACIÓN Y SINCRONIZACIÓN DE CAMISETAS ---
function drawJersey(color, radius, label) {
    ctx.fillStyle = color; const w = radius * 1.1, h = radius * 1.35;
    ctx.beginPath(); ctx.moveTo(-w * 0.7, -h); ctx.lineTo(-w * 0.4, -h);
    ctx.bezierCurveTo(-w * 0.2, -h + 4 * sF, w * 0.2, -h + 4 * sF, w * 0.4, -h);
    ctx.lineTo(w * 0.7, -h); ctx.bezierCurveTo(w * 0.55, -h + h * 0.2, w * 0.55, -h + h * 0.4, w * 0.7, -h + h * 0.5);
    ctx.lineTo(w * 0.7, h); ctx.lineTo(-w * 0.7, h); ctx.lineTo(-w * 0.7, -h + h * 0.5);
    ctx.bezierCurveTo(-w * 0.55, -h + h * 0.4, -w * 0.55, -h + h * 0.2, -w * 0.7, -h);
    ctx.closePath(); ctx.fill();
    if(label) { ctx.fillStyle = "white"; ctx.font = `bold ${radius * 0.95}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, 0, h * 0.1); }
}

function updateFormationOptions() {
    if(!rs || !fs) return;
    const n = parseInt(rs.value); fs.innerHTML = '<option value="custom">-- FORMACIÓN --</option>';
    if(n === 0) return;
    for(let i = n; i >= 0; i--) { fs.add(new Option(`${i} INT / ${n-i} EXT`, `${i}-${n-i}`)); }
}

function syncPlayers() {
    if(!rs || !bs) return;
    const rCount = parseInt(rs.value), bCount = parseInt(bs.value);
    const savedLabels = JSON.parse(localStorage.getItem('pizarraLabels') || '{"red":[], "blue":[]}');
    const radius = 15 * sF; 
    
    const updateTeam = (team, count, x) => {
        let teamList = players.filter(p => p.team === team);
        if(teamList.length > count) players = players.filter(p => !(p.team === team && teamList.indexOf(p) >= count));
        else for(let i=teamList.length; i<count; i++) {
            let s = []; 
            let tx = x * sF;
            let ty = (50 + i * (radius * 2.8));
            
            // Si es el equipo rojo (atacantes), los distribuimos en el arco de 3 puntos de entrada (5 exteriores)
            if (team === 'red') {
                const w = canvas.width, h = canvas.height;
                const posicionesExteriores = [
                    { x: w * 0.12, y: h * 0.38 }, // Esquina izquierda
                    { x: w * 0.22, y: h * 0.70 }, // Alero izquierdo
                    { x: w * 0.50, y: h * 0.82 }, // Base / Central
                    { x: w * 0.78, y: h * 0.70 }, // Alero derecho
                    { x: w * 0.88, y: h * 0.38 }  // Esquina derecha
                ];
                if (posicionesExteriores[i]) {
                    tx = posicionesExteriores[i].x;
                    ty = posicionesExteriores[i].y;
                }
            }
            
            if(team === 'blue' && players.filter(p=>p.team==='red')[i]) { 
                tx = players.filter(p=>p.team==='red')[i].steps[0][0].x + (25*sF); 
                ty = players.filter(p=>p.team==='red')[i].steps[0][0].y; 
            }
            for(let j=0; j<=currentStep; j++) s.push([{x:tx, y:ty, isScreen:false, angle:0}]);
            players.push({team: team, steps: s, label: savedLabels[team][i] || ''});
        }
    };
    updateTeam('red', rCount, 40); updateTeam('blue', bCount, 460);
    updateFormationOptions(); draw(); attachButtonSounds();
}

function saveLabels() {
    const labels = { red: players.filter(p=>p.team==='red').map(p=>p.label), blue: players.filter(p=>p.team==='blue').map(p=>p.label) };
    localStorage.setItem('pizarraLabels', JSON.stringify(labels));
}

function applyFormation() {
    if(currentStep !== 0 || fs.value === "custom") return;
    const [ic, ec] = fs.value.split('-').map(Number);
    const w = canvas.width, h = canvas.height, redP = players.filter(p => p.team === 'red'), blueP = players.filter(p => p.team === 'blue');
    let fP = [];
    const iL = [{x:w*0.35,y:h*0.28}, {x:w*0.65,y:h*0.28}, {x:w*0.35,y:h*0.48}, {x:w*0.65,y:h*0.48}, {x:w*0.5,y:h*0.22}];
    const eL = [{x:w*0.12,y:h*0.38}, {x:w*0.88,y:h*0.38}, {x:w*0.22,y:h*0.70}, {x:w*0.78,y:h*0.70}, {x:w*0.5,y:h*0.82}];
    if(ic===1)fP.push(iL[4]);else if(ic===2)fP.push(iL[0],iL[1]);else if(ic===3)fP.push(iL[0],iL[1],iL[4]);else if(ic===4)fP.push(iL[0],iL[1],iL[2],iL[3]);else if(ic===5)fP.push(...iL);
    if(ec===1)fP.push(eL[4]);else if(ec===2)fP.push(eL[0],eL[1]);else if(ec===3)fP.push(eL[0],eL[1],eL[4]);else if(ec===4)fP.push(eL[0],eL[1],eL[2],eL[3]);else if(ec===5)fP.push(...eL);
    redP.forEach((p,i)=>{ if(fP[i]){ p.steps[0][0]={x:fP[i].x,y:fP[i].y,isScreen:false,angle:0}; if(blueP[i]) blueP[i].steps[0][0]={x:fP[i].x+(25*sF),y:fP[i].y,isScreen:false,angle:0}; } });
    draw();
}

// --- MENÚ FLOTANTE DE ACCIONES ---
function toggleCurrentPlayerScreen() { if(!activeObj || activeObj === ball) return; const pt = activeObj.steps[currentStep][activeObj.steps[currentStep].length-1]; pt.isScreen = !pt.isScreen; if(!pt.isScreen) pt.angle = 0; draw(); updateFloatingUI(); }
function rotateCurrentPlayer() { if(!activeObj || activeObj === ball) return; const pt = activeObj.steps[currentStep][activeObj.steps[currentStep].length-1]; if(!pt.isScreen) return; pt.angle = (pt.angle + 45) % 360; draw(); }
function labelCurrentPlayer() { if(!activeObj || activeObj === ball) return; let val = prompt("ID (Máx 2 car.):", activeObj.label || ""); if(val !== null) { activeObj.label = val.substring(0, 2).toUpperCase(); saveLabels(); draw(); } }

function updateFloatingUI() {
    if(!activeObj || activeObj === ball || isEditionFinished) { floatingUI.style.display = "none"; return; }
    const last = activeObj.steps[currentStep][activeObj.steps[currentStep].length - 1];
    floatingUI.style.left = Math.max(10, Math.min(canvas.width - 110, (last.x - 50))) + "px"; floatingUI.style.top = (last.y - 65) + "px";
    floatingUI.style.display = "flex";
    rotBtn.style.display = last.isScreen ? "flex" : "none"; txtBtn.style.display = (currentStep === 0) ? "flex" : "none";
}

// --- MOTOR DRAG & DROP MULTI-DISPOSITIVO ---
function handleStart(e) {
    if(isEditionFinished) return;
    const pos = getPos(e); let found = null; let minDistance = 35 * sF;
    const all = ball.active ? [...players, ball] : [...players];
    all.forEach(obj => {
        const last = obj.steps[currentStep][obj.steps[currentStep].length-1];
        const dist = Math.hypot(last.x - pos.x, last.y - pos.y);
        if(dist < minDistance) { minDistance = dist; found = obj; }
    });
    if(found) { 
        activeObj = found; isDragging = true; 
        if(currentStep > 0 && (!activeObj.steps[currentStep] || activeObj.steps[currentStep].length <= 1)) {
            const lastPrev = activeObj.steps[currentStep - 1][activeObj.steps[currentStep - 1].length - 1];
            activeObj.steps[currentStep] = [{x: lastPrev.x, y: lastPrev.y, isScreen: lastPrev.isScreen, angle: lastPrev.angle}]; 
        }
        updateFloatingUI();
        if (activeObj === ball) playSound('bounceBall'); else playSound('grabJersey');
    } else { activeObj = null; updateFloatingUI(); }
    draw();
}

function handleMove(e) {
    if(!isDragging || !activeObj) return; e.preventDefault();
    const pos = getPos(e); const path = activeObj.steps[currentStep], last = path[path.length-1];
    
    if(currentStep === 0) {
        // En el paso inicial (Ubicación) movemos la ficha directo sin restricciones
        path[0] = {x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle};
    } else {
        // Filtro para el Paso 1 en adelante: calculamos la distancia con el último punto guardado
        const distanciaSurgida = Math.hypot(pos.x - last.x, pos.y - last.y);
        
        // Solo guardamos la coordenada si se movió más de 12 píxeles (limpia el temblequeo pero respeta giros)
        if (distanciaSurgida > 12 * sF) {
            path.push({x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle});
        }
    }
    draw(); updateFloatingUI();
}
function handleEnd() {
    if (isDragging && activeObj) { if (activeObj === ball) playSound('bounceBall'); else playSound('dropJersey'); }
    isDragging = false; draw();
}

const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX, clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
};

canvas.addEventListener('mousedown', handleStart); canvas.addEventListener('touchstart', (e) => { handleStart(e); }, {passive: false});
window.addEventListener('mousemove', handleMove); window.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('mouseup', handleEnd); window.addEventListener('touchend', handleEnd);

// --- PASOS DE LA LÍNEA DE TIEMPO ---
function addNewStep() {
    [...players, ball].forEach(p => { const last = p.steps[currentStep][p.steps[currentStep].length - 1]; p.steps.push([{x: last.x, y: last.y, isScreen: last.isScreen, angle: last.angle}]); });
    currentStep++; updateStepUI(); renderTimeline(); draw(); attachButtonSounds();
}

function deleteLastStep() {
    if(currentStep === 0) return;
    [...players, ball].forEach(p => p.steps.pop());
    currentStep--; updateStepUI(); renderTimeline(); draw(); attachButtonSounds();
}

function newPlay() { if(confirm("¿Borrar jugada actual y crear una de cero?")) location.reload(); }

function renderTimeline() {
    if(!timelineList) return;
    timelineList.innerHTML = '';
    ball.steps.forEach((_, i) => {
        const btn = document.createElement('button'); btn.className = `step-btn snd-btn ${i === currentStep ? 'active' : ''}`;
        btn.innerText = i === 0 ? "INICIO" : `PASO ${i}`; btn.style.borderLeft = `4px solid ${stepColors[i % stepColors.length]}`;
        btn.onclick = () => { currentStep = i; updateStepUI(); draw(); renderTimeline(); attachButtonSounds(); };
        timelineList.appendChild(btn);
    });
   if(addStepBtn && !isEditionFinished) timelineList.appendChild(addStepBtn); 
    
    const stepsCont = document.getElementById('steps-container');
    if(stepsCont) stepsCont.scrollTop = stepsCont.scrollHeight;
}

// --- MOTOR DE ANIMACIÓN INTERPOLADO (PLAY) ---
async function playFullPlay(loopMode) {
    shouldStopLoop = false;
    do {
        for(let i=0; i < ball.steps.length; i++) {
            if(shouldStopLoop) break; currentStep = i; renderTimeline();
            if(i === 0) { draw(); await new Promise(r => setTimeout(r, 600)); continue; }
            await new Promise(res => {
                let totalFrames = 240, f = 0;
                function frame() {
                    if(shouldStopLoop) return res();
                    let t = f / totalFrames; let ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                    [...players, ball].forEach(p => { 
                        if(p.steps[i]) { 
                            const s = p.steps[i]; if(s.length === 0) return;
                            // INTERPOLACIÓN LINEAL SUAVE (LERP) RECALIBRADA
                            const progresoFlotante = ease * (s.length - 1);
                            const indiceBase = Math.floor(progresoFlotante);
                            const indiceSiguiente = Math.min(s.length - 1, indiceBase + 1);
                            const factorInterpolacion = progresoFlotante - indiceBase;
                            
                            const ptoA = s[indiceBase];
                            const ptoB = s[indiceSiguiente];
                            
                            // Deslizamiento continuo entre puntos para eliminar la rigidez
                            p.ax = ptoA.x + (ptoB.x - ptoA.x) * factorInterpolacion;
                            p.ay = ptoA.y + (ptoB.y - ptoA.y) * factorInterpolacion;
                            const startPt = s[0], endPt = s[s.length - 1];
                            const seMueve = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y) > 2;
                            if (seMueve) { if (f < totalFrames) { p.as = false; p.aa = 0; } else { p.as = endPt.isScreen; p.aa = endPt.angle; } } 
                            else { p.as = endPt.isScreen; p.aa = endPt.angle; }
                        } 
                    });
                    renderAnim(); f++; if(f <= totalFrames) requestAnimationFrame(frame); else res();
                }
                frame();
            });
            if(!shouldStopLoop) await new Promise(r => setTimeout(r, 350));
        }
    } while (isLooping && !shouldStopLoop);
}

// --- CONTROLES DE ARCHIVOS EXPORTAR / IMPORTAR ---
function exportPlay() {
    const d = { a: rs.value, d: bs.value, b: ball, p: players, s: { w: canvas.width, h: canvas.height } };
    const blob = new Blob([JSON.stringify(d)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `pizarra_oeste.json`; a.click();
}

function importPlay(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const d = JSON.parse(e.target.result); rs.value = d.a; bs.value = d.d;
        const sX = canvas.width / d.s.w, sY = canvas.height / d.s.h;
        ball = d.b; ball.steps.forEach(s => s.forEach(p => { p.x *= sX; p.y *= sY; }));
        players = d.p; players.forEach(pl => { pl.steps.forEach(s => s.forEach(p => { p.x *= sX; p.y *= sY; })); if(!pl.label) pl.label = ''; });
        currentStep = 0; updateFormationOptions(); renderTimeline(); updateStepUI(); draw(); attachButtonSounds();
    };
    reader.readAsText(event.target.files[0]);
}

// --- CONSOLIDACIÓN DE CONTROLES DE INTERFAZ GRÁFICA ---
function finishEdition() {
    isEditionFinished = true; activeObj = null; if (typeof updateFloatingUI === "function") updateFloatingUI();
    document.getElementById('playback-controls').style.display = "flex"; 
    document.getElementById('edit-controls').style.display = "none";
    if(addStepBtn) addStepBtn.style.display = "none"; 
    statusLabel.innerText = "REPRODUCCIÓN"; statusLabel.style.borderColor = "#28a745"; statusLabel.style.color = "#28a745";
    verificarMenuFlotante(); attachButtonSounds();
}

window.onload = () => { init(); startLoadingSequence(); };

// ========================================================
// NUEVO SISTEMA DE SOLAPAS Y HARDWARE CALIBRADO (v117.5)
// ========================================================
function verificarMenuFlotante() {
    const derEscondido = document.getElementById('col-linea-tiempo-container').classList.contains('colapsado');
    const menuFlotante = document.getElementById('fullscreen-floating-menu');
    if (menuFlotante) {
        if (isEditionFinished && derEscondido) menuFlotante.style.display = "flex";
        else menuFlotante.style.display = "none";
    }
}

function toggleSidebar(lado) {
    const contenedor = document.getElementById(lado === 'izq' ? 'col-izquierda-container' : 'col-linea-tiempo-container');
    const boton = document.getElementById(lado === 'izq' ? 'solapa-izq' : 'solapa-der');
    if (!contenedor || !boton) return;
    
    contenedor.classList.toggle('colapsado');
    if (lado === 'izq') boton.innerText = contenedor.classList.contains('colapsado') ? "▶" : "◀";
    else boton.innerText = contenedor.classList.contains('colapsado') ? "◀" : "▶";
    
    verificarMenuFlotante();
    if (typeof init === "function") init();
    setTimeout(() => { if (typeof init === "function") init(); }, 100);
    setTimeout(() => { if (typeof init === "function") init(); }, 200);
    setTimeout(() => { if (typeof init === "function") init(); }, 360); 
    setTimeout(() => { if (typeof init === "function") init(); }, 550); 
}

function toggleRealFullscreen() {
    const btn = document.getElementById('realFsBtn');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
            .then(() => {
                if (btn) btn.innerText = "❌";
                setTimeout(() => { if (typeof init === "function") init(); }, 150);
                setTimeout(() => { if (typeof init === "function") init(); }, 450);
            })
            .catch(err => console.log(`Error de hardware full screen: ${err.message}`));
    } else {
        document.exitFullscreen().then(() => {
            if (btn) btn.innerText = "⤢";
            setTimeout(() => { if (typeof init === "function") init(); }, 150);
            setTimeout(() => { if (typeof init === "function") init(); }, 450);
        });
    }
}

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('realFsBtn');
    if (btn) btn.innerText = document.fullscreenElement ? "❌" : "⤢";
    setTimeout(() => { if (typeof init === "function") init(); }, 150);
    setTimeout(() => { if (typeof init === "function") init(); }, 500);
});

window.addEventListener('resize', () => {
    if (typeof init === "function") init();
    setTimeout(() => { if (typeof init === "function") init(); }, 200);
});

function backToEdit() {
    shouldStopLoop = true; isLooping = false; 
    const mainLoopBtn = document.getElementById('mainLoopBtn');
    if (mainLoopBtn) mainLoopBtn.innerText = "🔄 LOOP";
    isEditionFinished = false; 
    document.getElementById('playback-controls').style.display = "none"; 
    document.getElementById('edit-controls').style.display = "flex";
    if (addStepBtn) addStepBtn.style.display = "block"; 
    verificarMenuFlotante(); updateStepUI(); draw(); renderTimeline(); 
    if (typeof attachButtonSounds === "function") attachButtonSounds();
}

function toggleFullscreenPlay(goFS) {
    if(goFS) {
        isEditionFinished = true;
        document.getElementById('edit-controls').style.display = "none";
        document.getElementById('playback-controls').style.display = "flex";
        if(addStepBtn) addStepBtn.style.display = "none";
    } else {
        backToEdit();
    }
    verificarMenuFlotante();
    if (typeof init === "function") init();
    setTimeout(() => { if (typeof init === "function") init(); }, 100);
}

const loaderTarget = document.getElementById('loading-screen');
if (loaderTarget) {
    const observer = new MutationObserver(() => {
        if (loaderTarget.style.display === 'none' || loaderTarget.style.opacity === '0') {
            const sIzq = document.getElementById('solapa-izq'), sDer = document.getElementById('solapa-der');
            if (sIzq) sIzq.classList.add('solapa-activa');
            if (sDer) sDer.classList.add('solapa-activa');
            if (typeof init === "function") init();
            observer.disconnect(); 
        }
    });
    observer.observe(loaderTarget, { attributes: true, attributeFilter: ['style'] });
}

// --- FUNCIONES INTERNAS DE CONTROL GRÁFICO Y UI ---
function updateStepUI() {
    if(!statusLabel) return;
    if(isEditionFinished) {
        statusLabel.innerText = "REPRODUCCIÓN";
        statusLabel.style.borderColor = "#28a745";
        statusLabel.style.color = "#28a745";
    } else {
        statusLabel.innerText = currentStep === 0 ? "UBICACIÓN" : `PASO ${currentStep}`;
        statusLabel.style.borderColor = "#ff6600";
        statusLabel.style.color = "#ff6600";
    }
    const delBtn = document.getElementById('delStepBtn');
    if(delBtn) delBtn.style.display = (currentStep > 0 && !isEditionFinished) ? "block" : "none";

    // CONTROL DE BLOQUEO DE CONTROLES FUERA DEL PASO 0
    const esPasoInicial = (currentStep === 0 && !isEditionFinished);
    const controlesBloqueables = [rs, bs, fs, document.getElementById('ballBtn')];
    
    controlesBloqueables.forEach(control => {
        if(control) {
            control.disabled = !esPasoInicial;
            control.style.opacity = esPasoInicial ? "1" : "0.35";
            control.style.pointerEvents = esPasoInicial ? "auto" : "none";
        }
    });
}
function renderAnim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawParquetTexture();
    
    if (logoCanchaImg.complete && logoCanchaImg.naturalWidth !== 0) {
        ctx.save();
        const anchoDeseado = 95 * sF, proporcion = logoCanchaImg.naturalHeight / logoCanchaImg.naturalWidth;
        const altoCalculado = anchoDeseado * proporcion;
        ctx.translate(canvas.width / 2, canvas.height * 0.52);
        ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'brightness(0.3) contrast(1.2)'; ctx.globalAlpha = 0.35; 
        ctx.drawImage(logoCanchaImg, -anchoDeseado / 2, -altoCalculado / 2, anchoDeseado, altoCalculado);
        ctx.restore();
    }

    const radius = 15 * sF, showHistory = historyToggle.checked;

    if (showHistory) {
        ctx.save();
        for (let stepIdx = 0; stepIdx <= currentStep; stepIdx++) {
            const colorTactico = stepColors[stepIdx % stepColors.length];
            const esPasoActual = (stepIdx === currentStep);
            ctx.globalAlpha = esPasoActual ? 1.0 : 0.22;

            [...players, ball].forEach(p => {
                if (p === ball && !ball.active) return;
                const path = p.steps[stepIdx]; if (!path || path.length === 0) return;
                
                if (stepIdx > 0 && path.length > 1) {
                    ctx.beginPath(); 
                    ctx.strokeStyle = colorTactico; 
                    ctx.lineWidth = esPasoActual ? (3.5 * sF) : (2 * sF);
                    if (p === ball) ctx.setLineDash(esPasoActual ? [5, 5] : [4, 4]);
                    
                    ctx.moveTo(path[0].x, path[0].y);
                    for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
                    ctx.stroke(); 
                    ctx.setLineDash([]);
                }
            });
        }
        ctx.restore();
    }

    [...players, ball].forEach(p => {
        if(p === ball && !ball.active) return;
        ctx.save();
        const posX = p.ax !== undefined ? p.ax : p.steps[currentStep][p.steps[currentStep].length-1].x;
        const posY = p.ay !== undefined ? p.ay : p.steps[currentStep][p.steps[currentStep].length-1].y;
        ctx.translate(posX, posY);
        if(p === ball) {
            ctx.font = `${radius * 1.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏀", 0, 0);
        } else {
            if(p.as) {
                ctx.rotate(p.aa * Math.PI / 180); ctx.fillStyle = (p.team === 'red' ? '#CC0000' : '#0044CC');
                ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8); ctx.strokeStyle="#fff"; ctx.lineWidth=2*sF; ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                if(p.label) { ctx.rotate(-p.aa * Math.PI / 180); ctx.fillStyle = "white"; ctx.font = `bold ${radius * 0.8}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.label, 0, 1); }
            } else {
                drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', radius, p.label);
            }
        }
        ctx.restore();
    });
}
function toggleBall() { ball.active = !ball.active; draw(); const bBtn = document.getElementById('ballBtn'); if(bBtn) bBtn.style.background = ball.active ? "#333" : "#111"; }
function toggleLoop() { isLooping = !isLooping; const mL = document.getElementById('mainLoopBtn'); if(mL) mL.style.background = isLooping ? "#ff6600" : "#17a2b8"; }
function toggleMute() { isMuted = !isMuted; localStorage.setItem('pizarraMuted', isMuted); updateMuteBtnUI(); }
function updateMuteBtnUI() { const mB = document.getElementById('muteBtn'); if(mB) { if(isMuted) { mB.innerText = "🔇"; mB.classList.add('muted'); } else { mB.innerText = "🔊"; mB.classList.remove('muted'); } } }

function attachButtonSounds() {
    document.querySelectorAll('.snd-btn').forEach(btn => {
        if(btn.dataset.sndBound) return;
        btn.dataset.sndBound = "true";
        btn.addEventListener('mouseenter', () => playSound('btnHover'));
        btn.addEventListener('click', () => playSound('btnClick'));
    });
}

// Carga asincrónica del escudo central para el parqué
const logoCanchaImg = new Image();
logoCanchaImg.src = "logocancha.svg";
logoCanchaImg.onload = () => { draw(); };

// --- FUNCIÓN DE DIBUJADO PRINCIPAL (CANVAS) ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    drawParquetTexture();
    
    // Renderizado del escudo de Casanova
    if (logoCanchaImg.complete && logoCanchaImg.naturalWidth !== 0) {
        ctx.save();
        const anchoDeseado = 95 * sF, proporcion = logoCanchaImg.naturalHeight / logoCanchaImg.naturalWidth;
        const altoCalculado = anchoDeseado * proporcion;
        ctx.translate(canvas.width / 2, canvas.height * 0.52);
        ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'brightness(0.3) contrast(1.2)'; ctx.globalAlpha = 0.35; 
        ctx.drawImage(logoCanchaImg, -anchoDeseado / 2, -altoCalculado / 2, anchoDeseado, altoCalculado);
        ctx.restore();
    }

    const radius = 15 * sF, showHistory = historyToggle.checked;
    
    // Renderizado del historial translúcido
    if(showHistory && currentStep > 0) {
        ctx.save(); ctx.globalAlpha = 0.22;
        for (let stepIdx = 0; stepIdx < currentStep; stepIdx++) {
            const colorTactico = stepColors[stepIdx % stepColors.length];
            [...players, ball].forEach(p => {
                if(p === ball && !ball.active) return;
                const path = p.steps[stepIdx]; if(!path || path.length === 0) return;
                const last = path[path.length - 1];
                if(stepIdx > 0 && path.length > 1) {
                    ctx.beginPath(); ctx.strokeStyle = colorTactico; ctx.lineWidth = 2 * sF;
                    if(p === ball) ctx.setLineDash([4, 4]);
                    ctx.moveTo(path[0].x, path[0].y); for(let j=1; j<path.length; j++) ctx.lineTo(path[j].x, path[j].y);
                    ctx.stroke(); ctx.setLineDash([]);
                }
                ctx.save(); ctx.translate(last.x, last.y);
                if(p === ball) { ctx.font = `${radius * 1.3}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏀", 0, 0); } 
                else {
                    if(last.isScreen) {
                        ctx.rotate(last.angle * Math.PI / 180); ctx.fillStyle = (p.team === 'red' ? '#CC0000' : '#0044CC');
                        ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8); ctx.strokeStyle="#fff"; ctx.lineWidth = 2*sF; ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                    } else { drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', radius, p.label); }
                }
                ctx.restore();
            });
        }
        ctx.restore();
    }

    // Renderizado del paso activo
    const activeColor = stepColors[currentStep % stepColors.length];
    [...players, ball].forEach(p => {
        if(p === ball && !ball.active) return;
        const path = p.steps[currentStep]; if (!path || path.length === 0) return;
        const last = path[path.length - 1];
        if(activeObj === p) {
            ctx.save(); ctx.beginPath(); ctx.arc(last.x, last.y, (p === ball ? radius * 1.15 : radius * 1.6), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"; ctx.lineWidth = 3*sF; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.restore();
        }
        if(currentStep > 0 && path.length > 1) {
            ctx.beginPath(); ctx.strokeStyle = activeColor; ctx.lineWidth = 3.5 * sF;
            if(p === ball) ctx.setLineDash([5, 5]);
            ctx.moveTo(path[0].x, path[0].y); for(let k=1; k<path.length; k++) { ctx.lineTo(path[k].x, path[k].y); }
            ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(last.x, last.y);
        if(p === ball) { ctx.font = `${radius * 1.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏀", 0, 0); } 
        else {
            if(last.isScreen) {
                ctx.rotate(last.angle * Math.PI / 180); ctx.fillStyle = (p.team === 'red' ? '#CC0000' : '#0044CC');
                ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8); ctx.strokeStyle="#fff"; ctx.lineWidth=2*sF; ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                if(p.label) { ctx.rotate(-last.angle * Math.PI / 180); ctx.fillStyle = "white"; ctx.font = `bold ${radius * 0.8}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.label, 0, 1); }
            } else { drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', radius, p.label); }
        }
        ctx.restore();
    });
}