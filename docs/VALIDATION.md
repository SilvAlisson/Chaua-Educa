# Validação da remodelação

## Verificado automaticamente

- Compilação estrita de TypeScript e build de produção Vite.
- 24 testes do motor, persistência e contratos dos sprites.
- Mesma partida de 24 segundos, entradas por tick e aleatoriedade fixa em 60, 120, 144, 180 e 240 frames/s: mesmo estado lógico, obstáculos, frutas e pontuação.
- Pausas, contagem, limite de recuperação de tempo, coleta, bônus, ausência de pontos por coleta perdida, término único por colisão, vitória por coleta, modos de quiz e reinício.
- Retomada de 1,5 segundo sem mover o mundo, pausa durante a retomada, descarte de impulsos antecipados, dificuldade por distância e animação após reinício.
- Rankings separados, manutenção da chave legada e tratamento de armazenamento inválido/indisponível.

## Pendente antes de considerar pronto para produção

Não houve teste visual/interativo no navegador nesta sessão: a ferramenta de navegador compatível não estava disponível. Os testes de simulação não substituem essa validação.

1. Abrir `npm run dev` em desktop e celular; conferir carregamento dos sprites, layout e legibilidade.
2. Executar uma partida por teclado e toque; avaliar hitboxes, ritmo, dificuldade e locais de coleta.
3. Responder corretamente e incorretamente nos dois modos; verificar foco do modal e retomada sem salto.
4. Pausar, trocar de aba, abrir configurações durante o voo e reiniciar várias vezes.
5. Testar áudio após interação inicial, silêncio, movimento reduzido e navegação por teclado.
6. Conferir a importação de `db-chaua` na mesma origem da versão antiga e persistência após recarregar.
7. Medir desempenho em um celular e computador de menor capacidade e revisar tamanho do bundle Phaser (~332 KB gzip nesta compilação).
8. Revisão pedagógica das oito perguntas atuais e ampliação editorial do conteúdo. Os links institucionais estão em `src/data/content.ts`.

As artes anteriores permanecem em `public/assets/v2`. A coleção ativa em `public/assets/v3` contém novas ilustrações de massinha: quatro poses, sete itens, três troncos e cenário. Foram inspecionados recortes e dimensões; a animação integrada, o alinhamento final e a dificuldade ainda precisam de avaliação em partida real. Não foi realizada medição de desempenho em dispositivos físicos.
