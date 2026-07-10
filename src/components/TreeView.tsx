import { useState } from 'react'
import type { ClusterNode } from '../types'
import { useVaultStore } from '../store/vaultStore'

function LeafRow({ memoryId, filter }: { memoryId: string; filter: string }) {
  const memory = useVaultStore((s) => s.memories[memoryId])
  const selectedId = useVaultStore((s) => s.selectedId)
  const select = useVaultStore((s) => s.select)
  if (!memory) return null
  if (filter && !matches(memory.title + ' ' + memory.summary, filter)) return null
  return (
    <button
      className={`tree-leaf${selectedId === memoryId ? ' selected' : ''}`}
      onClick={() => select(memoryId)}
      title={memory.title}
    >
      <span className="leaf-dot">●</span> {memory.title}
    </button>
  )
}

function matches(text: string, filter: string): boolean {
  return text.toLowerCase().includes(filter.toLowerCase())
}

function BranchRow({ node, filter }: { node: ClusterNode & { kind: 'branch' }; filter: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="tree-branch">
      <button className="branch-header" onClick={() => setOpen(!open)}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <span className="branch-label">{node.label}</span>
        <span className="branch-count">{countLeaves(node)}</span>
      </button>
      {open && (
        <div className="branch-children">
          {node.children.map((child, i) => (
            <NodeView key={child.kind === 'leaf' ? child.memoryId : child.id + i} node={child} filter={filter} />
          ))}
        </div>
      )}
    </div>
  )
}

function countLeaves(node: ClusterNode): number {
  if (node.kind === 'leaf') return 1
  return node.children.reduce((acc, c) => acc + countLeaves(c), 0)
}

export function NodeView({ node, filter }: { node: ClusterNode; filter: string }) {
  if (node.kind === 'leaf') return <LeafRow memoryId={node.memoryId} filter={filter} />
  return <BranchRow node={node} filter={filter} />
}

export function TreeView({ filter }: { filter: string }) {
  const tree = useVaultStore((s) => s.tree)
  const unclassifiedIds = useVaultStore((s) => s.unclassifiedIds)
  const count = useVaultStore((s) => s.order.length)

  if (count === 0) {
    return <p className="tree-empty">Nenhuma memória ainda. Adicione um resumo acima.</p>
  }
  return (
    <div className="tree-view">
      {tree && <NodeView node={tree} filter={filter} />}
      {unclassifiedIds.length > 0 && (
        <div className="tree-branch">
          <div className="branch-header static">
            <span className="branch-label">Não classificadas</span>
            <span className="branch-count">{unclassifiedIds.length}</span>
          </div>
          <div className="branch-children">
            {unclassifiedIds.map((id) => (
              <LeafRow key={id} memoryId={id} filter={filter} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
