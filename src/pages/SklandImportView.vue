<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import CredentialPanel from '../components/skland-import/CredentialPanel.vue'
import BindingSelector from '../components/skland-import/BindingSelector.vue'
import ImportConfirmBar from '../components/skland-import/ImportConfirmBar.vue'
import ImportProgress from '../components/skland-import/ImportProgress.vue'
import ImportErrorFooter from '../components/skland-import/ImportErrorFooter.vue'
import { useSklandCredential } from '../composables/useSklandCredential'
import { useSklandBinding } from '../composables/useSklandBinding'
import { useSklandImport } from '../composables/useSklandImport'
import { getTclToken } from '../api/user-center/request'
import type { GameScope } from '../types/skland-import'
import '../assets/css/skland-import.scss'

/**
 * 森空岛数据同步内容（/gamedata-import?tab=skland）
 *
 * 一次凭证 → 一次绑定列表 → 勾选游戏与账号 → 确认 → 分别拉取上传。
 * 只做导入：不含手动编辑与草稿上传，失败不重试，错误只汇总到页面底部。
 */

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
})

const GAMES: GameScope[] = ['arknights', 'endfield']

const loggedIn = ref(Boolean(getTclToken()))
const step = ref<1 | 2 | 3 | 4>(1)
const scopeWarning = ref('')

/* ---------- 绑定与选择 ---------- */

const bindingState = useSklandBinding()
const {
  loading: bindingLoading,
  akTargets,
  efTargets,
  selectedAkKey,
  selectedEfKey,
  selectedAk,
  selectedEf,
  error: bindingError,
  load: loadBinding,
  clear: clearBinding,
  select: selectTarget,
  resetSelection,
  selectedTargets,
} = bindingState

/* ---------- 执行导入 ---------- */

const importerState = useSklandImport()
const {
  scope,
  running,
  results,
  errors,
  sessionError,
  isInScope,
  toggleScope,
  reset: resetImport,
} = importerState

/* ---------- 凭证 ---------- */

const credentialState = useSklandCredential({
  onReady: (value) => {
    step.value = 2
    scopeWarning.value = ''
    void loadBinding(value)
  },
  onExpired: () => {
    clearBinding()
    resetImport()
    step.value = 1
  },
})
const {
  credential,
  method,
  credentialInput,
  officialInput,
  loading: credentialLoading,
  error: credentialError,
  qrImage,
  qrStatus,
  setMethod,
  submitPair,
  submitOfficial,
  reset: resetCredential,
} = credentialState

/* ---------- 步骤推导 ---------- */

const inScopeGames = computed(() => GAMES.filter((game) => scope[game]))
const missingSelection = computed(() =>
  inScopeGames.value.filter((game) =>
    game === 'arknights' ? !selectedAk.value : !selectedEf.value,
  ),
)
const confirmTargets = computed(() => selectedTargets().filter((target) => isInScope(target.game)))
const canConfirm = computed(
  () =>
    !bindingLoading.value &&
    inScopeGames.value.length > 0 &&
    missingSelection.value.length === 0 &&
    confirmTargets.value.length > 0,
)

const credentialErrorMessage = computed(() => {
  if (credentialError.value) return credentialError.value.message
  return ''
})

const bindingErrorMessage = computed(() => bindingError.value?.message ?? '')

/**
 * 读取完成后，某游戏没有任何绑定角色时自动取消勾选，
 * 避免用户对着空栏点「下一步」。
 */
watch([() => bindingLoading.value, akTargets, efTargets], () => {
  if (bindingLoading.value || !credential.value) return
  if (!akTargets.value.length && scope.arknights) {
    toggleScope('arknights', false)
    resetSelection('arknights')
  }
  if (!efTargets.value.length && scope.endfield) {
    toggleScope('endfield', false)
    resetSelection('endfield')
  }
})

/** 切换游戏勾选：至少保留 1 个，未勾选时清空该栏选中 */
function onToggleScope(game: GameScope, value: boolean): void {
  const nextInScope = GAMES.filter((item) => (item === game ? value : scope[item]))
  if (!nextInScope.length) {
    scopeWarning.value = '至少需要勾选一个游戏，否则没有可导入的数据。'
    return
  }
  scopeWarning.value = ''
  toggleScope(game, value)
  if (!value) resetSelection(game)
}

function goToConfirm(): void {
  if (!canConfirm.value) {
    scopeWarning.value = missingSelection.value.length
      ? '请为已勾选的游戏各选择一个账号。'
      : '请至少勾选一个游戏并选择账号。'
    return
  }
  scopeWarning.value = ''
  step.value = 3
}

async function confirmImport(): Promise<void> {
  if (!canConfirm.value || !credential.value) return
  step.value = 4
  await importerState.run(credential.value, confirmTargets.value)
}

