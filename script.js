// Tempo management
const MIN_TEMPO = 1;
const MAX_TEMPO = 240;

let currentTempo = 120;
let editingTempo = '';
let isFirstInput = true;

// Metrum (time signature) state
let currentNumerator = 4; // Beats per measure (1-32)
let currentDenominator = 4; // Note value (1, 2, 4, 8, 16, 32, 64, 128)
let editingNumerator = 4;
let editingDenominator = 4;
const NUMERATOR_VALUES = Array.from({ length: 16 }, (_, i) => i + 1); // 1 to 16
const DENOMINATOR_VALUES = [1, 2, 4, 8, 16, 32, 64, 128];

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

// Metrum overlay elements
let metrumOverlay;
let metrumWheelNumerator;
let metrumWheelDenominator;
let metrumPresetsGrid;
let metrumConfirmBtn;
let metrumValueElements;
let metrumTrigger;

// Visual feedback element
let beatLine;

// Panel slider
let panelTrack;
let currentPanel = 0;

// Accents
let accentsGrid;
let accents = []; // Array of accent levels (0-3) for each beat
let accentDragStartY = 0;
let accentDragBeat = -1;
let accentDragStartLevel = 0;
let accentDidDrag = false;

// Wheel drag state
let activeWheel = null;
let wheelDragStartY = 0;
let wheelStartOffset = 0;
let wheelCurrentOffset = 0;
let wheelVelocity = 0;
let wheelLastY = 0;
let wheelLastTime = 0;
let wheelMomentumId = null;
let lastWheelIndex = -1; // Track last index for tick sound
let wheelDidDrag = false; // Track if drag occurred (to prevent click after drag)

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
        playWheelTick();
    }
}

// Decrease tempo by 1
function decreaseTempo() {
    if (currentTempo > MIN_TEMPO) {
        currentTempo--;
        updateTempoDisplay(currentTempo);
        restartMetronome();
        playWheelTick();
    }
}

