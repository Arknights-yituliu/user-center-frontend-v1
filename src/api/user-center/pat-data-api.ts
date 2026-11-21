import axios, { type AxiosResponse } from 'axios'
import { TCL_BASE_URL } from '../BASE_URL'
import type { AkOperatorListVO } from './ak-account-api'
import type { EfPlayerData } from './ef-account-api'
import type { TclResponse } from './request'

/** PAT 消费面，角色与服务器由令牌决定，不接受查询参数。 */
export const PAT_READ_PATHS = {
  arknights: '/pat/ak-accounts/operators',
  endfield: '/pat/ef-accounts/player-data',
} as const

export type PatGame = keyof typeof PAT_READ_PATHS

interface PatReadData {
  arknights: AkOperatorListVO
  endfield: EfPlayerData | null
}

/** 仅读取显式传入的 PAT，保留失败响应供测试页展示，不读取站内会话或携带 Cookie。 */
export function readPatGameData<G extends PatGame>(
  game: G,
  token: string,
  signal?: AbortSignal,
): Promise<AxiosResponse<TclResponse<PatReadData[G]>>> {
  const pat = token
    .trim()
    .replace(/^Bearer(?:\s+|$)/i, '')
    .trim()
  if (!pat) return Promise.reject(new Error('请填写 PAT'))
  return axios.get<TclResponse<PatReadData[G]>>(`${TCL_BASE_URL}${PAT_READ_PATHS[game]}`, {
    headers: { Authorization: `Bearer ${pat}` },
    withCredentials: false,
    timeout: 15000,
    signal,
    validateStatus: () => true,
  })
}
