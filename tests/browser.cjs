// Run against a local static server. PLAYWRIGHT_MODULE may point to an existing installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8107';
const out=path.resolve('docs/theme-validation');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:810},deviceScaleFactor:1});
 const errors=[],requests=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)bad.push(r.url()+':'+r.status());});
 const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
 const goto=async url=>{await page.goto(base+url);await page.waitForTimeout(100);};
 const dialogOnce=accept=>page.once('dialog',d=>accept?d.accept():d.dismiss());
 for(const [w,h] of [[1280,720],[1440,810]]){
  await page.setViewportSize({width:w,height:h});await goto('/');await shot('home-'+w);
  assert.equal(await page.locator('canvas').count(),0);assert.ok(!requests.some(u=>u.includes('three.module')));
  for(const theme of ['cartoon','acrylic']){
   await page.locator(`.card[data-theme=${theme}]`).click();await shot('setup-'+theme+'-'+w);
   const end=await page.locator('#rulesText').boundingBox();assert.ok(end.y+end.height<=h,`setup ${theme} fits ${w}`);
   assert.equal(await page.locator('canvas').count(),0);
   await page.locator('#seats button[data-seat="3"][data-mode=human]').click();
   if(await page.locator('#testButton').getAttribute('aria-pressed')!=='true')await page.locator('#testButton').click();await page.locator('#startButton').click();await page.waitForFunction(()=>document.querySelector('#loading').hidden);await page.waitForTimeout(theme==='acrylic'?700:80);
   await shot(theme+'-'+w);
   assert.equal(await page.locator('#viewControls').isVisible(),theme==='acrylic');
   if(theme==='cartoon'){
    assert.equal(await page.locator('.cartoon-board [data-piece]').count(),16);
    const b=await page.locator('.cartoon-board').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=w&&b.y+b.height<=h);
    const a=await page.locator('#restartButton').boundingBox();assert.ok(a.y+a.height<h);
   }
   await page.locator('#rollButton').click();await page.waitForSelector('#pickPanel button');assert.equal(await page.locator('#pickPanel button').count(),4);
   // Board hit testing, not only fallback controls.
   if(theme==='cartoon')await page.locator('.cartoon-board [data-seat="0"][data-piece="0"]').click();
   else await page.locator('#pickPanel button').first().click();
   await page.waitForTimeout(800);assert.equal(await page.locator('.player').first().locator('.state-pips .track').count(),1);
   dialogOnce(false);await page.locator('#homeButton').click();assert.equal(await page.locator('#game').evaluate(e=>!e.hidden),true);
   dialogOnce(true);await page.locator('#homeButton').click();assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.locator('.cartoon-board').count(),0);
   await page.waitForTimeout(1000);assert.equal(await page.locator('#home').isVisible(),true);
  }
  // Reset network inventory before checking a fresh home; previous 3D load is expected.
  requests.length=0;
 }
 // Legacy route and explicit auto behavior.
 await goto('/?t=o,h,o,a&l=2,2,2,1&test=1');assert.equal(await page.locator('body').getAttribute('data-theme'),'acrylic');
 assert.equal(await page.locator('#seats .off').count(),2);await page.locator('#startButton').click();await page.waitForFunction(()=>document.querySelector('#loading').hidden);
 assert.equal(await page.locator('.player').count(),2);assert.match(await page.locator('#turnText').textContent(),/绿方/);
 dialogOnce(true);await page.locator('#backSetup').click();await page.locator('#homeButton').click();
 await goto('/?theme=cartoon&t=h,h,o,o');await page.locator('#startButton').click();await page.waitForSelector('.cartoon-board');
 dialogOnce(true);await page.reload();await page.waitForSelector('#setup:not([hidden])');assert.ok(!page.url().includes('#play'));
 // Back/forward, cancel restores active match without stopping it.
 await page.locator('#homeButton').click();await page.locator('.card[data-theme=cartoon]').click();await page.locator('#startButton').click();await page.waitForSelector('.cartoon-board');
 dialogOnce(false);await page.goBack();await page.waitForTimeout(150);assert.ok(page.url().includes('#play'));assert.equal(await page.locator('#game').evaluate(e=>!e.hidden),true);
 dialogOnce(true);await page.goBack();await page.waitForSelector('#setup:not([hidden])');await page.goForward();await page.waitForTimeout(150);assert.equal(await page.locator('#setup').isVisible(),true);assert.ok(!page.url().includes('#play'));
 // Exit during pending AI; no continuation can change the following home or match.
 await goto('/?theme=cartoon&t=a,a,o,o&auto=1');await page.waitForSelector('.cartoon-board');dialogOnce(true);await page.locator('#homeButton').click();await page.waitForTimeout(1400);assert.equal(await page.locator('#home').isVisible(),true);
 // Rapid repeated entry, restart, resize and 3D view controls.
 for(const theme of ['acrylic','cartoon','acrylic','cartoon']){
  await page.locator(`.card[data-theme=${theme}]`).click();await page.locator('#seats button[data-seat="0"][data-mode=human]').click();await page.locator('#startButton').click();await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  await page.setViewportSize({width:1280,height:720});await page.setViewportSize({width:1440,height:810});
  if(theme==='acrylic'){for(const v of ['top','follow','tilt'])await page.locator(`[data-view=${v}]`).click();}
  dialogOnce(true);await page.locator('#restartButton').click();await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  assert.equal(await page.locator(theme==='acrylic'?'canvas#scene':'.cartoon-board').count(),1);
  dialogOnce(true);await page.locator('#homeButton').click();
 }
 await goto('/?theme=not-real');assert.equal(await page.locator('#home').isVisible(),true);assert.match(await page.locator('#routeMessage').textContent(),/不可用/);
 // High-DPI SVG/CSS sizing; 3D uses an independent render buffer.
 const retina=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});retina.on('pageerror',e=>errors.push(e.message));
 await retina.goto(base+'/?theme=cartoon&t=h,h,h,h&auto=1');await retina.waitForSelector('.cartoon-board');await retina.screenshot({path:path.join(out,'cartoon-dpr2.png')});
 await retina.goto(base+'/?theme=acrylic&t=h,h,h,h&auto=1');await retina.waitForFunction(()=>document.querySelector('#loading').hidden);assert.deepEqual(await retina.locator('#scene').evaluate(c=>[c.clientWidth,c.clientHeight,c.width,c.height]),[1280,720,2560,1440]);await retina.close();
 // Real renderers consume the same stages and complete an entire seeded AI game.
 await goto('/');
 const results=await page.evaluate(async()=>{
  const {createState,planMove,commitStage,Game}=await import('/js/game.js');const {rulesFor}=await import('/js/rules.js');const {Lifetime}=await import('/js/lifetime.js');
  const outputs=[];
  for(const theme of ['cartoon','acrylic']){
   const {mount}=await import('/themes/'+theme+'.js');const life=new Lifetime();
   // Accelerate presentation only; keep actual stage and match controllers unchanged.
   life.tween=async(ms,fn)=>{life.check();fn(1);};life.wait=async()=>life.check();
   const state=createState({types:['ai','ai','ai','ai'],levels:[2,1,2,2],test:false});
   const host=document.createElement('div');document.body.append(host);let seed=123;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
   const renderer=mount({host,state,life,choose(){}});let updates=0;
   await new Promise((resolve,reject)=>{
    const g=new Game({state,life,view:renderer,random,notice(){},update(){if(++updates>120000)reject(Error('match failed to end'));if(state.phase==='over')resolve();}});g.start();
   });
   outputs.push({theme,state:JSON.parse(JSON.stringify(state))});life.dispose();renderer.dispose();host.remove();
  }
  return outputs;
 });
 assert.deepEqual(results[0].state,results[1].state);assert.equal(results[0].state.phase,'over');
 assert.deepEqual(results[0].state.players.map(p=>p.rank).sort(),[1,2,3,4]);
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({errors,bad,completedGame:results[0].state,checks:'two viewport sizes; routes; real input; cleanup; repeat entry; DPR2; complete seeded game in both renderers'},null,2));
 console.log('Browser checks passed; identical complete seeded games for SVG and Three.js.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
