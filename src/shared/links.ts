/**
 * Pengaturan watermark dan link. Ganti nilai "GANTI" dengan link aslimu.
 * Link yang masih berisi "GANTI" tidak akan dibuka saat diklik.
 */
/** Nama yang ditampilkan di aplikasi */
export const NAMES = {
  tiktok: 'AS GAME',
  sociabuzz: 'Aji Setiawan'
} as const

export const LINKS = {
  tiktok: 'https://www.tiktok.com/@masajie12',
  discord: 'https://discord.gg/E6PY8bBGnT',
  donate: 'https://sociabuzz.com/masaji12/tribe'
} as const

export const isLinkReady = (url: string): boolean => /^https:\/\//i.test(url) && !url.includes('GANTI')
