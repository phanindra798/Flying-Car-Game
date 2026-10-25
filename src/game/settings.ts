export type GraphicsQuality = 'performance' | 'balanced' | 'quality';
export interface GraphicsSettings { quality: GraphicsQuality; reducedEffects: boolean; showFps: boolean }
export const SETTINGS_KEY = 'boostline.graphics.v1';
export const DEFAULT_SETTINGS: GraphicsSettings = { quality: 'balanced', reducedEffects: false, showFps: false };
export function parseSettings(raw: string | null): GraphicsSettings {
  try {
    const value = raw && raw.length < 1000 ? JSON.parse(raw) : null;
    return { quality: ['performance', 'balanced', 'quality'].includes(value?.quality) ? value.quality : 'balanced',
      reducedEffects: value?.reducedEffects === true, showFps: value?.showFps === true };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function graphicsProfile(settings: GraphicsSettings, touch: boolean, systemReduced: boolean, dpr: number) {
  const reduceMotion = settings.reducedEffects || systemReduced;
  const cap = settings.quality === 'performance' ? 1 : settings.quality === 'quality' ? (touch ? 1.75 : 2) : (touch ? 1.25 : 1.5);
  return { pixelRatio: Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, cap), reduceMotion,
    particleLimit: reduceMotion ? 0 : { performance: 24, balanced: 48, quality: 80 }[settings.quality] };
}
