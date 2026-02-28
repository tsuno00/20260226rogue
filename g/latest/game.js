const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const hpEl = document.getElementById('hp-value');
const atkEl = document.getElementById('atk-value');
const defEl = document.getElementById('def-value');
const logEl = document.getElementById('log');
const floorEl = document.getElementById('floor-value');

const TILE_SIZE = 32; 
const VIEW_COLS = 20; 
const VIEW_ROWS = 16;
const MAP_COLS = 50; 
const MAP_ROWS = 50;
const MINI_TILE_SIZE = 3;

canvas.width = VIEW_COLS * TILE_SIZE;
canvas.height = VIEW_ROWS * TILE_SIZE;

const TILE_TYPES = {
    WALL: '#333',
    FLOOR: '#111',
    PLAYER: '#00ff00',
    EXIT: '#ffff00',
    MONSTER: '#ff4444',
    CHEST: '#00ffff',
    POTION: '#ff00ff',
    WEAPON: '#ffffff',
    SHIELD: '#8888ff'
};

const MINI_COLORS = {
    WALL: '#bbb',
    FLOOR: '#555',
    EXIT: '#ff0',
    MONSTER: '#f44',
    POTION: '#f0f',
    WEAPON: '#fff',
    SHIELD: '#88f'
};

const ICONS = {
    WALL: '🧱',
    PLAYER: '🦸',
    EXIT: '🪜',
    MONSTER: '👾',
    CHEST: '🎁',
    POTION: '🧪',
    WEAPON: '⚔️',
    SHIELD: '🛡️'
};

let map = [];
let visited = [];
let entities = [];
let player = { x: 0, y: 0, hp: 20, maxHp: 20, atk: 3, def: 1 };
let floor = 1;
let logHistory = ["Welcome to the deeper dungeon..."];

// --- Map Generation ---
function initMap() {
    map = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill('WALL'));
    visited = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(false));
    entities = [];
    const rooms = [];

    for (let i = 0; i < 15; i++) {
        const w = 4 + Math.floor(Math.random() * 6);
        const h = 4 + Math.floor(Math.random() * 6);
        const x = 2 + Math.floor(Math.random() * (MAP_COLS - w - 4));
        const y = 2 + Math.floor(Math.random() * (MAP_ROWS - h - 4));

        const newRoom = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };
        if (!rooms.some(r => !(newRoom.x > r.x + r.w || newRoom.x + newRoom.w < r.x || newRoom.y > r.y + r.h || newRoom.y + newRoom.h < r.y))) {
            for (let ry = y; ry < y + h; ry++) {
                for (let rx = x; rx < x + w; rx++) {
                    map[ry][rx] = 'FLOOR';
                }
            }
            if (rooms.length > 0) {
                const prev = rooms[rooms.length - 1];
                connectRooms(prev.cx, prev.cy, newRoom.cx, newRoom.cy);
            }
            rooms.push(newRoom);
        }
    }

    player.x = rooms[0].cx;
    player.y = rooms[0].cy;
    map[rooms[rooms.length - 1].cy][rooms[rooms.length - 1].cx] = 'EXIT';

    updateVisibility();
    spawnEntities(rooms);
}

function connectRooms(x1, y1, x2, y2) {
    let curX = x1;
    let curY = y1;
    while (curX !== x2) {
        curX += Math.sign(x2 - x1);
        map[y1][curX] = 'FLOOR';
    }
    while (curY !== y2) {
        curY += Math.sign(y2 - y1);
        map[curY][x2] = 'FLOOR';
    }
}

function spawnEntities(rooms) {
    for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        // モンスターの生成
        if (Math.random() < 0.7) {
            entities.push({
                type: 'MONSTER',
                x: room.cx + (Math.floor(Math.random() * 3) - 1),
                y: room.cy + (Math.floor(Math.random() * 3) - 1),
                hp: 5 + floor * 2,
                atk: 2 + floor,
                def: floor - 1
            });
        }
        // アイテムの生成
        const itemRoll = Math.random();
        if (itemRoll < 0.2) {
            entities.push({
                type: 'POTION',
                x: room.x + 1 + Math.floor(Math.random() * (room.w - 2)),
                y: room.y + 1 + Math.floor(Math.random() * (room.h - 2))
            });
        } else if (itemRoll < 0.3) {
            entities.push({
                type: 'WEAPON',
                x: room.x + 1 + Math.floor(Math.random() * (room.w - 2)),
                y: room.y + 1 + Math.floor(Math.random() * (room.h - 2))
            });
        } else if (itemRoll < 0.4) {
            entities.push({
                type: 'SHIELD',
                x: room.x + 1 + Math.floor(Math.random() * (room.w - 2)),
                y: room.y + 1 + Math.floor(Math.random() * (room.h - 2))
            });
        }
    }
}