// Handle tap tempo
function handleTap() {
    playWheelTick();
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
    document.body.classList.add('dragging');
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
    document.body.classList.remove('dragging');
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

// ============ METRUM OVERLAY ============

const WHEEL_ITEM_HEIGHT = 52; // Height of each item including gap
const VISIBLE_ITEMS = 5; // Number of visible items

// Open metrum overlay
function openMetrumOverlay() {
    editingNumerator = currentNumerator;
    editingDenominator = currentDenominator;
    
    // Build wheel items
    buildWheelItems(metrumWheelNumerator, NUMERATOR_VALUES, editingNumerator);
    buildWheelItems(metrumWheelDenominator, DENOMINATOR_VALUES, editingDenominator);
    
    // Update preset selection
    updatePresetSelection();
    
    metrumOverlay.classList.add('active');
}

// Close metrum overlay
function closeMetrumOverlay(save = false) {
    if (save) {
        currentNumerator = editingNumerator;
        currentDenominator = editingDenominator;
        beatsPerMeasure = currentNumerator;
        updateMetrumDisplay();
        initAccents(); // Reinitialize accents for new time signature
        buildAccentsGrid(); // Rebuild grid if panel is open
        restartMetronome();
    }
    metrumOverlay.classList.remove('active');

    // Cancel any ongoing momentum
    if (wheelMomentumId) {
        cancelAnimationFrame(wheelMomentumId);
        wheelMomentumId = null;
    }
}

// Update metrum display in the header
function updateMetrumDisplay() {
    if (metrumValueElements && metrumValueElements.length >= 2) {
        metrumValueElements[0].textContent = currentNumerator;
        metrumValueElements[1].textContent = currentDenominator;
    }
}

// Build wheel items (repeated 4 times for looping effect)
function buildWheelItems(wheelElement, values, selectedValue) {
    const itemsContainer = wheelElement.querySelector('.metrum-wheel-items');
    itemsContainer.innerHTML = '';
    
    // Store original values length for later use
    wheelElement.dataset.originalLength = values.length;
    
    // Repeat values 4 times
    const repeatedValues = [...values, ...values, ...values, ...values];
    
    // Find the second occurrence of the selected value (in the second set)
    const baseIndex = values.indexOf(selectedValue);
    const selectedIndex = values.length + baseIndex; // Position in second set
    
    repeatedValues.forEach((value, index) => {
        const item = document.createElement('div');
        item.className = 'metrum-wheel-item';
        item.textContent = value;
        item.dataset.value = value;
        item.dataset.index = index;
        itemsContainer.appendChild(item);
    });
    
    // Set initial position to center the selected value
    const offset = -selectedIndex * WHEEL_ITEM_HEIGHT;
    wheelElement.dataset.offset = offset;
    itemsContainer.style.transform = `translateY(${offset + (WHEEL_ITEM_HEIGHT * 2)}px)`;
    
    // Update visual styles
    updateWheelStyles(wheelElement, selectedIndex);
}

// Update wheel item styles based on distance from center
function updateWheelStyles(wheelElement, centerIndex) {
    const items = wheelElement.querySelectorAll('.metrum-wheel-item');
    
    items.forEach((item, index) => {
        const distance = Math.abs(index - centerIndex);
        
        if (distance === 0) {
            item.style.fontSize = '40px';
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
        } else if (distance === 1) {
            item.style.fontSize = '36px';
            item.style.opacity = '0.8';
            item.style.transform = 'scale(0.9)';
        } else if (distance === 2) {
            item.style.fontSize = '24px';
            item.style.opacity = '0.5';
            item.style.transform = 'scale(0.8)';
        } else {
            item.style.fontSize = '20px';
            item.style.opacity = '0.3';
            item.style.transform = 'scale(0.7)';
        }
    });
}

// Get values array for a wheel (repeated 4 times)
function getWheelValues(wheelElement) {
    const baseValues = wheelElement.dataset.type === 'numerator' ? NUMERATOR_VALUES : DENOMINATOR_VALUES;
    return [...baseValues, ...baseValues, ...baseValues, ...baseValues];
}

// Get original (non-repeated) values array for a wheel
function getOriginalWheelValues(wheelElement) {
    return wheelElement.dataset.type === 'numerator' ? NUMERATOR_VALUES : DENOMINATOR_VALUES;
}

// Handle wheel drag start
function handleMetrumWheelStart(e, wheelElement) {
    e.preventDefault();
    
    // Cancel any ongoing momentum
    if (wheelMomentumId) {
        cancelAnimationFrame(wheelMomentumId);
        wheelMomentumId = null;
    }
    
    activeWheel = wheelElement;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    wheelDragStartY = clientY;
    wheelStartOffset = parseFloat(wheelElement.dataset.offset) || 0;
    wheelCurrentOffset = wheelStartOffset;
    wheelLastY = clientY;
    wheelLastTime = performance.now();
    wheelVelocity = 0;
    wheelDidDrag = false; // Reset drag flag
    
    // Initialize last index for tick sounds
    lastWheelIndex = Math.round(-wheelStartOffset / WHEEL_ITEM_HEIGHT);
    
    document.body.classList.add('dragging');
}

// Handle wheel drag move
function handleMetrumWheelMove(e) {
    if (!activeWheel) return;
    
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - wheelDragStartY;
    const now = performance.now();
    const dt = now - wheelLastTime;
    
    // Mark as dragged if moved more than 5px
    if (Math.abs(deltaY) > 5) {
        wheelDidDrag = true;
    }
    
    if (dt > 0) {
        wheelVelocity = (clientY - wheelLastY) / dt;
    }
    
    wheelLastY = clientY;
    wheelLastTime = now;
    
    const values = getWheelValues(activeWheel);
    const maxOffset = 0;
    const minOffset = -(values.length - 1) * WHEEL_ITEM_HEIGHT;
    
    wheelCurrentOffset = Math.max(minOffset, Math.min(maxOffset, wheelStartOffset + deltaY));
    
    const itemsContainer = activeWheel.querySelector('.metrum-wheel-items');
    itemsContainer.style.transform = `translateY(${wheelCurrentOffset + (WHEEL_ITEM_HEIGHT * 2)}px)`;
    itemsContainer.style.transition = 'none';
    
    // Update styles based on current position
    const currentIndex = Math.round(-wheelCurrentOffset / WHEEL_ITEM_HEIGHT);
    updateWheelStyles(activeWheel, currentIndex);
    
    // Play tick when index changes
    if (currentIndex !== lastWheelIndex) {
        playWheelTick();
        lastWheelIndex = currentIndex;
    }
}

// Handle wheel drag end
function handleMetrumWheelEnd() {
    if (!activeWheel) return;
    
    document.body.classList.remove('dragging');
    
    const values = getWheelValues(activeWheel);
    
    // Apply momentum if velocity is significant
    if (Math.abs(wheelVelocity) > 0.3) {
        applyWheelMomentum(activeWheel, values);
    } else {
        snapToNearestItem(activeWheel, values);
    }
    
    activeWheel = null;
}

// Apply momentum scrolling
function applyWheelMomentum(wheelElement, values) {
    const friction = 0.95;
    const minVelocity = 0.02;
    
    function animate() {
        wheelVelocity *= friction;
        
        if (Math.abs(wheelVelocity) < minVelocity) {
            snapToNearestItem(wheelElement, values);
            return;
        }
        
        const maxOffset = 0;
        const minOffset = -(values.length - 1) * WHEEL_ITEM_HEIGHT;
        
        wheelCurrentOffset += wheelVelocity * 16; // ~16ms per frame
        wheelCurrentOffset = Math.max(minOffset, Math.min(maxOffset, wheelCurrentOffset));
        
        const itemsContainer = wheelElement.querySelector('.metrum-wheel-items');
        itemsContainer.style.transform = `translateY(${wheelCurrentOffset + (WHEEL_ITEM_HEIGHT * 2)}px)`;
        itemsContainer.style.transition = 'none';
        
        const currentIndex = Math.round(-wheelCurrentOffset / WHEEL_ITEM_HEIGHT);
        updateWheelStyles(wheelElement, currentIndex);
        
        // Play tick when index changes during momentum
        if (currentIndex !== lastWheelIndex) {
            playWheelTick();
            lastWheelIndex = currentIndex;
        }
        
        // Check if we hit the bounds
        if (wheelCurrentOffset === maxOffset || wheelCurrentOffset === minOffset) {
            snapToNearestItem(wheelElement, values);
            return;
        }
        
        wheelMomentumId = requestAnimationFrame(animate);
    }
    
    wheelMomentumId = requestAnimationFrame(animate);
}

// Snap to nearest item
function snapToNearestItem(wheelElement, values) {
    const nearestIndex = Math.round(-wheelCurrentOffset / WHEEL_ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(values.length - 1, nearestIndex));
    const snappedOffset = -clampedIndex * WHEEL_ITEM_HEIGHT;
    
    wheelElement.dataset.offset = snappedOffset;
    
    const itemsContainer = wheelElement.querySelector('.metrum-wheel-items');
    itemsContainer.style.transition = 'transform 0.2s ease-out';
    itemsContainer.style.transform = `translateY(${snappedOffset + (WHEEL_ITEM_HEIGHT * 2)}px)`;
    
    updateWheelStyles(wheelElement, clampedIndex);
    
    // Get the actual value (from repeated array)
    const selectedValue = values[clampedIndex];
    if (wheelElement.dataset.type === 'numerator') {
        editingNumerator = selectedValue;
    } else {
        editingDenominator = selectedValue;
    }
    
    // Update preset selection
    updatePresetSelection();
}

// Update preset selection based on current editing values
function updatePresetSelection() {
    const presets = metrumPresetsGrid.querySelectorAll('.metrum-preset');
    presets.forEach(preset => {
        const num = parseInt(preset.dataset.num);
        const den = parseInt(preset.dataset.den);
        if (num === editingNumerator && den === editingDenominator) {
            preset.classList.add('selected');
        } else {
            preset.classList.remove('selected');
        }
    });
}

// Handle preset click
function handlePresetClick(preset) {
    editingNumerator = parseInt(preset.dataset.num);
    editingDenominator = parseInt(preset.dataset.den);
    
    // Update wheels
    scrollWheelToValue(metrumWheelNumerator, NUMERATOR_VALUES, editingNumerator);
    scrollWheelToValue(metrumWheelDenominator, DENOMINATOR_VALUES, editingDenominator);
    
    // Update selection
    updatePresetSelection();
}

// Scroll wheel to a specific value (positions in second set for looping effect)
function scrollWheelToValue(wheelElement, baseValues, value) {
    const baseIndex = baseValues.indexOf(value);
    if (baseIndex === -1) return;
    
    // Position in the second set (for looping effect)
    const index = baseValues.length + baseIndex;
    
    const offset = -index * WHEEL_ITEM_HEIGHT;
    wheelElement.dataset.offset = offset;
    wheelCurrentOffset = offset;
    
    const itemsContainer = wheelElement.querySelector('.metrum-wheel-items');
    itemsContainer.style.transition = 'transform 0.3s ease-out';
    itemsContainer.style.transform = `translateY(${offset + (WHEEL_ITEM_HEIGHT * 2)}px)`;
    
    updateWheelStyles(wheelElement, index);
}

// Handle click on wheel item to select it
function handleWheelItemClick(wheelElement, item) {
    const index = parseInt(item.dataset.index);
    const value = parseInt(item.dataset.value);
    
    const offset = -index * WHEEL_ITEM_HEIGHT;
    wheelElement.dataset.offset = offset;
    wheelCurrentOffset = offset;
    
    const itemsContainer = wheelElement.querySelector('.metrum-wheel-items');
    itemsContainer.style.transition = 'transform 0.3s ease-out';
    itemsContainer.style.transform = `translateY(${offset + (WHEEL_ITEM_HEIGHT * 2)}px)`;
    
    updateWheelStyles(wheelElement, index);
    playWheelTick();
    
    // Update editing value
    if (wheelElement.dataset.type === 'numerator') {
        editingNumerator = value;
    } else {
        editingDenominator = value;
    }
    
    // Update preset selection
    updatePresetSelection();
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
function playClick(accentLevel) {
    // accentLevel: 0 = silent, 1 = ghost, 2 = normal, 3 = accent
    if (accentLevel === 0) {
        // Silent - still show visual but no sound
        showBeatFlash(false);
        return;
    }
    
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();

    // Frequency and volume based on accent level
    if (accentLevel === 3) {
        osc.frequency.value = 1500;
        envelope.gain.value = 0.7;
    } else if (accentLevel === 2) {
        osc.frequency.value = 1000;
        envelope.gain.value = 0.4;
    } else {
        // Ghost note (level 1) - same as normal but quieter
        osc.frequency.value = 1000;
        envelope.gain.value = 0.12;
    }
    
    envelope.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

    osc.connect(envelope);
    envelope.connect(audioContext.destination);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
    
    // Visual beat flash - LED style
    showBeatFlash(accentLevel === 3);
}

function showBeatFlash(isAccent) {
    if (beatLine) {
        const flashClass = isAccent ? 'beat-flash-accent' : 'beat-flash';
        beatLine.classList.add(flashClass);
        setTimeout(() => {
            beatLine.classList.remove(flashClass);
        }, 180);
    }
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
        playClick(getAccentLevel(currentBeat - 1));

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
        playClick(getAccentLevel(0));
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
    
    // Metrum overlay elements
    metrumOverlay = document.getElementById('metrumOverlay');
    metrumWheelNumerator = document.getElementById('metrumWheelNumerator');
    metrumWheelDenominator = document.getElementById('metrumWheelDenominator');
    metrumPresetsGrid = document.getElementById('metrumPresetsGrid');
    metrumConfirmBtn = document.getElementById('metrumConfirmBtn');
    metrumValueElements = document.querySelectorAll('.metrum-value');
    metrumTrigger = document.querySelector('.metrum');
    
    // Visual feedback element
    beatLine = document.querySelector('.beat-line');

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
        // Prevent default drag behavior
        tempoWheel.addEventListener('dragstart', (e) => e.preventDefault());
        
        // Mouse events
        tempoWheel.addEventListener('mousedown', (e) => {
            // Don't interfere with buttons inside the wheel
            if (e.target.closest('button')) {
                return;
            }
            e.preventDefault();
            handleWheelStart(e.clientX, e.clientY);
        });
        document.addEventListener('mousemove', (e) => {
            handleWheelMove(e.clientX, e.clientY);
        });
        document.addEventListener('mouseup', handleWheelEnd);
        
        // Touch events
        tempoWheel.addEventListener('touchstart', (e) => {
            // Don't interfere with buttons inside the wheel
            if (e.target.closest('button')) {
                return;
            }
            e.preventDefault();
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
    
    // ============ METRUM OVERLAY EVENTS ============
    
    // Click on metrum container to open overlay
    if (metrumTrigger) {
        metrumTrigger.addEventListener('click', openMetrumOverlay);
    }
    
    // Metrum wheel events
    [metrumWheelNumerator, metrumWheelDenominator].forEach(wheel => {
        if (wheel) {
            wheel.addEventListener('mousedown', (e) => handleMetrumWheelStart(e, wheel));
            wheel.addEventListener('touchstart', (e) => handleMetrumWheelStart(e, wheel), { passive: false });
            
            // Click on wheel item to select it (only if not dragged)
            wheel.addEventListener('click', (e) => {
                if (wheelDidDrag) return; // Ignore click after drag
                const item = e.target.closest('.metrum-wheel-item');
                if (item) {
                    handleWheelItemClick(wheel, item);
                }
            });
        }
    });
    
    document.addEventListener('mousemove', handleMetrumWheelMove);
    document.addEventListener('touchmove', handleMetrumWheelMove, { passive: false });
    document.addEventListener('mouseup', handleMetrumWheelEnd);
    document.addEventListener('touchend', handleMetrumWheelEnd);
    
    // Metrum preset clicks
    if (metrumPresetsGrid) {
        metrumPresetsGrid.addEventListener('click', (e) => {
            const preset = e.target.closest('.metrum-preset');
            if (preset) {
                handlePresetClick(preset);
            }
        });
    }
    
    // Metrum confirm button
    if (metrumConfirmBtn) {
        metrumConfirmBtn.addEventListener('click', () => closeMetrumOverlay(true));
    }
    
    // Metrum overlay can only be closed via the confirm button
    // (no click-outside or keyboard shortcuts)
    
    // ============ PANEL SLIDER ============
    
    panelTrack = document.querySelector('.bottom-panel-track');
    accentsGrid = document.getElementById('accentsGrid');
    
    // Initialize accents
    initAccents();
    
    // Handle panel navigation
    document.querySelectorAll('[data-panel]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPanel = parseInt(el.dataset.panel);
            switchToPanel(targetPanel);
        });
    });
});

