// Bump the key when route, projection or rendering changes invalidate saved frames.
export const LANDSCAPE_SESSION_KEY = 'magic-landscape-v1';
export type LandscapeState = {
  distance: number; elapsed: number; journey: number;
  lookX: number; lookY: number; paused: boolean; exploring: boolean;
  detail: number; rock: number;
};
export type LandscapeResume = { state: LandscapeState; image: string; aspect: number; mobile: boolean; savedAt: number };
declare global { interface Window { __landscapeResume?: LandscapeResume; } }
