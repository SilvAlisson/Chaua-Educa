export const CONTENT_REVIEWED = "2026-11-15";
export const SOURCES = {
  panReport:{label:'ICMBio · Relatório PAN Chauá/Papagaios (2021)',url:'https://www.gov.br/icmbio/pt-br/assuntos/biodiversidade/pan/pan-papagaios/2-ciclo/produtos/2021-pan-papagaios-pan-chaua-relatorio-final-website.pdf'},
  inma: {label: "INMA · Chauá e ipê do Rio Doce (2025)", url: "https://www.gov.br/inma/pt-br/assuntos/noticias/papagaio-ameacado-ajuda-cientistas-a-descobrir-nova-populacao-de-ipe-raro-no-rio-doce"},
  game: {label: "Chauá Educa · elementos fictícios e regras do jogo", url: "#collection-dialog"},
  zoo: {
    label: "Fundação Jardim Zoológico de Brasília · Papagaio-chauá",
    url: "https://zoo.df.gov.br/papagaio-chaua",
  },
  icmbio: {
    label: "ICMBio · PAN Papagaios, ciclo finalizado (2017–2022)",
    url: "https://www.gov.br/icmbio/pt-br/assuntos/biodiversidade/pan/pan-papagaios/pan-papagaios/",
  },
};
export const QUESTIONS = [
  {
    "id": "habitat",
    "topic": "Habitat",
    "text": "O papagaio-chauá vive na Mata Atlântica.",
    "answer": true,
    "explanation": "A Mata Atlântica é o habitat do chauá. Proteger essa floresta ajuda a conservar a espécie.",
    "source": "panReport",
    "entry": "habitat"
  },
  {
    "id": "pantanal",
    "topic": "Habitat",
    "text": "O Pantanal é o habitat característico do papagaio-chauá.",
    "answer": false,
    "explanation": "O chauá é uma espécie da Mata Atlântica, e não uma ave característica do Pantanal.",
    "source": "panReport",
    "entry": "habitat"
  },
  {
    "id": "alagoas",
    "topic": "Distribuição",
    "text": "Alagoas faz parte da área de ocorrência do chauá.",
    "answer": true,
    "explanation": "Sua área de ocorrência inclui Alagoas e outros estados do leste do Brasil.",
    "source": "zoo",
    "entry": "chaua"
  },
  {
    "id": "cientifico",
    "topic": "Conheça o chauá",
    "text": "Amazona rhodocorytha é o nome científico do chauá.",
    "answer": true,
    "explanation": "Esse nome identifica a espécie e ajuda a diferenciá-la de outros papagaios.",
    "source": "zoo",
    "entry": "chaua"
  },
  {
    "id": "captura",
    "topic": "Conservação",
    "text": "A captura de ovos e filhotes ameaça as populações de chauás.",
    "answer": true,
    "explanation": "A captura para o comércio ilegal é uma das ameaças enfrentadas pela espécie.",
    "source": "icmbio",
    "entry": "conservacao"
  },
  {
    "id": "floresta",
    "topic": "Conservação",
    "text": "A destruição e a fragmentação das florestas não afetam o chauá.",
    "answer": false,
    "explanation": "A perda e a fragmentação do habitat estão entre as ameaças ao chauá.",
    "source": "panReport",
    "entry": "conservacao"
  },
  {
    "id": "protecao",
    "topic": "Conservação",
    "text": "Conservar o habitat faz parte da proteção dos papagaios.",
    "answer": true,
    "explanation": "A conservação precisa proteger tanto as aves quanto os ambientes de que dependem.",
    "source": "icmbio",
    "entry": "conservacao"
  },
  {
    "id": "todos",
    "topic": "Diversidade",
    "text": "Todos os papagaios brasileiros pertencem à mesma espécie.",
    "answer": false,
    "explanation": "O PAN Papagaios reuniu ações para espécies diferentes, como o chauá e o papagaio-de-peito-roxo.",
    "source": "icmbio",
    "entry": "chaua"
  },
  {
    "id": "petalas",
    "topic": "Alimentação",
    "text": "O chauá pode comer pétalas de ipê.",
    "answer": true,
    "explanation": "Pesquisadores observaram essa relação alimentar no Espírito Santo.",
    "source": "inma",
    "entry": "alimentos"
  },
  {
    "id": "somente-frutas",
    "topic": "Alimentação",
    "text": "O chauá se alimenta exclusivamente de frutas.",
    "answer": false,
    "explanation": "Pétalas também fazem parte de sua alimentação observada.",
    "source": "inma",
    "entry": "alimentos"
  },
  {
    "id": "pesquisa-ipe",
    "topic": "Pesquisa",
    "text": "Acompanhar chauás ajudou cientistas a localizar árvores raras.",
    "answer": true,
    "explanation": "Observar a alimentação e os pousos das aves ajudou a localizar Handroanthus riodocensis, um ipê raro.",
    "source": "inma",
    "entry": "arvores"
  },
  {
    "id": "ipe-especie",
    "topic": "Diversidade",
    "text": "Handroanthus riodocensis é o nome científico do chauá.",
    "answer": false,
    "explanation": "Esse nome identifica o ipê estudado. O nome científico do chauá é Amazona rhodocorytha.",
    "source": "inma",
    "entry": "arvores"
  },
  {
    "id": "relacoes",
    "topic": "Habitat",
    "text": "Conservar plantas pode ajudar a proteger as aves que delas dependem.",
    "answer": true,
    "explanation": "O chauá e o ipê ilustram essa ligação.",
    "source": "inma",
    "entry": "habitat"
  },
  {
    "id": "plantas-isoladas",
    "topic": "Pesquisa",
    "text": "Na pesquisa de Linhares, observar as aves não ajudou a encontrar os ipês.",
    "answer": false,
    "explanation": "O estudo do chauá ajudou a encontrar ipês raros.",
    "source": "inma",
    "entry": "arvores"
  },
  {
    "id": "linhares",
    "topic": "Distribuição",
    "text": "A pesquisa que relacionou chauás e ipês ocorreu em Linhares, no Espírito Santo.",
    "answer": true,
    "explanation": "O trabalho foi divulgado pelo INMA em 2025.",
    "source": "inma",
    "entry": "arvores"
  },
  {
    "id": "trafico-ajuda",
    "topic": "Conservação",
    "text": "Retirar filhotes da natureza para o comércio ilegal ajuda a conservar papagaios.",
    "answer": false,
    "explanation": "O tráfico é uma ameaça, não uma ação de conservação.",
    "source": "icmbio",
    "entry": "conservacao"
  },
  {
    "id": "educacao",
    "topic": "Conservação",
    "text": "A educação ambiental faz parte das estratégias para conservar papagaios.",
    "answer": true,
    "explanation": "O ICMBio incluiu sensibilização e educação para a conservação entre as frentes do PAN Papagaios.",
    "source": "icmbio",
    "entry": "conservacao"
  },
  {
    "id": "somente-captura",
    "topic": "Conservação",
    "text": "Combater o tráfico dispensa a proteção do habitat.",
    "answer": false,
    "explanation": "As estratégias também incluem reduzir a perda de ambientes naturais.",
    "source": "icmbio",
    "entry": "conservacao"
  },
  {
    "id": "peito-roxo",
    "topic": "Diversidade",
    "text": "O chauá e o papagaio-de-peito-roxo são espécies diferentes.",
    "answer": true,
    "explanation": "São Amazona rhodocorytha e Amazona vinacea.",
    "source": "icmbio",
    "entry": "chaua"
  },
  {
    "id": "plano-unico",
    "topic": "Conservação",
    "text": "O PAN Papagaios reuniu ações apenas para a espécie chauá.",
    "answer": false,
    "explanation": "O PAN Papagaios incluiu o chauá e outras espécies; seu segundo ciclo ocorreu de 2017 a 2022.",
    "source": "icmbio",
    "entry": "conservacao"
  },
  {
    "id": "escudo-real",
    "topic": "Jogo e natureza",
    "text": "Um chauá real pode criar um escudo mágico de penas.",
    "answer": false,
    "explanation": "O escudo é uma fantasia criada para esta aventura.",
    "source": "game",
    "entry": "fantasia"
  },
  {
    "id": "cardapio",
    "topic": "Jogo e natureza",
    "text": "Os alimentos coletáveis formam um guia completo de alimentação para aves reais.",
    "answer": false,
    "explanation": "São representações lúdicas; não são uma dieta recomendada.",
    "source": "game",
    "entry": "alimentos"
  },
  {
    "id": "fauna-vila",
    "topic": "Jogo e natureza",
    "text": "As cobras e os gaviões do jogo foram desenhados como desafios de voo.",
    "answer": true,
    "explanation": "As animações são simplificações e não identificam espécies nem comprovam predação do chauá.",
    "source": "game",
    "entry": "fauna"
  },
  {
    "id": "pena-pontos",
    "topic": "Jogo e natureza",
    "text": "Dobrar pontos com uma pena dourada é uma regra fictícia do jogo.",
    "answer": true,
    "explanation": "A aura e o multiplicador são recursos da aventura.",
    "source": "game",
    "entry": "fantasia"
  }
];

const ENTRY_BY_TOPIC = {Habitat:"habitat", Distribuição:"chaua", "Conheça o chauá":"chaua", Conservação:"conservacao", Diversidade:"chaua"};
const CHAPTERS_BY_TOPIC={Habitat:[1,2],Distribuição:[3],'Conheça o chauá':[0],Conservação:[2,3],Diversidade:[0,1],Alimentação:[0],Pesquisa:[1],'Jogo e natureza':[0,1,2,3]};
for (const question of QUESTIONS) { question.chapters=[...CHAPTERS_BY_TOPIC[question.topic]]; question.entry ??= ENTRY_BY_TOPIC[question.topic]; question.reviewed = CONTENT_REVIEWED; }
