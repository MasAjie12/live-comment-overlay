import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { ChatItem, ConnState, EventItem, GiftItem, Settings, Stats } from '../../shared/types'
import { isBusy } from './utils'
import { Header } from './components/Header'
import { ConnectForm } from './components/ConnectForm'
import { StatsBar, type StatRow } from './components/StatsBar'
import { GiftList } from './components/GiftList'
import { CommentList } from './components/CommentList'
import { SettingsPanel } from './components/SettingsPanel'
import { EventTicker, type LiveEvent } from './components/EventTicker'
import { Watermark } from './components/Watermark'

const MAX_CHATS = 100
const MAX_GIFTS = 15
const EVENT_TTL_MS = 10_000
/** join baru tidak menimpa join sebelumnya sebelum waktu ini (hindari berkedip) */
const JOIN_MIN_MS = 1500

/** Gabungkan notifikasi (join) baru ke satu slot tampilan: yang terbaru menang, tapi tidak lebih cepat dari JOIN_MIN_MS */
function mergeEvent(prev: LiveEvent[], incoming: EventItem[], now: number): LiveEvent[] {
  let cur: LiveEvent | undefined = prev[prev.length - 1]
  for (const e of incoming) {
    if (cur && now - cur.t < JOIN_MIN_MS) continue
    cur = { id: e.id, kind: e.kind, nick: e.nick, t: now }
  }
  return cur ? [cur] : []
}
const EMPTY_STATS: Stats = { viewers: 0, totalViewers: 0, likes: 0 }

/** Status satu platform */
interface Plat {
  state: ConnState
  message?: string
  username: string
}
const IDLE: Plat = { state: 'idle', username: '' }

