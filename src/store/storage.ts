import { createJSONStorage } from 'zustand/middleware'

// Camada isolada: hoje localStorage; trocar aqui por File System Access API
// (arquivos .md reais) sem tocar no resto do app.
export const vaultStorage = createJSONStorage(() => localStorage)

export const VAULT_STORAGE_KEY = 'memory-system-vault'
