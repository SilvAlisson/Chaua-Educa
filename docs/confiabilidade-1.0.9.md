# Confiabilidade da 1.0.9

## Achados e correções

| Achado | Correção | Evidência reproduzível |
|---|---|---|
| Promessa de atlas de aves permanecia rejeitada, sem recuperação | Lotes reiniciáveis e botão para nova tentativa | Bloqueio de uma arte, liberação e início de voo sem recarga |
| Pedidos de imagem antigos podiam preencher um cache depois da falha | Publicação atômica de cada lote; callbacks tardios ficam locais | Falha rápida, sucessos tardios e nova tentativa coalescida |
| Transferência ou decodificação sem resposta podia impedir o início indefinidamente | Limite de 20 segundos, limpeza de callbacks e nova tentativa explícita | Testes de transferência e decodificador pendentes |
| Cache podia esconder atualização de outra aba | Invalidação dos registros duráveis por `storage`; memória não salva protegida | Duas abas, atualizações sequenciais, recarga e preservação dos dois nomes |
| Falha posterior de leitura não preservava tudo que já fora lido | Snapshot de leituras válidas em memória e aviso de indisponibilidade | Bloqueio posterior e consulta dos dados já lidos |
| WebKit podia sinalizar um ciclo de ResizeObserver durante mudanças de tamanho | Atualizações de Canvas agrupadas para o próximo quadro, fora da entrega do observador | Regressões de controles/rotação e sequência de tamanhos em três motores |
| Publicação dependia de conferências separadas de arquivos | Comando único de auditoria, obrigatório no CI | `npm run audit:release` |

## Inventário de publicação

A revisão contém 62 módulos alcançáveis e 108 arquivos verificados, contando a entrada da raiz e as licenças. Não foram encontrados módulos de execução ou imagens/fontes publicadas sem referência. As nove spritesheets originais e as cinco páginas dos atlases de runtime são conferidas por SHA-256. Nenhuma arte foi redesenhada ou removida nesta etapa.

A auditoria segue os imports relativos estáticos e dinâmicos literais, os recursos declarados nos registros de arte, as fotos, as URLs de HTML/CSS e as referências de IDs. Inclui os módulos de diagnóstico sob opção explícita. O relatório lista separadamente metadados, SCSS e documentação dentro do diretório servido, sem tratá-los como pedidos do jogo. Não é um analisador geral de JavaScript arbitrário: novos carregadores com URLs calculadas precisam entrar no registro auditado.

Os 14 endereços externos de fontes/créditos são inventariados e conferidos quanto à estrutura HTTPS; links internos de fontes são conferidos por ID. O CI não depende da disponibilidade de sites de terceiros e não certifica respostas HTTP atuais ou futuras desses endereços. A autoria, CC BY 2.0 das fotos e licenças SIL OFL das fontes ficam disponíveis no jogo e no pacote.

## Persistência e limites

As mesmas chaves e regras `floresta-v14` continuam ativas. São verificados placares, histórico clássico/v13, alimentos, Chauapédia, perguntas para revisão, missões, ajustes e retomada no Amigável, incluindo recarga. Uma retomada continua fora do ranking de voos completos.

Quando `localStorage` está bloqueado ou cheio, o jogo mantém os dados na aba e explica que novos avanços ainda não estão salvos. Fechar/recarregar essa aba pode perder esses avanços; a implementação não promete armazenamento durável sem permissão/espaço. Atualizações externas não apagam a cópia ainda não salva em memória. Os testes cobrem escritas sequenciais em duas abas; escritas simultâneas no mesmo instante continuam sujeitas ao modelo de `localStorage`, que não oferece uma transação entre abas. Não há sincronização de progresso entre contas, aparelhos ou origens diferentes.

## Verificações

- Testes de lógica: timeout de transferência/decodificação, erro de dimensão, decodificação rejeitada, lote parcial, tentativa coalescida, cache entre abas, quota, leitura negada e placar inválido.
- Navegadores Chromium, Firefox e WebKit: falha de floresta, gavião ou cobra, nova tentativa sem recarga, início de voo com as artes obrigatórias, dados preservados e ausência de erro de execução.
- Persistência real do navegador: duas abas, recarga, histórico e progresso das funcionalidades acima; armazenamento bloqueado com aviso e memória de sessão utilizável.
- Regressões anteriores: painéis responsivos, controles, aprendizagem, jornadas, arte e caminho de projeto do Pages.

Os ensaios em Android/iPhone físicos, falhas reais do SO, qualidade percebida e compreensão com jogadores continuam necessários na beta.

## Procedimento de publicação e retorno

1. Na revisão que será publicada: `npm ci`, `npm test`, `npm run build`, `npm run audit:release`. A auditoria gera `test-results/release-audit.json`, com versão, arquivos, bytes e hashes. O CI guarda esse relatório junto às evidências de confiabilidade.
2. Aguarde os resultados da revisão exata no PR. Os resultados de revisões anteriores não aprovam automaticamente uma nova revisão.
3. Para testar no fork, selecione `preparacao-para-a-versao-2.0`, use **Sync fork → Update branch** e mantenha essa branch como fonte do Pages. A main estável permanece separada. O `index.html` da raiz deve estar incluído.
4. Após publicar, confira **Sobre o projeto → Versão 1.0.9**. Teste o nome já usado, coleção, missões, recordes e retomada. Raiz e endereço direto `Chaua-Educa-main/` devem abrir o jogo; durante uma falha de rede, o início deve ficar bloqueado e oferecer a nova tentativa.
5. Para retornar à versão estável, volte a fonte do Pages à main preservada. Isso troca os arquivos servidos; não limpa `localStorage`. O histórico anterior não deve ser apagado. Domínio, perfil do navegador ou armazenamento privado diferente usam outra origem/sessão e não compartilham progresso automaticamente.
