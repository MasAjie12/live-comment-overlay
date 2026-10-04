import type { BrowserWindow } from 'electron'
import type { Batch, ChatItem, ConnState, PaidInfo, Stats, StatusPayload } from '../shared/types'

const MAX_PENDING_CHATS = 100
const FLUSH_MS = 400
const MAX_ATTEMPTS = 8
const SEEN_CAP = 100_000
const FETCH_TIMEOUT_MS = 10_000
const REFRESH_MS = 60_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Video tertentu (link / ID), atau channel yang dicari live-nya (@handle / channel ID) */
type Target = { kind: 'video'; id: string } | { kind: 'channel'; path: string }

class LiveError extends Error {
  constructor(
    public code: 'offline' | 'notfound' | 'nochat',
    message: string
  ) {
    super(message)
  }
}

/** Terima: link watch/live/shorts/youtu.be, video ID 11 karakter, @handle, link channel, atau channel ID (UC...) */
function parseTarget(input: string): Target | null {
  const s = (input || '').trim()
  if (!s) return null

  const v = s.match(/(?:[?&]v=|youtu\.be\/|youtube\.com\/(?:live|shorts|embed)\/)([\w-]{11})(?![\w-])/i)
  if (v) return { kind: 'video', id: v[1] }

  const h = s.match(/youtube\.com\/(@[\w.\-]+)/i)
  if (h) return { kind: 'channel', path: h[1] }
  const c = s.match(/youtube\.com\/channel\/(UC[\w-]{22})/i)
  if (c) return { kind: 'channel', path: `channel/${c[1]}` }

  if (/^UC[\w-]{22}$/.test(s)) return { kind: 'channel', path: `channel/${s}` }
  if (/^[\w-]{11}$/.test(s) && !s.startsWith('@')) return { kind: 'video', id: s }
  if (/^@?[\w.\-]{3,40}$/.test(s)) return { kind: 'channel', path: `@${s.replace(/^@+/, '')}` }
  return null
}

/**
 * Cari video live yang sedang berjalan di sebuah channel lewat halaman /live.
 * Halaman itu mengarahkan ke video live jika ada (canonical = watch?v=ID).
 */
async function findLiveVideo(path: string): Promise<string | null> {
  const res = await fetch(`https://www.youtube.com/${path}/live`, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      // melewati halaman persetujuan cookie (mis. di Eropa)
      Cookie: 'CONSENT=YES+1; SOCS=CAI'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (res.status === 404) throw new LiveError('notfound', 'channel not found')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const canon = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)
  if (!canon) return null
  return /"isLiveNow":true|"isLive":true/.test(html) ? canon[1] : null
}

function friendlyError(e: any): { state: ConnState; message: string } {
  if (e instanceof LiveError) {
    if (e.code === 'offline') return { state: 'offline', message: 'Channel atau video ini sedang tidak live.' }
    if (e.code === 'nochat') return { state: 'error', message: 'Live chat dimatikan atau tidak tersedia untuk live ini.' }
    return { state: 'error', message: 'Channel atau video tidak ditemukan. Periksa link atau handle-nya.' }
  }
  const text = `${e?.name ?? ''} ${e?.message ?? e ?? ''}`
  if (/ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|network|timeout|timed out|fetch failed|aborted/i.test(text))
    return { state: 'error', message: 'Tidak ada koneksi internet atau YouTube tidak bisa dijangkau.' }
  if (/private|unavailable|members.?only|sign in|age/i.test(text))
    return { state: 'error', message: 'Video ini privat, dibatasi umur, atau khusus member, sehingga tidak bisa dibaca.' }
  return { state: 'error', message: `Gagal terhubung ke YouTube: ${String(e?.message ?? e).slice(0, 120)}` }
}

/** Ambil teks dari string atau objek Text milik youtubei.js (toString() mengembalikan teksnya) */
function str(x: unknown): string {
  if (x === undefined || x === null) return ''
  if (typeof x === 'string') return x.trim()
  const o = x as any
  if (typeof o.text === 'string') return o.text.trim()
  if (typeof o.toString === 'function') {
    const s = String(o.toString())
    if (s !== '[object Object]') return s.trim()
  }
  return ''
}