// Switch to a specific panel
function switchToPanel(panelIndex) {
    currentPanel = panelIndex;
    if (panelTrack) {
        panelTrack.style.transform = `translateX(-${panelIndex * 100}%)`;
    }
    
    // Rebuild accents grid when opening metronome panel
    if (panelIndex === 1) {
        buildAccentsGrid();
    }
}

// ============ ACCENTS ============

// Initialize accents array based on time signature
function initAccents() {
    const numBeats = currentNumerator;
    // Default: first beat is accent (3), others are normal (2)
    accents = Array(numBeats).fill(2);
    accents[0] = 3; // First beat is accented
}

// Build the accents grid UI
function buildAccentsGrid() {
    if (!accentsGrid) return;
    
    const numBeats = currentNumerator;
    
    // Ensure accents array matches current time signature
    if (accents.length !== numBeats) {
        initAccents();
    }
    
    accentsGrid.innerHTML = '';
    
    for (let i = 0; i < numBeats; i++) {
        const column = document.createElement('div');
        column.className = 'accent-column';
        column.dataset.beat = i;
        
        // Create 3 cells (top to bottom: high, mid, low)
        for (let j = 0; j < 3; j++) {
            const cell = document.createElement('div');
            cell.className = 'accent-cell';
            cell.dataset.level = 3 - j; // 3, 2, 1 from top to bottom
            column.appendChild(cell);
        }
        
        // Set initial state
        updateColumnDisplay(column, accents[i]);
        
        // Touch/mouse handlers for swipe and tap
        column.addEventListener('mousedown', (e) => handleAccentDragStart(e, i));
        column.addEventListener('touchstart', (e) => handleAccentDragStart(e, i), { passive: false });
        
        accentsGrid.appendChild(column);
    }
    
    // Add document-level move/end handlers
    document.addEventListener('mousemove', handleAccentDragMove);
    document.addEventListener('touchmove', handleAccentDragMove, { passive: false });
    document.addEventListener('mouseup', handleAccentDragEnd);
    document.addEventListener('touchend', handleAccentDragEnd);
}

