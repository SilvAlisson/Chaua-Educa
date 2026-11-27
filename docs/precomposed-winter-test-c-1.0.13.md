# Chauá Educa 1.0.16 — neve pré-composta

A neve pré-composta é o padrão. Quatro atlas empacotam as copas das árvores
inferiores, superiores e especiais em 16 níveis. As árvores comuns reutilizam
as artes originais nos estados sem neve e totalmente coberto. A parte presa ao
teto fica sem neve. O gerador `scripts/build_precomposed_winter_art.py` usa as
artes aprovadas, preserva o canal alfa da imagem gerada na codificação WebP e
monta a borda de acúmulo fora do jogo.

O jogo seleciona o nível pelo tempo de voo e desenha a copa pronta. O cache da
1.0.15 continua disponível para diagnóstico em `?perf-test=1&perf-ab=baseline`.
O JSON registra `cold` (intensidade do inverno), `snow` (cobertura efetiva)
e `snowStage` (nível da arte).

## Voo de referência gravado

Use a mesma URL base da publicação e acrescente um dos conjuntos abaixo:

| Variante | Parâmetros da URL |
|---|---|
| A — sem neve nas árvores | `?clima=winter&perf-test=1&perf-replay=1&perf-ab=snow-mask-off` |
| B — recorte direto | `?clima=winter&perf-test=1&perf-replay=1&perf-ab=direct-snow` |
| C — neve pré-composta | `?clima=winter&perf-test=1&perf-replay=1&perf-ab=precomposed-snow` |

Selecione qualidade **Alta** no jogo, mantenha **Leve** no diagnóstico e pressione
**Executar voo de referência**. Não é necessário tocar nos controles de voo.
A trajetória de 41,24 s usa a semente 3169729328, 64 toques e uma resposta ao quiz,
nos mesmos passos da física. Aguarde o indicador de conclusão e baixe o JSON.
Um resultado completo deve ter `replay.completed: true`, 4.949 passos e 115 pontos.
A trajetória cobre os primeiros estágios de acúmulo no inverno forçado. As transições
entre estações e a neve completamente acumulada continuam exigindo outros cenários.

Use `&perf-hz=120` em uma tela configurada para 120 Hz. Sem esse parâmetro, a meta
é 60 Hz. A frequência indicada é a meta selecionada, e não uma medição do monitor.
O relatório traz o orçamento nominal, a tolerância para variações de agendamento,
o percentual de quadros fora do orçamento, o tamanho interno do canvas e as
janelas por tempo de voo. Compare A/B/C no mesmo dispositivo e no mesmo tamanho
de canvas, com o mesmo perfil gráfico e a mesma instrumentação.

Com `npm start`, o servidor informa o SHA do checkout e se os arquivos publicados
têm alterações locais. Em hospedagem estática, inclua no HTML a tag
`<meta name="chaua-git-commit" content="<SHA completo da publicação>">` ou acrescente
`&perf-commit=<SHA completo>` ao teste. O relatório distingue o SHA informado
pela build de um SHA declarado na URL.
