// Dedicated A/B branch: remove accumulated tree snow by default.
// ?perf-ab=baseline restores the exact original tree presentation on this branch.
export const PERF_AB_OPTIONS=Object.freeze([
 'baseline','snow-mask-off','snow-flakes-off','static-season-bg','legacy-snow-clips',
 'legacy-snow-rebuild'
]);
export const PERF_AB_BRANCH_DEFAULT='snow-mask-off';
export function resolvePerfVariant(search='') {
 const params=new URLSearchParams(search);
 const requested=params.get('perf-ab')||PERF_AB_BRANCH_DEFAULT;
 return PERF_AB_OPTIONS.includes(requested)?requested:PERF_AB_BRANCH_DEFAULT;
}
// Node tests without a browser still exercise the approved baseline drawing.
// Only the actual browser branch defaults to the experimental snowless arm.
export const PERF_AB_VARIANT=typeof location==='undefined'?'baseline':resolvePerfVariant(location.search);
