import { useState } from 'react'
import { TreeView } from './components/TreeView'
import { MemoryView } from './components/MemoryView'
import { AddMemory } from './components/AddMemory'
import { SearchBar } from './components/SearchBar'
import './App.css'

export default function App() {
  const [filter, setFilter] = useState('')
  return (
    <div className="app">
      <aside className="sidebar">
        <h2 className="app-title">🧠 Memory System</h2>
        <SearchBar value={filter} onChange={setFilter} />
        <AddMemory />
        <TreeView filter={filter} />
      </aside>
      <main className="main">
        <MemoryView />
      </main>
    </div>
  )
}
