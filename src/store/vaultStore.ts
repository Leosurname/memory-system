import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ClusterNode, Memory } from '../types'
import { buildDendrogram, simplify } from '../lib/cluster'
import { embed } from '../lib/embeddings'
import { vaultStorage, VAULT_STORAGE_KEY } from './storage'

interface VaultStore {
  memories: Record<string, Memory>
  order: string[]
  selectedId: string | null
  tree: ClusterNode | null // derivado; recomputado, não persistido
  unclassifiedIds: string[] // memórias sem embedding (falha de modelo)
  embedding: boolean // spinner do AddMemory

  addMemory: (title: string, summary: string, source?: string) => Promise<string>
  removeMemory: (id: string) => void
  select: (id: string | null) => void
  rebuildTree: () => void
}

export const useVaultStore = create<VaultStore>()(
  persist(
    (set, get) => ({
      memories: {},
      order: [],
      selectedId: null,
      tree: null,
      unclassifiedIds: [],
      embedding: false,

      addMemory: async (title, summary, source) => {
        const id = nanoid()
        set({ embedding: true })
        let vector: number[] = []
        try {
          vector = await embed(`${title}\n\n${summary}`)
        } catch (err) {
          console.warn('embedding falhou; memória fica em "Não classificadas"', err)
        }
        const memory: Memory = {
          id,
          title,
          summary,
          embedding: vector,
          createdAt: Date.now(),
          source,
        }
        set((s) => ({
          memories: { ...s.memories, [id]: memory },
          order: [...s.order, id],
          selectedId: id,
          embedding: false,
        }))
        get().rebuildTree()
        return id
      },

      removeMemory: (id) => {
        set((s) => {
          const memories = { ...s.memories }
          delete memories[id]
          return {
            memories,
            order: s.order.filter((x) => x !== id),
            selectedId: s.selectedId === id ? null : s.selectedId,
          }
        })
        get().rebuildTree()
      },

      select: (id) => set({ selectedId: id }),

      rebuildTree: () => {
        const { memories, order } = get()
        const embedded = order
          .map((id) => memories[id])
          .filter((m): m is Memory => !!m && m.embedding.length > 0)
        const unclassifiedIds = order.filter(
          (id) => memories[id] && memories[id].embedding.length === 0,
        )
        const raw = buildDendrogram(
          embedded.map((m) => ({ id: m.id, title: m.title, embedding: m.embedding })),
        )
        set({ tree: raw ? simplify(raw) : null, unclassifiedIds })
      },
    }),
    {
      name: VAULT_STORAGE_KEY,
      storage: vaultStorage,
      // só o essencial persiste; a árvore é recomputada na hidratação
      partialize: (s) => ({ memories: s.memories, order: s.order, selectedId: s.selectedId }),
      onRehydrateStorage: () => (state) => {
        state?.rebuildTree()
      },
    },
  ),
)
