# Roguelike Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ブラウザで動くシングルフロアのローグライクゲームを index.html + style.css + game.js の3ファイルで作る。

**Architecture:** MapGenerator でランダム部屋生成、Entity でプレイヤー/敵の共通クラス、Game でターン制御・入力処理、Renderer でDOMに絵文字グリッドを描画する。ゲームロジックはすべて game.js に収める。

**Tech Stack:** Vanilla HTML5/CSS3/JavaScript (ES2020, class構文) — 外部ライブラリなし

---

### Task 1: プロジェクトスキャフォールド

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `game.js`

**Step 1: index.html を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rogue</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <div id="game-area">
      <div id="grid"></div>
    </div>
    <div id="ui-panel">
      <div id="stats">
        <span id="stat-hp">❤️ HP: 20/20</span>
        <span id="stat-atk">⚔️ ATK: 3</span>
        <span id="stat-def">🛡️ DEF: 1</span>
        <span id="stat-gold">💰 Gold: 0</span>
      </div>
      <div id="message-log">
        <p id="message">ダンジョンに入った。ボスを倒せ！</p>
      </div>
    </div>
    <div id="overlay" class="hidden">
      <div id="overlay-content">
        <h1 id="overlay-title"></h1>
        <p id="overlay-msg"></p>
        <button id="overlay-btn">もう一度</button>
      </div>
    </div>
  </div>
  <script src="game.js"></script>
</body>
</html>
```

**Step 2: style.css を作成**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #111;
  color: #eee;
  font-family: monospace;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding: 16px;
}

#app {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 900px;
  width: 100%;
}

#game-area {
  border: 2px solid #444;
  background: #000;
  overflow: hidden;
}

#grid {
  display: grid;
  /* columns set by JS: grid-template-columns */
  line-height: 1;
}

.cell {
  width: 20px;
  height: 20px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

#ui-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  padding: 4px 8px;
  background: #222;
  border: 1px solid #444;
}

#message-log {
  padding: 4px 8px;
  background: #1a1a1a;
  border: 1px solid #333;
  font-size: 13px;
  min-height: 24px;
  color: #aaa;
}

#overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
}

#overlay.hidden { display: none; }

#overlay-content {
  background: #222;
  border: 2px solid #666;
  padding: 32px 48px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#overlay-title { font-size: 2rem; }

#overlay-btn {
  padding: 8px 24px;
  font-size: 1rem;
  cursor: pointer;
  background: #444;
  color: #eee;
  border: 1px solid #888;
}

#overlay-btn:hover { background: #666; }
```

**Step 3: game.js のスタブを作成**

```javascript
// game.js — エントリポイント（後のタスクで肉付け）
window.addEventListener('DOMContentLoaded', () => {
  console.log('game.js loaded');
});
```

**Step 4: ブラウザで確認**

`index.html` をブラウザで開く。コンソールに `game.js loaded` が出ればOK。
画面は黒背景にUIパネルが表示される。

**Step 5: コミット**

```bash
git init
git add index.html style.css game.js
git commit -m "feat: scaffold index.html, style.css, game.js stub"
```

---

### Task 2: MapGenerator — ランダム部屋生成

**Files:**
- Modify: `game.js`

マップは `MAP_W=40, MAP_H=25` の2D配列。値は `'wall'` または `'floor'`。
部屋を4〜6個ランダム配置し、部屋同士をL字通路でつなぐ。

**Step 1: game.js に MapGenerator を追加**

