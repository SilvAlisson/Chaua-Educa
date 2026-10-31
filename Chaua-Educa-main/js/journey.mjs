export const JOURNEY_LENGTH=28000;
export const ARRIVAL_SECONDS=1.6;
export const JOURNEY=Object.freeze([
 {name:'Área de alimentação',start:0,patterns:['central','curve'],topics:['Conheça o chauá','Diversidade','Alimentação','Jogo e natureza'],message:'Alimente a curiosidade e encontre seu ritmo.'},
 {name:'Árvores antigas',start:7000,patterns:['branch','climb','descent'],topics:['Habitat','Pesquisa'],message:'Observe os galhos e os abrigos da mata.'},
 {name:'Mata fragmentada',start:14000,patterns:['wide','choice'],topics:['Conservação'],message:'Trechos separados lembram a importância de conectar a floresta.'},
 {name:'Refúgio do bando',start:21000,patterns:['wide','central'],topics:['Conservação','Distribuição'],message:'O abrigo está próximo. Encontre o bando.'},
]);
export function journeyStage(distance){return Math.min(3,Math.max(0,Math.floor(distance/7000)));}
