import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../public/js/board.js';
import {rulesFor} from '../public/js/rules.js';
import {createState,planMove,commitStage,Game} from '../public/js/game.js';
import {parseConfig,routeTheme,defaults} from '../public/js/config.js';
import legacy from './legacy-rules.fixture.cjs';
const rng=(seed=37)=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
const fresh=()=>createState({types:['human','ai','ai','human'],levels:[2,1,2,2],test:false});
const set=(g,seat,id,prog)=>Object.assign(g.players.find(p=>p.seat===seat).pieces[id],{prog,st:prog<0?'base':prog===56?'done':prog>=51?'home':'track'});
const execute=(g,seat,id,dice)=>{const p=g.players.find(p=>p.seat===seat),m=rulesFor(g).legalMoves(p,dice).find(m=>m.pc.id===id);assert.ok(m);const stages=planMove(g,p,m);stages.forEach(s=>commitStage(g,s));return {m,stages};};
test('board invariants and home entry colors',()=>{
 assert.equal(B.PATH.length,52);assert.equal(new Set(B.PATH.map(String)).size,52);assert.deepEqual(B.STARTS,[0,13,26,39]);
 for(let s=0;s<4;s++){assert.equal(B.HOMES[s].length,6);assert.equal(B.PATH.filter((_,i)=>B.pathColor(i)===s).length,13);assert.equal(B.pathColor(B.globalIdx(s,50)),s);assert.deepEqual(B.coord(s,56),B.HOMES[s][5]);}
});
test('legal actions and seeded AI match the pre-theme code over 2000 positions',()=>{
 const random=rng();for(let i=0;i<2000;i++){
  const g=fresh();g.players=g.players.filter(p=>p.seat===0||p.seat===1||random()>.4);
  for(const p of g.players){p.level=1+Math.floor(random()*2);for(const pc of p.pieces){const prog=Math.floor(random()*59)-2;set(g,p.seat,pc.id,prog<0?-1:Math.min(56,prog));}}
  const current=rulesFor(g,rng(i+1)),previous=legacy(g,Object.assign(Object.create(Math),{random:rng(i+1)}),B);
  for(const p of g.players)for(let d=1;d<=6;d++){
   const a=current.legalMoves(p,d),b=previous.legalMoves(p,d);assert.deepEqual(a,b);
   if(a.length)assert.equal(current.aiChoose(p,a).pc.id,previous.aiChoose(p,b).pc.id);
  }
 }
});
test('6 only launch, no launch boost; normal boost +4 once',()=>{
 const g=fresh(),p=g.players[0];assert.equal(rulesFor(g).legalMoves(p,5).length,0);
 const {m}=execute(g,0,0,6);assert.equal(m.to,0);assert.equal(p.pieces[0].prog,0);
 set(g,0,0,1);assert.equal(execute(g,0,0,1).m.to,6);
});
test('direct flight and boost flight; collisions at every stage, including stacks',()=>{
 let g=fresh();set(g,0,0,17);assert.equal(execute(g,0,0,1).m.to,30);
 g=fresh();set(g,0,0,13);set(g,1,0,1);set(g,1,1,1);set(g,1,2,5);set(g,1,3,17);set(g,2,0,54);set(g,2,1,54);
 const {m,stages}=execute(g,0,0,1);assert.equal(m.kind,'boostFlight');assert.equal(g.players[0].pieces[0].prog,30);
 assert.deepEqual(stages.filter(s=>s.type==='hit').map(s=>s.targets.length),[2,1,2,1]);
 assert.ok(g.players[1].pieces.every(pc=>pc.st==='base'));assert.equal(g.players[2].pieces[0].st,'base');
 const flight=stages.filter(s=>s.style?.startsWith('cross'));assert.deepEqual(flight[0].to,B.HOMES[2][3]);assert.deepEqual(flight[1].to,B.PATH[30]);
});
test('home entry excludes boost; 50 to 51; finish bounce and exact finish',()=>{
 const g=fresh();set(g,0,0,49);assert.equal(execute(g,0,0,1).m.to,50);assert.equal(execute(g,0,0,1).m.to,51);
 set(g,0,0,54);const {stages}=execute(g,0,0,4);assert.deepEqual(stages.filter(s=>s.type==='travel').map(s=>s.prog),[55,56,55,54]);assert.equal(g.players[0].done,0);
 execute(g,0,0,2);assert.equal(g.players[0].pieces[0].st,'done');assert.equal(g.players[0].done,1);
});
test('spawn is not safe; stacks remain separate legal selections; absent opponent',()=>{
 const g=fresh();set(g,1,0,39);set(g,1,1,39);execute(g,0,0,6);assert.equal(g.players[1].pieces[0].st,'base');
 set(g,0,1,0);assert.deepEqual(rulesFor(g).legalMoves(g.players[0],1).map(m=>m.pc.id),[0,1]);
 g.players=g.players.filter(p=>p.seat!==2);set(g,0,0,17);assert.equal(execute(g,0,0,1).m.to,30);
});
test('smart exact finish and outside priority; simple samples every legal action',()=>{
 const g=fresh(),p=g.players[0];set(g,0,0,54);set(g,0,1,12);
 let r=rulesFor(g,()=>0),moves=r.legalMoves(p,2);assert.equal(r.aiChoose(p,moves).pc.id,0);
 moves=r.legalMoves(p,3);assert.equal(r.aiChoose(p,moves).pc.id,1);
 p.level=1;const selected=new Set();for(let i=0;i<moves.length;i++)selected.add(rulesFor(g,()=>i/moves.length).aiChoose(p,moves).pc.id);assert.equal(selected.size,moves.length);
});
test('URL compatibility and arbitrary seat combinations',()=>{
 assert.equal(routeTheme(new URLSearchParams()),null);assert.equal(routeTheme(new URLSearchParams('test=1')),'acrylic');
 assert.equal(routeTheme(new URLSearchParams('theme=bad')),'invalid');
 assert.deepEqual(parseConfig(new URLSearchParams('n=2&t=h,a')).types,['human','off','ai','off']);
 assert.deepEqual(parseConfig(new URLSearchParams('n=2&t=o,h,o,a')).types,['off','human','off','ai']);
 assert.throws(()=>createState({...defaults(),types:['off','human','off','off']}));
});
test('TEST affects first roll only; turn locks and third 6 then handoff',async()=>{
 const state=fresh();state.testOpeningRoll=true;state.players.forEach(p=>p.type='human');
 const life={check(){},wait:async()=>{}},view={sync(){},choices(){},roll:async()=>{},animate:async()=>{}};
 const game=new Game({state,life,view,update(){},notice(){},random:()=>.999});
 for(let i=0;i<3;i++){await game.roll();assert.equal(state.dice,6);const mv=state.pickable[0];await Promise.all([game.move(mv),game.move(mv)]);}
 assert.equal(state.turn,1);assert.equal(state.sixStreak,0);
 const second=fresh();second.testOpeningRoll=true;const g2=new Game({state:second,life,view,update(){},notice(){},random:()=>0});
 await g2.roll();assert.equal(second.dice,6);await g2.move(second.pickable[0]);await g2.roll();assert.equal(second.dice,1);
});
test('complete seeded games with mixed AI and non-fixed seats',()=>{
 for(const seats of [[0,1],[1,3],[0,1,2,3]]){
  const cfg={types:[0,1,2,3].map(s=>seats.includes(s)?'ai':'off'),levels:[2,1,2,2],test:false};const g=createState(cfg),random=rng(83),r=rulesFor(g,random);
  let rolls=0;while(g.players.filter(p=>!p.rank).length>1&&rolls++<40000){
   const p=g.players[g.turn],dice=1+Math.floor(random()*6),moves=r.legalMoves(p,dice);
   if(moves.length)planMove(g,p,r.aiChoose(p,moves)).forEach(stage=>commitStage(g,stage));
   if(dice===6&&g.sixStreak<2&&!p.rank)g.sixStreak++;
   else{g.sixStreak=0;do{g.turn=(g.turn+1)%g.players.length;}while(g.players[g.turn].rank&&g.players.some(p=>!p.rank));}
  }
  assert.ok(rolls<40000);assert.equal(g.players.filter(p=>p.done===4).length,seats.length-1);
 }
});

