// ==========================================
// PIZARRA.JS - PARTE 1 DE 2 (VARIABLES Y NÚCLEO)
// ==========================================

const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d'), wrap = document.getElementById('canvas-wrap'), statusLabel = document.getElementById('status-box'), floatingUI = document.getElementById('floating-ui'), rotBtn = document.getElementById('rot-btn'), txtBtn = document.getElementById('txt-btn'), timelineList = document.getElementById('steps-list'), addStepBtn = document.getElementById('addStepBtn'), historyToggle = document.getElementById('historyToggle');
let currentStep = 0, isLooping = false, shouldStopLoop = false, ball = { active: true, team: 'ball', steps: [[{x:0,y:0,isScreen:false, angle:0}]] }, players = [], isDragging = false, activeObj = null, isEditionFinished = false;
let sF = 1, isMuted = localStorage.getItem('pizarraMuted') === 'true';

const stepColors = ["#ffffff", "#38b000", "#00b4d8", "#ffb703", "#e040fb", "#ff5722"];
let audioCtx = null;

function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(type) {
    if (isMuted) return;
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
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

function startLoadingSequence() {
    const bar = document.getElementById('loading-bar'), container = document.getElementById('logo-container'), screen = document.getElementById('loading-screen'), percentTxt = document.getElementById('loading-percentage');
    setTimeout(() => { bar.style.width = "100%"; container.classList.add('loaded'); }, 100);

    let currentPercent = 0;
    const interval = setInterval(() => {
        currentPercent += 2;
        if (currentPercent <= 100) { percentTxt.innerText = currentPercent + "%"; } 
        else { clearInterval(interval); }
    }, 35);

    setTimeout(() => { screen.style.opacity = "0"; screen.style.transform = "scale(1.03)"; setTimeout(() => screen.style.display = "none", 500); }, 2400);
}

function toggleMute() { isMuted = !isMuted; localStorage.setItem('pizarraMuted', isMuted); updateMuteBtnUI(); }
function updateMuteBtnUI() {
    const btn = document.getElementById('muteBtn');
    if (isMuted) { btn.innerText = "🔇 AUDIO: MUTED"; btn.classList.add('muted'); } 
    else { btn.innerText = "🔊 AUDIO: ON"; btn.classList.remove('muted'); }
}
function attachButtonSounds() {
    document.querySelectorAll('.snd-btn').forEach(btn => {
        if (!btn.dataset.soundBound) {
            btn.addEventListener('mouseenter', () => playSound('btnHover'));
            btn.addEventListener('click', () => { if(btn.id !== 'muteBtn') playSound('btnClick'); });
            btn.dataset.soundBound = "true";
        }
    });
}

function toggleFullscreenPlay(enable) {
    const floatingMenu = document.getElementById('fullscreen-floating-menu');
    if (enable) { document.body.classList.add('fullscreen-mode'); floatingMenu.style.display = 'flex'; } 
    else { document.body.classList.remove('fullscreen-mode'); floatingMenu.style.display = 'none'; }
    setTimeout(init, 310);
}

const rs = document.getElementById('countRed'), bs = document.getElementById('countBlue'), fs = document.getElementById('formationSelect');
for(let i=0; i<=5; i++) { rs.add(new Option('ATAC: ' + i, i)); bs.add(new Option('DEF: ' + i, i)); }
rs.value = 5; bs.value = 0;

function init() {
    const container = document.getElementById('canvas-wrap-outer');
    if(!container) return; 
    let availableW = container.clientWidth - 10, availableH = container.clientHeight - 10;
    let finalW = availableW, finalH = availableW / 1.45;
    if (finalH > availableH) { finalH = availableH; finalW = finalH * 1.45; }
    wrap.style.width = finalW + "px"; wrap.style.height = finalH + "px";
    canvas.width = finalW; canvas.height = finalH;
    sF = finalW / 500;
    updateCourtDrawing(finalW, finalH);
    updateMuteBtnUI();
    if(ball.steps[0][0].x === 0) ball.steps[0] = [{x: finalW/2, y: finalH * 0.45, isScreen:false, angle:0}];
    if(players.length === 0) syncPlayers();
    updateFormationOptions(); renderTimeline(); updateStepUI(); draw(); attachButtonSounds();
}

window.addEventListener('resize', init);// ==========================================
// PIZARRA.JS - PARTE 2 DE 2 (DRAG & DROP Y RENDER)
// ==========================================

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

function drawParquetTexture() {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)"; ctx.lineWidth = 1 * sF; const plankWidth = 16 * sF;
    for (let x = 0; x < canvas.width; x += plankWidth) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        for (let y = (x % 3) * 20 * sF; y < canvas.height; y += 80 * sF) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + plankWidth, y); ctx.stroke();
        }
    }
}

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
    const n = parseInt(rs.value); fs.innerHTML = '<option value="custom">-- FORMACIÓN --</option>';
    if(n === 0) return;
    for(let i = n; i >= 0; i--) { fs.add(new Option(`${i} INT / ${n-i} EXT`, `${i}-${n-i}`)); }
}

