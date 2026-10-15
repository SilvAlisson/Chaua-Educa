export const SOURCES = {
  zoo: {
    label: "Fundação Jardim Zoológico de Brasília · Papagaio-chauá",
    url: "https://www.zoo.df.gov.br/papagaio-chaua-amazona-rhodocorytha",
  },
  icmbio: {
    label: "ICMBio · Plano de Ação Nacional dos Papagaios",
    url: "https://www.gov.br/icmbio/pt-br/assuntos/biodiversidade/pan/pan-papagaios/pan-papagaios/",
  },
};
export const QUESTIONS = [
  {
    id: "habitat",
    topic: "Habitat",
    text: "O papagaio-chauá vive na Mata Atlântica.",
    answer: true,
    explanation:
      "A Mata Atlântica é o habitat do chauá. Proteger essa floresta ajuda a conservar a espécie.",
    source: "zoo",
  },
  {
    id: "pantanal",
    topic: "Habitat",
    text: "O Pantanal é o habitat característico do papagaio-chauá.",
    answer: false,
    explanation:
      "O chauá é uma espécie da Mata Atlântica, e não uma ave característica do Pantanal.",
    source: "zoo",
  },
  {
    id: "alagoas",
    topic: "Distribuição",
    text: "Alagoas faz parte da área de ocorrência do chauá.",
    answer: true,
    explanation:
      "Sua área de ocorrência inclui Alagoas e outros estados do leste do Brasil.",
    source: "zoo",
  },
  {
    id: "cientifico",
    topic: "Conheça o chauá",
    text: "Amazona rhodocorytha é o nome científico do chauá.",
    answer: true,
    explanation:
      "Esse nome identifica a espécie e ajuda a diferenciá-la de outros papagaios.",
    source: "zoo",
  },
  {
    id: "captura",
    topic: "Conservação",
    text: "A captura de ovos e filhotes ameaça as populações de chauás.",
    answer: true,
    explanation:
      "A captura para o comércio ilegal é uma das ameaças enfrentadas pela espécie.",
    source: "icmbio",
  },
  {
    id: "floresta",
    topic: "Conservação",
    text: "A destruição e a fragmentação das florestas não afetam o chauá.",
    answer: false,
    explanation:
      "A perda e a fragmentação do habitat estão entre as ameaças ao chauá.",
    source: "icmbio",
  },
  {
    id: "protecao",
    topic: "Conservação",
    text: "Conservar o habitat faz parte da proteção dos papagaios.",
    answer: true,
    explanation:
      "A conservação precisa proteger tanto as aves quanto os ambientes de que dependem.",
    source: "icmbio",
  },
  {
    id: "todos",
    topic: "Diversidade",
    text: "Todos os papagaios brasileiros pertencem à mesma espécie.",
    answer: false,
    explanation:
      "O PAN Papagaios contempla diferentes espécies, incluindo o chauá e o papagaio-de-peito-roxo.",
    source: "icmbio",
  },
];
