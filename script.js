// --- GAME STATE & CONFIGURATION ---

let gameState = {
    score: 0,
    level: 1,
    unlockedPlots: 1, // Start with one plot unlocked
    currentPattern: [],
    playerInput: [],
    isPlaying: false,
    isListening: false,
    plants: 1,
    isMuted: false,
    timeoutIds: [],
    selectedSeed: '🌻',
    gardenSlots: ['🌻', ...Array(31).fill(null)],
    earnedPoints: { '🌻': 0, '🌹': 0, '🌷': 0, '🌺': 0, '🌸': 0, '🌼': 0 }
};

const plantProperties = {
    '🌻': { name: 'Sunflower', points: 10 },
    '🌹': { name: 'Rose', points: 15 },
    '🌷': { name: 'Tulip', points: 12 },
    '🌺': { name: 'Hibiscus', points: 18 },
    '🌸': { name: 'Cherry Blossom', points: 20 },
    '🌼': { name: 'Daisy', points: 8 }
};

const NOTE_FREQUENCIES = [261.63, 329.63, 392.00, 493.88]; // C4, E4, G4, B4

// --- AUDIO & FEEDBACK ---

let audioContext;
let masterGainNode;
let speechSynth = window.speechSynthesis;
let voices = [];

function initAudio() {
    if (audioContext) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = gameState.isMuted ? 0 : 1;
        masterGainNode.connect(audioContext.destination);
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.");
    }
}

