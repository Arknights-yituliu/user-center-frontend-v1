/**
 * 森空岛导入页的统一类型
 *
 * 只放类型定义，不放运行时逻辑：适配层与 composable 都依赖这里，
 * 页面层只认这里的 DTO，避免把 `uid`（明日方舟）与 `roleId`（终末地）混用。
 */

/** 参与导入的游戏 */
export type GameScope = 'arknights' | 'endfield'

/** 导入失败阶段 */
export type ImportStage = 'credential' | 'binding' | 'fetch' | 'upload'

/** 结构化导入错误：汇总到页面底部，逐条展示 游戏 / 阶段 / 错误码 / 原始原因 */
export interface SklandImportError {
  game: GameScope
  stage: ImportStage
  code?: number | string
  message: string
}

/** 单个游戏的导入结果 */
export interface ImportOutcome {
  game: GameScope
  ok: boolean
  /** 成功摘要，如「已上传 312 名干员（新增 5、更新 307）」 */
  summary?: string
  error?: SklandImportError
}

/** 明日方舟导入目标（扁平 uid） */
export interface AkTarget {
  game: 'arknights'
  /** 列表内唯一键 */
  key: string
  /** 游戏账号 uid，也是上传时的 playerInfo.akUid */
  akUid: string
  /** 森空岛绑定项 nickName，缺失时为空串 */
  nickname: string
  /** 森空岛绑定项 channelName（官服 / B 服），缺失时为空串 */
  serverName: string
  /** 森空岛绑定项 channelMasterId，数值转字符串，缺失时为空串 */
  channelMasterId: string
  /** 森空岛标记的默认账号（官服） */
  isDefault: boolean
}

/** 终末地导入目标（roleId + serverId + userId 三元组） */
export interface EfTarget {
  game: 'endfield'
  /** 列表内唯一键 */
  key: string
  roleId: string
  serverId: string
  /** 绑定项 uid；卡片请求优先获取账号级 userId，此值仅作回退，可能为空 */
  userId?: string
  /** 以下为森空岛角色原始展示信息，缺失时为空串，上传时不使用界面兜底文案 */
  nickname: string
  serverType: string
  serverName: string
  isDefault: boolean
}

/** 任一游戏的导入目标 */
export type SklandTarget = AkTarget | EfTarget

/** 账号唯一键 */
export function targetKey(game: GameScope, identity: string[]): string {
  return [game, ...identity].join(':')
}

/** 确认条展示用的 UID 文案：明日方舟是 uid，终末地是 roleId */
export function targetUidText(target: SklandTarget): string {
  return target.game === 'arknights' ? target.akUid : target.roleId
}

/** 游戏展示名 */
export function gameLabel(game: GameScope): string {
  return game === 'arknights' ? '明日方舟' : '终末地'
}

/** 失败阶段展示名 */
export function stageLabel(stage: ImportStage): string {
  const labels: Record<ImportStage, string> = {
    credential: '凭证',
    binding: '绑定账号',
    fetch: '数据拉取',
    upload: '数据上传',
  }
  return labels[stage]
}
