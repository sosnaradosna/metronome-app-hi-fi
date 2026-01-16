// Toast notification
let toastTimeout = null;
let highlightTimeout = null;

function showToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    if (highlightTimeout) {
        clearTimeout(highlightTimeout);
    }
    
    // Show toast
    toast.classList.add('active');
    
    // Highlight available clickable elements
    highlightAvailableElements();
    
    // Hide after 2 seconds
    toastTimeout = setTimeout(() => {
        toast.classList.remove('active');
    }, 2000);
}

function highlightAvailableElements() {
    // Get all available/clickable elements
    const availableElements = [
        // 4th trigger icon (click sound)
        document.querySelectorAll('.metronome-menu .trigger-icon')[3],
        // Nav tabs: metronome and technique
        ...Array.from(document.querySelectorAll('.nav-tab')).filter(tab => {
            const text = tab.textContent.toLowerCase().trim();
            return text === 'metronome' || text === 'technique';
        }),
        // Play button
        document.getElementById('playButton'),
        // Tempo trigger
        document.querySelector('.trigger-tempo'),
        // Metrum trigger
        document.querySelector('.metrum'),
        // Tap button
        document.getElementById('tapButton'),
        // Tempo wheel
        document.querySelector('.tempo-wheel'),
        // Tempo increase/decrease buttons
        document.getElementById('tempoIncrease'),
        document.getElementById('tempoDecrease'),
        // Gap/click interval boxes
        ...document.querySelectorAll('.gap-interval-box'),
        // Tempo interval boxes
        ...document.querySelectorAll('.tempo-interval-box'),
        // Technique category buttons (gap and tempo, not polyrhythm)
        ...Array.from(document.querySelectorAll('#techniqueCategoryMenu .category-btn')).filter(btn => {
            const technique = btn.dataset.technique;
            return technique === 'gap' || technique === 'tempo';
        }),
        // Accents grid items
        ...document.querySelectorAll('.accent-item'),
        // Sound tabs in click sound overlay
        ...document.querySelectorAll('.sound-tab'),
        // Sound tab play buttons
        ...document.querySelectorAll('.sound-tab-play'),
        // Confirm buttons in overlays
        document.getElementById('clickSoundConfirmBtn'),
        document.getElementById('metrumConfirmBtn'),
        document.querySelector('.tempo-key-confirm'),
        document.querySelector('.gap-key-confirm'),
        // Panel close buttons
        ...document.querySelectorAll('.panel-close-btn'),
        // Metrum presets
        ...document.querySelectorAll('.metrum-preset'),
        // Metrum wheels
        ...document.querySelectorAll('.metrum-wheel'),
        // Tempo keyboard keys
        ...document.querySelectorAll('.tempo-key'),
        // Gap overlay keyboard keys
        ...document.querySelectorAll('.gap-key'),
        // Overlay backgrounds (clickable to close)
        document.getElementById('tempoOverlay'),
        document.getElementById('metrumOverlay'),
        document.getElementById('gapOverlay'),
        document.getElementById('clickSoundOverlay'),
        // (Click sound category buttons are NOT available - they show toast)
    ].filter(el => el); // Filter out null/undefined
    
    // Add highlight class
    availableElements.forEach(el => {
        el.classList.add('highlight-available');
    });
    
    // Remove highlight after 1 second
    highlightTimeout = setTimeout(() => {
        availableElements.forEach(el => {
            el.classList.remove('highlight-available');
        });
    }, 1000);
}

// Tempo management
const MIN_TEMPO = 1;
const MAX_TEMPO = 360;

let currentTempo = 120;
let editingTempo = '';
let isFirstInput = true;

// Metrum (time signature) state
let currentNumerator = 4; // Beats per measure (1-32)
let currentDenominator = 4; // Note value (1, 2, 4, 8, 16, 32, 64, 128)
let editingNumerator = 4;
let editingDenominator = 4;
const NUMERATOR_VALUES = Array.from({ length: 16 }, (_, i) => i + 1); // 1 to 16
const DENOMINATOR_VALUES = [1, 2, 4, 8, 16, 32];

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

