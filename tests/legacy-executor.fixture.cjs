// Frozen original move executor. Rendering is stubbed only in this test fixture.
module.exports = function(G, board, rules) {
const {TOTAL, HOME_START_PROG, coord, HALF, globalIdx} = board;
const {enemiesAt,previewFlightHitStage}=rules;
const vector=(x,z)=>({x,y:.3,z,clone(){return vector(this.x,this.z)}});
const gridToWorld=(c,r)=>vector(c-HALF,r-HALF);
const posToWorld=(s,p)=>gridToWorld(...coord(s,p));
const baseWorld=(s,slot)=>gridToWorld(...coord(s,-1,slot));
const finishWorld=s=>gridToWorld(...coord(s,56));
G.players.forEach(p=>p.pieces.forEach(pc=>{pc.mesh={position:posToWorld(p.seat,pc.prog),visible:true};}));
const hop=async(m,from,to)=>{m.position=to;};
const knockBack=async(p,pc)=>{pc.st='base';pc.prog=-1;};
const flyShortcut=async(m,from,via,to,onCross)=>{const n=await onCross();m.position=to;return n;};
const sleep=async()=>{},hint=()=>{},hidePickIndicators=()=>{},renderPlayers=()=>{},layoutStacks=()=>{},endTurn=()=>{};
function checkGameOver(){if(G.players.filter(p=>!p.rank).length<=1){G.players.forEach(p=>{if(!p.rank)p.rank=++G.finished;});G.phase='over';}}
async function resolveLanding(p, prog) {
  if (prog >= HOME_START_PROG) return 0;
  const g = globalIdx(p.seat, prog);
  const enemies = enemiesAt(p.seat, g);
  if (!enemies.length) return 0;
  hint(p.name + ' 击落 ' + enemies.length + ' 架敌机！');
  for (const e of enemies) await knockBack(e.p, e.pc);
  return enemies.length;
}

/** 快速穿越中点结算：击落专属归航道第四格内的敌机。 */
async function resolveFlightCrossing(p, flight) {
  const stage = previewFlightHitStage(p, flight);
  if (!stage.hits.length) return 0;
  hint(p.name + ' 穿越归航道，击落 ' + stage.hits.length + ' 架敌机！');
  await Promise.all(stage.hits.map(e => knockBack(e.p, e.pc)));
  return stage.hits.length;
}

/** 执行移动 */
async function applyMove(p, mv) {
  G.phase = 'anim'; G.busy = true;
  hidePickIndicators();
  const pc = mv.pc;
  let hitCount = 0;

  if (mv.kind === 'launch') {
    pc.st = 'track'; pc.prog = 0;
    await hop(pc.mesh, baseWorld(p.seat, pc.slot), posToWorld(p.seat, 0), true);
    hitCount += await resolveLanding(p, 0);
  } else {
    if (mv.kind === 'bounce') {
      hint(p.name + ' 点数超过终点，折返 ' + (mv.rawTo - TOTAL) + ' 格');
    }
    const route = mv.steps || Array.from({ length: mv.landingTo - mv.from }, (_, i) => mv.from + i + 1);
    for (const s of route) {
      const isFin = s === TOTAL;
      const w = isFin ? finishWorld(p.seat, p.done) : posToWorld(p.seat, s);
      await hop(pc.mesh, pc.mesh.position.clone(), w, isFin);
      pc.prog = s;
      pc.st = s >= HOME_START_PROG ? 'home' : 'track';
    }

    hitCount += await resolveLanding(p, mv.landingTo);

    if (mv.boostSteps && mv.boostSteps.length) {
      hint(p.name + ' 落在本色格，自动快进 4 格！');
      for (const s of mv.boostSteps) {
        const w = posToWorld(p.seat, s);
        await hop(pc.mesh, pc.mesh.position.clone(), w, false);
        pc.prog = s;
        pc.st = s >= HOME_START_PROG ? 'home' : 'track';
      }
      hitCount += await resolveLanding(p, mv.boostTo);
    }

    if (mv.flight) {
      hint(p.name + ' 进入快速通道，穿越归航道！');
      const route = mv.flight;
      const via = gridToWorld(route.crossCoord[0], route.crossCoord[1]);
      const exit = posToWorld(p.seat, route.exitProg);
      hitCount += await flyShortcut(
        pc.mesh,
        pc.mesh.position.clone(),
        via,
        exit,
        () => resolveFlightCrossing(p, route)
      );
      pc.prog = route.exitProg;
      pc.st = 'track';
      hitCount += await resolveLanding(p, route.exitProg);
    }
  }

  // 到达终点
  if (mv.to >= TOTAL) {
    pc.st = 'done'; pc.prog = TOTAL; p.done++;
    // 抵达动画落在本色终点格，随后收起模型，避免多架飞机遮住终点标记。
    pc.mesh.visible = false;
    hint(p.name + ' 一架飞机抵达终点 ✈');
    if (p.done === 4) {
      p.rank = ++G.finished;
      renderPlayers();
      await sleep(560);
      checkGameOver();
      layoutStacks(); renderPlayers();
      if (G.phase === 'over') { G.busy = false; return; }
    }
  }

  layoutStacks();
  renderPlayers();
  G.busy = false;

  await sleep(hitCount ? 620 : 260);
  endTurn(G.dice);
}


return applyMove;
};
