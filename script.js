// Tempo management
const MIN_TEMPO = 1;
const MAX_TEMPO = 240;

let currentTempo = 120;
let editingTempo = '';
let isFirstInput = true;

// Metronome state
let isPlaying = false;
let audioContext = null;
let schedulerTimerId = null;
let currentBeat = 0;
let beatsPerMeasure = 4; // Time signature numerator (4/4 = 4 beats)

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
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Create click sound (accented = first beat of measure)
function playClick(accented = false) {
    initAudioContext();
    
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    // Accent: higher pitch (1500Hz) and louder (0.7)
    // Normal: lower pitch (1000Hz) and quieter (0.4)
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

// Schedule next tick using setTimeout (allows dynamic tempo changes)
function scheduleNextTick() {
    if (!isPlaying) return;
    
    schedulerTimerId = setTimeout(() => {
        // Advance beat counter
        currentBeat++;
        if (currentBeat > beatsPerMeasure) {
            currentBeat = 1;
        }
        
        // Play click with accent on beat 1
        playClick(currentBeat === 1);
        scheduleNextTick();
    }, getIntervalMs());
}

// Start metronome
function startMetronome() {
    initAudioContext();
    isPlaying = true;
    
    // Reset beat counter and play first click (accented)
    currentBeat = 1;
    playClick(true);
    
    // Schedule next clicks
    scheduleNextTick();
    
    if (playButtonIcon) {
        playButtonIcon.src = 'icons/ic_pause.svg';
        playButtonIcon.alt = 'Pause';
    }
}

// Stop metronome
function stopMetronome() {
    isPlaying = false;
    if (schedulerTimerId) {
        clearTimeout(schedulerTimerId);
        schedulerTimerId = null;
    }
    if (playButtonIcon) {
        playButtonIcon.src = 'icons/ic_play/L.svg';
        playButtonIcon.alt = 'Play';
    }
}

// Tempo changes apply automatically on next tick - no restart needed
function restartMetronome() {
    // Do nothing - next tick will use updated currentTempo
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
