import * as THREE from '../vendor/three.module.js';
import {GRID, HALF, PATH, PATH_LEN, HOME_LEN, HOME_START_PROG, TOTAL, STARTS, HOMES, BASE_SIZE, BASE_ORIGIN, BASE_SLOTS, PL, FLIGHT_ROUTES, pathColor, coord} from '../js/board.js';
export function mount({host, state, life, choose}) {
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const listen = (target, event, fn, options = {}) => life.listen(target, event, fn, options);
const gridToWorld = (c,r,y=0) => new THREE.Vector3(c-HALF,y,r-HALF);
const world = (seat, prog, slot) => gridToWorld(...coord(seat, prog, slot));
const canvas = document.createElement('canvas'); canvas.id = 'scene'; host.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const SPACE_BG = 0x04060f;                 // 深空底色
scene.background = new THREE.Color(SPACE_BG);
scene.fog = new THREE.Fog(SPACE_BG, 52, 120);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);

/* ===== 固定视角：45° 俯视 + 棋盘摆正 + 底部居中 ===== */
const PITCH_45   = Math.PI / 4;      // 45° 俯角（视线与水平面夹角 45°）
const THETA_FIX  = -Math.PI / 2;     // 正对棋盘，横平竖直不倾斜
const SHIFT_RATIO = 0.06;            // 棋盘中心轻微下移到屏幕约 56% 高度处
const SEAT_THETA = [-3 * Math.PI / 4, -Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4];

const camDef = { theta: THETA_FIX, phi: PITCH_45, dist: 22, cx: 0, cz: 0 };
let cam = { ...camDef };
let camTarget = { ...camDef };
let follow = false;                  // 默认锁定固定视角，不跟随玩家
let shiftPx = 0;                     // 视锥下移像素

function nearestTheta(from, to) {
  let t = to;
  while (t - from > Math.PI)  t -= Math.PI * 2;
  while (from - t > Math.PI)  t += Math.PI * 2;
  return t;
}
/** 计算刚好装下整个棋盘（并留出底部偏移空间）的相机距离 */
function fitDist(phi) {
  const halfSpan = HALF + 1.25;                                  // 棋盘半宽 + 紧凑安全边距
  const vTan = Math.tan(camera.fov * Math.PI / 360);
  const nearDepth = halfSpan * Math.sin(phi);
  // 不能只算平面投影尺寸：45° 透视下，棋盘近侧角点离相机更近、投影更大。
  // dist 必须先补回这段深度，再按 viewOffset 留给棋盘下半部的空间求解。
  const bottomRoom = Math.max(0.42, 1 - 2 * SHIFT_RATIO);
  const needV = nearDepth + halfSpan * Math.cos(phi) / (vTan * bottomRoom);
  const needH = nearDepth + halfSpan / (vTan * Math.max(0.46, camera.aspect));
  return clamp(Math.max(needV, needH) * 1.02, 15, 58);
}
/** 固定摆正视角（默认） */
function viewDefault() {
  camTarget.theta = nearestTheta(cam.theta, THETA_FIX);
  camTarget.phi   = PITCH_45;
  camTarget.dist  = fitDist(PITCH_45);
  camTarget.cx = 0; camTarget.cz = 0;
}
/** 顶部俯视（同样摆正 + 底部居中） */
function viewTop() {
  camTarget.theta = nearestTheta(cam.theta, THETA_FIX);
  camTarget.phi   = 0.22;
  camTarget.dist  = fitDist(0.22);
  camTarget.cx = 0; camTarget.cz = 0;
}
/** 跟随模式（可选）：转到当前玩家一侧，仍保持 45° 俯角 */
function focusSeat(seat) {
  camTarget.theta = nearestTheta(cam.theta, SEAT_THETA[seat]);
  camTarget.phi   = PITCH_45;
  camTarget.dist  = fitDist(PITCH_45);
  camTarget.cx = 0; camTarget.cz = 0;
}

