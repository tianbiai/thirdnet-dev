/**
 * theme.ts —— 主题 token 加载与派生（v2.1 范式文件，拷贝到 src/utils/theme.ts）。
 *
 * 颜色单一事实来源 = 主题 token JSON（技能 assets/themes/<style>.tokens.json，
 * 生成器拷贝到目标项目 src/scene/themes/）。本文件做三件事：
 *   1. applyTheme(style) → ThemeTokens：ParkScene 3D 侧消费（构造材质/灯光/背景）。
 *   2. applyCssVars(tokens) → 把 token（或 spec.tokens 覆盖）展平注入 :root CSS 变量
 *      （--twin-*），规则与 scripts/generate_theme.py 逐条对齐——静态 tokens.css 管
 *      基础主题，本函数管 per-park 运行时覆盖。
 *   3. hexOf / glowColor：JS 侧读 CSS 变量的辅助（如图表内联样式）。
 *
 * ⚠️ 需要 tsconfig 开 "resolveJsonModule": true（Vite 原生支持 JSON import）。
 */
import cyberTokens from '@/scene/themes/cyber.tokens.json'
import realisticTokens from '@/scene/themes/realistic.tokens.json'
import nightRealisticTokens from '@/scene/themes/night-realistic.tokens.json'

export type StyleKey = 'cyber' | 'realistic' | 'night-realistic'

/**
 * v2.28+ 单效果旋钮（启用与否 + 颜色 + 数值）。所有效果用「双重门」控制：
 *   `PROFILES[style].fx.<flag> === true && this.tokens.effects.<key>.enabled === true`，
 * `applyCssVars` 把 numbers 展平为 `--twin-effects-<key>-<field>`，颜色进同名变体 CSS 变量。
 * ParkScene 的 `buildFxLayer()` + `updateFx()` 双重门联动。
 */
export interface EffectTokens {
  enabled?: boolean
  /** 任意十六进制色字符串，多数效果用 color 字段；CSS 端取 `var(--twin-effects-<key>-color)`。 */
  color?: string
  /** 兜底数值字段（rate/count/intensity/scale/opacity/...），按 effect 含义不同，由消费方各自读取。 */
  [field: string]: unknown
}

export interface EffectsTokens {
  scan?: EffectTokens
  dataFlow?: EffectTokens
  pillars?: EffectTokens
  particles?: EffectTokens
  lampCones?: EffectTokens
  godRays?: EffectTokens
  stars?: EffectTokens
  water?: EffectTokens
  fog?: EffectTokens
  scanlines?: EffectTokens
  gridPulse?: EffectTokens
}

/** ThemeTokens：与 assets/tokens.schema.json 同形（注释键/null 允许存在，消费方自己判空）。 */
export interface ThemeTokens {
  scene: { bgTop: string; bgBottom: string; sky?: { clouds: boolean; stars: boolean; moon: boolean } }
  palette: Record<string, string>
  accents: Record<string, string>
  category: Record<string, string>
  building: {
    roomShade: number
    dividerColor: string
    edgeColor?: string
  }
  lights: Record<string, string | number | null>
  ground?: { texture?: { type: 'tiles' | 'grid' | 'dots'; base: string; line: string; cell: number } }
  shaders?: { grid?: { u_gridColor: string; u_cell: number; u_strength: number } | null }
  environment: Record<string, string | boolean>
  garageEntrance?: Record<string, string>
  surfaceParking?: Record<string, string>
  /** v2.6 地下场景配色（deck/wall/edge/room/spot/ramp + deckOpacity/wallOpacity）。 */
  underground?: Record<string, unknown>
  poi: Record<string, unknown>
  /** v2.28+ 动效层旋钮（每风格 token 配 effects 段；缺省整段未配 → 全部 disabled）。 */
  effects?: EffectsTokens
  realism: {
    material: { roughness: number; metalness: number; envMapIntensity: number; clearcoat?: number; clearcoatRoughness?: number }
    bloom: { threshold: number; strength: number; radius: number }
    ao: { enabled: boolean; intensity: number; radius: number }
    reflection: { enabled: boolean; opacity: number; mixStrength: number }
    fog: { color: string; near: number; far: number } | null
    sun: { azimuth: number; elevation: number }
    shadow?: { radius?: number; bias?: number }
    /** v2.28+ 首屏电影入场：GlobalTwin 水合完成后调 `playIntro()` 推一次。 */
    intro?: {
      enabled?: boolean
      /** 入场时长（ms；推荐 1600-2200）。reduced-motion 下整段跳过。 */
      durationMs?: number
      /** 起手相机距离倍数（>1 = 拉远开场，=1.6 → 1.0 推近）。仅 perspective 风格生效。 */
      fromDistanceFactor?: number
      /** 起手俯角偏移（度，正值 = 更高俯视开场）。 */
      fromElevOffset?: number
      /** 楼栋 facade emissiveIntensity 顺序亮起间隔（ms）。0 = 一起亮。 */
      staggerMs?: number
    }
  }
  ui?: {
    panelOpacity: number; panelBlur: number; panelRadius: number
    glowStrength: number; glowColor: string; borderWidth: number
    labelBg: string; labelText: string; switcherStyle: 'neon' | 'flat'
    selectionBorder?: string; selectionFill?: string; selectionFillOpacity?: number
  }
  fonts?: { zh: string; latin: string }
}

