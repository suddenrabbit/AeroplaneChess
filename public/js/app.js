import {themes,message,moveLabel} from '../themes/catalog.js';
import {portrait,boardSVG} from '../themes/art.js';
import {defaults,parseConfig,routeTheme,configQuery} from './config.js';
import {Lifetime} from './lifetime.js';
import {createState,Game} from './game.js';

const $=id=>document.getElementById(id);
let cfg=defaults(),themeId=null,session=null,game=null,view=null;
let index=Number(history.state?.rabbitIndex)||0,restorePop=false;
history.replaceState({rabbitIndex:index},'',location.href);
const playing=()=>session&&!session.signal.aborted&&game&&!['over','error'].includes(game.state.phase);
const confirmLeave=()=>!playing()||confirm('离开将结束当前对局，进度不会保存。确定继续吗？');
function setURL(url,replace=false){if(!replace)index++;history[replace?'replaceState':'pushState']({rabbitIndex:index},'',url);}
function stop(){
  session?.dispose();session=null;view?.dispose();view=null;game=null;
  $('loading').hidden=true;$('result').close();$('sceneHost').replaceChildren();
}
function page(name){
  document.body.dataset.page=name;document.body.dataset.theme=themeId||'';
  for(const id of ['home','setup','game'])$(id).hidden=id!==name;
  $('homeButton').hidden=name==='home';$('themeTag').textContent=themeId?themes[themeId].name:'一起玩一局';
  document.title='RabbitPlaneChess';
}
function urlForSetup(){return '/?'+configQuery(themeId,cfg);}
function navigateHome(){if(!confirmLeave())return;stop();themeId=null;setURL('/');page('home');$('routeMessage').textContent='';}
function navigateSetup(){if(!confirmLeave())return;stop();setURL(urlForSetup());showSetup();}
function selectTheme(id){stop();themeId=id;setURL(urlForSetup());showSetup();}
function showSetup(){
  page('setup');const t=themes[themeId];$('setupTheme').textContent=t.name;
  $('rulesText').textContent=`掷 6 才能${t.launch} · 正常落本色格额外 +4 · ${t.flight} · 超过终点先到达再折返。TEST MODE 仅将开局首次掷骰固定为 6。`;
  renderSeats();
}
function icon(seat){return themeId==='cartoon'?portrait(seat):`<span class="seat-icon" style="color:${themes[themeId].colors[seat]}">✈</span>`;}
function renderSeats(){
  const t=themes[themeId];$('seats').innerHTML=[0,1,2,3].map(s=>{
    const mode=cfg.types[s]==='ai'?'ai'+cfg.levels[s]:cfg.types[s];
    return `<div class="seatrow ${mode==='off'?'off':''}">${icon(s)}<strong>${t.names[s]}</strong><div class="modes" role="group" aria-label="${t.names[s]}座位">${[['human','人类'],['ai1','简单电脑'],['ai2','聪明电脑'],['off','关闭']].map(([v,label])=>`<button data-seat="${s}" data-mode="${v}" class="${v===mode?'selected':''}" aria-pressed="${v===mode}">${label}</button>`).join('')}</div></div>`;
  }).join('');
  $('seats').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const s=+b.dataset.seat,m=b.dataset.mode;cfg.types[s]=m.startsWith('ai')?'ai':m;if(m.startsWith('ai'))cfg.levels[s]=+m.slice(-1);
    setURL(urlForSetup(),true);renderSeats();
  });
  const count=cfg.types.filter(t=>t!=='off').length;$('setupCount').textContent=count<2?'请至少开启两种颜色才能开始游戏':`已开启 ${count} 方`;
  $('setupCount').classList.toggle('error',count<2);$('startButton').disabled=count<2;
  $('testButton').textContent='TEST 首掷必为 6：'+(cfg.test?'开':'关');$('testButton').setAttribute('aria-pressed',cfg.test);
}
$('testButton').onclick=()=>{cfg.test=!cfg.test;setURL(urlForSetup(),true);renderSeats();};
$('themeCards').innerHTML=Object.entries(themes).map(([id,t],i)=>`<button class="card" data-theme="${id}"><div class="preview">${id==='acrylic'?'<img src="./previews/acrylic.png" alt="太空背景下的亚克力棋盘与飞机">':boardSVG(true)+'<div class="characters">'+[0,1,2,3].map(portrait).join('')+'</div>'}</div><div class="cardcopy"><h2>${t.name}<span>0${i+1} / ${i?'PICNIC':'SPACE'}</span></h2><p>${t.subtitle}</p><div class="action">选择 ${t.name}<span>设置座位 →</span></div></div></button>`).join('');
$('themeCards').querySelectorAll('button').forEach(b=>b.onclick=()=>selectTheme(b.dataset.theme));

