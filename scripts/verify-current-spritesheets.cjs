// Portable, reproducible integrity check for the seven active WebP atlases.
// Browser visual checks are run independently by browser-real-action-sprites.cjs.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'spritesheets.manifest.json'),'utf8'));
const expected=7;
if(manifest.version!==1||manifest.spritesheets?.length!==expected){
 throw new Error('Sprite manifest must register exactly seven active assets');
}
let failures=0;
for(const entry of manifest.spritesheets){
 const file=path.resolve(root,entry.path);
 if(!file.startsWith(root+path.sep))throw new Error('Asset path escapes project: '+entry.path);
 if(!fs.existsSync(file)){console.error('MISSING',entry.path);failures++;continue;}
 const bytes=fs.readFileSync(file);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const validContainer=bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.toString('ascii',12,16)==='VP8X'&&bytes.readUInt32LE(4)+8===bytes.length;
 const width=validContainer?1+bytes.readUIntLE(24,3):0;
 const height=validContainer?1+bytes.readUIntLE(27,3):0;
 const hasAlpha=validContainer&&!!(bytes[20]&16);
 const ok=validContainer&&hasAlpha&&bytes.length===entry.bytes&&hash===entry.sha256&&width===entry.width&&height===entry.height;
 if(!ok){console.error('INVALID',entry.path,{bytes:bytes.length,width,height,hasAlpha,hash});failures++;}
 else console.log('PASS',entry.path,width+'x'+height,bytes.length+' bytes');
}
if(failures)throw new Error(failures+' invalid, missing or changed sprite sheets');
console.log('PASS: all seven current WebP atlases have expected dimensions, transparency and SHA-256');
