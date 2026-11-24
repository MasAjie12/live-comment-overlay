import type { Batch } from '../shared/types'

/**
 * Jalur sederhana untuk meneruskan batch data live (TikTok / YouTube) ke pihak lain di main process,
 * mis. server overlay OBS. Pendengar tidak boleh mengubah isi batch.
 */
type Listener = (batch: Batch) => void
const listeners = new Set<Listener>()

export function publishBatch(batch: Batch): void {
  for (const l of listeners) {
    try {
      l(batch)
    } catch {
      /* satu pendengar yang error tidak boleh mengganggu yang lain */
    }
  }
}

export function onBatch(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
