import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ChatItem } from '../../../shared/types'
import { levelTier, nameColor } from '../utils'
import { PlatformTag } from './PlatformTag'

function paidLabel(c: ChatItem): string {
  const p = c.paid
  if (!p) return ''
  if (p.kind === 'member') return 'Member baru'
  if (p.kind === 'sticker') return p.amount ? `Sticker ${p.amount}` : 'Sticker'
  return p.amount ?? 'Super Chat'
}

interface Props {
  chats: ChatItem[]
  hideAvatars: boolean
  showLevel: boolean
  /** tampilkan penanda sumber (TT/YT) di tiap komentar */
  showSource: boolean
  emptyText: string
}

export function CommentList({ chats, hideAvatars, showLevel, showSource, emptyText }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [away, setAway] = useState(false)

  useLayoutEffect(() => {
    const el = box.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [chats])

  const onScroll = () => {
    const el = box.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    stick.current = atBottom
    if (atBottom === away) setAway(!atBottom)
  }

  const jump = () => {
    const el = box.current
    if (!el) return
    stick.current = true
    el.scrollTop = el.scrollHeight
    setAway(false)
  }

  return (
    <div class="comments-wrap">
      <div class="comments" ref={box} onScroll={onScroll}>
        {chats.length === 0 ? (
          <p class="empty">{emptyText}</p>
        ) : (
          chats.map((c) => (
            <div class={`comment item${c.paid ? ` paid paid-${c.paid.kind}` : ''}`} key={`${c.platform}-${c.id}`}>
              {showSource ? <PlatformTag platform={c.platform} /> : null}
              {!hideAvatars && c.avatar ? <img class="avatar" src={c.avatar} referrerpolicy="no-referrer" loading="lazy" width={20} height={20} alt="" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} /> : null}
              {showLevel && c.level ? (
                <span class={`lv lv-${levelTier(c.level)}`} title={`Level gift ${c.level}`}>
                  {c.level}
                </span>
              ) : null}
              <span class="comment-name" style={{ color: nameColor(c.user || c.nick) }}>
                {c.nick}
              </span>
              {c.paid ? <span class="paid-amt">{paidLabel(c)}</span> : null}
              <span class="comment-text">{c.text}</span>
            </div>
          ))
        )}
      </div>
      {away ? (
        <button class="jump" onClick={jump}>
          Ke komentar terbaru
        </button>
      ) : null}
    </div>
  )
}
