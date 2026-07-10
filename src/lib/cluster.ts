import type { ClusterNode } from '../types'

export interface ClusterItem {
  id: string
  title: string
  embedding: number[] // normalizado L2; distância = 1 - dot
}

const STOPWORDS = new Set([
  // pt
  'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'para', 'pra', 'com', 'por', 'que', 'sobre', 'ao',
  'à', 'se', 'ou', 'como', 'mais', 'foi', 'ser', 'tem', 'seu', 'sua',
  // en
  'the', 'of', 'and', 'in', 'on', 'to', 'for', 'with', 'a', 'an', 'is', 'are',
  'at', 'by', 'from', 'about', 'how', 'what', 'this', 'that',
])

/** Rótulo barato: palavras mais frequentes entre os títulos das folhas. */
export function labelFromTitles(titles: string[]): string {
  const freq = new Map<string, number>()
  for (const t of titles) {
    for (const raw of t.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < 3 || STOPWORDS.has(raw)) continue
      freq.set(raw, (freq.get(raw) ?? 0) + 1)
    }
  }
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([w]) => w)
  return top.length > 0 ? top.join(' · ') : 'grupo'
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

interface WorkCluster {
  node: ClusterNode
  indices: number[] // índices dos itens contidos (para average linkage)
  titles: string[]
}

/**
 * Clustering hierárquico aglomerativo (average linkage, distância cosseno).
 * Puro: entra itens com embeddings normalizados, sai o dendrograma.
 * O(n³) ingênuo — suficiente para centenas de memórias.
 */
export function buildDendrogram(items: ClusterItem[]): ClusterNode | null {
  if (items.length === 0) return null
  if (items.length === 1) return { kind: 'leaf', memoryId: items[0].id }

  // matriz de distâncias par-a-par entre itens
  const n = items.length
  const dist: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = 1 - dot(items[i].embedding, items[j].embedding)
      dist[i][j] = d
      dist[j][i] = d
    }
  }

  let clusters: WorkCluster[] = items.map((it, i) => ({
    node: { kind: 'leaf', memoryId: it.id },
    indices: [i],
    titles: [it.title],
  }))

  const avgLinkage = (a: WorkCluster, b: WorkCluster): number => {
    let s = 0
    for (const i of a.indices) for (const j of b.indices) s += dist[i][j]
    return s / (a.indices.length * b.indices.length)
  }

  let mergeSeq = 0
  while (clusters.length > 1) {
    let bi = 0
    let bj = 1
    let best = Infinity
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = avgLinkage(clusters[i], clusters[j])
        if (d < best) {
          best = d
          bi = i
          bj = j
        }
      }
    }
    const a = clusters[bi]
    const b = clusters[bj]
    const titles = [...a.titles, ...b.titles]
    const merged: WorkCluster = {
      node: {
        kind: 'branch',
        id: `c${mergeSeq++}`,
        label: labelFromTitles(titles),
        height: best,
        children: [a.node, b.node],
      },
      indices: [...a.indices, ...b.indices],
      titles,
    }
    clusters = clusters.filter((_, k) => k !== bi && k !== bj)
    clusters.push(merged)
  }

  return clusters[0].node
}

function allLeaves(node: ClusterNode): ClusterNode[] {
  if (node.kind === 'leaf') return [node]
  return node.children.flatMap(allLeaves)
}

/**
 * Achata galhos "apertados" (height < threshold) num grupo plano de folhas:
 * transforma o dendrograma binário em uma árvore de tópicos legível,
 * preservando um galho por tema.
 */
export function simplify(node: ClusterNode, threshold = 0.35): ClusterNode {
  if (node.kind === 'leaf') return node
  if (node.height < threshold) return { ...node, children: allLeaves(node) }
  return { ...node, children: node.children.map((c) => simplify(c, threshold)) }
}
