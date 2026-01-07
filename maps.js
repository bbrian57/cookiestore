// maps.js - 2025 修正版：加入出生點座標與視覺參數
const mapData = {
  flat: {
    platforms: [{ x: 0, y: 420, w: 900, h: 15, color: '#3B82F6', glow: 20 }],
    spawn: { p1: { x: 100, y: 360 }, p2: { x: 750, y: 360 } }
  },
  platform: {
    platforms: [
      { x: 0, y: 420, w: 900, h: 15, color: '#3B82F6', glow: 20 },
      { x: 200, y: 320, w: 120, h: 12, color: '#8B5CF6', glow: 25 },
      { x: 450, y: 270, w: 100, h: 12, color: '#8B5CF6', glow: 25 },
      { x: 650, y: 360, w: 100, h: 12, color: '#8B5CF6', glow: 25 },
      { x: 350, y: 180, w: 100, h: 12, color: '#06B6D4', glow: 30 }
    ],
    spawn: { p1: { x: 50, y: 360 }, p2: { x: 800, y: 360 } }
  },
  canyon: {
    platforms: [
      { x: 0, y: 420, w: 250, h: 15, color: '#EF4444', glow: 25 },
      { x: 650, y: 420, w: 250, h: 15, color: '#EF4444', glow: 25 }
    ],
    spawn: { p1: { x: 50, y: 360 }, p2: { x: 800, y: 360 } }
  },
  moving: {
    platforms: [
      { x: 0,   y: 420, w: 900, h: 15, color: '#10B981', glow: 20 },
      { x: 150, y: 350, w: 120, h: 12, dx: 2, dy: 0, range: 160, color: '#F59E0B', glow: 20 },
      { x: 500, y: 270, w: 150, h: 12, dx: -2, dy: 0, range: 200, color: '#F59E0B', glow: 20 },
      { x: 300, y: 150, w: 100, h: 12, dx: 0, dy: 1, range: 60, color: '#F59E0B', glow: 20 }
    ],
    spawn: { p1: { x: 50, y: 360 }, p2: { x: 800, y: 360 } }
  },
  shattered: {
    platforms: [
      { x: 100, y: 350, w: 80, h: 12, color: '#FF00FF', glow: 30 },
      { x: 300, y: 250, w: 80, h: 12, color: '#FF00FF', glow: 30 },
      { x: 520, y: 250, w: 80, h: 12, color: '#FF00FF', glow: 30 },
      { x: 720, y: 350, w: 80, h: 12, color: '#FF00FF', glow: 30 },
      { x: 410, y: 400, w: 80, h: 12, color: '#FFFFFF', glow: 40 }
    ],
    spawn: { p1: { x: 110, y: 280 }, p2: { x: 730, y: 280 } } // 修正：出生在小平台上
  },
  core: {
    platforms: [
      { x: 0, y: 420, w: 200, h: 15, color: '#FFA500', glow: 20 },
      { x: 700, y: 420, w: 200, h: 15, color: '#FFA500', glow: 20 },
      { x: 350, y: 350, w: 200, h: 15, dx: 0, dy: -2, range: 180, color: '#00FF00', glow: 25 }
    ],
    spawn: { p1: { x: 50, y: 360 }, p2: { x: 800, y: 360 } }
  },
  towers: {
    platforms: [
      { x: 0, y: 440, w: 900, h: 10, color: '#4B5563', glow: 15 },
      { x: 100, y: 320, w: 150, h: 15, color: '#3B82F6', glow: 25 },
      { x: 100, y: 180, w: 150, h: 15, color: '#3B82F6', glow: 25 },
      { x: 650, y: 320, w: 150, h: 15, color: '#EF4444', glow: 25 },
      { x: 650, y: 180, w: 150, h: 15, color: '#EF4444', glow: 25 },
      { x: 400, y: 250, w: 100, h: 12, dx: 0, dy: 1.5, range: 100, color: '#FFFFFF', glow: 30 }
    ],
    spawn: { p1: { x: 150, y: 120 }, p2: { x: 700, y: 120 } }
  },
  gears: {
    platforms: [
      { x: 300, y: 420, w: 300, h: 15, color: '#F59E0B', glow: 20 },
      { x: 50, y: 350, w: 100, h: 12, dx: 3, dy: 0, range: 150, color: '#10B981', glow: 20 },
      { x: 750, y: 350, w: 100, h: 12, dx: -3, dy: 0, range: 150, color: '#10B981', glow: 20 },
      { x: 150, y: 200, w: 120, h: 12, dx: 2, dy: 1, range: 80, color: '#06B6D4', glow: 25 },
      { x: 630, y: 200, w: 120, h: 12, dx: -2, dy: 1, range: 80, color: '#06B6D4', glow: 25 }
    ],
    spawn: { p1: { x: 350, y: 360 }, p2: { x: 500, y: 360 } }
  },
  bridge: {
    platforms: [
      { x: 150, y: 380, w: 600, h: 10, color: '#FF00FF', glow: 40 },
      { x: 0, y: 250, w: 100, h: 12, color: '#FFFFFF', glow: 20 },
      { x: 800, y: 250, w: 100, h: 12, color: '#FFFFFF', glow: 20 },
      { x: 375, y: 220, w: 150, h: 10, dx: 0, dy: -2, range: 120, color: '#FACC15', glow: 30 }
    ],
    spawn: { p1: { x: 200, y: 320 }, p2: { x: 650, y: 320 } }
  },
  elevator: {
    platforms: [
      { 
        x: 100,           // 左右留空，增加掉落風險
        y: 350,           // 初始高度
        w: 700,           // 寬大的平台
        h: 20, 
        dx: 0, 
        dy: 1.5,          // 上下移動速度
        range: 120,       // 移動幅度 (會在 y=230 到 y=470 之間來回)
        color: '#F87171', 
        glow: 35 
      }
    ],
    spawn: { 
      p1: { x: 200, y: 280 }, 
      p2: { x: 650, y: 280 } 
    }
  }
  
};

const mapNames = {
  flat: '電訊平原 (Cyber Plains)',
  platform: '虛空浮島 (Void Island)',
  canyon: '熔岩峽谷 (Magma Canyon)',
  moving: '脈衝工廠 (Pulse Factory)',
  shattered: '破碎虛空 (Shattered Void)',
  core: '重力核心 (Gravity Core)',
  towers: '雙子星塔 (Gemini Towers)',
  gears: '連動齒輪 (Sync Gears)',
  bridge: '霓虹天橋 (Neon Bridge)',
  elevator: '升降巨台 (Elevator Core)',
};
