export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  mood: string;
  duration: number;
  src: string;
  cover: string;
}

// Keep the public playlist separate from source bundles and private generation records.
export const radioTracks: RadioTrack[] = [
  { id: "fireside", title: "火塘不眠", artist: "AI Music", mood: "民族器乐 · 无词人声", duration: 205 },
  { id: "before-love", title: "愛してるより先に", artist: "MCLI feat. AOI", mood: "日语 · 钢琴抒情", duration: 245 },
  { id: "the-light-i-left-on", title: "The Light I Left On", artist: "Mira Vale", mood: "英语 · 灵魂流行", duration: 225 },
  { id: "one-stop-late", title: "한 정거장 늦게", artist: "NEON VEIL", mood: "韩语 · 舞曲抒情", duration: 215 },
  { id: "red-light-halo", title: "Red Light Halo", artist: "NOVA VANE", mood: "英语 · 暗色流行", duration: 190 },
].map((track) => ({ ...track, src: `/music/${track.id}/audio.mp3`, cover: `/music/${track.id}/cover.webp` }));
