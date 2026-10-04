import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import preact from '@preact/preset-vite'

// CSP hanya disisipkan saat build produksi (di dev, HMR butuh inline script)
const injectCsp = {
  name: 'inject-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    const csp =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'none'"
    return html.replace(
      '<!--CSP-->',
      `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
    )
  }
}

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [preact(), injectCsp],
    build: { sourcemap: false, minify: 'esbuild' }
  }
})