// Update column visual based on accent level
function updateColumnDisplay(column, level) {
    const cells = column.querySelectorAll('.accent-cell');
    cells.forEach((cell, index) => {
        const cellLevel = 3 - index; // 3, 2, 1 from top to bottom
        if (cellLevel <= level) {
            cell.classList.add('active');
        } else {
            cell.classList.remove('active');
        }
    });
}

// Cycle accent level: 0 -> 1 -> 2 -> 3 -> 0
function cycleAccent(beatIndex) {
    accents[beatIndex] = (accents[beatIndex] + 1) % 4;
    const column = accentsGrid.children[beatIndex];
    updateColumnDisplay(column, accents[beatIndex]);
    playWheelTick();
}

// Handle accent column drag start
function handleAccentDragStart(e, beatIndex) {
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    accentDragStartY = clientY;
    accentDragBeat = beatIndex;
    accentDragStartLevel = accents[beatIndex];
    accentDidDrag = false;
}

// Find which column is under the given X coordinate
function getColumnAtX(clientX) {
    if (!accentsGrid) return -1;
    
    const columns = accentsGrid.children;
    for (let i = 0; i < columns.length; i++) {
        const rect = columns[i].getBoundingClientRect();
        // Add some slop - extend hit area by half the gap on each side
        const slop = 4; // Half of 4px gap + some extra
        if (clientX >= rect.left - slop && clientX <= rect.right + slop) {
            return i;
        }
    }
    
    // If not directly over a column, find the closest one
    let closestIndex = -1;
    let closestDistance = Infinity;
    for (let i = 0; i < columns.length; i++) {
        const rect = columns[i].getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(clientX - centerX);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
        }
    }
    return closestIndex;
}

