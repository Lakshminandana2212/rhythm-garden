
    // Game state
    let gameState = {
        unlockedPlots: 0,
        score: 0,
        level: 1,
        currentPattern: [],
        playerInput: [],
        isPlaying: false,
        isListening: false,
        plants: 0,
        isMuted: false,
        timeoutIds: [],
        selectedSeed: '🌻',
        plantedSeeds: [],
        combo: 0,
        totalPatterns: 0,
        // NEW: Per-plant score tracking
        earnedPoints: {
            '🌻': 0,
            '🌹': 0,
            '🌷': 0,
            '🌺': 0,
            '🌸': 0,
            '🌼': 0
        }
    };

    // Audio context and voice synthesis
    let audioContext;
    let gainNode;
    let speechSynth = window.speechSynthesis;
    let voices = [];

    // Plant properties for different seeds
    const plantProperties = {
        '🌻': { name: 'Sunflower', points: 10, sound: 'sunny' },
        '🌹': { name: 'Rose', points: 15, sound: 'romantic' },
        '🌷': { name: 'Tulip', points: 12, sound: 'spring' },
        '🌺': { name: 'Hibiscus', points: 18, sound: 'tropical' },
        '🌸': { name: 'Cherry Blossom', points: 20, sound: 'delicate' },
        '🌼': { name: 'Daisy', points: 8, sound: 'cheerful' }
    };

    // Encouraging phrases for success
    const successPhrases = [
        "Fantastic! Your garden is blooming beautifully!",
        "Perfect rhythm! You're a natural gardener!",
        "Amazing work! Keep that musical magic flowing!",
        "Spectacular! Your plants are dancing with joy!",
        "Incredible! You've got the rhythm of nature!",
        "Outstanding! Your garden sings with harmony!",
        "Brilliant performance! Mother Nature is impressed!",
        "Wonderful! Your musical garden is thriving!"
    ];

    // Encouraging phrases for errors
    const encouragementPhrases = [
        "Almost there! Try listening carefully to the rhythm!",
        "Don't worry! Every gardener learns from practice!",
        "So close! Feel the beat and try again!",
        "Keep going! Your garden believes in you!",
        "That's okay! Even the best musicians need practice!",
        "Try again! Listen with your heart this time!",
        "No worries! Rome wasn't built in a day, neither are gardens!",
        "Keep trying! Your plants are cheering you on!"
    ];

    // Load voices when available
    function loadVoices() {
        voices = speechSynth.getVoices();
        if (voices.length === 0) {
            setTimeout(loadVoices, 100);
        }
    }

    // Speak text with emotion
    function speak(text, options = {}) {
        if (gameState.isMuted) {
            // Enhanced visual feedback when muted
            document.body.classList.add('vibrate');
            setTimeout(() => document.body.classList.remove('vibrate'), 500);
            return;
        }

        speechSynth.cancel(); // Cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);

        // Find a suitable voice
        const preferredVoice = voices.find(voice =>
            voice.lang.includes('en') &&
            (voice.name.includes('Female') || voice.name.includes('Google'))
        ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
        // Game state continued...
        utterance.voice = preferredVoice || voices[0];
        utterance.rate = options.rate || 1;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;

        speechSynth.speak(utterance);
    }

    // Toggle high contrast
    function toggleHighContrast() {
        document.body.classList.toggle('high-contrast');
    }

    // Toggle mute
    function toggleMute() {
        gameState.isMuted = !gameState.isMuted;
        const btn = document.querySelector("[onclick='toggleMute()']");
        btn.textContent = gameState.isMuted ? '🔇 Muted' : '🔊 Sound';
    }

    // Show and hide instructions
    function showInstructions() {
        document.getElementById('instructionsModal').style.display = 'flex';
    }

    function closeInstructions() {
        document.getElementById('instructionsModal').style.display = 'none';
    }

    // Initialize
    window.onload = () => {
        loadVoices();
        setupGarden();
        bindControls();
    };
function setupGarden() {
    const garden = document.getElementById('garden');
    garden.innerHTML = '';
    for (let i = 0; i < 18; i++) {
        const slot = document.createElement('div');
        slot.classList.add('plant-slot');
        slot.setAttribute('tabindex', '0');
        slot.setAttribute('role', 'button');

        if (i >= gameState.unlockedPlots) {
            slot.classList.add('locked');
            slot.setAttribute('aria-label', 'Locked plant slot');
            slot.innerHTML = '🔒';
            slot.addEventListener('click', () => {
                speak("This plot is still locked. Earn more points to unlock new plots.");
                showFloatingMessage("❌ Plot locked!", 'error');
                updateStatus("🌱 Get more points to unlock this plot.");
            });
        } else {
            slot.setAttribute('aria-label', 'Empty plant slot');
            slot.addEventListener('click', () => plantSeed(slot));
        }

        garden.appendChild(slot);
    }
}

    // // Setup garden slots
    // function setupGarden() {
    //     const garden = document.getElementById('garden');
    //     for (let i = 0; i < 18; i++) {
    //         const slot = document.createElement('div');
    //         slot.classList.add('plant-slot');
    //         slot.setAttribute('tabindex', '0');
    //         slot.setAttribute('role', 'button');
    //         slot.setAttribute('aria-label', 'Empty plant slot');
    //         slot.addEventListener('click', () => plantSeed(slot));
    //         garden.appendChild(slot);
    //     }
    // }

    // Seed selector
    function selectSeed(seed) {
        gameState.selectedSeed = seed;
        document.querySelectorAll('.seed-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.seed === seed) btn.classList.add('selected');
        });
    }

    // Start new rhythm pattern
    function startNewPattern() {
        gameState.currentPattern = Array.from({length: gameState.level + 1}, () => Math.floor(Math.random() * 4));
        gameState.playerInput = [];
        gameState.isPlaying = true;
        gameState.isListening = false;
        updateStatus("🎧 Listen to the pattern...");
        playPattern();
    }

    // Replay pattern
    function replayPattern() {
        if (!gameState.currentPattern.length) return;
        updateStatus("🎧 Replaying pattern...");
        playPattern();
    }

    // Play pattern
    function playPattern() {
        disableButtons();
        gameState.timeoutIds.forEach(clearTimeout);
        gameState.timeoutIds = [];
        const buttons = document.querySelectorAll('.rhythm-btn');
        gameState.currentPattern.forEach((note, index) => {
            const timeout = setTimeout(() => {
                const btn = buttons[note];
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 500);
            }, 800 * index);
            gameState.timeoutIds.push(timeout);
        });
        setTimeout(() => {
            enableButtons();
            updateStatus("🎵 Now it's your turn!");
            gameState.isListening = true;
        }, 800 * gameState.currentPattern.length);
    }

    // Button press handling
    function bindControls() {
        document.querySelectorAll('.rhythm-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!gameState.isListening) return;
                const note = parseInt(btn.dataset.note);
                gameState.playerInput.push(note);
                checkInput();
            });
        });

        document.addEventListener('keydown', e => {
            const keyMap = { 'q': 0, 'w': 1, 'a': 2, 's': 3 };
            if (!gameState.isListening || !keyMap.hasOwnProperty(e.key)) return;
            const note = keyMap[e.key];
            const btn = document.querySelector(`.rhythm-btn[data-note='${note}']`);
            btn.click();
        });
    }
    function setupGarden() {
const garden = document.getElementById('garden');
garden.innerHTML = '';
for (let i = 0; i < 18; i++) {
    const slot = document.createElement('div');
    slot.classList.add('plant-slot');
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('role', 'button');
    if (i >= gameState.unlockedPlots) {
        slot.classList.add('locked');
        slot.setAttribute('aria-label', 'Locked plant slot');
        slot.innerHTML = '🔒';
        slot.addEventListener('click', () => {
            speak("This plot is still locked. Earn more points to unlock new plots.");
            showFloatingMessage("❌ Plot locked!", 'error');
            updateStatus("🌱 Get 10 more points to unlock the next plot.");
        });
    } else {
        slot.setAttribute('aria-label', 'Empty plant slot');
        slot.addEventListener('click', () => plantSeed(slot));
    }
    garden.appendChild(slot);
}
}
    // Check user input
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
    gameState.plants++;
    gameState.level++;

    gameState.earnedPoints[seed] += plant.points;

    // Unlock plots logic
    const totalScore = gameState.score;
    const newUnlocked = Math.min(18, Math.floor(totalScore / 10));
    if (newUnlocked > gameState.unlockedPlots) {
        gameState.unlockedPlots = newUnlocked;
        setupGarden();
        showFloatingMessage(`🌱 Plot #${gameState.unlockedPlots} unlocked!`, 'success');
        updateStatus(`✨ A new planting plot was unlocked!`);
    }

    updateScore();
    speak(successPhrases[Math.floor(Math.random() * successPhrases.length)]);
    showFloatingMessage("🌱 Grow!", 'success');
    updateStatus("🌟 Great job! Pattern matched!");
    updateProgress();
}

    // Handle success and per-plant points update
