const board = document.getElementById('board');
const movesCounter = document.getElementById('moves');
const timeCounter = document.getElementById('time');
const resetBtn = document.getElementById('reset-btn');
const difficultySelect = document.getElementById('difficulty-select');
const hintBtn = document.getElementById('hint-btn');
const pauseBtn = document.getElementById('pause-btn');
const darkModeBtn = document.getElementById('darkmode-btn');
const leaderboardContent = document.getElementById('leaderboard-content');
const moveHistory = document.getElementById('move-history');
const iconsetSelect = document.getElementById('iconset-select');
const progressBar = document.getElementById('progress-bar');

const iconSets = {
  fruits: ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🥝', '🍍', '🍑', '🍐', '🍊', '🍋'],
  animals: ['🦄', '🐱', '🐶', '🐸', '🐵', '🐝', '🐧', '🐯', '🐢', '🦉', '🐝', '🐨'],
  emojis: ['😀', '😂', '🥳', '😎', '😍', '😡', '😱', '🤖', '👻', '💩', '🎃', '👽']
};

// Sound effects
const sounds = {
  flip: new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg'),
  match: new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg'),
  mismatch: new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'),
  win: new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg')
};

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matchedPairs = 0;
let moves = 0;
let timer = null;
let secondsElapsed = 0;
let totalPairs = 0;
let gamePaused = false;
let hintsLeft = 2;
let moveLog = [];

// Local storage key for leaderboard data
const leaderboardKey = 'memoryGameLeaderboard';

// Handle sound play with volume and catch for browsers blocking autoplay
function playSound(sound) {
  try {
    sound.currentTime = 0;
    sound.volume = 0.35;
    sound.play();
  } catch(e) {
    // Autoplay restrictions - ignore
  }
}

function startTimer() {
  stopTimer();
  if (gamePaused) return;
  timer = setInterval(() => {
    secondsElapsed++;
    updateTime();
  }, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function updateTime() {
  let mins = Math.floor(secondsElapsed / 60);
  let secs = secondsElapsed % 60;
  timeCounter.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createCard(icon) {
  const card = document.createElement('div');
  card.classList.add('card');
  card.setAttribute('tabindex', 0);
  card.setAttribute('role', 'gridcell');
  card.setAttribute('aria-label', 'Memory card');
  card.innerHTML = `
    <div class="card-inner">
      <div class="card-front"></div>
      <div class="card-back">${icon}</div>
    </div>`;
  card.icon = icon;
  return card;
}

function setupBoard(difficulty, iconSetName) {
  clearInterval(timer);
  secondsElapsed = 0;
  updateTime();
  moves = 0;
  movesCounter.textContent = moves;
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  matchedPairs = 0;
  hintsLeft = 2;
  hintBtn.textContent = `Hint (${hintsLeft})`;
  moveLog = [];
  updateMoveHistory();
  gamePaused = false;
  pauseBtn.textContent = 'Pause';

  board.innerHTML = '';

  if (difficulty === 'easy') {
    document.body.className = 'easy';
    totalPairs = 4;
  } else if (difficulty === 'medium') {
    document.body.className = 'medium';
    totalPairs = 8;
  } else {
    document.body.className = 'hard';
    totalPairs = 12;
  }

  let icons = iconSets[iconSetName];
  if (!icons) icons = iconSets.fruits;

  // Pick totalPairs random icons twice to make pairs
  let selectedIcons = shuffle(icons.slice()).slice(0, totalPairs);
  let cardSet = shuffle([...selectedIcons, ...selectedIcons]);

  cardSet.forEach(icon => {
    const card = createCard(icon);
    board.appendChild(card);
    card.addEventListener('click', flipCard);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flipCard.call(card);
      }
    });
  });

  updateProgress();
  loadLeaderboard();
  startTimer();
}

function flipCard() {
  if (lockBoard || gamePaused) return;
  if (this === firstCard) return;

  // If already matched
  if (this.classList.contains('matched')) return;

  this.classList.add('flipped');
  playSound(sounds.flip);

  if (!firstCard) {
    firstCard = this;
    logMove(`Flip: ${this.icon}`);
    return;
  }

  secondCard = this;
  lockBoard = true;
  moves++;
  movesCounter.textContent = moves;
  logMove(`Flip: ${this.icon}`);

  if (firstCard.icon === secondCard.icon) {
    playSound(sounds.match);
    matchCards();
  } else {
    playSound(sounds.mismatch);
    unflipCards();
  }
}

function matchCards() {
  firstCard.classList.add('matched');
  secondCard.classList.add('matched');
  matchedPairs++;
  updateProgress();
  logMove(`Match: ${firstCard.icon}`);

  resetBoard();

  if (matchedPairs === totalPairs) {
    stopTimer();
    playSound(sounds.win);
    saveLeaderboardRecord();
    setTimeout(() => {
      alert(`🎉 You won in ${moves} moves and ${timeCounter.textContent} minutes!`);
    }, 300);
  }
}

