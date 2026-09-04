// Frozen pre-theme rules used only by regression tests.
module.exports = function(G, Math, board) {
const {TOTAL, HOME_START_PROG, PATH_LEN, globalIdx, isFlightEntry, isBoostLanding, flightRoute} = board;
function legalMoves(p, dice) {
  const out = [];
  p.pieces.forEach(pc => {
    if (pc.st === 'done') return;
    if (pc.st === 'base') {
      if (dice === 6) {
        out.push({
          pc, from: -1, landingTo: 0, to: 0, kind: 'launch',
          hitStages: [previewHitStage(p, 0)]
        });
      }
      return;
    }
    const rawTo = pc.prog + dice;
    if (rawTo > TOTAL) {
      const to = TOTAL - (rawTo - TOTAL);
      const steps = [];
      for (let s = pc.prog + 1; s <= TOTAL; s++) steps.push(s);
      for (let s = TOTAL - 1; s >= to; s--) steps.push(s);
      out.push({ pc, from: pc.prog, landingTo: to, to, rawTo, steps, kind: 'bounce', hitStages: [] });
      return;
    }
    const landingTo = rawTo;
    if (landingTo === TOTAL) {
      out.push({ pc, from: pc.prog, landingTo, to: landingTo, kind: 'finish', hitStages: [] });
      return;
    }
    if (landingTo >= HOME_START_PROG) {
      out.push({ pc, from: pc.prog, landingTo, to: landingTo, kind: 'home', hitStages: [] });
      return;
    }

    // 快速穿越入口优先于入口格本身的同色 +4。
    const directFlight = isFlightEntry(landingTo);
    const boost = !directFlight && isBoostLanding(p.seat, landingTo);
    const boostTo = boost ? landingTo + 4 : landingTo;
    const boostSteps = boost ? [landingTo + 1, landingTo + 2, landingTo + 3, landingTo + 4] : [];
    const boostedFlight = boost && isFlightEntry(boostTo);
    const flight = (directFlight || boostedFlight) ? flightRoute(p.seat) : null;
    const to = flight ? flight.exitProg : boostTo;
    const hitStages = [previewHitStage(p, landingTo)];
    if (boost) hitStages.push(previewHitStage(p, boostTo));
    if (flight) {
      hitStages.push(previewFlightHitStage(p, flight));
      hitStages.push(previewHitStage(p, flight.exitProg));
    }
    const kind = flight ? (boost ? 'boostFlight' : 'flight') : (boost ? 'boost' : 'move');
    out.push({ pc, from: pc.prog, landingTo, to, kind, boostTo, boostSteps, flight, hitStages });
  });
  return out;
}
function enemiesAt(mySeat, g) {
  const list = [];
  G.players.forEach(p => {
    if (p.seat === mySeat) return;
    p.pieces.forEach(pc => {
      if (pc.st === 'track' && globalIdx(p.seat, pc.prog) === g) list.push({ p, pc });
    });
  });
  return list;
}

/** AI 预估用：计算某次共享航道落点可能撞到的敌机。 */
function previewHitStage(p, prog) {
  if (prog >= HOME_START_PROG) return { prog, hits: [] };
  const g = globalIdx(p.seat, prog);
  return { prog, hits: enemiesAt(p.seat, g) };
}

/** AI 预估用：快速穿越会击落对面玩家归航道第四格的全部飞机。 */
function previewFlightHitStage(p, flight) {
  const hits = [];
  G.players.forEach(target => {
    if (target.seat !== flight.crossedSeat || target.seat === p.seat) return;
    target.pieces.forEach(pc => {
      if (pc.st === 'home' && pc.prog === flight.crossedHomeProg) hits.push({ p: target, pc });
    });
  });
  return { type: 'flightCross', prog: flight.crossedHomeProg, hits };
}

function aiChoose(p, moves) {
  if (p.level === 1) return moves[Math.floor(Math.random() * moves.length)];

  // 聪明电脑硬优先级：精确抵达高于一切其他收益。
  const finishes = moves.filter(mv => mv.kind === 'finish');
  if (finishes.length) return finishes[Math.floor(Math.random() * finishes.length)];

  // 已有飞机进入归航道时，若基地或共享航道仍有合法动作，优先推进外部飞机，
  // 避免在归航道内因非最佳点数反复前进、折返。
  let candidates = moves;
  if (p.pieces.some(pc => pc.st === 'home')) {
    const outside = moves.filter(mv => mv.pc.st === 'base' || mv.pc.st === 'track');
    if (outside.length) candidates = outside;
  }

  let best = candidates[0], bestScore = -1e9;
  for (const mv of candidates) {
    let s = 0;
    if (mv.kind === 'launch') s += 34;
    if (mv.kind === 'finish') s += 95;
    if (mv.flight) s += 42;
    if (mv.to >= HOME_START_PROG && mv.to < TOTAL) s += 26 + (mv.to - HOME_START_PROG) * 2;
    for (const stage of (mv.hitStages || [])) {
      if (!stage.hits.length) continue;
      s += 100;
      stage.hits.forEach(e => { s += e.pc.prog * 0.35; });
    }
    // 评估最终落点威胁与离开原位置的收益
    if (mv.to < HOME_START_PROG) {
      const g = globalIdx(p.seat, mv.to);
      s -= threatAt(p.seat, g) * 22;
      if (mv.from >= 0 && mv.from < HOME_START_PROG) {
        const gf = globalIdx(p.seat, mv.from);
        s += threatAt(p.seat, gf) * 16; // 逃离危险
      }
    }
    s += mv.to * 0.45;
    if (mv.from >= HOME_START_PROG) s += 6;      // 已在归航道，稳
    if (mv.to >= HOME_START_PROG) s += 12;
    s += Math.random() * 5;
    if (s > bestScore) { bestScore = s; best = mv; }
  }
  return best;
}
/** 落在 g 上有多少敌机能在 1-6 步内打到 */
function threatAt(mySeat, g) {
  let n = 0;
  G.players.forEach(p => {
    if (p.seat === mySeat) return;
    p.pieces.forEach(pc => {
      if (pc.st !== 'track') return;
      const d = (g - globalIdx(p.seat, pc.prog) + PATH_LEN * 2) % PATH_LEN;
      if (d >= 1 && d <= 6) n++;
    });
  });
  return n;
}


return {legalMoves,aiChoose};
};
