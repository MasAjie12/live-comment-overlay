import type { ConnState } from '../../shared/types'

const nf = new Intl.NumberFormat('id-ID')
const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })

export function fmt(n: number): string {
  return n < 10000 ? nf.format(n) : compact.format(n)
}

/** Warna nama stabil per user agar mudah dipindai saat chat ramai */
export function nameColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360
  return `hsl(${h} 65% 72%)`
}

/** Kelompok warna badge level gifter (perkiraan, bukan warna resmi TikTok) */
export function levelTier(level: number): number {
  if (level >= 40) return 5
  if (level >= 30) return 4
  if (level >= 20) return 3
  if (level >= 10) return 2
  return 1
}

export const STATE_LABEL: Record<ConnState, string> = {
  idle: 'Belum terhubung',
  connecting: 'Menghubungkan…',
  connected: 'Live',
  reconnecting: 'Menyambung ulang',
  offline: 'Tidak live',
  ended: 'Live berakhir',
  error: 'Gagal'
}

export const isBusy = (s: ConnState): boolean => s === 'connecting' || s === 'connected' || s === 'reconnecting'
