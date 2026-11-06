# Cobra A2 — experimento opt-in na branch otimizada

**Base:** chaua-educa-otimizado (e671547c). Esta branch não é mesclada automaticamente.

## Uso

Instale os três WebP incluídos no arquivo entregue no ChatGPT, preservando os caminhos:
- Chaua-Educa-main/public/snake/base/idle.webp
- Chaua-Educa-main/public/snake/attack/attack.webp
- Chaua-Educa-main/public/snake/reactions/stunned.webp

Abra o jogo com ?snakeA2=1. Sem o parâmetro, ou se algum WebP faltar, os sprites originais são usados.

## Estados
- watching/warning → base; windup (0,45s)/striking (0,22s)/recovering (0,60s) → ataque
- retreat && dazed → atordoamento; spent/leaving → neutro

A A2 é o **corpo inteiro em uma única spritesheet**. Não sobrepor snake-wrap.webp nem as poses da cabeça antiga. O tronco continua independente, com os mesmos colliders e a mesma física.

## Limite artístico conhecido
A cobra redesenhada fica enrolada **em cima do tronco**, enquanto a versão antiga envolvia fisicamente a madeira. Aprovação final de encaixe/escala no jogo ainda é necessária. O abraço anatômico da árvore depende de novas poses de apoio e da fase B dos troncos. Não afirmar que isso já está resolvido.

## Custo visual e desempenho
- 3 atlas 1536×768 RGBA (~13,5 MiB brutos adicionais de texturas, sem mipmaps/overhead) carregados somente com ?snakeA2=1.
- 1 drawImage por cobra quando A2 disponível; nenhum extra por-cobra no caminho padrão.
- Posição e hitbox física intocadas. Comparação visual, desempenho P95/P99 e contato real com escudo ainda exigem testes no navegador com as três imagens instaladas.

**Não aprovar o PR só com testes de seleção de quadros: os WebP foram entregues em pacote separado, não neste commit do GitHub.**
