#!/usr/bin/env node
// CLI do Claude para gravar memórias: computa o embedding em Node e faz
// append em src/data/memories.json (o app é só um visualizador).
//
// Uso:
//   npm run add-memory -- "Título" "Resumo em markdown"
//   echo "Resumo em markdown" | npm run add-memory -- "Título"
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { pipeline } from '@huggingface/transformers'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'memories.json')

const [title, summaryArg] = process.argv.slice(2)
if (!title) {
  console.error('uso: add-memory "Título" "Resumo" (ou resumo via stdin)')
  process.exit(1)
}
const summary = summaryArg ?? (await readStdin())
if (!summary?.trim()) {
  console.error('resumo vazio')
  process.exit(1)
}

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
  })
}

console.error('carregando modelo de embedding…')
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
const output = await extractor(`${title}\n\n${summary}`, { pooling: 'mean', normalize: true })
const embedding = Array.from(output.data)

const memories = JSON.parse(await readFile(DATA, 'utf8'))
const memory = {
  id: randomBytes(8).toString('hex'),
  title,
  summary: summary.trim(),
  embedding,
  createdAt: Date.now(),
  source: `conversa ${new Date().toISOString().slice(0, 10)}`,
}
memories.push(memory)
await writeFile(DATA, JSON.stringify(memories, null, 2) + '\n')
console.log(`✅ memória "${title}" gravada (${memories.length} no total)`)