function unflipCards() {
  setTimeout(() => {
    firstCard.classList.remove('flipped');
    secondCard.classList.remove('flipped');
    resetBoard();
  }, 1000);
}

function resetBoard() {
  [firstCard, secondCard] = [null, null];
  lockBoard = false;
}

// Progress bar update
function updateProgress() {
  let progressPercent = (matchedPairs / totalPairs) * 100;
  progressBar.style.width = progressPercent + '%';
}

// Hint feature - reveals all unmatched cards briefly
function useHint() {
  if (hintsLeft <= 0 || lockBoard) return;
  hintsLeft--;
  hintBtn.textContent = `Hint (${hintsLeft})`;

  const cards = [...board.querySelectorAll('.card')];
  const unmatchedCards = cards.filter(c => !c.classList.contains('matched') && !c.classList.contains('flipped'));

  unmatchedCards.forEach(c => c.classList.add('flipped'));
  playSound(sounds.flip);

  lockBoard = true;
  setTimeout(() => {
    unmatchedCards.forEach(c => c.classList.remove('flipped'));
    lockBoard = false;
  }, 1500);
}

// Pause/Resume Timer and disable board
function togglePause() {
  if (gamePaused) {
    gamePaused = false;
    pauseBtn.textContent = 'Pause';
    startTimer();
  } else {
    gamePaused = true;
    pauseBtn.textContent = 'Resume';
    stopTimer();
  }
}

// Move History Log
function logMove(text) {
  const timestamp = new Date().toLocaleTimeString();
  moveLog.unshift(`[${timestamp}] ${text}`);
  updateMoveHistory();
}

function updateMoveHistory() {
  moveHistory.textContent = moveLog.slice(0, 50).join('\n');
}

// Dark Mode toggle
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  if (document.body.classList.contains('dark')) {
    darkModeBtn.textContent = 'Light Mode';
  } else {
    darkModeBtn.textContent = 'Dark Mode';
  }
}

// Leaderboard (store best scores per difficulty and iconset by moves and time)
function loadLeaderboard() {
  const key = getLeaderboardKey();
  const dataStr = localStorage.getItem(leaderboardKey);
  let data = {};
  if (dataStr) {
    try { data = JSON.parse(dataStr); } catch(e) {}
  }

  const entry = data[key];
  if (entry) {
    leaderboardContent.innerHTML = `
      <ul>
        <li><strong>Best Moves:</strong> ${entry.moves}</li>
        <li><strong>Best Time:</strong> ${entry.time}</li>
      </ul>
    `;
  } else {
    leaderboardContent.textContent = 'No records yet.';
  }
}

function saveLeaderboardRecord() {
  const key = getLeaderboardKey();
  const dataStr = localStorage.getItem(leaderboardKey);
  let data = {};
  if (dataStr) {
    try { data = JSON.parse(dataStr); } catch(e) {}
  }

  const currentBest = data[key];
  const currentTimeStr = timeCounter.textContent;
  const currentMoves = moves;

  let updateNeeded = false;
  if (!currentBest) {
    updateNeeded = true;
  } else {
    // Update if better moves or if equal moves but better time
    let [bestMins, bestSecs] = currentBest.time.split(':').map(Number);
    let [currMins, currSecs] = currentTimeStr.split(':').map(Number);
    let bestTotal = bestMins * 60 + bestSecs;
    let currTotal = currMins * 60 + currSecs;

    if (currentMoves < currentBest.moves || (currentMoves === currentBest.moves && currTotal < bestTotal)) {
      updateNeeded = true;
    }
  }

  if (updateNeeded) {
    data[key] = { moves: currentMoves, time: currentTimeStr };
    localStorage.setItem(leaderboardKey, JSON.stringify(data));
    loadLeaderboard();
  }
}

function getLeaderboardKey() {
  return `${difficultySelect.value}_${iconsetSelect.value}`;
}

// Confirm before restarting
function confirmReset() {
  if (confirm('Are you sure you want to restart the game? Your current progress will be lost.')) {
    setupBoard(difficultySelect.value, iconsetSelect.value);
  }
}

// Event Listeners
resetBtn.addEventListener('click', confirmReset);
hintBtn.addEventListener('click', useHint);
pauseBtn.addEventListener('click', togglePause);
darkModeBtn.addEventListener('click', toggleDarkMode);
difficultySelect.addEventListener('change', () => {
  setupBoard(difficultySelect.value, iconsetSelect.value);
});
iconsetSelect.addEventListener('change', () => {
  setupBoard(difficultySelect.value, iconsetSelect.value);
});

// Initialize
setupBoard(difficultySelect.value, iconsetSelect.value);
