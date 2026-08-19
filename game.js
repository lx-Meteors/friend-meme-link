const $ = (selector) => document.querySelector(selector);
let ROWS = 4;
let COLS = 4;
const TOTAL_SECONDS = 45;
const rounds = [{rows:4,cols:4,pairs:8},{rows:4,cols:5,pairs:10},{rows:5,cols:6,pairs:15}];
const captions = ['我裂开了','你礼貌吗','让我康康','就这？','退退退！','拿来吧你','栓Q了','尊嘟假嘟','别卷了','已老实','好好好','我不理解','笑不活了','危！','开摆！','听我解释','问题不大','人麻了'];

const state = {
  photos: [], board: [], selected: null, score: 0, combo: 0, maxCombo: 0,
  remainingPairs: 8, matchedPairs: 0, round: 0, hints: 3, shuffles: 3, seconds: TOTAL_SECONDS,
  timer: null, startedAt: 0, pausedAt: 0, pausedTotal: 0, paused: false, finished: false
};

function makeAvatar(name, color, emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" rx="35" fill="${color}"/><circle cx="120" cy="104" r="72" fill="#fff2d0"/><text x="120" y="135" font-size="76" text-anchor="middle">${emoji}</text><text x="120" y="218" font-family="sans-serif" font-size="24" font-weight="900" text-anchor="middle" fill="#191522">${name}</text></svg>`;
  return { name, url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, sample: true };
}

const samples = [
  makeAvatar('阿橙','#ff765d','😎'), makeAvatar('小蓝','#61d5ff','🤪'),
  makeAvatar('桃子','#ff8eb2','😂'), makeAvatar('大黄','#ffd84d','😳')
];

function photos() { return state.photos.length ? state.photos : samples; }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === id));
}

function renderPhotoPreview() {
  const list = photos();
  $('#photoPreview').innerHTML = list.slice(0, 6).map((photo) => `<img src="${photo.url}" alt="${photo.name}">`).join('');
}

$('#photoInput').addEventListener('change', (event) => {
  state.photos.forEach((photo) => { if (!photo.sample) URL.revokeObjectURL(photo.url); });
  state.photos = [...event.target.files].slice(0, 8).map((file, index) => ({ name:`朋友${index + 1}`, url:URL.createObjectURL(file), sample:false }));
  renderPhotoPreview();
});

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function buildTiles(pairCount) {
  const pool = photos();
  const typeCount = Math.min(pool.length,pairCount);
  const selectedCaptions = shuffle([...captions]).slice(0,typeCount);
  const types = Array.from({length:typeCount},(_,index) => ({
    key:`round-${state.round}-photo-${index}`,
    caption:selectedCaptions[index],
    photo:pool[index],
    hue:(index * 83 + state.round * 35) % 360,
    power:index === 1 ? 'time' : index === typeCount - 1 && typeCount > 2 ? 'bomb' : null
  }));
  const tiles = [];
  for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
    const type = types[pairIndex % typeCount];
    tiles.push({...type,uid:`${type.key}-${pairIndex}-a`},{...type,uid:`${type.key}-${pairIndex}-b`});
  }
  return shuffle(tiles);
}

function resetGame() {
  clearInterval(state.timer);
  Object.assign(state, { board:[], selected:null, score:0, combo:0, maxCombo:0, remainingPairs:8, matchedPairs:0, round:0, hints:3, shuffles:3, seconds:TOTAL_SECONDS, pausedAt:0, pausedTotal:0, paused:false, finished:false });
  buildRound();
  $('#timerFill').style.transform = 'scaleX(1)';
  $('#pauseCurtain').hidden = true;
}

function buildRound() {
  const config = rounds[state.round];
  ROWS = config.rows; COLS = config.cols; state.remainingPairs = config.pairs; state.selected = null;
  const tiles = buildTiles(config.pairs);
  state.board = [];
  for (let row = 0; row < ROWS; row += 1) state.board.push(tiles.slice(row * COLS, (row + 1) * COLS));
  ensureMove();
  renderBoard(); updateHud();
  $('#board').classList.remove('round-in'); void $('#board').offsetWidth; $('#board').classList.add('round-in');
  setStatus(state.round === 0 ? '热身局：先找相邻的！' : state.round === 1 ? '加速局：棋盘变宽了！' : '最终局：表情包大爆发！');
  showToast(`第 ${state.round + 1} 轮！`);
}