function syncPlayers() {
    const rCount = parseInt(rs.value), bCount = parseInt(bs.value);
    const savedLabels = JSON.parse(localStorage.getItem('pizarraLabels') || '{"red":[], "blue":[]}');
    const radius = 15 * sF; 
    
    const updateTeam = (team, count, x) => {
        let teamList = players.filter(p => p.team === team);
        if(teamList.length > count) players = players.filter(p => !(p.team === team && teamList.indexOf(p) >= count));
        else for(let i=teamList.length; i<count; i++) {
            let s = []; 
            let ty = (50 + i * (radius * 2.8));
            let tx = x*sF;
            if(team === 'blue' && players.filter(p=>p.team==='red')[i]) { tx = players.filter(p=>p.team==='red')[i].steps[0][0].x + (25*sF); ty = players.filter(p=>p.team==='red')[i].steps[0][0].y; }
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

function toggleBall() { ball.active = !ball.active; document.getElementById('ballBtn').style.background = ball.active ? "#ff6600" : "#333"; draw(); }
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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); drawParquetTexture();
    const radius = 15 * sF, showHistory = historyToggle.checked;
    
    if(showHistory && currentStep > 0) {
        ctx.save(); ctx.globalAlpha = 0.22;
        for (let stepIdx = 0; stepIdx < currentStep; stepIdx++) {
            const colorTáctico = stepColors[stepIdx % stepColors.length];
            [...players, ball].forEach(p => {
                if(p === ball && !ball.active) return;
                const path = p.steps[stepIdx]; if(!path || path.length === 0) return;
                const last = path[path.length - 1];
                if(stepIdx > 0 && path.length > 1) {
                    ctx.beginPath(); ctx.strokeStyle = colorTáctico; ctx.lineWidth = 2 * sF;
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
            ctx.moveTo(path[0].x, path[0].y); 
            for(let k=1; k<path.length; k++) { ctx.lineTo(path[k].x, path[k].y); }
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
        if(currentStep > 0) activeObj.steps[currentStep] = [{...activeObj.steps[currentStep][0]}]; 
        updateFloatingUI();
        if (activeObj === ball) playSound('bounceBall'); else playSound('grabJersey');
    } else { activeObj = null; updateFloatingUI(); }
    draw();
}
function handleMove(e) {
    if(!isDragging || !activeObj) return; e.preventDefault();
    const pos = getPos(e); const path = activeObj.steps[currentStep], last = path[path.length-1];
    if(currentStep === 0) path[0] = {x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle};
    else path.push({x: pos.x, y: pos.y, isScreen: last.isScreen, angle: last.angle});
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

function addNewStep() {
    [...players, ball].forEach(p => { const last = p.steps[currentStep][p.steps[currentStep].length - 1]; p.steps.push([{x: last.x, y: last.y, isScreen: last.isScreen, angle: last.angle}]); });
    currentStep++; updateStepUI(); renderTimeline(); draw(); attachButtonSounds();
}
function deleteLastStep() {
    if(currentStep === 0) return;
    [...players, ball].forEach(p => p.steps.pop());
    currentStep--; updateStepUI(); renderTimeline(); draw(); attachButtonSounds();
}
function updateStepUI() {
    const delBtn = document.getElementById('delStepBtn');
    if(delBtn) delBtn.style.display = currentStep === 0 ? "none" : "block";
    statusLabel.innerText = currentStep === 0 ? "UBICACIÓN" : "GRABANDO P." + currentStep;
    statusLabel.style.borderColor = currentStep === 0 ? "#ff6600" : "#CC0000"; statusLabel.style.color = currentStep === 0 ? "#ff6600" : "#CC0000";
    activeObj = null; updateFloatingUI();
    const selectors = [rs, bs, fs, document.getElementById('ballBtn'), document.getElementById('muteBtn'), document.querySelector('#col-linea-tiempo h2')];
    selectors.forEach(el => { if(el) { el.style.opacity = currentStep === 0 ? "1" : "0.3"; el.style.pointerEvents = currentStep === 0 ? "auto" : "none"; } });
}
function finishEdition() {
    isEditionFinished = true; activeObj = null; updateFloatingUI();
    document.getElementById('playback-controls').style.display = "flex"; document.getElementById('edit-controls').style.display = "none";
    addStepBtn.style.display = "none"; statusLabel.innerText = "REPRODUCCIÓN"; statusLabel.style.borderColor = "#28a745"; statusLabel.style.color = "#28a745";
    attachButtonSounds();
}
function backToEdit() {
    shouldStopLoop = true; isLooping = false; 
    document.getElementById('mainLoopBtn').innerText = "🔄 LOOP: OFF"; document.getElementById('floatLoopBtn').innerText = "🔄 LOOP: OFF";
    isEditionFinished = false; document.getElementById('playback-controls').style.display = "none"; document.getElementById('edit-controls').style.display = "none";
    addStepBtn.style.display = "block"; updateStepUI(); draw(); renderTimeline(); attachButtonSounds();
}
function newPlay() { if(confirm("¿Borrar jugada actual y crear una de cero?")) location.reload(); }

function renderTimeline() {
    timelineList.innerHTML = '';
    ball.steps.forEach((_, i) => {
        const btn = document.createElement('button'); btn.className = `step-btn snd-btn ${i === currentStep ? 'active' : ''}`;
        btn.innerText = i === 0 ? "INICIO" : `PASO ${i}`; btn.style.borderLeft = `4px solid ${stepColors[i % stepColors.length]}`;
        btn.onclick = () => { currentStep = i; updateStepUI(); draw(); renderTimeline(); attachButtonSounds(); };
        timelineList.appendChild(btn);
    });
    if(addStepBtn && !isEditionFinished) timelineList.appendChild(addStepBtn); 
    timelineList.scrollTop = timelineList.scrollHeight;
}

function toggleLoop() {
    isLooping = !isLooping; shouldStopLoop = !isLooping;
    const msg = isLooping ? "🔄 LOOP: ON" : "🔄 LOOP: OFF";
    document.getElementById('mainLoopBtn').innerText = msg; document.getElementById('floatLoopBtn').innerText = msg;
    if (isLooping) playFullPlay(true);
}

async function playFullPlay(loopMode) {
    shouldStopLoop = false;
    do {
        for(let i=0; i < ball.steps.length; i++) {
            if(shouldStopLoop) break; currentStep = i; renderTimeline();
            if(i === 0) { draw(); await new Promise(r => setTimeout(r, 600)); continue; }
            await new Promise(res => {
                let totalFrames = 140, f = 0;
                function frame() {
                    if(shouldStopLoop) return res();
                    let t = f / totalFrames; let ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                    [...players, ball].forEach(p => { 
                        if(p.steps[i]) { 
                            const s = p.steps[i]; if(s.length === 0) return;
                            let targetIdx = Math.floor(ease * (s.length - 1));
                            targetIdx = Math.max(0, Math.min(s.length - 1, targetIdx));
                            const currentPt = s[targetIdx]; p.ax = currentPt.x; p.ay = currentPt.y;
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

function renderAnim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); drawParquetTexture();
    const r = 15 * sF, activeColor = stepColors[currentStep % stepColors.length];
    [...players, ball].forEach(p => {
        if(p === ball && !ball.active) return;
        const path = p.steps[currentStep];
        if(currentStep > 0 && path.length > 1) {
            ctx.beginPath(); ctx.strokeStyle = activeColor; ctx.lineWidth = 3.5 * sF;
            if(p === ball) ctx.setLineDash([5, 5]);
            ctx.moveTo(path[0].x, path[0].y); for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke(); ctx.setLineDash([]);
        }
    });
    [...players, ball].forEach(p => { 
        if(p === ball && !ball.active) return; 
        ctx.save(); ctx.translate(p.ax, p.ay); 
        if(p === ball) { ctx.font = `${r * 1.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏀", 0, 0); } 
        else {
            if(p.as) {
                ctx.rotate(p.aa * Math.PI / 180); ctx.fillStyle = (p.team === 'red' ? '#CC0000' : '#0044CC');
                ctx.fillRect(-r*1.2, -r*0.4, r*2.4, r*0.8); ctx.strokeStyle="#fff"; ctx.lineWidth=2*sF; ctx.strokeRect(-r*1.2, -r*0.4, r*2.4, r*0.8);
                const pl = players.find(x => x === p);
                if(pl && pl.label) { ctx.rotate(-p.aa * Math.PI / 180); ctx.fillStyle = "white"; ctx.font = `bold ${r * 0.8}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pl.label, 0, 1); }
            } else { const pl = players.find(x => x === p); drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', r, pl ? pl.label : ''); }
        }
        ctx.restore(); 
    });
}

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
window.onload = () => { init(); startLoadingSequence(); };

// ========================================================
// OPTIMIZACIÓN DE BOTONES: PELOTA Y AUDIO DINÁMICOS
// ========================================================

function updateMuteBtnUI() {
    const btn = document.getElementById('muteBtn');
    if (!btn) return;
    if (isMuted) { 
        btn.innerText = "🔇"; 
        btn.classList.add('muted'); 
    } else { 
        btn.innerText = "🔊"; 
        btn.classList.remove('muted'); 
    }
}

function toggleBall() { 
    ball.active = !ball.active; 
    const btn = document.getElementById('ballBtn');
    if (btn) {
        btn.innerText = ball.active ? "🏀" : "🚫";
        btn.style.background = ball.active ? "#ff6600" : "#333";
    }
    draw(); 
}

// ========================================================
// OPTIMIZACIÓN DE LA TIMELINE: LOOP COMPACTO EN EMOJI
// ========================================================

function toggleLoop() {
    isLooping = !isLooping; 
    shouldStopLoop = !isLooping;
    
    const msg = isLooping ? "🔄" : "🔄"; // Dejamos solo el emoji limpio
    
    // Buscamos ambos botones (el de la barra y el flotante) y les cambiamos el estado visual
    const mainBtn = document.getElementById('mainLoopBtn');
    const floatBtn = document.getElementById('floatLoopBtn');
    
    if (mainBtn) {
        mainBtn.innerText = msg;
        mainBtn.style.background = isLooping ? "#17a2b8" : "#333";
    }
    if (floatBtn) {
        floatBtn.innerText = isLooping ? "🔄 LOOP: ON" : "🔄 LOOP: OFF";
    }
    
    if (isLooping) playFullPlay(true);
}

// ========================================================
// LIBERACIÓN DEL BOTÓN DE AUDIO DURANTE LA GRABACIÓN
// ========================================================

function updateStepUI() {
    const delBtn = document.getElementById('delStepBtn');
    if(delBtn) delBtn.style.display = currentStep === 0 ? "none" : "block";
    
    if(statusLabel) {
        statusLabel.innerText = currentStep === 0 ? "UBICACIÓN" : "GRABANDO P." + currentStep;
        statusLabel.style.borderColor = currentStep === 0 ? "#ff6600" : "#CC0000"; 
        statusLabel.style.color = currentStep === 0 ? "#ff6600" : "#CC0000";
    }
    
    activeObj = null; 
    if (typeof updateFloatingUI === "function") updateFloatingUI();
    
    // Sacamos al botón de mute de la lista de bloqueo para que quede libre SIEMPRE
    const selectors = [rs, bs, fs, document.getElementById('ballBtn')];
    selectors.forEach(el => { 
        if(el) { 
            el.style.opacity = currentStep === 0 ? "1" : "0.3"; 
            el.style.pointerEvents = currentStep === 0 ? "auto" : "none"; 
        } 
    });
}

// ========================================================
// CORRECCIÓN DE FLUJO DE EDICIÓN Y BOTÓN DE PELOTA
// ========================================================

// CORRECCIÓN PUNTO 5: Restaura los botones de finalizar/borrar paso al volver a editar
function backToEdit() {
    shouldStopLoop = true; 
    isLooping = false; 
    
    const mainLoopBtn = document.getElementById('mainLoopBtn');
    const floatLoopBtn = document.getElementById('floatLoopBtn');
    if (mainLoopBtn) mainLoopBtn.innerText = "🔄";
    if (floatLoopBtn) floatLoopBtn.innerText = "🔄 LOOP: OFF";
    
    isEditionFinished = false; 
    
    // Mostramos los controles de edición y ocultamos los de reproducción
    document.getElementById('playback-controls').style.display = "none"; 
    document.getElementById('edit-controls').style.display = "flex";
    
    if (addStepBtn) addStepBtn.style.display = "block"; 
    
    updateStepUI(); 
    draw(); 
    renderTimeline(); 
    if (typeof attachButtonSounds === "function") attachButtonSounds();
}

// CORRECCIÓN PUNTO 3: Saca el fondo naranja fijo en el script para mantener el estilo base
function toggleBall() { 
    ball.active = !ball.active; 
    const btn = document.getElementById('ballBtn');
    if (btn) {
        btn.innerText = ball.active ? "🏀" : "🚫";
        // Ahora se comporta gris oscuro (#333) o más apagado (#222) como el resto, sin naranja
        btn.style.background = ball.active ? "#333" : "#222";
    }
    draw(); 
}

// ========================================================
// CAPA DE ESCUDO CENTRAL CORREGIDA: MADERAS SÓLIDAS Y DETALLES INTERNOS
// ========================================================

const logoCanchaImg = new Image();
logoCanchaImg.src = 'logo.svg';

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    if (typeof drawParquetTexture === "function") drawParquetTexture();
    
    // --- DIBUJADO DEL ESCUDO EN ARMONÍA CON EL PARQUET ---
    if (logoCanchaImg.complete && logoCanchaImg.naturalWidth !== 0) {
        ctx.save();
        
        // Mantenemos la proporción vertical real
        const anchoDeseado = 95 * sF; 
        const proporcion = logoCanchaImg.naturalHeight / logoCanchaImg.naturalWidth;
        const altoCalculado = anchoDeseado * proporcion;
        
        // Mantenemos la ubicación exacta en el eje de libres (pH = h * 0.52)
        const centroX = canvas.width / 2;
        const centroY = canvas.height * 0.52; 
        
        ctx.translate(centroX, centroY);
        
        // REPARACIÓN COMPLETA: 
        // 1. Usamos 'source-over' (el modo normal) para NO romper el parqué de fondo.
        ctx.globalCompositeOperation = 'source-over'; 
        
        // 2. Apagamos los brillos del blanco/rojo y lo llevamos a un tono oscuro sutil con filtros.
        ctx.filter = 'brightness(0.3) contrast(1.2)';
        
        // 3. Le damos una opacidad bien baja para que las vetas de la madera pasen a través del logo.
        ctx.globalAlpha = 0.15; 
        
        // Dibujamos el logo centrado
        ctx.drawImage(logoCanchaImg, -anchoDeseado / 2, -altoCalculado / 2, anchoDeseado, altoCalculado);
        
        ctx.restore();
    }
    // ------------------------------------------------------------

    const radius = 15 * sF, showHistory = historyToggle.checked;
    
    // Historial translúcido
    if(showHistory && currentStep > 0) {
        ctx.save(); ctx.globalAlpha = 0.22;
        for (let stepIdx = 0; stepIdx < currentStep; stepIdx++) {
            const colorTáctico = stepColors[stepIdx % stepColors.length];
            [...players, ball].forEach(p => {
                if(p === ball && !ball.active) return;
                const path = p.steps[stepIdx]; if(!path || path.length === 0) return;
                const last = path[path.length - 1];
                if(stepIdx > 0 && path.length > 1) {
                    ctx.beginPath(); ctx.strokeStyle = colorTáctico; ctx.lineWidth = 2 * sF;
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

    // Fichas del Paso Activo
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
            ctx.moveTo(path[0].x, path[0].y); 
            for(let k=1; k<path.length; k++) { ctx.lineTo(path[k].x, path[k].y); }
            ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(last.x, last.y);
        if(p === ball) { ctx.font = `${radius * 1.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏀", 0, 0); } 
        else {
            if(last.isScreen) {
                ctx.rotate(last.angle * Math.PI / 180); ctx.fillStyle = (p.team === 'red' ? '#CC0000' : '#0044CC');
                ctx.fillRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8); ctx.strokeStyle="#fff"; ctx.lineWidth=2*sF; ctx.strokeRect(-radius*1.2, -radius*0.4, radius*2.4, radius*0.8);
                if(last.label) { ctx.rotate(-last.angle * Math.PI / 180); ctx.fillStyle = "white"; ctx.font = `bold ${radius * 0.8}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(last.label, 0, 1); }
            } else { drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', radius, p.label); }
        }
        ctx.restore();
    });
}

// ========================================================
// REPARACIÓN DE ANIMACIÓN: LOGO DE CANCHA CONTINUO EN PLAY
// ========================================================

function renderAnim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    if (typeof drawParquetTexture === "function") drawParquetTexture();
    
    // --- INTEGRACIÓN DEL ESCUDO EN EL MOTOR DE ANIMACIÓN ---
    if (logoCanchaImg.complete && logoCanchaImg.naturalWidth !== 0) {
        ctx.save();
        const anchoDeseado = 95 * sF; 
        const proporcion = logoCanchaImg.naturalHeight / logoCanchaImg.naturalWidth;
        const altoCalculado = anchoDeseado * proporcion;
        
        const centroX = canvas.width / 2;
        const centroY = canvas.height * 0.52; 
        
        ctx.translate(centroX, centroY);
        ctx.globalCompositeOperation = 'source-over'; 
        ctx.filter = 'brightness(0.3) contrast(1.2)';
        ctx.globalAlpha = 0.15; 
        
        ctx.drawImage(logoCanchaImg, -anchoDeseado / 2, -altoCalculado / 2, anchoDeseado, altoCalculado);
        ctx.restore();
    }
    // ------------------------------------------------------------
    
    const r = 15 * sF, activeColor = stepColors[currentStep % stepColors.length];
    
    // Trayectorias fijas de fondo durante el play
    [...players, ball].forEach(p => {
        if(p === ball && !ball.active) return;
        const path = p.steps[currentStep];
        if(currentStep > 0 && path.length > 1) {
            ctx.beginPath(); ctx.strokeStyle = activeColor; ctx.lineWidth = 3.5 * sF;
            if(p === ball) ctx.setLineDash([5, 5]);
            ctx.moveTo(path[0].x, path[0].y); 
            for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke(); ctx.setLineDash([]);
        }
    });
    
    // Dibujado interpolado de fichas en movimiento
    [...players, ball].forEach(p => { 
        if(p === ball && !ball.active) return; 
        ctx.save(); ctx.translate(p.ax, p.ay); 
        if(p === ball) { 
            ctx.font = `${r * 1.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏀", 0, 0); 
        } else {
            if(p.as) {
                ctx.rotate(p.aa * Math.PI / 180); ctx.fillStyle = (p.team === 'red' ? '#CC0000' : '#0044CC');
                ctx.fillRect(-r*1.2, -r*0.4, r*2.4, r*0.8); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * sF; ctx.strokeRect(-r*1.2, -r*0.4, r*2.4, r*0.8);
                const pl = players.find(x => x === p);
                if(pl && pl.label) { ctx.rotate(-p.aa * Math.PI / 180); ctx.fillStyle = "white"; ctx.font = `bold ${r * 0.8}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pl.label, 0, 1); }
            } else { 
                const pl = players.find(x => x === p); drawJersey(p.team === 'red' ? '#CC0000' : '#0044CC', r, pl ? pl.label : ''); 
            }
        }
        ctx.restore(); 
    });
}

// ========================================================
// NUEVO SISTEMA DE JAVASCRIPT 116.7 (REDIMENSIÓN PROPORCIONAL CALIBRADA)
// ========================================================

// 1. FUNCIÓN INTERNA: Actualiza la visibilidad del menú flotante de reproducción
function verificarMenuFlotante() {
    const derEscondido = document.getElementById('col-linea-tiempo-container').classList.contains('colapsado');
    const menuFlotante = document.getElementById('fullscreen-floating-menu');
    
    if (menuFlotante) {
        if (isEditionFinished && derEscondido) {
            menuFlotante.style.display = "flex";
        } else {
            menuFlotante.style.display = "none";
        }
    }
}

// 2. CONTROL DE SOLAPAS LATERALES CON RE-ESCALADO NATIVO POR RETARDO
function toggleSidebar(lado) {
    const contenedor = document.getElementById(lado === 'izq' ? 'col-izquierda-container' : 'col-linea-tiempo-container');
    const boton = document.getElementById(lado === 'izq' ? 'solapa-izq' : 'solapa-der');
    
    if (!contenedor || !boton) return;
    
    contenedor.classList.toggle('colapsado');
    
    if (lado === 'izq') {
        boton.innerText = contenedor.classList.contains('colapsado') ? "▶" : "◀";
    } else {
        boton.innerText = contenedor.classList.contains('colapsado') ? "◀" : "▶";
    }
    
    verificarMenuFlotante();
    
    // Ejecutamos tu función resize nativa en ráfaga táctica para acompañar 
    // el deslizamiento de la solapa sin deformar un solo gráfico
    if (typeof resize === "function") resize();
    
    setTimeout(() => { if (typeof resize === "function") resize(); }, 100);
    setTimeout(() => { if (typeof resize === "function") resize(); }, 200);
    setTimeout(() => { 
        if (typeof resize === "function") resize(); 
        if (typeof draw === "function") draw(); // Redibuja el escudo centrado
    }, 360); // Clavado exacto cuando termina la animación CSS (0.35s)
    
    setTimeout(() => { if (typeof resize === "function") resize(); }, 550); // Resguardo final por lag
}

// 3. CONTROL DE PANTALLA COMPLETA REAL (API GLOBAL)
function toggleRealFullscreen() {
    const btn = document.getElementById('realFsBtn');
    
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
            .then(() => {
                if (btn) btn.innerText = "❌";
                setTimeout(() => { if (typeof resize === "function") resize(); }, 150);
                setTimeout(() => { if (typeof resize === "function") resize(); }, 450);
            })
            .catch(err => {
                console.log(`Error de hardware full screen: ${err.message}`);
            });
    } else {
        document.exitFullscreen()
            .then(() => {
                if (btn) btn.innerText = "⤢";
                setTimeout(() => { if (typeof resize === "function") resize(); }, 150);
                setTimeout(() => { if (typeof resize === "function") resize(); }, 450);
            });
    }
}

// Escuchador de hardware para cambios de pantalla completa o rotaciones
document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('realFsBtn');
    if (btn) {
        if (document.fullscreenElement) {
            btn.innerText = "❌";
        } else {
            btn.innerText = "⤢";
        }
    }
    setTimeout(() => { if (typeof resize === "function") resize(); }, 150);
    setTimeout(() => { if (typeof resize === "function") resize(); }, 500);
});

// ESCUCHADOR GLOBAL DE RESIZE DEL NAVEGADOR
window.addEventListener('resize', () => {
    if (typeof resize === "function") resize();
    setTimeout(() => { if (typeof resize === "function") resize(); }, 200);
});

// 4. RE-ESCRITURA: Modificar jugada
function backToEdit() {
    shouldStopLoop = true; 
    isLooping = false; 
    
    const mainLoopBtn = document.getElementById('mainLoopBtn');
    const floatLoopBtn = document.getElementById('floatLoopBtn');
    if (mainLoopBtn) mainLoopBtn.innerText = "🔄";
    if (floatLoopBtn) floatLoopBtn.innerText = "🔄 LOOP: OFF";
    
    isEditionFinished = false; 
    
    document.getElementById('playback-controls').style.display = "none"; 
    document.getElementById('edit-controls').style.display = "flex";
    if (addStepBtn) addStepBtn.style.display = "block"; 
    
    verificarMenuFlotante();
    
    updateStepUI(); 
    draw(); 
    renderTimeline(); 
    if (typeof attachButtonSounds === "function") attachButtonSounds();
    setTimeout(() => { if (typeof resize === "function") resize(); }, 100);
}

// 5. RE-ESCRITURA: Finalizar jugada
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
    if (typeof resize === "function") resize();
    setTimeout(() => { if (typeof resize === "function") resize(); }, 100);
}

// 6. VIGILANTE DEL LOADER
const loaderTarget = document.getElementById('loading-screen');
if (loaderTarget) {
    const observer = new MutationObserver(() => {
        if (loaderTarget.style.display === 'none' || loaderTarget.style.opacity === '0') {
            const sIzq = document.getElementById('solapa-izq');
            const sDer = document.getElementById('solapa-der');
            if (sIzq) sIzq.classList.add('solapa-activa');
            if (sDer) sDer.classList.add('solapa-activa');
            if (typeof resize === "function") resize();
            observer.disconnect(); 
        }
    });
    observer.observe(loaderTarget, { attributes: true, attributeFilter: ['style'] });
}