# Climas V3 — Etapa 5: baforadas geladas e microefeitos

## Diretriz artística inegociável

Não criar nem substituir cabeças, bicos, asas, caudas ou corpos. A única arte
de baforada utilizada é a já aprovada **`assets/v10/clay-breath.webp`**
(atlas RGBA com quatro quadros). As artes das criaturas não foram modificadas.

Também não introduzimos spritesheets para chuva e flocos; ambos permanecem
procedurais. Os dois SVGs experimentais do PR #63 **não são importados**.

## Integração no inverno do PR #67

O `winterAmount(game)` controla a intensidade do frio em todo o render.
O módulo `winter-vfx.mjs` fornece configurações determinísticas por animal e
pequenos cristais que se soltam sob movimentos bruscos. Nenhum temporizador
novo, nova dependência ou sistema de partículas persistente foi criado.

| Criatura | Baforada | Origem visual | Cristais |
|---|---|---|---|
| Chauá | Período ~2,85 s, 2 quadros de vapor escalonados | Mesma posição do bico atual, no referencial local | Durante impulso de batida de asa |
| Cobra | Período ~3,65 s, deslocado por ID | Posição relativa à caixa de cabeça **já existente** e atualizada pela animação | Ameaça, bote, recuperação e sacudida |
| Gavião | Período ~4,15 s, discreta e apontando no sentido de voo | Posição original do bico em coordenadas do atlas | Início de mergulho ou recoil breve |

*Observação:* "2 quadros de vapor escalonados" significa duas **instâncias**
da **mesma sequência de quatro quadros**, não um atlas novo. No modo Low
apenas uma instância é usada, com frequência reduzida.

### Condições de exibição

- Aparece somente quando o inverno está presente, com limiar acima de 18%.
- Fica mais discreta durante ação rápida e não aparece em impacto fatal.
- Não há baforada durante boost do Chauá, saída atordoada da cobra/gavião
  ou quando o recurso "movimento reduzido" está ativo.
- Neve desprendida precisa de pelo menos 32% de inverno e ação de força
  suficiente; no modo Low reduz de cinco para dois cristais.
- Todos os movimentos são determinísticos em tempo de simulação: pausa
  não produz microefeitos novos.

## Limitações que serão auditadas no PR 07

A posição anatômica da cabeça da cobra varia ao alternar entre sprite base
e arte A2. Usamos a caixa de cabeça deformada atualmente pelo jogo como
referência, sem mudar seu desenho ou hitbox. Conferir capturas reais para
ajustar a origem visual do vapor às bocas em todas as poses antes do merge.

As alterações da Etapa 5 foram enviadas sem executar auditoria visual ou
testes manuais de forma isolada, conforme decisão do proprietário do projeto
de concentrar a validação **após concluir todas as etapas**. A abertura do PR
não significa aprovação final ou que os 60 FPS estão comprovados.

## Invariantes

- Nenhum arquivo `assets/*` modificado nem novo.
- Nenhuma alteração na física, no score, no shield ou na lógica de Game Over.
- O PR #62 terá seu atordoamento fatal conciliado na Etapa 6.
- O PR #63 permanece experimental e separado.
