const MAP_W    = 80;
const MAP_H    = 50;
let VIEW_W     = 25;
let VIEW_H     = 15;
const CELL     = 20;     // px per tile (main canvas)
const MM_SCALE = 3;      // px per tile (minimap)
const FLOORS   = 3;

class MapGenerator {
  generate() {
    const tiles = Array.from({ length: MAP_H }, () =>
      Array(MAP_W).fill('wall')
    );
    const rooms = [];

    const roomCount = 6 + Math.floor(Math.random() * 5); // 6〜10
    const attempts  = 200;

    for (let i = 0; i < attempts && rooms.length < roomCount; i++) {
      const w = 5 + Math.floor(Math.random() * 8);  // 5〜12
      const h = 4 + Math.floor(Math.random() * 5);  // 4〜8
      const x = 1 + Math.floor(Math.random() * (MAP_W - w - 2));
      const y = 1 + Math.floor(Math.random() * (MAP_H - h - 2));

      const room = { x, y, w, h };
      if (rooms.some(r => this._overlaps(r, room, 1))) continue;

      for (let ry = y; ry < y + h; ry++)
        for (let rx = x; rx < x + w; rx++)
          tiles[ry][rx] = 'floor';

      rooms.push(room);
    }

    for (let i = 1; i < rooms.length; i++) {
      const a = this._center(rooms[i - 1]);
      const b = this._center(rooms[i]);
      this._carveCorridor(tiles, a, b);
    }

    return { tiles, rooms };
  }

  _overlaps(a, b, margin) {
    return (
      a.x - margin < b.x + b.w + margin &&
      a.x + a.w + margin > b.x - margin &&
      a.y - margin < b.y + b.h + margin &&
      a.y + a.h + margin > b.y - margin
    );
  }

  _center(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2),
    };
  }

  _carveCorridor(tiles, a, b) {
    let x = a.x;
    while (x !== b.x) {
      tiles[a.y][x] = 'floor';
      x += x < b.x ? 1 : -1;
    }
    let y = a.y;
    while (y !== b.y) {
      tiles[y][b.x] = 'floor';
      y += y < b.y ? 1 : -1;
    }
  }
}

const EMOJI = {
  wall:   '🧱',
  stair:  '🪜',
  player: '🧑',
  slime:  '🟢',
  bat:    '🦇',
  boss:   '💀',
  potion: '🧪',
  sword:  '⚔️',
};

class Renderer {
  constructor() {
    this.mainCanvas = document.getElementById('main-canvas');
    this.mainCtx    = this.mainCanvas.getContext('2d');
    this.mmCanvas   = document.getElementById('minimap-canvas');
    this.mmCtx      = this.mmCanvas.getContext('2d');
    this.gameArea   = document.getElementById('game-area');
  }

  resize() {
    const w = this.mainCanvas.offsetWidth;
    const h = this.gameArea.offsetHeight;
    if (!w || !h) return;
    VIEW_W = Math.max(1, Math.floor(w / CELL));
    VIEW_H = Math.max(1, Math.min(15, Math.floor(h / CELL)));
    this.mainCanvas.width  = w;
    this.mainCanvas.height = VIEW_H * CELL;
  }

