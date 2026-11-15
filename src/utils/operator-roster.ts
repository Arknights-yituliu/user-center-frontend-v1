import type { AkOperatorSaveItem, AkOperatorVO } from '../api/user-center/ak-account-api'
import type { OperatorStaticData } from './operator-table'

export type RosterRow = AkOperatorVO & { owned: 0 | 1; manual: boolean; dirty: boolean }

/** 按当前来源构建完整图鉴，未出现在已招募列表中的干员补为 owned=0。 */
export function buildRosterRows(
  operators: AkOperatorVO[],
  staticData: OperatorStaticData,
  drafts: Record<string, RosterRow> = {},
  manual = false,
): RosterRow[] {
  const records = new Map(operators.map((item) => [item.id, item]))
  const ids = new Set([
    ...records.keys(),
    ...Object.keys(staticData.operators),
    ...Object.keys(drafts),
  ])
  return Array.from(ids, (id) => {
    const saved = records.get(id)
    const base: RosterRow = {
      id,
      recordId: 0,
      rarity: staticData.operators[id]?.rarity || 0,
      level: 0,
      evolvePhase: 0,
      potentialRank: 0,
      mainSkillLevel: 1,
      skill1: 0,
      skill2: 0,
      skill3: 0,
      equipX: 0,
      equipY: 0,
      equipD: 0,
      equipA: 0,
      equipB: 0,
      ...saved,
      owned: saved && (saved.owned === undefined || saved.owned === 1) ? 1 : 0,
      manual,
      dirty: false,
    }
    const draft = drafts[id]
    return draft ? { ...base, ...draft, dirty: true } : base
  })
}

/** 从全部分页中提取修改过的条目；取消招募也携带 owned=0 和完整练度字段。 */
export function buildManualUploadPayload(rows: RosterRow[]): AkOperatorSaveItem[] {
  return rows
    .filter((row) => row.dirty)
    .map((row) => ({
      id: row.id,
      owned: row.owned,
      rarity: row.rarity,
      level: row.level,
      evolvePhase: row.evolvePhase,
      mainSkillLevel: row.mainSkillLevel,
      skill1: row.skill1,
      skill2: row.skill2,
      skill3: row.skill3,
      equipX: row.equipX,
      equipY: row.equipY,
      equipD: row.equipD,
      equipA: row.equipA,
      equipB: row.equipB,
      potentialRank: row.potentialRank,
    }))
}
