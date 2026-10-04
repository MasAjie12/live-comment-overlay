import type { Platform, Stats } from '../../../shared/types'
import { fmt } from '../utils'
import { PlatformTag } from './PlatformTag'

export interface StatRow {
  platform: Platform
  stats: Stats
}

/** Satu baris statistik per platform yang aktif */
export function StatsBar({ rows }: { rows: StatRow[] }) {
  return (
    <section class="stats" aria-label="Statistik live">
      {rows.map(({ platform, stats }) => (
        <div class="stats-row" key={platform}>
          <div class="stats-src">
            <PlatformTag platform={platform} />
          </div>
          <div class="stat">
            <b>{fmt(stats.viewers)}</b>
            <span>Penonton</span>
          </div>
          <div class="stat" title="Perkiraan: penonton unik yang terdeteksi sejak Connect">
            <b>{fmt(stats.totalViewers)}</b>
            <span>Total</span>
          </div>
          <div class="stat">
            <b>{fmt(stats.likes)}</b>
            <span>Like</span>
          </div>
        </div>
      ))}
    </section>
  )
}
