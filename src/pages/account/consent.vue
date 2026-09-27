<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createMessage } from '../../utils/message'
import { clearUcTmpToken, confirmConsent, getConsentInfo, type ConsentInfoVO } from '../../api/uc/uc-api'

const router = useRouter()

/** 授权确认单 ID（authorize 302 携带） */
const pendingId = ref('')
/** 确认信息（客户端名称/权限列表等） */
const consentInfo = ref<ConsentInfoVO | null>(null)
/** 页面加载中状态 */
const loading = ref(true)
/** 提交中状态（防止重复点击） */
const submitting = ref(false)
/** 错误信息（确认单无效/已过期等） */
const errorMsg = ref('')

/** 用户当前勾选的权限标识集合：提交时按此集合回传，用于追加与取消 */
const selectedScopes = ref<Set<string>>(new Set())

/** 可勾选全集：该应用登记的全部权限 */
const selectableScopes = computed(() => consentInfo.value?.selectableScopes ?? [])

/** 已授权的权限标识集合：用于列表上标记「已授权」 */
const grantedCodes = computed(
  () => new Set((consentInfo.value?.grantedScopes ?? []).map((item) => item.code)),
)

/** 是否只剩一项已勾选：仅剩一项时禁止取消，避免提交空集合 */
const onlyOneSelected = computed(() => selectedScopes.value.size <= 1)

/**
 * 判断某权限当前是否被勾选
 * @param code 权限标识
 */
function isSelected(code: string): boolean {
  return selectedScopes.value.has(code)
}

/**
 * 切换某权限的勾选状态；仅剩一项时禁止取消（后端要求权限不可为空）
 * @param code 权限标识
 */
function toggleScope(code: string): void {
  const next = new Set(selectedScopes.value)
  if (next.has(code)) {
    if (next.size <= 1) {
      createMessage({
        text: '至少保留一项权限；如需全部取消，请改用「撤销对应用的授权」',
        type: 'warning',
      })
      return
    }
    next.delete(code)
  } else {
    next.add(code)
  }
  selectedScopes.value = next
}

/**
 * 当前确认页完整地址：未登录跳登录页时作为 redirect 参数，
 * 登录成功后登录页会回跳此地址继续确认
 */
function consentPageUrl(): string {
  return window.location.origin + window.location.pathname + '?pending_id=' + encodeURIComponent(pendingId.value)
}

/**
 * 加载授权确认信息：调 GET /oauth2/consent/info
 * 未登录（code=80001）时跳 OAuth 安全登录页，登录成功后回跳本页自动重新加载
 */
async function loadConsentInfo(): Promise<void> {
  loading.value = true
  try {
    const resp = await getConsentInfo(pendingId.value)
    consentInfo.value = resp.data
    // 初始化勾选：已有自定义授权则回显已授权权限，否则默认勾选本次申请范围
    const granted = resp.data.grantedScopes ?? []
    const base = granted.length > 0 ? granted : (resp.data.scopes ?? [])
    selectedScopes.value = new Set(base.map((item) => item.code))
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : undefined
    if (code === 80001) {
      // 未登录：跳 OAuth 安全登录页（不读取本地 token、不持久化），授权成功后回跳本页重新加载
      createMessage({ text: '请先登录后再确认授权', type: 'warning' })
      router.replace({ name: 'OAUTH_LOGIN', query: { redirect: consentPageUrl() } })
      return
    }
    errorMsg.value = (err && typeof err === 'object' && 'msg' in err ? (err as { msg?: string }).msg : '') || '授权确认单无效或已过期，请重新发起授权'
  } finally {
    loading.value = false
  }
}

/**
 * 提交确认结果：同意则签发授权码回跳第三方网站，拒绝则回跳 error=access_denied
 * @param approve 是否同意授权
 */
async function submit(approve: boolean): Promise<void> {
  if (submitting.value) return
  if (approve && selectedScopes.value.size === 0) {
    createMessage({ text: '请至少勾选一项权限', type: 'warning' })
    return
  }
  submitting.value = true
  try {
    // 按 selectableScopes 的顺序输出勾选结果，保证提交顺序稳定
    const scopes = approve
      ? selectableScopes.value.filter((s) => selectedScopes.value.has(s.code)).map((s) => s.code)
      : undefined
    const resp = await confirmConsent(pendingId.value, approve, scopes)
    const redirectUrl = resp.data
    if (redirectUrl) {
      // 授权流程结束（同意/拒绝均已回跳第三方）：清除 OAuth 授权流程的临时 token，避免残留
      clearUcTmpToken()
      // replace 跳转，避免确认单 ID 残留浏览器历史
      window.location.replace(redirectUrl)
      return
    }
    createMessage({ text: '未获取到回跳地址', type: 'error' })
  } catch {
    // 错误提示已在 ucRequest 内部统一弹出
  } finally {
    submitting.value = false
  }
}

/** 返回上一页（无历史时回登录页） */
function cancel(): void {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    router.replace({ name: 'LOGIN' })
  }
}