function diceSVG(value){
  const points={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
  return `<svg viewBox="-32 -32 64 64" aria-hidden="true">${points[value].map(([x,y])=>`<circle cx="${x*14}" cy="${y*14}" r="4.5" fill="#354259"/>`).join('')}</svg>`;
}
function update(){
  if(!game)return;const g=game.state,t=themes[themeId],p=g.players[g.turn];
  $('players').innerHTML=g.players.map((player,i)=>`<div class="player ${i===g.turn&&g.phase!=='over'?'current':''}" style="--seat:${t.colors[player.seat]}">${icon(player.seat)}<div><strong>${t.names[player.seat]}</strong><small>${player.type==='human'?'人类':player.level===1?'简单电脑':'聪明电脑'}${player.rank?' · 第 '+player.rank+' 名':''}</small><div class="progress">抵达 ${player.done}/4</div><div class="state-pips">${player.pieces.map(pc=>`<i class="${pc.st}" title="${t.piece} ${pc.id+1}：${pc.st==='base'?t.base:pc.st==='home'?t.lane:pc.st==='done'?'已抵达':'共享航道'}"></i>`).join('')}</div></div></div>`).join('');
  $('turnType').textContent=p.type==='human'?'轮到你了':p.level===1?'简单电脑':'聪明电脑';$('turnText').textContent=t.names[p.seat]+'的回合';
  $('rollButton').disabled=g.phase!=='idle'||p.type!=='human';
  $('diceFace').classList.toggle('rolling',g.phase==='rolling');
  $('diceFace').innerHTML=g.phase==='rolling'?'…':g.dice?diceSVG(g.dice):'—';$('diceFace').setAttribute('aria-label',g.phase==='rolling'?'正在掷骰':g.dice?`骰子 ${g.dice} 点`:'尚未掷骰');
  $('pickPanel').style.setProperty('--seat',t.colors[p.seat]);
  $('pickPanel').innerHTML=g.phase==='choosing'&&p.type==='human'?g.pickable.map(m=>`<button data-piece="${m.pc.id}" title="${t.piece} ${m.pc.id+1}：${moveLabel(t,m)}" aria-label="${t.piece} ${m.pc.id+1}：${moveLabel(t,m)}">${m.pc.id+1}</button>`).join(''):'';
  $('pickPanel').querySelectorAll('button').forEach(b=>b.onclick=()=>game?.choose(+b.dataset.piece));
  if(g.phase==='over'){
    const order=[...g.players].sort((a,b)=>a.rank-b.rank);$('winner').textContent=t.names[order[0].seat]+'获胜！';
    $('ranking').innerHTML=order.map(p=>`<div class="ranking-row"><strong>第 ${p.rank} 名 · ${t.names[p.seat]}</strong><span>抵达 ${p.done}/4</span></div>`).join('');
    if(!$('result').open)$('result').showModal();
  }
}
async function start({auto=false,replace=false}={}){
  if(cfg.types.filter(t=>t!=='off').length<2){showSetup();return;}
  stop();const life=new Lifetime();session=life;const id=themeId,t=themes[id];
  const q=configQuery(id,cfg);if(auto)q.set('auto','1');setURL('/?'+q+'#play',replace);
  page('game');$('loading').hidden=false;$('players').replaceChildren();$('hint').textContent='';$('pickPanel').replaceChildren();
  $('viewControls').hidden=id!=='acrylic';$('tipText').textContent=`掷 6 才能${t.launch}。正常行走停在本色格，额外前进 4 格。`;
  $('viewControls').querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.view==='tilt');if(b.dataset.view==='follow')b.textContent='跟随：关';});
  try {
    const module=await t.load();life.check();
    const state=createState(cfg);view=module.mount({host:$('sceneHost'),state,life,choose:id=>game?.choose(id)});life.check();
    game=new Game({state,life,view,update,notice:(key,args)=>{if(!life.signal.aborted)$('hint').textContent=message(t,key,args);}});
    $('loading').hidden=true;update();game.start();
  } catch(e){if(e.name==='AbortError')return;console.error(e);stop();themeId=id;setURL(urlForSetup(),true);showSetup();$('setupCount').textContent='棋盘加载失败，请重试。';$('setupCount').classList.add('error');}
}
$('startButton').onclick=()=>start();$('rollButton').onclick=()=>{if(game)game.run(game.roll());};
for(const id of ['homeButton','resultHome'])$(id).onclick=navigateHome;
$('brandHome').onclick=e=>{e.preventDefault();navigateHome();};
for(const id of ['backSetup','resultSetup','cancelLoad'])$(id).onclick=navigateSetup;
for(const id of ['restartButton','againButton'])$(id).onclick=()=>{if(confirmLeave())start();};
$('result').addEventListener('cancel',e=>{e.preventDefault();navigateSetup();});
$('viewControls').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  const follows=view?.camera?.(b.dataset.view);$('viewControls').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b&&(b.dataset.view!=='follow'||follows)));
  $('viewControls').querySelector('[data-view=follow]').textContent='跟随：'+(follows?'开':'关');
});
function loadRoute(initial=false){
  stop();const q=new URLSearchParams(location.search),id=routeTheme(q);cfg=parseConfig(q);themeId=id==='invalid'?null:id;
  if(!themeId){page('home');$('routeMessage').textContent=id==='invalid'?'该主题不可用，请重新选择。':'';if(id==='invalid'||location.hash)setURL('/',true);return;}
  showSetup();
  if(initial&&q.get('auto')==='1'&&cfg.types.filter(t=>t!=='off').length>=2)start({auto:true,replace:true});
  else {const stale=location.hash==='#play';setURL(urlForSetup(),true);if(stale)$('setupCount').textContent='上次对局已结束，请重新开始。';}
}
addEventListener('popstate',e=>{
  const target=Number(e.state?.rabbitIndex);
  if(restorePop){restorePop=false;return;}
  if(!confirmLeave()){
    const delta=index-(Number.isFinite(target)?target:index-1);restorePop=true;history.go(delta||1);return;
  }
  index=Number.isFinite(target)?target:index-1;loadRoute();
});
addEventListener('beforeunload',e=>{if(playing()){e.preventDefault();e.returnValue='';}});
addEventListener('pagehide',()=>stop());
addEventListener('pageshow',e=>{if(e.persisted)loadRoute();});
loadRoute(true);