/** 重新开始时整套状态回到步骤 1（凭证不落盘，直接丢弃） */
function restart(): void {
  resetCredential()
  clearBinding()
  resetImport()
  scopeWarning.value = ''
  step.value = 1
}

const steps = [
  { index: 1, label: '获取凭证' },
  { index: 2, label: '选择账号' },
  { index: 3, label: '确认写入' },
  { index: 4, label: '执行结果' },
]
</script>

<template>
  <div class="si-page" :class="{ 'si-page-embedded': props.embedded }">
    <SecondaryPageHeader
      v-if="!props.embedded"
      title-id="skland-import-title"
      kicker="SKLAND / DATA SYNC"
      title-a="森空岛数据同步"
      description="一次获取凭证，同时勾选明日方舟与终末地要导入的账号，分别拉取森空岛数据并写入酸橙云。"
      visual-top="ONE CREDENTIAL"
      visual-bottom="两个游戏，分别导入"
      visual-icon="mdi-cloud-sync-outline"
      visual-index="03"
    />

    <section v-if="!loggedIn" class="si-login">
      <h2>需要先登录酸橙云账号</h2>
      <p class="si-hint">
        导入会把数据写入你的酸橙云账号，因此必须使用正式登录会话。仅持有 OAuth 授权流程的临时会话时，也会按未登录处理。
      </p>
      <div class="si-actions">
        <v-btn
          variant="flat"
          color="primary"
          :to="{ name: 'LOGIN', query: { returnTo: '/gamedata-import?tab=skland' } }"
        >
          前往登录
        </v-btn>
      </div>
    </section>

    <template v-else>
      <ol class="si-steps">
        <li
          v-for="item in steps"
          :key="item.index"
          class="si-step"
          :class="{
            'si-step-active': step === item.index,
            'si-step-done': step > item.index,
          }"
        >
          <span class="si-step-index">{{ item.index }}</span>
          {{ item.label }}
        </li>
      </ol>

      <section v-if="step === 1" aria-labelledby="si-step-credential">
        <CredentialPanel
          :method="method"
          v-model:pair-input="credentialInput"
          v-model:official-input="officialInput"
          :loading="credentialLoading"
          :error-message="credentialErrorMessage"
          :qr-image="qrImage"
          :qr-status="qrStatus"
          @select-method="setMethod"
          @submit-pair="submitPair"
          @submit-official="submitOfficial"
        />
      </section>

      <section v-else-if="step === 2" aria-labelledby="si-step-binding">
        <div class="si-heading">
          <div>
            <p class="si-label">STEP 02 / TARGETS</p>
            <h2 id="si-step-binding" class="si-title">勾选要导入的游戏，并选定账号。</h2>
          </div>
          <v-btn variant="text" @click="restart">重新获取凭证</v-btn>
        </div>

        <BindingSelector
          :ak-targets="akTargets"
          :ef-targets="efTargets"
          :selected-ak-key="selectedAkKey"
          :selected-ef-key="selectedEfKey"
          :scope="scope"
          :loading="bindingLoading"
          :error-message="bindingErrorMessage"
          @select="selectTarget"
          @toggle-scope="onToggleScope"
        />

        <p v-if="scopeWarning" class="si-error" role="alert">{{ scopeWarning }}</p>

        <div class="si-actions">
          <v-btn variant="flat" color="primary" :disabled="!canConfirm" @click="goToConfirm">
            下一步：确认写入
          </v-btn>
          <span v-if="missingSelection.length" class="si-hint">
            已勾选的游戏各需要一个账号：{{ missingSelection.length }} 个待选择。
          </span>
        </div>
      </section>

      <section v-else-if="step === 3" aria-labelledby="si-step-confirm">
        <div class="si-heading">
          <div>
            <p class="si-label">STEP 03 / CONFIRM</p>
            <h2 id="si-step-confirm" class="si-title">确认要写入的账号。</h2>
          </div>
        </div>

        <ImportConfirmBar :targets="confirmTargets" />

        <div class="si-actions">
          <v-btn variant="flat" color="primary" :disabled="!canConfirm" @click="confirmImport">
            确认导入
          </v-btn>
          <v-btn variant="text" @click="step = 2">返回修改</v-btn>
        </div>
      </section>

      <section v-else aria-labelledby="si-step-result">
        <div class="si-heading">
          <div>
            <p class="si-label">STEP 04 / RESULT</p>
            <h2 id="si-step-result" class="si-title">导入结果。</h2>
          </div>
          <v-btn v-if="!running" variant="text" @click="restart">重新发起导入</v-btn>
        </div>

        <ImportProgress :running="running" :results="results" />
      </section>

      <ImportErrorFooter :errors="errors" :session-error="sessionError" />

      <footer class="si-hint">
        <RouterLink to="/gamedata/arknights">游戏数据·明日方舟</RouterLink>
        ·
        <RouterLink to="/gamedata/endfield">游戏数据·终末地</RouterLink>
      </footer>
    </template>
  </div>
</template>
