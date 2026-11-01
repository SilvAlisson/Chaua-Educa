# Cobra: presença e bote único

`snake-wrap-source.webp` é a fonte sem perdas da camada de corpo criada com geração de imagens integrada. Prompt: extensão de corpo sem cabeça, no mesmo cartoon 3D bege com manchas marrons da referência tree6; um segmento contínuo desce pela direita e envolve a frente inferior de um tronco imaginário, deixando o centro transparente; sem madeira, cenário ou texto.

`python3 scripts/prepare_snake_wrap.py` prepara o recorte e os metadados. As regiões de colisão do torso e pescoço são medidas dentro da parte opaca da arte, mantendo os espaços transparentes livres. As poses de cabeça e repouso continuam no atlas v7; escala única passa de 0,37 para 0,52. A nova volta do corpo fica sob a camada da cabeça, junto à madeira.

Comportamento: alerta mínimo 0,8 s, preparação 0,45 s, bote 0,22 s, recuperação 0,6 s; apenas um ciclo por cobra, sem perseguição. Os relógios usam tempo da simulação, congelam durante pausa e interpolam na apresentação. Colisão compreende cabeça, pescoço, parte enrolada e a volta visível do corpo. O escudo desativa todas essas regiões.