function renderBoard() {
  const board = $('#board');
  board.replaceChildren();
  board.style.gridTemplateColumns = `repeat(${COLS},1fr)`;
  board.style.gridTemplateRows = `repeat(${ROWS},1fr)`;
  state.board.forEach((row, rowIndex) => row.forEach((tile, colIndex) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    if (!tile) { cell.className = 'tile empty'; cell.disabled = true; cell.style.visibility = 'hidden'; }
    else {
      cell.className = 'tile'; cell.dataset.row = rowIndex; cell.dataset.col = colIndex;
      cell.style.background = `hsl(${tile.hue} 90% 80%)`;
      cell.innerHTML = `<img src="${tile.photo.url}" alt="${tile.photo.name} · ${tile.caption}"><span>${tile.caption}</span>`;
      cell.addEventListener('click', () => selectTile(rowIndex, colIndex, cell));
    }
    board.appendChild(cell);
  }));
}

function cellElement(row, col) { return $(`.tile[data-row="${row}"][data-col="${col}"]`); }

function selectTile(row, col, element) {
  if (state.finished || state.paused || !state.board[row][col]) return;
  clearHints();
  if (!state.selected) {
    state.selected = { row, col };
    element.classList.add('selected');
    setStatus('再选一个相同梗图');
    return;
  }
  const first = state.selected;
  const firstElement = cellElement(first.row, first.col);
  if (first.row === row && first.col === col) {
    firstElement?.classList.remove('selected'); state.selected = null; setStatus('取消选择'); return;
  }
  const firstTile = state.board[first.row][first.col];
  const secondTile = state.board[row][col];
  if (firstTile.key !== secondTile.key) {
    wrongPair(firstElement, element, '不是同一个梗！'); return;
  }
  const path = findPath(first, {row,col});
  if (!path) { wrongPair(firstElement, element, '线路被挡住了！'); return; }
  element.classList.add('selected');
  drawPath(path);
  state.combo += 1; state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += 100 + Math.min(8, state.combo - 1) * 25;
  state.remainingPairs -= 1; state.matchedPairs += 1;
  showMemeBurst(secondTile);
  showToast(state.combo >= 3 ? `${state.combo} 连击！` : '连上啦！');
  setStatus(state.combo >= 3 ? `手感火热 · ${state.combo} 连击` : '漂亮！继续找');
  firstElement?.classList.add('removing'); element.classList.add('removing');
  state.selected = null; updateHud();
  setTimeout(() => {
    state.board[first.row][first.col] = null; state.board[row][col] = null;
    if (secondTile.power === 'time') { state.pausedTotal += 3000; state.score += 150; showToast('+3 秒！'); }
    if (secondTile.power === 'bomb') blastOnePair();
    renderBoard(); clearPath();
    if (state.remainingPairs === 0) {
      if (state.round < rounds.length - 1) { state.round += 1; state.pausedTotal += 4000; setTimeout(buildRound,450); }
      else finish(true);
    }
    else if (!findAnyMove()) { setStatus('没有可连组合，自动洗牌！'); shuffleRemaining(false); }
  }, 300);
}

function showMemeBurst(tile) {
  const burst = $('#memeBurst');
  $('#memeBurstImage').src = tile.photo.url;
  $('#memeBurstCaption').textContent = tile.caption;
  $('#memePower').textContent = tile.power === 'time' ? '+3 SEC!' : tile.power === 'bomb' ? 'BOOM!' : state.combo >= 3 ? `${state.combo} COMBO!` : 'MEME!';
  burst.hidden = false;
  clearTimeout(showMemeBurst.timer);
  showMemeBurst.timer = setTimeout(() => { burst.hidden = true; }, 560);
}

function blastOnePair() {
  const move = findAnyMove();
  if (!move) return;
  state.board[move.first.row][move.first.col] = null;
  state.board[move.second.row][move.second.col] = null;
  state.remainingPairs -= 1; state.matchedPairs += 1; state.score += 180;
  showToast('炸掉一对！');
}

function wrongPair(firstElement, secondElement, text) {
  firstElement?.classList.remove('selected');
  [firstElement,secondElement].forEach((element) => { element?.classList.remove('wrong'); void element?.offsetWidth; element?.classList.add('wrong'); });
  state.selected = null; state.combo = 0; state.score = Math.max(0,state.score - 20); updateHud(); setStatus(text);
}

