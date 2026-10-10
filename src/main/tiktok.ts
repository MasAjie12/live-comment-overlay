import type { BrowserWindow } from 'electron'
import type { Batch, ChatItem, ChatPart, ConnState, Diag, EventItem, EventKind, GiftItem, Stats, StatusPayload } from '../shared/types'
import { convertTikTokEmoji } from '../shared/tiktokEmoji'
import { loadSettings } from './settings'

const MAX_PENDING_CHATS = 100
const MAX_PENDING_EVENTS = 20
const FLUSH_MS = 400
const MAX_ATTEMPTS = 8
const SEEN_CAP = 100_000
const NO_DATA_WARN_MS = 15_000

type Kind = 'chat' | 'like' | 'roomUser' | 'member' | 'social'
type Src = 'typed' | 'decoded'

/** Nama pesan protobuf yang terbukti masuk (lihat Diagnostik) -> jenis event */
const DECODED_TO_KIND: Record<string, Kind> = {
  WebcastChatMessage: 'chat',
  WebcastLikeMessage: 'like',
  WebcastRoomUserSeqMessage: 'roomUser',
  WebcastMemberMessage: 'member',
  WebcastSocialMessage: 'social'
}

function normalizeUsername(input: string): string {
  let u = (input || '').trim()
  const m = u.match(/tiktok\.com\/@([^/?#\s]+)/i)
  if (m) u = m[1]
  return u.replace(/^@+/, '').trim()
}

function friendlyError(e: any): { state: ConnState; message: string } {
  const text = `${e?.name ?? ''} ${e?.message ?? e ?? ''}`
  if (/UserOffline|offline|not live|LIVE has ended|isn't online|is not online|not currently live/i.test(text))
    return { state: 'offline', message: 'Akun ini sedang tidak live.' }
  if (/rate.?limit|429|too many/i.test(text))
    return { state: 'error', message: 'Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi, atau isi API key di Pengaturan.' }
  if (/not found|doesn't exist|does not exist|user_not_found|invalid.*(user|username)/i.test(text))
    return { state: 'error', message: 'Username tidak ditemukan. Periksa penulisannya.' }
  if (/ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|network|timeout|fetch failed/i.test(text))
    return { state: 'error', message: 'Tidak ada koneksi internet atau TikTok tidak bisa dijangkau.' }
  return { state: 'error', message: `Gagal terhubung: ${String(e?.message ?? e).slice(0, 120)}` }
}

/** Ambil string pertama yang tidak kosong dari daftar nama field kandidat */
function firstString(d: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = d?.[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/** Ambil angka pertama yang valid (mendukung number, bigint, dan string angka) */
function firstNum(d: any, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = d?.[k]
    if (v === undefined || v === null || v === '') continue
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/**
 * Cari URL foto profil. Pesan terdecode memakai avatarThumb/avatarMedium/avatarLarge
 * (daftar URL di `urlList`), sedangkan format lain memakai profilePicture.
 * Format HEIC dilewati karena tidak bisa ditampilkan Chromium.
 */
function avatarOf(d: any): string | undefined {
  const u = d?.user ?? d
  const imgs = [u?.avatarThumb, u?.avatarMedium, u?.avatarLarge, u?.profilePicture, d?.profilePicture]
  for (const img of imgs) {
    if (!img) continue
    if (typeof img === 'string') {
      if (/^https?:\/\//i.test(img) && !/\.heic/i.test(img)) return img.replace(/^http:/i, 'https:')
      continue
    }
    for (const list of [img.urlList, img.urls, img.url, img.urlListList]) {
      if (!Array.isArray(list)) continue
      const pick = list.find((x: unknown) => typeof x === 'string' && /^https?:\/\//i.test(x) && !/\.heic/i.test(x))
      if (pick) return String(pick).replace(/^http:/i, 'https:')
    }
  }
  const flat = d?.profilePictureUrl
  return typeof flat === 'string' && /^https?:\/\//i.test(flat) ? flat : undefined
}

/** String id yang valid; nilai kosong dan "0" (default protobuf) dianggap tidak ada */
const validId = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v)
  return s && s !== '0' ? s : ''
}
const firstText = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim()
  return ''
}

function userOf(d: any) {
  const u = d?.user
  // Pesan terdecode memakai user.id, pesan bertipe memakai user.userId
  const user = firstText(u?.uniqueId, u?.displayId, d?.uniqueId)
  const id = validId(u?.userId) || validId(u?.id) || validId(d?.userId) || user
  const nick = firstText(u?.nickname, d?.nickname) || user
  return { id, user, nick, avatar: avatarOf(d) }
}

/** Nilai level yang masuk akal (level gifter TikTok berkisar 1 sampai sekitar 100) */
/** Ubah number/bigint/string/objek Long ({low, high}) menjadi number */
const toNum = (n: unknown): number => {
  if (n && typeof n === 'object') {
    const o = n as any
    if (typeof o.toNumber === 'function') return o.toNumber()
    if (typeof o.low === 'number') return (o.high ?? 0) * 4294967296 + (o.low >>> 0)
  }
  return Number(n)
}

const validLevel = (n: unknown): number | undefined => {
  const v = toNum(n)
  return Number.isInteger(v) && v >= 1 && v <= 200 ? v : undefined
}

/** badgeSceneType 8 = USER_GRADE (badge level gifter). Bisa berupa angka atau nama enum. */
const isGradeBadge = (b: any): boolean => {
  const t = b?.sceneType ?? b?.badgeSceneType ?? b?.scene
  return t === 8 || t === '8' || /USER_GRADE/i.test(String(t ?? ''))
}

/**
 * Ambil level gifter dari data user. Skema field bisa berbeda antar versi library,
 * jadi beberapa lokasi dicoba berurutan. `source` dicatat di Diagnostik.
 */
function giftLevelOf(d: any): { level?: number; source?: string } {
  const u = d?.user ?? d

  // 1) Field langsung
  const direct: Array<[string, unknown]> = [
    ['user.payGrade.level', u?.payGrade?.level],
    ['user.gifterLevel', u?.gifterLevel],
    ['gifterLevel', d?.gifterLevel],
    ['user.userGrade.level', u?.userGrade?.level]
  ]
  for (const [source, v] of direct) {
    const level = validLevel(v)
    if (level) return { level, source }
  }

  // 2) Dari daftar badge: cari badge bertipe USER_GRADE
  for (const key of ['badges', 'badgeList', 'userBadges', 'badgeImageList']) {
    for (const holder of [u, d]) {
      const list = holder?.[key]
      if (!Array.isArray(list)) continue
      for (const b of list) {
        if (!isGradeBadge(b)) continue
        const cands = [
          b?.privilegeLogExtra?.level,
          b?.level,
          b?.combine?.str,
          b?.text?.defaultPattern,
          b?.str
        ]
        for (const c of cands) {
          const m = String(c ?? '').match(/\d+/)
          const level = m ? validLevel(m[0]) : undefined
          if (level) return { level, source: `${holder === u ? 'user.' : ''}${key}[USER_GRADE]` }
        }
      }
    }
  }
  return {}
}

/** URL gambar emote (emote kustom kreator) dari satu elemen field `emotes`, hanya https */
function emoteImage(e: any): string | undefined {
  const cands = [e?.emote?.image?.imageUrl, e?.emote?.image?.urlList?.[0], e?.image?.imageUrl, e?.image?.urlList?.[0], e?.imageUrl]
  for (const u of cands) {
    if (typeof u !== 'string' || !/^(https?:)?\/\//i.test(u)) continue
    return u.startsWith('//') ? `https:${u}` : u.replace(/^http:/i, 'https:')
  }
  return undefined
}

interface BuiltChat {
  text: string
  parts?: ChatPart[]
  codes: number
  converted: number
  unknown: string[]
  emoteCount: number
}

/**
 * Susun isi komentar TikTok: kode emoji bawaan [xxx] diganti emoji Unicode, dan emote bergambar
 * (field `emotes`) disisipkan sebagai gambar pada posisinya (placeInComment).
 */
function buildChat(raw: string, emotes: any): BuiltChat {
  const items: { at: number; url: string; alt: string }[] = []
  if (Array.isArray(emotes)) {
    for (const e of emotes) {
      const url = emoteImage(e)
      if (!url) continue
      const at = toNum(e?.placeInComment ?? e?.place_in_comment)
      items.push({
        at: Number.isFinite(at) ? Math.max(0, Math.min(at, raw.length)) : raw.length,
        url,
        alt: String(e?.emote?.emoteId ?? e?.emoteId ?? '')
      })
    }
  }
  items.sort((a, b) => a.at - b.at)

  const agg = { codes: 0, converted: 0, unknown: [] as string[] }
  const conv = (s: string): string => {
    const r = convertTikTokEmoji(s)
    agg.codes += r.codes
    agg.converted += r.converted
    agg.unknown.push(...r.unknown)
    return r.text
  }
  if (!items.length) return { text: conv(raw), ...agg, emoteCount: 0 }

  const parts: ChatPart[] = []
  let text = ''
  const addText = (s: string): void => {
    if (!s) return
    const c = conv(s)
    text += c
    const last = parts[parts.length - 1]
    if (last && last.t === 'text') last.v += c
    else parts.push({ t: 'text', v: c })
  }
  let pos = 0
  for (const it of items) {
    addText(raw.slice(pos, it.at))
    pos = it.at
    parts.push({ t: 'emoji', url: it.url, alt: it.alt })
  }
  addText(raw.slice(pos))
  return { text: text.trim(), parts, ...agg, emoteCount: items.length }
}

const emptyDiag = (): Omit<Diag, 'state'> => ({ wsMessages: 0, events: {}, fields: {}, notif: {} })

export class TikTokService {
  private conn: any = null
  private flushTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private runId = 0
  private seq = 0
  private attempts = 0
  private manualStop = true
  private noDataWarned = false
  private username = ''
  private state: ConnState = 'idle'

  private chats: ChatItem[] = []
  private gifts: GiftItem[] = []
  private events: EventItem[] = []
  private joined = new Set<string>()
  private stats: Stats = { viewers: 0, totalViewers: 0, likes: 0 }
  private statsDirty = false
  private seen = new Set<string>()
  private diag = emptyDiag()
  /** Sumber data yang dipakai per jenis event (event bernama atau decodedData) */
  private claimed: Partial<Record<Kind, Src>> = {}
  private giftMap = new Map<number, { name: string; diamonds: number }>()

  constructor(private getWindow: () => BrowserWindow | null) {}

  /* ---------- API publik ---------- */

  async connect(input: string): Promise<void> {
    const username = normalizeUsername(input)
    if (!username) {
      this.setStatus('error', 'Masukkan username TikTok terlebih dahulu.')
      return
    }
    this.cancelReconnect()
    this.teardown()
    this.resetData()
    this.username = username
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

  getDiag(): Diag {
    return {
      state: this.state,
      ...this.diag,
      events: { ...this.diag.events },
      fields: { ...this.diag.fields },
      notif: { ...this.diag.notif },
      emoji: this.diag.emoji && { ...this.diag.emoji, unknown: { ...this.diag.emoji.unknown } }
    }
  }

  /* ---------- Koneksi ---------- */

  private async start(isRetry: boolean): Promise<void> {
    const myRun = ++this.runId
    this.setStatus(
      isRetry ? 'reconnecting' : 'connecting',
      isRetry ? `Menyambung ulang (percobaan ${this.attempts})…` : undefined
    )

    try {
      // Dimuat saat dibutuhkan saja agar RAM saat idle tetap kecil
      const mod: any = await import('tiktok-live-connector')
      const Ctor =
        mod.TikTokLiveConnection ??
        mod.default?.TikTokLiveConnection ??
        mod.WebcastPushConnection ??
        mod.default?.WebcastPushConnection
      if (!Ctor) throw new Error('Library tiktok-live-connector tidak dikenali')
      if (myRun !== this.runId) return

      const opts: Record<string, unknown> = {}
      const key = loadSettings().signApiKey || process.env.EULER_API_KEY
      if (key) opts.signApiKey = key
      const c = new Ctor(this.username, opts)
      this.conn = c
      this.bind(c, myRun)

      const st = await c.connect()
      if (myRun !== this.runId) {
        try { c.disconnect() } catch { /* */ }
        return
      }
      this.diag.roomId = st?.roomId ? String(st.roomId) : undefined
      this.attempts = 0
      this.noDataWarned = false
      this.setStatus('connected')
      this.startFlush()
      this.startWatchdog(myRun)
    } catch (e: any) {
      if (myRun !== this.runId) return
      console.error('[tiktok] gagal connect:', e)
      this.diag.lastError = String(e?.message ?? e).slice(0, 200)
      this.teardown()
      const f = friendlyError(e)
      if (isRetry && f.state !== 'offline' && !this.manualStop) {
        this.scheduleReconnect()
        return
      }
      this.setStatus(f.state, f.message)
    }
  }

  private bind(c: any, myRun: number): void {
    const alive = () => myRun === this.runId
    // Setiap handler dibungkus agar error di dalamnya tidak hilang diam-diam
    const on = (name: string, fn: (...a: any[]) => void) =>
      c.on(name, (...a: any[]) => {
        if (!alive()) return
        try {
          fn(...a)
        } catch (e: any) {
          this.diag.lastError = `${name}: ${String(e?.message ?? e).slice(0, 160)}`
          console.error(`[tiktok] handler ${name}`, e)
        }
      })

    // Penghitung diagnostik: apakah data dari TikTok benar-benar masuk?
    on('websocketData', () => {
      this.diag.wsMessages++
    })

    // chat/like/roomUser/member: dengarkan event bernama DAN decodedData.
    // Sumber yang pertama berhasil mengekstrak data dipakai, yang lain diabaikan (tanpa duplikat).
    const dispatch = (kind: Kind, src: Src, d: any) => {
      const owner = this.claimed[kind]
      if (owner && owner !== src) return
      this.recordFields(`${kind}:${src}`, d)
      if (kind === 'chat') this.recordBadgeShape(d)
      if (this.extract(kind, d) && !owner) this.claimed[kind] = src
    }
    for (const kind of ['chat', 'like', 'roomUser', 'member'] as Kind[]) {
      on(kind, (d) => dispatch(kind, 'typed', d))
    }
    on('decodedData', (name: any, data: any) => {
      const k = String(name)
      const ev = this.diag.events
      if (k in ev) ev[k]++
      else if (Object.keys(ev).length < 40) ev[k] = 1
      const kind = DECODED_TO_KIND[k]
      if (kind) dispatch(kind, 'decoded', data?.data ?? data)
    })

    on('gift', (d) => {
      this.recordFields('gift:typed', d)
      this.recordFields('gift.gift', d?.gift)
      const g = d?.gift ?? d?.giftDetails
      const type = firstNum(g, ['type', 'giftType']) ?? firstNum(d, ['giftType'])
      const repeatEnd = d?.repeatEnd === true || d?.repeatEnd === 1
      // type 1 = gift beruntun (streak): tampilkan hanya saat streak selesai
      if (type === 1 && !repeatEnd) return
      const u = userOf(d)
      this.markSeen(u.id)
      const count = Number(d?.repeatCount ?? 1) || 1
      const giftId = Number(d?.giftId ?? g?.id)
      const cached = this.giftMap.get(giftId)
      const name =
        firstString(g, ['name', 'giftName', 'describe']) ??
        firstString(d, ['giftName']) ??
        cached?.name ??
        `Gift #${Number.isFinite(giftId) ? giftId : '?'}`
      const per = firstNum(g, ['diamondCount', 'diamond_count']) ?? firstNum(d, ['diamondCount']) ?? cached?.diamonds ?? 0
      // simpan nama untuk pesan berikutnya yang tidak membawa detail gift
      if (Number.isFinite(giftId) && firstString(g, ['name', 'giftName']) && this.giftMap.size < 2000) {
        this.giftMap.set(giftId, { name, diamonds: per })
      }
      this.gifts.push({ id: ++this.seq, user: u.user, nick: u.nick || u.user, gift: name, count, diamonds: per * count })
      if (this.gifts.length > 30) this.gifts.splice(0, this.gifts.length - 30)
    })

    on('streamEnd', () => {
      this.manualStop = true
      this.flush()
      this.teardown()
      this.setStatus('ended', 'Live telah berakhir.')
    })

    on('disconnected', () => {
      if (this.manualStop) return
      if (this.state === 'connected') {
        this.flush()
        this.teardown()
        this.scheduleReconnect()
      }
    })

    on('error', (e: any) => {
      const msg = e?.info ?? e?.exception?.message ?? e?.message ?? String(e)
      this.diag.lastError = `error: ${String(msg).slice(0, 180)}`
      console.error('[tiktok] error event', e)
    })
  }

  /** Mengembalikan true jika data berhasil diekstrak */
  private extract(kind: Kind, d: any): boolean {
    switch (kind) {
      case 'chat': {
        const raw = firstString(d, ['comment', 'content', 'text', 'message', 'msg']) ?? ''
        const built = buildChat(raw, d?.emotes)
        if (!built.text && !built.parts) return false
        this.noteEmoji(built, d?.emotes)
        const u = userOf(d)
        this.markSeen(u.id)
        const lv = giftLevelOf(d)
        this.probeLevel(d)
        if (lv.level && !this.diag.levelSource) this.diag.levelSource = lv.source
        this.chats.push({ id: ++this.seq, platform: 'tiktok', user: u.user, nick: u.nick || u.user, text: built.text, parts: built.parts, avatar: u.avatar, level: lv.level })
        if (this.chats.length > MAX_PENDING_CHATS) this.chats.splice(0, this.chats.length - MAX_PENDING_CHATS)
        return true
      }
      case 'like': {
        const total = firstNum(d, ['totalLikeCount', 'total_like_count', 'totalLikes', 'total'])
        const inc = firstNum(d, ['likeCount', 'like_count', 'count'])
        if (total === undefined && inc === undefined) return false
        if (total !== undefined && total > 0) this.stats.likes = Math.max(this.stats.likes, total)
        else if (inc) this.stats.likes += inc
        this.markSeen(userOf(d).id)
        this.statsDirty = true
        return true
      }
      case 'roomUser': {
        const v = firstNum(d, ['viewerCount', 'viewer_count', 'total', 'onlineCount'])
        const tu = firstNum(d, ['totalUser', 'total_user', 'totalViewerCount', 'totalViewers'])
        if (v === undefined && tu === undefined) return false
        if (v !== undefined) {
          this.stats.viewers = v
          if (v > this.stats.totalViewers) this.stats.totalViewers = v
        }
        if (tu !== undefined && tu > this.stats.totalViewers) this.stats.totalViewers = tu
        this.statsDirty = true
        return true
      }
      case 'social': {
        const u = userOf(d)
        const act = toNum(d?.action)
        const key = String(d?.common?.displayText?.key ?? d?.displayType ?? '')
        this.probeSocial(act, key)
        let ev: EventKind | undefined
        if (/follow/i.test(key) || act === 1) ev = 'follow'
        else if (/share/i.test(key) || act === 3) ev = 'share'
        if (!ev) return false
        this.markSeen(u.id)
        this.pushEvent(ev, u)
        return true
      }
      case 'member': {
        const mu = userOf(d)
        const id = mu.id
        const mc = firstNum(d, ['memberCount', 'member_count'])
        if (!id && mc === undefined) return false
        this.markSeen(id)
        // Notifikasi "bergabung": hanya sekali per user, abaikan pesan keluar
        const act = d?.action
        const left = toNum(act) === 2 || /LEAVE|EXIT/i.test(String(act ?? ''))
        const jkey = id || (mu.nick ? `n:${mu.nick}` : '')
        if (!left && jkey) {
          if (this.joined.has(jkey)) this.bump('join-duplikat')
          else if (this.joined.size < SEEN_CAP) {
            this.joined.add(jkey)
            this.pushEvent('join', mu)
          }
        }
        if (mc !== undefined && mc > 0) {
          this.stats.viewers = mc
          if (mc > this.stats.totalViewers) this.stats.totalViewers = mc
          this.statsDirty = true
        }
        return true
      }
    }
  }

  /** Catat statistik emoji untuk Diagnostik: kode yang belum dikenal dan contoh isi field emotes */
  private noteEmoji(b: BuiltChat, emotes: any): void {
    const e =
      this.diag.emoji ?? (this.diag.emoji = { withCode: 0, converted: 0, unknown: {}, withEmotes: 0, emoteSamples: [] })
    if (b.codes) e.withCode++
    e.converted += b.converted
    for (const name of b.unknown) {
      if (e.unknown[name] !== undefined || Object.keys(e.unknown).length < 40) e.unknown[name] = (e.unknown[name] ?? 0) + 1
    }
    if (Array.isArray(emotes) && emotes.length) {
      e.withEmotes++
      if (e.emoteSamples.length < 3) {
        try {
          e.emoteSamples.push(
            JSON.stringify(emotes[0], (_k, v) => (typeof v === 'bigint' ? v.toString() : v)).slice(0, 300)
          )
        } catch {
          /* abaikan */
        }
      }
    }
  }

  private bump(key: string): void {
    const n = this.diag.notif ?? (this.diag.notif = {})
    n[key] = (n[key] ?? 0) + 1
  }

  private pushEvent(kind: EventKind, u: { user: string; nick: string }): void {
    let nick = u.nick || u.user
    if (!nick) {
      // follow/share tanpa nama tetap ditampilkan; join tanpa nama dilewati
      if (kind === 'join') return this.bump('join-tanpa-nama')
      nick = 'Seseorang'
    }
    this.bump(kind)
    this.events.push({ id: ++this.seq, kind, user: u.user, nick })
    if (this.events.length > MAX_PENDING_EVENTS) this.events.splice(0, this.events.length - MAX_PENDING_EVENTS)
  }

  /** Probe diagnostik: contoh nilai action dan kunci pesan sosial (bukan data pribadi) */
  private probeSocial(act: number, key: string): void {
    const entry = `action=${Number.isFinite(act) ? act : '?'} key=${key.slice(0, 40) || '-'}`
    const list = this.diag.socialProbe ? this.diag.socialProbe.split(' ; ') : []
    if (list.length < 6 && !list.includes(entry)) {
      list.push(entry)
      this.diag.socialProbe = list.join(' ; ')
    }
  }

  /** Probe diagnostik: tipe nilai payGrade.level dan daftar sceneType badge (angka saja, bukan data pribadi) */
  private probeLevel(d: any): void {
    const u = d?.user ?? d
    const raw = u?.payGrade?.level
    const scenes = new Set<string>(this.diag.sceneTypes ? this.diag.sceneTypes.split(',') : [])
    for (const key of ['badgeList', 'badges']) {
      const list = u?.[key]
      if (Array.isArray(list)) for (const b of list) scenes.add(String(b?.sceneType ?? b?.badgeSceneType ?? '?'))
    }
    if (scenes.size <= 15) this.diag.sceneTypes = [...scenes].join(',')
    if (raw !== undefined && (!this.diag.levelRaw || toNum(raw) > 0)) {
      this.diag.levelRaw = `${typeof raw}:${typeof raw === 'object' ? JSON.stringify(raw) : String(raw)}`
    }
  }

  /** Catat NAMA field (bukan isi) dari user dan badge agar mudah dicocokkan jika level tidak terbaca */
  private recordBadgeShape(d: any): void {
    const u = d?.user ?? d
    this.recordFields('chat.user', u)
    for (const key of ['badges', 'badgeList', 'userBadges', 'badgeImageList']) {
      const list = u?.[key] ?? d?.[key]
      if (Array.isArray(list) && list.length) {
        this.recordFields(`chat.${key}[0]`, list[0])
        const grade = list.find(isGradeBadge)
        if (grade) this.recordFields(`chat.${key}[USER_GRADE]`, grade)
      }
    }
    if (u?.payGrade) this.recordFields('chat.payGrade', u.payGrade)
    if (u?.avatarThumb && typeof u.avatarThumb === 'object') this.recordFields('chat.avatarThumb', u.avatarThumb)
  }

  private recordFields(label: string, d: any): void {
    const f = this.diag.fields
    if (label in f || Object.keys(f).length >= 24) return
    f[label] = Object.keys(d ?? {}).slice(0, 30)
  }

  private startWatchdog(myRun: number): void {
    this.stopWatchdog()
    this.watchdog = setTimeout(() => {
      if (myRun !== this.runId || this.state !== 'connected') return
      const got = this.diag.wsMessages + Object.keys(this.diag.events).length
      if (got === 0) {
        this.noDataWarned = true
        this.setStatus(
          'connected',
          'Terhubung, tetapi belum ada data masuk dari TikTok. Kemungkinan dibatasi (rate limit). Coba isi API key di Pengaturan, atau tunggu beberapa menit.'
        )
      }
    }, NO_DATA_WARN_MS)
  }

  private stopWatchdog(): void {
    if (this.watchdog) {
      clearTimeout(this.watchdog)
      this.watchdog = null
    }
  }

  private markSeen(id: string): void {
    if (!id || this.seen.has(id) || this.seen.size >= SEEN_CAP) return
    this.seen.add(id)
    if (this.seen.size > this.stats.totalViewers) {
      this.stats.totalViewers = this.seen.size
      this.statsDirty = true
    }
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
    this.stopWatchdog()
    const c = this.conn
    this.conn = null
    if (c) {
      try { c.removeAllListeners?.() } catch { /* */ }
      try { c.disconnect?.() } catch { /* */ }
    }
  }

  private resetData(): void {
    this.chats = []
    this.gifts = []
    this.events = []
    this.joined = new Set()
    this.stats = { viewers: 0, totalViewers: 0, likes: 0 }
    this.statsDirty = false
    this.seen = new Set()
    this.diag = emptyDiag()
    this.claimed = {}
    this.noDataWarned = false
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
    if (!this.chats.length && !this.gifts.length && !this.events.length && !this.statsDirty) return
    const batch: Batch = {
      platform: 'tiktok',
      chats: this.chats,
      gifts: this.gifts,
      events: this.events,
      stats: this.statsDirty ? { ...this.stats } : undefined
    }
    this.chats = []
    this.gifts = []
    this.events = []
    this.statsDirty = false
    const w = this.getWindow()
    if (w && !w.isDestroyed()) w.webContents.send('live:batch', batch)
    // data akhirnya masuk: hapus peringatan "belum ada data"
    if (this.noDataWarned && this.state === 'connected') {
      this.noDataWarned = false
      this.setStatus('connected')
    }
  }

  private setStatus(state: ConnState, message?: string): void {
    this.state = state
    const payload: StatusPayload = { platform: 'tiktok', state, message, username: this.username }
    const w = this.getWindow()
    if (w && !w.isDestroyed()) w.webContents.send('live:status', payload)
  }
}
