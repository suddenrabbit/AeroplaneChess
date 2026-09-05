import {animal,boardSVG,D} from './art.js';
import {coord} from '../js/board.js';
const NS='http://www.w3.org/2000/svg';
export function mount({host,state,life,choose}) {
  host.innerHTML=boardSVG();const svg=host.querySelector('svg');svg.classList.add('cartoon-board');
  svg.querySelectorAll('[data-base-label]').forEach(label=>{if(!state.players.some(p=>p.seat===+label.dataset.baseLabel))label.textContent=['红方','绿方','黄方','蓝方'][+label.dataset.baseLabel]+' · 已关闭';});
  const layer=document.createElementNS(NS,'g');svg.append(layer);
  const target=document.createElementNS(NS,'circle');target.setAttribute('r','17');target.setAttribute('fill','none');target.setAttribute('stroke','#293b51');target.setAttribute('stroke-width','3');target.setAttribute('stroke-dasharray','4 3');target.style.display='none';layer.append(target);
  const items=new Map(),key=(s,id)=>s+':'+id;
  state.players.forEach(p=>p.pieces.forEach(pc=>{
    const g=document.createElementNS(NS,'g');g.setAttribute('role','button');g.setAttribute('tabindex','-1');g.dataset.seat=p.seat;g.dataset.piece=pc.id;
    g.setAttribute('aria-label',`${['红方小兔','绿方青蛙','黄方小猫','蓝方企鹅'][p.seat]} ${pc.id+1}号`);
    // All visual and hit shapes share the same group transform and foot anchor.
    g.innerHTML=`<circle class="piece-ring" r="18" fill="#fffdf6" stroke="${D[p.seat]}" stroke-width="2"/>${animal(p.seat,0,0,.57,pc.id+1)}<circle r="19" fill="transparent"/>`;
    layer.append(g);const item={g,x:0,y:0};items.set(key(p.seat,pc.id),item);
    life.listen(g,'click',()=>{if(g.classList.contains('pickable'))choose(pc.id);});
    life.listen(g,'keydown',e=>{if((e.key==='Enter'||e.key===' ')&&g.classList.contains('pickable')){e.preventDefault();choose(pc.id);}});
    life.listen(g,'pointerenter',()=>preview(pc.id));life.listen(g,'pointerleave',()=>target.style.display='none');
    life.listen(g,'focus',()=>preview(pc.id));life.listen(g,'blur',()=>target.style.display='none');
  }));
  function preview(id){
    if(state.phase!=='choosing')return;
    const p=state.players[state.turn],mv=state.pickable.find(m=>m.pc.id===id);if(!mv)return;
    const [x,y]=point(coord(p.seat,mv.to));target.setAttribute('cx',x);target.setAttribute('cy',y);target.style.display='';
  }
  const point=c=>c.map(v=>v*40+20);
  function place(item,x,y,scale=1){item.x=x;item.y=y;item.g.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);}
  function sync(){
    const stacks=new Map();
    state.players.forEach(p=>p.pieces.forEach(pc=>{
      const it=items.get(key(p.seat,pc.id));it.g.style.display=pc.st==='done'?'none':'';it.g.classList.toggle('in-base',pc.st==='base');it.g.querySelector('.animal').setAttribute('transform',`scale(${pc.st==='base'?.9:.68})`);
      const [x,y]=point(coord(p.seat,pc.prog,pc.slot));place(it,x,y);
      if(pc.st==='home'||pc.st==='track'){const k=x+','+y;if(!stacks.has(k))stacks.set(k,[]);stacks.get(k).push(it);}
    }));
    stacks.forEach(arr=>{if(arr.length>1)arr.forEach((it,i)=>{
      const offsets=arr.length===2?[[-8,0],[8,0]]:[[-8,-8],[8,-8],[-8,8],[8,8]];
      const [dx,dy]=offsets[i];place(it,it.x+dx,it.y+dy,arr.length===2?.78:.68);
    });});
  }
  function choices(moves){
    target.style.display='none';const seat=state.players[state.turn].seat;
    items.forEach((it,k)=>{const on=k.startsWith(seat+':')&&moves.some(m=>k===key(seat,m.pc.id));it.g.classList.toggle('pickable',on);it.g.setAttribute('tabindex',on&&state.players[state.turn].type==='human'?'0':'-1');});
  }
  async function travel(t,style='return'){
    const it=items.get(key(t.seat,t.id)),[tx,ty]=point(t.to),fx=it.x,fy=it.y,cross=style.startsWith('cross');
    // The logical anchor stays at the cell centre; the animal alone rises above its shadow.
    const face=it.g.querySelector('.animal');
    await life.tween(cross?380:style==='hop'?125:420,k=>{
      const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;place(it,fx+(tx-fx)*e,fy+(ty-fy)*e);
      const height=cross?(style==='crossUp'?Math.sin(e*Math.PI/2):Math.cos(e*Math.PI/2))*23:Math.sin(e*Math.PI)*8;
      face.setAttribute('transform',`translate(0 ${-height}) scale(.68)`);
    });
  }
  async function animate(stage){
    if(stage.type==='travel')await travel(stage,stage.style);
    if(stage.type==='hit')await Promise.all(stage.targets.map(t=>travel(t)));
    if(stage.type==='finish')items.get(key(stage.seat,stage.id)).g.style.display='none';
  }
  sync();return {sync,choices,animate,roll:()=>life.wait(700),dispose(){host.replaceChildren();items.clear();}};
}
