const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/aliss/.gemini/antigravity/brain/ed57b9d7-6392-4a2f-9a94-60455156b763';

async function model(page, callback) {
    return page.evaluate(async source => {
        const { game } = await import('/js/script.js');
        return Function('game', `return (${source})(game)`)(game);
    }, callback.toString());
}

(async () => {
    const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto('http://127.0.0.1:5501/index.html');
    await page.waitForSelector('#inputPlayer');

    // Wait until assets finish loading
    await page.waitForFunction(() => document.querySelector('#asset-status')?.hidden === true);

    // 1. Enter player name and start game
    await page.locator('#inputPlayer').fill('Chauá Animações');
    await page.locator('#btnStart:not([disabled])').click();
    await page.waitForSelector('#app.in-flight');

    // Skip countdown to playing
    await model(page, g => {
        g.state = 'playing';
        g.countdown = 0;
        g.entities = [];
    });
    await page.waitForTimeout(100);

    // 2. Capture Turbo Pimenta mode
    await model(page, g => {
        g.pepper = 4.0;
        g.y = 300;
        g.wing = 0.5;
        g.flapImpulse = 0.4;
    });
    await page.waitForTimeout(200);
    const turboBuf = await page.screenshot({ clip: { x: 50, y: 150, width: 500, height: 350 } });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_chaua_turbo.png'), turboBuf);
    console.log('Saved gameplay_chaua_turbo.png');

    // 3. Capture Fruit Eating Joy mode (squint happy eye, musical note ♪, sparkles ✨)
    await model(page, g => {
        g.pepper = 0;
        g.y = 300;
        g.wing = 0.8;
        g.collectPulse = 0.24; // active munch reaction!
    });
    await page.waitForTimeout(40);
    const eatingBuf = await page.screenshot({ clip: { x: 50, y: 150, width: 500, height: 350 } });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_chaua_eating.png'), eatingBuf);
    console.log('Saved gameplay_chaua_eating.png');

    // 4. Capture Low Stamina Fatigue mode (sweat drops 💧, heavy panting)
    await model(page, g => {
        g.collectPulse = 0;
        g.stamina = 0.10; // exhausted!
        g.y = 300;
        g.wing = 0.2;
    });
    await page.waitForTimeout(150);
    const fatigueBuf = await page.screenshot({ clip: { x: 50, y: 150, width: 500, height: 350 } });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_chaua_fatigue.png'), fatigueBuf);
    console.log('Saved gameplay_chaua_fatigue.png');

    // 5. Capture Defeat / Knockout with spiral eyes and orbiting stars
    await model(page, g => {
        g.stamina = 1;
        g.state = 'impact';
        g.impactRemaining = 0.22; // mid impact tumble
        g.won = false;
        g.y = 300;
    });
    await page.waitForTimeout(100);
    const defeatBuf = await page.screenshot({ clip: { x: 50, y: 150, width: 500, height: 350 } });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_chaua_defeat.png'), defeatBuf);
    console.log('Saved gameplay_chaua_defeat.png');

    await browser.close();
    console.log('All screenshots captured successfully!');
})();
