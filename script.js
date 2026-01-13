// Tempo management
const MIN_TEMPO = 1;
const MAX_TEMPO = 240;

let currentTempo = 120;
let editingTempo = '';
let isFirstInput = true;

// Metronome state
let isPlaying = false;
let audioContext = null;
let timeoutId = null;
let currentBeat = 0;
let beatsPerMeasure = 4; // Time signature numerator (4/4 = 4 beats)
let lastBeatTime = 0; // When the last beat was played (performance.now())

// Tap tempo state
let tapTimes = [];
const TAP_TIMEOUT = 2000; // Reset taps after 2 seconds of inactivity

// Wheel rotation state
let wheelRotation = 0; // Current visual rotation in degrees
let isDragging = false;
let lastAngle = 0;
let lastMoveTime = 0;
let accumulatedTempoDelta = 0; // For smooth tempo changes

// DOM Elements (initialized after DOM ready)
let tempoValueElement;
let tempoOverlay;
let tempoOverlayValue;
let triggerTempo;
let tempoKeys;
let playButton;
let playButtonIcon;
let tempoIncreaseBtn;
let tempoDecreaseBtn;
let tapButton;
let tempoWheel;

// Clamp tempo to valid range
function clampTempo(value) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < MIN_TEMPO) return MIN_TEMPO;
    if (num > MAX_TEMPO) return MAX_TEMPO;
    return num;
}

// Update tempo display
function updateTempoDisplay(value) {
    tempoValueElement.textContent = value;
}

// Increase tempo by 1
function increaseTempo() {
    if (currentTempo < MAX_TEMPO) {
        currentTempo++;
        updateTempoDisplay(currentTempo);
        restartMetronome();
    }
}

// Decrease tempo by 1
function decreaseTempo() {
    if (currentTempo > MIN_TEMPO) {
        currentTempo--;
        updateTempoDisplay(currentTempo);
        restartMetronome();
    }
}

// Handle tap tempo
function handleTap() {
    const now = performance.now();
    
    // Reset if too much time has passed since last tap
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT) {
        tapTimes = [];
    }
    
    // Add current tap time
    tapTimes.push(now);
    
    // Keep only last 8 taps for averaging
    if (tapTimes.length > 8) {
        tapTimes.shift();
    }
    
    // Need at least 2 taps to calculate tempo
    if (tapTimes.length >= 2) {
        // Calculate average interval between taps
        let totalInterval = 0;
        for (let i = 1; i < tapTimes.length; i++) {
            totalInterval += tapTimes[i] - tapTimes[i - 1];
        }
        const avgInterval = totalInterval / (tapTimes.length - 1);
        
        // Convert to BPM (60000ms = 1 minute)
        const tappedTempo = Math.round(60000 / avgInterval);
        
        // Clamp to valid range and update
        currentTempo = clampTempo(tappedTempo);
        updateTempoDisplay(currentTempo);
        restartMetronome();
    }
}

// ============ WHEEL ROTATION ============

// Get angle from center of wheel to a point
function getAngleFromCenter(element, clientX, clientY) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
}

// Update wheel visual rotation
function updateWheelRotation() {
    if (tempoWheel) {
        tempoWheel.style.setProperty('--wheel-rotation', `${wheelRotation}deg`);
    }
}

// Play wheel tick sound (wooden, thin, delicate)
function playWheelTick() {
    if (!audioContext) {
        initAudioContext();
    }
    
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    // High frequency, short, quiet - like a wooden gear click
    osc.type = 'triangle';
    osc.frequency.value = 2500;
    envelope.gain.value = 0.15;
    envelope.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.02);
    
    osc.connect(envelope);
    envelope.connect(audioContext.destination);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.02);
}

// Handle wheel drag start
function handleWheelStart(clientX, clientY) {
    isDragging = true;
    lastAngle = getAngleFromCenter(tempoWheel, clientX, clientY);
    lastMoveTime = performance.now();
    accumulatedTempoDelta = 0;
}

