import type { EventKind } from '../../../shared/types'

export interface LiveEvent {
  id: number
  kind: EventKind
  nick: string
  /** waktu event diterima (ms) */
  t: number
}

const LABEL: Record<EventKind, string> = {
  join: 'bergabung',
  follow: 'mulai mengikuti',
  share: 'membagikan live'
}

export function EventTicker({ events }: { events: LiveEvent[] }) {
  return (
    <div class="ticker" aria-live="polite">
      {events.map((e) => (
        <div class={`ticker-row ev-${e.kind} item`} key={e.id}>
          <span class="ticker-nick">{e.nick}</span> {LABEL[e.kind]}
        </div>
      ))}
    </div>
  )
}
