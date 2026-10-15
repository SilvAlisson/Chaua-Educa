# Expansão: voo, perigos e poderes

## Entregue

- Toque dá um impulso; segurar mantém batidas a cada 32 ticks; soltar ativa descida de planeio limitada a 175 px/s. Inclinação suavizada na simulação, entre −12° e +9°, interpolada no desenho.
- Três troncos anteriores, tronco com cobra, tronco oco com galho quebrado e galho horizontal com cobra. A colisão da cabeça/galho usa regiões adicionais, em vez de alargar uma coluna invisível inteira.
- Gaviões em travessia e aproximação em mergulho, com duas poses e aviso na borda. Cada sexto trecho substitui o par de árvores por um encontro aéreo. O mergulho tem destino fixo fora do corredor central; não persegue o jogador. As aberturas vizinhas variam no máximo 40 px.
- Escudo absorve um impacto; remove o obstáculo atingido da trajetória, emite partículas e concede 75 ticks (1,25 s) de proteção. Não concede pontos pela destruição. Animais não recebem animação de morte. Limites superior/inferior também consomem o escudo, reposicionando o chauá dentro do mundo.
- Pena dourada aplica ×2 durante 600 ticks ativos. Nova pena renova os 600 ticks; não acumula ×4. O quiz originado por uma coleta bonificada conserva seu bônus de resposta. Não há néctar de atração.
- Pausa, quiz, feedback e contagem de retomada congelam os poderes. Reinício apaga poderes, perigos, comandos segurados e estado da animação.
- Fontes Baloo 2 e Nunito em WOFF2 local, com licenças em `public/assets/Fonts/licenses`. Sem consulta a Google Fonts durante a partida.
- Abertura com chauá pousado, movimento suave, partículas, brilho ocasional no título e botão. Resultado com entrada animada, contagem curta, recorde pessoal, causa da derrota e reinício imediatamente disponível. A mesma arte pousada é usada nas telas, com celebração distinta na vitória.
- Tons de iluminação por trecho, sons sintetizados distintos para os poderes e ruptura do escudo, indicadores de escudo e duração do ×2. Efeitos respeitam movimento reduzido e silêncio.
- Recordes da regra `forest-powers-1` separados dos voos anteriores. Coleção, perguntas para revisar e preferências são preservadas na mesma chave de armazenamento.

## Balanceamento e limites

A geração preserva um corredor geométrico: os gaviões ocupam trechos sem árvores e ficam pelo menos 110 px acima/abaixo do centro local; galhos e cobras permanecem abaixo da abertura. Isso não substitui testes com jogadores de diferentes habilidades. Nenhum poder é necessário para atravessar as configurações geradas.

As cobras e aves são representações estilizadas de perigos da floresta, sem atribuir uma espécie específica como predadora comprovada do chauá. A cobra enrolada é uma ilustração fixa; os gaviões têm animação de duas poses. O chauá do menu tem movimento de respiração/balanço, sem uma nova sequência de piscadas.

## Verificação

37 testes cobrem pontuação, quiz, persistência, cadência entre 60 e 240 Hz, colisões, escudo, expiração/renovação dos poderes, pausa, reinício, separação de encontros e rankings. O teste de desenvolvimento requisita a cena, metadados, entrada principal e todos os novos WebP. Build TypeScript/Vite verificado.

Não há navegador interativo disponível neste ambiente. Ainda é necessária uma partida no Codespace para avaliar a aparência integrada das animações, toque, sons e percepção de dificuldade. O teste HTTP não é um teste visual do navegador.

## Ajustes futuros

Os parâmetros ficam em `src/core/Simulation.ts`. A arte e as âncoras dos troncos ficam em `public/assets/v4` e `src/game/assets/expansion.json`. Revisar juntos desenho e regiões de colisão ao substituir sprites. O script `scripts/pack_expansion.cjs` recebe sete arquivos: cobra, tronco oco, poses de gavião, chauá pousado, pena, escudo e galho com cobra.
