// ========================================================
// PIZARRA OESTE - audio.js
// Sistema de audio: síntesis de sonidos UI y control de mute.
// Depende de: estado.js
// ========================================================

let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;

    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    switch (type) {
        case 'grabJersey':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            gain.gain.setValueAtTime(0.70, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
            osc.start(now); osc.stop(now + 0.06);
            break;
        case 'dropJersey':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(460, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
            gain.gain.setValueAtTime(0.50, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
            break;
        case 'bounceBall':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(170, now);
            osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);
            gain.gain.setValueAtTime(0.85, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.start(now); osc.stop(now + 0.06);
            break;
        case 'btnHover':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.0001, now + 0.015);
            osc.start(now); osc.stop(now + 0.015);
            break;
        case 'btnClick':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(340, now);
            gain.gain.setValueAtTime(0.55, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.035);
            osc.start(now); osc.stop(now + 0.035);
            break;
    }
}

function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('pizarraMuted', isMuted);
    updateMuteBtnUI();
}

function updateMuteBtnUI() {
    const mB = document.getElementById('muteBtn');
    if (!mB) return;
    if (isMuted) {
        mB.innerText = "🔇";
        mB.classList.add('muted');
    } else {
        mB.innerText = "🔊";
        mB.classList.remove('muted');
    }
}

function attachButtonSounds() {
    document.querySelectorAll('.snd-btn').forEach(btn => {
        if (btn.dataset.sndBound) return;
        btn.dataset.sndBound = "true";
        btn.addEventListener('mouseenter', () => playSound('btnHover'));
        btn.addEventListener('click',      () => playSound('btnClick'));
    });
}