/** Status gabungan untuk header: yang aktif menang atas yang gagal/idle */
function aggregate(a: ConnState, b: ConnState): ConnState {
  const all = [a, b]
  for (const s of ['connected', 'reconnecting', 'connecting'] as ConnState[]) if (all.includes(s)) return s
  return all.find((s) => s !== 'idle') ?? 'idle'
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const settingsRef = useRef<Settings | null>(null)
  settingsRef.current = settings
  const [tt, setTt] = useState<Plat>(IDLE)
  const [yt, setYt] = useState<Plat>(IDLE)
  const [ttStats, setTtStats] = useState<Stats>(EMPTY_STATS)
  const [ytStats, setYtStats] = useState<Stats>(EMPTY_STATS)
  const [chats, setChats] = useState<ChatItem[]>([])
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [clickThrough, setClickThrough] = useState(false)

  useEffect(() => {
    window.overlay.getSettings().then((s) => {
      setSettings(s)
      setClickThrough(s.clickThrough)
    })

    const offBatch = window.overlay.onBatch((b) => {
      if (b.stats) (b.platform === 'youtube' ? setYtStats : setTtStats)(b.stats)
      // follow dan share tampil di daftar chat bersama komentar; hanya join yang tetap di ticker bawah
      const s = settingsRef.current
      const joins: EventItem[] = []
      const notices: ChatItem[] = []
      for (const e of b.events ?? []) {
        if (e.kind === 'join') {
          if (!s || s.showJoin) joins.push(e)
        } else if (!s || (e.kind === 'follow' ? s.showFollow : s.showShare)) {
          notices.push({ id: e.id, platform: b.platform, user: e.user, nick: e.nick, text: '', notice: e.kind })
        }
      }
      const incoming = notices.length ? b.chats.concat(notices) : b.chats
      if (incoming.length) {
        setChats((prev) => {
          const next = prev.concat(incoming)
          return next.length > MAX_CHATS ? next.slice(next.length - MAX_CHATS) : next
        })
      }
      if (joins.length) {
        const now = Date.now()
        setEvents((prev) => mergeEvent(prev, joins, now))
      }
      if (b.gifts.length) {
        setGifts((prev) => b.gifts.slice().reverse().concat(prev).slice(0, MAX_GIFTS))
      }
    })
    const offStatus = window.overlay.onStatus((s) => {
      const set = s.platform === 'youtube' ? setYt : setTt
      set((prev) => ({ state: s.state, message: s.message, username: s.username || prev.username }))
    })
    const offCT = window.overlay.onClickThrough(setClickThrough)

    return () => {
      offBatch()
      offStatus()
      offCT()
    }
  }, [])

  // Notifikasi hilang sendiri setelah beberapa detik; timer hanya jalan saat ada notifikasi
  useEffect(() => {
    if (!events.length) return
    const t = setInterval(() => {
      const now = Date.now()
      setEvents((prev) => {
        const next = prev.filter((e) => now - e.t < EVENT_TTL_MS)
        return next.length === prev.length ? prev : next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [events.length])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    window.overlay.setSettings(patch).then((s) => setSettings(s))
  }, [])

  const connectTiktok = useCallback((name: string) => {
    setChats((prev) => prev.filter((c) => c.platform !== 'tiktok'))
    setGifts([])
    setEvents([])
    setTtStats(EMPTY_STATS)
    setShowSettings(false)
    setSettings((s) => (s ? { ...s, username: name } : s))
    window.overlay.connect(name)
  }, [])

  const connectYoutube = useCallback((input: string) => {
    setChats((prev) => prev.filter((c) => c.platform !== 'youtube'))
    setYtStats(EMPTY_STATS)
    setShowSettings(false)
    setSettings((s) => (s ? { ...s, youtubeInput: input } : s))
    window.overlay.connectYoutube(input)
  }, [])

  if (!settings) return null

  const ttBusy = isBusy(tt.state)
  const ytBusy = isBusy(yt.state)
  const anyBusy = ttBusy || ytBusy
  const ttName = tt.username ? `@${tt.username}` : ''
  const ytName = yt.username
  const names = [ttBusy ? ttName : '', ytBusy ? ytName || 'YouTube' : ''].filter(Boolean)
  const statRows: StatRow[] = []
  if (tt.state !== 'idle') statRows.push({ platform: 'tiktok', stats: ttStats })
  if (yt.state !== 'idle') statRows.push({ platform: 'youtube', stats: ytStats })
  // Penanda sumber hanya perlu saat dua platform aktif, atau saat daftar masih memuat komentar dari keduanya
  const showSource =
    (ttBusy && ytBusy) ||
    (chats.some((c) => c.platform === 'tiktok') && chats.some((c) => c.platform === 'youtube'))
  const tickerOn = settings.showJoin
  const shownEvents = events.filter((e) => e.kind === 'join' && settings.showJoin)
  const emptyText = anyBusy
    ? 'Menunggu komentar…'
    : 'Isi username TikTok atau link/handle YouTube yang sedang live, lalu klik Connect.'

  return (
    <div class={`app ${settings.noAnimation ? 'noanim' : ''}`} style={`--fs:${settings.fontSize}px`}>
      <Header
        state={aggregate(tt.state, yt.state)}
        names={names}
        clickThrough={clickThrough}
        settingsOpen={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />

      {showSettings ? <SettingsPanel settings={settings} onChange={update} /> : null}

      <div class="sources">
        <ConnectForm
          platform="tiktok"
          initial={settings.username}
          placeholder="TikTok: @username yang sedang live"
          state={tt.state}
          message={tt.message}
          name={ttName}
          autoFocus
          sourceStyle={settings.sourceStyle}
          onConnect={connectTiktok}
          onDisconnect={() => window.overlay.disconnect()}
        />
        <ConnectForm
          platform="youtube"
          initial={settings.youtubeInput}
          placeholder="YouTube: link live atau @handle"
          state={yt.state}
          message={yt.message}
          name={ytName}
          sourceStyle={settings.sourceStyle}
          onConnect={connectYoutube}
          onDisconnect={() => window.overlay.disconnectYoutube()}
        />
      </div>

      {settings.mode === 'full' && statRows.length ? (
        <>
          <StatsBar rows={statRows} sourceStyle={settings.sourceStyle} />
          {tt.state !== 'idle' ? <GiftList gifts={gifts} /> : null}
        </>
      ) : null}

      <CommentList chats={chats} hideAvatars={settings.hideAvatars} showLevel={settings.showLevel} showTeam={settings.showTeam} sourceStyle={settings.sourceStyle} showSource={showSource} emptyText={emptyText} />
      {tickerOn && tt.state !== 'idle' ? <EventTicker events={shownEvents} /> : null}
      <Watermark />
    </div>
  )
}