test('stage execution matches original async executor over 1200 legal actions',async()=>{
 const {default:oldExecutor}=await import('./legacy-executor.fixture.cjs');const random=rng(7);
 const snapshot=g=>g.players.map(p=>({seat:p.seat,done:p.done,rank:p.rank,pieces:p.pieces.map(({st,prog,id})=>({st,prog,id}))}));
 for(let i=0;i<1200;i++){
  const a=fresh();a.players=a.players.filter(p=>p.seat===0||p.seat===1||random()>.5);
  a.players.forEach(p=>p.pieces.forEach(pc=>set(a,p.seat,pc.id,Math.floor(random()*59)-2<0?-1:Math.floor(random()*56))));
  const seat=a.players[Math.floor(random()*a.players.length)].seat,d=1+Math.floor(random()*6);a.dice=d;
  const b=structuredClone(a),p=a.players.find(p=>p.seat===seat),moves=rulesFor(a).legalMoves(p,d);if(!moves.length)continue;
  const m=moves[Math.floor(random()*moves.length)];const bRules=rulesFor(b),bp=b.players.find(p=>p.seat===seat),bm=bRules.legalMoves(bp,d).find(x=>x.pc.id===m.pc.id);
  const runOld=oldExecutor(b,B,bRules);await runOld(bp,bm);
  planMove(a,p,m).forEach(s=>commitStage(a,s));assert.deepEqual(snapshot(a),snapshot(b));
 }
});

test('aborted AI and animation callbacks cannot continue a disposed match',async()=>{
 const {Lifetime}=await import('../public/js/lifetime.js');
 globalThis.cancelAnimationFrame=()=>{}; // This Node test exercises timers; browser tests exercise RAF.
 for(const phase of ['ai','rolling','anim']){
  const life=new Lifetime(),state=fresh();state.players[0].type=phase==='ai'?'ai':'human';state.testOpeningRoll=true;
  let updates=0;const view={sync(){},choices(){},roll:()=>life.wait(15),animate:()=>life.wait(20)};
  const g=new Game({state,life,view,update(){updates++;},notice(){},random:()=>0});
  let pending;
  if(phase==='ai')pending=g.next();else if(phase==='rolling')pending=g.roll();else{await g.roll();pending=g.move(state.pickable[0]);}
  const rejected=assert.rejects(pending,{name:'AbortError'});life.dispose();const frozen=JSON.stringify(state),n=updates;
  await rejected;await new Promise(r=>setTimeout(r,30));assert.equal(JSON.stringify(state),frozen);assert.equal(updates,n);assert.equal(life.timers.size,0);
 }
});