// Click sound overlay elements
let clickSoundOverlay;
let clickSoundGrid;
let clickSoundConfirmBtn;
let clickSoundTrigger;

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

// Click sound state
let currentClickSound = 'stick';
let editingClickSound = 'stick';
const CLICK_SOUNDS = ['stick', 'cowbell', 'noise', 'wood', 'hi-hat', 'pluck'];
let wasPlayingBeforeOverlay = false; // Track if metronome was playing when overlay opened

// Gap trainer state
let gapValue = 4;
let clickValue = 4;
let editingGapValue = '';
let editingGapType = 'gap'; // 'gap' or 'click'
let isFirstGapInput = true;
const MIN_GAP_VALUE = 1;
const MAX_GAP_VALUE = 999;

// Gap trainer runtime state
let isInTechniquePanel = false;
let gapTrainerBeatCount = 0; // Total beats since metronome started
let warmupComplete = false; // Whether the warm-up measure is done

// Tempo trainer state
let jumpValue = 5;
let intervalValue = 12;
let currentTechniqueMode = 'gap'; // 'gap', 'tempo', 'polyrhythm'
let tempoTrainerMeasureCount = 0;
let tempoTrainerOriginalTempo = 120;

// Gap overlay elements
let gapOverlay;
let gapOverlayValue;
let gapOverlayLabel;
let gapKeys;

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
let wheelTouchStartItem = null; // Store the item touched at start for tap detection

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
    
    // Don't play if context is still suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
        return;
    }

    const now = audioContext.currentTime;

    // Layer 1: Sandy noise for texture
    const bufferSize = audioContext.sampleRate * 0.02;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.25;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2500;
    
    const noiseEnvelope = audioContext.createGain();
    noiseEnvelope.gain.value = 0.06;
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(audioContext.destination);
    noise.start(now);

    // Layer 2: Subtle body (soft thump)
    const body = audioContext.createOscillator();
    const bodyEnvelope = audioContext.createGain();
    
    body.type = 'triangle';
    body.frequency.value = 1800;
    bodyEnvelope.gain.value = 0.04;
    bodyEnvelope.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    body.connect(bodyEnvelope);
    bodyEnvelope.connect(audioContext.destination);
    body.start(now);
    body.stop(now + 0.015);
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
    
    // Save the touched item for tap detection
    const target = e.touches ? document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY) : e.target;
    wheelTouchStartItem = target?.closest('.metrum-wheel-item');

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
function handleMetrumWheelEnd(e) {
    if (!activeWheel) return;

    document.body.classList.remove('dragging');

    const values = getWheelValues(activeWheel);

    // If no drag happened and we have a saved item, treat as tap
    if (!wheelDidDrag && wheelTouchStartItem) {
        handleWheelItemClick(activeWheel, wheelTouchStartItem);
        activeWheel = null;
        wheelTouchStartItem = null;
        return;
    }

    wheelTouchStartItem = null;

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

// ============ TECHNIQUE MODE SWITCHING ============

// Switch between technique modes (gap, tempo)
function switchTechniqueMode(mode) {
    if (mode === currentTechniqueMode) return;
    if (mode === 'polyrhythm') {
        showToast();
        return;
    }
    
    // Stop metronome when switching technique modes
    if (isPlaying) {
        stopMetronome();
    }
    
    // Restore original tempo if leaving tempo trainer mode
    if (currentTechniqueMode === 'tempo') {
        currentTempo = tempoTrainerOriginalTempo;
        updateTempoDisplay(currentTempo);
    }
    
    // Reset tempo trainer state if entering tempo trainer mode
    if (mode === 'tempo') {
        tempoTrainerMeasureCount = 0;
        tempoTrainerOriginalTempo = currentTempo;
    }
    
    // Reset gap trainer state if entering gap trainer mode
    if (mode === 'gap') {
        gapTrainerBeatCount = 0;
        warmupComplete = false;
    }
    
    const gapView = document.getElementById('gapTrainerView');
    const tempoView = document.getElementById('tempoTrainerView');
    const subtitle = document.getElementById('techniqueSubtitle');
    const categoryMenu = document.getElementById('techniqueCategoryMenu');
    
    // Update category buttons
    if (categoryMenu) {
        const buttons = categoryMenu.querySelectorAll('.category-btn');
        buttons.forEach(btn => {
            if (btn.dataset.technique === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Get current and next views
    const currentView = currentTechniqueMode === 'gap' ? gapView : tempoView;
    const nextView = mode === 'gap' ? gapView : tempoView;
    
    // Step 1: Fade out current view and subtitle
    if (currentView) {
        currentView.classList.remove('active');
    }
    if (subtitle) {
        subtitle.style.opacity = '0';
    }
    
    // Trigger shimmer effect immediately
    const techniquePanel = document.querySelector('.panel-technique');
    if (techniquePanel) {
        techniquePanel.classList.remove('shimmer');
        // Force reflow to restart animation
        void techniquePanel.offsetWidth;
        techniquePanel.classList.add('shimmer');
    }

    // Step 2: After fade out, update subtitle and fade in new view
    setTimeout(() => {
        // Update subtitle text
        if (subtitle) {
            if (mode === 'gap') {
                subtitle.textContent = 'gap trainer';
            } else if (mode === 'tempo') {
                subtitle.textContent = 'tempo trainer';
            } else if (mode === 'polyrhythm') {
                subtitle.textContent = 'polyrhythm';
            }
            subtitle.style.opacity = '1';
        }
        
        // Fade in new view
        if (nextView) {
            nextView.classList.add('active');
        }
    }, 300); // Wait for fade out to complete
    
    currentTechniqueMode = mode;
}

// ============ GAP VALUE OVERLAY ============

// Open gap overlay for editing gap, click, jump, or interval value
function openGapOverlay(type) {
    editingGapType = type;
    
    // Get current value based on type
    let currentValue;
    if (type === 'gap') {
        currentValue = gapValue;
    } else if (type === 'click') {
        currentValue = clickValue;
    } else if (type === 'jump') {
        currentValue = jumpValue;
    } else if (type === 'interval') {
        currentValue = intervalValue;
    }
    
    editingGapValue = currentValue.toString();
    gapOverlayValue.textContent = editingGapValue;
    gapOverlayValue.classList.add('selected');
    gapOverlayLabel.textContent = type;
    isFirstGapInput = true;
    gapOverlay.classList.add('active');
}

// Close gap overlay
function closeGapOverlay(save = false) {
    if (save && editingGapValue.length > 0) {
        const newValue = clampGapValue(editingGapValue);
        if (editingGapType === 'gap') {
            gapValue = newValue;
            document.getElementById('gapValue').textContent = gapValue;
        } else if (editingGapType === 'click') {
            clickValue = newValue;
            document.getElementById('clickValue').textContent = clickValue;
        } else if (editingGapType === 'jump') {
            jumpValue = newValue;
            document.getElementById('jumpValue').textContent = jumpValue;
        } else if (editingGapType === 'interval') {
            intervalValue = newValue;
            document.getElementById('intervalValue').textContent = intervalValue;
        }
    }
    gapOverlay.classList.remove('active');
    gapOverlayValue.classList.remove('selected');
    editingGapValue = '';
}

// Get max value based on type
function getMaxValueForType(type) {
    return type === 'jump' ? 99 : 999;
}

// Clamp gap value to valid range
function clampGapValue(value, type = editingGapType) {
    const num = parseInt(value, 10);
    const maxValue = getMaxValueForType(type);
    if (isNaN(num) || num < MIN_GAP_VALUE) return MIN_GAP_VALUE;
    if (num > maxValue) return maxValue;
    return num;
}

// Handle gap keyboard input
function handleGapKeyInput(key) {
    const maxValue = getMaxValueForType(editingGapType);
    const maxDigits = editingGapType === 'jump' ? 2 : 3;
    
    if (key === 'backspace') {
        editingGapValue = editingGapValue.slice(0, -1);
        gapOverlayValue.textContent = editingGapValue || '0';
        gapOverlayValue.classList.remove('selected');
        isFirstGapInput = false;
    } else if (key === 'confirm') {
        closeGapOverlay(true);
    } else {
        // Number key - clear on first input (like selected text)
        if (isFirstGapInput) {
            editingGapValue = key;
            gapOverlayValue.classList.remove('selected');
            isFirstGapInput = false;
        } else if (editingGapValue.length < maxDigits) {
            editingGapValue += key;
        }
        
        // Show what user typed first
        gapOverlayValue.textContent = editingGapValue;
        
        // Dynamic validation with animation if exceeded
        if (parseInt(editingGapValue, 10) > maxValue) {
            gapOverlayValue.classList.add('shake');
            setTimeout(() => {
                editingGapValue = maxValue.toString();
                gapOverlayValue.textContent = editingGapValue;
                gapOverlayValue.classList.remove('shake');
            }, 200);
        }
    }
}

// ============ CLICK SOUND OVERLAY ============

// Open click sound overlay
function openClickSoundOverlay() {
    editingClickSound = currentClickSound;
    previewingSound = null; // Reset preview state
    wasPlayingBeforeOverlay = isPlaying; // Remember if metronome was playing
    updateClickSoundSelection();
    updateSoundTabPlayButtonsState(); // Show current state
    clickSoundOverlay.classList.add('active');
}

// Close click sound overlay
function closeClickSoundOverlay(save = false) {
    // Clear preview
    previewingSound = null;
    
    if (save) {
        currentClickSound = editingClickSound;
    }
    
    // If metronome wasn't playing when we opened the overlay, stop it now
    if (!wasPlayingBeforeOverlay && isPlaying) {
        stopMetronome();
    }
    
    clickSoundOverlay.classList.remove('active');
}

// Update click sound selection in the grid
function updateClickSoundSelection() {
    if (!clickSoundGrid) return;
    
    const tabs = clickSoundGrid.querySelectorAll('.sound-tab');
    tabs.forEach(tab => {
        if (tab.dataset.sound === editingClickSound) {
            tab.classList.add('selected');
        } else {
            tab.classList.remove('selected');
        }
    });
}

// Handle sound tab click (selecting a tab)
function handleSoundTabClick(tab) {
    const sound = tab.dataset.sound;
    if (sound) {
        editingClickSound = sound;
        updateClickSoundSelection();
        
        // If metronome is playing, also switch to this sound
        if (isPlaying) {
            previewingSound = sound;
            updateSoundTabPlayButtonsState(true);
        }
    }
}

// Track which sound is being previewed with the metronome
let previewingSound = null;

// Toggle metronome preview for a specific sound (play button only - no selection change)
function toggleSoundPreview(sound) {
    if (!audioContext) {
        initAudioContext();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Get currently active sound (preview or current)
    const activeSound = previewingSound || currentClickSound;
    
    if (!isPlaying) {
        // Metronome not playing - start it with this sound as preview (no selection change)
        previewingSound = sound;
        startMetronome();
        updateSoundTabPlayButtonsState(true);
    } else if (activeSound === sound) {
        // Clicking pause on currently playing sound - stop the metronome
        stopMetronome();
        previewingSound = null;
        updateSoundTabPlayButtonsState(false);
    } else {
        // Preview a different sound without selecting it
        previewingSound = sound;
        updateSoundTabPlayButtonsState(true);
    }
}

// Update all sound tab play button icons based on current state
// playingOverride: if provided, use this instead of isPlaying (for timing issues)
function updateSoundTabPlayButtonsState(playingOverride) {
    if (!clickSoundGrid) return;
    
    const playing = playingOverride !== undefined ? playingOverride : isPlaying;
    
    // Determine which sound is currently "active" (playing)
    const activeSound = playing ? (previewingSound || currentClickSound) : null;
    
    const tabs = clickSoundGrid.querySelectorAll('.sound-tab');
    tabs.forEach(tab => {
        const playBtn = tab.querySelector('.sound-tab-play img');
        if (!playBtn) return;
        
        if (activeSound && tab.dataset.sound === activeSound) {
            playBtn.src = 'icons/ic_pause.svg';
            playBtn.alt = 'Pause';
        } else {
            playBtn.src = 'icons/ic_play/M.svg';
            playBtn.alt = 'Play';
        }
    });
}

// Update all sound tab play button icons
function updateSoundTabPlayButtons() {
    updateSoundTabPlayButtonsState();
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

// Check if current beat should be muted by gap trainer
function shouldMuteForGapTrainer() {
    if (!isInTechniquePanel) return false;
    if (currentTechniqueMode !== 'gap') return false; // Only apply in gap trainer mode
    if (!warmupComplete) return false;
    
    // Calculate position in the gap+click cycle
    const cycleLength = gapValue + clickValue;
    const positionInCycle = gapTrainerBeatCount % cycleLength;
    
    // First 'gapValue' beats in cycle are muted
    return positionInCycle < gapValue;
}

// Handle tempo trainer measure completion
function handleTempoTrainerMeasure() {
    if (!isInTechniquePanel) return;
    if (currentTechniqueMode !== 'tempo') return;
    
    tempoTrainerMeasureCount++;
    
    // Check if we've completed 'interval' measures
    if (tempoTrainerMeasureCount >= intervalValue) {
        tempoTrainerMeasureCount = 0;
        
        // Increase tempo by jump value, but don't exceed max
        const newTempo = Math.min(currentTempo + jumpValue, MAX_TEMPO);
        if (newTempo !== currentTempo) {
            currentTempo = newTempo;
            updateTempoDisplay(currentTempo);
        }
    }
}

// Play a click sound
function playClick(accentLevel) {
    // Check if this beat should be muted by gap trainer (check BEFORE incrementing)
    const shouldMute = shouldMuteForGapTrainer();
    
    // Increment gap trainer beat count (after warmup)
    if (isInTechniquePanel && warmupComplete) {
        gapTrainerBeatCount++;
    }
    
    if (shouldMute) {
        // Muted - show visual but no sound
        showBeatFlash(false);
        return;
    }
    
    // Use previewing sound if in preview mode, otherwise use current sound
    const soundToPlay = previewingSound || currentClickSound;
    playClickWithSound(soundToPlay, accentLevel);
}

// Play a click sound with a specific sound type
function playClickWithSound(sound, accentLevel) {
    // accentLevel: 0 = silent, 1 = ghost, 2 = normal, 3 = accent
    if (accentLevel === 0) {
        // Silent - still show visual but no sound
        showBeatFlash(false);
        return;
    }
    
    const now = audioContext.currentTime;
    
    // Base volume based on accent level
    let baseVolume;
    if (accentLevel === 3) {
        baseVolume = 0.7;
    } else if (accentLevel === 2) {
        baseVolume = 0.4;
    } else {
        baseVolume = 0.12;
    }
    
    switch (sound) {
        case 'stick':
            playStickSound(now, baseVolume, accentLevel);
            break;
        case 'cowbell':
            playCowbellSound(now, baseVolume, accentLevel);
            break;
        case 'noise':
            playNoiseSound(now, baseVolume, accentLevel);
            break;
        case 'wood':
            playWoodSound(now, baseVolume, accentLevel);
            break;
        case 'hi-hat':
            playHiHatSound(now, baseVolume, accentLevel);
            break;
        case 'pluck':
            playPluckSound(now, baseVolume, accentLevel);
            break;
        default:
            playStickSound(now, baseVolume, accentLevel);
    }
    
    // Visual beat flash - LED style
    showBeatFlash(accentLevel === 3);
}

// Stick sound - classic metronome click
function playStickSound(now, volume, accentLevel) {
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    osc.frequency.value = accentLevel === 3 ? 1500 : 1000;
    envelope.gain.value = volume;
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(envelope);
    envelope.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.05);
}

// Cowbell sound - metallic ring
function playCowbellSound(now, volume, accentLevel) {
    // Main tone
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    osc1.type = 'square';
    osc1.frequency.value = accentLevel === 3 ? 800 : 587;
    osc2.type = 'square';
    osc2.frequency.value = accentLevel === 3 ? 540 : 420;
    
    envelope.gain.value = volume * 0.4;
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc1.connect(envelope);
    osc2.connect(envelope);
    envelope.connect(audioContext.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
}

// Noise sound - white noise burst (like hi-hat but different character)
function playNoiseSound(now, volume, accentLevel) {
    const duration = accentLevel === 3 ? 0.08 : 0.05;
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    // Bandpass filter for character
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = accentLevel === 3 ? 4000 : 3000;
    filter.Q.value = 1.5;
    
    const envelope = audioContext.createGain();
    envelope.gain.setValueAtTime(volume * 0.8, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(audioContext.destination);
    noise.start(now);
}

// Wood sound - wooden block
function playWoodSound(now, volume, accentLevel) {
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = accentLevel === 3 ? 800 : 600;
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);
    
    envelope.gain.value = volume * 0.8;
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    
    osc.connect(envelope);
    envelope.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.06);
}

// Hi-hat sound - cymbal-like
function playHiHatSound(now, volume, accentLevel) {
    const bufferSize = audioContext.sampleRate * 0.1;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = accentLevel === 3 ? 8000 : 6000;
    
    const envelope = audioContext.createGain();
    envelope.gain.value = volume * 0.5;
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    noise.connect(highpass);
    highpass.connect(envelope);
    envelope.connect(audioContext.destination);
    noise.start(now);
}

// Pluck sound - string-like
function playPluckSound(now, volume, accentLevel) {
    const osc = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = accentLevel === 3 ? 440 : 330;
    
    envelope.gain.value = volume * 0.6;
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.1);
    
    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.12);
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

// Calculate interval in ms from tempo, adjusted for time signature denominator
function getIntervalMs() {
    // Base interval for quarter note (denominator = 4)
    const quarterNoteInterval = (60 / currentTempo) * 1000;
    // Adjust for actual denominator: if 8th note (8), halve the interval; if half note (2), double it
    return quarterNoteInterval * (4 / currentDenominator);
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
            // Mark warmup as complete after first full measure
            if (isInTechniquePanel && !warmupComplete) {
                warmupComplete = true;
            }
            // Handle tempo trainer measure completion
            handleTempoTrainerMeasure();
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
    
    // Reset gap trainer state
    gapTrainerBeatCount = 0;
    warmupComplete = false;
    
    // Reset tempo trainer state
    tempoTrainerMeasureCount = 0;
    tempoTrainerOriginalTempo = currentTempo;
    
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
    
    // Reset tempo to original if stopping while in tempo trainer mode
    if (isInTechniquePanel && currentTechniqueMode === 'tempo') {
        currentTempo = tempoTrainerOriginalTempo;
        updateTempoDisplay(currentTempo);
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
    // Initialize audio context on first user interaction
    const initAudioOnFirstTouch = () => {
        initAudioContext();
        document.removeEventListener('touchstart', initAudioOnFirstTouch);
        document.removeEventListener('mousedown', initAudioOnFirstTouch);
    };
    document.addEventListener('touchstart', initAudioOnFirstTouch, { once: true });
    document.addEventListener('mousedown', initAudioOnFirstTouch, { once: true });

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
        // Tempo overlay
        if (tempoOverlay && tempoOverlay.classList.contains('active')) {
            if (e.key >= '0' && e.key <= '9') {
                handleKeyInput(e.key);
            } else if (e.key === 'Backspace') {
                handleKeyInput('backspace');
            } else if (e.key === 'Enter') {
                handleKeyInput('confirm');
            } else if (e.key === 'Escape') {
                closeTempoOverlay(false);
            }
            return;
        }
        
        // Gap overlay
        if (gapOverlay && gapOverlay.classList.contains('active')) {
            if (e.key >= '0' && e.key <= '9') {
                handleGapKeyInput(e.key);
            } else if (e.key === 'Backspace') {
                handleGapKeyInput('backspace');
            } else if (e.key === 'Enter') {
                handleGapKeyInput('confirm');
            } else if (e.key === 'Escape') {
                closeGapOverlay(false);
            }
            return;
        }
    });
    
    // ============ GAP OVERLAY ELEMENTS ============
    
    gapOverlay = document.getElementById('gapOverlay');
    gapOverlayValue = document.getElementById('gapOverlayValue');
    gapOverlayLabel = document.getElementById('gapOverlayLabel');
    gapKeys = document.querySelectorAll('.gap-key');
    
    // Gap interval box clicks
    const gapIntervalBoxes = document.querySelectorAll('.gap-interval-box');
    gapIntervalBoxes.forEach((box) => {
        box.addEventListener('click', () => {
            const type = box.dataset.type;
            openGapOverlay(type);
        });
    });
    
    // Tempo interval box clicks
    const tempoIntervalBoxes = document.querySelectorAll('.tempo-interval-box');
    tempoIntervalBoxes.forEach((box) => {
        box.addEventListener('click', () => {
            const type = box.dataset.type;
            openGapOverlay(type);
        });
    });
    
    // Technique category menu clicks
    const techniqueCategoryMenu = document.getElementById('techniqueCategoryMenu');
    if (techniqueCategoryMenu) {
        techniqueCategoryMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn');
            if (btn && btn.dataset.technique) {
                switchTechniqueMode(btn.dataset.technique);
            }
        });
    }
    
    // Gap keyboard clicks
    gapKeys.forEach(key => {
        key.addEventListener('click', () => {
            handleGapKeyInput(key.dataset.key);
        });
    });
    
    // Close gap overlay when clicking outside the keyboard
    if (gapOverlay) {
        gapOverlay.addEventListener('click', (e) => {
            if (e.target === gapOverlay || e.target.closest('.gap-overlay-display')) {
                closeGapOverlay(false);
            }
        });
    }
    
    // ============ CLICK SOUND OVERLAY ELEMENTS ============
    
    clickSoundOverlay = document.getElementById('clickSoundOverlay');
    clickSoundGrid = document.getElementById('clickSoundGrid');
    clickSoundConfirmBtn = document.getElementById('clickSoundConfirmBtn');
    
    // The 4th trigger-icon is the click sound trigger (index 3)
    const triggerIcons = document.querySelectorAll('.metronome-menu .trigger-icon');
    if (triggerIcons.length >= 4) {
        clickSoundTrigger = triggerIcons[3];
    }
    
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
    
    // ============ CLICK SOUND OVERLAY EVENTS ============
    
    // Click on click sound trigger to open overlay
    if (clickSoundTrigger) {
        clickSoundTrigger.addEventListener('click', openClickSoundOverlay);
    }
    
    // Click sound tab clicks
    if (clickSoundGrid) {
        clickSoundGrid.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.sound-tab-play');
            const tab = e.target.closest('.sound-tab');
            
            if (playBtn && tab) {
                // Clicked on play button - toggle metronome preview with this sound
                e.stopPropagation();
                const sound = tab.dataset.sound;
                if (sound) {
                    toggleSoundPreview(sound);
                }
            } else if (tab) {
                // Clicked on tab - select it
                handleSoundTabClick(tab);
            }
        });
    }
    
    // Click sound confirm button
    if (clickSoundConfirmBtn) {
        clickSoundConfirmBtn.addEventListener('click', () => closeClickSoundOverlay(true));
    }
    
    // Close click sound overlay when clicking outside the bottom sheet (on dark background)
    if (clickSoundOverlay) {
        clickSoundOverlay.addEventListener('click', (e) => {
            // Close if click is not inside the bottom sheet
            if (!e.target.closest('.click-sound-bottom-sheet')) {
                closeClickSoundOverlay(false);
            }
        });
    }
    
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
    
    // ============ TOAST NOTIFICATIONS FOR UNAVAILABLE FEATURES ============
    
    // First 3 trigger icons in metronome menu (indices 0, 1, 2)
    const toastTriggerIcons = document.querySelectorAll('.metronome-menu .trigger-icon');
    toastTriggerIcons.forEach((icon, index) => {
        if (index < 3) { // First 3 icons
            icon.addEventListener('click', showToast);
        }
    });
    
    // Nav tabs: musicality, live, account, settings (not metronome and technique)
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        const text = tab.textContent.toLowerCase().trim();
        if (text === 'musicality' || text === 'live' || text === 'account' || text === 'settings') {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                showToast();
            });
        }
    });
    
    // Category buttons in metronome panel (both buttons)
    const metronomeCategoryBtns = document.querySelectorAll('.panel-metronome .panel-category-menu .category-btn');
    metronomeCategoryBtns.forEach(btn => {
        btn.addEventListener('click', showToast);
    });
    
    // Category buttons in click sound overlay (both buttons)
    const clickSoundCategoryBtns = document.querySelectorAll('.click-sound-category-menu .category-btn');
    clickSoundCategoryBtns.forEach(btn => {
        btn.addEventListener('click', showToast);
    });
});