// Handle accent column drag move
function handleAccentDragMove(e) {
    if (accentDragBeat === -1) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = accentDragStartY - clientY; // Positive = swipe up
    
    // Check if user moved horizontally to a different column
    const currentColumn = getColumnAtX(clientX);
    if (currentColumn !== -1 && currentColumn !== accentDragBeat) {
        // Switch to new column
        accentDragBeat = currentColumn;
        accentDragStartLevel = accents[currentColumn];
        accentDragStartY = clientY; // Reset Y reference for new column
        accentDidDrag = true;
        playWheelTick();
        return;
    }
    
    // Threshold for level change (40px per level, matching cell height)
    const levelDelta = Math.round(deltaY / 40);
    
    if (Math.abs(deltaY) > 10) {
        accentDidDrag = true;
    }
    
    // Calculate new level
    let newLevel = accentDragStartLevel + levelDelta;
    newLevel = Math.max(0, Math.min(3, newLevel));
    
    // Update if changed
    if (newLevel !== accents[accentDragBeat]) {
        accents[accentDragBeat] = newLevel;
        const column = accentsGrid.children[accentDragBeat];
        updateColumnDisplay(column, newLevel);
        playWheelTick();
    }
}

// Handle accent column drag end
function handleAccentDragEnd() {
    // If no significant drag happened, treat as tap and cycle
    if (accentDragBeat !== -1 && !accentDidDrag) {
        cycleAccent(accentDragBeat);
    }
    accentDragBeat = -1;
    accentDidDrag = false;
}

// Get accent level for a beat (used by metronome)
function getAccentLevel(beat) {
    if (beat < accents.length) {
        return accents[beat];
    }
    return 2; // Default normal
}