function applyCam() {
  const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
  camera.position.set(
    cam.cx + cam.dist * sp * Math.cos(cam.theta),
    cam.dist * cp,
    cam.cz + cam.dist * sp * Math.sin(cam.theta)
  );
  camera.lookAt(cam.cx, 0, cam.cz);
  camera.updateMatrixWorld(true);
}
applyCam();

/* ================= 太空背景 ================= */
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0.00, 'rgba(255,255,255,1)');
  rg.addColorStop(0.30, 'rgba(255,255,255,0.9)');
  rg.addColorStop(0.62, 'rgba(255,255,255,0.28)');
  rg.addColorStop(1.00, 'rgba(255,255,255,0)');
  x.fillStyle = rg; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DOT_TEX = dotTexture();

function starField(count, rMin, rMax, size, opacity) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const tint = [[1, 1, 1], [.76, .85, 1], [1, .95, .84], [1, .84, .90], [.82, 1, 1], [.9, .9, 1]];
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const r = rMin + Math.random() * (rMax - rMin);
    pos[i * 3] = r * s * Math.cos(th);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(th);
    const t = tint[(Math.random() * tint.length) | 0];
    const k = 0.42 + Math.random() * 0.58;
    col[i * 3] = t[0] * k; col[i * 3 + 1] = t[1] * k; col[i * 3 + 2] = t[2] * k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size, sizeAttenuation: true, vertexColors: true, map: DOT_TEX,
    transparent: true, opacity, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending
  }));
}

const spaceGroup = new THREE.Group();
(function buildSpace() {
  // 深空渐变穹顶（顶暗、地平线泛蓝紫 + 星云斑）
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const cx = cv.getContext('2d');
  const grad = cx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#01020a');
  grad.addColorStop(0.26, '#04091c');
  grad.addColorStop(0.50, '#0a1233');
  grad.addColorStop(0.68, '#131d4a');
  grad.addColorStop(0.82, '#0b1130');
  grad.addColorStop(1.00, '#03050e');
  cx.fillStyle = grad; cx.fillRect(0, 0, 256, 512);
  const nebs = [
    [ 60, 150, 130, 'rgba(88,64,205,0.30)'],
    [190, 252, 165, 'rgba(22,116,182,0.26)'],
    [ 35, 344, 120, 'rgba(158,44,148,0.20)'],
    [215, 190,  95, 'rgba(38,168,196,0.18)'],
    [130,  90, 110, 'rgba(110,60,190,0.16)']
  ];
  nebs.forEach(([x, y, r, col]) => {
    const rg = cx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = rg; cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(180, 48, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.renderOrder = -10;
  spaceGroup.add(dome);

  // 两层星空
  const far  = starField(2600, 95, 168, 0.62, 0.85);
  const near = starField(420, 58, 104, 1.45, 0.95);
  spaceGroup.add(far, near);
  spaceGroup.userData.spin = [far, near];

  // 远处的行星 + 光晕
  function planet(radius, color, emissive, pos, halo) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 28),
      new THREE.MeshStandardMaterial({
        color, emissive, emissiveIntensity: 0.55, roughness: 0.95, metalness: 0.0, fog: false
      })
    );
    m.position.set(pos[0], pos[1], pos[2]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: DOT_TEX, color: halo, transparent: true, opacity: 0.55,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    }));
    glow.scale.setScalar(radius * 6.2);
    glow.position.copy(m.position);
    spaceGroup.add(m, glow);
    return m;
  }
  planet(7.2, 0x2b4c96, 0x0d1c46, [-78, 46, -112], 0x4d7dff);
  planet(3.4, 0x8a4a2c, 0x3a1608, [96, 30, -96], 0xff9b52);
})();
scene.add(spaceGroup);

scene.add(new THREE.HemisphereLight(0xa8cfff, 0x050916, 0.40));
const key = new THREE.DirectionalLight(0xffffff, 1.70);
key.position.set(9, 18, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -13; key.shadow.camera.right = 13;
key.shadow.camera.top = 13;   key.shadow.camera.bottom = -13;
key.shadow.camera.near = 1;   key.shadow.camera.far = 48;
key.shadow.bias = -0.0012;
key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0x72b8ff, 0.68);
rim.position.set(-11, 8, -9); scene.add(rim);

