import type { EndfieldCardDetail } from '../skland-endfield-api'
import { getTclToken, tclRequest } from './request'

export interface EfAccount {
  roleId: string
  serverId: string
  createTime: string | null
  updateTime: string
}

export interface EfPlayerData {
  roleId: string
  serverId: string
  playerData: EndfieldCardDetail
  updateTime: string
}

// 明确使用正式会话，与 OAuth 授权流程的临时会话隔离。
export async function listEfAccounts(): Promise<EfAccount[]> {
  const response = await tclRequest<EfAccount[]>({
    url: '/user/ef-accounts',
    token: getTclToken(),
  })
  return response.data ?? []
}

export async function getEfPlayerData(
  roleId: string,
  serverId: string,
): Promise<EfPlayerData | null> {
  const query = new URLSearchParams({ roleId, serverId })
  const response = await tclRequest<EfPlayerData | null>({
    url: `/user/ef-accounts/player-data?${query}`,
    token: getTclToken(),
  })
  return response.data ?? null
}

/** 首次导入自动建立绑定，再次导入整份更新玩家数据。 */
export async function saveEfPlayerData(data: {
  roleId: string
  serverId: string
  playerData: EndfieldCardDetail
}): Promise<Omit<EfPlayerData, 'playerData'>> {
  const response = await tclRequest<Omit<EfPlayerData, 'playerData'>>({
    method: 'POST',
    url: '/user/ef-accounts/player-data/save',
    data,
    token: getTclToken(),
  })
  return response.data
}
