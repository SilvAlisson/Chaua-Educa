// Mode-specific world routes target six active minutes, independently of score.
export const CAMPAIGN_TARGET_SECONDS=360;
export const JOURNEY_LENGTH=140000;
export const JOURNEY_LENGTHS=Object.freeze({aventura:JOURNEY_LENGTH,tranquilo:84000});
export const journeyLength=mode=>JOURNEY_LENGTHS[mode]??JOURNEY_LENGTH;
export const journeyProgress=game=>Math.min(1,Math.max(0,(game.distance||0)/journeyLength(game.mode)));
export const journeyReferenceDistance=(distance,mode)=>distance*JOURNEY_LENGTH/journeyLength(mode);
export const ARRIVAL_SECONDS=1.6;
export const JOURNEY=Object.freeze([
 {name:'Área de alimentação',start:0,patterns:['central','curve'],topics:['Conheça o chauá','Diversidade','Alimentação','Jogo e natureza'],message:'Alimente a curiosidade e encontre seu ritmo.'},
 {name:'Árvores antigas',start:JOURNEY_LENGTH/4,patterns:['branch','climb','descent'],topics:['Habitat','Pesquisa'],message:'Observe os galhos e os abrigos da mata.'},
 {name:'Mata fragmentada',start:JOURNEY_LENGTH/2,patterns:['wide','choice'],topics:['Conservação'],message:'Trechos separados lembram a importância de conectar a floresta.'},
 {name:'Refúgio do bando',start:JOURNEY_LENGTH*3/4,patterns:['wide','central'],topics:['Conservação','Distribuição'],message:'O abrigo está próximo. Encontre o bando.'},
]);
export function journeyStage(distance,mode){return Math.min(3,Math.max(0,Math.floor(distance/journeyLength(mode)*4)));}
