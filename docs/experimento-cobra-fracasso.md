# Cobra articulada · segunda comparação

Experimento exclusivo da branch `Fracasso`, baseado na preparação 1.0.4. Não substitui a cobra do jogo. Nenhuma alteração em colisões, árvores, aves ou dificuldade.

## Como testar

Atualize a branch `Fracasso`, execute `npm ci` e `npm start`, abra `http://127.0.0.1:5501/lab-snake-compare.html`. Para jogar a versão preservada, abra a raiz do mesmo servidor.

Compare primeiro uma cobra em velocidade 1×, nos três ataques. Depois use 0,2×, pausa, controle de tempo e curva/encaixes para inspecionar junções. O modo com 12 cobras é carga de desenho; não representa uma partida real. Em mobile os painéis ficam empilhados e a página do laboratório permite rolagem para as duas comparações; a interface do jogo não foi alterada.

## O que mudou

O antigo recorte de imagens completas em 22/24 faixas foi removido. O protótipo não conserva o antigo código nem os canvases de poses normalizadas. Agora usa um atlas próprio de peças (base, textura do pescoço, cabeça fechada/aberta), uma curva Bézier para o pescoço e uma cabeça rígida. A curva tem 12 segmentos texturizados com pequena sobreposição contra frestas. O corpo enrolado cobre a raiz do pescoço. Não há duas cabeças por transparência, leitura de pixels ou preparação de superfícies durante a animação.

As posições e rotações de fim/início de preparação, bote e recuo coincidem. Cada ataque tem um alvo geométrico distinto e fixo durante o movimento. A expressão da boca tem duas poses e ainda troca diretamente: uma mandíbula separada seria o próximo passo caso o resultado visual seja aprovado. Atordoamento nesta amostra usa oscilação rígida; não substitui a expressão atordoada oficial. Não é um rig final aprovado para produção.

O laboratório usa os tempos reais dos três ataques, reinicia os estados ao trocar controles, permite pausa/seek e respeita movimento reduzido. Removidas as afirmações fixas de 8/60 FPS e menor VRAM. As medições atuais mostram mediana/p95 do envio de comandos CPU e intervalos da página inteira, com ordem de desenho alternada e 30 renderizações iniciais descartadas. Não demonstram ganho de FPS ou memória do jogo.

O renderer novo envia 14 drawImage por cobra (12 pescoço + base + cabeça); o anterior enviava até 49 e redesenhava tudo para gerar guias. O oficial continua mais simples, com um drawImage. Contagem de comandos não equivale a performance medida.

## Arte ativa e origem

`Chaua-Educa-main/public/snake/experimental/rig-parts.webp`: atlas RGBA 1254×1254, WebP sem perdas, 560714 bytes. É a única nova imagem persistida no projeto. Gerada com o gerador de imagens integrado, usando a spritesheet oficial como referência visual, e empacotada sem alterar os pixels. Os retângulos de consumo ficam em `RIG_PARTS`. Não há backup PNG publicado nem arte antiga descartada dentro da branch.

Prompt: atlas transparente 2×2 com quatro peças isoladas: base enrolada sem cabeça/pescoço; segmento vertical de pescoço sem cabeça/base; cabeça de perfil voltada à esquerda com boca fechada; a mesma cabeça com boca aberta. Manter pele caramelo com manchas chocolate, barriga creme, olhos grandes e acabamento de argila/3D suave da cobra oficial. Sem objetos externos, texto, membros extras ou partes duplicadas. A ferramenta produziu 1254×1254; metadados e validação usam o tamanho real.

## Critério de decisão

Aprovar apenas se o rosto mantiver identidade, as junções não incomodarem, os três ataques ficarem legíveis e o movimento agradar mais que a referência no aparelho real. Se o acabamento por peças perder para a arte intacta, a spritesheet continua sendo a escolha adequada. Este experimento não autoriza merge nem troca da arte pública.

Verificação automatizada: continuidade das fases, alvos distintos, âncora, geometria finita, movimento reduzido, carga compartilhada, limite de comandos e hash do atlas em `tests/snake-articulated-proto.test.mjs`. `tests/browser-snake-lab.cjs` percorre os três ataques/fases em desktop e mobile, testa controles, redução de movimento e erro de imagem; integrado ao QA Chromium/WebKit, com capturas nos artefatos do PR.

## Continuação: medição isolada e resultado exportável

A comparação agora permite “Somente oficial” e “Somente articulada”: apenas o renderer selecionado desenha e recebe amostras. Trocar controles reinicia o aquecimento de 30 quadros. Pausar/reproduzir também limpa as medições para não misturar amostras de geometria parada e animada. A janela guarda até 600 amostras por métrica.

“Baixar medições JSON” exporta os tempos brutos, mediana/p95/p99, intervalos acima de 33,33 e 50 ms, controles, navegador e viewport. Métricas sem amostras ficam nulas. Não mede VRAM/GPU nem promete ganho no jogo. Para comparação, use a mesma quantidade de cobras, ataque, velocidade e guias; espere cerca de 10 segundos em cada modo isolado e salve um JSON por modo.

O controle de tempo pausado mantém 100% no fim da fase, em vez de retornar à primeira pose. O ciclo em reprodução continua repetindo. QA de navegador cobre esse limite, exclusão do renderer oculto e download/leitura do JSON. O job “snake-experiment” do workflow de QA estendido roda nos pushes da branch `Fracasso` e publica capturas da comparação.
