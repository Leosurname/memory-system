---
name: remember
description: >
  Resume a conversa atual em memórias temáticas e grava cada uma no Memory
  System do Leo via terminal (npm run add-memory em /Users/leo/Memory system).
  A árvore de memórias se reorganiza sozinha por similaridade semântica.
  Use sempre que o usuário pedir para salvar/gravar/lembrar algo desta conversa
  ("salva isso", "grava na memória", "lembra disso", "/remember", "adiciona às
  memórias"), ao encerrar uma sessão de trabalho relevante, e também
  proativamente quando decisões importantes, arquiteturas, preferências do
  usuário ou eventos marcantes acontecerem na conversa — mesmo sem pedido
  explícito.
---

# Remember — gravar memórias da conversa

O Memory System (`/Users/leo/Memory system`, repo
[memory-system](https://github.com/Leosurname/memory-system)) guarda resumos de
conversas como **memórias** e as organiza sozinho numa árvore por similaridade
de embeddings. Quem escreve memórias é **você (Claude), via terminal** — o
usuário nunca cria memórias manualmente; o app é só um visualizador.

## O que gravar

Percorra a conversa e identifique os **temas distintos com valor durável**:
decisões tomadas (e o porquê), arquiteturas definidas, preferências do usuário,
eventos importantes, erros que ensinaram algo. Ignore o efêmero: tentativas
descartadas, small talk, detalhes que o código/git já registram.

Uma memória por tema — não um resumo gigante da conversa inteira. O clustering
funciona melhor com memórias focadas: cada uma vira uma folha da árvore, e temas
parecidos se agrupam sozinhos.

## Como escrever cada memória

- **Título**: curto e descritivo; as palavras do título viram os rótulos dos
  galhos da árvore, então use termos que nomeiem bem o tema
  (ex: "Clustering: aglomerativo com average linkage", não "Coisas técnicas").
- **Resumo**: markdown, autocontido — quem lê daqui a meses não tem o contexto
  da conversa. Datas absolutas (2026-07-10, não "hoje"). Cite nomes de
  arquivos, repos e números concretos quando importarem.

## Como gravar

Para cada memória, rode (resumo via heredoc — evita brigas de escaping com
aspas e crases do markdown):

```bash
cd "/Users/leo/Memory system" && npm run add-memory -- "Título da memória" <<'EOF'
Resumo em **markdown**…
EOF
```

Confirme a saída `✅ memória "…" gravada (N no total)` de cada uma.

Notas:
- A primeira execução na máquina baixa o modelo de embedding (~23MB, demora
  ~1 min); as seguintes são rápidas.
- Não categorize nem escolha "pasta": a árvore se reorganiza sozinha a cada
  memória nova.
- Se o app estiver aberto (`npm run dev`), o Vite recarrega e mostra a árvore
  atualizada na hora.

## Ao final

Diga ao usuário quantas memórias gravou e os títulos, em uma linha cada.
