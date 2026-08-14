// ========================================================
// PIZARRA OESTE - audio.js
// Sistema de audio: síntesis física (ruido filtrado + filtros acústicos)
// Depende de: estado.js
// ========================================================

let audioCtx = null;
let noiseBuffer = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // Genera un buffer de ruido blanco de 100ms para usar como textura física
    if (!noiseBuffer && audioCtx) {
        const bufferSize = audioCtx.sampleRate * 0.1;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }
}

function playSound(type) {
    if (typeof isMuted !== 'undefined' && isMuted) return;
    initAudio();
    if (!audioCtx || !noiseBuffer) return;

    const now = audioCtx.currentTime;

    switch (type) {

        // 1. TOMAR JUGADOR: Despegue suave (Click háptico + cuerpo sutil)
        case 'grabJersey': {
            // Transitorio de ruido (Textura al despegar)
            const noise = audioCtx.createBufferSource();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();

            noise.buffer = noiseBuffer;
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1800, now);
            filter.Q.setValueAtTime(3, now);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            // Tono grave corto (sensación de masa)
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.03);
            oscGain.gain.setValueAtTime(0.1, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

            osc.connect(oscGain);
            oscGain.connect(audioCtx.destination);

            noise.start(now);
            osc.start(now);
            osc.stop(now + 0.03);
            break;
        }

        // 2. SOLTAR JUGADOR: Apoyar ficha (Thud sutil de madera/goma)
        case 'dropJersey': {
            const noise = audioCtx.createBufferSource();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();

            noise.buffer = noiseBuffer;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, now);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            // Sub-cuerpo muy suave
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
            oscGain.gain.setValueAtTime(0.2, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            osc.connect(oscGain);
            oscGain.connect(audioCtx.destination);

            noise.start(now);
            osc.start(now);
            osc.stop(now + 0.04);
            break;
        }

        // 3. PICAR PELOTA: Impacto acústico real (Cuero + Resonancia de parquet)
        case 'bounceBall': {
            // Golpe seco de cuero (Ruido filtrado)
            const noise = audioCtx.createBufferSource();
            const noiseFilter = audioCtx.createBiquadFilter();
            const noiseGain = audioCtx.createGain();

            noise.buffer = noiseBuffer;
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(1200, now);
            noiseFilter.Q.setValueAtTime(2, now);

            noiseGain.gain.setValueAtTime(0.25, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);

            // Retumbo grave de la cámara de aire
            const subOsc = audioCtx.createOscillator();
            const subFilter = audioCtx.createBiquadFilter();
            const subGain = audioCtx.createGain();

            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(140, now);
            subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

            subFilter.type = 'lowpass';
            subFilter.frequency.setValueAtTime(250, now);

            subGain.gain.setValueAtTime(0.5, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            subOsc.connect(subFilter);
            subFilter.connect(subGain);
            subGain.connect(audioCtx.destination);

            noise.start(now);
            subOsc.start(now);
            subOsc.stop(now + 0.08);
            break;
        }

        // 4. HOVER EN BOTÓN: Micro-tick de iOS (4 milisegundos de aire)
        case 'btnHover': {
            const noise = audioCtx.createBufferSource();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();

            noise.buffer = noiseBuffer;
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3200, now);
            filter.Q.setValueAtTime(6, now);

            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            noise.start(now);
            break;
        }

        // 5. CLICK EN BOTÓN: Tap mecánico de teclado iOS / Taptic Engine
        case 'btnClick': {
            const noise = audioCtx.createBufferSource();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();

            noise.buffer = noiseBuffer;
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2400, now);
            filter.Q.setValueAtTime(4, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            noise.start(now);
            break;
        }
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