// Handle wheel drag move
function handleWheelMove(clientX, clientY) {
    if (!isDragging) return;
    
    const now = performance.now();
    const currentAngle = getAngleFromCenter(tempoWheel, clientX, clientY);
    let deltaAngle = currentAngle - lastAngle;
    
    // Handle wrap-around at ±180 degrees
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    
    // Update visual rotation
    wheelRotation += deltaAngle;
    updateWheelRotation();
    
    // Calculate velocity (degrees per ms)
    const timeDelta = now - lastMoveTime;
    const velocity = timeDelta > 0 ? Math.abs(deltaAngle) / timeDelta : 0;
    
    // Velocity multiplier: faster rotation = bigger effect (1x to 10x)
    const velocityMultiplier = 1 + Math.min(velocity * 80, 9);
    
    // Base sensitivity: 35 degrees = 1 BPM (slow = very precise), multiplied by velocity
    const tempoDelta = (deltaAngle / 35) * velocityMultiplier;
    accumulatedTempoDelta += tempoDelta;
    
    // Apply tempo change when we have at least 1 BPM difference
    if (Math.abs(accumulatedTempoDelta) >= 1) {
        const tempoChange = Math.trunc(accumulatedTempoDelta);
        const oldTempo = currentTempo;
        currentTempo = clampTempo(currentTempo + tempoChange);
        
        // Play tick for each BPM change
        const actualChange = Math.abs(currentTempo - oldTempo);
        if (actualChange > 0) {
            playWheelTick();
        }
        
        updateTempoDisplay(currentTempo);
        restartMetronome();
        accumulatedTempoDelta -= tempoChange;
    }
    
    lastAngle = currentAngle;
    lastMoveTime = now;
}

// Handle wheel drag end
function handleWheelEnd() {
    isDragging = false;
}

// Open tempo overlay
function openTempoOverlay() {
    editingTempo = currentTempo.toString();
    tempoOverlayValue.textContent = editingTempo;
    tempoOverlayValue.classList.add('selected');
    isFirstInput = true;
    tempoOverlay.classList.add('active');
}

// Close tempo overlay
function closeTempoOverlay(save = false) {
    if (save && editingTempo.length > 0) {
        currentTempo = clampTempo(editingTempo);
        updateTempoDisplay(currentTempo);
        restartMetronome(); // Apply new tempo if playing
    }
    tempoOverlay.classList.remove('active');
    tempoOverlayValue.classList.remove('selected');
    editingTempo = '';
}

// Handle keyboard input
function handleKeyInput(key) {
    if (key === 'backspace') {
        editingTempo = editingTempo.slice(0, -1);
        tempoOverlayValue.textContent = editingTempo || '0';
        tempoOverlayValue.classList.remove('selected');
        isFirstInput = false;
    } else if (key === 'confirm') {
        closeTempoOverlay(true);
    } else {
        // Number key - clear on first input (like selected text)
        if (isFirstInput) {
            editingTempo = key;
            tempoOverlayValue.classList.remove('selected');
            isFirstInput = false;
        } else if (editingTempo.length < 3) {
            editingTempo += key;
        }
        
        // Show what user typed first
        tempoOverlayValue.textContent = editingTempo;
        
        // Dynamic validation with animation if exceeded
        if (parseInt(editingTempo, 10) > MAX_TEMPO) {
            tempoOverlayValue.classList.add('shake');
            setTimeout(() => {
                editingTempo = MAX_TEMPO.toString();
                tempoOverlayValue.textContent = editingTempo;
                tempoOverlayValue.classList.remove('shake');
            }, 200);
        }
    }
}

// ============ METRONOME ============

// Initialize Audio Context (must be called after user interaction)
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Warm up the audio context with a silent sound
        const silentOsc = audioContext.createOscillator();
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;
        silentOsc.connect(silentGain);
        silentGain.connect(audioContext.destination);
        silentOsc.start();
        silentOsc.stop(audioContext.currentTime + 0.001);
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Play a click sound
function playClick(accented) {
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    osc.frequency.value = accented ? 1500 : 1000;
    envelope.gain.value = accented ? 0.7 : 0.4;
    envelope.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
    
    osc.connect(envelope);
    envelope.connect(audioContext.destination);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
}

// Calculate interval in ms from tempo
function getIntervalMs() {
    return (60 / currentTempo) * 1000;
}

// Schedule the next beat with drift correction
function scheduleNextBeat() {
    if (!isPlaying) return;
    
    const now = performance.now();
    const interval = getIntervalMs();
    const expectedNextBeat = lastBeatTime + interval;
    const delay = Math.max(0, expectedNextBeat - now);
    
    timeoutId = setTimeout(() => {
        if (!isPlaying) return;
        
        lastBeatTime = performance.now();
        playClick(currentBeat === 1);
        
        currentBeat++;
        if (currentBeat > beatsPerMeasure) {
            currentBeat = 1;
        }
        
        scheduleNextBeat();
    }, delay);
}

