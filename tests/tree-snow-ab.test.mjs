import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePerfVariant,PERF_AB_BRANCH_DEFAULT,PERF_AB_OPTIONS} from '../Chaua-Educa-main/js/perf-ab.mjs';

test('this isolated branch defaults to trees without accumulated snow',()=>{
 assert.equal(PERF_AB_BRANCH_DEFAULT,'snow-mask-off');
 assert.equal(resolvePerfVariant(''),'snow-mask-off');
 assert.equal(resolvePerfVariant('?match-forensics=1&test-seed=2448657347'),'snow-mask-off');
 assert.equal(resolvePerfVariant('?perf-test=1'),'snow-mask-off');
});
test('the same branch supports a true baseline without disabling automatic post-match JSON',()=>{
 assert.equal(resolvePerfVariant('?perf-ab=baseline'),'baseline');
 assert.equal(resolvePerfVariant('?match-forensics=1&perf-ab=baseline'),'baseline');
 assert.equal(resolvePerfVariant('?perf-ab=snow-mask-off'),'snow-mask-off');
 assert.equal(resolvePerfVariant('?perf-ab=not-a-variant'),'snow-mask-off');
 assert.ok(PERF_AB_OPTIONS.includes('snow-mask-off'));
});
