import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const workflows=['ci.yml','generate-winter-sprites.yml','qa-diagnostics.yml','qa-extended.yml'];
const workflowFiles=fs.readdirSync(new URL('.github/workflows/',root)).filter(n=>n.endsWith('.yml')||n.endsWith('.yaml')).sort();
const workflowSource=workflows.map(n=>read('.github/workflows/'+n)).join('\n');
const packageScripts=Object.values(JSON.parse(read('package.json')).scripts).join('\n');

const directRefs=source=>new Set([...source.matchAll(/(?:\bnode(?:\s+--(?:test|check))?|\bpython(?:3)?)\s+((?:tests|scripts)\/[\w./-]+\.(?:cjs|mjs|js|py))/g)].map(match=>match[1]));

test('exactly one canonical CI, one extended browser QA and manual diagnostics/art preview exist',()=>{
 assert.deepEqual(workflowFiles,workflows.sort());
 assert.match(read('.github/workflows/ci.yml'),/pull_request:/);
 assert.match(read('.github/workflows/ci.yml'),/branches: \[main\]/);
 assert.match(read('.github/workflows/qa-extended.yml'),/pull_request:/);
 assert.match(read('.github/workflows/qa-extended.yml'),/chromium firefox webkit/);
 assert.match(read('.github/workflows/qa-diagnostics.yml'),/workflow_dispatch:/);
 assert.match(read('.github/workflows/generate-winter-sprites.yml'),/workflow_dispatch:/);
});

test('no legacy branch-specific auto triggers or workflows with write access to artwork',()=>{
 for(const name of workflows){
  const content=read('.github/workflows/'+name);
  assert.doesNotMatch(content,/(?:perf\/|feat\/|audit\/(?:climate|chaua)|2026110[0-9])/,
   `${name} still targets a historical experiment branch`);
  assert.doesNotMatch(content,/contents:\s*write|git\s+push\b|git\s+commit\b/,
   `${name} can unexpectedly modify the user's branch`);
 }
 const winter=read('.github/workflows/generate-winter-sprites.yml');
 assert.match(winter,/contents: read/);
 assert.doesNotMatch(winter,/\n\s+push:/);
});

test('each installed browser integration test is reachable from CI, npm, or extended manual QA',()=>{
 const tests=fs.readdirSync(new URL('tests/',root)).filter(x=>x.endsWith('.cjs')).sort();
 const reachable=workflowSource+'\n'+packageScripts;
 assert.ok(tests.length>=30,'Browser coverage unexpectedly shrank');
 const orphan=tests.filter(x=>!reachable.includes('tests/'+x));
 assert.deepEqual(orphan,[],'Orphan browser test programs have no documented entrypoint');
});

test('no workflow invokes missing scripts, tests or npm scripts',()=>{
 const json=JSON.parse(read('package.json'));
 for(const file of directRefs(workflowSource+'\n'+packageScripts)){
  assert.ok(fs.existsSync(new URL(file,root)),`Orphan CLI file: ${file}`);
 }
 for(const [,script] of Object.entries(json.scripts)){
  for(const [,name] of script.matchAll(/\bnpm\s+run\s+([\w:-]+)/g))
   assert.ok(json.scripts[name],`Unknown npm command ${name}`);
 }
 for(const [,name] of workflowSource.matchAll(/\bnpm\s+run\s+([\w:-]+)/g))
  assert.ok(json.scripts[name],`Unknown npm command in workflow: ${name}`);
});

test('critical physics, browser, render and climate checks still run in required CI',()=>{
 const ci=read('.github/workflows/ci.yml');
 for(const marker of [
  'npm test', 'verify-current-spritesheets.cjs', 'browser-required-action-assets.cjs',
  'npm run test:snake-raster-parity', 'browser-season-parity.cjs',
  'browser-climate-v3.cjs','browser-a2-collision-fruits.cjs',
  'browser-mobile-orientation.cjs', 'npm run test:journey'
 ]) assert.ok(ci.includes(marker),`Missing required CI check: ${marker}`);
});

test('final polish removes no-op border measurements and private-path screenshot helpers',()=>{
 const renderer=read('Chaua-Educa-main/js/render.mjs');
 assert.doesNotMatch(renderer,/\bflightBorders\s*\(/,'An empty renderer hook must not be benchmarked');
 for(const script of ['scripts/benchmark-render-parts.cjs','scripts/diagnose-render-cost.cjs']){
  assert.doesNotMatch(read(script),/\bflightBorders\b|['"]borders['"]/,
   `${script} measures an absent graphical pass`);
 }
 const scripts=fs.readdirSync(new URL('scripts/',root)).filter(x=>/\.(?:cjs|js|py)$/.test(x));
 for(const script of scripts){
  const source=read('scripts/'+script);
  assert.doesNotMatch(source,/\.gemini[\\/]antigravity|[A-Za-z]:[\\/]Users[\\/]/i,
   `A private artist-machine directory leaked into ${script}`);
  assert.doesNotMatch(source,/\?snakeA2=[01]|\?actionSprites=[01]/,
   `Obsolete art-mode URL remains in ${script}`);
 }
 const ci=read('.github/workflows/ci.yml');
 for(const p of ['test-results/reference-art/','test-results/snake-strike/','test-results/render-parts/'])
  assert.ok(ci.includes(p),`Official visual QA artifact not uploaded: ${p}`);
});