function findPath(start, end) {
  const minRow = -1, maxRow = ROWS, minCol = -1, maxCol = COLS;
  const directions = [[-1,0],[0,1],[1,0],[0,-1]];
  const queue = [];
  const seen = new Map();
  const parents = new Map();
  const stateKey = (row,col,dir) => `${row},${col},${dir}`;
  directions.forEach((direction, dir) => {
    const row = start.row + direction[0], col = start.col + direction[1];
    if (canPass(row,col,end,minRow,maxRow,minCol,maxCol)) {
      const node = {row,col,dir,turns:0}; queue.push(node); seen.set(stateKey(row,col,dir),0); parents.set(stateKey(row,col,dir),{start:true,row:start.row,col:start.col});
    }
  });
  let finalNode = null;
  while (queue.length) {
    const current = queue.shift();
    if (current.row === end.row && current.col === end.col) { finalNode = current; break; }
    directions.forEach((direction, nextDir) => {
      const turns = current.turns + (nextDir === current.dir ? 0 : 1);
      if (turns > 2) return;
      const row = current.row + direction[0], col = current.col + direction[1];
      if (!canPass(row,col,end,minRow,maxRow,minCol,maxCol)) return;
      const key = stateKey(row,col,nextDir);
      if (seen.has(key) && seen.get(key) <= turns) return;
      seen.set(key,turns); parents.set(key,{row:current.row,col:current.col,dir:current.dir}); queue.push({row,col,dir:nextDir,turns});
    });
  }
  if (!finalNode) return null;
  const points = [{row:finalNode.row,col:finalNode.col}];
  let cursor = finalNode;
  while (true) {
    const parent = parents.get(stateKey(cursor.row,cursor.col,cursor.dir));
    if (!parent) break;
    points.push({row:parent.row,col:parent.col});
    if (parent.start) break;
    cursor = {row:parent.row,col:parent.col,dir:parent.dir};
  }
  points.reverse();
  return simplifyPath(points);
}

function canPass(row,col,end,minRow,maxRow,minCol,maxCol) {
  if (row < minRow || row > maxRow || col < minCol || col > maxCol) return false;
  if (row === end.row && col === end.col) return true;
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return !state.board[row][col];
}

function simplifyPath(points) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1], b = points[index], c = points[index + 1];
    if ((a.row - b.row) * (b.col - c.col) !== (a.col - b.col) * (b.row - c.row)) result.push(b);
  }
  result.push(points[points.length - 1]); return result;
}

function findAnyMove() {
  const positions = [];
  state.board.forEach((row,r) => row.forEach((tile,c) => { if (tile) positions.push({row:r,col:c,tile}); }));
  for (let a = 0; a < positions.length; a += 1) {
    for (let b = a + 1; b < positions.length; b += 1) {
      if (positions[a].tile.key === positions[b].tile.key) {
        const path = findPath(positions[a],positions[b]);
        if (path) return {first:positions[a],second:positions[b],path};
      }
    }
  }
  return null;
}

function ensureMove() {
  let attempts = 0;
  while (!findAnyMove() && attempts < 30) { shuffleBoardValues(); attempts += 1; }
}

function shuffleBoardValues() {
  const values = shuffle(state.board.flat().filter(Boolean));
  let cursor = 0;
  for (let row = 0; row < ROWS; row += 1) for (let col = 0; col < COLS; col += 1) if (state.board[row][col]) state.board[row][col] = values[cursor++];
}

function shuffleRemaining(useCredit = true) {
  if (useCredit && state.shuffles <= 0) return;
  if (useCredit) state.shuffles -= 1;
  state.selected = null; clearPath(); shuffleBoardValues(); ensureMove(); renderBoard(); updateHud();
  showToast('重新洗牌！');
}

function showHint() {
  if (state.hints <= 0 || state.finished || state.paused) return;
  const move = findAnyMove();
  if (!move) { shuffleRemaining(false); return; }
  state.hints -= 1; updateHud(); clearHints();
  cellElement(move.first.row,move.first.col)?.classList.add('hint');
  cellElement(move.second.row,move.second.col)?.classList.add('hint');
  setStatus('这两个可以连起来！');
  setTimeout(clearHints,1600);
}

function clearHints() { document.querySelectorAll('.tile.hint').forEach((tile) => tile.classList.remove('hint')); }

