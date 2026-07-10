import { create } from 'zustand'
import type { ClusterNode, Memory } from '../types'
import { buildDendrogram, simplify } from '../lib/cluster'
import memoriesData from '../data/memories.json'

// O app é um VISUALIZADOR: memórias são gravadas pelo Claude via terminal
// (scripts/add-memory.mjs) em src/data/memories.json; o Vite recarrega ao mudar.

const memories = memoriesData as Memory[]

interface VaultStore {
  memories: Record<string, Memory>
  order: string[]
  selectedId: string | null
  tree: ClusterNode | null // dendrograma derivado dos embeddings
  unclassifiedIds: string[] // memórias sem embedding (falha do modelo no CLI)
  select: (id: string | null) => void
}

function buildInitialState() {
  const byId: Record<string, Memory> = {}
  const order: string[] = []
  for (const m of memories) {
    byId[m.id] = m
    order.push(m.id)
  }
  const embedded = memories.filter((m) => m.embedding.length > 0)
  const unclassifiedIds = memories.filter((m) => m.embedding.length === 0).map((m) => m.id)
  const raw = buildDendrogram(
    embedded.map((m) => ({ id: m.id, title: m.title, embedding: m.embedding })),
  )
  return { memories: byId, order, tree: raw ? simplify(raw) : null, unclassifiedIds }
}

export const useVaultStore = create<VaultStore>()((set) => ({
  ...buildInitialState(),
  selectedId: null,
  select: (id) => set({ selectedId: id }),
}))
