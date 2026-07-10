#!/usr/bin/env node
// Sync via Wi-Fi (LAN): daemon que descobre peers por broadcast UDP e replica
// memórias por HTTP com atraso máximo de ~2s (push imediato na mudança do
// arquivo + anti-entropia a cada 2s). Merge = união por id: memórias são
// imutáveis e append-only, então não há conflitos (semântica de G-Set).
//
// Uso: npm run sync   (em cada máquina, na mesma rede Wi-Fi)
// Env: SYNC_PORT (http, default 7777) · MEMORY_DATA (path do JSON, p/ testes)
import { createServer } from 'node:http'
import { createSocket } from 'node:dgram'
import { readFile, writeFile } from 'node:fs/promises'
import { watch } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DATA =
  process.env.MEMORY_DATA ??
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'memories.json')
const HTTP_PORT = Number(process.env.SYNC_PORT ?? 7777)
const DISCOVERY_PORT = 47777
const INSTANCE = randomBytes(6).toString('hex')

const peers = new Map() // "host:porta" → { host, port, lastSeen }
let lastWrittenHash = ''

async function loadMemories() {
  try {
    return JSON.parse(await readFile(DATA, 'utf8'))
  } catch {
    return []
  }
}

// hash só dos ids: detecta entrada/saída de memórias sem custo de conteúdo
function hashOf(memories) {
  return createHash('sha1')
    .update(memories.map((m) => m.id).sort().join(','))
    .digest('hex')
}

async function mergeIncoming(incoming) {
  const current = await loadMemories()
  const byId = new Map(current.map((m) => [m.id, m]))
  let added = 0
  for (const m of incoming) {
    if (m?.id && !byId.has(m.id)) {
      byId.set(m.id, m)
      added++
    }
  }
  if (added === 0) return 0
  const merged = [...byId.values()].sort((a, b) => a.createdAt - b.createdAt)
  lastWrittenHash = hashOf(merged) // antes do write: o watcher ignora a própria escrita
  await writeFile(DATA, JSON.stringify(merged, null, 2) + '\n')
  return added
}

// ---------- HTTP: replicação ----------
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/memories') {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(await loadMemories()))
  } else if (req.method === 'POST' && req.url === '/merge') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', async () => {
      try {
        const added = await mergeIncoming(JSON.parse(body))
        if (added) console.log(`⇣ recebidas ${added} memórias novas`)
        res.end(JSON.stringify({ added }))
      } catch (e) {
        res.statusCode = 400
        res.end(String(e))
      }
    })
  } else {
    res.statusCode = 404
    res.end()
  }
})
server.listen(HTTP_PORT, () =>
  console.log(`sync http :${HTTP_PORT} · instância ${INSTANCE} · dados: ${DATA}`),
)

async function pushToPeers() {
  const memories = await loadMemories()
  const body = JSON.stringify(memories)
  for (const p of peers.values()) {
    fetch(`http://${p.host}:${p.port}/merge`, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    }).catch(() => {}) // peer pode ter saído; a descoberta o expira em 5s
  }
}

async function pullFrom(peer) {
  try {
    const r = await fetch(`http://${peer.host}:${peer.port}/memories`)
    const added = await mergeIncoming(await r.json())
    if (added) console.log(`⇣ ${added} memórias de ${peer.host}:${peer.port}`)
  } catch {}
}

// ---------- Descoberta: broadcast UDP ----------
const udp = createSocket({ type: 'udp4', reuseAddr: true })
udp.on('message', (msg, rinfo) => {
  try {
    const m = JSON.parse(msg.toString())
    if (m.app !== 'memory-system-sync' || m.instance === INSTANCE) return
    const key = `${rinfo.address}:${m.port}`
    const isNew = !peers.has(key)
    peers.set(key, { host: rinfo.address, port: m.port, lastSeen: Date.now() })
    if (isNew) {
      console.log(`✚ peer ${key}`)
      pullFrom(peers.get(key)) // sync inicial nos dois sentidos
      pushToPeers()
    }
  } catch {}
})
udp.bind(DISCOVERY_PORT, () => {
  udp.setBroadcast(true)
  setInterval(() => {
    const announce = Buffer.from(
      JSON.stringify({ app: 'memory-system-sync', instance: INSTANCE, port: HTTP_PORT }),
    )
    udp.send(announce, DISCOVERY_PORT, '255.255.255.255', () => {}) // rede Wi-Fi
    udp.send(announce, DISCOVERY_PORT, '127.0.0.1', () => {}) // instâncias locais (testes)
    for (const [k, p] of peers) {
      if (Date.now() - p.lastSeen > 5000) {
        peers.delete(k)
        console.log(`✖ peer ${k}`)
      }
    }
  }, 1000)
})

// ---------- Push imediato na mudança local (é isso que garante ≤2s) ----------
let debounce
watch(DATA, () => {
  clearTimeout(debounce)
  debounce = setTimeout(async () => {
    const h = hashOf(await loadMemories())
    if (h !== lastWrittenHash) {
      lastWrittenHash = h
      console.log('⇡ mudança local, propagando')
      pushToPeers()
    }
  }, 150)
})

// ---------- Anti-entropia: cobre pacotes/eventos perdidos ----------
setInterval(() => {
  for (const p of peers.values()) pullFrom(p)
}, 2000)
