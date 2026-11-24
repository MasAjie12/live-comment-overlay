import http from 'http'
import type { IncomingMessage, Server, ServerResponse } from 'http'
import { randomBytes, timingSafeEqual } from 'crypto'
import { loadSettings, saveSettings } from './settings'
import { onBatch } from './bus'
import { overlayHtml } from './overlayPage'
import type { Batch, ChatPart, OverlayInfo, PaidInfo, Platform } from '../shared/types'

/** Port pilihan; jika terpakai program lain dicoba port berikutnya (sampai 10 port) */
const PREFERRED_PORT = 38457
const PORT_TRIES = 10
const BUFFER_ROWS = 60
const MAX_CLIENTS = 8
const PING_MS = 15_000

/** Satu baris yang dikirim ke halaman overlay OBS */
export interface OverlayRow {
  id: string
  /** waktu baris dibuat (ms); dipakai halaman untuk menghitung "hilang otomatis" */
  t: number
  platform: Platform
  kind: 'chat' | 'follow' | 'share' | 'gift'
  nick: string
  user: string
  text: string
  parts?: ChatPart[]
  paid?: PaidInfo
  level?: number
  team?: number
}

const clip = (s: unknown, n: number): string => String(s ?? '').slice(0, n)

/** Ubah satu batch (TikTok / YouTube) menjadi baris overlay: komentar, gift, follow, share. Join tidak dikirim. */
export function toRows(b: Batch, nextId: () => string, now: number): OverlayRow[] {
  const rows: OverlayRow[] = []
  for (const c of b.chats ?? []) {
    const parts = c.parts
      ?.filter((p) => p.t === 'text' || (p.t === 'emoji' && /^https:\/\//i.test(p.url)))
      .slice(0, 40)
      .map((p) => (p.t === 'text' ? { t: 'text' as const, v: clip(p.v, 500) } : { t: 'emoji' as const, url: p.url, alt: clip(p.alt, 40) }))
    rows.push({
      id: nextId(),
      t: now,
      platform: c.platform,
      kind: 'chat',
      nick: clip(c.nick, 60),
      user: clip(c.user, 80),
      text: clip(c.text, 500),
      parts: parts && parts.length ? parts : undefined,
      paid: c.paid,
      level: c.level,
      team: c.team
    })
  }
  for (const e of b.events ?? []) {
    if (e.kind !== 'follow' && e.kind !== 'share') continue
    rows.push({ id: nextId(), t: now, platform: b.platform, kind: e.kind, nick: clip(e.nick, 60), user: clip(e.user, 80), text: '' })
  }
  for (const g of b.gifts ?? []) {
    const times = g.count > 1 ? ` ×${g.count}` : ''
    rows.push({
      id: nextId(),
      t: now,
      platform: b.platform,
      kind: 'gift',
      nick: clip(g.nick, 60),
      user: clip(g.user, 80),
      text: `mengirim ${clip(g.gift, 60)}${times}`
    })
  }
  return rows
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Server lokal untuk overlay OBS (Browser Source). Hanya menerima koneksi dari komputer ini (127.0.0.1), dengan
 * token acak di URL. Data dikirim lewat Server-Sent Events, jadi tidak perlu library tambahan.
 */
export class OverlayServer {
  private server: Server | null = null
  private clients = new Set<ServerResponse>()
  private buffer: OverlayRow[] = []
  private port = 0
  private token = ''
  private error: string | undefined
  private unsub: (() => void) | null = null
  private pingTimer: NodeJS.Timeout | null = null
  private seq = 0

  async apply(enabled: boolean): Promise<void> {
    if (enabled) await this.start()
    else this.stop()
  }

  status(): OverlayInfo {
    const running = !!this.server && this.port > 0
    return {
      enabled: running,
      url: running ? `http://127.0.0.1:${this.port}/overlay?token=${this.token}` : undefined,
      clients: this.clients.size,
      error: this.error
    }
  }

  dispose(): void {
    this.stop()
  }

  private async start(): Promise<void> {
    if (this.server) return
    this.error = undefined
    let token: string = loadSettings().overlayToken ?? ''
    if (!token) {
      token = String(randomBytes(16).toString('hex'))
      saveSettings({ overlayToken: token })
    }
    this.token = token

    const server = http.createServer((req, res) => this.handle(req, res))
    server.on('clientError', (_e, socket) => socket.destroy())

    const tryListen = (port: number): Promise<void> =>
      new Promise((resolve, reject) => {
        const onError = (e: Error): void => {
          server.off('listening', onListening)
          reject(e)
        }
        const onListening = (): void => {
          server.off('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, '127.0.0.1')
      })

    let port = 0
    for (let i = 0; i < PORT_TRIES && !port; i++) {
      try {
        await tryListen(PREFERRED_PORT + i)
        port = PREFERRED_PORT + i
      } catch (e: any) {
        if (e?.code !== 'EADDRINUSE') {
          this.error = `Server overlay gagal dijalankan: ${String(e?.message ?? e).slice(0, 100)}`
          server.close()
          return
        }
      }
    }
    if (!port) {
      this.error = `Port ${PREFERRED_PORT}-${PREFERRED_PORT + PORT_TRIES - 1} sedang dipakai program lain.`
      server.close()
      return
    }

    this.server = server
    this.port = port
    this.unsub = onBatch((b) => this.publish(b))
    this.pingTimer = setInterval(() => this.broadcastRaw(': ping\n\n'), PING_MS)
  }

  private stop(): void {
    this.unsub?.()
    this.unsub = null
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    for (const c of this.clients) {
      try {
        c.end()
      } catch {
        /* abaikan */
      }
    }
    this.clients.clear()
    const s = this.server
    this.server = null
    this.port = 0
    this.buffer = []
    if (s) s.close()
  }

  private publish(b: Batch): void {
    const rows = toRows(b, () => String(++this.seq), Date.now())
    if (!rows.length) return
    this.buffer.push(...rows)
    if (this.buffer.length > BUFFER_ROWS) this.buffer.splice(0, this.buffer.length - BUFFER_ROWS)
    if (this.clients.size) this.broadcastRaw(`data: ${JSON.stringify(rows)}\n\n`)
  }

  private broadcastRaw(chunk: string): void {
    for (const c of this.clients) {
      try {
        c.write(chunk)
      } catch {
        this.clients.delete(c)
      }
    }
  }

  private end(res: ServerResponse, code: number, msg: string): void {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(msg)
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    // Hanya dari komputer ini: periksa Host agar tidak bisa dipakai lewat DNS rebinding dari halaman web lain
    const host = String(req.headers.host ?? '')
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return this.end(res, 403, 'Forbidden')
    if (req.method !== 'GET') return this.end(res, 405, 'Method not allowed')

    let url: URL
    try {
      url = new URL(req.url ?? '/', `http://${host}`)
    } catch {
      return this.end(res, 400, 'Bad request')
    }
    if (!safeEqual(url.searchParams.get('token') ?? '', this.token)) return this.end(res, 403, 'Token salah atau tidak ada.')

    if (url.pathname === '/overlay') {
      const nonce = randomBytes(12).toString('base64')
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src https: data:; connect-src 'self'`
      })
      res.end(overlayHtml(nonce))
      return
    }

    if (url.pathname === '/events') {
      if (this.clients.size >= MAX_CLIENTS) return this.end(res, 503, 'Terlalu banyak koneksi.')
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff'
      })
      res.write('retry: 2000\n\n')
      if (this.buffer.length) res.write(`data: ${JSON.stringify(this.buffer)}\n\n`)
      this.clients.add(res)
      req.on('close', () => this.clients.delete(res))
      return
    }

    this.end(res, 404, 'Not found')
  }
}
