# 1.0.11 — candidata ao lançamento

Estado: preparação técnica em validação. A numeração não certifica a conclusão da beta física nem autoriza publicação da 2.0.0.

## Escopo congelado

Esta revisão consolida as correções da beta: pausa acessível após entrada nativa em tela cheia, casca modular em cache, nova madeira podre e neve que cresce por cobertura com opacidade da arte e gelo descendente. Mantém regras floresta-v14, física, dificuldade, perguntas, progresso, coleção, missões e retomadas. Novas funcionalidades ficam fora desta candidata.

## Pétalas por estação

Outono mantém as 14 partículas no perfil detalhado e 7 no econômico. Primavera passa a 3 e 1, respectivamente; verão e inverno permanecem sem pétalas. Quadros, cores, movimentos e transições do outono são preservados. A revisão de interface 1.0.11-ui2 identifica esse ajuste.

## Correções de manutenção

- Simulações de Canvas passam a representar superfícies e padrões válidos. Os testes de troncos verificam proporção do topo, extensão contínua, alcance limitado pela câmera e reutilização dos padrões, substituindo expectativas da antiga extensão por uma linha esticada.
- A assinatura da madeira podre acompanha o atlas aprovado na 1.0.10.1. O gerador de colisões registra esse arquivo como fonte; as máscaras de alimentos e corpos não são derivadas desse atlas e permanecem intactas. Os testes de integridade continuam calculando os hashes dos arquivos reais.
- Inventário de CI inclui o empacotador de arte com permissão somente de leitura. Não desativa verificações nem concede escrita automática à branch.
- Pacote, lockfile, versão do jogo, CSS, entrada e mapa de módulos usam 1.0.11 para evitar mistura com código de revisões antigas.

## Validação necessária

A revisão exata deve passar pela suíte de lógica, integridade de spritesheets, build Sass sem diff, auditoria de publicação estática, caminho real do GitHub Pages e regressões dos navegadores. A validação estendida cobre Chromium, Firefox e WebKit, além do ensaio nativo de tela cheia. Relatórios e capturas ficam nos artefatos da execução do PR #78. Resultado pendente ou falho impede chamar a candidata de validada.

Critérios humanos continuam abertos: repetir tela cheia durante voo no PC do relato; conferir a nova madeira, emendas e neve jogando; avaliar controles e compreensão com jogadores/educadores; executar sessões em Android, iPhone e notebook. Navegadores automatizados não equivalem a esses aparelhos. O roteiro e as métricas estão em [beta-1.0.10.md](beta-1.0.10.md).

## Requisitos e limites

- O jogo é servido por HTTP/HTTPS, com JavaScript e Canvas 2D. Abrir o HTML como arquivo local não é o procedimento de execução.
- Recursos obrigatórios são locais e precisam terminar de carregar. Falhas devem oferecer nova tentativa sem apagar o progresso.
- Tela cheia, rotação e áudio dependem de suporte e interação permitida pelo navegador. Uma recusa deve manter os controles e a pausa utilizáveis.
- Progresso é local ao navegador e à origem. Usar outro domínio/fork não transfere dados automaticamente. Sem armazenamento disponível, novos dados podem durar somente a sessão.
- A meta de 60 FPS continua sujeita ao aparelho. Resultados de CI não certificam 60 FPS estáveis em hardware físico.
- Revisão do conteúdo com educadores, leitores de tela, teclado virtual, áudio interrompido pelo sistema e conforto visual permanecem parte da beta real.

## Publicação e retorno

Main e GitHub Pages não são atualizados por esta etapa. A 2.0.0 exige aceite específico, conclusão da triagem e repetição dos problemas selecionados sem bloqueantes/graves conhecidos. Créditos e licenças existentes devem acompanhar o pacote.

Se esta candidata regredir, a referência anterior é o commit 3b84a733b39f7ab8ca1eccad665356c3ca409b40. Reverter a revisão de código mantém as chaves de armazenamento; não limpar dados do navegador. Registrar o resultado e repetir os ensaios afetados antes de tentar publicar novamente.
