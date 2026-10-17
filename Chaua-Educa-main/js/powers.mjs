export const POWER_BALANCE=Object.freeze({minimumOfferGap:9,shieldGap:18,featherGap:20,routeBonus:2});
export function offerPower({elapsed,shield,feather,entities,schedule,opportunity,random}) {
    if(elapsed<schedule.nextAny || entities.some(e=>!e.collected&&['shield','feather'].includes(e.kind)))return null;
    const kind=opportunity&&feather<=2&&elapsed>=schedule.nextFeather?'feather'
        :!shield&&elapsed>=schedule.nextShield?'shield':null;
    if(!kind)return null;
    schedule.nextAny=elapsed+POWER_BALANCE.minimumOfferGap;
    if(kind==='shield')schedule.nextShield=elapsed+POWER_BALANCE.shieldGap+random()*8;
    else schedule.nextFeather=elapsed+POWER_BALANCE.featherGap+random()*6;
    return kind;
}
