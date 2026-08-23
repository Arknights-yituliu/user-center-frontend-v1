<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createMessage } from '../../utils/message'
import { confirmConsent, getConsentInfo, type ConsentInfoVO } from '../../api/uc/uc-api'

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

/**
 * 当前确认页完整地址：未登录跳登录页时作为 redirect 参数，
 * 登录成功后登录页会回跳此地址继续确认
 */
function consentPageUrl(): string {
  return window.location.origin + window.location.pathname + '?pending_id=' + encodeURIComponent(pendingId.value)
}

/**
 * 加载授权确认信息：调 GET /oauth2/consent/info
 * 未登录（code=80001）时跳登录页，登录成功后回跳本页自动重新加载
 */
async function loadConsentInfo(): Promise<void> {
  loading.value = true
  try {
    const resp = await getConsentInfo(pendingId.value)
    consentInfo.value = resp.data
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: number }).code : undefined
    if (code === 80001) {
      // 未登录：跳登录页，登录成功回跳本页（token 存 localStorage 后重新加载即可）
      createMessage({ text: '请先登录后再确认授权', type: 'warning' })
      router.replace({ name: 'LOGIN', query: { redirect: consentPageUrl() } })
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
  submitting.value = true
  try {
    const resp = await confirmConsent(pendingId.value, approve)
    const redirectUrl = resp.data
    if (redirectUrl) {
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
    <!-- 渐变背景层 -->
    <div class="consent-bg"></div>

    <v-card class="consent-card m-a" max-width="480" width="100%">
      <!-- 标题区 -->
      <div class="consent-header">
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

            <div class="m-0-4">授权后将允许该网站</div>
            <v-list class="m-4 consent-list" density="compact" variant="outlined">
              <v-list-item v-for="(scope, i) in consentInfo.scopes" :key="i">
                <template v-slot:prepend>
                  <v-icon color="primary">mdi-check-circle-outline</v-icon>
                </template>
                <v-list-item-title>{{ scope.desc }}</v-list-item-title>
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

          <!-- 拒绝 / 同意 按钮 -->
          <div class="flex justify-center m-4">
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
                class="consent-btn m-4"
                :loading="submitting"
                @click="submit(true)"
            >同意授权</v-btn>
          </div>

          <div class="consent-tip">同意后将跳转回第三方网站，并授予其上述权限。请确认该网站可信任。</div>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.consent-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* 渐变背景层 */
.consent-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(229, 242, 255, 0.9) 100%);
  z-index: 0;
}

[data-theme="dark"] .consent-bg {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
}

.consent-card {
  position: relative;
  z-index: 1;
  border-radius: 12px;
  overflow: hidden;
}

/* 标题区 */
.consent-header {
  padding: 28px 24px 20px;
  text-align: center;
}

.consent-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 6px;
}

.consent-sub {
  font-size: 13px;
  opacity: 0.6;
}

/* 权限列表间距 */
.consent-list {
  border-radius: 8px;
}

/* 确认按钮 */
.consent-btn {
  width: 120px;
  border-radius: 8px;
}

/* 底部安全提示 */
.consent-tip {
  font-size: 12px;
  opacity: 0.5;
  text-align: center;
  margin: 0 8px 8px;
}
</style>
