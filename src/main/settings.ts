import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import type { Settings } from '../shared/types'

const defaults: Settings = {
  username: '',
  youtubeInput: '',
  mode: 'full',
  opacity: 0.92,
  fontSize: 13,
  hideAvatars: true,
  showLevel: true,
  showJoin: true,
  showFollow: true,
  showShare: true,
  noAnimation: false,
  disableGpu: false,
  clickThrough: false
}

let cache: Settings | null = null
let timer: NodeJS.Timeout | null = null

const filePath = () => join(app.getPath('userData'), 'settings.json')

export function loadSettings(): Settings {
  if (cache) return cache
  try {
    const raw = JSON.parse(readFileSync(filePath(), 'utf8'))
    cache = { ...defaults, ...raw }
  } catch {
    cache = { ...defaults }
  }
  // clickThrough tidak dipulihkan saat start agar user tidak "terkunci" di luar overlay
  cache!.clickThrough = false
  return cache!
}

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback

export function saveSettings(patch: Partial<Settings>): Settings {
  const cur = loadSettings()
  const next: Settings = { ...cur }

  if (typeof patch.username === 'string') next.username = patch.username.slice(0, 64)
  if (typeof patch.youtubeInput === 'string') next.youtubeInput = patch.youtubeInput.slice(0, 200)
  if (patch.mode === 'full' || patch.mode === 'compact') next.mode = patch.mode
  if ('opacity' in patch) next.opacity = clamp(patch.opacity, 0.3, 1, cur.opacity)
  if ('fontSize' in patch) next.fontSize = clamp(patch.fontSize, 11, 20, cur.fontSize)
  if (typeof patch.hideAvatars === 'boolean') next.hideAvatars = patch.hideAvatars
  if (typeof patch.showLevel === 'boolean') next.showLevel = patch.showLevel
  if (typeof patch.showJoin === 'boolean') next.showJoin = patch.showJoin
  if (typeof patch.showFollow === 'boolean') next.showFollow = patch.showFollow
  if (typeof patch.showShare === 'boolean') next.showShare = patch.showShare
  if (typeof patch.noAnimation === 'boolean') next.noAnimation = patch.noAnimation
  if (typeof patch.disableGpu === 'boolean') next.disableGpu = patch.disableGpu
  if (typeof patch.clickThrough === 'boolean') next.clickThrough = patch.clickThrough
  if (patch.bounds) next.bounds = patch.bounds
  if (typeof patch.signApiKey === 'string') next.signApiKey = patch.signApiKey.trim().slice(0, 200) || undefined

  cache = next
  if (timer) clearTimeout(timer)
  timer = setTimeout(flushSettings, 400)
  return next
}

export function flushSettings(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!cache) return
  try {
    writeFileSync(filePath(), JSON.stringify(cache, null, 2), 'utf8')
  } catch {
    /* abaikan */
  }
}
