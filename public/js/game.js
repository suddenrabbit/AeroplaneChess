import {TOTAL, HOME_START_PROG, coord} from './board.js';
import {rulesFor} from './rules.js';

export function createState(cfg) {
  const seats = [0,1,2,3].filter(s => cfg.types[s] !== 'off');
  if (seats.length < 2) throw new Error('请至少开启两种颜色');
  return {players:seats.map(seat => ({seat, type:cfg.types[seat], level:cfg.levels[seat],
    pieces:[0,1,2,3].map(id => ({id,slot:id,st:'base',prog:-1})),done:0,rank:0})),
    turn:0,dice:0,sixStreak:0,finished:0,phase:'idle',pickable:[],testOpeningRoll:cfg.test};
}

// Rules produce ordered stages. Animation never determines a hit or destination.
export function planMove(state, player, move) {
  const stages = [], pc = move.pc, rules = rulesFor(state);
  let from = coord(player.seat, pc.prog, pc.slot);
  const travel = (to, style='hop', prog=null) => {
    stages.push({type:'travel',seat:player.seat,id:pc.id,from:[...from],to:[...to],style,prog}); from=to;
  };
  const hit = (targets, label='hit') => {
    // A victim already hit at an earlier stage is back at base for later stages.
    const fresh = targets.filter(({p,pc}) => !hitKeys.has(p.seat+':'+pc.id));
    fresh.forEach(({p,pc}) => hitKeys.add(p.seat+':'+pc.id));
    if (fresh.length) stages.push({type:'hit',label,targets:fresh.map(({p,pc})=>({seat:p.seat,id:pc.id,from:coord(p.seat,pc.prog,pc.slot),to:coord(p.seat,-1,pc.slot)}))});
  };
  const hitKeys = new Set();
  const landing = prog => { if(prog < HOME_START_PROG) hit(rules.enemiesAt(player.seat, (START(player.seat)+prog)%52)); };
  if (move.kind === 'launch') {
    travel(coord(player.seat,0),'launch',0); landing(0);
  } else {
    const steps = move.steps || Array.from({length:move.landingTo-move.from},(_,i)=>move.from+i+1);
    steps.forEach(prog=>travel(coord(player.seat,prog),'hop',prog));
    landing(move.landingTo);
    if (move.boostSteps?.length) {
      stages.push({type:'notice',key:'boost'});
      move.boostSteps.forEach(prog=>travel(coord(player.seat,prog),'hop',prog)); landing(move.boostTo);
    }
    if (move.flight) {
      stages.push({type:'notice',key:'flight'});
      travel(move.flight.crossCoord,'crossUp');
      hit(rules.previewFlightHitStage(player,move.flight).hits,'crossHit');
      travel(coord(player.seat,move.flight.exitProg),'crossDown',move.flight.exitProg);
      landing(move.flight.exitProg);
    }
  }
  if(move.to === TOTAL) stages.push({type:'finish',seat:player.seat,id:pc.id});
  return stages;
}
// Use the same fixed seat mapping everywhere, independent of active player count.
import {STARTS} from './board.js';
const START = seat => STARTS[seat];

export function commitStage(state, stage) {
  if(stage.type === 'travel' && stage.prog !== null) {
    const pc=state.players.find(p=>p.seat===stage.seat).pieces[stage.id];
    pc.prog=stage.prog; pc.st=pc.prog>=HOME_START_PROG?'home':'track';
  } else if(stage.type === 'hit') {
    stage.targets.forEach(t=>{const pc=state.players.find(p=>p.seat===t.seat).pieces[t.id];pc.prog=-1;pc.st='base';});
  } else if(stage.type === 'finish') {
    const p=state.players.find(p=>p.seat===stage.seat),pc=p.pieces[stage.id];
    if(pc.st==='done') return;
    pc.st='done';pc.prog=TOTAL;p.done++;
    if(p.done===4) p.rank=++state.finished;
  }
}

export class Game {
  constructor({state,life,view,update,notice,random=Math.random}) {
    Object.assign(this,{state,life,view,update,notice,random});this.rules=rulesFor(state,random);
  }
  run(promise) { promise.catch(e=>{if(e.name!=='AbortError'){console.error(e);this.state.phase='error';this.notice('error');this.update();}}); }
  current() { return this.state.players[this.state.turn]; }
  start() { this.run(this.next()); }
  async next() {
    this.life.check();const p=this.current();this.state.phase='idle';this.state.pickable=[];
    this.view.sync();this.view.turn?.(p.seat);this.update();this.notice(p.type==='ai'?'thinking':'roll');
    if(p.type==='ai'){await this.life.wait(430+this.random()*380);this.life.check();await this.roll();}
  }
  async roll() {
    this.life.check();const g=this.state;if(g.phase!=='idle') return;
    const p=this.current();g.phase='rolling';this.update();
    g.dice=g.testOpeningRoll?6:1+Math.floor(this.random()*6);g.testOpeningRoll=false;
    await this.view.roll(g.dice);this.life.check();
    g.pickable=this.rules.legalMoves(p,g.dice);this.update();
    if(!g.pickable.length){this.notice('noMove');await this.life.wait(760);return this.endTurn();}
    if(g.pickable.length===1) {g.phase='choosing';return this.move(g.pickable[0]);}
    g.phase='choosing';this.view.choices(g.pickable);this.update();this.notice('choose');
    if(p.type==='ai'){await this.life.wait(420+this.random()*320);this.life.check();await this.move(this.rules.aiChoose(p,g.pickable));}
  }
  choose(id) {
    if(this.current().type!=='human'||this.state.phase!=='choosing') return;
    const mv=this.state.pickable.find(m=>m.pc.id===id);if(mv)this.run(this.move(mv));
  }
  async move(mv) {
    this.life.check();const g=this.state;if(g.phase!=='choosing'||!g.pickable.includes(mv))return;
    g.phase='anim';g.pickable=[];this.view.choices([]);this.update();
    const stages=planMove(g,this.current(),mv);
    if(mv.kind==='bounce')this.notice('bounce');
    for(const stage of stages){
      this.life.check();
      if(stage.type==='notice'){this.notice(stage.key);continue;}
      commitStage(g,stage);
      if(stage.type==='hit')this.notice(stage.label,{count:stage.targets.length});
      if(stage.type==='finish')this.notice('finish');
      await this.view.animate(stage);this.life.check();
    }
    this.view.sync();this.update();
    if(g.players.filter(p=>!p.rank).length<=1){
      g.players.forEach(p=>{if(!p.rank)p.rank=++g.finished;});g.phase='over';this.update();return;
    }
    await this.life.wait(stages.some(s=>s.type==='hit')?620:260);this.life.check();this.endTurn();
  }
  endTurn() {
    this.life.check();const g=this.state;
    if(g.dice===6&&g.sixStreak<2&&!this.current().rank){g.sixStreak++;this.notice('again');}
    else {g.sixStreak=0;do{g.turn=(g.turn+1)%g.players.length;}while(this.current().rank);}
    this.run(this.next());
  }
}
