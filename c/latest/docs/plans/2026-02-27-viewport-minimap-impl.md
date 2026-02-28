# Viewport / Minimap / Multi-floor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ローグライクゲームに80×50マップ・25×15ビューポートスクロール・3階層・右上ミニマップ（訪問済み表示）を追加する。

**Architecture:** DOM グリッドを廃止し canvas 2枚構成（メインビュー + ミニマップ）に刷新。Game クラスに複数フロアデータ・訪問管理・階段降下を追加。Renderer は新しい state 形状（camX/camY/visited を含む）を受け取る。

**Tech Stack:** Vanilla HTML5 Canvas 2D API — 外部ライブラリなし

---

### Task 1: 定数・MapGenerator・EMOJI 更新

**Files:**
- Modify: `game.js` 行 1〜83

**Step 1: 先頭の定数を以下に置き換える**

```javascript
const MAP_W    = 80;
const MAP_H    = 50;
const VIEW_W   = 25;
const VIEW_H   = 15;
const CELL     = 20;     // px per tile (main canvas)
const MM_SCALE = 3;      // px per tile (minimap)
const FLOORS   = 3;
```

**Step 2: MapGenerator.generate() を以下に置き換える（クラス全体）**

```javascript
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
```

**Step 3: EMOJI 定数に `stair` を追加**

```javascript
const EMOJI = {
  wall:   '🧱',
  floor:  '⬛',
  stair:  '🪜',
  player: '🧑',
  slime:  '🟢',
  bat:    '🦇',
  boss:   '💀',
  potion: '🧪',
  sword:  '⚔️',
};
```

**Step 4: ブラウザコンソールで確認（ゲームはまだ壊れていない）**

```javascript
const g = new MapGenerator();
const { tiles, rooms } = g.generate();
console.log('rooms:', rooms.length, 'tiles:', tiles.length, tiles[0].length);
// 期待: rooms: 6〜10, tiles: 50, 80
```

**Step 5: コミット**

```bash
git add game.js
git commit -m "feat: expand map to 80x50, add VIEW/CELL/MM_SCALE constants, add stair emoji"
```

---

### Task 2: index.html と style.css を canvas 構成に更新

**Files:**
- Modify: `index.html`
- Modify: `style.css`

**Step 1: index.html の `#game-area` 内を以下に置き換える**

`<div id="grid"></div>` を削除し、2 枚の canvas に置き換える:

```html
    <div id="game-area">
      <canvas id="main-canvas" width="500" height="300"></canvas>
      <canvas id="minimap-canvas" width="240" height="150"></canvas>
    </div>
```

**Step 2: `#stats` に階層表示を追加**

`<span id="stat-gold">💰 Gold: 0</span>` の後に追加:

```html
        <span id="stat-floor">🏚️ B1</span>
```

**Step 3: style.css の `#game-area`、`#grid`、`.cell` を以下に置き換える**

```css
#game-area {
  position: relative;
  border: 2px solid #444;
  background: #000;
  overflow: hidden;
  width: 500px;
  height: 300px;
  flex-shrink: 0;
}

#main-canvas {
  display: block;
}

#minimap-canvas {
  position: absolute;
  top: 4px;
  right: 4px;
  border: 2px solid #000;
  image-rendering: pixelated;
}
```

（`#grid` と `.cell` のルールは削除する）

**Step 4: ブラウザで開いて確認**

- 黒い 500×300 の canvas エリアが表示される
- 右上に小さい canvas の枠（黒い border）が見える
- コンソールエラーなし（game.js はまだ #grid を参照していないが、Renderer.init() で `getElementById('grid')` を呼ぶので undefined エラーが出るかもしれない — 次タスクで解消する）

**Step 5: コミット**

```bash
git add index.html style.css
git commit -m "feat: replace DOM grid with main-canvas + minimap-canvas, add stat-floor"
```

---

### Task 3: Renderer クラスを canvas ベースに全面書き直し

**Files:**
- Modify: `game.js`（Renderer クラス全体 — 現行 85〜156 行を置き換える）

**注意:** このタスク完了後、Task 4 完了まで一時的にゲームが動かない（Game クラスがまだ古い API を呼ぶ）。Task 3 → Task 4 は連続して実施すること。

**Step 1: Renderer クラス全体を以下に置き換える**

