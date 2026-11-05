# Action sprites — Chauá Educa Otimizado

**Base exata:** `chaua-educa-otimizado` (`e671547c`). O motor físico, os sprites v6/v7/v8 e o pipeline de renderização existente continuam intocados.

## Ativar para inspeção
1. Extrair `Chaua_Educa_Action_Sprites_Optimizado.zip` na raiz do repositório.
2. Iniciar o jogo no mesmo servidor, acrescentando `?actionSprites=1` ao endereço.
3. Sem esse parâmetro, os sprites originais continuam exatamente como antes.
4. Sem qualquer arquivo WebP, a camada correspondente utiliza automaticamente a arte anterior.
5. Comparar os estados do escudo, voo, cobra e gavião, bem como P95/P99 e RAM.

## Assets WebP preparados, com transparência e célula fixa
- `Chaua-Educa-main/public/parrot/fly/flight.webp` — 4 × 2, 256px/célula.
- `Chaua-Educa-main/public/parrot/animations/impact.webp` — 3 × 2, 256px/célula.
- `Chaua-Educa-main/public/hawk/fly/flight.webp` — 4 × 2, 320px/célula.
- `Chaua-Educa-main/public/hawk/animations/stunned.webp` — 3 × 2, 320px/célula.
- `Chaua-Educa-main/public/snake/animations/strike.webp` — 3 × 2, 320px/célula.
- `Chaua-Educa-main/public/snake/animations/stunned.webp` — 3 × 2, 320px/célula.

**Importante:** as seis imagens geradas NÃO são pixel-idênticas aos sprites originais. As folhas da cobra foram recortadas para remover a madeira duplicada e espelhadas para seguir a orientação do inimigo no jogo. A integração é experimental e requer inspeção artística antes da aprovação.

## Controle de estados
`action-states.mjs` deriva os estados exclusivamente das fases reais e do relógio de simulação:
- Chauá: flight/gliding → shield-rebound ou impact.
- Gavião: warning → flight/glide/dive → shield-impact → stunned → dazed-exit.
- Cobra: watching/warning → windup → strike → recover → idle; escudo desvia para shield-impact → stunned.

**Não alteramos hitboxes, física, frequência de tick, dificuldade, pontuação ou duração dos inimigos.** A direção e a saída do gavião são preservadas; o novo movimento de tontura é visual.

A integração binária dos WebP diretamente pelo conector GitHub não está disponível. O pacote ZIP de imagens deve ser aplicado sobre esta branch para ativá-las.
