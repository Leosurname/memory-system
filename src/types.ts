export interface Memory {
  id: string
  title: string
  summary: string // markdown: o resumo das mensagens
  embedding: number[] // 384-dim (all-MiniLM-L6-v2); [] = não embedado ainda
  createdAt: number
  source?: string // ex: "conversa 2026-07-10"
}

// Nó da árvore de clusters — derivado dos embeddings, nunca persistido cru
export type ClusterNode =
  | { kind: 'leaf'; memoryId: string }
  | {
      kind: 'branch'
      id: string
      label: string
      height: number // distância de fusão (0..1); maior = tema mais amplo
      children: ClusterNode[]
    }
