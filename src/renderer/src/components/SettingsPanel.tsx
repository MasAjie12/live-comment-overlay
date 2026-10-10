import { useEffect, useState } from 'preact/hooks'
import type { Diag, Settings } from '../../../shared/types'
import { LINKS, NAMES } from '../../../shared/links'

interface Props {
  settings: Settings
  onChange(patch: Partial<Settings>): void
}

export function SettingsPanel({ settings, onChange }: Props) {
  const [mem, setMem] = useState<number | null>(null)
  const [diag, setDiag] = useState<Diag | null>(null)
  const [ytReport, setYtReport] = useState('')

  useEffect(() => {
    let live = true
    const read = () => {
      window.overlay.getMemory().then((v) => live && setMem(v))
      window.overlay.getDiag().then((d) => live && setDiag(d))
    }
    read()
    const t = setInterval(read, 3000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  return (
    <div class="settings" role="dialog" aria-label="Pengaturan">
      <label class="row">
        <span>Transparansi</span>
        <input
          type="range"
          min="0.3"
          max="1"
          step="0.05"
          value={settings.opacity}
          onInput={(e) => onChange({ opacity: Number((e.target as HTMLInputElement).value) })}
        />
      </label>
      <label class="row">
        <span>Ukuran teks</span>
        <input
          type="range"
          min="11"
          max="20"
          step="1"
          value={settings.fontSize}
          onInput={(e) => onChange({ fontSize: Number((e.target as HTMLInputElement).value) })}
        />
      </label>

      <div class="row">
        <span>Tampilan</span>
        <div class="seg">
          <button class={settings.mode === 'full' ? 'on' : ''} onClick={() => onChange({ mode: 'full' })}>
            Lengkap
          </button>
          <button class={settings.mode === 'compact' ? 'on' : ''} onClick={() => onChange({ mode: 'compact' })}>
            Komentar saja
          </button>
        </div>
      </div>

      <label class="check">
        <input type="checkbox" checked={settings.hideAvatars} onChange={(e) => onChange({ hideAvatars: (e.target as HTMLInputElement).checked })} />
        <span>Sembunyikan foto profil (lebih hemat memori)</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.showLevel} onChange={(e) => onChange({ showLevel: (e.target as HTMLInputElement).checked })} />
        <span>Tampilkan badge level gift di komentar</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.showJoin} onChange={(e) => onChange({ showJoin: (e.target as HTMLInputElement).checked })} />
        <span>Notifikasi penonton bergabung</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.showFollow} onChange={(e) => onChange({ showFollow: (e.target as HTMLInputElement).checked })} />
        <span>Notifikasi follow</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.showShare} onChange={(e) => onChange({ showShare: (e.target as HTMLInputElement).checked })} />
        <span>Notifikasi share</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.noAnimation} onChange={(e) => onChange({ noAnimation: (e.target as HTMLInputElement).checked })} />
        <span>Matikan animasi</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.clickThrough} onChange={(e) => onChange({ clickThrough: (e.target as HTMLInputElement).checked })} />
        <span>Click-through: mouse menembus overlay</span>
      </label>
      <label class="check">
        <input type="checkbox" checked={settings.disableGpu} onChange={(e) => onChange({ disableGpu: (e.target as HTMLInputElement).checked })} />
        <span>Matikan akselerasi GPU (untuk GPU lemah)</span>
      </label>
      <button class="btn-text restart" onClick={() => window.overlay.restart()}>
        Restart aplikasi untuk menerapkan pengaturan GPU
      </button>

      <p class="hint">
        Ctrl+Shift+O: tampil/sembunyi. Ctrl+Shift+C: click-through. Saat click-through aktif, overlay tidak bisa diklik; matikan dengan Ctrl+Shift+C.
      </p>
      <label class="row">
        <span>API key Euler (opsional)</span>
        <input
          class="input key"
          type="password"
          value={settings.signApiKey ?? ''}
          placeholder="kosongkan jika tidak punya"
          spellcheck={false}
          onChange={(e) => onChange({ signApiKey: (e.target as HTMLInputElement).value })}
        />
      </label>
      <p class="hint">Isi jika sering gagal atau terkena rate limit (eulerstream.com). Berlaku saat Connect berikutnya.</p>

      <details class="diag">
        <summary>Diagnostik koneksi TikTok</summary>
        {diag ? (
          <div class="diag-body">
            <div>Status: {diag.state}{diag.roomId ? ` · room ${diag.roomId}` : ''}</div>
            <div>Pesan WebSocket masuk: {diag.wsMessages}</div>
            <div>
              Event terdecode:{' '}
              {Object.keys(diag.events).length === 0
                ? 'belum ada'
                : Object.entries(diag.events)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(', ')}
            </div>
            {Object.entries(diag.fields).map(([k, v]) => (
              <div key={k}>
                Field {k}: {v.join(', ')}
              </div>
            ))}
            <div>Level gift terbaca dari: {diag.levelSource ?? 'belum ada'}</div>
            <div>payGrade.level mentah: {diag.levelRaw ?? 'tidak ada'} · sceneType badge: {diag.sceneTypes || 'tidak ada'}</div>
            <div>
              Notifikasi dibuat:{' '}
              {diag.notif && Object.keys(diag.notif).length
                ? Object.entries(diag.notif).map(([k, v]) => `${k} ${v}`).join(', ')
                : 'belum ada'}
            </div>
            <div>Pesan sosial (follow/share): {diag.socialProbe ?? 'belum ada'}</div>
            <div>
              Emoji komentar: kode [xxx] ditemukan di {diag.emoji?.withCode ?? 0} komentar, diganti emoji{' '}
              {diag.emoji?.converted ?? 0}x, komentar beremotes gambar {diag.emoji?.withEmotes ?? 0}
            </div>
            <div>
              Kode emoji belum dikenal:{' '}
              {diag.emoji && Object.keys(diag.emoji.unknown).length
                ? Object.entries(diag.emoji.unknown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 15)
                    .map(([k, v]) => `[${k}] ${v}x`)
                    .join(', ')
                : 'tidak ada'}
            </div>
            {diag.emoji?.emoteSamples.length ? <div>Contoh emotes mentah: {diag.emoji.emoteSamples.join(' | ')}</div> : null}
            {diag.lastError ? <div class="diag-err">Error terakhir: {diag.lastError}</div> : null}
          </div>
        ) : null}
      </details>

      <details class="diag">
        <summary>Diagnostik YouTube</summary>
        <div class="diag-body">
          <div>Sambungkan ke live YouTube, tunggu 1-2 menit, lalu klik Buat laporan dan kirim teksnya.</div>
          <div class="diag-actions">
            <button class="btn-text" onClick={() => window.overlay.getYoutubeReport().then(setYtReport)}>
              Buat laporan
            </button>
            <button
              class="btn-text"
              disabled={!ytReport}
              onClick={() => navigator.clipboard?.writeText(ytReport).catch(() => undefined)}
            >
              Salin
            </button>
          </div>
          {ytReport ? (
            <textarea class="diag-report" readOnly value={ytReport} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          ) : null}
        </div>
      </details>
      <div class="donate">
        <p>
          Aplikasi ini gratis. Jika terbantu, kamu bisa mendukung pengembangannya dengan berdonasi.
          <br />-{NAMES.tiktok}.
        </p>
        <button class="donate-btn" onClick={() => window.overlay.openExternal(LINKS.donate)}>
          Donasi via SociaBuzz
        </button>
      </div>
      <p class="hint">Memori aplikasi: {mem === null ? '…' : `${mem} MB`}</p>
    </div>
  )
}