/** Ubah "1.234", "1,2K", "1,2 rb", "3.4M", atau angka biasa menjadi number; undefined jika tidak ada angka */
function parseCount(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : undefined
  const s = str(v).toLowerCase()
  const m = s.match(/(\d[\d.,]*)\s*(k|m|rb|jt)?(?![a-z])/)
  if (!m) return undefined
  if (m[2]) {
    const n = parseFloat(m[1].replace(',', '.'))
    if (!Number.isFinite(n)) return undefined
    return Math.round(n * (m[2] === 'k' || m[2] === 'rb' ? 1e3 : 1e6))
  }
  const n = Number(m[1].replace(/[.,]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function avatarOf(author: any): string | undefined {
  const url = author?.thumbnails?.[0]?.url
  if (typeof url !== 'string') return undefined
  if (url.startsWith('//')) return `https:${url}`
  return /^https?:\/\//i.test(url) ? url.replace(/^http:/i, 'https:') : undefined
}

/**
 * Telusuri objek (kedalaman terbatas) dan daftar semua field yang namanya mengandung
 * view/count/watch/total/like/concurrent beserta nilainya. Dipakai untuk laporan diagnostik
 * agar terlihat field mana yang benar-benar dikirim YouTube.
 */
function scanKeys(root: unknown, rootName: string, maxDepth = 6, maxHits = 60): string[] {
  const out: string[] = []
  const seen = new WeakSet<object>()
  const KEY = /view|count|watch|total|like|concurrent/i
  const walk = (v: any, path: string, depth: number): void => {
    if (out.length >= maxHits || v === null || typeof v !== 'object' || seen.has(v) || depth > maxDepth) return
    seen.add(v)
    const entries: [string, any][] = Array.isArray(v)
      ? v.slice(0, 10).map((x, i) => [String(i), x] as [string, any])
      : Object.entries(v)
    for (const [k, val] of entries) {
      if (out.length >= maxHits) return
      if (val === null || val === undefined || typeof val === 'function') continue
      const p = `${path}.${k}`
      if (typeof val === 'object') {
        if (KEY.test(p)) {
          const t = str(val)
          if (t) {
            out.push(`${p} = ${JSON.stringify(t.slice(0, 80))}`)
            continue
          }
        }
        walk(val, p, depth + 1)
      } else if (KEY.test(p)) {
        out.push(`${p} = ${JSON.stringify(typeof val === 'string' ? val.slice(0, 80) : val)}`)
      }
    }
  }
  try {
    walk(root, rootName, 0)
  } catch (e: any) {
    out.push(`(scan error: ${String(e?.message ?? e).slice(0, 80)})`)
  }
  return out
}

interface DebugInfo {
  videoId: string
  basicKeys: string[]
  basicHits: string[]
  primaryHits: string[]
  mdCount: number
  mdFirst: string[]
  mdLast: string[]
  series: { t: string; viewers?: number; likes?: number; raw?: string }[]
  refreshLog: string[]
}

const emptyDebug = (): DebugInfo => ({
  videoId: '',
  basicKeys: [],
  basicHits: [],
  primaryHits: [],
  mdCount: 0,
  mdFirst: [],
  mdLast: [],
  series: [],
  refreshLog: []
})

export class YouTubeService {
  private chat: any = null
  private flushTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private runId = 0
  private seq = 0
  private attempts = 0
  private manualStop = true
  private target: Target | null = null
  private label = ''
  private state: ConnState = 'idle'

  private chats: ChatItem[] = []
  private stats: Stats = { viewers: 0, totalViewers: 0, likes: 0 }
  private statsDirty = false
  private seen = new Set<string>()
  private debug: DebugInfo = emptyDebug()

  // Total penayangan & like YouTube tidak dikirim real time; diambil ulang berkala
  private yt: any = null
  private videoId = ''
  private refreshTimer: NodeJS.Timeout | null = null
  private refreshing = false
  private ytTotal: number | undefined
  private peak = 0

  constructor(private getWindow: () => BrowserWindow | null) {}

  /* ---------- API publik ---------- */

  async connect(input: string): Promise<void> {
    const target = parseTarget(input)
    if (!target) {
      this.setStatus('error', 'Masukkan link live, video ID, atau @handle YouTube.')
      return
    }
    this.cancelReconnect()
    this.teardown()
    this.resetData()
    this.target = target
    this.label = ''
    this.manualStop = false
    this.attempts = 0
    await this.start(false)
  }

  disconnect(): void {
    this.manualStop = true
    this.cancelReconnect()
    this.teardown()
    this.setStatus('idle')
  }

  dispose(): void {
    this.manualStop = true
    this.cancelReconnect()
    this.teardown()
  }

  /** Laporan teks untuk diagnostik: field angka apa saja yang dikirim YouTube */
  getReport(): string {
    const d = this.debug
    const lines: string[] = []
    lines.push(`Status: ${this.state} | video: ${d.videoId || '-'} | channel: ${this.label || '-'}`)
    lines.push(`Stats terbaca: penonton ${this.stats.viewers}, total ${this.stats.totalViewers}${this.ytTotal === undefined ? ' (perkiraan)' : ''}, like ${this.stats.likes}`)
    lines.push(`metadata-update diterima: ${d.mdCount}`)
    lines.push('')
    lines.push(`[basic_info] keys: ${d.basicKeys.join(', ') || '-'}`)
    for (const h of d.basicHits) lines.push(h)
    lines.push('')
    lines.push('[primary_info]')
    for (const h of d.primaryHits) lines.push(h)
    if (!d.primaryHits.length) lines.push('(tidak ada field angka)')
    lines.push('')
    lines.push('[metadata-update pertama]')
    for (const h of d.mdFirst) lines.push(h)
    if (!d.mdFirst.length) lines.push('(belum ada)')
    lines.push('')
    lines.push('[metadata-update terbaru]')
    for (const h of d.mdLast) lines.push(h)
    if (!d.mdLast.length) lines.push('(belum ada)')
    lines.push('')
    lines.push('[riwayat jam | penonton | like | teks view_count]')
    for (const r of d.series) lines.push(`${r.t} | ${r.viewers ?? '-'} | ${r.likes ?? '-'} | ${r.raw || '-'}`)
    if (!d.series.length) lines.push('(belum ada)')
    lines.push('')
    lines.push(`[pembaruan total/like tiap ${REFRESH_MS / 1000} detik]`)
    for (const r of d.refreshLog) lines.push(r)
    if (!d.refreshLog.length) lines.push('(belum ada)')
    return lines.join('\n')
  }

  /* ---------- Koneksi ---------- */

  private async start(isRetry: boolean): Promise<void> {
    const myRun = ++this.runId
    this.setStatus(
      isRetry ? 'reconnecting' : 'connecting',
      isRetry ? `Menyambung ulang (percobaan ${this.attempts})…` : undefined
    )

    try {
      const t = this.target!
      const videoId = t.kind === 'video' ? t.id : await this.resolveLive(t.path)
      if (myRun !== this.runId) return

      // Dimuat saat dibutuhkan saja agar RAM saat idle tetap kecil
      const mod: any = await import('youtubei.js')
      const Innertube = mod.Innertube ?? mod.default?.Innertube
      if (!Innertube) throw new Error('Library youtubei.js tidak dikenali')
      // retrieve_player: false = tidak mengunduh JS player (hanya dibutuhkan untuk memutar video)
      const yt = await Innertube.create({ retrieve_player: false })
      if (myRun !== this.runId) return

      const info: any = await yt.getInfo(videoId)
      if (myRun !== this.runId) return
      const basic = info?.basic_info
      if (!basic?.is_live) throw new LiveError('offline', 'not live')

      this.debug.videoId = videoId
      this.debug.basicKeys = Object.keys(basic).slice(0, 60)
      this.debug.basicHits = scanKeys(basic, 'basic_info')
      this.debug.primaryHits = scanKeys(info?.primary_info, 'primary_info')

      let chat: any
      try {
        chat = info.getLiveChat()
      } catch {
        throw new LiveError('nochat', 'live chat unavailable')
      }

      this.label = str(basic.channel?.name) || str(basic.author) || ''
      const seedLikes = parseCount(basic.like_count)
      if (seedLikes !== undefined) {
        this.stats.likes = seedLikes
        this.statsDirty = true
      }
      this.yt = yt
      this.videoId = videoId
      this.ytTotal = parseCount(basic.view_count)
      this.recomputeTotal()

      this.chat = chat
      this.bind(chat, myRun)
      chat.start()

      this.attempts = 0
      this.setStatus('connected')
      this.startFlush()
      this.startRefresh(myRun)
    } catch (e: any) {
      if (myRun !== this.runId) return
      console.error('[youtube] gagal connect:', e)
      this.teardown()
      const f = friendlyError(e)
      if (isRetry && f.state !== 'offline' && !this.manualStop) {
        this.scheduleReconnect()
        return
      }
      this.setStatus(f.state, f.message)
    }
  }

  private async resolveLive(path: string): Promise<string> {
    const id = await findLiveVideo(path)
    if (!id) throw new LiveError('offline', 'channel not live')
    return id
  }

  private bind(chat: any, myRun: number): void {
    // Setiap handler dibungkus agar error di dalamnya tidak hilang diam-diam
    const on = (name: string, fn: (...a: any[]) => void) =>
      chat.on(name, (...a: any[]) => {
        if (myRun !== this.runId) return
        try {
          fn(...a)
        } catch (e: any) {
          console.error(`[youtube] handler ${name}`, e)
        }
      })

    on('chat-update', (action: any) => {
      if (action?.type !== 'AddChatItemAction') return
      this.addItem(action.item)
    })

    on('metadata-update', (md: any) => {
      const views = md?.views
      const d = this.debug
      d.mdCount += 1
      if (d.mdCount === 1) d.mdFirst = scanKeys(md, 'md')
      if (d.mdCount % 6 === 0) d.mdLast = scanKeys(md, 'md')
      const v = parseCount(views?.original_view_count) ?? parseCount(views?.extra_short_view_count) ?? parseCount(views?.view_count)
      if (v !== undefined) {
        this.stats.viewers = v
        if (v > this.peak) this.peak = v
        this.statsDirty = true
        this.recomputeTotal()
      }
      const likes = md?.likes
      const l = parseCount(likes?.default_text) ?? parseCount(likes?.toggled_text)
      d.series.push({ t: new Date().toTimeString().slice(0, 8), viewers: v, likes: l, raw: str(views?.view_count).slice(0, 40) })
      if (d.series.length > 12) d.series.shift()
      if (l !== undefined) {
        this.stats.likes = l
        this.statsDirty = true
      }
    })

    on('end', () => {
      this.manualStop = true
      this.flush()
      this.teardown()
      this.setStatus('ended', 'Live telah berakhir.')
    })

    on('error', (e: any) => {
      console.error('[youtube] error event', e)
      if (this.manualStop) return
      // Library berhenti polling saat error; sambung ulang dari awal
      this.flush()
      this.teardown()
      this.scheduleReconnect()
    })
  }

  private addItem(item: any): void {
    const type = String(item?.type ?? '')
    let text = ''
    let paid: PaidInfo | undefined

    if (type === 'LiveChatTextMessage') {
      text = str(item.message)
    } else if (type === 'LiveChatPaidMessage') {
      text = str(item.message)
      paid = { kind: 'superchat', amount: str(item.purchase_amount) || undefined }
    } else if (type === 'LiveChatPaidSticker') {
      paid = { kind: 'sticker', amount: str(item.purchase_amount) || undefined }
    } else if (type === 'LiveChatMembershipItem') {
      text = str(item.header_subtext) || str(item.header_primary_text)
      paid = { kind: 'member' }
    } else {
      return
    }
    if (!text && !paid) return

    const a = item.author
    const nick = str(a?.name) || 'Penonton'
    const user = str(a?.id) || nick
    this.markSeen(user)
    this.chats.push({ id: ++this.seq, platform: 'youtube', user, nick, text, avatar: avatarOf(a), paid })
    if (this.chats.length > MAX_PENDING_CHATS) this.chats.splice(0, this.chats.length - MAX_PENDING_CHATS)
  }

  private markSeen(id: string): void {
    if (!id || this.seen.has(id) || this.seen.size >= SEEN_CAP) return
    this.seen.add(id)
    this.recomputeTotal()
  }

  /**
   * "Total" = total penayangan dari YouTube (basic_info.view_count, diperbarui tiap REFRESH_MS).
   * Jika field itu tidak tersedia, dipakai perkiraan: puncak penonton atau jumlah akun unik yang berkomentar.
   * Tidak pernah lebih kecil dari jumlah penonton saat ini.
   */
  private recomputeTotal(): void {
    const base = this.ytTotal ?? Math.max(this.peak, this.seen.size)
    const total = Math.max(base, this.stats.viewers)
    if (total !== this.stats.totalViewers) {
      this.stats.totalViewers = total
      this.statsDirty = true
    }
  }

  private startRefresh(myRun: number): void {
    this.stopRefresh()
    this.refreshTimer = setInterval(() => void this.refreshInfo(myRun), REFRESH_MS)
  }

  private stopRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  /** Ambil ulang info video untuk memperbarui total penayangan dan like */
  private async refreshInfo(myRun: number): Promise<void> {
    if (this.refreshing || myRun !== this.runId || !this.yt || !this.videoId) return
    this.refreshing = true
    const stamp = new Date().toTimeString().slice(0, 8)
    try {
      // getInfo (bukan getBasicInfo): hanya getInfo yang membawa data like dari halaman video
      const info: any = await this.yt.getInfo(this.videoId)
      if (myRun !== this.runId) return
      const basic = info?.basic_info
      const total = parseCount(basic?.view_count)
      const likes =
        parseCount(basic?.like_count) ?? parseCount(info?.primary_info?.menu?.top_level_buttons?.[0]?.like_count)
      const dTotal = total !== undefined && this.ytTotal !== undefined ? total - this.ytTotal : undefined
      const dLikes = likes !== undefined ? likes - this.stats.likes : undefined
      if (total !== undefined) this.ytTotal = total
      if (likes !== undefined && likes !== this.stats.likes) {
        this.stats.likes = likes
        this.statsDirty = true
      }
      this.recomputeTotal()
      const sign = (n: number | undefined): string => (n === undefined ? '' : ` (${n >= 0 ? '+' : ''}${n})`)
      this.logRefresh(`${stamp} total=${total ?? '-'}${sign(dTotal)} like=${likes ?? '-'}${sign(dLikes)}`)
    } catch (e: any) {
      this.logRefresh(`${stamp} gagal: ${String(e?.message ?? e).slice(0, 80)}`)
    } finally {
      this.refreshing = false
    }
  }

  private logRefresh(line: string): void {
    this.debug.refreshLog.push(line)
    if (this.debug.refreshLog.length > 8) this.debug.refreshLog.shift()
  }

  private scheduleReconnect(): void {
    this.attempts += 1
    if (this.attempts > MAX_ATTEMPTS) {
      this.setStatus('error', 'Koneksi terputus. Klik Connect untuk mencoba lagi.')
      return
    }
    const delay = Math.min(3000 * 2 ** (this.attempts - 1), 30000)
    this.setStatus('reconnecting', `Terputus. Mencoba lagi dalam ${Math.round(delay / 1000)} detik…`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.manualStop) void this.start(true)
    }, delay)
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private teardown(): void {
    this.runId++
    this.stopFlush()
    this.stopRefresh()
    this.yt = null
    const c = this.chat
    this.chat = null
    if (c) {
      try { c.removeAllListeners?.() } catch { /* */ }
      try { c.stop?.() } catch { /* */ }
    }
  }

  private resetData(): void {
    this.chats = []
    this.stats = { viewers: 0, totalViewers: 0, likes: 0 }
    this.statsDirty = false
    this.seen = new Set()
    this.debug = emptyDebug()
    this.ytTotal = undefined
    this.peak = 0
  }

  /* ---------- Kirim ke renderer (dibatch) ---------- */

  private startFlush(): void {
    this.stopFlush()
    this.flushTimer = setInterval(() => this.flush(), FLUSH_MS)
  }

  private stopFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  private flush(): void {
    if (!this.chats.length && !this.statsDirty) return
    const batch: Batch = {
      platform: 'youtube',
      chats: this.chats,
      gifts: [],
      events: [],
      stats: this.statsDirty ? { ...this.stats } : undefined
    }
    this.chats = []
    this.statsDirty = false
    const w = this.getWindow()
    if (w && !w.isDestroyed()) w.webContents.send('live:batch', batch)
  }

  private setStatus(state: ConnState, message?: string): void {
    this.state = state
    const payload: StatusPayload = { platform: 'youtube', state, message, username: this.label }
    const w = this.getWindow()
    if (w && !w.isDestroyed()) w.webContents.send('live:status', payload)
  }
}