```javascript
const MAP_W = 40;
const MAP_H = 25;

class MapGenerator {
  generate() {
    // 全マスを壁で初期化
    const tiles = Array.from({ length: MAP_H }, () =>
      Array(MAP_W).fill('wall')
    );
    const rooms = [];

    const roomCount = 4 + Math.floor(Math.random() * 3); // 4〜6
    const attempts = 100;

    for (let i = 0; i < attempts && rooms.length < roomCount; i++) {
      const w = 4 + Math.floor(Math.random() * 6);  // 4〜9
      const h = 3 + Math.floor(Math.random() * 5);  // 3〜7
      const x = 1 + Math.floor(Math.random() * (MAP_W - w - 2));
      const y = 1 + Math.floor(Math.random() * (MAP_H - h - 2));

      const room = { x, y, w, h };
      if (rooms.some(r => this._overlaps(r, room, 1))) continue;

      // 部屋を床にする
      for (let ry = y; ry < y + h; ry++)
        for (let rx = x; rx < x + w; rx++)
          tiles[ry][rx] = 'floor';

      rooms.push(room);
    }

    // 隣接する部屋をL字通路でつなぐ
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
    // 横 → 縦 の L字
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
```

**Step 2: コンソールで確認**

DOMContentLoaded内で以下を実行してroomsが配列で返ることを確認:
```javascript
const gen = new MapGenerator();
const { tiles, rooms } = gen.generate();
console.log('rooms:', rooms.length, rooms);
console.log('tile[0]:', tiles[0]);
```

**Step 3: コミット**

```bash
git add game.js
git commit -m "feat: add MapGenerator with random room placement and corridors"
```

---

### Task 3: Renderer — 絵文字グリッド描画

**Files:**
- Modify: `game.js`

**Step 1: Renderer クラスを追加**

```javascript
const EMOJI = {
  wall:    '🧱',
  floor:   '⬛',
  player:  '🧑',
  slime:   '🟢',
  bat:     '🦇',
  boss:    '💀',
  potion:  '🧪',
  sword:   '⚔️',
  goal:    '🌀',
};

class Renderer {
  constructor() {
    this.gridEl = document.getElementById('grid');
    this.cells = [];
  }

  init(mapW, mapH) {
    this.gridEl.style.gridTemplateColumns = `repeat(${mapW}, 20px)`;
    this.gridEl.innerHTML = '';
    this.cells = [];
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        this.gridEl.appendChild(cell);
        this.cells.push(cell);
      }
    }
  }

  render(state) {
    const { tiles, entities, items } = state;
    const mapW = tiles[0].length;
    const mapH = tiles.length;

    // タイル描画
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        this.cells[y * mapW + x].textContent = EMOJI[tiles[y][x]];
      }
    }

    // アイテム描画
    for (const item of items) {
      if (!item.picked) {
        this.cells[item.y * mapW + item.x].textContent = EMOJI[item.type];
      }
    }

    // エンティティ描画（敵→プレイヤーの順で上書き）
    for (const e of entities) {
      if (e.hp > 0) {
        this.cells[e.y * mapW + e.x].textContent = EMOJI[e.type];
      }
    }
  }

  setMessage(msg) {
    document.getElementById('message').textContent = msg;
  }

  updateStats(player) {
    document.getElementById('stat-hp').textContent =
      `❤️ HP: ${player.hp}/${player.maxHp}`;
    document.getElementById('stat-atk').textContent =
      `⚔️ ATK: ${player.atk}`;
    document.getElementById('stat-def').textContent =
      `🛡️ DEF: ${player.def}`;
    document.getElementById('stat-gold').textContent =
      `💰 Gold: ${player.gold}`;
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
```

**Step 2: ブラウザで仮確認**

DOMContentLoaded内で以下を実行して壁と床が表示されることを確認:
```javascript
const gen = new MapGenerator();
const { tiles } = gen.generate();
const renderer = new Renderer();
renderer.init(MAP_W, MAP_H);
renderer.render({ tiles, entities: [], items: [] });
```

**Step 3: コミット**

```bash
git add game.js
git commit -m "feat: add Renderer with emoji grid and UI panel updates"
```

---

### Task 4: Entity クラス — プレイヤー・敵の共通クラス

**Files:**
- Modify: `game.js`

**Step 1: Entity クラスを追加**

