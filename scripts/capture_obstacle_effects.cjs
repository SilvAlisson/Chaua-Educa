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
    await page.waitForFunction(() => document.querySelector('#asset-status')?.hidden === true);

    await page.locator('#inputPlayer').fill('Polimento Obstaculos');
    await page.locator('#btnStart:not([disabled])').click();
    await page.waitForSelector('#app.in-flight');

    // 1. Setup in-flight state with an obstacle entering from the right
    await model(page, g => {
        g.state = 'playing';
        g.countdown = 0;
        g.entities = [
            { id: 10, kind: 'wood', x: 650, top: 180, bottom: 420, variant: 'plain' },
            { id: 11, kind: 'fruit', x: 650, y: 300, variety: 1 }
        ];
        g.y = 300;
        g.vy = 0;
    });
    await page.waitForTimeout(200);
    const enterBuf = await page.screenshot();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_obstacles_smooth_entry.png'), enterBuf);
    console.log('Saved gameplay_obstacles_smooth_entry.png');

    // 2. Shield hitting wood: trunk shaking and leaves bursting
    await model(page, g => {
        g.shield = true;
        const wood = { id: 20, kind: 'wood', x: g.x + 10, top: 220, bottom: 460, variant: 'plain', hitSide: 'top' };
        g.entities = [wood];
        g.collide(wood);
    });
    await page.waitForTimeout(100);
    const woodShieldBuf = await page.screenshot();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_shield_wood_leaves.png'), woodShieldBuf);
    console.log('Saved gameplay_shield_wood_leaves.png');

    // 3. Shield hitting snake: snake recoiling and dazed stars
    await model(page, g => {
        g.shield = true;
        const snakeWood = {
            id: 30, kind: 'wood', x: g.x + 10, top: 160, bottom: 360, variant: 'plain',
            snake: { y: 395, retreat: false, phase: 'occupied' }
        };
        g.entities = [snakeWood];
        g.collide(snakeWood.snake, true, snakeWood);
        snakeWood.snake.retreatTime = 0.25; // mid recoil with stars
    });
    await page.waitForTimeout(100);
    const snakeShieldBuf = await page.screenshot();
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'gameplay_shield_snake_retreat.png'), snakeShieldBuf);
    console.log('Saved gameplay_shield_snake_retreat.png');

    await browser.close();
    console.log('All obstacle screenshots captured successfully!');
})();