// Start metronome
function startMetronome() {
    initAudioContext();
    
    // Update UI immediately
    if (playButtonIcon) {
        playButtonIcon.src = 'icons/ic_pause.svg';
        playButtonIcon.alt = 'Pause';
    }
    
    // Warmup: play silent click to initialize audio pipeline
    const warmupOsc = audioContext.createOscillator();
    const warmupGain = audioContext.createGain();
    warmupGain.gain.value = 0; // Silent
    warmupOsc.connect(warmupGain);
    warmupGain.connect(audioContext.destination);
    warmupOsc.start();
    warmupOsc.stop(audioContext.currentTime + 0.001);
    
    // Wait for warmup to complete, then start playing
    setTimeout(() => {
        isPlaying = true;
        currentBeat = 1;
        lastBeatTime = performance.now();
        
        // Play first beat
        playClick(true);
        currentBeat = 2;
        
        // Schedule remaining beats
        scheduleNextBeat();
    }, 100);
}

// Stop metronome
function stopMetronome() {
    isPlaying = false;
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
    if (playButtonIcon) {
        playButtonIcon.src = 'icons/ic_play/L.svg';
        playButtonIcon.alt = 'Play';
    }
}

// Tempo changes apply on next beat
function restartMetronome() {
    // Next beat will use new tempo automatically
}

// Toggle metronome
function toggleMetronome() {
    if (isPlaying) {
        stopMetronome();
    } else {
        startMetronome();
    }
}

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    tempoValueElement = document.querySelector('.tempo-value');
    tempoOverlay = document.getElementById('tempoOverlay');
    tempoOverlayValue = document.getElementById('tempoOverlayValue');
    triggerTempo = document.querySelector('.trigger-tempo');
    tempoKeys = document.querySelectorAll('.tempo-key');
    playButton = document.getElementById('playButton');
    playButtonIcon = document.getElementById('playButtonIcon');
    tempoIncreaseBtn = document.getElementById('tempoIncrease');
    tempoDecreaseBtn = document.getElementById('tempoDecrease');
    tapButton = document.getElementById('tapButton');
    tempoWheel = document.getElementById('tempoWheel');

    // Play/Pause button
    if (playButton) {
        playButton.addEventListener('click', toggleMetronome);
    }

    // Tempo increase/decrease buttons
    if (tempoIncreaseBtn) {
        tempoIncreaseBtn.addEventListener('click', increaseTempo);
    }
    if (tempoDecreaseBtn) {
        tempoDecreaseBtn.addEventListener('click', decreaseTempo);
    }

    // Tap tempo button
    if (tapButton) {
        tapButton.addEventListener('click', handleTap);
    }

    // Tempo wheel rotation
    if (tempoWheel) {
        // Mouse events
        tempoWheel.addEventListener('mousedown', (e) => {
            handleWheelStart(e.clientX, e.clientY);
        });
        document.addEventListener('mousemove', (e) => {
            handleWheelMove(e.clientX, e.clientY);
        });
        document.addEventListener('mouseup', handleWheelEnd);
        
        // Touch events
        tempoWheel.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            handleWheelStart(touch.clientX, touch.clientY);
        });
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                const touch = e.touches[0];
                handleWheelMove(touch.clientX, touch.clientY);
            }
        });
        document.addEventListener('touchend', handleWheelEnd);
    }

    // Tempo controls
    triggerTempo.addEventListener('click', openTempoOverlay);

    tempoKeys.forEach(key => {
        key.addEventListener('click', () => {
            handleKeyInput(key.dataset.key);
        });
    });

    // Close overlay when clicking outside the keyboard
    tempoOverlay.addEventListener('click', (e) => {
        if (e.target === tempoOverlay || e.target.closest('.tempo-overlay-display')) {
            closeTempoOverlay(false);
        }
    });

    // Handle physical keyboard input when overlay is open
    document.addEventListener('keydown', (e) => {
        if (!tempoOverlay.classList.contains('active')) return;
        
        if (e.key >= '0' && e.key <= '9') {
            handleKeyInput(e.key);
        } else if (e.key === 'Backspace') {
            handleKeyInput('backspace');
        } else if (e.key === 'Enter') {
            handleKeyInput('confirm');
        } else if (e.key === 'Escape') {
            closeTempoOverlay(false);
        }
    });
});