```javascript
class Entity {
  constructor({ type, x, y, hp, atk, def }) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.atk = atk;
    this.def = def;
    // プレイヤー専用
    this.gold = 0;
  }

  attack(target) {
    const dmg = Math.max(1, this.atk - target.def);
    target.hp -= dmg;
    return dmg;
  }

  get isAlive() { return this.hp > 0; }
}
```

**Step 2: コンソールで確認**

```javascript
const player = new Entity({ type:'player', x:5, y:5, hp:20, atk:3, def:1 });
const slime  = new Entity({ type:'slime',  x:6, y:5, hp:5,  atk:2, def:0 });
const dmg = player.attack(slime);
console.assert(dmg === 3, 'ATK3-DEF0=3');
console.assert(slime.hp === 2, 'slime hp 5-3=2');
```

**Step 3: コミット**

```bash
git add game.js
git commit -m "feat: add Entity class with attack method"
```

---

### Task 5: Game クラス — 初期化・状態管理

**Files:**
- Modify: `game.js`

**Step 1: Game クラスを追加**

```javascript
class Game {
  constructor() {
    this.renderer = new Renderer();
    this.init();
  }

  init() {
    const gen = new MapGenerator();
    const { tiles, rooms } = gen.generate();
    this.tiles = tiles;

    // プレイヤーを最初の部屋の中心に配置
    const startRoom = rooms[0];
    const startX = Math.floor(startRoom.x + startRoom.w / 2);
    const startY = Math.floor(startRoom.y + startRoom.h / 2);
    this.player = new Entity({ type:'player', x:startX, y:startY, hp:20, atk:3, def:1 });

    // 敵を生成（各部屋にスライムかコウモリ。最後の部屋にボス）
    this.enemies = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];
      const cx = Math.floor(room.x + room.w / 2);
      const cy = Math.floor(room.y + room.h / 2);
      const type = Math.random() < 0.5 ? 'slime' : 'bat';
      const cfg = type === 'slime'
        ? { hp:8, atk:2, def:0 }
        : { hp:5, atk:3, def:0 };
      this.enemies.push(new Entity({ type, x:cx, y:cy, ...cfg }));
    }
    // ボス（最後の部屋）
    const bossRoom = rooms[rooms.length - 1];
    const bx = Math.floor(bossRoom.x + bossRoom.w / 2);
    const by = Math.floor(bossRoom.y + bossRoom.h / 2);
    this.enemies.push(new Entity({ type:'boss', x:bx, y:by, hp:20, atk:4, def:2 }));

    // アイテム生成（中間の部屋にランダム配置）
    this.items = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      const room = rooms[i];
      const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      const type = Math.random() < 0.5 ? 'potion' : 'sword';
      this.items.push({ type, x:ix, y:iy, picked:false });
    }

    this.gameOver = false;

    // Renderer初期化・初回描画
    this.renderer.init(MAP_W, MAP_H);
    this.render();
    this.renderer.setMessage('ダンジョンに入った。ボスを倒せ！');
  }

  get allEntities() {
    return [this.player, ...this.enemies];
  }

  render() {
    this.renderer.render({
      tiles: this.tiles,
      entities: this.allEntities,
      items: this.items,
    });
    this.renderer.updateStats(this.player);
  }
}
```

**Step 2: エントリポイントを更新**

```javascript
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  document.getElementById('overlay-btn').addEventListener('click', () => {
    game.renderer.hideOverlay();
    game.init();
  });
});
```

**Step 3: ブラウザで確認**

ブラウザを開きマップが表示され、プレイヤー🧑・敵🟢🦇💀・アイテム🧪⚔️が部屋に配置されていることを目視確認。

**Step 4: コミット**

```bash
git add game.js
git commit -m "feat: add Game class with map init, entity/item placement"
```

---

### Task 6: 入力処理・移動・戦闘

**Files:**
- Modify: `game.js`（Game クラスにメソッド追加）

**Step 1: Game クラスにメソッドを追加**

