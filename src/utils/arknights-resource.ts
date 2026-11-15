/**
 * 明日方舟静态资源地址工具类（头像 / 立绘 / 技能图标 / 模组图标）
 *
 * 资源统一托管在 COS，不再走精灵图：调用方直接用 `<img :src="...">` 直连，
 * 尺寸通过 `getOperatorAvatarStyle` 生成的 CSS 变量传入，样式由全局
 * `src/assets/css/operator-avatar.css` 提供。
 *
 * 文件命名规则与 frontend-v2-plus 的 `src/utils/arknightsResource.js` 保持一致，
 * 便于两边资源地址同步调整。
 */

/** 干员头像目录：{charId}.png */
export const OPERATOR_AVATAR_BASE_URL = 'https://cos.yituliu.cn/arknights/resources/avatar/'

/** 干员立绘目录（默认立绘与各套时装共用命名规则） */
export const OPERATOR_PORTRAIT_BASE_URL = 'https://cos.yituliu.cn/arknights/resources/portrait/'

/** 技能图标目录：skill_icon_{iconId}.png */
export const OPERATOR_SKILL_ICON_BASE_URL = 'https://cos.yituliu.cn/arknights/resources/skills/'

/** 模组图标目录：{equipIcon}.png */
export const OPERATOR_EQUIP_ICON_BASE_URL = 'https://cos.yituliu.cn/arknights/equip-icon/'

/**
 * 干员头像地址
 * @param charId 干员编码，如 char_002_amiya
 * @returns 图片地址；charId 为空返回空串
 */
export function getOperatorAvatarUrl(charId: string): string {
  if (!charId) return ''
  return `${OPERATOR_AVATAR_BASE_URL}${charId}.png`
}

/**
 * 皮肤资源文件名规则：`@` 换成 `_`，`#` 转义成 `%23`
 * （不转义的话浏览器会把 `#` 之后当成锚点丢掉，请求直接 404）
 * @param skinId 皮肤编码，如 char_124_kroos@witch#1
 * @returns 不含扩展名的文件名；skinId 为空返回空串
 */
function skinFileStem(skinId: string): string {
  const id = String(skinId || '').trim()
  if (!id) return ''
  return id.replace(/@/g, '_').replace(/#/g, '%23')
}

/**
 * 干员立绘（时装）地址：默认立绘本身也是皮肤，形如 char_190_clour#2 → char_190_clour_2.png
 * @param skinId 皮肤编码
 * @returns 图片地址；skinId 为空返回空串
 */
export function getSkinPortraitUrl(skinId: string): string {
  const stem = skinFileStem(skinId)
  return stem ? `${OPERATOR_PORTRAIT_BASE_URL}${stem}.png` : ''
}

/**
 * 皮肤头像地址：与立绘同源同命名，只是目录换成 avatar，拿到的是该套时装的方形头像
 * @param skinId 皮肤编码
 * @returns 图片地址；skinId 为空返回空串
 */
export function getSkinAvatarUrl(skinId: string): string {
  const stem = skinFileStem(skinId)
  return stem ? `${OPERATOR_AVATAR_BASE_URL}${stem}.png` : ''
}

/**
 * 技能图标 id 还原：数据里用 x5b / x5d 转义方括号，资源文件名用原始方括号
 * @param iconId 技能图标 id，如 skcom_charge_costx5b1x5d
 * @returns 还原后的 id
 */
function normalizeSkillIconId(iconId: string): string {
  return iconId.replace(/x5b/g, '[').replace(/x5d/g, ']')
}

/**
 * 技能图标地址
 * @param iconId 技能图标 id，如 skchr_absin_1
 * @returns 图片地址；iconId 为空返回空串
 */
export function getSkillIconUrl(iconId: string): string {
  if (!iconId) return ''
  return `${OPERATOR_SKILL_ICON_BASE_URL}skill_icon_${normalizeSkillIconId(iconId)}.png`
}

/**
 * 模组图标地址
 * @param icon 模组图标 id，如 uniequip_002_amiya
 * @returns 图片地址；icon 为空返回空串
 */
export function getEquipIconUrl(icon: string): string {
  if (!icon) return ''
  return `${OPERATOR_EQUIP_ICON_BASE_URL}${icon}.png`
}

/** 头像描边渐变色（按星级，1~6 星、6 星最高） */
const OPERATOR_RARITY_BORDER_COLORS: Record<number, string> = {
  6: 'linear-gradient(135deg, #ff8a3d, #ffd24a)',
  5: 'linear-gradient(135deg, #ffffff, #f2c75c)',
  4: 'linear-gradient(135deg, #ffffff, #d8c6ff)',
  3: 'linear-gradient(135deg, #ffffff, #7fb7ff)',
  2: 'linear-gradient(135deg, #ffffff, #7fd88f)',
  1: 'linear-gradient(135deg, #ffffff, #c5c9d3)',
}

/** 星级缺失或越界时的描边底色（按 6 星处理） */
const DEFAULT_RARITY_BORDER_COLOR = 'linear-gradient(135deg, #ff8a3d, #ffd24a)'

/** getOperatorAvatarStyle 入参 */
export interface OperatorAvatarStyleOptions {
  /** 桌面尺寸（px） */
  size?: number
  /** 手机尺寸（px，600px 以下生效），缺省沿用 size */
  mobileSize?: number
  /** 干员星级，用于描边渐变底色 */
  rarity?: number
  /** 是否绘制稀有度描边 */
  bordered?: boolean
}

/**
 * 生成干员头像 `<img>` 的内联样式：尺寸与描边渐变都通过 CSS 变量传给全局样式
 * @param options 尺寸 / 星级 / 是否描边
 * @returns 可直接绑到 :style 的对象
 */
export function getOperatorAvatarStyle({
  size,
  mobileSize,
  rarity,
  bordered = false,
}: OperatorAvatarStyleOptions = {}): Record<string, string> {
  const style: Record<string, string> = {}
  if (size) style['--avatar-size'] = `${size}px`
  const resolvedMobileSize = mobileSize || size
  if (resolvedMobileSize) style['--avatar-mobile-size'] = `${resolvedMobileSize}px`
  if (bordered) {
    const normalizedRarity = Math.min(6, Math.max(1, Math.floor(Number(rarity) || 6)))
    style['--avatar-border-gradient'] =
      OPERATOR_RARITY_BORDER_COLORS[normalizedRarity] ?? DEFAULT_RARITY_BORDER_COLOR
  }
  return style
}
