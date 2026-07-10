import { useState } from 'react'
import { useVaultStore } from '../store/vaultStore'

export function AddMemory() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const embedding = useVaultStore((s) => s.embedding)
  const addMemory = useVaultStore((s) => s.addMemory)

  const submit = async () => {
    if (!title.trim() || !summary.trim() || embedding) return
    await addMemory(title.trim(), summary.trim(), `conversa ${new Date().toISOString().slice(0, 10)}`)
    setTitle('')
    setSummary('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="add-toggle" onClick={() => setOpen(true)}>
        + Nova memória
      </button>
    )
  }

  return (
    <div className="add-form">
      <input
        placeholder="Título do resumo"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        placeholder="Resumo das mensagens (markdown)…"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={6}
      />
      <div className="add-actions">
        <button onClick={submit} disabled={embedding || !title.trim() || !summary.trim()}>
          {embedding ? 'Calculando embedding…' : 'Salvar'}
        </button>
        <button className="ghost" onClick={() => setOpen(false)} disabled={embedding}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
