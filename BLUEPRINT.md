# Blueprint — Sistema de Memória por Similaridade (árvores auto-organizadas)

Documento de arquitetura. Fonte de verdade para a implementação.

**Repositório:** https://github.com/Leosurname/memory-system (público)

---

## 1. Visão

Sistema de memória para o Claude. **O Claude resume as mensagens de uma
conversa** e grava o resumo como uma **memória** — **via terminal, nunca pela
UI** (issues #1–#3). O app é um **visualizador somente leitura**: organiza
sozinho as memórias em uma **árvore por similaridade** (clustering hierárquico
de embeddings).

Web app: React + Vite + TypeScript, sem backend. Roda em `npm run dev`.

A "árvore matemática" = **dendrograma** do clustering aglomerativo:
- **folha** = uma memória (resumo)
- **galho (nó interno)** = cluster de memórias semanticamente parecidas

---

## 2. Fluxo principal

```
Claude resume a conversa
        │
        ▼
npm run add-memory -- "Título" "Resumo em markdown"
        │   (scripts/add-memory.mjs, roda em Node)
        ▼
embedding 384-dim (transformers.js, Xenova/all-MiniLM-L6-v2)
        │
        ▼
append em src/data/memories.json  ──►  Vite recarrega o app (HMR)
        │
        ▼
app recomputa o dendrograma e mostra a árvore reorganizada
```

O usuário **não cria memórias**. Só navega, lê e busca.

---

## 3. Modelo de dados

```ts
// src/types.ts
export interface Memory {
  id: string
  title: string
  summary: string      // markdown: o resumo das mensagens
  embedding: number[]  // 384-dim; [] = falha do modelo → "Não classificadas"
  createdAt: number
  source?: string      // ex: "conversa 2026-07-10"
}

export type ClusterNode =
  | { kind: 'leaf'; memoryId: string }
  | { kind: 'branch'; id: string; label: string; height: number; children: ClusterNode[] }
```

- Persistimos **apenas as memórias** (com embeddings) em `src/data/memories.json`.
- A **árvore é derivada** — recomputada no load. Nunca persiste.

---

## 4. Camadas

```
┌──────────────────────────────────────────────────────────┐
│  ESCRITA (terminal, Node)                                  │
│  scripts/add-memory.mjs — embedding + append no JSON       │
├──────────────────────────────────────────────────────────┤
│  DADOS                                                     │
│  src/data/memories.json — única fonte de verdade           │
├──────────────────────────────────────────────────────────┤
│  LEITURA (app React, somente leitura)                      │
│  vaultStore (Zustand) importa o JSON e deriva a árvore     │
│  UI: TreeView · MemoryView · SearchBar                     │
├──────────────────────────────────────────────────────────┤
│  Clustering — src/lib/cluster.ts (puro, testável)          │
│  aglomerativo (cosine, average linkage) + simplify         │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Clustering (`src/lib/cluster.ts`)

- Distância = `1 - cosseno` (vetores normalizados → dot product).
- **Aglomerativo, average linkage**: cada memória começa como cluster; funde os
  2 mais próximos até sobrar 1 → dendrograma. O(n³) ingênuo, suficiente para
  centenas de memórias.
- `simplify(threshold=0.35)`: achata galhos apertados num grupo plano por tema
  (preserva um galho por tema; não dissolve grupos na raiz).
- `label`: palavras mais frequentes dos títulos das folhas (stopwords pt/en).
- Casos-limite: 0 memórias → `null`; 1 memória → folha única.
- Testável isolado (`npx tsx`): 2 temas ortogonais → 2 galhos na raiz.

---

## 6. Componentes (app somente leitura)

- **App** — layout 2 colunas: `<Sidebar>` (SearchBar + TreeView) | `<MemoryView>`.
- **TreeView / NodeView** — dendrograma recursivo; galhos expand/collapse com
  rótulo + contagem; folhas selecionáveis; grupo extra "Não classificadas" para
  memórias sem embedding.
- **MemoryView** — título, metadados (data, fonte) e resumo renderizado
  (react-markdown + remark-gfm).
- **SearchBar** — filtro textual (título + conteúdo).

---

## 7. CLI de escrita (`scripts/add-memory.mjs`)

- `npm run add-memory -- "Título" "Resumo"` (resumo também via stdin).
- transformers.js em **Node**: `feature-extraction`, mean pooling + normalize L2.
- Modelo baixa 1x (cache do huggingface); execuções seguintes são rápidas.
- Fallback: falha de modelo → grava com `embedding: []` → grupo "Não
  classificadas" na UI.

---

## 8. Stack

`react` · `react-dom` · `vite` · `typescript` · `zustand` (estado do viewer) ·
`react-markdown` + `remark-gfm` · `@huggingface/transformers` (só no CLI) ·
`nanoid`. Clustering: implementação própria, sem dependência.

---

## 9. Estrutura de arquivos

```
Memory system/
├─ index.html · vite.config.ts · tsconfig*.json · package.json
├─ BLUEPRINT.md
├─ scripts/ add-memory.mjs          (escrita — Claude via terminal)
└─ src/
   ├─ main.tsx · App.tsx · App.css
   ├─ types.ts
   ├─ data/  memories.json           (fonte de verdade)
   ├─ store/ vaultStore.ts           (leitura + árvore derivada)
   ├─ lib/   cluster.ts
   └─ components/ TreeView.tsx · MemoryView.tsx · SearchBar.tsx
```

---

## 10. Fora do MVP (fases futuras)

Resumo automático de sessões do Claude Code (`~/.claude/projects/.../*.jsonl`)
· rótulos de cluster via LLM · slider de granularidade do `simplify` · remoção/
edição via CLI · export · temas.

---

## 11. Critérios de aceite (verificados em 2026-07-10)

1. ✅ `npm run dev` sobe sem erro.
2. ✅ `npm run add-memory` grava memória com embedding 384-dim no JSON.
3. ✅ Memórias de temas distintos caem em galhos distintos (conceito/clustering
   separado de arquitetura/infra).
4. ✅ Selecionar folha → MemoryView renderiza o resumo em markdown.
5. ✅ Busca filtra a árvore.
6. ✅ Persistência em arquivo → sobrevive a reload e a restart do browser.
7. ✅ `cluster.ts` testado isolado (2 temas → 2 galhos; casos-limite 0/1).
8. ✅ `npm run build` sem erros de TypeScript.
