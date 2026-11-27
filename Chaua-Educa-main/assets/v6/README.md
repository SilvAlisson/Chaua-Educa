> Referência histórica da criação dos atlases. Na publicação atual, apenas `chaua-atlas.webp` e `hawk-atlas.webp` desta pasta são usados para poses específicas. A cobra antiga foi retirada; os cinco atlases obrigatórios atuais ficam em `public/snake/`. As tabelas e os prompts abaixo documentam a origem das artes, não um manifesto de carregamento.

# Animações v6

Artes criadas com o gerador integrado de imagens, usando as referências originais do jogo. Dois atlases WebP sem perdas, 1536 × 1536, grade 4 × 4, células 384 × 384, com transparência e margens entre quadros. Ordem de leitura: esquerda para direita, de cima para baixo. O jogo carrega apenas os atlases; os PNGs em `art-source/characters/` preservam a saída original para nova preparação.

| Atlas | Quadros (índices a partir de zero) |
| --- | --- |
| `chaua-atlas.webp` | 0–7 voo; 8–11 pouso; 12 repouso; 13 piscar; 14 impacto; 15 recuperação |
| `hawk-atlas.webp` | 0–7 voo; 8–9 planar; 10–11 mergulho; 12–15 reação e recuperação |
| `snake-atlas.webp` | 0–3 repouso; 4–7 alerta; 8–11 recolher; 12–15 aparecer |

A cobra é um animal inteiro em cada quadro, sem madeira incorporada. Troncos e galhos são desenhados em Canvas e não desaparecem com ela. As aves têm uma referência comum no bico, escala uniforme por pose e âncora fixa. A inclinação intrínseca dos dois quadros de mergulho é compensada na preparação, para a trajetória aplicar a rotação uma única vez. A normalização reduz saltos de registro; não torna desenhos diferentes matematicamente idênticos.

`manifest.json` e `js/sprite-data.mjs` são gerados juntos. Registram recorte, âncora, conteúdo, olho ou cabeça, posição no PNG original e compensação de orientação. A cabeça da cobra usa os mesmos metadados na renderização e na colisão. Nas aves, corpo e cabeça têm colisões arredondadas tolerantes, sem tornar cada pena um perigo.

## Reproduzir a preparação

Na raiz do repositório, com Python 3 e as dependências de `scripts/requirements-art.txt`:

```sh
python3 scripts/prepare_sprite_atlases.py Chaua-Educa-main/assets/v6/sources
```

O script extrai os 16 componentes principais, remove resíduos de transparência externos, registra as poses, verifica margens e codifica WebP sem perdas. Não gera nem redesenha personagens. Direção de arte e resumo dos prompts: [PROMPTS.md](PROMPTS.md).

**Atualização:** o gerador produz somente Chauá e gavião, a partir de
`art-source/characters/`. A fonte histórica da cobra foi removida; as únicas
folhas ativas da Cobra A2 ficam em `public/snake/`.
