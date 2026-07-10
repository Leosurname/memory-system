import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useVaultStore } from '../store/vaultStore'

export function MemoryView() {
  const memory = useVaultStore((s) => (s.selectedId ? s.memories[s.selectedId] : undefined))

  if (!memory) {
    return (
      <div className="memory-view empty">
        <p>Selecione uma memória na árvore.</p>
      </div>
    )
  }

  return (
    <div className="memory-view">
      <header className="memory-header">
        <h1>{memory.title}</h1>
        <div className="memory-meta">
          <span>{new Date(memory.createdAt).toLocaleString('pt-BR')}</span>
          {memory.source && <span> · {memory.source}</span>}
        </div>
      </header>
      <article className="memory-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{memory.summary}</ReactMarkdown>
      </article>
    </div>
  )
}