  init() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    this.mmCtx.clearRect(0, 0, this.mmCanvas.width, this.mmCanvas.height);
    document.getElementById('message-log').innerHTML = '';
  }

  render(state) {
    const { tiles, entities, items, camX, camY, player, visited } = state;
    this._drawMain(tiles, entities, items, camX, camY);
    this._drawMinimap(tiles, visited, player);
  }

  _drawMain(tiles, entities, items, camX, camY) {
    const ctx = this.mainCtx;

    // 背景クリア（暗い洞窟）
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, VIEW_W * CELL, VIEW_H * CELL);

    ctx.font = `${CELL - 2}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // タイル
    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const mx = camX + vx;
        const my = camY + vy;
        if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) continue;
        const emoji = EMOJI[tiles[my][mx]];
        if (emoji) ctx.fillText(emoji, vx * CELL + CELL / 2, vy * CELL + CELL / 2);
      }
    }

    // アイテム
    for (const item of items) {
      if (item.picked) continue;
      const vx = item.x - camX;
      const vy = item.y - camY;
      if (vx < 0 || vx >= VIEW_W || vy < 0 || vy >= VIEW_H) continue;
      ctx.fillText(EMOJI[item.type], vx * CELL + CELL / 2, vy * CELL + CELL / 2);
    }

    // エンティティ（hp > 0 のもののみ）
    for (const e of entities) {
      if (e.hp <= 0) continue;
      const vx = e.x - camX;
      const vy = e.y - camY;
      if (vx < 0 || vx >= VIEW_W || vy < 0 || vy >= VIEW_H) continue;
      ctx.fillText(EMOJI[e.type], vx * CELL + CELL / 2, vy * CELL + CELL / 2);
    }
  }

  _drawMinimap(tiles, visited, player) {
    const ctx = this.mmCtx;
    const W   = MAP_W * MM_SCALE;
    const H   = MAP_H * MM_SCALE;

    // 完全クリア（未訪問 = 透明）
    ctx.clearRect(0, 0, W, H);

    // 訪問済みタイルのみ描画（高コントラスト）
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!visited[y][x]) continue;
        const tile = tiles[y][x];
        if (tile === 'wall')        ctx.fillStyle = '#334';
        else if (tile === 'stair')  ctx.fillStyle = '#fa0';
        else                        ctx.fillStyle = '#4af'; // floor
        ctx.fillRect(x * MM_SCALE, y * MM_SCALE, MM_SCALE, MM_SCALE);
      }
    }

    // プレイヤー位置（黄色 5×5 px）
    ctx.fillStyle = '#ff0';
    ctx.fillRect(
      player.x * MM_SCALE - 1,
      player.y * MM_SCALE - 1,
      MM_SCALE + 2,
      MM_SCALE + 2
    );
  }

  setMessage(msg) {
    const log = document.getElementById('message-log');
    const p = document.createElement('p');
    p.textContent = msg;
    log.appendChild(p);
    if (log.children.length > 100) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  updateStats(player, floor) {
    document.getElementById('stat-hp').textContent =
      `❤️ HP: ${player.hp}/${player.maxHp}`;
    document.getElementById('stat-atk').textContent =
      `⚔️ ATK: ${player.atk}`;
    document.getElementById('stat-def').textContent =
      `🛡️ DEF: ${player.def}`;
    document.getElementById('stat-floor').textContent =
      `🏚️ B${floor}`;
  }

  showOverlay(title, msg) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-msg').textContent = msg;
    document.getElementById('overlay').classList.remove('hidden');
  }

  hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
  }
}

class Entity {
  constructor({ type, x, y, hp, atk, def }) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.atk = atk;
    this.def = def;
  }

  attack(target) {
    const dmg = Math.max(1, this.atk - target.def);
    target.hp -= dmg;
    return dmg;
  }

  get isAlive() { return this.hp > 0; }
}

class Game {
  constructor() {
    this.renderer = new Renderer();
    this.init();
  }

  init() {
    // 全フロアを事前生成
    this.floors = [];
    for (let f = 1; f <= FLOORS; f++) {
      this.floors.push(this._generateFloor(f));
    }

    // プレイヤーを B1 開始部屋に配置
    const f1 = this.floors[0];
    const startRoom = f1.rooms[0];
    this.player = new Entity({
      type: 'player',
      x: Math.floor(startRoom.x + startRoom.w / 2),
      y: Math.floor(startRoom.y + startRoom.h / 2),
      hp: 20, atk: 3, def: 1,
    });

    // 現在フロアのデータをセット
    this.floor = 1;
    this._applyFloor(this.floors[0]);

    this.gameOver = false;

    this.renderer.resize();
    this.renderer.init();
    this.markVisited();
    this.render();
    this.renderer.setMessage('ダンジョンに入った。B3のボスを倒せ！');

    if (!this._keyHandler) {
      this._keyHandler = (e) => this.handleKey(e);
      window.addEventListener('keydown', this._keyHandler);
    }
  }

  // フロアデータを生成（フロアナンバーで難易度を変える）
  _generateFloor(floorNum) {
    const gen = new MapGenerator();
    let { tiles, rooms } = gen.generate();
    let retries = 0;
    while (rooms.length < 3 && retries < 20) {
      ({ tiles, rooms } = gen.generate());
      retries++;
    }

    const visited = Array.from({ length: MAP_H }, () =>
      Array(MAP_W).fill(false)
    );

    // 難易度テーブル
    const cfg = {
      1: { slime: { hp:8,  atk:2, def:0 }, bat: { hp:5,  atk:3, def:0 } },
      2: { slime: { hp:12, atk:3, def:0 }, bat: { hp:8,  atk:4, def:0 } },
      3: { slime: { hp:16, atk:4, def:1 }, bat: { hp:10, atk:5, def:0 } },
    }[floorNum];

    // 中間部屋に雑魚敵
    const enemies = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];
      const cx = Math.floor(room.x + room.w / 2);
      const cy = Math.floor(room.y + room.h / 2);
      const type = Math.random() < 0.5 ? 'slime' : 'bat';
      enemies.push(new Entity({ type, x: cx, y: cy, ...cfg[type] }));
    }

    // 最終部屋: B3 はボス、それ以外は階段
    const lastRoom = rooms[rooms.length - 1];
    const lx = Math.floor(lastRoom.x + lastRoom.w / 2);
    const ly = Math.floor(lastRoom.y + lastRoom.h / 2);
    if (floorNum === FLOORS) {
      enemies.push(new Entity({ type:'boss', x:lx, y:ly, hp:30, atk:6, def:2 }));
    } else {
      tiles[ly][lx] = 'stair';
    }

    // 中間部屋にアイテム（敵と座標被りを回避）
    const items = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];
      let ix, iy, tries = 0;
      do {
        ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
        iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
        tries++;
      } while (enemies.some(e => e.x === ix && e.y === iy) && tries < 20);
      const type = Math.random() < 0.5 ? 'potion' : 'sword';
      items.push({ type, x: ix, y: iy, picked: false });
    }

    return { tiles, rooms, enemies, items, visited };
  }

  // 現在フロアデータを this に展開
  _applyFloor(f) {
    this.tiles   = f.tiles;
    this.enemies = f.enemies;
    this.items   = f.items;
    this.visited = f.visited;
  }

  // カメラ位置（プレイヤー中心、マップ端クランプ）
  getCamera() {
    const camX = Math.max(0, Math.min(
      this.player.x - Math.floor(VIEW_W / 2), MAP_W - VIEW_W
    ));
    const camY = Math.max(0, Math.min(
      this.player.y - Math.floor(VIEW_H / 2), MAP_H - VIEW_H
    ));
    return { camX, camY };
  }

  // 現在のビューポート矩形を訪問済みにマーク
  markVisited() {
    const { camX, camY } = this.getCamera();
    for (let y = camY; y < camY + VIEW_H; y++)
      for (let x = camX; x < camX + VIEW_W; x++)
        this.visited[y][x] = true;
  }

  // 次フロアに降りる
  descend() {
    const nextFloor = this.floor + 1;
    this.floor = nextFloor;
    const f = this.floors[nextFloor - 1];
    this._applyFloor(f);

    const startRoom = f.rooms[0];
    this.player.x = Math.floor(startRoom.x + startRoom.w / 2);
    this.player.y = Math.floor(startRoom.y + startRoom.h / 2);

    this.renderer.setMessage(`B${this.floor} に降りた！`);
    this.markVisited();
    this.render();
  }

  get allEntities() {
    return [this.player, ...this.enemies];
  }

  render() {
    const { camX, camY } = this.getCamera();
    this.renderer.render({
      tiles:    this.tiles,
      entities: this.allEntities,
      items:    this.items,
      camX, camY,
      player:   this.player,
      visited:  this.visited,
    });
    this.renderer.updateStats(this.player, this.floor);
  }

  handleKey(e) {
    if (this.gameOver) return;
    const dirs = {
      ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
      w: [0,-1], s: [0,1], a: [-1,0], d: [1,0],
      W: [0,-1], S: [0,1], A: [-1,0], D: [1,0],
    };
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();
    this.playerTurn(dir[0], dir[1]);
  }

  playerTurn(dx, dy) {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return;
    if (this.tiles[ny][nx] === 'wall') return;

    const enemy = this.enemies.find(e => e.isAlive && e.x === nx && e.y === ny);
    if (enemy) {
      const dmg = this.player.attack(enemy);
      let msg = `${enemy.type}に${dmg}ダメージ！`;
      if (!enemy.isAlive) {
        msg += `　${enemy.type}を倒した！`;
        if (enemy.type === 'boss') {
          this.winGame();
          return;
        }
      }
      this.renderer.setMessage(msg);
    } else {
      this.player.x = nx;
      this.player.y = ny;

      // 階段を踏んだら降下
      if (this.tiles[ny][nx] === 'stair') {
        this.descend();
        return;
      }

      this.pickUpItems();
    }

    this.markVisited();
    this.enemyTurns();

    if (!this.player.isAlive) {
      this.loseGame();
      return;
    }

    this.render();
  }

  pickUpItems() {
    for (const item of this.items) {
      if (!item.picked && item.x === this.player.x && item.y === this.player.y) {
        item.picked = true;
        if (item.type === 'potion') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5);
          this.renderer.setMessage('🧪 回復薬を拾った！ HP+5');
        } else if (item.type === 'sword') {
          this.player.atk += 2;
          this.renderer.setMessage('⚔️ 武器を拾った！ ATK+2');
        }
      }
    }
  }

  enemyTurns() {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      this.moveEnemy(enemy);
    }
  }

  moveEnemy(enemy) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    let mx = 0, my = 0;

    if (dist <= 5) {
      if (Math.abs(dx) >= Math.abs(dy)) mx = dx > 0 ? 1 : -1;
      else my = dy > 0 ? 1 : -1;
    } else {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      const [rx, ry] = dirs[Math.floor(Math.random() * 4)];
      mx = rx; my = ry;
    }

    const nx = enemy.x + mx;
    const ny = enemy.y + my;

    if (nx === this.player.x && ny === this.player.y) {
      const dmg = enemy.attack(this.player);
      this.renderer.setMessage(`${enemy.type}に${dmg}ダメージを受けた！`);
      return;
    }

    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return;
    if (this.tiles[ny][nx] === 'wall') return;
    if (this.tiles[ny][nx] === 'stair') return;
    if (this.enemies.some(e => e.isAlive && e.x === nx && e.y === ny)) return;

    enemy.x = nx;
    enemy.y = ny;
  }

  winGame() {
    this.gameOver = true;
    this.render();
    this.renderer.showOverlay('🎉 クリア！', 'B3のボスを倒した！おめでとう！');
  }

  loseGame() {
    this.gameOver = true;
    this.render();
    this.renderer.showOverlay('💀 ゲームオーバー', 'HPが0になった...');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();

  new ResizeObserver(() => {
    game.renderer.resize();
    game.markVisited();
    game.render();
  }).observe(document.getElementById('game-area'));

  document.getElementById('overlay-btn').addEventListener('click', () => {
    game.renderer.hideOverlay();
    game.init();
  });

  const dpadMap = {
    'dpad-up':    [0, -1],
    'dpad-down':  [0,  1],
    'dpad-left':  [-1, 0],
    'dpad-right': [1,  0],
  };
  for (const [id, dir] of Object.entries(dpadMap)) {
    document.getElementById(id).addEventListener('pointerdown', e => {
      e.preventDefault();
      game.playerTurn(dir[0], dir[1]);
    });
  }
});
