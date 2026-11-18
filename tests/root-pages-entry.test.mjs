import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const entry=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=entry.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function resolveRedirect(source){
  let destination=null;
  const origin=new URL(source);
  runInNewContext(script,{
    URL,
    window:{location:{
      href:origin.href,
      search:origin.search,
      hash:origin.hash,
      replace(url){destination=String(url);}
    }}
  });
  return destination;
}

test('GitHub Pages root opens the playable game, not README content',()=>{
  assert.ok(script,'root entry must contain a redirect');
  assert.match(entry,/http-equiv="refresh"/);
  assert.match(entry,/href="\.\/Chaua-Educa-main\/"/);
  assert.equal(resolveRedirect('https://alissonaraujo0528.github.io/Chaua-Educa/'),
    'https://alissonaraujo0528.github.io/Chaua-Educa/Chaua-Educa-main/');
  assert.equal(resolveRedirect('https://alissonaraujo0528.github.io/Chaua-Educa/index.html'),
    'https://alissonaraujo0528.github.io/Chaua-Educa/Chaua-Educa-main/');
});
test('Pages entry preserves the optional deep perf query and anchors',()=>{
  assert.equal(resolveRedirect('https://alissonaraujo0528.github.io/Chaua-Educa/?perf-test=1&perf-ab=baseline#play'),
    'https://alissonaraujo0528.github.io/Chaua-Educa/Chaua-Educa-main/?perf-test=1&perf-ab=baseline#play');
});
