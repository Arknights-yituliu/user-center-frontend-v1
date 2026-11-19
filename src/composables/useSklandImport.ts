import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { getTclToken } from '../api/user-center/request'
import { toSklandImportError, type SklandCredential } from '../api/skland-core'
import { importAkData } from '../api/skland-ak-adapter'
import { importEfData } from '../api/skland-ef-adapter'
import type {
  AkTarget,
  EfTarget,
  GameScope,
  ImportOutcome,
  SklandImportError,
  SklandTarget,
} from '../types/skland-import'

function isImportError(value: unknown): value is SklandImportError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'game' in value &&
    'stage' in value &&
    'message' in value
  )
}

/**
 * 导入执行：按勾选分发两条上传管线
 *
 * - 上传与账号查询一律使用正式会话（getTclToken），仅有 OAuth 临时会话时直接拒绝，不产生写入
 * - 两条管线并行、失败隔离；**不实现任何重试**，错误原样汇总给页面底部
 */
export function useSklandImport() {
  const scope = reactive<Record<GameScope, boolean>>({ arknights: true, endfield: true })
  const running = ref(false)
  const results = ref<ImportOutcome[]>([])
  /** 未登录等整体性阻塞原因，与具体游戏失败区分展示 */
  const sessionError = ref('')

  let disposed = false

  const errors = computed(() =>
    results.value.flatMap((outcome) => (outcome.error ? [outcome.error] : [])),
  )
  const succeeded = computed(() => results.value.filter((outcome) => outcome.ok))
  const failed = computed(() => results.value.filter((outcome) => !outcome.ok))
  const sessionInvalid = computed(() => errors.value.some((error) => isSessionExpired(error)))
  const credentialExpired = computed(() => errors.value.some((error) => isCredentialExpired(error)))

  function isSessionExpired(error: SklandImportError): boolean {
    return error.code === 80001 || error.code === 80002
  }

  function isCredentialExpired(error: SklandImportError): boolean {
    return error.code === 10000 || error.code === 10002
  }

  /** 勾选状态：未勾选的游戏不做拉取与上传 */
  function isInScope(game: GameScope): boolean {
    return scope[game] === true
  }

  /** 切换勾选；返回是否切换成功（至少需保留 1 个游戏） */
  function toggleScope(game: GameScope, value: boolean): void {
    scope[game] = value
  }

  function reset(): void {
    results.value = []
    sessionError.value = ''
  }

  /**
   * 执行导入
   * @param credential 本次会话的森空岛凭证（两个 adapter 复用同一份）
   * @param targets 已选中的目标（可能同时含两个游戏）
   */
  async function run(credential: SklandCredential, targets: SklandTarget[]): Promise<void> {
    if (running.value) return
    reset()

    // 页面与路由守卫只认正式会话；这里再兜一次，确保不会用 OAuth 临时 token 写入
    if (!getTclToken()) {
      sessionError.value = '请先登录酸橙云账号后再导入'
      return
    }

    const chosen = targets.filter((target) => isInScope(target.game))
    if (!chosen.length) return

    running.value = true
    try {
      const settled = await Promise.allSettled(
        chosen.map((target) =>
          target.game === 'arknights'
            ? importAkData(target as AkTarget, credential)
            : importEfData(target as EfTarget, credential),
        ),
      )
      if (disposed) return

      results.value = settled.map((result, index) => {
        const game = chosen[index]!.game
        if (result.status === 'fulfilled') return result.value
        const error = isImportError(result.reason)
          ? result.reason
          : toSklandImportError(result.reason, game, 'upload', '导入失败')
        return { game, ok: false, error }
      })
    } finally {
      if (!disposed) running.value = false
    }
  }

  onBeforeUnmount(() => {
    disposed = true
  })

  return {
    scope,
    running,
    results,
    errors,
    succeeded,
    failed,
    sessionError,
    sessionInvalid,
    credentialExpired,
    isInScope,
    toggleScope,
    reset,
    run,
  }
}