// Switch to a specific panel
function switchToPanel(panelIndex) {
    currentPanel = panelIndex;
    
    // Get all detail panels
    const metronomePanel = document.querySelector('.panel-metronome');
    const techniquePanel = document.querySelector('.panel-technique');
    
    // Remove active from all detail panels
    if (metronomePanel) metronomePanel.classList.remove('active');
    if (techniquePanel) techniquePanel.classList.remove('active');
    
    // Toggle panel-open class on track to push menu
    if (panelTrack) {
        if (panelIndex === 0) {
            panelTrack.classList.remove('panel-open');
        } else {
            panelTrack.classList.add('panel-open');
        }
    }
    
    // Check if we're leaving technique panel
    const wasInTechniquePanel = isInTechniquePanel;
    const wasInTempoTrainer = isInTechniquePanel && currentTechniqueMode === 'tempo';
    
    // Activate the appropriate panel
    if (panelIndex === 1 && metronomePanel) {
        metronomePanel.classList.add('active');
        buildAccentsGrid();
        // Stop metronome when leaving technique panel
        if (wasInTechniquePanel && isPlaying) {
            stopMetronome();
        }
        if (wasInTempoTrainer) {
            currentTempo = tempoTrainerOriginalTempo;
            updateTempoDisplay(currentTempo);
        }
        isInTechniquePanel = false;
    } else if (panelIndex === 2 && techniquePanel) {
        techniquePanel.classList.add('active');
        // Stop metronome when entering technique panel
        if (isPlaying) {
            stopMetronome();
        }
        isInTechniquePanel = true;
        // Reset tempo trainer state when entering technique panel
        tempoTrainerMeasureCount = 0;
        tempoTrainerOriginalTempo = currentTempo;
    } else {
        // panelIndex === 0 means show menu (no detail panel active)
        // Stop metronome when leaving technique panel
        if (wasInTechniquePanel && isPlaying) {
            stopMetronome();
        }
        if (wasInTempoTrainer) {
            currentTempo = tempoTrainerOriginalTempo;
            updateTempoDisplay(currentTempo);
        }
        isInTechniquePanel = false;
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
