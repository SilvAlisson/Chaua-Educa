// Offline audit of exactly what GitHub Pages serves. No external service is required.
import {readFileSync,existsSync,readdirSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ASSET_CATALOG} from '../Chaua-Educa-main/js/asset-manifest.mjs';
import {ACTION_SHEET_DEFS} from '../Chaua-Educa-main/js/action-sheets.mjs';
import {RUNTIME_ART} from '../Chaua-Educa-main/js/runtime-art-data.mjs';
import {JOURNAL_PHOTOS,CONSERVATION_SOURCES} from '../Chaua-Educa-main/js/journal-content.mjs';
import {SOURCES} from '../Chaua-Educa-main/js/questions.mjs';
import {GAME_VERSION} from '../Chaua-Educa-main/js/version.mjs';
import {GLYPH_URL} from '../Chaua-Educa-main/js/pixi-glyphs.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),app=resolve(root,'Chaua-Educa-main'),js=resolve(app,'js');
const files=new Set(),modules=new Set(),externals=new Set(),errors=[];
const fail=m=>errors.push(m),read=p=>readFileSync(p,'utf8'),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function requireFile(path,origin){
 const p=resolve(path);if(!p.startsWith(app+sep)&&p!==resolve(root,'index.html')){fail(`Path escapes publication: ${origin}`);return;}
 if(!existsSync(p)||!statSync(p).isFile()){fail(`Missing/case-mismatched file: ${relative(root,p)} (${origin})`);return;}
 if(!statSync(p).size)fail(`Empty resource: ${relative(root,p)}`);files.add(p);
}
function external(url){try{if(new URL(url).protocol!=='https:')throw Error();externals.add(url);}catch{fail(`Invalid external URL: ${url}`);}}
function visit(p){
 if(modules.has(p))return;requireFile(p,'module graph');if(!existsSync(p))return;modules.add(p);
 const text=read(p);
 for(const m of text.matchAll(/(?:\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?|\bimport\s*\()\s*['"](\.[^'"]+)['"]/g))visit(resolve(dirname(p),m[1]));
}
visit(resolve(js,'script.js'));
const htmlPath=resolve(app,'index.html'),cssPath=resolve(app,'css/style.css'),html=read(htmlPath);requireFile(htmlPath,'entry');requireFile(cssPath,'stylesheet');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const dynamicIds=new Set([...modules].flatMap(p=>[...read(p).matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map(m=>m[1])));
for(const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){
 const url=m[1];if(url.startsWith('https:'))external(url);else if(url.startsWith('#')){if(!ids.has(url.slice(1)))fail(`Missing fragment: ${url}`);}else if(!url.includes(':')){const local=url.split(/[?#]/)[0],p=resolve(app,local);if(local.endsWith('/'))requireFile(resolve(p,'index.html'),url);else requireFile(p,url);}
}
for(const m of html.matchAll(/\b(?:for|aria-labelledby|aria-controls)="([^"]+)"/g))for(const id of m[1].split(/\s+/))if(!ids.has(id)&&!dynamicIds.has(id))fail(`Missing control/label: ${id}`);
for(const m of read(cssPath).matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))if(!m[1].startsWith('data:'))requireFile(resolve(dirname(cssPath),m[1]),'CSS URL');
for(const [id,asset] of Object.entries(ASSET_CATALOG)){
 const path=resolve(js,asset.path);
 requireFile(path,'asset catalog');
 if(existsSync(path)){
  const bytes=readFileSync(path);
  const type=bytes.toString('ascii',12,16);
  let dimensions;
  if(type==='VP8X'&&bytes.length>=30)dimensions=[1+bytes.readUIntLE(24,3),1+bytes.readUIntLE(27,3)];
  if(type==='VP8 '&&bytes.length>=30)dimensions=[bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
  if(type==='VP8L'&&bytes.length>=25){const bits=bytes.readUInt32LE(21);dimensions=[1+(bits&0x3fff),1+((bits>>>14)&0x3fff)];}
  if(dimensions?.[0]!==asset.width||dimensions?.[1]!==asset.height)fail('Asset dimensions differ from catalog: '+id);
 }
 for(const {rect:[x,y,w,h],anchor} of asset.frames){
  if(![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<=0||h<=0||x+w>asset.width||y+h>asset.height)
   fail('Frame outside atlas: '+id);
  if(anchor&&!anchor.every(Number.isFinite))fail('Invalid frame anchor: '+id);
 }
}
requireFile(fileURLToPath(GLYPH_URL),'Pixi glyph atlas');
const winterArtDir=resolve(app,'assets/Seasons/Winter/Precomposed');
const winterManifest=JSON.parse(read(resolve(winterArtDir,'manifest.json')));
if(winterManifest.stages!==16)fail('Invalid winter stage count');
for(const page of winterManifest.pages){
 const path=resolve(winterArtDir,page.file);requireFile(path,'packed winter caps');
 if(existsSync(path)&&hash(path)!==page.sha256)fail(`Corrupted winter cap page: ${page.file}`);
}
for(const page of winterManifest.stagePages||[]){
 if(!page)continue;
 const path=resolve(winterArtDir,page.file);requireFile(path,'packed winter stage cap');
 if(existsSync(path)&&hash(path)!==page.sha256)fail(`Corrupted winter stage cap page: ${page.file}`);
}
for(const def of Object.values(ACTION_SHEET_DEFS))requireFile(resolve(js,def.path),'action sheet');
const sprites=JSON.parse(read(resolve(root,'scripts/spritesheets.manifest.json')));
for(const entry of sprites.spritesheets){const p=resolve(root,entry.path);requireFile(p,'sprite integrity');if(existsSync(p)&&hash(p)!==entry.sha256)fail(`Changed original sprite: ${entry.path}`);}
for(const def of Object.values(RUNTIME_ART))for(const page of def.pages){const p=resolve(js,page.path);requireFile(p,'runtime atlas');if(existsSync(p)&&hash(p)!==page.sha256)fail(`Changed runtime atlas: ${page.path}`);}
for(const photo of Object.values(JOURNAL_PHOTOS)){requireFile(resolve(app,photo.src),'credited photo');external(photo.page);}
for(const s of [...Object.values(SOURCES),...Object.values(CONSERVATION_SOURCES)]){if(s.url.startsWith('#')){if(!ids.has(s.url.slice(1)))fail('Missing source fragment: '+s.url);}else external(s.url);}
for(const font of ['Baloo2','Nunito']){const p=resolve(app,`Fonts/${font}/OFL.txt`);requireFile(p,'font license');if(existsSync(p)&&!read(p).includes('SIL OPEN FONT LICENSE'))fail(`Invalid license: ${font}`);}
for(const credit of ['Duncan Rawlinson','CC BY 2.0','Lívia Teodosio','Marilia Teodosio','Flávia Gomes','IFAL'])if(!html.includes(credit))fail(`Missing credit: ${credit}`);
const entry=resolve(root,'index.html');requireFile(entry,'Pages root');if(existsSync(entry)&&!read(entry).includes('url=./Chaua-Educa-main/'))fail('Root entry does not point to the game');
const build=html.match(/<meta name="chaua-build" content="([^"]+)"/)[1];
try {
 const map=JSON.parse(html.match(/<script type="importmap" id="chaua-modules">([\s\S]*?)<\/script>/)[1]).imports;
 for(const p of modules){const key='./js/'+relative(js,p).replaceAll(sep,'/');if(map[key]!==key+'?v='+build)fail('Missing/incoherent module revision: '+key);}
 for(const [key,value] of Object.entries(map)){if(!key.startsWith('./js/')||value!==key+'?v='+build)fail('Invalid revisioned module: '+key);requireFile(resolve(app,key),'import map');}
 if(!html.includes('css/style.css?v='+build)||!html.includes('js/script.js?v='+build))fail('Entry/stylesheet revisions differ');
 if(build!==GAME_VERSION&&!build.startsWith(GAME_VERSION+'-'))fail('Interface revision differs from package');
} catch(error){fail('Invalid/missing module import map: '+error.message);}
const pkg=JSON.parse(read(resolve(root,'package.json'))),lock=JSON.parse(read(resolve(root,'package-lock.json')));
if(pkg.version!==GAME_VERSION||lock.version!==GAME_VERSION||lock.packages[''].version!==GAME_VERSION)fail('Package/runtime versions differ');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const all=walk(app),orphanModules=all.filter(p=>['.mjs','.js'].includes(extname(p))&&!modules.has(p));
if(orphanModules.length)fail('Unreachable active modules: '+orphanModules.map(p=>relative(app,p)).join(', '));
const orphanResources=all.filter(p=>['.webp','.png','.woff2'].includes(extname(p))&&!files.has(p));
if(orphanResources.length)fail('Unreferenced published resources: '+orphanResources.map(p=>relative(app,p)).join(', '));
const report={version:GAME_VERSION,scope:'static publication, module graph including opt-in diagnostics; external URLs checked structurally, not for remote uptime',modules:modules.size,resources:files.size,externalLinks:[...externals].sort(),errors,
 files:[...files].sort().map(p=>({path:relative(root,p),bytes:statSync(p).size,sha256:hash(p)})),publicationMetadata:all.filter(p=>!files.has(p)).map(p=>relative(root,p))};
const target=process.argv.indexOf('--json');if(target>=0){const out=resolve(process.argv[target+1]);mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS release ${GAME_VERSION}: ${modules.size} reachable modules, ${files.size} checked files, no orphan published resources; ${externals.size} external URLs inventoried`);