onMounted(() => {
  pendingId.value = new URLSearchParams(window.location.search).get('pending_id') || ''
  if (!pendingId.value) {
    errorMsg.value = '缺少授权确认单参数，请从第三方网站重新发起登录'
    loading.value = false
    return
  }
  loadConsentInfo()
})
</script>

<template>
  <div class="consent-page">
    <v-card class="consent-card m-a" max-width="480" width="100%">
      <!-- 标题区 -->
      <div class="consent-header">
        <p class="consent-kicker">SECURE CONNECTION</p>
        <div class="consent-title">授权确认</div>
        <div class="consent-sub" v-if="consentInfo">「{{ consentInfo.clientName }}」申请访问你的一图流账号</div>
      </div>

      <v-card-text>
        <!-- 加载中 -->
        <div v-if="loading" class="flex justify-center pa-8">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>

        <!-- 错误（确认单无效/已过期） -->
        <div v-else-if="errorMsg" class="text-center pa-4">
          <p class="mb-4">{{ errorMsg }}</p>
          <v-btn color="primary" variant="tonal" @click="cancel()">返回</v-btn>
        </div>

        <!-- 确认信息 -->
        <template v-else-if="consentInfo">
          <div class="m-4">
            <div class="m-0-4">第三方网站</div>
            <v-text-field
                :model-value="consentInfo.clientName"
                readonly
                variant="outlined"
                density="compact"
                hide-details="auto"
                class="m-4"
            ></v-text-field>

            <div class="m-0-4">授权后将允许该网站（可自行增减）</div>
            <v-list class="m-4 consent-list" density="compact" variant="outlined">
              <v-list-item
                  v-for="scope in selectableScopes"
                  :key="scope.code"
                  @click="toggleScope(scope.code)"
              >
                <template v-slot:prepend>
                  <v-checkbox-btn
                      :model-value="isSelected(scope.code)"
                      :disabled="isSelected(scope.code) && onlyOneSelected"
                      color="primary"
                      class="mr-1"
                      @click.stop="toggleScope(scope.code)"
                  ></v-checkbox-btn>
                </template>
                <v-list-item-title>
                  {{ scope.desc }}
                  <v-chip
                      v-if="grantedCodes.has(scope.code)"
                      size="x-small"
                      variant="tonal"
                      color="primary"
                      class="ml-2"
                  >已授权</v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>{{ scope.code }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <div class="m-0-4">授权后跳转</div>
            <v-text-field
                :model-value="consentInfo.redirectUri"
                readonly
                variant="outlined"
                density="compact"
                hide-details="auto"
                class="m-4"
            ></v-text-field>
          </div>

          <!-- 拒绝 / 同意 按钮（上下排列，同意授权为主操作） -->
          <div class="consent-actions">
            <v-btn
                variant="tonal"
                size="large"
                class="consent-btn"
                :disabled="submitting"
                @click="submit(false)"
            >拒绝</v-btn>
            <v-btn
                color="primary"
                variant="flat"
                size="large"
                class="consent-btn"
                :loading="submitting"
                :disabled="selectedScopes.size === 0"
                @click="submit(true)"
            >同意授权</v-btn>
          </div>

          <div class="consent-tip">
            同意后将跳转回第三方网站。如需彻底收回该应用的全部权限，请前往「我的授权应用」撤销授权。
          </div>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.consent-page {
  min-height: calc(100vh - 79px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 24px 80px;
}

.consent-card {
  border: 1px solid var(--site-ink) !important;
  border-radius: 0 !important;
  background: var(--site-surface) !important;
  box-shadow: 14px 14px 0 var(--site-accent) !important;
  overflow: hidden;
}

/* 标题区 */
.consent-header {
  padding: 34px 34px 26px;
  border-bottom: 1px solid var(--site-line);
  text-align: left;
}

.consent-kicker {
  margin: 0 0 10px;
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.consent-title {
  color: var(--site-ink);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.05em;
}

.consent-sub {
  margin-top: 8px;
  color: var(--site-muted);
  font-size: 13px;
  line-height: 1.6;
}

.consent-card :deep(.v-card-text) {
  padding: 28px 34px 34px;
}

.consent-card :deep(.v-field) {
  border-radius: 0;
  background: transparent;
}

.consent-card :deep(.v-label),
.consent-card .m-0-4 {
  color: var(--site-muted);
  font-size: 12px;
  font-weight: 650;
}

/* 权限列表间距 */
.consent-list {
  border: 1px solid var(--site-line) !important;
  border-radius: 0 !important;
  background: transparent !important;
}

/* 确认按钮 */
.consent-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 16px 0;
}

.consent-btn {
  min-width: 120px;
  border-radius: 0;
}

/* 底部安全提示 */
.consent-tip {
  font-size: 12px;
  color: var(--site-muted);
  text-align: center;
  margin: 0 8px 8px;
}

@media (max-width: 520px) {
  .consent-page {
    padding: 42px 16px 60px;
  }

  .consent-header,
  .consent-card :deep(.v-card-text) {
    padding-right: 22px;
    padding-left: 22px;
  }

  .consent-card {
    box-shadow: 8px 8px 0 var(--site-accent) !important;
  }

  .consent-actions {
    flex-direction: column-reverse;
  }

  .consent-btn {
    width: 100%;
  }
}
</style>
