# Blueprint — Sistema de Memória por Similaridade (árvores auto-organizadas)

Documento de arquitetura do MVP. Fonte de verdade para a implementação.

**Repositório:** https://github.com/Leosurname/memory-system (público)

---

## 1. Visão

Sistema de memória para o Claude. **Eu resumo as mensagens de uma conversa** e
gravo o resumo como uma **memória**. O **app organiza sozinho** as memórias em
uma **árvore por similaridade** (clustering hierárquico de embeddings) — sem o
usuário montar a árvore à mão.

Web app: React + Vite + TypeScript. Roda em `npm run dev`. **Sem backend**: os
embeddings são calculados no navegador (transformers.js / WASM).

A "árvore matemática" = **dendrograma** do clustering aglomerativo:
- **folha** = uma memória (resumo)
- **galho (nó interno)** = cluster de memórias semanticamente parecidas

---

## 2. Modelo de dados

```ts
// src/types.ts
export interface Memory {
  id: string;              // nanoid
  title: string;           // rótulo curto do resumo (eu gero)
  summary: string;         // markdown: o resumo das mensagens
  embedding: number[];     // vetor (384-dim, all-MiniLM-L6-v2)
  createdAt: number;       // epoch ms
  source?: string;         // ex: "conversa 2026-07-10"
}

// Nó da árvore de clusters (derivado, NÃO persistido cru — recomputável)
export type ClusterNode =
  | { kind: 'leaf'; memoryId: string }
  | { kind: 'branch'; id: string; label: string;
      height: number; children: ClusterNode[] };

export interface VaultState {
  memories: Record<string, Memory>;   // índice por id (persistido)
  order: string[];                     // ordem de inserção
  selectedId: string | null;
  tree: ClusterNode | null;            // cache do dendrograma (recomputado)
}
```

Decisões:
- Persistimos **apenas as memórias** (com seus embeddings). A **árvore é
  derivada** — recalculada quando memórias entram/saem. Isso mantém a
  organização sempre coerente com o conteúdo.
- Guardar o `embedding` evita recalcular a cada reload (o cálculo é o passo caro).

---

## 3. Camadas

```
┌──────────────────────────────────────────────────────────┐
│  UI (React)                                                │
│  App · TreeView/ClusterNode · MemoryView · AddMemory ·     │
│  SearchBar                                                 │
├──────────────────────────────────────────────────────────┤
│  Store (Zustand + persist)  — src/store/vaultStore.ts     │
│  memories + ações (add/remove) + rebuild da árvore         │
├──────────────────────────────────────────────────────────┤
│  Embeddings  — src/lib/embeddings.ts                       │
│  transformers.js (Xenova/all-MiniLM-L6-v2), no navegador   │
├──────────────────────────────────────────────────────────┤
│  Clustering  — src/lib/cluster.ts  (puro, testável)        │
│  aglomerativo (cosine, average-linkage) → ClusterNode      │
├──────────────────────────────────────────────────────────┤
│  Storage  — src/store/storage.ts (localStorage → FS depois)│
└──────────────────────────────────────────────────────────┘
```

Regra: UI → Store → (Embeddings | Clustering | Storage). `cluster.ts` é **puro**
(entra: `{id, embedding}[]`; sai: `ClusterNode`) → fácil de testar sem browser.

---

## 4. Pipeline de similaridade

**Adicionar memória:**
1. Eu gero `{ title, summary }` das mensagens.
2. `embeddings.embed(summary)` → vetor 384-dim (mean-pooling + normalize L2).
3. `addMemory(memory)` persiste.
4. `rebuildTree()` roda o clustering sobre todos os embeddings.

**Clustering aglomerativo (`cluster.ts`):**
- Distância = `1 - cosseno` (vetores já normalizados → cosseno = dot product).
- Começa cada memória como cluster próprio; funde iterativamente os 2 clusters
  mais próximos (**average linkage**) até sobrar 1 → dendrograma.
- `label` de cada galho: por ora, palavras mais frequentes/comuns dos títulos
  dos filhos (heurística barata; refinar depois).