/* ---- 棋盘纹理（Canvas 2D 绘制） ---- */
function buildBoardTexture() {
  const S = 2048, cs = S / GRID;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');

  // 底板
  x.fillStyle = '#edf5ff';
  x.fillRect(0, 0, S, S);

  const rr = (px, py, w, h, r) => {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  };
  const cellRect = (c, r, inset = 0.09) => rr((c + inset) * cs, (r + inset) * cs, cs * (1 - 2 * inset), cs * (1 - 2 * inset), cs * 0.16);

  // 棋盘外框
  x.fillStyle = '#d5e4f5';
  rr(4, 4, S - 8, S - 8, cs * 0.5); x.fill();
  x.fillStyle = '#f8fbff';
  rr(cs * 0.18, cs * 0.18, S - cs * 0.36, S - cs * 0.36, cs * 0.4); x.fill();

  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const mixHex = (a, b, t) => {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
  };
  const shade = (n, f) => {
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + 255 * f)) | 0;
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + 255 * f)) | 0;
    const b = Math.max(0, Math.min(255, (n & 255) + 255 * f)) | 0;
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  };

  // 中央圆盘只作下沉式装饰，先绘制，再让四个专属终点格覆盖在其上方。
  const boardMid = S / 2;
  x.save();
  x.translate(boardMid, boardMid);
  const hub = x.createRadialGradient(0, 0, cs * .12, 0, 0, cs * 1.38);
  hub.addColorStop(0, '#26324d');
  hub.addColorStop(.62, '#111827');
  hub.addColorStop(1, '#080d19');
  x.fillStyle = hub;
  x.beginPath(); x.arc(0, 0, cs * 1.38, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(148,180,255,.36)'; x.lineWidth = cs * .10; x.stroke();
  x.restore();

  // 归航道：第 6 格是本色专属终点，其余格只显示前进箭头。
  for (let p = 0; p < 4; p++) {
    HOMES[p].forEach((c2, i) => {
      const isFinish = i === HOME_LEN - 1;
      const g = x.createLinearGradient(c2[0] * cs, c2[1] * cs, (c2[0] + 1) * cs, (c2[1] + 1) * cs);
      const yellowLane = p === 2;
      g.addColorStop(0, isFinish ? '#101a31' : yellowLane ? '#f1d86f' : mixHex(PL[p].hex, 0xf8fbff, 0.12));
      g.addColorStop(1, isFinish ? hex(PL[p].deep) : yellowLane ? '#cba83e' : mixHex(PL[p].hex, 0xdcecff, 0.32));
      x.fillStyle = g;
      cellRect(c2[0], c2[1], isFinish ? 0.015 : 0.03); x.fill();
      x.strokeStyle = isFinish ? 'rgba(255,255,255,.98)' : 'rgba(255,255,255,.82)';
      x.lineWidth = cs * (isFinish ? 0.075 : 0.03); x.stroke();

      const px = (c2[0] + .5) * cs, py = (c2[1] + .5) * cs;
      x.save();
      x.translate(px, py);
      if (isFinish) {
        // 顶面 UV 会旋转 180°，终点文字预先反转以保持正向。
        x.rotate(Math.PI);
        x.fillStyle = '#ffffff';
        x.font = '900 ' + (cs * .40) + 'px -apple-system, sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('终', 0, cs * .02);
      } else {
        x.rotate(Math.atan2(boardMid - py, boardMid - px));
        x.strokeStyle = yellowLane ? 'rgba(82,58,8,.82)' : 'rgba(255,255,255,.88)';
        x.lineWidth = cs * 0.075;
        x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath();
        x.moveTo(-cs * .12, -cs * .17);
        x.lineTo(cs * .10, 0);
        x.lineTo(-cs * .12, cs * .17);
        x.stroke();
      }
      x.restore();
    });
  }

  // 外圈路径格
  PATH.forEach((c2, i) => {
    const isStart = STARTS.includes(i);
    const colorIndex = pathColor(i);
    const tile = PL[colorIndex];
    const yellowTile = colorIndex === 2;
    const g = x.createLinearGradient(c2[0] * cs, c2[1] * cs, (c2[0] + 1) * cs, (c2[1] + 1) * cs);
    g.addColorStop(0, yellowTile ? (isStart ? '#e5c956' : '#ffed8d') : mixHex(tile.hex, 0xf8fbff, isStart ? 0.12 : 0.34));
    g.addColorStop(1, yellowTile ? (isStart ? '#c49c2e' : '#dfbd49') : mixHex(tile.hex, 0xdcecff, isStart ? 0.28 : 0.52));
    x.fillStyle = g;
    cellRect(c2[0], c2[1], 0.08); x.fill();
    x.strokeStyle = isStart ? hex(tile.deep) : mixHex(tile.hex, 0x1b365b, 0.24);
    x.lineWidth = cs * (isStart ? 0.055 : 0.035);
    x.stroke();
  });

  // 快速穿越通道：同色虚线从入口指向出口，横跨对面归航道第四格。
  FLIGHT_ROUTES.forEach(route => {
    const a = PATH[route.entryIndex], b = PATH[route.exitIndex];
    const ax = (a[0] + .5) * cs, ay = (a[1] + .5) * cs;
    const bx = (b[0] + .5) * cs, by = (b[1] + .5) * cs;
    const angle = Math.atan2(by - ay, bx - ax);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    // 通道颜色表示实际使用者，而不是被横跨的归航道或端点公共格颜色。
    const colorIndex = route.seat;
    const lineColor = colorIndex === 2 ? '#d8c36e' : shade(PL[colorIndex].hex, 0.18);
    const startX = ax + dx * cs * .24, startY = ay + dy * cs * .24;
    const tipX = bx, tipY = by;
    const shaftEndX = tipX - dx * cs * .34, shaftEndY = tipY - dy * cs * .34;
    x.save();
    x.lineCap = 'butt'; x.lineJoin = 'round';
    x.shadowColor = 'rgba(255,255,255,.52)'; x.shadowBlur = cs * .065;
    x.strokeStyle = lineColor; x.lineWidth = cs * .078;
    x.setLineDash([cs * .20, cs * .17]);
    x.lineDashOffset = -cs * .035;
    x.beginPath(); x.moveTo(startX, startY); x.lineTo(shaftEndX, shaftEndY); x.stroke();
    x.setLineDash([]); x.shadowBlur = 0;
    x.fillStyle = lineColor;
    x.beginPath();
    x.moveTo(tipX, tipY);
    x.lineTo(tipX - dx * cs * .34 - dy * cs * .18, tipY - dy * cs * .34 + dx * cs * .18);
    x.lineTo(tipX - dx * cs * .34 + dy * cs * .18, tipY - dy * cs * .34 - dx * cs * .18);
    x.closePath(); x.fill();
    x.restore();
  });

  // 基地停机位图标。
  const drawGlyph = (c, r, color, txt) => {
    x.save();
    x.translate((c + .5) * cs, (r + .5) * cs);
    x.fillStyle = color;
    x.font = 'bold ' + (cs * 0.5) + 'px -apple-system, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt, 0, cs * 0.02);
    x.restore();
  };

  // 出生格仅标示共享航道前进方向，不再使用飞机字符或玩家色覆盖。
  STARTS.forEach(si => {
    const a = PATH[si], b = PATH[(si + 1) % PATH_LEN];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const colorIndex = pathColor(si);
    x.save();
    x.translate((a[0] + .5) * cs, (a[1] + .5) * cs);
    x.rotate(angle);
    x.strokeStyle = colorIndex === 2 ? 'rgba(83,63,13,.76)' : 'rgba(255,255,255,.92)';
    x.lineWidth = cs * .085; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(-cs * .22, 0); x.lineTo(cs * .20, 0);
    x.moveTo(cs * .04, -cs * .16); x.lineTo(cs * .20, 0); x.lineTo(cs * .04, cs * .16);
    x.stroke();
    x.restore();
  });

  // 四个基地
  for (let p = 0; p < 4; p++) {
    const o = BASE_ORIGIN[p];
    const px = o[0] * cs + cs * 0.18, py = o[1] * cs + cs * 0.18, w = cs * BASE_SIZE - cs * 0.36;
    x.fillStyle = p === 2 ? '#e5cb5b' : mixHex(PL[p].hex, 0xe9f4ff, 0.22);
    rr(px, py, w, w, cs * 0.55); x.fill();
    x.strokeStyle = hex(PL[p].deep); x.lineWidth = cs * 0.07; x.stroke();
    x.fillStyle = 'rgba(245,251,255,.42)';
    rr(px + cs * 0.5, py + cs * 0.5, w - cs, w - cs, cs * 0.4); x.fill();
    // 停机位
    BASE_SLOTS.forEach(s => {
      x.fillStyle = 'rgba(250,253,255,.90)';
      x.beginPath(); x.arc((o[0] + s[0] + .5) * cs, (o[1] + s[1] + .5) * cs, cs * 0.62, 0, 7); x.fill();
      x.strokeStyle = shade(PL[p].hex, -0.08); x.lineWidth = cs * 0.06; x.stroke();
      drawGlyph(o[0] + s[0], o[1] + s[1] + 0.02, 'rgba(0,0,0,.16)', '✈');
    });
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const boardTex = buildBoardTexture();
const board = new THREE.Mesh(
  new THREE.BoxGeometry(GRID, 0.5, GRID),
  [
    new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: .9 }),
    new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: .9 }),
    new THREE.MeshPhysicalMaterial({
      map: boardTex, roughness: .34, metalness: .0,
      clearcoat: .58, clearcoatRoughness: .12
    }),
    new THREE.MeshStandardMaterial({ color: 0x1b2036, roughness: .9 }),
    new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: .9 }),
    new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: .9 })
  ]
);
board.position.y = -0.25;
board.receiveShadow = true;
scene.add(board);

