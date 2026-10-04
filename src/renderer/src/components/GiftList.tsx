import type { GiftItem } from '../../../shared/types'
import { fmt, nameColor } from '../utils'

export function GiftList({ gifts }: { gifts: GiftItem[] }) {
  return (
    <section class="gifts" aria-label="Gift terbaru">
      {gifts.length === 0 ? (
        <p class="empty small">Belum ada gift.</p>
      ) : (
        gifts.map((g) => (
          <div class="gift item" key={g.id}>
            <span class="gift-who" style={{ color: nameColor(g.user || g.nick) }}>
              {g.nick}
            </span>
            <span class="gift-what">
              {g.gift} <b>×{g.count}</b>
            </span>
            {g.diamonds > 0 ? <span class="gift-val">{fmt(g.diamonds)}</span> : null}
          </div>
        ))
      )}
    </section>
  )
}
