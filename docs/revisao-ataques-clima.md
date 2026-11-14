# Revisão de spritesheets, ataques e clima

Base: main após PR #76. Branch: `feat/animal-attacks-weather-clarity`.

## Auditoria artística

Foram inspecionados os 34 WebP do jogo existentes na base, incluindo folhas de animação, atlas, partículas, overlays e cenários. As duas fotografias da Chauapédia têm finalidade científica e ficam fora desse conjunto artístico. Após a revisão, são 36 recursos do jogo: três substituições no mesmo caminho e dois atlas adicionais necessários aos novos ataques.

| Grupo e caminhos | Diagnóstico e resultado |
|---|---|
| `public/parrot/{fly,animations}`; `assets/v6/chaua-atlas.webp` | Preservados. Personagem arredondado, luz suave e poses específicas ainda utilizadas. |
| `public/hawk/{fly,animations}`; `assets/v6/hawk-atlas.webp` | Preservados. As poses completas existentes atendem às novas trajetórias sem colar asas ou cabeças adicionais. |
| `public/snake/{base,attack,reactions}` | Originais preservados. Dois atlas novos, alto e varredura, seguem a cobra bege com manchas marrons, oito quadros cada, fundo transparente e parte enrolada registrada. |
| `assets/v3/forest.webp`; `assets/v10/season-backgrounds.webp` | Preservados. Cenários pintados já pertencem à identidade aprovada. |
| `assets/v7/trees-{upper,lower}.webp`; `assets/v9/tree-variants.webp` | Preservados. Madeira, musgo, cipó e galhos aprovados. |
| Dez WebP em `assets/Seasons/Winter/`; `assets/v10/tree-variants-snow.webp` | Preservados. Acúmulo gradual e proibição de neve no trecho preso ao teto permanecem. |
| `assets/runtime/{foods,wet-1,wet-2,weather-fx-1,weather-fx-2}.webp` | Preservados. Alimentos e contato com água já harmonizados. |
| `assets/v10/clay-breath.webp` | Preservado. Vapor modelado compatível com o jogo. |
| `assets/v4/{feather,shield}.webp` | Refeitos do zero. Os ícones planos foram substituídos por penas volumosas no mesmo acabamento dos personagens. |
| `assets/v10/season-particles.webp` | Refeito do zero. Pétalas e folhas com aparência modelada substituem o acabamento mais fotográfico. O atlas mantém quatro células e seus significados. |
| `assets/journal/chaua-{portrait,profile}.webp` | Fotos reais preservadas exclusivamente na Chauapédia. |

Os arquivos substituídos foram sobrescritos, sem versões antigas ou alternativas no diretório publicado. Os cinco WebP sem perdas em `art-source/animal-weather/` são fontes ativas do empacotador, acompanhadas de seus prompts. Não há novos fallbacks para desenhos descartados.

## Cobra

Cada cobra executa um ataque: aviso de pelo menos 0,8 s, preparação, investida, recuperação e saída. A seleção alterna os três tipos efetivamente apresentados:

| Ataque | Preparação / investida / recuperação no Desafio | Arte |
|---|---|---|
| Bote frontal | 0,45 / 0,22 / 0,60 s | `attack/attack.webp`, original |
| Bote alto | 0,56 / 0,28 / 0,70 s | `attack/high.webp`, nova |
| Varredura baixa | 0,62 / 0,34 / 0,75 s | `attack/sweep.webp`, nova |

No Amigável, preparação ×1,2 e investida ×1,15. A antecipação também considera a velocidade real, evitando que a cobra só ataque depois da passagem do jogador. O espaço adicional fica abaixo da linha navegável planejada, sem obrigar uma subida repentina. Quando a árvore não comporta a cobra, apresenta-se uma passagem normal e o tipo de ataque fica reservado para a próxima oportunidade com espaço.

As cinco folhas A2 carregam antes de liberar o voo. Base e escala dos atlas novos são registradas pelo empacotador. Renderização, máscaras de colisão, segurança das frutas e contato de neve/chuva usam os mesmos dados. Não há leitura de pixels na partida. Movimento reduzido continua utilizando a pose estável e sua geometria correspondente.

## Gavião

Há mergulho, rasante ascendente e gancho curvo, com aceleração na parte final da aproximação. O alvo é registrado uma vez durante o aviso, ainda com 1,1 s de aviso no Desafio ou 1,5 s no Amigável; em seguida começa o deslocamento. Depois da marcação, o gavião mantém a rota e não acompanha mudanças do jogador. O Amigável também tem aceleração menor. A linha curva prevista, a posição física, a inclinação desenhada e a colisão derivam da mesma função.

Os encontros permanecem isolados de troncos simultâneos. Após ultrapassar o jogador, a ave deixa de ameaçar. Escudo mantém recuo e atordoamento. Esses comportamentos são ficção do jogo, sem afirmar relações reais de predação da espécie.

## Clima

- Chuva: gotas curtas curvas com borda escura e núcleo claro em lotes, três profundidades, mais contraste, volume e contato com superfícies. Não foram recriadas as antigas linhas brancas opacas e longas.
- Neve: mais flocos visíveis, tamanhos variados, núcleo branco sem aro de bolha contra montanhas claras e cristais esparsos em primeiro plano. O acúmulo continua gradual; quantidade de flocos não significa cobertura instantânea das árvores.
- Vento: poucas rajadas longas e curvas com contraste duplo, além das folhas sazonais e balanço existentes. Não foram reintroduzidas as bolinhas duplicadas no fundo.
- Os orçamentos Baixo/Alto continuam limitados. Pausa congela o relógio visual; movimento reduzido suprime as partículas móveis. As escolhas visuais de clima não alteram a física da partida.

## Persistência e verificação

Os ataques afetam os dois modos: regras `floresta-v11`. Recordes v10 e anteriores permanecem no Histórico, com os dados originais intactos; missões e descobertas não são apagadas.

Verificações locais: 302 testes de lógica; nove atlas oficiais com dimensões, transparência e SHA-256; máscaras regeneradas e verificadas; build Sass. Incluem 24 percursos de reação simulada de 120 ms/decisões a 30 Hz sem poderes e checagem de ataque único, espaço livre e alvo fixo. O piloto de calibração de 120 ms completou uma das quatro sementes do Desafio e as quatro do Amigável; isso não estima a taxa de vitória de pessoas.

O CI realiza jornadas completas no navegador, comparação das 40 poses A2 com os pixels reais, contato climático em 264 pontos, legibilidade por pixels em fundos claros e escuros, cenas de ataques/clima em notebook e celular, movimento reduzido e pausa. Capturas ficam nos artefatos `attacks-weather`. Os resultados de CI devem ser consultados no PR; esta documentação não presume aprovação antes da execução. Não há alegação de 60 FPS garantidos em aparelhos físicos.

Reprodução da arte: `python scripts/pack_attack_art.py`, `python scripts/generate-snake-a2-masks.py` e `python scripts/build_animal_weather.py` (Pillow). As fontes e prompts acompanham o commit; imagens de inspeção e resultados temporários ficam fora do checkout publicado.
