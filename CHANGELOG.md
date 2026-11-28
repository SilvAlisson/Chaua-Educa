# Changelog

## 1.1.0

- Consolida o PixiJS/WebGL, o fundo sazonal direto do atlas, o brilho das frutas sob chuva, o carregamento progressivo da neve e a cena persistente.
- Faz frutas e poderes entrarem pela borda direita. Se faltar espaço para o poder antes da trilha, ele entra depois da última fruta.
- Atualiza o voo de referência do inverno para identificar a nova posição dos itens nos relatórios.

## 1.0.16

- Ativa as copas nevadas pré-compostas como padrão, com 16 níveis em quatro atlas.
- Suaviza a borda de acúmulo e distingue cobertura de intensidade do inverno no relatório.
- Refina o movimento das pétalas, das folhas, a iluminação de verão e a chuva de tempestade.

## 1.0.15

- Compara cache de copas e recorte direto no mesmo voo de referência.
- Inclui contadores de reconstruções, acertos de cache e recortes diretos no JSON.

## 1.0.11 — candidata em validação

- Reduz as pétalas da primavera para 3 no perfil detalhado e 1 no econômico; preserva o outono com 14/7 e mantém verão/inverno sem pétalas. Revisão de interface 1.0.11-ui2.

- Consolida correções de tela cheia, casca modular, madeira podre e neve progressiva sólida da 1.0.10.1.
- Atualiza simulações de Canvas e expectativas de geometria dos testes, assinatura do atlas da madeira podre e inventário de workflows; verificações de integridade e colisões mantidas.
- Alinha pacote e interface e documenta congelamento de funcionalidades, requisitos, limites e retorno. Progresso e regras floresta-v14 preservados.
- Testes da revisão exata, beta em aparelhos físicos e aprovação de lançamento são critérios distintos. Main e publicação permanecem separadas desta preparação.

## Versão jogável 1.0.0

- Integra a V2 de renderização e áudio, os sprites de ação, a cobra A2 e a
  separação de frutas e cobras por silhueta.
- A entrada do Refúgio usa quatro faixas em canvases intermediários.
- O acesso padrão carrega os novos sprites. O fallback preserva o jogo caso
  os arquivos de arte não carreguem.
- 1.0.0 é a identificação da versão jogável. A versão interna do pacote
  continua em 2.5.0 para preservar a sequência de versões.

### Alterado

- Resolução interna e densidade de decoração agora têm controles independentes
  no renderizador. Detalhada e Econômica mantêm os mesmos limites de pixels e
  efeitos; o modo Automático continua escolhendo os mesmos perfis. A separação
  permite avaliar nitidez e efeitos individualmente antes de mudar o orçamento.

### Corrigido

- A qualidade visual automática agora reconhece quadros rápidos e lentos
  alternados e travamentos recorrentes acima de 100 ms durante o voo.
  Antes, um quadro rápido ou um atraso longo apagava a evidência de lentidão.
- A decisão usa uma janela móvel de dois segundos: se pelo menos 35% desse
  tempo estiver em quadros acima de 1/42 s, reduz a qualidade. Um atraso isolado
  não provoca a redução. Os intervalos são limitados a 250 ms, como no loop.
- Após uma redução automática, a qualidade permanece reduzida durante o voo.
  Uma nova partida ou a seleção explícita de Automático permite reavaliar Alta.
  Pausa, inatividade e amostras inválidas limpam a medição sem elevar a qualidade;
  as escolhas manuais Alta e Baixa permanecem respeitadas entre partidas.

### Validação

- Regressões de lógica para lentidão mista, atrasos isolados, expiração da
  janela, inatividade, novos voos, escolhas manuais e telas de 60–240 Hz.
- `npm run test:quality` exercita o loop real, a resolução do canvas, as
  configurações, pausa/retomada e movimento reduzido no Chromium. Incluído no CI.
- A02/P02 do plano de evolução. Esta correção altera somente a adaptação visual;
  não muda física, encontros, pontuação, assets ou versão das regras.
- Validação física em Android/iOS continua pendente; os testes automatizados
  não demonstram ausência de stutters em todos os aparelhos.

O histórico das versões anteriores está no [README](README.md).
