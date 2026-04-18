const FALLBACK_GAMES = [
  { file:'car.html', title:'レトロレーサー', tag:'Arcade', cover:'road', order:10 },
  { file:'ice-cream.html', title:'アイスタワー', tag:'Balance', cover:'ice', order:20 },
  { file:'rhythm.html', title:'リズム', tag:'Rhythm', cover:'rhythm', order:30 },
  { file:'sushi.html', title:'寿司キャッチ', tag:'Action', cover:'sushi', order:40 },
  { file:'quiz.html', title:'クイズ', tag:'Quiz', cover:'quiz', order:50 },
  { file:'taikan-groove-theater-sound-racer-start.html', title:'たいかんグルーヴ', tag:'Rhythm', cover:'rhythm', emoji:'🧘', order:240, coverColor:'#6e7cff' },
  { file:'sky-ribbon-rise-racer-start.html', title:'スカイリボン・ライズ', tag:'Action', cover:'generic', emoji:'🌌', order:275, coverColor:'#6b53ff' }
];
const IGNORE_FILES = new Set(['index.html', 'quize.html', 'game-template.html']);
const GAME_REGISTRY_KEY = 'feeling-game-launcher:games:v1';
const HANDLE_DB_NAME = 'feeling-game-launcher-db';
const HANDLE_STORE_NAME = 'settings';
const HANDLE_KEY = 'games-dir-handle';
const DIRECTORY_PICKER_ID = 'feeling-game-games-folder';

const COVER_PRESETS = {
  road: {
    className: 'cover-road',
    html: '<div class="sun"></div><div class="road-line"></div><div class="car-top"></div><div class="car-body"></div><div class="wheel"></div><div class="wheel2"></div>'
  },
  ice: {
    className: 'cover-ice',
    html: '<div class="cone"></div><div class="scoop1"></div><div class="scoop2"></div><div class="scoop3"></div>' +
      '<div class="sprinkle" style="left:102px;top:52px;--r:24deg"></div><div class="sprinkle" style="left:138px;top:48px;--r:-18deg"></div>' +
      '<div class="sprinkle" style="left:166px;top:60px;--r:12deg"></div><div class="sprinkle" style="left:150px;top:36px;--r:-32deg"></div>'
  },
  rhythm: {
    className: 'cover-rhythm',
    html: '<div class="ring r1"></div><div class="ring r2"></div><div class="note">♪</div>' +
      '<div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div><div class="bar b5"></div><div class="bar b6"></div><div class="bar b7"></div>'
  },
  sushi: {
    className: 'cover-sushi',
    html: '<div class="roll"></div><div class="tray"></div><div class="piece p1"></div><div class="piece p2"></div><div class="piece p3"></div>'
  },
  quiz: {
    className: 'cover-quiz',
    html: '<div class="board"></div><div class="mark ok">○</div><div class="mark ng">×</div><div class="q">?</div><div class="book"></div>'
  }
};

const stage = document.getElementById('carouselStage');
const helperText = document.getElementById('helperText');
const folderHintText = document.getElementById('folderHintText');
const startButton = document.getElementById('startButton');
const folderButton = document.getElementById('folderButton');

let games = [];
let selectedIndex = 0;
let animating = false;
let audioCtx = null;
const padState = { left:false, right:false, confirm:false };

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, duration = 0.08, type = 'square', gainValue = 0.026, when = 0) {
  const ctx = ensureAudio();
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.04);
}
const sfx = {
  move(){ tone(420, 0.04, 'triangle', 0.022); },
  launch(){ tone(300, 0.04, 'square', 0.028); tone(480, 0.05, 'triangle', 0.022, 0.04); tone(720, 0.1, 'triangle', 0.02, 0.08); }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeHexColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^#([0-9a-f]{3})$/i.test(raw)) {
    return `#${raw.slice(1).split('').map((ch) => ch + ch).join('').toLowerCase()}`;
  }
  if (/^#([0-9a-f]{6})$/i.test(raw)) return raw.toLowerCase();
  return '';
}