// 棋盘上方独立的透明亚克力覆层：底图保持清晰，覆层只负责折射、高光与冷色边缘。
const acrylicTop = new THREE.Mesh(
  new THREE.BoxGeometry(GRID - 0.08, 0.055, GRID - 0.08),
  new THREE.MeshPhysicalMaterial({
    color: 0xdceeff,
    roughness: 0.065,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.14,
    ior: 1.46,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  })
);
acrylicTop.position.y = 0.035;
acrylicTop.renderOrder = 2;
scene.add(acrylicTop);

const acrylicEdge = new THREE.LineSegments(
  new THREE.EdgesGeometry(acrylicTop.geometry, 28),
  new THREE.LineBasicMaterial({
    color: 0x8fd8ff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);
acrylicEdge.position.copy(acrylicTop.position);
acrylicEdge.renderOrder = 3;
scene.add(acrylicEdge);

// 悬浮平台（太空站甲板）
const table = new THREE.Mesh(
  new THREE.CylinderGeometry(15.5, 15.2, 0.6, 64),
  new THREE.MeshStandardMaterial({ color: 0x0a1024, roughness: .82, metalness: .35, emissive: 0x040814 })
);
table.position.y = -0.72; table.receiveShadow = true; scene.add(table);

// 平台边缘光环
const halo = new THREE.Mesh(
  new THREE.RingGeometry(15.4, 16.4, 96),
  new THREE.MeshBasicMaterial({ color: 0x4f7cff, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false })
);
halo.rotation.x = -Math.PI / 2; halo.position.y = -0.44; scene.add(halo);

/* ---------------- 棋子：小飞机 ---------------- */
function makePlane(colorHex, deepHex) {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({
    color: colorHex, roughness: .20, metalness: .12,
    clearcoat: 1, clearcoatRoughness: .07
  });
  const dark = new THREE.MeshPhysicalMaterial({
    color: deepHex, roughness: .27, metalness: .15,
    clearcoat: .85, clearcoatRoughness: .10
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x102449, roughness: .08, metalness: .38,
    clearcoat: 1, clearcoatRoughness: .025
  });

  const fus = new THREE.Mesh(new THREE.ConeGeometry(0.155, 0.66, 16), body);
  fus.rotation.x = Math.PI / 2;      // 机头朝 +z
  fus.position.z = 0.03;
  g.add(fus);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.155, 0.34, 14), body);
  tail.rotation.x = Math.PI / 2; tail.position.z = -0.30;
  g.add(tail);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 0.20), body);
  wing.position.set(0, -0.01, -0.02);
  g.add(wing);

  const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.13), dark);
  wingTip.position.set(0.33, -0.01, -0.04); g.add(wingTip);
  const wingTip2 = wingTip.clone(); wingTip2.position.x = -0.33; g.add(wingTip2);

  const vfin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.20, 0.17), dark);
  vfin.position.set(0, 0.11, -0.36); g.add(vfin);

  const hstab = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.11), dark);
  hstab.position.set(0, -0.02, -0.38); g.add(hstab);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), glass);
  dome.position.set(0, 0.085, -0.05);
  dome.scale.set(1, 0.72, 1.25);
  g.add(dome);

  // 大球形点击命中区（不可见但可被 raycast）
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false })
  );
  hit.userData.isHitbox = true;
  g.add(hit);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}

