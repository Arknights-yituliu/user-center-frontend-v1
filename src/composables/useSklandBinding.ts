import { computed, onBeforeUnmount, ref } from 'vue'
import { describeSklandError, fetchPlayerBinding, type SklandCredential } from '../api/skland-core'
import { parseAkTargets } from '../api/skland-ak-adapter'
import { parseEfTargets } from '../api/skland-ef-adapter'
import type { AkTarget, EfTarget, GameScope, SklandImportError } from '../types/skland-import'

/**
 * 账号预选：只有 1 个候选，或唯一一个带默认标记时才自动选中；
 * 无默认 / 多个默认一律不选，绝不 fallback 到列表首项（列表顺序由后端决定）。
 */
function pickDefault<T extends { key: string; isDefault: boolean }>(items: T[]): string {
  if (items.length === 1) return items[0]!.key
  const defaults = items.filter((item) => item.isDefault)
  return defaults.length === 1 ? defaults[0]!.key : ''
}

/**
 * 绑定列表：一次 player/binding 请求按 appCode 分流给两个游戏，并完成预选
 */
export function useSklandBinding() {
  const loading = ref(false)
  const akTargets = ref<AkTarget[]>([])
  const efTargets = ref<EfTarget[]>([])
  const selectedAkKey = ref('')
  const selectedEfKey = ref('')
  const error = ref<SklandImportError | null>(null)

  let disposed = false
  let version = 0

  const selectedAk = computed(
    () => akTargets.value.find((target) => target.key === selectedAkKey.value) ?? null,
  )
  const selectedEf = computed(
    () => efTargets.value.find((target) => target.key === selectedEfKey.value) ?? null,
  )

  /** 加载绑定列表：全流程只请求一次绑定接口，勾选不影响请求次数 */
  async function load(credential: SklandCredential): Promise<void> {
    const current = ++version
    loading.value = true
    error.value = null
    akTargets.value = []
    efTargets.value = []
    selectedAkKey.value = ''
    selectedEfKey.value = ''

    try {
      const payload = await fetchPlayerBinding(credential)
      if (disposed || current !== version) return

      akTargets.value = parseAkTargets(payload)
      efTargets.value = parseEfTargets(payload)
      selectedAkKey.value = pickDefault(akTargets.value)
      selectedEfKey.value = pickDefault(efTargets.value)
    } catch (cause) {
      if (disposed || current !== version) return
      const info = describeSklandError(cause, '森空岛绑定账号读取失败')
      error.value = {
        game: 'arknights',
        stage: 'binding',
        code: info.code,
        message: info.message,
      }
    } finally {
      if (!disposed && current === version) loading.value = false
    }
  }

  /** 清空绑定与选择 */
  function clear(): void {
    version += 1
    loading.value = false
    akTargets.value = []
    efTargets.value = []
    selectedAkKey.value = ''
    selectedEfKey.value = ''
    error.value = null
  }

  /** 选择账号；传空串表示取消选择 */
  function select(game: GameScope, key: string): void {
    if (game === 'arknights') selectedAkKey.value = key
    else selectedEfKey.value = key
  }

  /** 清空某游戏的选中（切换勾选时调用，避免隐藏目标被带进确认条或上传） */
  function resetSelection(game: GameScope): void {
    select(game, '')
  }

  /** 已选中的目标（只含真正选中的，不兜底） */
  function selectedTargets(): Array<AkTarget | EfTarget> {
    return [selectedAk.value, selectedEf.value].filter(
      (target): target is AkTarget | EfTarget => target !== null,
    )
  }

  onBeforeUnmount(() => {
    disposed = true
  })

  return {
    loading,
    akTargets,
    efTargets,
    selectedAkKey,
    selectedEfKey,
    selectedAk,
    selectedEf,
    error,
    load,
    clear,
    select,
    resetSelection,
    selectedTargets,
  }
}
