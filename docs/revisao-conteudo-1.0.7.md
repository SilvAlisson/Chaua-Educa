# Revisão educativa · 1.0.7

Data: **15/11/2026**. Revisão dos 24 itens, explicações, vínculos da Chauapédia e atribuição das fontes. IDs, respostas booleanas e entradas persistidas foram mantidos. A conferência de fontes não é uma avaliação de compreensão por jogadores.

## Fontes e decisões

- [Zoológico de Brasília](https://zoo.df.gov.br/papagaio-chaua): endereço atual para a ficha da espécie; usado para nome científico, área geográfica e características visíveis.
- [Relatório oficial PAN Chauá/Papagaios (2021)](https://www.gov.br/icmbio/pt-br/assuntos/biodiversidade/pan/pan-papagaios/2-ciclo/produtos/2021-pan-papagaios-pan-chaua-relatorio-final-website.pdf): fonte direta para o bioma, fragmentação e recursos alimentares. A data histórica do relatório permanece explícita.
- [INMA · pesquisa em Linhares (2025)](https://www.gov.br/inma/pt-br/assuntos/noticias/papagaio-ameacado-ajuda-cientistas-a-descobrir-nova-populacao-de-ipe-raro-no-rio-doce): alimentação com pétalas e monitoramento que revelou ipês; não extrapolamos o estudo para toda a dieta ou todos os ipês. A pergunta `ipe-especie` passou a distinguir os nomes científicos da árvore e da ave, sem depender de uma generalização não demonstrada pelo artigo.
- [ICMBio · PAN Papagaios](https://www.gov.br/icmbio/pt-br/assuntos/biodiversidade/pan/pan-papagaios/pan-papagaios/): o 2º ciclo está finalizado (2017–2022). Atribuições e explicações foram ajustadas para não apresentar o ciclo como um plano atualmente em execução.
- Elementos fictícios foram conferidos nas regras/descrições do próprio jogo, mantendo a distinção entre aventura e natureza.
- Nas fichas existentes, a categoria nacional de conservação continua ligada à [Portaria MMA 1.704/2026](https://www.gov.br/icmbio/pt-br/assuntos/biodiversidade/pan/saiba-mais/documentos-e-downloads/10-portaria-mma-no-1-704-de-16-de-junho-de-2026.pdf). A estimativa populacional continua explicitamente histórica, da [avaliação SALVE publicada em 2023](https://doi.org/10.37002/salve.ficha.24276.2), avaliada em 2021; não é apresentada como contagem atual. A disponibilidade externa das páginas não é simulada pelos testes locais.

## Banco revisado

| ID preservado | Fonte | Capítulos preferidos | Decisão |
|---|---|---|---|
| habitat | panReport | 2, 3 | Fonte específica do bioma |
| pantanal | panReport | 2, 3 | Fonte específica do bioma |
| alagoas | zoo | 4 | Conferido; conceito preservado |
| cientifico | zoo | 1 | Conferido; conceito preservado |
| captura | icmbio | 3, 4 | Conferido; conceito preservado |
| floresta | panReport | 3, 4 | Fonte específica de fragmentação |
| protecao | icmbio | 3, 4 | Conferido; conceito preservado |
| todos | icmbio | 1, 2 | Clareza e tempo verbal |
| petalas | inma | 1 | Conferido; conceito preservado |
| somente-frutas | inma | 1 | Conferido; conceito preservado |
| pesquisa-ipe | inma | 2 | Explicação ampliada |
| ipe-especie | inma | 1, 2 | Afirmação diretamente sustentada pela fonte |
| relacoes | inma | 2, 3 | Conferido; conceito preservado |
| plantas-isoladas | inma | 2 | Remove generalização absoluta |
| linhares | inma | 4 | Conferido; conceito preservado |
| trafico-ajuda | icmbio | 3, 4 | Conferido; conceito preservado |
| educacao | icmbio | 3, 4 | Clareza e contexto do PAN |
| somente-captura | icmbio | 3, 4 | Conferido; conceito preservado |
| peito-roxo | icmbio | 1, 2 | Conferido; conceito preservado |
| plano-unico | icmbio | 3, 4 | Pergunta ligada ao PAN documentado |
| escudo-real | game | 1, 2, 3, 4 | Conferido; conceito preservado |
| cardapio | game | 1, 2, 3, 4 | Conferido; conceito preservado |
| fauna-vila | game | 1, 2, 3, 4 | Conferido; conceito preservado |
| pena-pontos | game | 1, 2, 3, 4 | Conferido; conceito preservado |

A preferência por capítulo não impede a revisão de um erro anterior. Uma pergunta consumida não retorna até o banco esgotar. As 24 respostas mantêm seus valores anteriores.

## Fotografia e interação

A foto é a mesma da Chauapédia, de Duncan Rawlinson, RSCF/EUA, 2007, disponibilizada no [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Amazona_rhodocorytha_-RSCF-8a.jpg) sob [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). A ave está em cativeiro; não é um registro local de fauna. São informados redimensionamento/conversão para WebP e marcadores sobrepostos. Não houve nova imagem nem alteração dos pixels do arquivo.

Os pontos de toque e os botões equivalentes de teclado exploram testa/face, plumagem e a diferença entre fotografia e desenho. A foto carrega somente ao abrir a atividade. Se ela falhar, as descrições e a volta à pergunta continuam disponíveis. A atividade não cria pontos, penalidades ou tempo adicional de voo; a mesma pergunta e seu bônus são conservados.

## Validação com pessoas ainda necessária

Na beta, pedir que iniciantes expliquem com suas palavras uma descoberta de cada capítulo, distingam foto de representação e retomem a pergunta após observar. Registrar dificuldades de leitura, interpretação, toque/teclado e confusão entre poderes fictícios e características reais. Repetir com educadores e nos aparelhos da matriz física. Não marcar compreensão como validada apenas por aprovação de testes automatizados.