/* ---------------- 骰子 ---------------- */
function diceFaceTexture(n) {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8ecf6');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(120,130,160,.35)'; x.lineWidth = 8;
  x.strokeRect(10, 10, S - 20, S - 20);
  const R = S * 0.085, u = S * 0.27;
  const P = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
  }[n];
  x.fillStyle = n === 1 ? '#e0333f' : '#242c44';
  P.forEach(p => {
    x.beginPath(); x.arc(S / 2 + p[0] * u, S / 2 + p[1] * u, R, 0, 7); x.fill();
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// BoxGeometry 材质顺序：+X,-X,+Y,-Y,+Z,-Z  =>  1,6,2,5,3,4
const diceMats = [1, 6, 2, 5, 3, 4].map(n =>
  new THREE.MeshStandardMaterial({ map: diceFaceTexture(n), roughness: .34, metalness: .05 })
);
const dice = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), diceMats);
dice.castShadow = true;
dice.position.set(9.2, 0.63, 8.2);
scene.add(dice);

// 点数 N 朝上所需的欧拉角
const FACE_ROT = {
  1: [0, 0, Math.PI / 2],
  6: [0, 0, -Math.PI / 2],
  2: [0, 0, 0],
  5: [Math.PI, 0, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0]
};

/* 指示环 */
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(0.36, 0.045, 10, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 })
);
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

