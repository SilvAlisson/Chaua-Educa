const assert = require('node:assert/strict');
const { existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const baseURL = process.env.GAME_URL || 'http://127.0.0.1:5501/';
const failures = [];
async function inspect(page) {
    page.on('pageerror', e => failures.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
}
async function model(page, callback) {
    return page.evaluate(async source => {
        const { game } = await import('/js/script.js');
        return Function('game', `return (${source})(game)`)(game);
    }, callback.toString());
}
async function playing(page) {
    await page.waitForFunction(() => document.querySelector('#app').dataset.state === 'playing', null, {timeout: 8000});
}
async function begin(page, name = 'Guardião da mata') {
    await page.locator('#inputPlayer').fill(name);
    await page.locator('#btnStart').click();
    await playing(page);
}
(async () => {
    const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : (existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined));
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        const context = await browser.newContext({ viewport: { width:1440, height:960 } });
        const page = await context.newPage(); await inspect(page);
        // Weighted poses must preserve opaque bodies on a transparent canvas.
        assert.equal(await page.evaluate(async()=>{
            const {drawBird}=await import('/js/render.mjs');
            const {images}=await import('/js/assets.mjs');
            const source=document.createElement('canvas');source.width=627;source.height=627;
            source.getContext('2d').fillRect(0,0,627,627);
            const image=new Image();image.src=source.toDataURL();await image.decode();
            const originals=[images.get('chaua-0'),images.get('chaua-2')];
            try {
                images.set('chaua-0',image);images.set('chaua-2',image);
                const canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;
                const context=canvas.getContext('2d');drawBird(context,{x:150,y:150,wing:.8});
                return context.getImageData(150,150,1,1).data[3];
            } finally {images.set('chaua-0',originals[0]);images.set('chaua-2',originals[1]);}
        }),255);
        // Optional practice works before entering a name and never records a ranked flight.
        await page.locator('#start-training:not([disabled])').click();
        await playing(page);
        await page.keyboard.down('Space');
        await page.waitForFunction(()=>document.querySelector('#stage-name').textContent.startsWith('2 ·'));
        await page.keyboard.up('Space');
        await page.keyboard.down('Space');
        await page.waitForFunction(()=>document.querySelector('#stage-name').textContent.startsWith('3 ·'));
        assert.equal(await model(page,g=>g.held),true);
        await page.keyboard.up('Space');
        await page.locator('#training-dialog').waitFor({state:'visible'});
        assert.equal(await model(page,g=>g.score),0);
        assert.equal(await page.evaluate(()=>localStorage.getItem('chaua-missions-v1')),null);
        await page.locator('#training-home').click();
        await page.locator('#home').waitFor({state:'visible'});
        assert.equal(await page.locator('#start-training').textContent(),'Repetir treino de voo');
        assert.equal(await page.locator('#inputPlayer').evaluate(el=>el===document.activeElement),true);
        console.log('PASS practice: real input, three lessons, no mission progress, return to home');
        await page.evaluate(() => localStorage.setItem('db-chaua', JSON.stringify([{playerName:'Pioneiro', score_val:777}])));
        assert.equal(await page.locator('#btnStart').isDisabled(), true);
        await page.locator('#inputPlayer').fill('   ');
        assert.equal(await page.locator('#btnStart').isDisabled(), true);
        await page.locator('#open-guide').click(); await page.locator('#guide-dialog').waitFor({state:'visible'});
        await page.keyboard.press('Escape'); assert.equal(await page.locator('#guide-dialog').isVisible(),false);
        await page.locator('#inputPlayer').fill('Guardião da mata');
        await page.locator('#btnStart').click();
        // Repeated submits during countdown cannot reset the run or its identity.
        assert.equal(await page.evaluate(async()=>{
            const {game}=await import('/js/script.js');
            const before=JSON.stringify([game.seed,game.countdown,game.mode,game.y]);
            for(let i=0;i<10;i++)document.querySelector('#start-form').dispatchEvent(new Event('submit',{cancelable:true}));
            return before===JSON.stringify([game.seed,game.countdown,game.mode,game.y]);
        }),true);
        await page.keyboard.down('Space');
        assert.equal(await model(page,g=>g.state),'countdown');
        assert.equal(await model(page,g=>g.held),true);
        await playing(page);
        assert.equal(await model(page,g=>g.held && g.vy < 0),true);
        await page.keyboard.up('Space');
        // Actual keyboard events, including release and glide.
        await page.keyboard.down('Space');
        assert.equal(await model(page,g=>g.held),true);
        await page.keyboard.up('Space');
        assert.equal(await model(page,g=>g.held),false);
        await model(page,g=>{g.y=300;g.vy=0;g.power('feather');g.power('shield');});
        await page.locator('#pause-button').click();
        const frozen = await model(page,g=>[g.y,g.feather,g.elapsed]);
        await page.waitForTimeout(350);
        assert.deepEqual(await model(page,g=>[g.y,g.feather,g.elapsed]), frozen);
        await page.keyboard.press('Escape'); await playing(page);
        // Collision through the real simulation and result through the real UI.
        await model(page,g=>{g.y=300;g.vy=0;g.entities=[{kind:'wood',x:g.x-10,top:350,bottom:550,variant:'plain'}];});
        await page.waitForFunction(()=>document.querySelector('#shield-status span').textContent === 'Sem escudo');
        assert.equal(await model(page,g=>g.entities[0].contacted && !g.entities[0].broken),true);
        await model(page,g=>{g.entities=[];g.y=300;g.vy=0;g.fruits=1;g.feather=2;g.collect({kind:'fruit',x:g.x,y:g.y});g.elapsed=g.nextQuizAt;g.maybeOpenQuiz();});
        await page.locator('#quiz-dialog').waitFor({state:'visible'});
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#quiz-dialog').isVisible(),true);
        assert.equal(await model(page,g=>g.state),'quiz');
        assert.equal(await page.locator('#quiz-continue').isVisible(),false);
        assert.match(await page.locator('#quiz-bonus').innerText(),/garantido/);
        const quizTime = await model(page,g=>g.feather); await page.waitForTimeout(250);
        assert.equal(await model(page,g=>g.feather),quizTime);
        const right = await model(page,g=>g.question.answer);
        await page.keyboard.press(right ? 'v' : 'f');
        assert.match(await page.locator('#answer-feedback').innerText(),/\+4/);
        const explanation=await page.locator('#answer-feedback').innerText();
        const answerScore=await model(page,g=>g.score);
        await page.keyboard.press(right ? 'v' : 'f');
        assert.equal(await page.locator('#answer-feedback').innerText(),explanation);
        assert.equal(await model(page,g=>g.score),answerScore);
        await page.locator('#quiz-continue').click(); await playing(page);
        await model(page,g=>{g.score=42;g.end(false,'Você encostou na cobra do galho.');});
        await page.locator('#result-dialog').waitFor({state:'visible'});
        assert.match(await page.locator('#result-reason').innerText(),/cobra/);
        await page.waitForTimeout(700); assert.equal(await page.locator('#result-score').innerText(),'42');
        await page.locator('#result-ranking').click();
        assert.match(await page.locator('#ranking-body').innerText(),/Guardião da mata/);
        await page.locator('[data-board=legacy]').click();
        assert.match(await page.locator('#ranking-body').innerText(),/Pioneiro/);
        await page.locator('[data-board=tranquilo]').click(); assert.equal(await page.locator('#ranking-empty').isVisible(),true);
        await page.keyboard.press('Escape'); await page.locator('#result-dialog').waitFor({state:'visible'});
        await page.locator('#restart-button').click(); await playing(page);
        assert.deepEqual(await model(page,g=>[g.score,g.feather,g.shield,g.fruits,g.correct]),[0,0,false,0,0]);
        // Victory is a separate presentation and never delays restart.
        await model(page,g=>{g.score=200;g.medal=true;g.distance=28000;g.entities=[];g.quizPending=false;g.refuge={x:330,y:320};g.y=320;g.vy=0;g.advanceJourney(1/120);});
        await page.locator('#result-dialog').waitFor({state:'visible'});
        assert.match(await page.locator('#result-title').innerText(),/celebra/);
        assert.equal(await page.locator('#restart-button').isEnabled(),true);
        await page.locator('#result-dialog .back-home').click();
        // Local record survives reload and the old record is untouched.
        await page.reload({waitUntil:'networkidle'});
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('db-chaua'))[0].score_val),777);
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('db-chaua-floresta-v4'))[0].score_val),200);
        console.log('PASS desktop: keyboard, pause, shield, quiz, multiplier, defeat, victory, immediate restart, isolated ranking, persistence');

        const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
        const touch = await mobile.newPage(); await inspect(touch);
        assert.equal(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await touch.locator('#inputPlayer').fill('Asas pequenas'); await touch.locator('input[value=tranquilo]').check();
        await touch.locator('#btnStart').tap(); await playing(touch);
        assert.equal(await model(touch,g=>g.mode),'tranquilo');
        assert.equal(await touch.locator('.power-bar').evaluate(bar=>[...bar.children].every(chip=>{
            const r=chip.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;
        })),true);
        const session = await mobile.newCDPSession(touch);
        const box = await touch.locator('#flap-button').boundingBox(), point={x:box.x+box.width/2,y:box.y+box.height/2};
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        assert.equal(await model(touch,g=>g.held),true);
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await model(touch,g=>g.held),false);
        // Canceled touch clears held state; no sticky automatic flight.
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        assert.equal(await model(touch,g=>g.held),false);
        await model(touch,g=>{g.y=300;g.vy=0;g.feather=7;});
        await touch.setViewportSize({width:844,height:390});
        await touch.locator('#pause-dialog').waitFor({state:'visible'});
        const rotated=await model(touch,g=>[g.y,g.feather,g.elapsed]);
        await touch.waitForTimeout(150);
        assert.deepEqual(await model(touch,g=>[g.y,g.feather,g.elapsed]),rotated);
        assert.equal(await model(touch,g=>g.held),false);
        await touch.setViewportSize({width:390,height:844});
        await touch.locator('#resume-button').tap();
        assert.equal(await model(touch,g=>g.state),'countdown');
        await playing(touch);
        await model(touch,g=>{g.y=300;g.vy=0;g.end(false,'Fim do teste de toque.');});
        await touch.locator('#result-dialog').waitFor({state:'visible'});
        await touch.locator('#result-dialog .back-home').tap();
        assert.equal(await touch.locator('#home-title span').evaluate(el=>getComputedStyle(el).animationName),'none');
        if (process.env.SCREENSHOT_DIR) {
            mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
            await touch.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'verified-mobile.png'),fullPage:true});
        }
        console.log('PASS touch: pointer hold/release/cancel, calm mode, responsive layout, reduced motion');
        // Tiny phones and small landscape windows must still expose the dialogs.
        for (const viewport of [{width:320,height:568},{width:844,height:390},{width:768,height:1024}]) {
            await touch.setViewportSize(viewport); await touch.locator('#open-guide').click();
            assert.equal(await touch.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            await touch.locator('#guide-dialog .primary').scrollIntoViewIfNeeded();
            await touch.locator('#guide-dialog .primary').click();
            if(viewport.width===320){
                await begin(touch,'Voo compacto');
                assert.equal(await touch.locator('.power-bar').evaluate(bar=>[...bar.children].every(chip=>{
                    const r=chip.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;
                })),true);
                assert.equal(await touch.locator('.orientation-hint').evaluate(hint=>hint.getBoundingClientRect().top>=document.querySelector('.power-bar').getBoundingClientRect().bottom),true);
                await touch.locator('#pause-button').tap();await touch.locator('#pause-dialog .back-home').tap();
            }
        }
        await touch.setViewportSize({width:844,height:390}); await begin(touch,'Voo de lado');
        const flapBounds=await touch.locator('#flap-button').boundingBox();
        assert.ok(flapBounds.y+flapBounds.height<=390 && flapBounds.x+flapBounds.width<=844);
        assert.equal(await touch.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
        await touch.locator('#pause-button').tap(); await touch.locator('#pause-dialog').waitFor({state:'visible'});
        console.log('PASS layout: 320×568, 390×844, 768×1024, 844×390, 1440×960');
        assert.deepEqual(failures, []);
        console.log('PASS no JavaScript errors or failed HTTP resources');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
