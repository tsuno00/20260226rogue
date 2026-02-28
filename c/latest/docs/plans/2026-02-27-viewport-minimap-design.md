# ビューポート・ミニマップ・複数フロア 設計書

作成日: 2026-02-27

## 概要

既存のローグライクゲームに以下の機能を追加する:
- マップ拡大（80×50）
- ビューポートスクロール（25×15タイル表示）
- 複数フロア（B1〜B3、B3にボス）
- ミニマップ（右上オーバーレイ、訪問済み領域のみ表示）

## アーキテクチャ

### HTML 構造

```html
<div id="game-area" style="position:relative; width:500px">
  <canvas id="main-canvas" width="500" height="300"></canvas>
  <canvas id="minimap-canvas" width="240" height="150"
          style="position:absolute; top:4px; right:4px; border:2px solid #000">
  </canvas>
</div>
```

### ファイル変更

| ファイル | 変更内容 |
|----------|---------|
| `index.html` | `#grid` DOM グリッド削除 → `main-canvas` + `minimap-canvas` 追加 |
| `style.css` | `#game-area` に `position:relative`、canvas スタイル追加 |
| `game.js` | Renderer 刷新、Game に複数フロア・訪問管理追加 |

## 定数

```javascript
const MAP_W   = 80;
const MAP_H   = 50;
const VIEW_W  = 25;
const VIEW_H  = 15;
const CELL    = 20;      // px per tile (main canvas)
const MM_SCALE = 3;      // px per tile (minimap)
const FLOORS  = 3;
```

## MapGenerator 変更

- `MAP_W=80, MAP_H=50` に対応
- 部屋数: 6〜10個（現状 4〜6）
- 部屋サイズ: 幅 5〜12、高さ 4〜8（現状より大きめ）
- 最低部屋数: 3個保証（開始 + 中間 + ラスト）

## Renderer 刷新

DOM グリッドを廃止し、2枚の canvas で描画する。

### メイン canvas (main-canvas)

- サイズ: 500×300 px（VIEW_W×VIEW_H × CELL）
- カメラ: `camX = clamp(player.x - VIEW_W/2, 0, MAP_W - VIEW_W)`
- 描画手順:
  1. 背景 `#0a0a0a` でクリア
  2. カメラ範囲のタイルを絵文字で `fillText`
  3. アイテム描画（拾得済みは描画しない）
  4. エンティティ描画（死亡済みは描画しない）
- フォント: `'16px sans-serif'`、`textAlign:'center'`、`textBaseline:'middle'`

### ミニマップ canvas (minimap-canvas)

- サイズ: 240×150 px（MAP_W×MAP_H × MM_SCALE）
- 背景: `rgba(0,0,0,0.75)` で毎フレームクリア
- 未訪問タイル: 描画なし（透明）
- 訪問済み壁: `#333`
- 訪問済み床・通路: `#4af`（明るい青）
- 訪問済み階段: `#fa0`（オレンジ）
- プレイヤー位置: `#ff0` の 4×4px 正方形
- 縁取り: CSS `border: 2px solid #000`（不透明黒）

## 訪問管理

```javascript
// フロアごとに visited[y][x] = boolean を管理
this.visited = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));

// プレイヤーが (px, py) に移動したとき
function markVisited(px, py) {
  const camX = clamp(px - Math.floor(VIEW_W/2), 0, MAP_W - VIEW_W);
  const camY = clamp(py - Math.floor(VIEW_H/2), 0, MAP_H - VIEW_H);
  for (let y = camY; y < camY + VIEW_H; y++)
    for (let x = camX; x < camX + VIEW_W; x++)
      visited[y][x] = true;
}
```

ミニマップには訪問済みタイルのみ色を塗る。VIEW サイズの矩形が重なって探索軌跡を示す。

## 複数フロア

### フロアデータ構造

```javascript
this.floors = [];  // floors[i] = { tiles, rooms, enemies, items, visited }
```

3フロア分を `game.init()` 時に一括生成する。

### 階段

- タイル種別: `'stair'`、絵文字: `🪜`
- B1・B2 の最後の部屋（ボス部屋の前）の中心に配置
- B3 には階段なし（ボスを倒すとクリア）
- 移動先が stair タイルなら自動的に `descend()` を呼ぶ

### descend()

```javascript
descend() {
  this.floor++;   // 1-indexed (1〜3)
  const f = this.floors[this.floor - 1];
  this.tiles   = f.tiles;
  this.rooms   = f.rooms;
  this.enemies = f.enemies;
  this.items   = f.items;
  this.visited = f.visited;
  // プレイヤーを次フロアの開始部屋の中心に配置
  const start = f.rooms[0];
  this.player.x = Math.floor(start.x + start.w / 2);
  this.player.y = Math.floor(start.y + start.h / 2);
  this.renderer.setMessage(`B${this.floor} に降りた`);
  this.markVisited();
  this.render();
}
```

### 敵の強化（フロアによる難易度）

| フロア | 雑魚 HP | 雑魚 ATK | ボス HP | ボス ATK |
|--------|---------|---------|---------|---------|
| B1 | 8/5 | 2/3 | — | — |
| B2 | 12/8 | 3/4 | — | — |
| B3 | 16/10 | 4/5 | 30 | 6 |

## 勝敗条件

- **勝利**: B3 のボスを倒す
- **敗北**: HP=0（パーマデス、全フロアをリセット）

## UIパネル変更

フロア数を stats に追加:

```html
<span id="stat-floor">🏚️ B1</span>
```
