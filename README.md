# Live Comment Overlay

**Bahasa:** Indonesia | [English](README.en.md)

Overlay ringan untuk memantau live **TikTok** dan **YouTube** dari jendela kecil yang mengambang di atas
aplikasi lain (misalnya game). Menampilkan komentar, jumlah penonton, total penonton, dan like secara
realtime.

Dibuat dengan Electron, Preact, dan TypeScript. Memakai [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector)
untuk TikTok dan [`youtubei.js`](https://github.com/LuanRT/YouTube.js) untuk YouTube.

## Fitur

- TikTok dan YouTube bisa tersambung **bersamaan**. Komentar keduanya tampil dalam satu daftar; penanda sumber
  (TT / YT) muncul otomatis saat dua platform aktif.
- Statistik per platform: penonton saat ini, total penonton, dan like.
- TikTok: gift terbaru, badge level gifter, serta notifikasi bergabung, follow, dan share.
- YouTube: Super Chat, Super Sticker, dan member baru tampil sebagai baris berwarna dengan nominalnya.
- Jendela selalu di atas, bisa diatur transparansinya, mode click-through, ikon tray, dan shortcut keyboard.
- Hemat sumber daya, tanpa database, tanpa riwayat chat di disk, tanpa telemetry, tanpa auto-update.

## Unduh

Unduh installer Windows (10/11, 64-bit) dari halaman **Releases** di repositori ini:
`live-comment-overlay-setup-X.Y.Z.exe`. Klik dua kali untuk memasang (tanpa perlu admin, terpasang untuk user
saat ini).

Installer belum ditandatangani (code signing), jadi Windows SmartScreen bisa menampilkan "Windows protected your PC".
Klik **More info**, lalu **Run anyway**. Kamu bisa memeriksa keutuhan berkas dengan membandingkan checksum di
berkas `.sha256` pada halaman Releases:

```powershell
certutil -hashfile live-comment-overlay-setup-X.Y.Z.exe SHA256
```

Kalau tidak percaya pada installer, kamu bisa membangunnya sendiri dari kode sumber (lihat di bawah).

## Cara pakai

1. Buka aplikasi.
2. **TikTok:** isi username yang sedang live (boleh dengan atau tanpa @, atau tempel link live), lalu klik **Connect**.
3. **YouTube:** isi link live (watch, `youtu.be`, `/live/`), video ID, atau `@handle` / link channel, lalu klik **Connect**.
   Untuk handle atau channel, aplikasi mencari live yang sedang berjalan di channel itu.

Setelah terhubung, kolom input berubah menjadi baris status. Klik **Putus** pada platform yang ingin dihentikan.

### Shortcut

| Shortcut | Fungsi |
|---|---|
| Ctrl+Shift+O | Tampilkan / sembunyikan overlay |
| Ctrl+Shift+C | Hidupkan / matikan click-through |

Saat click-through aktif, mouse menembus overlay sehingga tidak mengganggu game. Overlay tidak bisa diklik pada
saat itu, jadi matikan lagi dengan Ctrl+Shift+C atau lewat menu tray (klik kanan ikon).

### Pengaturan (ikon gir)

- Transparansi dan ukuran teks
- Tampilan Lengkap atau Komentar saja
- Sembunyikan foto profil (default aktif, lebih hemat memori)
- Badge level gift, notifikasi join / follow / share
- Matikan animasi dan akselerasi GPU (untuk GPU lemah, butuh restart)
- Diagnostik koneksi TikTok dan YouTube, serta info pemakaian memori

Posisi, ukuran, dan semua pengaturan tersimpan otomatis.

## Catatan per platform

**TikTok**
- `tiktok-live-connector` adalah library tidak resmi. Bisa berhenti bekerja jika TikTok mengubah sistemnya, dan bisa
  kena rate limit. Jika sering terjadi, update: `npm update tiktok-live-connector`.
- Opsional: isi API key Euler Stream di Pengaturan (atau variabel lingkungan `EULER_API_KEY`) untuk mengurangi rate limit.
- "Total" TikTok adalah perkiraan: penonton unik yang terdeteksi (masuk, komentar, like, gift) sejak Connect, minimal
  sebesar puncak jumlah penonton.

**YouTube**
- `youtubei.js` juga library tidak resmi: tanpa API key dan tanpa kuota, tapi bisa berhenti bekerja jika YouTube
  mengubah sistemnya. Jika itu terjadi, update: `npm update youtubei.js`.
- "Total" adalah total penayangan dari YouTube (`view_count`). Angka ini dan like diambil ulang tiap 60 detik, sedangkan
  jumlah penonton saat ini diperbarui tiap beberapa detik. YouTube sendiri menaikkan total dalam bongkahan, jadi
  sesekali angkanya tampak diam lalu melompat.
- Riwayat chat sebelum Connect tidak dimuat. Live yang chat-nya dimatikan, privat, atau khusus member tidak bisa dibaca.

**Umum**
- Overlay tampil di atas game mode windowed atau borderless. Game fullscreen eksklusif biasanya tidak bisa ditimpa.

## Pemecahan masalah

- **Angka dan komentar TikTok tidak muncul:** buka Pengaturan, bagian *Diagnostik koneksi TikTok*. Jika
  "Pesan WebSocket masuk" = 0, koneksi terbuka tapi TikTok tidak mengirim data (biasanya rate limit); isi API key Euler
  atau tunggu beberapa menit. Jika pesan masuk > 0 tapi angka tetap 0, lihat "Event terdecode" dan "Error terakhir".
- **Angka YouTube aneh atau kosong:** buka *Diagnostik YouTube*, klik **Buat laporan**, lalu lampirkan teksnya saat
  melapor di Issues. Isinya daftar field angka yang dikirim YouTube.
- **Aplikasi tidak mau terbuka (Windows):**
  1. Tutup semua proses `Live Comment Overlay` dan `electron` di Task Manager, lalu coba lagi.
  2. Lihat log di `%APPDATA%\live-comment-overlay\`: `startup.log` (jejak tahap start; jika berkas ini tidak ada,
     aplikasi tidak pernah berjalan, mungkin diblokir Windows) dan `error.log` (error yang tertangkap).
  3. Jika ada instance lain yang sedang berjalan, aplikasi menampilkan pesan, tidak menutup diri diam-diam.

## Menjalankan dari kode sumber

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev         # mode pengembangan
npm run typecheck   # pemeriksaan tipe
```

## Membuat installer sendiri

Jalankan di PC Windows 10/11 (64-bit):

```bash
npm install
npm run dist
```

Hasilnya `dist/live-comment-overlay-setup-X.Y.Z.exe`. Versi portable (tanpa instal): `npm run dist:portable`.
Node.js hanya dibutuhkan untuk membangun, tidak untuk menjalankan aplikasinya.

## Membuat rilis (untuk pengelola repositori)

Rilis dibangun otomatis oleh GitHub Actions (`.github/workflows/release.yml`):

1. Ubah `version` di `package.json`, lalu commit.
2. Buat dan dorong tag dengan versi yang sama, misalnya `git tag v1.0.1` lalu `git push origin v1.0.1`.
3. Workflow membangun installer Windows lalu mengunggahnya, beserta checksum SHA-256, ke GitHub Releases.

Jika tag tidak sama dengan versi di `package.json`, build dihentikan. Menjalankan workflow secara manual (*Run workflow*)
hanya membangun dan menyimpan hasilnya sebagai artifact, tanpa membuat rilis.

## Kustomisasi watermark dan link

Watermark "Product by", nama, dan link (TikTok, Discord, donasi) ada di satu file: `src/shared/links.ts`. Ganti
nilainya dengan milikmu jika kamu membuat versi sendiri. Link yang masih berisi `GANTI` tidak akan dibuka saat diklik.
Foto di watermark ada di `src/renderer/src/assets/avatar.png`.

## Disclaimer

Proyek ini **tidak berafiliasi dengan, tidak didukung, dan tidak disponsori** oleh TikTok (ByteDance) maupun YouTube
(Google). Aplikasi ini memakai library tidak resmi untuk membaca data live, yang dapat bertentangan dengan ketentuan
layanan masing-masing platform dan bisa berhenti bekerja kapan saja. Gunakan dengan risiko sendiri. Nama dan merek
dagang TikTok dan YouTube adalah milik pemiliknya masing-masing.

## Lisensi

[MIT](LICENSE) © 2026 AS GAME
