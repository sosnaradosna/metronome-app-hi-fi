// Tempo management
const MIN_TEMPO = 1;
const MAX_TEMPO = 240;

let currentTempo = 120;
let editingTempo = '';
let isFirstInput = true;

// DOM Elements
const tempoValueElement = document.querySelector('.tempo-value');
const tempoOverlay = document.getElementById('tempoOverlay');
const tempoOverlayValue = document.getElementById('tempoOverlayValue');
const triggerTempo = document.querySelector('.trigger-tempo');
const tempoKeys = document.querySelectorAll('.tempo-key');

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

// Event Listeners
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
