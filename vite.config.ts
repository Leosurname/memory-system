import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // transformers.js carrega WASM/onnxruntime dinamicamente; não pré-bundlar
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
})