function playNote(noteIndex) {
    if (!audioContext || gameState.isMuted) return;
    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(NOTE_FREQUENCIES[noteIndex], audioContext.currentTime);
    
    noteGain.gain.setValueAtTime(0.5, audioContext.currentTime);
    noteGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    oscillator.connect(noteGain);
    noteGain.connect(masterGainNode);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

function playClickSound() {
    if (!audioContext || gameState.isMuted) return;
    const oscillator = audioContext.createOscillator();
    const clickGain = audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note

    clickGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

    oscillator.connect(clickGain);
    clickGain.connect(masterGainNode);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function triggerVibration(duration = 50) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

function speak(text) {
    if (gameState.isMuted || !speechSynth) return;
    speechSynth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Female')) || voices.find(v => v.lang.includes('en'));
    utterance.voice = preferredVoice || voices[0];
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    speechSynth.speak(utterance);
}

// --- UI & GAME LOGIC ---

function setupGarden() {
    const garden = document.getElementById('garden');
    garden.innerHTML = ''; // Clear the old garden before drawing the new one

    // Loop through our saved garden state
    gameState.gardenSlots.forEach((seed, index) => {
        const slot = document.createElement('div');
        slot.classList.add('plant-slot');
        slot.setAttribute('tabindex', '0');
        slot.setAttribute('role', 'button');
        
        // Is this plot still locked?
        if (index >= gameState.unlockedPlots) {
            slot.classList.add('locked');
            slot.innerHTML = '🔒';
            slot.setAttribute('aria-label', 'Locked plant slot');
            slot.addEventListener('click', () => {
                playClickSound();
                triggerVibration(20);
                const pointsNeeded = (gameState.unlockedPlots + 1) * 10;
                updateStatus(`🌱 Score ${pointsNeeded} to unlock this plot!`);
                showFloatingMessage("❌ Plot locked!", 'error');
            });
        } 
        // Is there a seed planted here in our saved state?
        else if (seed) {
            slot.textContent = seed;
            slot.classList.add('planted');
            slot.setAttribute('aria-label', `${plantProperties[seed].name} planted`);
        } 
        // Otherwise, it's an empty, unlocked plot
        else {
            slot.setAttribute('aria-label', 'Empty plant slot');
            // Add a listener for manual planting, passing the plot's index
            slot.addEventListener('click', () => plantSeed(index));
        }
        garden.appendChild(slot);
    });
}

function plantSeed(index) {
    playClickSound();
    triggerVibration(30);

    const seed = gameState.selectedSeed;
    const pointsNeeded = 10;

    if (gameState.earnedPoints[seed] < pointsNeeded) {
        speak(`You need ${pointsNeeded} points with the ${plantProperties[seed].name} to plant it.`);
        showFloatingMessage(`❌ Earn ${pointsNeeded} ${seed} points`, 'error');
        updateStatus(`🔒 Earn points with ${seed} to plant it.`);
        return;
    }

    // Save the new plant to our state array
    gameState.gardenSlots[index] = seed;
    gameState.plants++;
    
    // Redraw the entire garden with the new state
    setupGarden(); 
    updateScore();
    showFloatingMessage("🌱 Planted!", 'success');
    updateStatus(`🌼 You planted a ${plantProperties[seed].name}!`);

     checkGameCompletion();
}

function startNewPattern() {
    gameState.currentPattern = Array.from({ length: gameState.level + 1 }, () => Math.floor(Math.random() * 4));
    gameState.playerInput = [];
    gameState.isListening = false;
    updateStatus("🎧 Listen to the pattern...");
    playPattern();
}

function replayPattern() {
    if (!gameState.currentPattern.length) return;
    updateStatus("🎧 Replaying pattern...");
    playPattern();
}

function playPattern() {
    disableButtons(true);
    gameState.timeoutIds.forEach(clearTimeout);
    gameState.timeoutIds = [];
    
    gameState.currentPattern.forEach((note, index) => {
        const timeout = setTimeout(() => {
            const btn = document.querySelector(`.rhythm-btn[data-note='${note}']`);
            
            // CHECK if the game is muted and provide alternate feedback
            if (gameState.isMuted) {
                triggerVibration(150); // A distinct haptic pulse for the note
                btn.classList.add('is-glowing');
                setTimeout(() => btn.classList.remove('is-glowing'), 400);
            } else {
                playNote(note); // Play sound only if not muted
                btn.classList.add('is-playing');
                setTimeout(() => btn.classList.remove('is-playing'), 300);
            }

        }, 800 * (index + 1));
        gameState.timeoutIds.push(timeout);
    });

    setTimeout(() => {
        enableButtons();
        updateStatus("🎵 Now, it's your turn!");
        gameState.isListening = true;
    }, 800 * (gameState.currentPattern.length + 1));
}

function checkInput() {
    const current = gameState.playerInput.length - 1;
    if (gameState.playerInput[current] !== gameState.currentPattern[current]) {
        handleMistake();
        return;
    }
    if (gameState.playerInput.length === gameState.currentPattern.length) {
        handleSuccess();
    }
}

function handleSuccess() {
    const seed = gameState.selectedSeed;
    const plant = plantProperties[seed];
    gameState.score += plant.points;
    gameState.level++;
    gameState.earnedPoints[seed] += plant.points;
    
    updateScore();
    showFloatingMessage("🌟 Success!", 'success');
    updateStatus("Great job! Starting next pattern...");
    speak("Excellent!");

    setTimeout(startNewPattern, 2000);
}

function handleMistake() {
    gameState.isListening = false;
    showFloatingMessage("❌ Oops!", 'error');
    updateStatus("Wrong note! Try again.");
    speak("Try again.");
    
    // Allow the user to try the same pattern again
    setTimeout(() => {
        gameState.playerInput = [];
        gameState.isListening = true;
        updateStatus("🎵 Give it another try!");
    }, 2000);
}

function resetGame() {
    const isMuted = gameState.isMuted; 
    gameState = {
        score: 0,
        level: 1,
        unlockedPlots: 1,
        currentPattern: [],
        playerInput: [],
        isPlaying: false,
        isListening: false,
        plants: 1,
        isMuted: gameState.isMuted,
        timeoutIds: [],
        gardenSlots: ['🌻', ...Array(31).fill(null)],
        selectedSeed: '🌻',
        earnedPoints: { '🌻': 0, '🌹': 0, '🌷': 0, '🌺': 0, '🌸': 0, '🌼': 0 }
    };
    setupGarden();
    updateScore();
    updateProgress();
    updateStatus("🎯 Click a button or press Start!");
    document.getElementById('replayBtn').disabled = true;
}

// --- UTILITY & UI UPDATE FUNCTIONS ---

function updateScore() {
 
    const newUnlocked = Math.min(28, Math.floor(gameState.score / 10) + 1);
    if (newUnlocked > gameState.unlockedPlots) {
        // Save the new plant to our state array at the newly unlocked index
        const newIndex = gameState.unlockedPlots;
        gameState.gardenSlots[newIndex] = gameState.selectedSeed;
        
        gameState.unlockedPlots = newUnlocked;
        gameState.plants++;
        
        // Redraw the garden, which will now include the auto-planted flower
        setupGarden(); 
        
        showFloatingMessage(`🌱 Plot Unlocked & Planted!`, 'success');
        speak("New plot unlocked and a flower has been planted!");

        checkGameCompletion();
    }

    // Update the visual display for score, level, and plants
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('plantCount').textContent = gameState.plants;
}

function updateStatus(message) {
    document.getElementById('gameStatus').textContent = message;
}

function updateProgress() {
    const progress = ((gameState.level -1) % 10 / 10) * 100;
    document.getElementById('progress').style.width = `${progress}%`;
}

function disableButtons(isPatternPlaying = false) {
    document.querySelectorAll('.rhythm-btn, .control-btn').forEach(btn => btn.disabled = true);
    if (!isPatternPlaying) {
        document.getElementById('replayBtn').disabled = false;
    }
}

function enableButtons() {
    document.querySelectorAll('.rhythm-btn, .control-btn').forEach(btn => btn.disabled = false);
}

function selectSeed(seed) {
    gameState.selectedSeed = seed;
    document.querySelectorAll('.seed-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.seed === seed);
    });
}

function toggleHighContrast() {
    document.body.classList.toggle('high-contrast');
}

function toggleMute() {
    gameState.isMuted = !gameState.isMuted;
    const btn = document.getElementById('muteBtn');
    btn.innerHTML = gameState.isMuted ? '🔇' : '🔊';
    
    if (audioContext) {
        masterGainNode.gain.setValueAtTime(gameState.isMuted ? 0 : 1, audioContext.currentTime);
    }
    if (gameState.isMuted) {
        speechSynth.cancel();
    }
}

function showFloatingMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `floating-message ${type}-message`;
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
}