```javascript
class Renderer {
  constructor() {
    this.mainCanvas = document.getElementById('main-canvas');
    this.mainCtx    = this.mainCanvas.getContext('2d');
    this.mmCanvas   = document.getElementById('minimap-canvas');
    this.mmCtx      = this.mmCanvas.getContext('2d');
  }

  init() {
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    this.mmCtx.clearRect(0, 0, this.mmCanvas.width, this.mmCanvas.height);
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
    document.getElementById('message').textContent = msg;
  }

  updateStats(player, floor) {
    document.getElementById('stat-hp').textContent =
      `❤️ HP: ${player.hp}/${player.maxHp}`;
    document.getElementById('stat-atk').textContent =
      `⚔️ ATK: ${player.atk}`;
    document.getElementById('stat-def').textContent =
      `🛡️ DEF: ${player.def}`;
    document.getElementById('stat-gold').textContent =
      `💰 Gold: ${player.gold}`;
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
```

**Step 2: コミット（Task 4 と連続で作業するため直後に Task 4 を実施）**

```bash
git add game.js
git commit -m "feat: rewrite Renderer to canvas (main view + minimap)"
```

---

### Task 4: Game クラスを複数フロア・ビューポート対応に刷新

**Files:**
- Modify: `game.js`（Game クラス全体 — 現行 180〜386 行を置き換える）

**Step 1: Game クラス全体を以下に置き換える**

```javascript
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
    while (rooms.length < 3) ({ tiles, rooms } = gen.generate());

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
    this.rooms   = f.rooms;
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
    if (this.tiles[ny][nx] === 'stair') return;  // 階段マスには入れない
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
  document.getElementById('overlay-btn').addEventListener('click', () => {
    game.renderer.hideOverlay();
    game.init();
  });
});
```

**Step 2: ブラウザで動作確認**

- 絵文字マップが 25×15 タイルの canvas に描画される
- 矢印/WASD でプレイヤーが移動しカメラがスクロールする
- 右上ミニマップに訪問済み領域が青で表示される
- フロア表示が `🏚️ B1` になっている

**Step 3: コミット**

```bash
git add game.js
git commit -m "feat: multi-floor Game class with viewport camera, visited tracking, descend"
```

---

### Task 5: 統合確認・最終クリーンアップ

**Files:**
- Modify: `game.js`（必要に応じて微調整）

**Step 1: 以下のシナリオをブラウザで動作確認する**

| 確認項目 | 期待動作 |
|----------|---------|
| 移動 | WASD/矢印でプレイヤーが動き、カメラがついてくる |
| 壁 | 壁マスに入れない |
| ミニマップ | 移動するたびにビューポート矩形が青く塗られる |
| 未訪問領域 | ミニマップ上で完全に透明（右上の黒枠の中が透明） |
| 訪問済み階段 | ミニマップで `🪜` の位置がオレンジ（`#fa0`）で表示される |
| 階段降下 | 階段マスを踏むと `B2 に降りた！` と表示されフロアが変わる |
| フロア数表示 | B1→B2→B3 と `🏚️` の後の数字が変わる |
| 戦闘 | 敵に隣接してキーを押すとダメージメッセージが出る |
| アイテム | ポーション/剣を踏むと効果とメッセージが出る |
| ボス（B3） | B3 のボスを倒すとクリアオーバーレイが出る |
| ゲームオーバー | HP 0 でゲームオーバーオーバーレイが出る |
| もう一度 | リセットされ B1 から再スタートする |
| コンソール | エラーなし |

**Step 2: 問題があれば修正する**

よくある問題と対処:
- 「ミニマップが黒い矩形だけで何も見えない」→ `visited` が更新されているか確認。`markVisited()` が呼ばれているか確認。
- 「カメラが動かない」→ `getCamera()` の `camX/camY` が変わっているか `console.log` で確認。
- 「階段が踏めない」→ `tiles[ny][nx] === 'stair'` のチェックが移動後の座標で行われているか確認。

**Step 3: コンソールログ・デバッグコードを削除して最終コミット**

```bash
git add game.js index.html style.css
git commit -m "chore: final cleanup viewport/minimap/multifloor"
```

---

## 完成後の動作確認チェックリスト

- [ ] ビューポートが 25×15 タイル表示でスクロールする
- [ ] ミニマップが右上オーバーレイで表示される
- [ ] 未訪問領域はミニマップ上で完全透明
- [ ] 訪問済み床は `#4af`（青）、壁は `#334`（濃紺）
- [ ] 訪問済み階段は `#fa0`（オレンジ）
- [ ] プレイヤーは `#ff0`（黄）の点で表示
- [ ] B1→B2→B3 の降下が機能する
- [ ] B3 ボス撃破でクリア
- [ ] パーマデス（HP0で B1 からリセット）
- [ ] コンソールエラーなし
