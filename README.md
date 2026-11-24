# Live Comment Overlay

**Bahasa:** Indonesia | [English](README.en.md)

Overlay ringan untuk memantau live **TikTok** dan **YouTube** dari jendela kecil yang mengambang di atas
aplikasi lain (misalnya game). Menampilkan komentar, jumlah penonton, total penonton, dan like secara
realtime.

> [Melaporkan masalah](#melaporkan-masalah).

Dibuat dengan Electron, Preact, dan TypeScript. Memakai [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector)
untuk TikTok dan [`youtubei.js`](https://github.com/LuanRT/YouTube.js) untuk YouTube.

## Fitur

- TikTok dan YouTube bisa tersambung **bersamaan**. Komentar keduanya tampil dalam satu daftar; penanda sumber
  (TT / YT) muncul otomatis saat dua platform aktif.
- Statistik per platform: penonton saat ini, total penonton, dan like.
- TikTok: gift terbaru, badge level gifter, badge team (hati, bila terbaca), notifikasi follow dan share (tampil di daftar chat bersama komentar), serta
  notifikasi bergabung di bagian bawah.
- YouTube: Super Chat, Super Sticker, dan member baru tampil sebagai baris berwarna dengan nominalnya.
- **Overlay untuk OBS:** komentar, gift, follow, dan share bisa ditampilkan ke penonton lewat Browser Source dengan latar
  transparan (lihat bagian *Overlay untuk OBS*).
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
- Badge level gift dan badge team (hati), notifikasi join / follow / share
- Penanda sumber komentar: teks (TT / YT) atau logo TikTok / YouTube
- Matikan animasi dan akselerasi GPU (untuk GPU lemah, butuh restart)
- Diagnostik koneksi TikTok dan YouTube, serta info pemakaian memori

Posisi, ukuran, dan semua pengaturan tersimpan otomatis.

## Overlay untuk OBS (tampilkan komentar ke penonton)

Jendela aplikasi sendiri tidak transparan dan memuat tombol serta pengaturan, jadi tidak cocok ditangkap langsung ke
stream. Sebagai gantinya aplikasi menyediakan halaman overlay terpisah untuk **Browser Source** OBS: latar transparan,
hanya daftar komentar, tanpa tombol.

1. Buka Pengaturan (ikon gir) lalu centang **Overlay untuk OBS**. Alamat URL muncul di bawahnya; klik **Salin URL**.
2. Di OBS: **Sources, Add, Browser**, tempel URL tadi, lalu atur lebar dan tinggi (mis. 500 x 700). Jangan
   mencentang pengaturan yang memberi latar. Browser Source OBS transparan secara bawaan.
3. Hubungkan TikTok dan/atau YouTube di aplikasi seperti biasa. Komentar muncul di OBS.

Yang ditampilkan: komentar TikTok dan YouTube (termasuk Super Chat, member, dan gift YouTube), gift TikTok, serta
notifikasi follow dan share. Notifikasi bergabung tidak ditampilkan.

Atur tampilan lewat parameter di akhir URL, dipisah dengan `&`:

| Parameter | Arti | Bawaan |
|---|---|---|
| `size=24` | ukuran huruf (px, 8-120) | 22 |
| `lines=8` | jumlah baris maksimum (1-50) | 8 |
| `fade=30` | komentar hilang setelah 30 detik (0 = tidak hilang) | 0 |
| `tag=auto` | penanda sumber: `auto` (tampil bila dua platform aktif), `on`, `off` | auto |
| `tagstyle=logo` | bentuk penanda sumber: `text` (TT / YT) atau `logo` (logo TikTok / YouTube) | text |
| `bg=1` | baris berlatar gelap semi-transparan | 0 |
| `align=top` | daftar menempel di atas (bawaan: di bawah) | bottom |
| `badges=0` | sembunyikan badge level gift dan badge team | 1 |

Contoh: `http://127.0.0.1:38457/overlay?token=...&size=26&lines=6&fade=40&bg=1`

Catatan:
- Aplikasi harus tetap terbuka di komputer yang sama dengan OBS. Jika aplikasi ditutup, komentar di stream hilang.
- Server hanya menerima koneksi dari komputer ini (`127.0.0.1`) dan memakai token acak di URL. Jangan tampilkan URL itu di
  layar yang kamu siarkan. Server tidak menyala kecuali kamu mencentang opsinya.
- **Semua komentar tampil apa adanya, tanpa penyaring.** Komentar kasar atau spam akan terlihat penonton.
- Port bawaan 38457; jika terpakai, aplikasi mencoba port berikutnya (URL di Pengaturan selalu yang terbaru).
- Setelah OBS dimuat ulang, beberapa komentar terakhir tampil kembali (aplikasi menyimpan 60 baris terakhir di memori).

## Catatan per platform

**TikTok**
- `tiktok-live-connector` adalah library tidak resmi. Bisa berhenti bekerja jika TikTok mengubah sistemnya, dan bisa
  kena rate limit. Jika sering terjadi, update: `npm update tiktok-live-connector`.
- Opsional: isi API key Euler Stream di Pengaturan (atau variabel lingkungan `EULER_API_KEY`) untuk mengurangi rate limit.
- Emoji bawaan TikTok dikirim sebagai kode teks, mis. `[laughcry]`. Aplikasi menggantinya dengan emoji Unicode yang
  paling mendekati artinya (gambar aslinya hanya ada di aplikasi TikTok, jadi tampilannya tidak persis sama). Kode yang
  belum dikenal tetap tampil apa adanya dan dicatat di *Diagnostik koneksi TikTok*. Untuk menambah, edit
  `src/shared/tiktokEmoji.ts` (satu baris per kode). Emote bergambar milik kreator tampil sebagai gambar.
- "Total" TikTok adalah perkiraan: penonton unik yang terdeteksi (masuk, komentar, like, gift) sejak Connect, minimal
  sebesar puncak jumlah penonton.

**YouTube**
- `youtubei.js` juga library tidak resmi: tanpa API key dan tanpa kuota, tapi bisa berhenti bekerja jika YouTube
  mengubah sistemnya. Jika itu terjadi, update: `npm update youtubei.js`.
- "Total" adalah total penayangan dari YouTube (`view_count`). Angka ini dan like diambil ulang tiap 60 detik, sedangkan
  jumlah penonton saat ini diperbarui tiap beberapa detik. YouTube sendiri menaikkan total dalam bongkahan, jadi
  sesekali angkanya tampak diam lalu melompat.
- Gift YouTube (Jewels / Crystal) yang masuk ke chat tampil sebagai baris ungu dengan ikon gift dan nominalnya, mis.
  "Gift 100". Animasi gift di atas video tidak ditampilkan. Dukungan ini baru diuji pada satu jenis gift; jika ada
  gift yang tidak muncul, kirim hasil *Diagnostik YouTube* (bagian "tipe item chat").
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

## Melaporkan masalah

Buka tab **Issues**, klik **New issue**, lalu pilih *Laporan bug*. Formulirnya meminta:
- versi aplikasi (lihat nama berkas installer atau halaman Releases) dan versi Windows,
- apa yang terjadi dan langkah untuk mengulangnya,
- teks dari **Diagnostik TikTok / YouTube** (Pengaturan, **Buat laporan**) untuk masalah angka atau komentar,
- isi `startup.log` dan `error.log` jika aplikasi tidak mau terbuka.

Jangan menempel API key atau data pribadi di laporan.

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

Tag dengan akhiran (mis. `v1.0.0-beta.1`, dengan `version` yang sama di `package.json`) otomatis ditandai **Pre-release**
sehingga tidak tampil sebagai rilis stabil. Jika tag tidak sama dengan versi di `package.json`, build dihentikan. Menjalankan workflow secara manual (*Run workflow*)
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
