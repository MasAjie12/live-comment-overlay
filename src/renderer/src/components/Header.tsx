import type { ConnState } from '../../../shared/types'
import { STATE_LABEL } from '../utils'

interface Props {
  /** status gabungan semua platform */
  state: ConnState
  /** nama platform yang sedang aktif, mis. ["@user", "Nama Channel"] */
  names: string[]
  clickThrough: boolean
  settingsOpen: boolean
  onToggleSettings(): void
}

export function Header({ state, names, clickThrough, settingsOpen, onToggleSettings }: Props) {
  return (
    <header class="header">
      <span class={`dot dot-${state}`} aria-hidden="true" />
      <span class="status">
        {STATE_LABEL[state]}
        {names.length ? <span class="uname"> {names.join(' · ')}</span> : null}
      </span>
      {clickThrough ? <span class="badge">Click-through</span> : null}
      <span class="spacer" />
      <button class={`btn-icon ${settingsOpen ? 'on' : ''}`} title="Pengaturan" aria-label="Pengaturan" onClick={onToggleSettings}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
        </svg>
      </button>
      <button class="btn-icon" title="Minimize" aria-label="Minimize" onClick={() => window.overlay.minimize()}>
        <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.5">
          <path d="M3 11.5h10" />
        </svg>
      </button>
      <button class="btn-icon close" title="Keluar" aria-label="Keluar aplikasi" onClick={() => window.overlay.quit()}>
        <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </header>
  )
}
