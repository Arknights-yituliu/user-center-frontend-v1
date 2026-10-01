import { ucRequest, type UcResponse } from './request'

/**
 * 用户游戏数据管理接口（/user/ak-accounts）
 *
 * 面向已登录用户本人，查看与维护自己名下的游戏账号与干员数据；
 * 用户身份取自会话，不能通过请求参数指定或覆盖。
 * 与 OAuth 版（/oauth2/ak-accounts）业务逻辑一致，但无需 scope，登录即可调用。
 */

/** 已绑定的游戏账号（GET /user/ak-accounts） */
export interface AkAccountVO {
  /** 游戏账号 UID */
  akUid: string
  /** 绑定关系创建时间（首次导入该账号数据时） */
  createTime: string
  /** 该账号干员数据最近一次导入时间 */
  updateTime: string
}

/** 干员记录（读取返回，数值字段恒为数字不返回 null） */
export interface AkOperatorVO {
  /** 稳定干员编码，业务关联请使用该字段 */
  id: string
  /** 数据库自增行 ID，仅供排查 */
  recordId: number
  /** 干员星级，0 表示未提供 */
  rarity: number
  /** 干员等级 */
  level: number
  /** 精英化阶段 */
  evolvePhase: number
  /** 基础技能等级 */
  mainSkillLevel: number
  /** 技能 1 等级或状态 */
  skill1: number
  /** 技能 2 等级或状态 */
  skill2: number
  /** 技能 3 等级或状态 */
  skill3: number
  /** 模组 X 数值 */
  equipX: number
  /** 模组 Y 数值 */
  equipY: number
  /** 模组 D 数值 */
  equipD: number
  /** 模组 A 数值 */
  equipA: number
  /** 模组 B 数值 */
  equipB: number
  /** 潜能等级（不是星级） */
  potentialRank: number
}

/** 某游戏账号的干员数据（GET /user/ak-accounts/operators） */
export interface AkOperatorListVO {
  /** 游戏账号 UID */
  akUid: string
  /** 干员记录列表，无数据时为空数组 */
  items: AkOperatorVO[]
}

/**
 * 上传的干员记录（POST /user/ak-accounts/operators/save）
 * 数值字段可省略、传 null 或空字符串，服务端统一按 0 落库（不表示沿用旧值）
 */
export interface AkOperatorSaveItem {
  /** 稳定干员编码，1-64 位可见 ASCII 字符；同一请求内不可重复 */
  id: string
  /** 干员星级，0~6 */
  rarity?: number | null | ''
  /** 干员等级，0~65535 */
  level?: number | null | ''
  /** 精英化阶段，0~255 */
  evolvePhase?: number | null | ''
  /** 基础技能等级，0~255 */
  mainSkillLevel?: number | null | ''
  /** 技能 1 等级或状态，0~255 */
  skill1?: number | null | ''
  /** 技能 2 等级或状态，0~255 */
  skill2?: number | null | ''
  /** 技能 3 等级或状态，0~255 */
  skill3?: number | null | ''
  /** 模组 X 数值，0~255 */
  equipX?: number | null | ''
  /** 模组 Y 数值，0~255 */
  equipY?: number | null | ''
  /** 模组 D 数值，0~255 */
  equipD?: number | null | ''
  /** 模组 A 数值，0~255 */
  equipA?: number | null | ''
  /** 模组 B 数值，0~255 */
  equipB?: number | null | ''
  /** 潜能等级，0~255 */
  potentialRank?: number | null | ''
}

/** 保存请求体（POST /user/ak-accounts/operators/save） */
export interface AkOperatorSaveParams {
  playerInfo: {
    /** 目标游戏账号 UID，不超过 32 位可见 ASCII 字符；当前用户首次上传即建立绑定关系 */
    akUid: string
  }
  /** 干员数组，不能为空 */
  operators: AkOperatorSaveItem[]
}

/** 保存结果（POST /user/ak-accounts/operators/save） */
export interface AkOperatorSaveResultVO {
  /** 新增记录数 */
  createdCount: number
  /** 属性实际变化并更新的记录数 */
  updatedCount: number
  /** 与已存数据完全相同、未写库的记录数 */
  unchangedCount: number
}

/** 上传限流信息（保存接口返回 code=30006 时 data 的结构） */
export interface AkUploadLimitVO {
  /** 建议等待秒数 */
  retryAfterSeconds: number
}

/**
 * 查询当前用户已绑定的游戏账号列表（GET /user/ak-accounts，需登录）
 * 按最近一次导入时间倒序，前端取首条即可默认展示最新导入的账号
 * @returns 已绑定账号列表，无绑定时为空数组
 */
export function listAkAccounts(): Promise<UcResponse<AkAccountVO[]>> {
  return ucRequest<AkAccountVO[]>({ method: 'GET', url: '/user/ak-accounts' })
}

/**
 * 全量读取某游戏账号的干员数据（GET /user/ak-accounts/operators，需登录）
 * 读取前服务端会核对归属，星级筛选由调用方完成
 * @param akUid 游戏账号 UID（必须属于当前登录用户）
 * @returns 该账号的全部干员记录
 */
export function getAkOperators(akUid: string): Promise<UcResponse<AkOperatorListVO>> {
  return ucRequest<AkOperatorListVO>({
    method: 'GET',
    url: `/user/ak-accounts/operators?akUid=${encodeURIComponent(akUid)}`,
  })
}

/**
 * 保存角色信息与干员数据（POST /user/ak-accounts/operators/save，需登录）
 * - 已存在的干员按属性比较后更新，不存在则新增；请求中未出现的干员不会被删除
 * - 同一游戏账号 2 秒内只接受一次保存，命中限流返回 code=30006（等待秒数见 data.retryAfterSeconds）
 * - 保存冲突返回 code=40004，调用方重试整个请求即可
 * @param params 请求体（playerInfo.akUid + operators）
 * @returns 新增 / 更新 / 未变化 的记录数，三项之和等于本次传入的干员数
 */
export function saveAkOperators(
  params: AkOperatorSaveParams,
): Promise<UcResponse<AkOperatorSaveResultVO>> {
  return ucRequest<AkOperatorSaveResultVO>({
    method: 'POST',
    url: '/user/ak-accounts/operators/save',
    data: params,
  })
}
