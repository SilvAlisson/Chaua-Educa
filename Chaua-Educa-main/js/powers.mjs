export const POWER_BALANCE = Object.freeze({ minimumOfferGap: 9, shieldGap: 18, featherGap: 20, pepperGap: 24, routeBonus: 2 });
export function offerPower({ elapsed, shield, feather, pepper = 0, entities, schedule, opportunity, random }) {
    if (elapsed < schedule.nextAny || entities.some(e => !e.collected && ['shield', 'feather', 'pepper'].includes(e.kind))) return null;
    let kind = null;
    if (opportunity && feather <= 2 && elapsed >= schedule.nextFeather) {
        kind = 'feather';
    } else if (schedule.nextPepper !== undefined && elapsed >= schedule.nextPepper && pepper <= 1 && !opportunity) {
        kind = 'pepper';
    } else if (!shield && elapsed >= schedule.nextShield) {
        kind = 'shield';
    }
    if (!kind) return null;
    schedule.nextAny = elapsed + POWER_BALANCE.minimumOfferGap;
    if (kind === 'shield') schedule.nextShield = elapsed + POWER_BALANCE.shieldGap + random() * 8;
    else if (kind === 'feather') schedule.nextFeather = elapsed + POWER_BALANCE.featherGap + random() * 6;
    else if (kind === 'pepper') schedule.nextPepper = elapsed + POWER_BALANCE.pepperGap + random() * 8;
    return kind;
}
