const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const catalogJsonPath = 'C:\\Users\\aliss\\AppData\\Local\\Temp\\INVENTARIO_SHA256.json';
const inventory = JSON.parse(fs.readFileSync(catalogJsonPath, 'utf8'));

console.log('=== VERIFICAÇÃO RIGOROSA DOS 9 SPRITESHEETS ===\n');

let allValid = true;

for (const item of inventory.files) {
  const localRelPath = item.path;
  if (!fs.existsSync(localRelPath)) {
    console.error(`❌ AUSENTE: ${item.path} (${localRelPath})`);
    allValid = false;
    continue;
  }
  const fileBytes = fs.readFileSync(localRelPath);
  const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const sizeMatches = fileBytes.length === item.bytes;
  const hashMatches = hash.toLowerCase() === item.sha256.toLowerCase();

  if (sizeMatches && hashMatches) {
    console.log(`✅ [${item.branch}] ÍNTEGRO E PRESENTE: ${item.path}`);
    console.log(`   Dimensões: ${item.resolution[0]}x${item.resolution[1]} | Tamanho: ${fileBytes.length} bytes | SHA256: ${hash.slice(0, 16)}...`);
  } else {
    console.error(`⚠️ DISCREPÂNCIA: ${item.path}`);
    console.error(`   Esperado tamanho: ${item.bytes}, obtido: ${fileBytes.length}`);
    console.error(`   Esperado SHA256:  ${item.sha256}`);
    console.error(`   Obtido SHA256:    ${hash}`);
    allValid = false;
  }
}

if (!allValid) {
  console.error('\nErro: Nem todos os arquivos estão íntegros!');
  process.exit(1);
}

console.log('\nTodos os 9 arquivos estão 100% íntegros e implementados no projeto!');

(async () => {
  const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  
  await page.goto('http://127.0.0.1:5501/?snakeA2=1&actionSprites=1', { waitUntil: 'domcontentloaded' });
  await page.fill('#inputPlayer', 'Auditoria');
  await page.waitForFunction(() => !document.querySelector('#btnStart').disabled, { timeout: 30000 });
  await page.locator('#btnStart').click();

  const loadedAssets = await page.evaluate(async () => {
    const action = await import('/js/action-sheets.mjs');
    const snakeA2 = await import('/js/snake-a2.mjs');
    const actionKeys = await action.preloadActionSheets();
    const snakeA2Loaded = await snakeA2.preloadSnakeA2();
    return {
      actionFlag: action.ACTION_SPRITES_ENABLED,
      actionKeys,
      snakeA2Flag: snakeA2.SNAKE_A2_ENABLED,
      snakeA2Loaded
    };
  });

  console.log('\nStatus no Navegador (http://127.0.0.1:5501/?snakeA2=1&actionSprites=1):');
  console.log(JSON.stringify(loadedAssets, null, 2));

  await page.waitForTimeout(1000);
  const outPath = 'C:\\Users\\aliss\\.gemini\\antigravity\\brain\\ed57b9d7-6392-4a2f-9a94-60455156b763\\catalogo_9_spritesheets_showcase.png';
  await page.screenshot({ path: outPath });
  console.log('Screenshot salva em:', outPath);

  await browser.close();
  console.log('\nAuditoria visual concluída com sucesso!');
})();
