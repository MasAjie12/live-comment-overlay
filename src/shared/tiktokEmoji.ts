/**
 * Emoji bawaan TikTok dikirim sebagai kode teks dalam kurung siku, mis. "[laughcry]". Gambarnya hanya ada di
 * aplikasi TikTok sendiri, jadi di sini kode diganti emoji Unicode yang paling mendekati artinya
 * (tampilannya tidak sama persis dengan emoji TikTok).
 *
 * Kode yang belum ada di daftar ini dibiarkan apa adanya dan dicatat di Pengaturan, Diagnostik koneksi TikTok
 * ("Kode emoji belum dikenal"). Untuk menambah, cukup tambahkan satu baris: nama kode huruf kecil -> emoji.
 */
export const TIKTOK_EMOJI: Record<string, string> = {
  smile: '🙂',
  happy: '😄',
  laugh: '😆',
  laughwithtears: '😂',
  laughcry: '😂',
  funnyface: '🤪',
  cute: '😊',
  angel: '😇',
  wicked: '😈',
  proud: '😏',
  pride: '😏',
  cool: '😎',
  complacent: '😎',
  yummy: '😋',
  drool: '🤤',
  flushed: '😳',
  embarrassed: '😅',
  surprised: '😮',
  shock: '😲',
  scream: '😱',
  speechless: '😶',
  sulk: '😒',
  wronged: '🥺',
  cry: '😢',
  weep: '😭',
  angry: '😠'
}

const CODE = /\[([A-Za-z][A-Za-z0-9_]{1,30})\]/g

export interface EmojiResult {
  text: string
  /** jumlah kode [xxx] yang ditemukan */
  codes: number
  /** jumlah kode yang berhasil diganti emoji */
  converted: number
  /** nama kode (huruf kecil) yang belum dikenal */
  unknown: string[]
}

export function convertTikTokEmoji(text: string): EmojiResult {
  let codes = 0
  let converted = 0
  const unknown: string[] = []
  const out = text.replace(CODE, (match, name: string) => {
    codes++
    const emoji = TIKTOK_EMOJI[name.toLowerCase()]
    if (emoji) {
      converted++
      return emoji
    }
    unknown.push(name.toLowerCase())
    return match
  })
  return { text: out, codes, converted, unknown }
}