function showInstructions() {
    document.getElementById('instructionsModal').style.display = 'flex';
}

function closeInstructions() {
    document.getElementById('instructionsModal').style.display = 'none';
}

function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 25; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = `${Math.random() * 100}%`;
        p.style.top = `${Math.random() * 100}%`;
        p.style.animationDelay = `${Math.random() * 6}s`;
        p.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
        container.appendChild(p);
    }
}

// --- INITIALIZATION ---

window.onload = () => {

    if (!localStorage.getItem('hasSeenInstructions')) {
        showInstructions();
        localStorage.setItem('hasSeenInstructions', 'true');
    }
    // Defer audio initialization until first user interaction
    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('keydown', initAudio, { once: true });
    
    // Load speech synthesis voices
    speechSynth.onvoiceschanged = () => { voices = speechSynth.getVoices(); };
    voices = speechSynth.getVoices();

    setupGarden();
    updateScore();
    createParticles();

    document.querySelectorAll('.rhythm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const note = parseInt(btn.dataset.note);
            playNote(note);
            triggerVibration(50);
            if (gameState.isListening) {
               btn.classList.add('is-playing');
                setTimeout(() => btn.classList.remove('is-playing'), 300);

                gameState.playerInput.push(note);
                checkInput();
            }
        });
    });

    document.addEventListener('keydown', e => {
        const keyMap = { 'q': 0, 'w': 1, 'a': 2, 's': 3 };
        if (keyMap.hasOwnProperty(e.key.toLowerCase())) {
            const btn = document.querySelector(`.rhythm-btn[data-note='${keyMap[e.key.toLowerCase()]}']`);
            if (btn && !btn.disabled) {
                btn.click();
            }
        }
    });
};
function checkGameCompletion() {
    // Check if the number of plants has reached the total number of plots (18)
    if (gameState.plants >= 18) {
        disableButtons(true); // Disable all buttons
        updateStatus("🎉 Garden Complete! 🎉");
        showFloatingMessage("🌺 Your garden is complete!", 'success');
        speak("Congratulations! Your rhythm garden is magnificent! The garden will now be reborn.");

        // Wait 4 seconds before refreshing the page
        setTimeout(() => {
            location.reload();
        }, 4000);
    }
}