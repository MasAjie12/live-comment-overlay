export type Platform = 'tiktok' | 'youtube'

export type ConnState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'ended'
  | 'error'

/** Komentar berbayar / khusus YouTube: Super Chat, Super Sticker, atau member baru */
export interface PaidInfo {
  kind: 'superchat' | 'sticker' | 'member' | 'gift'
  /** mis. "Rp50.000" atau "$5.00" (teks asli dari YouTube) */
  amount?: string
}

/** Potongan isi komentar bila ada emoji gambar (emoji kustom channel YouTube) */
export type ChatPart = { t: 'text'; v: string } | { t: 'emoji'; url: string; alt: string }

export interface ChatItem {
  id: number
  /** Sumber komentar. id hanya unik per platform, jadi kunci unik = platform + id */
  platform: Platform
  user: string
  nick: string
  text: string
  avatar?: string
  /** Level gifter (badge level gift) pengirim komentar, jika terbaca */
  level?: number
  /** Hanya YouTube: Super Chat / Super Sticker / membership */
  paid?: PaidInfo
  /** Hanya diisi bila komentar memuat emoji gambar; jika tidak ada, pakai `text` */
  parts?: ChatPart[]
  /** Hanya TikTok: baris notifikasi (bukan komentar) yang ditampilkan di daftar chat */
  notice?: 'follow' | 'share'
  /** Hanya TikTok: level team (fans club, ikon hati) pengirim komentar, jika terbaca */
  team?: number
}

export type EventKind = 'join' | 'follow' | 'share'

export interface EventItem {
  id: number
  kind: EventKind
  user: string
  nick: string
}

export interface GiftItem {
  id: number
  user: string
  nick: string
  gift: string
  count: number
  diamonds: number
}

export interface Stats {
  viewers: number
  totalViewers: number
  likes: number
}

export interface Batch {
  platform: Platform
  stats?: Stats
  chats: ChatItem[]
  gifts: GiftItem[]
  events: EventItem[]
}

export interface StatusPayload {
  platform: Platform
  state: ConnState
  message?: string
  username?: string
}

export interface Diag {
  state: ConnState
  roomId?: string
  /** jumlah pesan WebSocket mentah yang masuk dari TikTok */
  wsMessages: number
  /** jumlah pesan terdecode per tipe (mis. WebcastChatMessage) */
  events: Record<string, number>
  lastError?: string
  /** lokasi field tempat level gifter terbaca (kosong = belum pernah terbaca) */
  levelSource?: string
  /** tipe:nilai mentah payGrade.level (untuk pencocokan) */
  levelRaw?: string
  /** sceneType badge yang pernah terlihat di komentar, mis. "1,4,8" */
  sceneTypes?: string
  /** contoh nilai action/kunci pesan sosial (follow/share) yang pernah masuk */
  socialProbe?: string
  /** jumlah notifikasi yang dibuat per jenis, dan yang dilewati (duplikat / tanpa nama) */
  notif?: Record<string, number>
  /** nama field (bukan isi) dari pesan pertama tiap jenis, untuk membantu pencocokan */
  fields: Record<string, string[]>
  /** badge team (fans club): jumlah komentar yang levelnya terbaca, lokasi field, dan contoh struktur */
  team?: { withTeam: number; source?: string; samples: string[]; badgeSamples: string[] }
  /** statistik emoji pada komentar */
  emoji?: {
    /** komentar yang memuat kode [xxx] */
    withCode: number
    /** kode yang berhasil diganti emoji */
    converted: number
    /** kode yang belum dikenal -> jumlah kemunculan */
    unknown: Record<string, number>
    /** komentar dengan field emotes berisi gambar */
    withEmotes: number
    /** contoh isi mentah field emotes */
    emoteSamples: string[]
  }
}

export interface Settings {
  username: string
  /** Input terakhir untuk YouTube: link live, video ID, atau @handle */
  youtubeInput: string
  mode: 'full' | 'compact'
  opacity: number
  fontSize: number
  hideAvatars: boolean
  /** Tampilkan badge level gifter di komentar */
  showLevel: boolean
  /** Tampilkan badge team (fans club, ikon hati) di komentar TikTok */
  showTeam: boolean
  /** Penanda sumber komentar: teks (TT / YT) atau logo TikTok / YouTube */
  sourceStyle: 'text' | 'logo'
  /** Aktifkan server overlay untuk OBS (Browser Source) di komputer ini */
  overlayEnabled: boolean
  /** Token acak untuk URL overlay (dibuat otomatis oleh aplikasi) */
  overlayToken?: string
  /** Notifikasi di bawah komentar */
  showJoin: boolean
  showFollow: boolean
  showShare: boolean
  noAnimation: boolean
  disableGpu: boolean
  clickThrough: boolean
  bounds?: { x: number; y: number; width: number; height: number }
  /** Opsional: API key Euler Stream (untuk mengurangi rate limit). Isi manual di settings.json */
  signApiKey?: string
}

/** Status server overlay OBS */
export interface OverlayInfo {
  enabled: boolean
  /** URL lengkap untuk dimasukkan ke Browser Source di OBS */
  url?: string
  /** jumlah halaman overlay yang sedang terhubung */
  clients: number
  error?: string
}

export interface OverlayApi {
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  connect(username: string): Promise<void>
  disconnect(): Promise<void>
  /** input: link live/video, video ID, atau @handle / link channel YouTube */
  connectYoutube(input: string): Promise<void>
  disconnectYoutube(): Promise<void>
  getMemory(): Promise<number>
  getDiag(): Promise<Diag>
  /** Laporan diagnostik YouTube (teks) untuk mencari field total penonton */
  getYoutubeReport(): Promise<string>
  /** Status server overlay OBS (alamat URL, jumlah koneksi, error) */
  getOverlayInfo(): Promise<OverlayInfo>
  restart(): Promise<void>
  quit(): Promise<void>
  /** Buka link di browser. Hanya link yang terdaftar di shared/links.ts yang diizinkan */
  openExternal(url: string): Promise<void>
  minimize(): Promise<void>
  onBatch(cb: (b: Batch) => void): () => void
  onStatus(cb: (s: StatusPayload) => void): () => void
  onClickThrough(cb: (on: boolean) => void): () => void
}
