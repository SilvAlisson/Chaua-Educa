const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const artifactDir = 'C:\\Users\\aliss\\.gemini\\antigravity\\brain\\ed57b9d7-6392-4a2f-9a94-60455156b763';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
  
  // 1. Capture snake strike facing left towards Chaua
  await page.goto('http://127.0.0.1:5501/?snakeA2=1', { waitUntil: 'domcontentloaded' });
  await page.fill('#inputPlayer', 'Polimento');
  await page.waitForFunction(() => !document.querySelector('#btnStart').disabled);
  await page.click('#btnStart');
  
  await page.evaluate(async () => {
    const { game } = await import('/js/script.js');
    game.tick = () => {};
    game.state = 'playing';
    game.x = 220; game.y = 280;
    game.entities = [{
      id: 1, kind: 'wood', x: 440, top: 80, bottom: 440, variant: 'plain',
      snake: { kind: 'snake', phase: 'striking', phaseAge: 0.12, attackStarted: true, age: 2 }
    }, {
      id: 2, kind: 'fruit', x: 440 + 15, y: 190, variety: 1
    }];
    game.snapshot();
  });
  
  await page.waitForTimeout(300);
  const strikePath = path.join(artifactDir, 'polimento_cobra_bote_para_o_papagaio.png');
  await page.screenshot({ path: strikePath });
  console.log('Saved strike showcase to:', strikePath);

  // 2. Capture snake stunned state with dazed wobble
  await page.evaluate(async () => {
    const { game } = await import('/js/script.js');
    game.entities = [{
      id: 1, kind: 'wood', x: 440, top: 80, bottom: 440, variant: 'plain',
      snake: { kind: 'snake', phase: 'retreat', retreat: true, dazed: true, retreatTime: 1.1, age: 3 }
    }];
    game.snapshot();
  });

  await page.waitForTimeout(300);
  const stunnedPath = path.join(artifactDir, 'polimento_cobra_atordoada_prolongada.png');
  await page.screenshot({ path: stunnedPath });
  console.log('Saved stunned showcase to:', stunnedPath);

  // 3. Capture in-flight gameplay with fruit safely above snake
  await page.evaluate(async () => {
    const { game } = await import('/js/script.js');
    game.entities = [{
      id: 1, kind: 'wood', x: 460, top: 70, bottom: 450, variant: 'branch',
      snake: { kind: 'snake', phase: 'warning', warningAge: 0.6, age: 2 }
    }, {
      id: 2, kind: 'fruit', x: 475, y: 180, variety: 2
    }, {
      id: 3, kind: 'feather', x: 350, y: 180
    }];
    game.snapshot();
  });

  await page.waitForTimeout(300);
  const fruitPath = path.join(artifactDir, 'polimento_fruta_acima_da_cobra.png');
  await page.screenshot({ path: fruitPath });
  console.log('Saved fruit clearance showcase to:', fruitPath);

  await browser.close();
  console.log('All polish screenshots captured successfully!');
})();