function drawPath(path) {
  const layer = $('#linkLayer');
  const boardRect = $('#board').getBoundingClientRect();
  const wrapRect = $('#boardWrap').getBoundingClientRect();
  const cellWidth = boardRect.width / COLS, cellHeight = boardRect.height / ROWS;
  const points = path.map((point) => {
    const x = boardRect.left - wrapRect.left + (point.col + .5) * cellWidth;
    const y = boardRect.top - wrapRect.top + (point.row + .5) * cellHeight;
    return `${x},${y}`;
  }).join(' ');
  layer.setAttribute('viewBox',`0 0 ${wrapRect.width} ${wrapRect.height}`);
  layer.innerHTML = `<polyline class="link-line" points="${points}"></polyline><polyline class="link-core" points="${points}"></polyline>`;
}
function clearPath() { $('#linkLayer').replaceChildren(); }

function updateHud() {
  $('#scoreValue').textContent = String(state.score).padStart(4,'0');
  $('#comboValue').textContent = `×${Math.max(1,state.combo)}`;
  $('#remainingValue').textContent = `第 ${state.round + 1}/3 轮 · 剩余 ${state.remainingPairs} 对`;
  $('#hintCount').textContent = `剩 ${state.hints} 次`;
  $('#shuffleCount').textContent = `剩 ${state.shuffles} 次`;
  $('#hintButton').disabled = state.hints <= 0;
  $('#shuffleButton').disabled = state.shuffles <= 0;
}
function setStatus(text) { $('#statusText').textContent = text; }
function showToast(text) { const toast=$('#toast'); toast.textContent=text; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),650); }

function startTimer() {
  state.startedAt = performance.now(); state.pausedTotal = 0;
  state.timer = setInterval(() => {
    if (state.paused || state.finished) return;
    const elapsed = (performance.now() - state.startedAt - state.pausedTotal) / 1000;
    state.seconds = Math.max(0,Math.ceil(TOTAL_SECONDS - elapsed));
    $('#timeValue').textContent = String(state.seconds).padStart(2,'0');
    const progress = Math.max(0,1 - elapsed / TOTAL_SECONDS);
    $('#timerFill').style.transform = `scaleX(${progress})`;
    $('#timerFill').style.background = progress < .2 ? '#ff3548' : 'linear-gradient(90deg,var(--orange),var(--yellow))';
    if (state.seconds <= 0) finish(false);
  },100);
}

function pauseGame() { if (state.finished) return; state.paused=true; state.pausedAt=performance.now(); $('#pauseCurtain').hidden=false; }
function resumeGame() { if (!state.paused) return; state.pausedTotal += performance.now()-state.pausedAt; state.paused=false; $('#pauseCurtain').hidden=true; }

function finish(cleared) {
  if (state.finished) return;
  state.finished = true; clearInterval(state.timer); clearPath();
  const timeBonus = cleared ? state.seconds * 20 : 0; state.score += timeBonus;
  $('#resultEmoji').textContent = cleared ? (state.maxCombo >= 6 ? '👑' : '🏆') : '⏰';
  $('#resultTitle').textContent = cleared ? (state.maxCombo >= 6 ? '连连看之神！' : '整活成功！') : '差点就连完！';
  $('#resultScore').textContent = String(state.score).padStart(4,'0');
  $('#resultDetail').textContent = `${state.matchedPairs} 对已消除 · 最高连击 ×${Math.max(1,state.maxCombo)}${cleared ? ` · 时间奖励 ${timeBonus}` : ''}`;
  $('#resultFaces').innerHTML = photos().slice(0,5).map((photo)=>`<img src="${photo.url}" alt="${photo.name}">`).join('');
  setTimeout(()=>showScreen('resultScreen'),450);
}

function startGame() { resetGame(); showScreen('gameScreen'); startTimer(); }

$('#startButton').addEventListener('click',startGame);
$('#againButton').addEventListener('click',startGame);
$('#homeButton').addEventListener('click',()=>showScreen('introScreen'));
$('#backButton').addEventListener('click',()=>{ clearInterval(state.timer); showScreen('introScreen'); });
$('#hintButton').addEventListener('click',showHint);
$('#shuffleButton').addEventListener('click',()=>shuffleRemaining(true));
$('#pauseButton').addEventListener('click',pauseGame);
$('#resumeButton').addEventListener('click',resumeGame);

renderPhotoPreview();
