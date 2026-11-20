// Test-only switches, deliberately ignored on ordinary game links.
export const PERF_AB_OPTIONS=Object.freeze([
 'baseline','snow-mask-off','snow-flakes-off','static-season-bg','legacy-snow-clips',
 'legacy-snow-rebuild'
]);
export function resolvePerfVariant(search='') {
 const params=new URLSearchParams(search);
 if(params.get('perf-test')!=='1')return 'baseline';
 const requested=params.get('perf-ab')||'baseline';
 return PERF_AB_OPTIONS.includes(requested)?requested:'baseline';
}
export const PERF_AB_VARIANT=resolvePerfVariant(typeof location==='undefined'?'':location.search);
