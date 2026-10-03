export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  mood: string;
  duration: number;
  src: string;
  cover?: string;
}

export interface RadioChannel {
  id: string;
  title: string;
  kind: "纯音乐" | "人声";
  tracks: RadioTrack[];
}

export const defaultRadioCover = "/music/default-cover.svg";
export const radioCover = (track: RadioTrack) => track.cover || defaultRadioCover;
const assetTrack = (track: Omit<RadioTrack, "src" | "cover">): RadioTrack => ({ ...track, src: `/music/${track.id}/audio.mp3`, cover: `/music/${track.id}/cover.webp` });
const instrumental = (id: string, title: string, mood: string) => assetTrack({ id, title, mood, artist: "在野电台", duration: 180 });

// Public playback metadata only; source bundles and generation records stay in the library.
export const radioChannels: RadioChannel[] = [
  { id: "morning", title: "山野与晨光", kind: "纯音乐", tracks: [
    instrumental("wild-001", "山谷醒来", "毛毡钢琴 · 大提琴"),
    instrumental("wild-002", "雾走过松林", "吉他泛音 · 单簧管"),
    instrumental("wild-003", "溪流绕过石头", "竖琴 · 木琴"),
    instrumental("wild-004", "远山慢慢亮", "钢琴 · 弦乐"),
  ] },
  { id: "reading", title: "阅读与留白", kind: "纯音乐", tracks: [
    instrumental("wild-005", "树影之间", "指弹吉他 · 电钢琴"),
    instrumental("wild-006", "窗边一页", "独奏毛毡钢琴"),
    instrumental("wild-007", "雨停在檐下", "电钢琴 · 刷子鼓"),
    instrumental("wild-008", "午后的空白", "颤音琴 · 原声贝斯"),
  ] },
  { id: "focus", title: "专注与创造", kind: "纯音乐", tracks: [
    instrumental("wild-009", "把想法种下", "电钢琴 · 合成器"),
    instrumental("wild-010", "代码之外", "电钢琴 · 拨弦吉他"),
    instrumental("wild-011", "微光在生长", "卡林巴 · 合成器"),
    instrumental("wild-012", "一个人的工作室", "电钢琴 · 木吉他"),
  ] },
  { id: "travel", title: "旅行与自由", kind: "纯音乐", tracks: [
    instrumental("wild-015", "没有时刻表", "古典吉他 · 钢琴"),
    instrumental("wild-013", "风从旷野来", "指弹吉他 · 曼陀林"),
    instrumental("wild-014", "沿着河往前", "手碟 · 尼龙吉他"),
    instrumental("wild-016", "把时间还给自己", "合成器 · 毛毡钢琴"),
  ] },
  { id: "night", title: "夜色与休息", kind: "纯音乐", tracks: [
    instrumental("wild-017", "山下有一盏灯", "弱奏钢琴 · 大提琴"),
    instrumental("wild-018", "月光落在营地", "吉他泛音 · 颤音琴"),
    instrumental("wild-019", "夜航不必赶路", "合成器 · 低音钢琴"),
    instrumental("wild-020", "晚安，旷野", "钢琴 · 弦乐泛音"),
  ] },
  { id: "vocals", title: "人声精选", kind: "人声", tracks: [
    { id: "fireside", title: "火塘不眠", artist: "AI Music", mood: "民族器乐 · 无词人声", duration: 205 },
    { id: "before-love", title: "愛してるより先に", artist: "MCLI feat. AOI", mood: "日语 · 钢琴抒情", duration: 245 },
    { id: "the-light-i-left-on", title: "The Light I Left On", artist: "Mira Vale", mood: "英语 · 灵魂流行", duration: 225 },
    { id: "one-stop-late", title: "한 정거장 늦게", artist: "NEON VEIL", mood: "韩语 · 舞曲抒情", duration: 215 },
    { id: "red-light-halo", title: "Red Light Halo", artist: "NOVA VANE", mood: "英语 · 暗色流行", duration: 190 },
  ].map(assetTrack) },
];

export const defaultRadioChannel = radioChannels.find(channel => channel.id === "travel")!;
export const radioTracks = radioChannels.flatMap(channel => channel.tracks);