function updateVisibility() {
    const camX = Math.max(0, Math.min(MAP_COLS - VIEW_COLS, player.x - Math.floor(VIEW_COLS / 2)));
    const camY = Math.max(0, Math.min(MAP_ROWS - VIEW_ROWS, player.y - Math.floor(VIEW_ROWS / 2)));

    for (let y = 0; y < VIEW_ROWS; y++) {
        for (let x = 0; x < VIEW_COLS; x++) {
            const mapX = camX + x;
            const mapY = camY + y;
            if (mapX >= 0 && mapX < MAP_COLS && mapY >= 0 && mapY < MAP_ROWS) {
                visited[mapY][mapX] = true;
            }
        }
    }
}

// --- Drawing ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const camX = Math.max(0, Math.min(MAP_COLS - VIEW_COLS, player.x - Math.floor(VIEW_COLS / 2)));
    const camY = Math.max(0, Math.min(MAP_ROWS - VIEW_ROWS, player.y - Math.floor(VIEW_ROWS / 2)));

    // Draw Main Map
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let y = 0; y < VIEW_ROWS; y++) {
        for (let x = 0; x < VIEW_COLS; x++) {
            const mapX = camX + x;
            const mapY = camY + y;
            if (mapX >= 0 && mapX < MAP_COLS && mapY >= 0 && mapY < MAP_ROWS) {
                ctx.fillStyle = TILE_TYPES[map[mapY][mapX]];
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                
                if (map[mapY][mapX] === 'WALL') {
                    ctx.font = `${TILE_SIZE * 0.7}px serif`;
                    ctx.fillText(ICONS.WALL, (x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
                } else if (map[mapY][mapX] === 'EXIT') {
                    ctx.font = `${TILE_SIZE * 0.7}px serif`;
                    ctx.fillText(ICONS.EXIT, (x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
                }
                
                ctx.strokeStyle = '#222';
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    
    // Draw Entities
    entities.forEach(ent => {
        const screenX = ent.x - camX;
        const screenY = ent.y - camY;
        if (screenX >= 0 && screenX < VIEW_COLS && screenY >= 0 && screenY < VIEW_ROWS) {
            ctx.font = `${TILE_SIZE * 0.7}px serif`;
            ctx.fillText(ICONS[ent.type], (screenX + 0.5) * TILE_SIZE, (screenY + 0.5) * TILE_SIZE);
        }
    });

    // Draw Player
    const pScreenX = player.x - camX;
    const pScreenY = player.y - camY;
    ctx.font = `${TILE_SIZE * 0.8}px serif`;
    ctx.fillText(ICONS.PLAYER, (pScreenX + 0.5) * TILE_SIZE, (pScreenY + 0.5) * TILE_SIZE);

    drawMinimap();

    // Update UI
    hpEl.innerText = player.hp;
    atkEl.innerText = player.atk;
    defEl.innerText = player.def;
    floorEl.innerText = floor;
}

function drawMinimap() {
    const margin = 10;
    const size = MAP_COLS * MINI_TILE_SIZE;
    const startX = canvas.width - size - margin;
    const startY = margin;

    ctx.save();
    ctx.globalAlpha = 0.8;
    
    // Background (Translucent Black)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(startX, startY, size, size);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, size, size);

    // Draw Visited Tiles Only
    for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
            if (visited[y][x]) {
                ctx.fillStyle = MINI_COLORS[map[y][x]] || '#444';
                ctx.fillRect(startX + x * MINI_TILE_SIZE, startY + y * MINI_TILE_SIZE, MINI_TILE_SIZE, MINI_TILE_SIZE);
            }
        }
    }

    // Draw Known Entities
    entities.forEach(ent => {
        if (visited[ent.y][ent.x]) {
            ctx.fillStyle = MINI_COLORS[ent.type] || '#f00';
            ctx.fillRect(startX + ent.x * MINI_TILE_SIZE, startY + ent.y * MINI_TILE_SIZE, MINI_TILE_SIZE, MINI_TILE_SIZE);
        }
    });

    // Player (Bright White)
    ctx.fillStyle = '#fff';
    ctx.fillRect(startX + player.x * MINI_TILE_SIZE, startY + player.y * MINI_TILE_SIZE, MINI_TILE_SIZE, MINI_TILE_SIZE);
    
    ctx.restore();
}

function updateLog(msg) {
    logHistory.push(msg);
    if (logHistory.length > 100) logHistory.shift();
    logEl.innerText = logHistory.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
}

function handleInteraction(x, y) {
    const entityIndex = entities.findIndex(e => e.x === x && e.y === y);
    if (entityIndex !== -1) {
        const ent = entities[entityIndex];
        if (ent.type === 'MONSTER') {
            const damage = Math.max(1, player.atk - ent.def);
            ent.hp -= damage;
            updateLog(`Hit 👾 for ${damage} damage!`);
            if (ent.hp <= 0) {
                entities.splice(entityIndex, 1);
                updateLog("👾 defeated!");
            }
            return true;
        } else if (ent.type === 'POTION') {
            player.hp = Math.min(player.maxHp, player.hp + 5);
            updateLog("Found 🧪! HP +5");
            entities.splice(entityIndex, 1);
            return false;
        } else if (ent.type === 'WEAPON') {
            player.atk += 1;
            updateLog("Found ⚔️! ATK +1");
            entities.splice(entityIndex, 1);
            return false;
        } else if (ent.type === 'SHIELD') {
            player.def += 1;
            updateLog("Found 🛡️! DEF +1");
            entities.splice(entityIndex, 1);
            return false;
        }
    }

    if (map[y][x] === 'EXIT') {
        floor++;
        updateLog(`Descending to floor ${floor} 🪜...`);
        initMap();
        return true;
    }

    return false;
}

function moveMonsters() {
    entities.forEach(ent => {
        if (ent.type === 'MONSTER') {
            const dx = Math.sign(player.x - ent.x);
            const dy = Math.sign(player.y - ent.y);
            
            const dist = Math.abs(player.x - ent.x) + Math.abs(player.y - ent.y);
            if (dist < 8) {
                const nextX = ent.x + (Math.random() < 0.5 ? dx : 0);
                const nextY = ent.y + (nextX === ent.x ? dy : 0);

                if (map[nextY][nextX] !== 'WALL' && map[nextY][nextX] !== 'EXIT') {
                    if (nextX === player.x && nextY === player.y) {
                        const damage = Math.max(1, ent.atk - player.def);
                        player.hp -= damage;
                        updateLog(`👾 hit you for ${damage}!`);
                    } else if (!entities.some(e => e !== ent && e.x === nextX && e.y === nextY)) {
                        ent.x = nextX;
                        ent.y = nextY;
                    }
                }
            }
        }
    });

    if (player.hp <= 0) {
        updateLog("💀 GAME OVER. Press F5 to restart.");
        player.hp = 0;
    }
}

function movePlayer(dx, dy) {
    if (player.hp <= 0) return;

    const nextX = player.x + dx;
    const nextY = player.y + dy;
    
    if (nextX >= 0 && nextX < MAP_COLS && nextY >= 0 && nextY < MAP_ROWS) {
        if (map[nextY][nextX] !== 'WALL') {
            const occupied = handleInteraction(nextX, nextY);
            if (!occupied) {
                player.x = nextX;
                player.y = nextY;
                updateVisibility();
            }
            moveMonsters();
        }
    }
    draw();
}

window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
    }
});

// --- Button Listeners ---
const setupBtn = (id, dx, dy) => {
    const btn = document.getElementById(id);
    const handler = (e) => {
        e.preventDefault(); // ズームやスクロールを防止
        movePlayer(dx, dy);
    };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('mousedown', (e) => {
        if (e.button === 0) movePlayer(dx, dy); // PCクリック用
    });
};

setupBtn('btn-up', 0, -1);
setupBtn('btn-down', 0, 1);
setupBtn('btn-left', -1, 0);
setupBtn('btn-right', 1, 0);

initMap();
draw();
