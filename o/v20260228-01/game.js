(function () {
  "use strict";

  const MAP_WIDTH = 80;
  const MAP_HEIGHT = 50;
  const VIEW_WIDTH = 21;
  const ENEMY_COUNT = 14;
  const CHEST_COUNT = 10;
  const ATK_ITEM_COUNT = 2;
  const DEF_ITEM_COUNT = 2;
  const ROOM_ATTEMPTS = 64;
  const ROOM_MIN = 5;
  const ROOM_MAX = 12;
  const LOG_LIMIT = 100;
  const FINAL_FLOOR = 3;
  const BOSS_BASE_HP = 30;

  const els = {
    map: document.getElementById("map"),
    minimap: document.getElementById("minimap"),
    hp: document.getElementById("hp"),
    floor: document.getElementById("floor"),
    atk: document.getElementById("atk"),
    def: document.getElementById("def"),
    log: document.getElementById("log"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    overlayRestartBtn: document.getElementById("overlayRestartBtn"),
    padButtons: document.querySelectorAll(".pad-btn"),
  };

  let state = null;
  let lastViewHeight = null;

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  function randRange(min, maxInclusive) {
    return min + randInt(maxInclusive - min + 1);
  }

  function key(x, y) {
    return `${x},${y}`;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
  }

  function createEmptyMap() {
    return Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => "#")
    );
  }

  function carveRect(map, x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (inBounds(xx, yy)) {
          map[yy][xx] = ".";
        }
      }
    }
  }

  function carveCorridor(map, x1, y1, x2, y2) {
    let x = x1;
    let y = y1;
    map[y][x] = ".";
    if (randInt(2) === 0) {
      while (x !== x2) {
        x += Math.sign(x2 - x);
        map[y][x] = ".";
      }
      while (y !== y2) {
        y += Math.sign(y2 - y);
        map[y][x] = ".";
      }
    } else {
      while (y !== y2) {
        y += Math.sign(y2 - y);
        map[y][x] = ".";
      }
      while (x !== x2) {
        x += Math.sign(x2 - x);
        map[y][x] = ".";
      }
    }
  }

  function roomsOverlap(a, b) {
    return !(
      a.x + a.w + 1 < b.x ||
      b.x + b.w + 1 < a.x ||
      a.y + a.h + 1 < b.y ||
      b.y + b.h + 1 < a.y
    );
  }

  function generateMap() {
    const map = createEmptyMap();
    const rooms = [];

    for (let i = 0; i < ROOM_ATTEMPTS; i++) {
      const w = randRange(ROOM_MIN, ROOM_MAX);
      const h = randRange(ROOM_MIN, ROOM_MAX);
      const x = randRange(1, MAP_WIDTH - w - 2);
      const y = randRange(1, MAP_HEIGHT - h - 2);
      const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
      if (rooms.some((r) => roomsOverlap(room, r))) {
        continue;
      }
      carveRect(map, x, y, w, h);
      rooms.push(room);
    }

    if (rooms.length < 2) {
      carveRect(map, 2, 2, MAP_WIDTH - 4, MAP_HEIGHT - 4);
      rooms.push({ x: 2, y: 2, w: MAP_WIDTH - 4, h: MAP_HEIGHT - 4, cx: Math.floor(MAP_WIDTH / 2), cy: Math.floor(MAP_HEIGHT / 2) });
    } else {
      for (let i = 1; i < rooms.length; i++) {
        const prev = rooms[i - 1];
        const curr = rooms[i];
        carveCorridor(map, prev.cx, prev.cy, curr.cx, curr.cy);
      }
      for (let i = 0; i < Math.floor(rooms.length / 4); i++) {
        const a = rooms[randInt(rooms.length)];
        const b = rooms[randInt(rooms.length)];
        if (a !== b) {
          carveCorridor(map, a.cx, a.cy, b.cx, b.cy);
        }
      }
    }

    return { map, rooms };
  }

  function randomFloorPosition(map, occupiedSet) {
    for (let attempt = 0; attempt < 3000; attempt++) {
      const x = randInt(MAP_WIDTH);
      const y = randInt(MAP_HEIGHT);
      if (map[y][x] === "." && !occupiedSet.has(key(x, y))) {
        return { x, y };
      }
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (map[y][x] === "." && !occupiedSet.has(key(x, y))) {
          return { x, y };
        }
      }
    }
    throw new Error("No free floor tile found");
  }

  function chooseStartPosition(rooms, map, occupiedSet) {
    if (rooms.length > 0) {
      const room = rooms[0];
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (map[y][x] === "." && !occupiedSet.has(key(x, y))) {
            return { x, y };
          }
        }
      }
    }
    return randomFloorPosition(map, occupiedSet);
  }

  function chooseStairsPosition(rooms, map, occupiedSet, startPos) {
    if (rooms.length > 1) {
      const room = rooms[rooms.length - 1];
      const candidates = [];
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (map[y][x] !== ".") continue;
          if (occupiedSet.has(key(x, y))) continue;
          candidates.push({ x, y });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const da = Math.abs(a.x - startPos.x) + Math.abs(a.y - startPos.y);
          const db = Math.abs(b.x - startPos.x) + Math.abs(b.y - startPos.y);
          return db - da;
        });
        return candidates[0];
      }
    }

    let best = null;
    let bestDist = -1;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (map[y][x] !== "." || occupiedSet.has(key(x, y))) continue;
        const dist = Math.abs(x - startPos.x) + Math.abs(y - startPos.y);
        if (dist > bestDist) {
          best = { x, y };
          bestDist = dist;
        }
      }
    }
    if (best) return best;
    return randomFloorPosition(map, occupiedSet);
  }

  function generateFloorContents(floor, playerState, carryLog) {
    const generated = generateMap();
    const map = generated.map;
    const occupied = new Set();
    const startPos = chooseStartPosition(generated.rooms, map, occupied);
    const player = playerState || {
      hp: 14,
      maxHp: 14,
      atk: 3,
      def: 1,
    };
    player.x = startPos.x;
    player.y = startPos.y;
    occupied.add(key(player.x, player.y));

    const enemyTotal = ENEMY_COUNT + Math.max(0, floor - 1);
    const enemyHp = 7 + Math.max(0, floor - 1);
    const enemies = [];
    for (let i = 0; i < enemyTotal; i++) {
      const pos = randomFloorPosition(map, occupied);
      occupied.add(key(pos.x, pos.y));
      enemies.push({
        id: i + 1,
        x: pos.x,
        y: pos.y,
        hp: enemyHp,
      });
    }

    const chestTotal = CHEST_COUNT + Math.floor((floor - 1) / 3);
    const chests = [];
    for (let i = 0; i < chestTotal; i++) {
      const pos = randomFloorPosition(map, occupied);
      occupied.add(key(pos.x, pos.y));
      chests.push({ id: i + 1, x: pos.x, y: pos.y });
    }

    const atkItems = [];
    for (let i = 0; i < ATK_ITEM_COUNT; i++) {
      const pos = randomFloorPosition(map, occupied);
      occupied.add(key(pos.x, pos.y));
      atkItems.push({ id: i + 1, x: pos.x, y: pos.y, amount: 1 });
    }

    const defItems = [];
    for (let i = 0; i < DEF_ITEM_COUNT; i++) {
      const pos = randomFloorPosition(map, occupied);
      occupied.add(key(pos.x, pos.y));
      defItems.push({ id: i + 1, x: pos.x, y: pos.y, amount: 1 });
    }

    let stairs = null;
    if (floor < FINAL_FLOOR) {
      stairs = chooseStairsPosition(generated.rooms, map, occupied, startPos);
      occupied.add(key(stairs.x, stairs.y));
    }

    let boss = null;
    if (floor === FINAL_FLOOR) {
      const bossPos = chooseStairsPosition(generated.rooms, map, occupied, startPos);
      occupied.add(key(bossPos.x, bossPos.y));
      boss = {
        id: "B3",
        x: bossPos.x,
        y: bossPos.y,
        hp: BOSS_BASE_HP + Math.max(0, floor - 1) * 2,
      };
    }

    state = {
      map,
      rooms: generated.rooms,
      player,
      enemies,
      chests,
      atkItems,
      defItems,
      boss,
      stairs,
      floor,
      status: "Explore",
      log: carryLog || [{ message: "Entered the dungeon. Explore the rooms.", important: false }],
      gameOver: false,
      hitFlash: new Set(),
      seen: new Set(),
    };
  }

  function newGame() {
    generateFloorContents(1, null, null);

    setOverlay(false);
    updateSeen();
    render();
  }

  function pushLog(message, important) {
    state.log.push({ message, important: !!important });
    state.log = state.log.slice(-LOG_LIMIT);
  }

  function enemyAt(x, y) {
    return state.enemies.find((e) => e.x === x && e.y === y);
  }

  function chestAt(x, y) {
    return state.chests.find((c) => c.x === x && c.y === y);
  }

  function atkItemAt(x, y) {
    return state.atkItems.find((item) => item.x === x && item.y === y);
  }

  function defItemAt(x, y) {
    return state.defItems.find((item) => item.x === x && item.y === y);
  }

  function isStairsAt(x, y) {
    return state.stairs && state.stairs.x === x && state.stairs.y === y;
  }

  function bossAt(x, y) {
    if (!state.boss || state.boss.hp <= 0) {
      return null;
    }
    return state.boss.x === x && state.boss.y === y ? state.boss : null;
  }

  function isBlocked(x, y) {
    return !inBounds(x, y) || state.map[y][x] === "#";
  }

  function playerAttackDamage() {
    return 1 + randInt(3) + state.player.atk;
  }

  function tryPlayerMove(dx, dy) {
    if (state.gameOver) {
      return;
    }
    if (dx === 0 && dy === 0) {
      state.status = "Wait";
      pushLog("You wait and listen.");
      advanceTurn();
      return;
    }

    const nx = state.player.x + dx;
    const ny = state.player.y + dy;

    if (isBlocked(nx, ny)) {
      state.status = "Bump";
      pushLog("A wall blocks your path.");
      render();
      return;
    }

    const boss = bossAt(nx, ny);
    if (boss) {
      const dmg = playerAttackDamage();
      boss.hp -= dmg;
      state.hitFlash.add(key(boss.x, boss.y));
      state.status = `Hit ${dmg}`;
      pushLog(`You hit Boss ${boss.id} for ${dmg}.`, true);
      if (boss.hp <= 0) {
        state.boss = null;
        state.status = "Victory";
        pushLog(`Boss ${boss.id} is defeated.`, true);
        setOverlay(true, "Clear", "You defeated the B3 boss.");
        state.gameOver = true;
        render();
        return;
      }
      advanceTurn();
      return;
    }

    const target = enemyAt(nx, ny);
    if (target) {
      const dmg = playerAttackDamage();
      target.hp -= dmg;
      state.hitFlash.add(key(target.x, target.y));
      state.status = `Hit ${dmg}`;
      pushLog(`You hit enemy #${target.id} for ${dmg}.`, true);
      if (target.hp <= 0) {
        state.enemies = state.enemies.filter((e) => e !== target);
        pushLog(`Enemy #${target.id} is defeated.`);
      }
      advanceTurn();
      return;
    }

    state.player.x = nx;
    state.player.y = ny;
    state.status = "Move";
    openChestIfPresent(nx, ny);
    collectItemsIfPresent(nx, ny);
    if (isStairsAt(nx, ny)) {
      descendFloor();
      return;
    }
    advanceTurn();
  }

  function descendFloor() {
    const nextFloor = state.floor + 1;
    const carriedPlayer = {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      atk: state.player.atk,
      def: state.player.def,
    };
    const nextLog = [{ message: `You descend the stairs to floor ${nextFloor}.`, important: true }, ...state.log].slice(0, LOG_LIMIT);

    generateFloorContents(nextFloor, carriedPlayer, nextLog);
    state.status = "Descend";
    setOverlay(false);
    updateSeen();
    render();
  }

  function openChestIfPresent(x, y) {
    const chest = chestAt(x, y);
    if (!chest) {
      return;
    }

    state.chests = state.chests.filter((c) => c !== chest);
    state.status = "Chest";
    const beforeHp = state.player.hp;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 5);
    const healed = state.player.hp - beforeHp;
    pushLog(`Opened chest #${chest.id}: HP +${healed}.`, true);
  }

  function collectItemsIfPresent(x, y) {
    const atkItem = atkItemAt(x, y);
    if (atkItem) {
      state.atkItems = state.atkItems.filter((item) => item !== atkItem);
      state.player.atk += atkItem.amount;
      pushLog(`Picked ATK item #${atkItem.id}: ATK +${atkItem.amount}.`, true);
    }

    const defItem = defItemAt(x, y);
    if (defItem) {
      state.defItems = state.defItems.filter((item) => item !== defItem);
      state.player.def += defItem.amount;
      pushLog(`Picked DEF item #${defItem.id}: DEF +${defItem.amount}.`, true);
    }
  }

  function chooseEnemyStep(enemy, occupied) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const candidates = [];

    if (dist <= 10) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx !== 0) candidates.push({ dx: Math.sign(dx), dy: 0 });
        if (dy !== 0) candidates.push({ dx: 0, dy: Math.sign(dy) });
      } else {
        if (dy !== 0) candidates.push({ dx: 0, dy: Math.sign(dy) });
        if (dx !== 0) candidates.push({ dx: Math.sign(dx), dy: 0 });
      }
      if (candidates.length === 2 && randInt(100) < 35) {
        candidates.reverse();
      }
    } else {
      const wander = [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      while (wander.length) {
        candidates.push(wander.splice(randInt(wander.length), 1)[0]);
      }
    }

    candidates.push({ dx: 0, dy: 0 });

    for (const step of candidates) {
      const nx = enemy.x + step.dx;
      const ny = enemy.y + step.dy;
      if (step.dx === 0 && step.dy === 0) {
        return step;
      }
      if (isBlocked(nx, ny)) {
        continue;
      }
      if (nx === state.player.x && ny === state.player.y) {
        continue;
      }
      if (occupied.has(key(nx, ny))) {
        continue;
      }
      return step;
    }
    return { dx: 0, dy: 0 };
  }

  function enemyTurn() {
    const occupied = new Set(state.enemies.map((e) => key(e.x, e.y)));
    occupied.delete(key(state.player.x, state.player.y));
    if (state.boss && state.boss.hp > 0) {
      occupied.add(key(state.boss.x, state.boss.y));
    }

    for (const enemy of state.enemies) {
      if (state.gameOver) {
        return;
      }
      occupied.delete(key(enemy.x, enemy.y));

      const adjacent =
        Math.abs(state.player.x - enemy.x) + Math.abs(state.player.y - enemy.y) === 1;
      if (adjacent) {
        const dmg = Math.max(1, 2 + randInt(2) - state.player.def);
        state.player.hp -= dmg;
        state.hitFlash.add(key(state.player.x, state.player.y));
        state.status = `Damaged ${dmg}`;
        pushLog(`Enemy #${enemy.id} hits you for ${dmg}.`, true);
        occupied.add(key(enemy.x, enemy.y));
        continue;
      }

      const step = chooseEnemyStep(enemy, occupied);
      enemy.x += step.dx;
      enemy.y += step.dy;
      occupied.add(key(enemy.x, enemy.y));
    }

    if (state.gameOver || !state.boss || state.boss.hp <= 0) {
      return;
    }

    occupied.delete(key(state.boss.x, state.boss.y));
    const adjacent =
      Math.abs(state.player.x - state.boss.x) + Math.abs(state.player.y - state.boss.y) === 1;
    if (adjacent) {
      const dmg = Math.max(1, 2 + randInt(3) - state.player.def);
      state.player.hp -= dmg;
      state.hitFlash.add(key(state.player.x, state.player.y));
      state.status = `Boss hit ${dmg}`;
      pushLog(`Boss ${state.boss.id} hits you for ${dmg}.`, true);
      occupied.add(key(state.boss.x, state.boss.y));
      return;
    }

    const step = chooseEnemyStep(state.boss, occupied);
    state.boss.x += step.dx;
    state.boss.y += step.dy;
    occupied.add(key(state.boss.x, state.boss.y));
  }

  function checkEndState() {
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.gameOver = true;
      state.status = "Defeated";
      setOverlay(true, "Game Over", "You were defeated.");
      return;
    }
  }

  function advanceTurn() {
    enemyTurn();
    checkEndState();
    render();
  }

  function setOverlay(show, title, text) {
    if (show) {
      els.overlay.classList.remove("hidden");
      els.overlayTitle.textContent = title || "Game Over";
      els.overlayText.textContent = text || "";
    } else {
      els.overlay.classList.add("hidden");
      els.overlayTitle.textContent = "";
      els.overlayText.textContent = "";
    }
  }

  function getViewSize() {
    const cssWidth = Math.max(1, els.map.clientWidth || 420);
    const cssHeight = Math.max(1, els.map.clientHeight || 300);
    const tileByWidth = cssWidth / VIEW_WIDTH;
    const rows = Math.ceil(cssHeight / tileByWidth);
    const height = Math.max(8, Math.min(MAP_HEIGHT, rows || 15));
    return { width: VIEW_WIDTH, height };
  }

  function refreshViewLayout(forceRender) {
    const view = getViewSize();
    if (forceRender || lastViewHeight !== view.height) {
      lastViewHeight = view.height;
      if (state) {
        render();
      }
    }
  }

  function getCamera() {
    const view = getViewSize();
    let left = state.player.x - Math.floor(view.width / 2);
    let top = state.player.y - Math.floor(view.height / 2);
    left = Math.max(0, Math.min(MAP_WIDTH - view.width, left));
    top = Math.max(0, Math.min(MAP_HEIGHT - view.height, top));
    return { left, top, width: view.width, height: view.height };
  }

  function updateSeen() {
    const camera = getCamera();
    for (let y = camera.top; y < camera.top + camera.height; y++) {
      for (let x = camera.left; x < camera.left + camera.width; x++) {
        if (inBounds(x, y)) {
          state.seen.add(key(x, y));
        }
      }
    }
  }

  function renderLog() {
    els.log.innerHTML = "";
    for (const entry of state.log) {
      const li = document.createElement("li");
      li.textContent = entry.message;
      if (entry.important) {
        li.classList.add("important");
      }
      els.log.appendChild(li);
    }
    els.log.scrollTop = els.log.scrollHeight;
  }

  function renderMap() {
    const canvas = els.map;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const enemyMap = new Map(state.enemies.map((e) => [key(e.x, e.y), e]));
    const chestMap = new Map(state.chests.map((c) => [key(c.x, c.y), c]));
    const atkItemMap = new Map(state.atkItems.map((item) => [key(item.x, item.y), item]));
    const defItemMap = new Map(state.defItems.map((item) => [key(item.x, item.y), item]));
    const boss = state.boss && state.boss.hp > 0 ? state.boss : null;
    const camera = getCamera();

    const cssWidth = Math.max(1, canvas.clientWidth);
    const cssHeight = Math.max(1, canvas.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const tileSize = cssHeight / camera.height;
    const drawWidth = tileSize * camera.width;
    const drawHeight = tileSize * camera.height;
    const offsetX = (cssWidth - drawWidth) * 0.5;
    const offsetY = (cssHeight - drawHeight) * 0.5;
    const glyphSize = Math.max(10, Math.floor(tileSize * 0.72));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${glyphSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

    for (let vy = 0; vy < camera.height; vy++) {
      for (let vx = 0; vx < camera.width; vx++) {
        const x = camera.left + vx;
        const y = camera.top + vy;
        const tileX = offsetX + vx * tileSize;
        const tileY = offsetY + vy * tileSize;

        let bgColor = state.map[y][x] === "#" ? "#5f4f42" : "#253238";
        let glyph = "";
        let glyphColor = "#e7efe8";

        if (state.player.x === x && state.player.y === y) {
          bgColor = "#62c846";
          glyph = "🦸";
          glyphColor = "#0b120a";
        } else if (boss && boss.x === x && boss.y === y) {
          bgColor = "#b51f1f";
          glyph = "👹";
          glyphColor = "#220402";
        } else if (enemyMap.has(key(x, y))) {
          bgColor = "#df564a";
          glyph = "👾";
          glyphColor = "#230808";
        } else if (chestMap.has(key(x, y))) {
          bgColor = "#cd9444";
          glyph = "🧪";
          glyphColor = "#201708";
        } else if (atkItemMap.has(key(x, y))) {
          bgColor = "#d27d1e";
          glyph = "⚔";
          glyphColor = "#2a1200";
        } else if (defItemMap.has(key(x, y))) {
          bgColor = "#3d92cf";
          glyph = "🛡";
          glyphColor = "#041c2d";
        } else if (isStairsAt(x, y)) {
          bgColor = "#5fb1df";
          glyph = "🪜";
          glyphColor = "#071520";
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(tileX, tileY, tileSize, tileSize);

        if (state.hitFlash.has(key(x, y))) {
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(tileX, tileY, tileSize, tileSize);
        }

        if (glyph) {
          ctx.fillStyle = glyphColor;
          ctx.fillText(glyph, tileX + tileSize / 2, tileY + tileSize / 2 + 0.5);
        }
      }
    }
  }

  function renderMinimap() {
    const canvas = els.minimap;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sx = canvas.width / MAP_WIDTH;
    const sy = canvas.height / MAP_HEIGHT;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!state.seen.has(key(x, y))) {
          continue;
        }
        ctx.fillStyle =
          state.map[y][x] === "#"
            ? "rgba(225, 206, 162, 0.38)"
            : "rgba(91, 141, 160, 0.28)";
        ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }

    for (const chest of state.chests) {
      if (!state.seen.has(key(chest.x, chest.y))) continue;
      ctx.fillStyle = "rgba(255, 198, 92, 0.6)";
      ctx.fillRect(chest.x * sx, chest.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    for (const item of state.atkItems) {
      if (!state.seen.has(key(item.x, item.y))) continue;
      ctx.fillStyle = "rgba(255, 170, 60, 0.66)";
      ctx.fillRect(item.x * sx, item.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    for (const item of state.defItems) {
      if (!state.seen.has(key(item.x, item.y))) continue;
      ctx.fillStyle = "rgba(90, 180, 255, 0.66)";
      ctx.fillRect(item.x * sx, item.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    if (state.stairs && state.seen.has(key(state.stairs.x, state.stairs.y))) {
      ctx.fillStyle = "rgba(132, 210, 255, 0.62)";
      ctx.fillRect(state.stairs.x * sx, state.stairs.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    for (const enemy of state.enemies) {
      if (!state.seen.has(key(enemy.x, enemy.y))) continue;
      ctx.fillStyle = "rgba(255, 92, 92, 0.64)";
      ctx.fillRect(enemy.x * sx, enemy.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    if (state.boss && state.boss.hp > 0 && state.seen.has(key(state.boss.x, state.boss.y))) {
      ctx.fillStyle = "rgba(255, 24, 24, 0.7)";
      ctx.fillRect(state.boss.x * sx, state.boss.y * sy, Math.ceil(sx), Math.ceil(sy));
    }

    ctx.fillStyle = "rgba(115, 255, 92, 0.8)";
    ctx.fillRect(state.player.x * sx, state.player.y * sy, Math.ceil(sx), Math.ceil(sy));

    const camera = getCamera();
    ctx.strokeStyle = "rgba(185, 235, 255, 1)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      Math.floor(camera.left * sx) + 0.5,
      Math.floor(camera.top * sy) + 0.5,
      Math.max(1, Math.floor(camera.width * sx)),
      Math.max(1, Math.floor(camera.height * sy))
    );
  }

  function render() {
    updateSeen();
    els.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
    els.floor.textContent = String(state.floor);
    els.atk.textContent = String(state.player.atk);
    els.def.textContent = String(state.player.def);

    renderLog();
    renderMap();
    renderMinimap();
    state.hitFlash.clear();
  }

  function handleKeyDown(event) {
    const k = event.key.toLowerCase();
    const moves = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
      ".": [0, 0],
      " ": [0, 0],
    };

    if (k === "r") {
      newGame();
      return;
    }
    if (!(k in moves)) {
      return;
    }

    event.preventDefault();
    const move = moves[k];
    tryPlayerMove(move[0], move[1]);
  }

  function attachEvents() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", () => refreshViewLayout(true));
    window.addEventListener("orientationchange", () => refreshViewLayout(true));
    els.overlayRestartBtn.addEventListener("click", newGame);
    const padMoves = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    for (const button of els.padButtons) {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const move = padMoves[button.dataset.move];
        if (!move) {
          return;
        }
        tryPlayerMove(move[0], move[1]);
      });
    }
  }

  attachEvents();
  newGame();
})();
