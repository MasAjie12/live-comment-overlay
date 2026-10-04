import type { Platform } from '../../../shared/types'

const TEXT: Record<Platform, string> = { tiktok: 'TT', youtube: 'YT' }
const TITLE: Record<Platform, string> = { tiktok: 'TikTok', youtube: 'YouTube' }

/** Penanda kecil sumber (TikTok / YouTube) */
export function PlatformTag({ platform }: { platform: Platform }) {
  return (
    <span class={`src src-${platform}`} title={TITLE[platform]}>
      {TEXT[platform]}
    </span>
  )
}