function hexToRgb(hex) {
  const value = normalizeHexColor(hex);
  if (!value) return null;
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function tintColor(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';
  const mix = (value) => amount >= 0 ? value + (255 - value) * amount : value * (1 + amount);
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

function alphaColor(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(120, 167, 255, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hashString(value) {
  let hash = 0;
  for (const ch of String(value || '')) {
    hash = ((hash << 5) - hash) + ch.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCoverPalette(game) {
  const baseHex = normalizeHexColor(game.coverColor);
  if (baseHex) {
    return {
      bg1: tintColor(baseHex, 0.78),
      bg2: tintColor(baseHex, 0.22),
      orb1: alphaColor(tintColor(baseHex, -0.06), 0.24),
      orb2: alphaColor(tintColor(baseHex, 0.32), 0.5),
      line: alphaColor(tintColor(baseHex, -0.12), 0.08)
    };
  }
  const seed = hashString(`${game.file}|${game.title}|${game.tag}`);
  const hue = seed % 360;
  return {
    bg1: `hsl(${hue} 86% 92%)`,
    bg2: `hsl(${(hue + 28) % 360} 78% 82%)`,
    orb1: `hsla(${(hue + 12) % 360} 82% 66% / .34)`,
    orb2: `hsla(${(hue + 156) % 360} 88% 74% / .42)`,
    line: `hsla(${(hue + 8) % 360} 36% 34% / .08)`
  };
}

function coverStyleVars(game) {
  const palette = getCoverPalette(game);
  return `--cover-bg1:${palette.bg1};--cover-bg2:${palette.bg2};--cover-orb1:${palette.orb1};--cover-orb2:${palette.orb2};--cover-line:${palette.line};`;
}

function isImageCover(value) {
  return /\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(String(value || '').trim());
}

function loadRegistryGames() {
  try {
    const records = JSON.parse(localStorage.getItem(GAME_REGISTRY_KEY) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function saveRegistryGames(records) {
  try {
    const unique = [];
    const seen = new Set();
    records.forEach((record) => {
      if (!record?.file || seen.has(record.file)) return;
      seen.add(record.file);
      unique.push(record);
    });
    localStorage.setItem(GAME_REGISTRY_KEY, JSON.stringify(unique.slice(-160)));
  } catch {}
}

function coverMarkup(game) {
  const preset = COVER_PRESETS[game.cover] || null;
  const coverStyle = coverStyleVars(game);
  if (preset) return `<div class="cover ${preset.className}" style="${coverStyle}">${preset.html}</div>`;
  if (isImageCover(game.cover)) {
    return `<div class="cover cover-image" style="${coverStyle}"><img src="${escapeAttr(game.cover)}" alt=""><div class="shade"></div></div>`;
  }
  const emoji = escapeHtml(game.emoji || '🎮');
  return `<div class="cover cover-generic" style="${coverStyle}"><div class="orb o1"></div><div class="orb o2"></div><div class="emoji">${emoji}</div></div>`;
}

function createCart(game, index) {
  const article = document.createElement('article');
  article.className = 'cart';
  article.dataset.index = index;
  article.setAttribute('role', 'button');
  article.setAttribute('tabindex', index === 0 ? '0' : '-1');
  article.innerHTML = `
    <div class="cart-shell">
      ${coverMarkup(game)}
      <div class="cart-meta">
        <div class="tag">${escapeHtml(game.tag || 'Game')}</div>
        <div class="title">${escapeHtml(game.title)}</div>
      </div>
    </div>`;
  article.addEventListener('click', () => {
    if (selectedIndex === index) launchSelected();
    else selectGame(index, true);
  });
  return article;
}

function buildStage() {
  stage.innerHTML = '';
  games.forEach((game, index) => stage.appendChild(createCart(game, index)));
}

function relativeOffset(index) {
  const total = games.length;
  let diff = index - selectedIndex;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

function getPose(offset) {
  const firstCard = stage.children[0];
  const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 280;
  const sideX = Math.round(cardWidth * 0.78);
  const farX = Math.round(cardWidth * 1.16);
  const map = {
    0:{x:0,y:0,scale:1.02,rotate:0,opacity:1,z:40,blur:0},
    1:{x:sideX,y:14,scale:.82,rotate:-8,opacity:.34,z:30,blur:.3},
    '-1':{x:-sideX,y:14,scale:.82,rotate:8,opacity:.34,z:30,blur:.3},
    2:{x:farX,y:22,scale:.68,rotate:-11,opacity:.14,z:20,blur:.75},
    '-2':{x:-farX,y:22,scale:.68,rotate:11,opacity:.14,z:20,blur:.75}
  };
  return map[offset] || {x:offset * farX,y:28,scale:.6,rotate:offset > 0 ? -14 : 14,opacity:0,z:1,blur:1.2};
}

function renderCarousel() {
  [...stage.children].forEach((card, index) => {
    const offset = relativeOffset(index);
    const pose = getPose(offset);
    card.style.zIndex = pose.z;
    card.style.opacity = pose.opacity;
    card.style.filter = `blur(${pose.blur}px)`;
    card.style.transform = `translate(-50%, -50%) translateX(${pose.x}px) translateY(${pose.y}px) scale(${pose.scale}) rotateY(${pose.rotate}deg)`;
    card.classList.toggle('center', offset === 0);
    card.setAttribute('aria-hidden', Math.abs(offset) > 2 ? 'true' : 'false');
    card.setAttribute('tabindex', offset === 0 ? '0' : '-1');
  });
  const game = games[selectedIndex];
  startButton.disabled = !game;
}

function pulseSelectedCard() {
  const card = stage.children[selectedIndex];
  if (!card) return;
  card.animate([
    { transform: card.style.transform, filter: card.style.filter || 'blur(0px)' },
    { transform: `${card.style.transform} scale(1.03)`, filter: 'blur(0px) brightness(1.03)' },
    { transform: card.style.transform, filter: card.style.filter || 'blur(0px)' }
  ], { duration:220, easing:'ease-out' });
}

function selectGame(index, animate = false) {
  if (!games.length || animating) return;
  selectedIndex = (index + games.length) % games.length;
  renderCarousel();
  const game = games[selectedIndex];
  if (game) helperText.textContent = `${game.title} / ← → / ↑`;
  if (animate) {
    ensureAudio();
    sfx.move();
    pulseSelectedCard();
    animating = true;
    setTimeout(() => { animating = false; }, 160);
  }
}

function moveSelection(delta) {
  selectGame(selectedIndex + delta, true);
}

function launchSelected() {
  if (animating || !games[selectedIndex]) return;
  const game = games[selectedIndex];
  let resolved = game.file;
  try {
    resolved = new URL(game.file, location.href).href;
    if (resolved === location.href) return;
  } catch {}
  ensureAudio();
  sfx.launch();
  helperText.textContent = `${game.title} を起動しています…`;
  setTimeout(() => { window.location.assign(resolved); }, 180);
}

function normalizeGame(record) {
  const fallback = FALLBACK_GAMES.find(item => item.file === record.file) || {};
  const file = String(record.file || fallback.file || '').trim();
  return {
    file,
    title: record.title || fallback.title || file.replace(/\.html$/i, ''),
    tag: record.tag || fallback.tag || 'Game',
    cover: record.cover || fallback.cover || 'generic',
    coverColor: normalizeHexColor(record.coverColor || fallback.coverColor || ''),
    emoji: record.emoji || fallback.emoji || '🎮',
    order: Number(record.order ?? fallback.order ?? 999)
  };
}

function parseGameMeta(fileName, htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  const meta = (name) => doc.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  return normalizeGame({
    file: fileName,
    title: meta('game:title') || doc.title,
    tag: meta('game:tag'),
    cover: meta('game:cover'),
    coverColor: meta('game:cover-color') || meta('theme-color'),
    emoji: meta('game:emoji'),
    order: meta('game:order')
  });
}

function sortGames(list) {
  const unique = [];
  const seen = new Set();
  list.forEach((item) => {
    if (!item?.file || seen.has(item.file)) return;
    seen.add(item.file);
    unique.push(item);
  });
  return unique.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file, 'ja'));
}

function setLauncherNote(mainText, subText = '') {
  helperText.textContent = mainText;
  folderHintText.hidden = !subText;
  folderHintText.textContent = subText;
}

function setFolderButton(visible, label = 'Game（games）フォルダを開く', disabled = false) {
  folderButton.hidden = !visible;
  folderButton.textContent = label;
  folderButton.disabled = disabled;
}

async function openHandleDb() {
  if (!('indexedDB' in window)) return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        req.result.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openHandleDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
    const req = tx.objectStore(HANDLE_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openHandleDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
    tx.objectStore(HANDLE_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadStoredDirectoryHandle() {
  try {
    return await idbGet(HANDLE_KEY);
  } catch {
    return null;
  }
}

async function saveStoredDirectoryHandle(handle) {
  try {
    await idbSet(HANDLE_KEY, handle);
  } catch {}
}

async function getDirectoryPermission(handle, ask = false) {
  if (!handle) return 'denied';
  try {
    if (typeof handle.queryPermission !== 'function') return 'granted';
    let state = await handle.queryPermission({ mode:'read' });
    if (state === 'granted') return state;
    if (ask && typeof handle.requestPermission === 'function') {
      state = await handle.requestPermission({ mode:'read' });
    }
    return state;
  } catch {
    return 'denied';
  }
}

async function enumerateGamesFromHandle(handle) {
  const permission = await getDirectoryPermission(handle, false);
  if (permission !== 'granted') return { games:[], permission };
  const loaded = [];
  try {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind !== 'file') continue;
      if (!/\.html?$/i.test(name)) continue;
      if (IGNORE_FILES.has(name) || name.startsWith('_') || name.startsWith('.')) continue;
      const file = await entry.getFile();
      const text = await file.text();
      loaded.push(parseGameMeta(name, text));
    }
    return { games:sortGames(loaded), permission:'granted' };
  } catch {
    return { games:[], permission:'error' };
  }
}

async function discoverFilesFromDirectory() {
  if (location.protocol === 'file:') return [];
  try {
    const res = await fetch('./', { cache:'no-store' });
    if (!res.ok) return [];
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const hrefs = [...doc.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .map((href) => href.split('#')[0].split('?')[0])
      .filter((href) => /\.html?$/i.test(href))
      .map((href) => href.replace(/^\.\//, ''))
      .filter((href) => !href.includes('/'))
      .filter((href) => !IGNORE_FILES.has(href))
      .filter((href) => !href.startsWith('_') && !href.startsWith('.'));
    return [...new Set(hrefs)];
  } catch {
    return [];
  }
}

async function fetchGamesByFiles(files) {
  const uniqueFiles = [...new Set(files.filter(Boolean))];
  const loaded = await Promise.all(uniqueFiles.map(async (file) => {
    try {
      const res = await fetch(file, { cache:'no-store' });
      if (!res.ok) throw new Error('read failed');
      const text = await res.text();
      return parseGameMeta(file, text);
    } catch {
      return null;
    }
  }));
  return sortGames(loaded.filter(Boolean));
}

async function loadGames() {
  const registryGames = loadRegistryGames();
  const storedHandle = await loadStoredDirectoryHandle();
  const folderCapable = typeof window.showDirectoryPicker === 'function';
  let note = '';
  let showFolderButton = folderCapable;
  let folderButtonLabel = 'Game（games）フォルダを開く';

  const discovered = await discoverFilesFromDirectory();
  if (discovered.length) {
    const serverGames = await fetchGamesByFiles(discovered);
    saveRegistryGames(serverGames.map((game) => ({ ...game, updatedAt:Date.now() })));
    return {
      games: serverGames,
      helper: serverGames.length ? `${serverGames.length} 件のゲームを読み込みました` : '現在の Game（games）フォルダにゲームがありません',
      note: '現在開いている Game（games）フォルダを優先して自動検出しています。HTML を追加・削除すると再読込でそのまま反映されます。',
      showFolderButton:false,
      folderButtonLabel
    };
  }

  if (storedHandle) {
    const fromHandle = await enumerateGamesFromHandle(storedHandle);
    if (fromHandle.permission === 'granted') {
      saveRegistryGames(fromHandle.games.map((game) => ({ ...game, updatedAt:Date.now() })));
      return {
        games: fromHandle.games,
        helper: fromHandle.games.length ? `${fromHandle.games.length} 件のゲームを読み込みました` : '選択した Game（games）フォルダにゲームがありません',
        note: '保存済みの Game（games）フォルダを直接読んでいます。HTML を追加・削除した状態が、そのまま次回読込に反映されます。',
        showFolderButton,
        folderButtonLabel:'Game（games）フォルダを変更'
      };
    }
    folderButtonLabel = 'Game（games）フォルダを変更';
    note = '保存済みのフォルダ権限を確認できませんでした。必要なら Game（games）フォルダを開き直してください。';
  }

  if (location.protocol === 'file:' && folderCapable) {
    return {
      games: [],
      helper: 'ローカル起動では初回だけ Game（games）フォルダを開いてください',
      note: note || 'file:// ではフォルダ一覧を自動取得できないため、1 回だけ Game（games）フォルダを選ぶと、次回以降は自動で同じフォルダを読み込みます。',
      showFolderButton:true,
      folderButtonLabel
    };
  }

  const candidates = [...registryGames.map((game) => game.file), ...FALLBACK_GAMES.map((game) => game.file)];
  const verifiedGames = await fetchGamesByFiles(candidates);
  saveRegistryGames(verifiedGames.map((game) => ({ ...game, updatedAt:Date.now() })));
  return {
    games: verifiedGames,
    helper: verifiedGames.length ? `${verifiedGames.length} 件のゲームを読み込みました` : 'Game（games）フォルダにゲームがありません',
    note: note || (folderCapable
      ? '既知の HTML を実在確認して表示しています。ローカル配置で追加分も自動反映したい場合は Game（games）フォルダを一度開いてください。'
      : '既知の HTML を実在確認して表示しています。削除済みファイルは次回読込時に外れます。'),
    showFolderButton:folderCapable,
    folderButtonLabel
  };
}

async function renderLauncher() {
  setLauncherNote('読み込み中…');
  startButton.disabled = true;
  const result = await loadGames();
  games = result.games;
  setFolderButton(result.showFolderButton, result.folderButtonLabel, false);
  if (!games.length) {
    stage.innerHTML = '';
    setLauncherNote(result.helper, result.note);
    return;
  }
  buildStage();
  selectedIndex = 0;
  selectGame(0, false);
  setLauncherNote(result.helper, result.note);
}

async function pickGamesFolder() {
  if (typeof window.showDirectoryPicker !== 'function') return;
  try {
    setFolderButton(true, 'Game（games）フォルダを確認中…', true);
    const storedHandle = await loadStoredDirectoryHandle();
    const pickerOptions = { id:DIRECTORY_PICKER_ID, mode:'read' };
    if (storedHandle) pickerOptions.startIn = storedHandle;
    const handle = await window.showDirectoryPicker(pickerOptions);
    await saveStoredDirectoryHandle(handle);
    const permission = await getDirectoryPermission(handle, true);
    if (permission !== 'granted') {
      setLauncherNote('Game（games）フォルダの権限が必要です', '追加・削除の同期には読み取り許可を付与してください。');
      return;
    }
    await renderLauncher();
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setLauncherNote('Game（games）フォルダを開けませんでした', 'もう一度フォルダを開くか、サーバー配信で開いてください。');
    }
  } finally {
    setFolderButton(!folderButton.hidden, folderButton.textContent || 'gamesフォルダを指定', false);
  }
}

function handleKeydown(e) {
  if (['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); moveSelection(-1); }
  if (['ArrowRight','d','D'].includes(e.key)) { e.preventDefault(); moveSelection(1); }
  if (['Enter',' ','ArrowUp'].includes(e.key)) { e.preventDefault(); launchSelected(); }
}

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find(Boolean);
  if (!pad) {
    padState.left = false;
    padState.right = false;
    padState.confirm = false;
    return;
  }
  const x = Math.abs(pad.axes[0] || 0) > 0.35 ? pad.axes[0] : 0;
  const y = Math.abs(pad.axes[1] || 0) > 0.35 ? pad.axes[1] : 0;
  const left = !!(pad.buttons[14]?.pressed || x < -0.35);
  const right = !!(pad.buttons[15]?.pressed || x > 0.35);
  const confirm = !!(pad.buttons[12]?.pressed || pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || y < -0.45);
  if (left && !padState.left) moveSelection(-1);
  if (right && !padState.right) moveSelection(1);
  if (confirm && !padState.confirm) launchSelected();
  padState.left = left;
  padState.right = right;
  padState.confirm = confirm;
}

function loop() {
  pollGamepad();
  requestAnimationFrame(loop);
}

startButton.addEventListener('click', launchSelected);
folderButton.addEventListener('click', pickGamesFolder);
window.addEventListener('pointerdown', () => ensureAudio(), { passive:true });
window.addEventListener('keydown', handleKeydown);
window.addEventListener('resize', renderCarousel);
window.addEventListener('focus', () => { renderLauncher(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderLauncher();
});

(async () => {
  await renderLauncher();
  requestAnimationFrame(loop);
})();