//     function handleSuccess() {
        
//         setupGarden();
//         const seed = gameState.selectedSeed;
//         const plant = plantProperties[seed];
//         gameState.score += plant.points;
//         gameState.plants++;
//         gameState.level++;
//         // NEW: Add points to seed-specific progress
//         gameState.earnedPoints[seed] += plant.points;
//         const newUnlocked = Math.min(18, Math.floor(gameState.score / 10)); // 18 is the max number of plots
// if (newUnlocked > gameState.unlockedPlots) {
//     gameState.unlockedPlots = newUnlocked;
//     updatePlotsLocking();
//     showFloatingMessage(`🌱 Plot #${gameState.unlockedPlots} unlocked!`, 'success');
//     updateStatus(`A new plot has been unlocked!`);
// }

updateScore();
speak(successPhrases[Math.floor(Math.random() * successPhrases.length)]);
showFloatingMessage("🌱 Grow!", 'success');
updateStatus("🌟 Great job! Pattern matched!");
updateProgress();
        updateScore();
        speak(successPhrases[Math.floor(Math.random() * successPhrases.length)]);
        showFloatingMessage("🌱 Grow!", 'success');
        updateStatus("🌟 Great job! Pattern matched!");
        updateProgress();


    // Handle mistake
    function handleMistake() {
        speak(encouragementPhrases[Math.floor(Math.random() * encouragementPhrases.length)]);
        showFloatingMessage("❌ Oops!", 'error');
        updateStatus("🔁 Try again!");
        gameState.combo = 0;
    }

    // Plant seed in clicked slot, ENFORCING THE PER-PLANT SCORE REQUIREMENT
    function plantSeed(slot) {
        if (slot.classList.contains('planted')) return;

        const seed = gameState.selectedSeed;
        const pointsNeeded = 10;

        if (gameState.earnedPoints[seed] < pointsNeeded) {
            // Can't plant yet
            speak(`You need ${pointsNeeded} points to plant a ${plantProperties[seed].name}`);
            showFloatingMessage(`❌ Earn more ${seed} points`, 'error');
            updateStatus(`🔒 Earn ${pointsNeeded} points with ${seed} before planting.`);
            return;
        }

        // Allowed to plant
        slot.textContent = seed;
        slot.classList.add('planted');
        slot.setAttribute('aria-label', `${seed} planted`);
        showFloatingMessage("🌱 Planted!", 'success');
        updateStatus(`🌼 You planted a ${plantProperties[seed].name}!`);
    }

    // Reset game
    function resetGame() {

        gameState = {
            score: 0,
            level: 1,
            currentPattern: [],
            playerInput: [],
            isPlaying: false,
            isListening: false,
            plants: 0,
            unlockedPlots: 0,
            isMuted: false,
            timeoutIds: [],
            selectedSeed: '🌻',
            plantedSeeds: [],
            combo: 0,
            totalPatterns: 0,
            // RESET earned points as well!
            earnedPoints: {
                '🌻': 0,
                '🌹': 0,
                '🌷': 0,
                '🌺': 0,
                '🌸': 0,
                '🌼': 0
            }
        };
        document.getElementById('garden').innerHTML = '';
        setupGarden();
        updateScore();
        updateProgress();
        updateStatus("🎯 Press \"Start New Pattern\" to begin your musical journey!");
    }

    // Utility updates
    function updateScore() {

        const totalScore = gameState.score;
        const newUnlocked = Math.min(18, Math.floor(totalScore / 10));
        if (newUnlocked > gameState.unlockedPlots) {
            gameState.unlockedPlots = newUnlocked;
            setupGarden();
            showFloatingMessage(`🌱 Plot #${gameState.unlockedPlots} unlocked!`, 'success');
            updateStatus(`✨ A new planting plot was unlocked!`);
        }
        document.getElementById('score').textContent = gameState.score;
        document.getElementById('level').textContent = gameState.level;
        document.getElementById('plantCount').textContent = gameState.plants;
    }

    function updateStatus(message) {
        document.getElementById('gameStatus').textContent = message;
    }

    function updateProgress() {
        const progress = (gameState.level / 10) * 100;
        document.getElementById('progress').style.width = `${progress}%`;
    }

    function disableButtons() {
        document.querySelectorAll('.rhythm-btn').forEach(btn => btn.disabled = true);
    }

    function enableButtons() {
        document.querySelectorAll('.rhythm-btn').forEach(btn => btn.disabled = false);
        document.getElementById('replayBtn').disabled = false;
    }

    function showFloatingMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `floating-message ${type === 'success' ? 'success-message' : 'error-message'}`;
        msg.textContent = text;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }
    