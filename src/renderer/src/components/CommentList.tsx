import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ChatItem } from '../../../shared/types'
import { levelTier, nameColor } from '../utils'
import { PlatformTag } from './PlatformTag'

const NOTICE_LABEL = { follow: 'mulai mengikuti', share: 'membagikan live' } as const

function paidLabel(c: ChatItem): string {
  const p = c.paid
  if (!p) return ''
  if (p.kind === 'member') return 'Member baru'
  if (p.kind === 'gift') return p.amount ? `Gift ${p.amount}` : 'Gift'
  if (p.kind === 'sticker') return p.amount ? `Sticker ${p.amount}` : 'Sticker'
  return p.amount ?? 'Super Chat'
}

interface Props {
  chats: ChatItem[]
  hideAvatars: boolean
  showLevel: boolean
  /** tampilkan badge team (hati) TikTok */
  showTeam: boolean
  /** bentuk penanda sumber: teks atau logo */
  sourceStyle: 'text' | 'logo'
  /** tampilkan penanda sumber (TT/YT) di tiap komentar */
  showSource: boolean
  emptyText: string
}

export function CommentList({ chats, hideAvatars, showLevel, showTeam, sourceStyle, showSource, emptyText }: Props) {
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
            <div
              class={`comment item${c.paid ? ` paid paid-${c.paid.kind}` : ''}${c.notice ? ` notice notice-${c.notice}` : ''}`}
              key={`${c.platform}-${c.id}`}
            >
              {showSource ? <PlatformTag platform={c.platform} mode={sourceStyle} /> : null}
              {!hideAvatars && c.avatar ? <img class="avatar" src={c.avatar} referrerpolicy="no-referrer" loading="lazy" width={20} height={20} alt="" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} /> : null}
              {showLevel && c.level ? (
                <span class={`lv lv-${levelTier(c.level)}`} title={`Level gift ${c.level}`}>
                  {c.level}
                </span>
              ) : null}
              {showTeam && c.team ? (
                <span class={`team${c.team >= 10 ? ' team-2' : ''}`} title={`Level team ${c.team}`}>
                  <svg viewBox="0 0 24 22" aria-hidden="true">
                    <path d="M12 21S4 15.8 4 10a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 5.8-8 11-8 11z" fill="currentColor" />
                  </svg>
                  <b>{c.team}</b>
                </span>
              ) : null}
              <span class="comment-name" style={{ color: nameColor(c.user || c.nick) }}>
                {c.nick}
              </span>
              {c.paid ? <span class="paid-amt">{paidLabel(c)}</span> : null}
              <span class="comment-text">
                {c.notice
                  ? NOTICE_LABEL[c.notice]
                  : c.parts
                  ? c.parts.map((p, i) =>
                      p.t === 'text' ? (
                        p.v
                      ) : (
                        <img
                          key={i}
                          class="emoji"
                          src={p.url}
                          alt={p.alt}
                          title={p.alt}
                          loading="lazy"
                          decoding="async"
                          referrerpolicy="no-referrer"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                        />
                      )
                    )
                  : c.text}
              </span>
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
