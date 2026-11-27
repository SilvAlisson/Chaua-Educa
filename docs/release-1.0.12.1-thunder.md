# Chauá Educa — v1.0.12.1 · trovões reais (revisão de áudio)

Branch: `preparacao-para-a-versao-2.0`. Sem merge automático para `main`.

## Fonte e licença
- **BigSoundBank Thunder #3 (ID 3114)**: https://bigsoundbank.com/thunder-3-s3114.html
- **BigSoundBank Thunder #5 (ID 3116)**: https://bigsoundbank.com/thunder-5-s3116.html
- Licença indicada na fonte: CC0. Arquivos originais fornecidos pelo usuário.
- Dois uploads de Thunder #5 eram idênticos (mesmo SHA-256); apenas uma cópia foi utilizada.

## Processamento
`Chaua-Educa-main/sounds/thunder-real.mp3` é um pacote mono MP3 de 24 kHz / 24 kbps, cerca de 16,8 KB. Foi editado a partir de dois trechos reais:
- **Próximo:** 0–2,50 s de áudio, vindo de Thunder #3 (original cortado em 1,20–3,70 s).
- **Distante:** 2,62–5,47 s, vindo de Thunder #5 (original cortado em 1,05–3,90 s).
- Há 0,12 s de silêncio entre trechos. Ambas as gravações receberam fades curtos de entrada/saída e ajuste moderado de ganho.
- MP3 decodificado uma vez após a interação do usuário e reutilizado em memória. O carregamento é assíncrono e não está no RAF.

## Comportamento
- O controlador `lightning.mjs` continua sendo a fonte única dos momentos de descarga visual e sonora.
- Três padrões determinísticos usam as duas gravações: curto com atraso de 0,12 s, intermediário de 0,32 s e longo de 0,54 s após o clarão.
- O processamento antigo de estalos elétricos, onda de choque e rugido procedural foi removido.
- Pausar, abrir quiz, silenciar ou perder foco interrompe a fonte atual com fade breve; reiniciar libera o mesmo índice para uma nova tentativa.
- Caso o arquivo falhe ao carregar, o evento permanece silencioso, sem recorrer ao antigo chiado sintetizado.
- O arquivo está pré-carregado como recurso do Pages e consta da auditoria offline de release.

## Validação
`npm test` inclui `tests/thunder-1121.test.mjs`. O áudio deve ser conferido com fones e alto-falantes reais no navegador antes da homologação definitiva.

## Revisão de durações e iluminação de cena
- **Curto:** fonte de áudio real Thunder #3, recorte de **0,90 s**, atraso de **0,12 s** após o relâmpago.
- **Intermediário:** fonte Thunder #5, recorte de **1,35 s**, atraso de **0,32 s**.
- **Prolongado:** fonte Thunder #3, recorte de **2,45 s**, atraso de **0,54 s**.
- Variação discreta de velocidade de reprodução limitada a **0,97×–1,03×**. Durações audíveis aproximadas: **0,87–0,93 s / 1,31–1,39 s / 2,38–2,53 s**, atendendo às faixas 0,8–1,0 / 1,2–1,5 / 2,0–2,8 s.
- Os recortes respeitam os limites individuais das gravações dentro do MP3 de 5,47 s. Não existe mais trecho longo atravessando o silêncio separador.
- São três **durações** distintas, mas ainda somente **duas gravações originais** (#3 e #5), porque os outros dois uploads eram duplicatas.
- O brilho continua na camada do céu e sobre a cena completa (árvores, Chauá e efeitos climáticos), usando composição `screen`, com avisos de perigo desenhados por cima.
- A preferência por movimento reduzido suprime os clarões visuais, sem bloquear o som.
- Testes cobrem os limites de duração, incluindo velocidades extremas, e a iluminação em tela inteira.
