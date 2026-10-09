import type { OverlayApi } from '../../shared/types'

declare global {
  interface Window {
    overlay: OverlayApi
  }
}

export {}

declare module '*.png' {
  const src: string
  export default src
}
