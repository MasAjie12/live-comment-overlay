# Live Comment Overlay

**Language:** [Bahasa Indonesia](README.md) | English

A lightweight overlay for following **TikTok** and **YouTube** live streams in a small floating window on top of
other apps (for example games). It shows comments, current viewers, total viewers, and likes in real time.

Built with Electron, Preact, and TypeScript. It uses [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector)
for TikTok and [`youtubei.js`](https://github.com/LuanRT/YouTube.js) for YouTube.

## Features

- TikTok and YouTube can be connected **at the same time**. Comments from both appear in a single list; a source
  tag (TT / YT) shows up automatically when both platforms are active.
- Per-platform stats: current viewers, total viewers, and likes.
- TikTok: recent gifts, gifter level badge, and join, follow, and share notifications.
- YouTube: Super Chats, Super Stickers, and new members appear as colored rows with the amount.
- Always-on-top window with adjustable opacity, click-through mode, tray icon, and keyboard shortcuts.
- Lightweight: no database, no chat history on disk, no telemetry, no auto-update.

## Download

Download the Windows installer (Windows 10/11, 64-bit) from the **Releases** page of this repository:
`live-comment-overlay-setup-X.Y.Z.exe`. Double-click to install (no admin rights needed, installs for the current user).

The installer is not code-signed, so Windows SmartScreen may show "Windows protected your PC". Click **More info**,
then **Run anyway**. You can verify the file by comparing its checksum with the `.sha256` file on the Releases page:

```powershell
certutil -hashfile live-comment-overlay-setup-X.Y.Z.exe SHA256
```

If you do not want to trust a prebuilt installer, you can build it yourself from source (see below).

## Usage

1. Open the app.
2. **TikTok:** enter the username of someone who is live (with or without @, or paste the live link), then click **Connect**.
3. **YouTube:** enter a live link (watch, `youtu.be`, `/live/`), a video ID, or an `@handle` / channel link, then click **Connect**.
   For a handle or channel, the app looks for the stream that is currently live on that channel.

Once connected, the input field turns into a status row. Click **Putus** (Disconnect) on the platform you want to stop.
(The interface is currently in Indonesian.)

### Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Shift+O | Show / hide the overlay |
| Ctrl+Shift+C | Turn click-through on / off |

With click-through on, the mouse passes through the overlay so it does not get in the way of your game. The overlay
cannot be clicked at that point, so turn it off again with Ctrl+Shift+C or from the tray menu (right-click the icon).

### Settings (gear icon)

- Opacity and text size
- Full view or comments only
- Hide profile pictures (on by default, saves memory)
- Gift level badge, join / follow / share notifications
- Disable animations and GPU acceleration (for weak GPUs, requires restart)
- TikTok and YouTube connection diagnostics, plus memory usage info

Position, size, and all settings are saved automatically.

## Notes per platform

**TikTok**
- `tiktok-live-connector` is an unofficial library. It can stop working if TikTok changes its systems, and it can be
  rate limited. If that happens often, update it: `npm update tiktok-live-connector`.
- Optional: set a Euler Stream API key in Settings (or the `EULER_API_KEY` environment variable) to reduce rate limiting.
- TikTok "Total" is an estimate: unique viewers detected (joins, comments, likes, gifts) since Connect, at least as
  large as the peak viewer count.

**YouTube**
- `youtubei.js` is also unofficial: no API key and no quota, but it can stop working if YouTube changes its systems.
  If that happens, update it: `npm update youtubei.js`.
- "Total" is YouTube's own total view count (`view_count`). It and the like count are re-fetched every 60 seconds,
  while current viewers update every few seconds. YouTube itself raises the total in chunks, so the number may
  look stuck for a while and then jump.
- Chat history from before you connected is not loaded. Streams with chat disabled, private streams, and
  members-only streams cannot be read.

**General**
- The overlay shows over windowed or borderless games. Exclusive fullscreen games usually cannot be overlaid.

## Troubleshooting

- **No TikTok numbers or comments:** open Settings, *Diagnostik koneksi TikTok*. If "Pesan WebSocket masuk" is 0, the
  connection is open but TikTok sends no data (usually rate limiting); set a Euler API key or wait a few minutes. If
  messages arrive but the numbers stay at 0, check "Event terdecode" and "Error terakhir".
- **YouTube numbers look wrong or empty:** open *Diagnostik YouTube*, click **Buat laporan**, and attach the text when you
  report an issue. It lists the numeric fields YouTube actually sends.
- **App will not open (Windows):**
  1. Close every `Live Comment Overlay` and `electron` process in Task Manager and try again.
  2. Check the logs in `%APPDATA%\live-comment-overlay\`: `startup.log` (startup steps; if it does not exist the app
     never ran, possibly blocked by Windows) and `error.log` (caught errors).
  3. If another instance is already running, the app shows a message instead of quietly closing.

## Run from source

Requires Node.js 20 or newer.

```bash
npm install
npm run dev         # development mode
npm run typecheck   # type check
```

## Build the installer yourself

On a Windows 10/11 (64-bit) PC:

```bash
npm install
npm run dist
```

The result is `dist/live-comment-overlay-setup-X.Y.Z.exe`. Portable build (no install): `npm run dist:portable`.
Node.js is only needed to build, not to run the app.

## Making a release (for maintainers)

Releases are built automatically by GitHub Actions (`.github/workflows/release.yml`):

1. Change `version` in `package.json` and commit.
2. Create and push a tag with the same version, for example `git tag v1.0.1` then `git push origin v1.0.1`.
3. The workflow builds the Windows installer and uploads it, with a SHA-256 checksum, to GitHub Releases.

If the tag does not match the version in `package.json`, the build stops. Running the workflow manually
(*Run workflow*) only builds and stores the result as an artifact, without creating a release.

## Customizing the watermark and links

The "Product by" watermark, name, and links (TikTok, Discord, donations) live in a single file: `src/shared/links.ts`.
Replace the values with your own if you make your own version. Links that still contain `GANTI` will not open when clicked.
The watermark picture is `src/renderer/src/assets/avatar.png`.

## Disclaimer

This project is **not affiliated with, endorsed by, or sponsored by** TikTok (ByteDance) or YouTube (Google). It uses
unofficial libraries to read live data, which may conflict with each platform's terms of service and can stop working at
any time. Use at your own risk. TikTok and YouTube names and trademarks belong to their respective owners.

## License

[MIT](LICENSE) © 2026 AS GAME