const targetMark = new THREE.Mesh(
  new THREE.RingGeometry(0.30, 0.42, 28),
  new THREE.MeshBasicMaterial({ color: 0x7bffcf, transparent: true, opacity: .85, side: THREE.DoubleSide })
);
targetMark.rotation.x = -Math.PI / 2; targetMark.visible = false; scene.add(targetMark);

/* ---------------- 相机控制（自写轨道） ---------------- */
(function controls() {
  let dragging = false, lx = 0, ly = 0, pinch = 0;
  const down = e => {
    if (e.target !== canvas) return;
    dragging = true;
    const t = e.touches ? e.touches[0] : e;
    lx = t.clientX; ly = t.clientY;
    if (e.touches && e.touches.length === 2) pinch = dist(e.touches);
  };
  const dist = ts => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const move = e => {
    if (!dragging) return;
    if (e.touches && e.touches.length === 2) {
      const d = dist(e.touches);
      camTarget.dist = clamp(camTarget.dist * (pinch / d), 12, 44);
      pinch = d;
    } else {
      const t = e.touches ? e.touches[0] : e;
      camTarget.theta -= (t.clientX - lx) * 0.006;
      camTarget.phi = clamp(camTarget.phi - (t.clientY - ly) * 0.005, 0.16, 1.32);
      lx = t.clientX; ly = t.clientY;
    }
  };
  const up = () => { dragging = false; };
  listen(window, 'mousedown', down); listen(window, 'mousemove', move); listen(window, 'mouseup', up);
  listen(window, 'touchstart', down, { passive: true });
  listen(window, 'touchmove', move, { passive: true });
  listen(window, 'touchend', up);
  listen(canvas, 'wheel', e => {
    e.preventDefault();
    camTarget.dist = clamp(camTarget.dist + e.deltaY * 0.02, 12, 44);
  }, { passive: false });
})();



