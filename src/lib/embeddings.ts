import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

const MODEL = 'Xenova/all-MiniLM-L6-v2'

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    // cast: as assinaturas sobrecarregadas de pipeline() estouram o type-checker
    extractorPromise = (pipeline as (t: string, m: string) => Promise<FeatureExtractionPipeline>)(
      'feature-extraction',
      MODEL,
    )
    // se o download falhar, permite tentar de novo na próxima chamada
    extractorPromise.catch(() => {
      extractorPromise = null
    })
  }
  return extractorPromise
}

/** Embedding 384-dim normalizado L2 (cosseno = dot product). */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}
