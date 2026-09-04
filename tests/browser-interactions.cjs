// Focused real-time renderer and independent stacked-selection checks.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});try{const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8107')+'/?theme=acrylic&t=h,h,h,h&test=1&auto=1');await page.waitForFunction(()=>document.querySelector('#loading').hidden);await page.waitForTimeout(700);await page.locator('#rollButton').click();await page.waitForSelector('#pickPanel button');await page.mouse.click(910,600);await page.waitForTimeout(800);assert.equal(await page.locator('.player').first().locator('.state-pips .track').count(),1);console.log('3D raycast click passed');
await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:8107')+'/');
await page.evaluate(async()=>{
 const {createState,Game}=await import('/js/game.js'),{Lifetime}=await import('/js/lifetime.js'),{rulesFor}=await import('/js/rules.js'),{mount}=await import('/themes/cartoon.js');
 const state=createState({types:['off','human','off','ai'],levels:[2,2,2,1],test:false});state.players[0].pieces.forEach(pc=>{pc.st='track';pc.prog=7;});state.phase='choosing';state.dice=2;state.pickable=rulesFor(state).legalMoves(state.players[0],2);
 const host=document.querySelector('#sceneHost');document.querySelector('#home').hidden=true;document.querySelector('#game').hidden=false;document.body.dataset.theme='cartoon';document.body.dataset.page='game';
 const life=new Lifetime();const view=mount({host,state,life,choose:id=>{window.chosen=id;}});view.choices(state.pickable);window.stackTest={state,life,view};
});
for(let id=0;id<4;id++){await page.locator(`.cartoon-board [data-piece="${id}"][data-seat="1"]`).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.chosen),id);}
await page.screenshot({path:require('node:path').resolve('docs/theme-validation/stack-selection-1280.png')});
const summary=await page.evaluate(async()=>{
 window.stackTest.life.dispose();window.stackTest.view.dispose();
 const {createState,planMove,commitStage}=await import('/js/game.js'),{rulesFor}=await import('/js/rules.js'),{Lifetime}=await import('/js/lifetime.js');const results=[];
 for(const theme of ['cartoon','acrylic']){
  const state=createState({types:['human','human','human','human'],levels:[2,2,2,2],test:false});
  const set=(seat,id,prog)=>Object.assign(state.players[seat].pieces[id],{prog,st:prog>=51?'home':'track'});
  set(0,0,13);set(1,0,1);set(1,1,5);set(1,2,17);set(2,0,54);
  const {mount}=await import('/themes/'+theme+'.js');document.body.dataset.theme=theme;
  const host=document.querySelector('#sceneHost'),life=new Lifetime(),view=mount({host,state,life,choose(){}});
  const stages=planMove(state,state.players[0],rulesFor(state).legalMoves(state.players[0],1).find(m=>m.pc.id===0));
  for(const stage of stages){commitStage(state,stage);await view.animate(stage);}view.sync();results.push(JSON.stringify(state));life.dispose();view.dispose();
 }
 return results;
});assert.equal(summary[0],summary[1]);assert.deepEqual(errors,[]);console.log('4 independent stacked selections and real-time boost/cross/collision animations passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
