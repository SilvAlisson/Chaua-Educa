// Test-only switches, deliberately ignored on ordinary game links.
export const PERF_AB_OPTIONS=Object.freeze([
 'baseline',
 'direct-snow',
 'precomposed-snow',
 'winter-caps-bitmap',
 'winter-caps-stage-cache',
 'winter-caps-stage-prefetch',
 'winter-caps-compact-stages',
 'snow-mask-off',
 'snow-flakes-off',
 'static-season-bg',
 'legacy-snow-clips',
 'legacy-snow-rebuild'
]);
export function resolvePerfVariant(search='') {
 const params=new URLSearchParams(search);
 // The original-art Test C can be enabled on ordinary game URLs.
 if(params.get('perf-ab')==='precomposed-snow')return 'precomposed-snow';
 if(params.get('perf-test')!=='1')return 'precomposed-snow';
 const requested=params.get('perf-ab')||'precomposed-snow';
 return PERF_AB_OPTIONS.includes(requested)?requested:'precomposed-snow';
}
export function buildPerfTestUrl(currentHref='http://127.0.0.1/',options={}){
 const url=new URL(currentHref);
 const clearKeys=['perf-test','perf-ab','perf-level','perf-hz','perf-replay','clima','weather'];
 for(const key of clearKeys)url.searchParams.delete(key);
 if(options.enabled===false)return url.toString();
 url.searchParams.set('perf-test','1');
 const ab=PERF_AB_OPTIONS.includes(options.ab)?options.ab:'precomposed-snow';
 url.searchParams.set('perf-ab',ab);
 if(options.level==='deep')url.searchParams.set('perf-level','deep');
 if(Number(options.hz)===120)url.searchParams.set('perf-hz','120');
 if(options.replay)url.searchParams.set('perf-replay','1');
 const weather=typeof options.weather==='string'?options.weather.toLowerCase():'';
 if(['winter','storm','rain','autumn','summer','spring'].includes(weather)){
  url.searchParams.set('clima',weather);
 }
 return url.toString();
}
export const PERF_AB_VARIANT=resolvePerfVariant(typeof location==='undefined'?'':location.search);
