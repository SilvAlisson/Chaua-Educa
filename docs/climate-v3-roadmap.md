# Roadmap técnico — Climas V3 do Chauá Educa

## Evidência da calibração (11/11/2026)

O workflow `Validate game` do PR #62 registrou, no teste real de jornada no navegador com piloto automatizado e seed 104:

| Modo | Vitória | Tempo efetivo de voo | Pontos no fim |
| --- | --- | ---: | ---: |
| Aventura | Sim | 827,42 s (13min47s) | 1009 |
| Tranquilo | Sim | 794,26 s (13min14s) | 1002 |

**Ampliação confirmada no PR #64:** quatro partidas vitoriosas por modo (oito no total). A mediana do tempo de voo foi **633,25 s para Aventura** e **757,76 s para Tranquilo**; faixa entre partidas vencedoras: 523,72–775,87 s (Aventura) e 737,17–820,39 s (Tranquilo). **Limitação:** são simulações automatizadas, não uma média de jogadores humanos. O relatório completo é salvo como artefato do CI; os dados não alteram física, score nem regras de vitória.

### Defeito estrutural confirmado

O mundo limita a distância a `JOURNEY_LENGTH = 28000` (`engine.mjs`), mas a pontuação de vitória (`VICTORY_SCORE = 1000`) pode demorar muito mais a ser alcançada. Os climas atuais são calculados por distância: depois que a distância satura, a progressão climática **congela**, explicando inverno ausente ou muito breve em partidas longas.

**Diretriz:** estação usa `game.elapsed` (tempo efetivo de voo). O score continua servindo apenas à conquista e à chegada ao refúgio; o comprimento físico do mundo, os quatro estágios, a física e as regras de encontros permanecem intocados.

### Referência experimental

O módulo puro `js/climate-progress.mjs` converte `elapsed` em `[0,1]`, com as medianas de 633,25 s (Aventura) e 757,76 s (Tranquilo). Uma variação determinística de até ±4% pelo seed evita mudanças no mesmo instante exato em todas as partidas. Nenhum valor de pontos entra na função. A progressão não retrocede; o tempo efetivo não avança em pausa, quiz ou game over.

## Contrato de integração de PRs

1. **PR 01 — Calibração**: telemetria determinística, baseline e função pura sem alterar gameplay ou render. Aguardar CI e dados adicionais; não supor que seeds de autopilot representem jogadores.
2. **PR 02 — Estações**: integrar o relógio ao `seasons.mjs`, com a ordem *primavera → verão → outono → inverno*, usando os índices **verificados diretamente na WebP** (0,1,2,3). Proposta inicial de inícios em 0%, 23%, 47% e 71%; crossfades suaves ~6%. **Medir** cobertura de inverno, transições e comportamento de partidas curtas/longas, sem gatilhos de pontos.
3. **PR 03 — Chuva e superfície molhada**: reconciliar o PR #62 com PR 02, conectar chuva/vento/névoa à mesma fonte. Chuva principal procedural, pequenas ondulações/splash artísticos opcionais. Nada de traços brancos opacos. Referência de aparência = assets existentes.
4. **PR 04 — Inverno**: neve procedural, transição sincronizada de fundo/árvores/Chauá/cobra/gavião, sem pétalas no inverno. Respeitar máscaras/silhuetas; não redesenhar anatomia. Derretimento gradual.
5. **PR 05 — VFX de baforada**: baforada **apenas** em inverno, usando `assets/v10/clay-breath.webp` como referência absoluta. Não aceitar VFX do PR #63 antes de inspeção artística; PR #63 está em draft.
6. **PR 06 — Impacto**: recuperar a distinção de 0,30s com escudo e atordoamento fatal até game over já implementada no PR #62; validar visualmente sem reabrir a física.
7. **PR 07 — Polimento**: responsividade, modo reduzido, perf por fase, screenshots de clima, 60 FPS-alvo, picos >33ms, imagens da arte original, compatibilidade Chromium/Firefox/WebKit.

## Invariantes de aceitação

- `VICTORY_SCORE === 1000` e `JOURNEY_LENGTH === 28000` permanecem inalterados.
- Nenhuma condição `score >= N` para mudar estação.
- Todos os sistemas climáticos recebem o mesmo progresso e sua intensidade; não podem discordar sobre neve/chuva.
- Qualquer modificação visual exige comparação contra spritesheets atuais, inclusive anatomia e pontos de ancoragem dos animais.
- Nunca introduzir novas cabeças/rostos/caudas; VFX não substituem o personagem.
- As partículas atmosféricas principais são procedurais; spritesheets são **efeitos pequenos de apoio**.
- Não fazer merge com CI vermelho ou sem inspeção dos efeitos novos.