const THEMES: Record<StyleKey, ThemeTokens> = {
  cyber: cyberTokens as unknown as ThemeTokens,
  realistic: realisticTokens as unknown as ThemeTokens,
  'night-realistic': nightRealisticTokens as unknown as ThemeTokens,
}

/**
 * 风格 → 中文标签（StyleSwitcher 等展示层消费）。与 StyleKey/THEMES 同源单一事实来源：
 * 新增风格只需在此加一行，避免各组件各抄一份 label map 漂移。
 */
export const STYLE_LABELS: Record<StyleKey, string> = {
  cyber: '赛博',
  realistic: '写实',
  'night-realistic': '夜景',
}

/** ParkScene 消费：按风格取主题 token（找不到风格回退 cyber）。 */
export function applyTheme(style: StyleKey): ThemeTokens {
  return THEMES[style] ?? THEMES.cyber
}

// ---------------------------------------------------------------------------
// CSS 变量注入（与 scripts/generate_theme.py 同一套展平规则，勿改）
// ---------------------------------------------------------------------------

const PX_KEYS = new Set(['panelBlur', 'panelRadius', 'borderWidth'])

function kebab(key: string): string {
  return key.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase()
}

function flattenInto(node: unknown, path: string[], out: Array<[string, string]>) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k.startsWith('_') || v == null || typeof v === 'boolean') continue
    const p = [...path, k]
    if (typeof v === 'object') {
      flattenInto(v, p, out)
    } else if (typeof v === 'number') {
      const name = '--twin-' + p.map(kebab).join('-')
      out.push([name, PX_KEYS.has(k) && p[0] === 'ui' ? `${v}px` : String(v)])
    } else if (typeof v === 'string') {
      out.push(['--twin-' + p.map(kebab).join('-'), v])
    }
  }
}

/**
 * 把 token（完整主题或 spec.tokens 覆盖块）展平注入 :root CSS 变量。
 * 用法：静态基础主题走 tokens.css（generate_theme.py 生成）；per-park 覆盖
 * 在 GlobalTwin onMounted 里 applyCssVars(spec.tokens)。
 */
export function applyCssVars(tokens: Record<string, unknown>): void {
  const flat: Array<[string, string]> = []
  flattenInto(tokens, [], flat)
  const root = document.documentElement
  for (const [name, value] of flat) root.style.setProperty(name, value)
}

/** 读一个 CSS 变量（带兜底）；用于 JS 侧必须拿 hex 的场合。 */
export function hexOf(varName: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return v || fallback
}

/** 当前主题的发光色（--twin-ui-glow-color）。 */
export function glowColor(): string {
  return hexOf('--twin-ui-glow-color', '#1de9ff')
}