- Casos-limite: 0 memórias → `tree = null`; 1 memória → folha única.

**Visualização:** a árvore mostra o dendrograma como árvore colapsável. Galhos
podem ser cortados por um limiar (slider de "granularidade") para formar os
tópicos de topo — opcional no MVP.

---

## 5. Ações do store

| Ação | Assinatura | Efeito |
|------|------------|--------|
| `addMemory` | `(title, summary) => Promise<id>` | embed + persist + rebuild |
| `removeMemory` | `(id) => void` | remove + rebuild |
| `rebuildTree` | `() => void` | recalcula dendrograma dos embeddings |
| `select` | `(id) => void` | abre memória no painel |
| `search` | `(query) => Memory[]` | filtro textual (título/summary) |

---

## 6. Componentes

- **App** — layout 2 colunas: `<Sidebar>` (SearchBar + AddMemory + TreeView) |
  `<MemoryView>`.
- **TreeView / ClusterNodeView** — renderiza o `ClusterNode` recursivo; galhos
  expand/collapse; folhas selecionáveis (abrem a memória).
- **MemoryView** — mostra `title` + `summary` (render markdown com
  react-markdown + remark-gfm) + metadados (data, fonte); botão deletar.
- **AddMemory** — no MVP: textarea onde entra o resumo que **eu** gero (título +
  summary) → chama `addMemory`. Mostra spinner enquanto embed roda.
- **SearchBar** — filtro textual das memórias.

> No fluxo real, **eu** produzo o resumo aqui no chat e coloco via AddMemory; o
> app cuida de embed + organização.

---

## 7. Embeddings no navegador

- Lib: `@huggingface/transformers` (transformers.js), pipeline
  `feature-extraction` com `Xenova/all-MiniLM-L6-v2` (384-dim, ~23MB, roda em
  WASM; usa WebGPU se disponível).
- Modelo baixa 1x e fica em cache do browser. Primeira memória: download + warm-up.
- Fallback: se o modelo falhar (offline no 1º uso), `addMemory` grava a memória
  com `embedding: []` e ela cai num cluster "Não classificadas" até re-embedar.

---

## 8. Stack / dependências

`react`, `react-dom`, `vite`, `typescript` (scaffold) · `zustand` (estado+persist)
· `@huggingface/transformers` (embeddings) · `react-markdown` + `remark-gfm`
(render) · `nanoid` (ids). Clustering: implementação própria em `cluster.ts`
(sem dependência). Confirmar antes de instalar.

---

## 9. Estrutura de arquivos

```
Memory system/
├─ index.html · vite.config.ts · tsconfig.json · package.json
├─ BLUEPRINT.md
└─ src/
   ├─ main.tsx · App.tsx · App.css
   ├─ types.ts
   ├─ store/ vaultStore.ts · storage.ts
   ├─ lib/   embeddings.ts · cluster.ts
   └─ components/ TreeView.tsx · ClusterNodeView.tsx · MemoryView.tsx ·
                  AddMemory.tsx · SearchBar.tsx
```

---

## 10. Fora do MVP (fases futuras)

Ler sessões do Claude Code (`~/.claude/projects/.../*.jsonl`) e resumir automático
· rótulos de cluster via LLM · slider de granularidade · grafo · tags · sync com
`.md` reais no disco · export · temas.

---

## 11. Critérios de aceite (verificação)

1. `npm run dev` sobe sem erro.
2. Adicionar uma memória → embedding calculado (spinner some) → aparece na árvore.
3. Adicionar várias memórias de 2 temas distintos → o clustering as separa em
   galhos diferentes (folhas do mesmo tema ficam juntas).
4. Selecionar uma folha → MemoryView mostra o resumo em markdown.
5. Busca filtra as memórias.
6. Reload → memórias + embeddings persistem; árvore re-renderiza igual.
7. `cluster.ts` testável isolado (entrada de embeddings → dendrograma esperado).
8. `npm run build` sem erros de TypeScript.
```
