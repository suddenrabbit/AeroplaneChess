export const GRID = 15;          // 15x15
export const PATH_LEN = 52;      // 共享航道坐标总数（用于全局索引循环）
export const HOME_LEN = 6;       // 归航道格数
export const HOME_ENTRY_PROG = PATH_LEN - 2;  // 50：与本方归航道正对的共享航道入口
export const HOME_START_PROG = HOME_ENTRY_PROG + 1; // 51：归航道第一格
export const TOTAL = HOME_START_PROG + HOME_LEN - 1; // 56：归航道第 6 格（专属终点格）

// 外圈路径（col,row），索引 0 为红方起点
export const PATH = [
  [0,5],[1,5],[2,5],[3,5],[4,5],
  [5,4],[5,3],[5,2],[5,1],[5,0],
  [6,0],[7,0],[8,0],
  [9,0],[9,1],[9,2],[9,3],[9,4],
  [10,5],[11,5],[12,5],[13,5],[14,5],
  [14,6],[14,7],[14,8],
  [14,9],[13,9],[12,9],[11,9],[10,9],
  [9,10],[9,11],[9,12],[9,13],[9,14],
  [8,14],[7,14],[6,14],
  [5,14],[5,13],[5,12],[5,11],[5,10],
  [4,9],[3,9],[2,9],[1,9],[0,9],
  [0,8],[0,7],[0,6]
];

export const STARTS = [0, 13, 26, 39];

export const HOMES = [
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]]
];

// 5×5 基地左上角 (col,row)：左上 / 右上 / 右下 / 左下
export const BASE_SIZE = 5;
export const BASE_ORIGIN = [[0,0],[10,0],[10,10],[0,10]];
// 基地内 4 个停机位（相对基地左上角）
export const BASE_SLOTS  = [[1.1,1.1],[2.9,1.1],[1.1,2.9],[2.9,2.9]];

export const PL = [
  { key:'红方', hex:0xef4444, css:'#ef4444', deep:0xb91c1c },
  { key:'绿方', hex:0x22c55e, css:'#22c55e', deep:0x15803d },
  { key:'黄方', hex:0xe3cc6d, css:'#e3cc6d', deep:0xa88932 },
  { key:'蓝方', hex:0x3b82f6, css:'#3b82f6', deep:0x1d4ed8 }
];

// 四色快速穿越统一发生在各自私人进度 18 → 30；途中横跨对面玩家归航道第四格。
export const FLIGHT_ENTRY_PROG = 18;
export const FLIGHT_EXIT_PROG = 30;
export const FLIGHT_CROSS_HOME_PROG = HOME_START_PROG + 3;
export const FLIGHT_ROUTES = PL.map((_, seat) => {
  const crossedSeat = (seat + 2) % PL.length;
  return {
    seat,
    entryProg: FLIGHT_ENTRY_PROG,
    exitProg: FLIGHT_EXIT_PROG,
    entryIndex: (STARTS[seat] + FLIGHT_ENTRY_PROG) % PATH_LEN,
    exitIndex: (STARTS[seat] + FLIGHT_EXIT_PROG) % PATH_LEN,
    crossedSeat,
    crossedHomeProg: FLIGHT_CROSS_HOME_PROG,
    crossCoord: HOMES[crossedSeat][3]
  };
});

export function flightRoute(seat) { return FLIGHT_ROUTES[seat]; }
export function isFlightEntry(prog) { return prog === FLIGHT_ENTRY_PROG; }

/** 共享航道颜色：从正对红方归航道的 PATH[50] 起，顺时针循环红、绿、黄、蓝。 */
export function pathColor(globalIndex) {
  const i = ((globalIndex % PATH_LEN) + PATH_LEN) % PATH_LEN;
  return (i + 2) % PL.length;
}

/** 正常走骰后是否落在玩家本色共享格；起飞、归航道和折返不调用此判定。 */
export function isBoostLanding(seat, prog) {
  return prog >= 0 && prog < HOME_START_PROG && prog !== HOME_ENTRY_PROG &&
    pathColor(globalIdx(seat, prog)) === seat;
}


export const HALF = (GRID - 1) / 2;
export function globalIdx(seat, prog) { return (STARTS[seat] + prog) % PATH_LEN; }
export function coord(seat, prog, slot = 0) {
  if (prog < 0) return BASE_ORIGIN[seat].map((n, i) => n + BASE_SLOTS[slot][i]);
  return prog < HOME_START_PROG ? PATH[globalIdx(seat, prog)] : HOMES[seat][Math.min(prog, TOTAL) - HOME_START_PROG];
}