Game クラスの `init()` の末尾（`this.render()` の後）にキーイベント登録を追加:

```javascript
// init() 末尾に追加
if (!this._keyHandler) {
  this._keyHandler = (e) => this.handleKey(e);
  window.addEventListener('keydown', this._keyHandler);
}
```

Game クラスに以下のメソッドを追加:

```javascript
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

  // 壁チェック
  if (this.tiles[ny]?.[nx] === 'wall') return;

  // 敵との戦闘チェック
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
    // 移動
    this.player.x = nx;
    this.player.y = ny;
    this.pickUpItems();
  }

  // 敵ターン
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
    // 追尾: 距離が大きい軸を優先
    if (Math.abs(dx) >= Math.abs(dy)) mx = dx > 0 ? 1 : -1;
    else my = dy > 0 ? 1 : -1;
  } else {
    // ランダム歩行
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const [rx,ry] = dirs[Math.floor(Math.random() * 4)];
    mx = rx; my = ry;
  }

  const nx = enemy.x + mx;
  const ny = enemy.y + my;

  // 隣がプレイヤー → 攻撃
  if (nx === this.player.x && ny === this.player.y) {
    const dmg = enemy.attack(this.player);
    this.renderer.setMessage(`${enemy.type}に${dmg}ダメージを受けた！`);
    return;
  }

  // 壁・他の敵がいる場合は移動しない
  if (this.tiles[ny]?.[nx] === 'wall') return;
  if (this.enemies.some(e => e.isAlive && e.x === nx && e.y === ny)) return;

  enemy.x = nx;
  enemy.y = ny;
}

winGame() {
  this.gameOver = true;
  this.render();
  this.renderer.showOverlay('🎉 クリア！', 'ボスを倒した！おめでとう！');
}

loseGame() {
  this.gameOver = true;
  this.render();
  this.renderer.showOverlay('💀 ゲームオーバー', 'HPが0になった...');
}
```

**Step 2: ブラウザで動作確認**

- 矢印キー/WASDでプレイヤーが移動すること
- 敵に近づくと自動攻撃され敵のHPが減ること（メッセージ確認）
- 敵が倒されると絵文字が消えること
- アイテムを踏むと効果が発動しメッセージが出ること
- ボスを倒すとクリアオーバーレイが出ること
- HPが0でゲームオーバーオーバーレイが出ること
- 「もう一度」ボタンでリセットされること

**Step 3: コミット**

```bash
git add game.js
git commit -m "feat: add keyboard input, movement, combat, item pickup, win/lose"
```

---

### Task 7: 最終チェック・クリーンアップ

**Files:**
- Modify: `game.js`（スタブコードの削除）

**Step 1: game.js 先頭のデバッグコードを削除**

Task 1 で書いた `console.log('game.js loaded')` など、不要なログやデバッグコードを削除する。

**Step 2: ゲーム全体を通してプレイテスト**

- 新しいフロアをロードし直し、完走できることを確認
- ブラウザのコンソールにエラーが出ていないことを確認

**Step 3: 最終コミット**

```bash
git add game.js
git commit -m "chore: remove debug stubs, final cleanup"
```

---

## 完成ファイル構成

```
/
├── index.html
├── style.css
├── game.js
└── docs/
    └── plans/
        ├── 2026-02-26-roguelike-design.md
        └── 2026-02-26-roguelike-impl.md
```

## 動作確認チェックリスト

- [ ] index.html をブラウザで開くと絵文字マップが表示される
- [ ] 矢印 / WASD キーでプレイヤーが移動する
- [ ] 壁を通過できない
- [ ] 敵に隣接して攻撃するとダメージメッセージが出る
- [ ] 敵を倒すと絵文字が消える
- [ ] アイテムを踏むと効果とメッセージが出る
- [ ] ボス撃破でクリア画面が出る
- [ ] HP0でゲームオーバー画面が出る
- [ ] 「もう一度」でリセットされる
- [ ] コンソールにエラーなし