const pieces=new Map(), pickRings=[];
const keyOf=(seat,id)=>seat+':'+id;
state.players.forEach(p=>p.pieces.forEach(pc=>{
  const m=makePlane(PL[p.seat].hex,PL[p.seat].deep);
  m.userData={seat:p.seat,id:pc.id};scene.add(m);pieces.set(keyOf(p.seat,pc.id),m);
}));
function clearRings(){pickRings.forEach(r=>{scene.remove(r);r.geometry.dispose();r.material.dispose();});pickRings.length=0;}
function sync(){
  const stacks=new Map();
  state.players.forEach(p=>p.pieces.forEach(pc=>{
    const m=pieces.get(keyOf(p.seat,pc.id));m.visible=pc.st!=='done';
    const w=world(p.seat,pc.prog,pc.slot);m.position.set(w.x,.30,w.z);
    if(pc.st==='base')m.rotation.y=Math.atan2(-w.x,-w.z);
    if(pc.st==='track'||pc.st==='home'){
      const k=w.x+','+w.z;if(!stacks.has(k))stacks.set(k,[]);stacks.get(k).push(m);
    }
  }));
  stacks.forEach(ms=>{if(ms.length>1)ms.forEach((m,i)=>{const a=i/ms.length*Math.PI*2;m.position.x+=Math.cos(a)*.19;m.position.z+=Math.sin(a)*.19;});});
  pieces.forEach(m=>m.updateMatrixWorld(true));
}
function choices(moves){
  clearRings();ring.visible=false;targetMark.visible=false;
  pieces.forEach(m=>{m.userData.pick=false;m.scale.setScalar(1);});
  const seat=state.players[state.turn].seat;
  moves.forEach(mv=>{const m=pieces.get(keyOf(seat,mv.pc.id));m.userData.pick=true;m.scale.setScalar(1.18);
    const r=new THREE.Mesh(new THREE.RingGeometry(.42,.58,32),new THREE.MeshBasicMaterial({color:0xffe066,transparent:true,opacity:.85,side:THREE.DoubleSide}));
    r.rotation.x=-Math.PI/2;r.position.set(m.position.x,.09,m.position.z);scene.add(r);pickRings.push(r);
  });
}
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
async function animate(stage){
  if(stage.type==='finish'){pieces.get(keyOf(stage.seat,stage.id)).visible=false;return;}
  if(stage.type==='hit'){
    await Promise.all(stage.targets.map(t=>moveMesh(t,'return')));return;
  }
  if(stage.type==='travel')await moveMesh(stage,stage.style);
}
async function moveMesh(t,style){
  const m=pieces.get(keyOf(t.seat,t.id)),from=m.position.clone(),to=gridToWorld(...t.to),cross=style.startsWith('cross');
  const dir=new THREE.Vector3().subVectors(to,from);if(dir.lengthSq()>1e-6)m.rotation.y=Math.atan2(dir.x,dir.z);
  await life.tween(cross?380:style==='hop'?125:420,k=>{
    const e=ease(k);m.position.x=from.x+(to.x-from.x)*e;m.position.z=from.z+(to.z-from.z)*e;
    m.position.y=cross?.30+(style==='crossUp'?Math.sin(e*Math.PI/2):Math.cos(e*Math.PI/2))*2.55:.30+Math.sin(Math.PI*e)*(style==='hop'?.55:1.5);
    m.rotation.z=Math.sin(Math.PI*e)*(cross?.58:.22);
  });
  m.rotation.z=0;
}
async function roll(value){
  const tq=new THREE.Quaternion().setFromEuler(new THREE.Euler(...FACE_ROT[value]));const start=dice.position.clone();
  await life.tween(900,k=>{if(k<.72){dice.rotation.x+=.34;dice.rotation.y+=.27;dice.rotation.z+=.19;dice.position.y=.63+Math.sin(k/.72*Math.PI)*2.4;}
    else {const e=1-Math.pow(1-(k-.72)/.28,3);dice.quaternion.slerp(tq,Math.max(.06,e*.34));dice.position.y=.63+(1-e)*.9;}});
  dice.quaternion.copy(tq);dice.position.copy(start);
}
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let downPos;
function find(event){
  const rect=canvas.getBoundingClientRect();ptr.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  camera.updateMatrixWorld(true);pieces.forEach(m=>m.updateMatrixWorld(true));ray.setFromCamera(ptr,camera);
  const hits=ray.intersectObjects([...pieces.values()].filter(m=>m.visible),true);
  if(!hits.length)return;let root=hits[0].object;while(root&&root.userData.id===undefined)root=root.parent;return root;
}
listen(canvas,'pointerdown',e=>{downPos={x:e.clientX,y:e.clientY};});
listen(canvas,'pointerup',e=>{
  if(!downPos)return;const d=Math.hypot(e.clientX-downPos.x,e.clientY-downPos.y);downPos=null;
  if(d>6||state.phase!=='choosing')return;const m=find(e);if(m?.userData.pick)choose(m.userData.id);
});
listen(canvas,'pointermove',e=>{
  ring.visible=false;targetMark.visible=false;if(state.phase!=='choosing')return;
  const m=find(e);if(!m?.userData.pick)return;
  ring.position.set(m.position.x,.06,m.position.z);ring.visible=true;
  const mv=state.pickable.find(mv=>mv.pc.id===m.userData.id);if(!mv)return;
  const to=world(m.userData.seat,mv.to);targetMark.position.set(to.x,.07,to.z);targetMark.visible=true;
});
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(w,h,false);camera.aspect=w/h;
  shiftPx=Math.round(h*SHIFT_RATIO);camera.setViewOffset(w,h,0,-shiftPx,w,h);camTarget.dist=fitDist(camTarget.phi);
}
listen(window,'resize',resize);resize();viewDefault();cam={...camTarget};sync();
let ringT=0;
function loop(){
  cam.theta+=(camTarget.theta-cam.theta)*.12;cam.phi+=(camTarget.phi-cam.phi)*.12;cam.dist+=(camTarget.dist-cam.dist)*.10;applyCam();ringT+=.016;
  if(ring.visible)ring.scale.setScalar(1+Math.sin(ringT*5)*.09);
  if(targetMark.visible)targetMark.scale.setScalar(1+Math.sin(ringT*6)*.10);
  pickRings.forEach((r,i)=>{r.scale.setScalar(1+Math.sin(ringT*4+i)*.18);r.material.opacity=.6+Math.sin(ringT*4+i)*.3;});
  dice.rotation.y+=.0016;spaceGroup.userData.spin.forEach((p,i)=>{p.rotation.y+=(i?.00013:.00007);});halo.material.opacity=.10+Math.sin(ringT*1.6)*.05;
  renderer.render(scene,camera);life.frame(loop);
}
life.frame(loop);
return {sync,choices,animate,roll,turn:seat=>{if(follow)focusSeat(seat);},
  camera(mode){if(mode==='top'){follow=false;viewTop();}else if(mode==='tilt'){follow=false;viewDefault();}else{follow=!follow;if(follow)focusSeat(state.players[state.turn].seat);else viewDefault();}return follow;},
  dispose(){
    clearRings();const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});});if(o.shadow)o.shadow.dispose();});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();scene.clear();pieces.clear();canvas.remove();
  }};
}
