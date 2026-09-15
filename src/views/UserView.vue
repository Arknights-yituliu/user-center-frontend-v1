<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  getUcToken,
  getUcUid,
  getUserProfile,
  updateProfile,
  type UcProfileVO,
} from '../api/uc/uc-api'
import { createMessage } from '../utils/message'

const LoginView = defineAsyncComponent(() => import('../pages/account/login.vue'))
const router = useRouter()
const pageLoading = ref(true)
const loggedIn = ref(!!getUcToken())
// 待接入用户同步数据汇总接口；不使用已入驻工具数量冒充。
const syncedToolCount = ref<number | null>(null)
type DataStatusTone = 'fresh' | 'stale' | 'empty'

interface DataStatus {
  label: string
  tone: DataStatusTone
}

const operatorDataUpdatedAt = ref<Date | null>(null)
const hasReadUserGuide = ref(false)
const loginDialog = ref(false)
const nicknameEditing = ref(false)
const nicknameInput = ref<HTMLInputElement | null>(null)
const newNickname = ref('')
const editNicknameLoading = ref(false)

const profile = ref<UcProfileVO>({
  uid: Number(getUcUid()) || 0,
  nickname: '--',
  email: null,
  avatar: null,
  status: 1,
  registerTime: '',
  lastLoginTime: '',
})

function formatDataStatus(updatedAt: Date | null): DataStatus {
  if (!updatedAt) {
    return { label: '未导入', tone: 'empty' }
  }

  const elapsedMs = Math.max(0, Date.now() - updatedAt.getTime())
  const dayMs = 24 * 60 * 60 * 1000

  if (elapsedMs < dayMs) {
    const time = updatedAt.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return { label: `${time}前`, tone: 'fresh' }
  }

  if (elapsedMs < 30 * dayMs) {
    return { label: `${Math.floor(elapsedMs / dayMs)}天前`, tone: 'fresh' }
  }

  const year = updatedAt.getFullYear()
  const month = String(updatedAt.getMonth() + 1).padStart(2, '0')
  const day = String(updatedAt.getDate()).padStart(2, '0')
  return { label: `${year}-${month}-${day}`, tone: 'stale' }
}

const operatorDataStatus = computed(() => formatDataStatus(operatorDataUpdatedAt.value))

async function loadProfile(): Promise<void> {
  if (!getUcToken()) {
    loggedIn.value = false
    pageLoading.value = false
    return
  }

  loggedIn.value = true
  try {
    const response = await getUserProfile()
    if (response.data) {
      profile.value = { ...profile.value, ...response.data }
    }
  } catch (error) {
    const err = error as { code?: number } | null
    if (err && (err.code === 80001 || err.code === 80002)) {
      router.push({ name: 'LOGIN' })
      return
    }
  } finally {
    pageLoading.value = false
  }
}

onMounted(() => {
  void loadProfile()
})

async function handleLoginSuccess(): Promise<void> {
  loginDialog.value = false
  loggedIn.value = true
  await loadProfile()
}

async function openEditNickname(): Promise<void> {
  newNickname.value = profile.value.nickname || ''
  nicknameEditing.value = true
  await nextTick()
  nicknameInput.value?.focus()
  nicknameInput.value?.select()
}

function cancelEditNickname(): void {
  if (editNicknameLoading.value) return
  nicknameEditing.value = false
  newNickname.value = ''
}

async function handleSubmitNickname(): Promise<void> {
  const nickname = newNickname.value.trim()
  if (!nickname) {
    createMessage({ text: '昵称不能为空', type: 'warning' })
    return
  }
  if (nickname.length > 20) {
    createMessage({ text: '昵称长度不能超过 20', type: 'warning' })
    return
  }

  editNicknameLoading.value = true
  try {
    await updateProfile({ nickname })
    profile.value.nickname = nickname
    nicknameEditing.value = false
    createMessage({ text: '昵称修改成功', type: 'success' })
  } catch {
    // 错误提示已在 ucRequest 内部统一弹出
  } finally {
    editNicknameLoading.value = false
  }
}
</script>

<template>
  <main class="account-page">
    <div v-if="pageLoading" class="account-loading">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <template v-else>
      <header class="account-header">
        <div>
          <h1>酸橙云<br /><em>让这片大地数据互通</em></h1>
          <p class="account-intro">备份、同步、维护、管理各个工具和设备上的数据</p>
        </div>

        <div v-if="loggedIn" class="identity-card">
          <div class="identity-avatar">
            <v-img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
            <span v-else>{{ profile.nickname.charAt(0) }}</span>
          </div>
          <div class="identity-copy">
            <div v-if="nicknameEditing" class="identity-name identity-name-editing">
              <input
                ref="nicknameInput"
                v-model="newNickname"
                class="identity-nickname-input"
                type="text"
                aria-label="昵称"
                maxlength="20"
                :disabled="editNicknameLoading"
                @keyup.enter="handleSubmitNickname"
                @keyup.esc="cancelEditNickname"
              />
              <button
                class="identity-edit identity-edit-confirm"
                type="button"
                aria-label="保存昵称"
                title="保存昵称"
                :disabled="editNicknameLoading"
                @click="handleSubmitNickname"
              >
                <v-icon icon="mdi-check" size="15"></v-icon>
              </button>
              <button
                class="identity-edit identity-edit-cancel"
                type="button"
                aria-label="取消编辑昵称"
                title="取消编辑昵称"
                :disabled="editNicknameLoading"
                @click="cancelEditNickname"
              >
                <v-icon icon="mdi-close" size="15"></v-icon>
              </button>
            </div>
            <div v-else class="identity-name">
              <strong>{{ profile.nickname }}</strong>
              <button
                class="identity-edit"
                type="button"
                aria-label="修改昵称"
                title="修改昵称"
                @click="openEditNickname"
              >
                <v-icon icon="mdi-pencil-outline" size="15"></v-icon>
              </button>
            </div>
            <span>UID · {{ profile.uid || '--' }}</span>
          </div>

          <div class="identity-security">
            <div class="identity-security-row">
              <span class="security-icon">
                <v-icon icon="mdi-email-outline" size="17"></v-icon>
              </span>
              <div>
                <strong>绑定邮箱</strong>
                <small>{{ profile.email || '尚未绑定邮箱' }}</small>
              </div>
              <RouterLink to="/user/email">
                修改
                <v-icon icon="mdi-arrow-top-right" size="14"></v-icon>
              </RouterLink>
            </div>
            <div class="identity-security-row">
              <span class="security-icon">
                <v-icon icon="mdi-lock-outline" size="17"></v-icon>
              </span>
              <div>
                <strong>登录密码</strong>
                <small>定期更新，保护账号安全</small>
              </div>
              <RouterLink to="/user/retrieve">
                修改/重置
                <v-icon icon="mdi-arrow-top-right" size="14"></v-icon>
              </RouterLink>
            </div>
          </div>
        </div>
        <button v-else class="login-card-trigger" type="button" @click="loginDialog = true">
          <span class="login-card-icon">
            <v-icon icon="mdi-login-variant" size="25"></v-icon>
          </span>
          <span class="login-card-copy">
            <strong>登录账号</strong>
            <small>登录后管理你的个人资料与云端数据</small>
          </span>
          <v-icon icon="mdi-arrow-top-right" size="20"></v-icon>
        </button>
      </header>

      <section class="content-module test-content-module">
        <div class="module-intro">
          <h2 class="module-title">管理各个项目的数据连接</h2>
          <div class="module-info">
            <p class="draft-module-description">
              已同步数据的工具：{{ syncedToolCount ?? '--' }} 个。
            </p>
          </div>
        </div>

        <div class="module-operation">
          <RouterLink class="module-action-link" to="/projects">
            <span class="module-action-icon">
              <v-icon icon="mdi-view-dashboard-outline" size="22"></v-icon>
            </span>
            <span class="module-action-copy">
              <strong class="module-action-title">进入工具控制面板</strong>
              <small class="module-action-description">管理各个工具的授权</small>
            </span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </RouterLink>
        </div>
      </section>

      <section class="content-module test-content-module">
        <div class="module-intro">
          <h2 class="module-title">通用数据更新与维护</h2>
          <div class="module-info data-status-list">
            <p class="data-status" :class="`data-status-${operatorDataStatus.tone}`">
              干员数据：{{ operatorDataStatus.label }}
            </p>
          </div>
        </div>

        <div class="module-operation common-data-content">
          <RouterLink class="module-action-link" to="/common-data">
            <span class="module-action-icon">
              <v-icon icon="mdi-database-cog-outline" size="22"></v-icon>
            </span>
            <span class="module-action-copy">
              <strong class="module-action-title">进入通用数据维护面板</strong>
              <small class="module-action-description"
                >维护干员信息，以供不特定的第三方项目调用</small
              >
            </span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </RouterLink>
        </div>
      </section>

      <section class="content-module test-content-module test-help-module">
        <div class="module-intro">
          <h2 class="module-title">帮助中心</h2>
          <div class="module-info">
            <p class="draft-module-description">
              已阅读用户指南（{{ hasReadUserGuide ? '1/1' : '0/1' }}）
            </p>
          </div>
        </div>

        <div class="module-operation">
          <div class="draft-help-preview-compact">
            <RouterLink class="module-action-link" to="/user-guide">
              <span class="module-action-icon">
                <v-icon icon="mdi-book-open-page-variant-outline" size="22"></v-icon>
              </span>
              <span class="module-action-copy">
                <strong class="module-action-title">查看用户指南</strong>
                <small class="module-action-description"
                  >了解酸橙云如何为你带来安全、无缝的跨终端体验</small
                >
              </span>
              <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
            </RouterLink>
            <RouterLink class="module-action-link" to="/developer">
              <span class="module-action-icon">
                <v-icon icon="mdi-code-braces-box" size="22"></v-icon>
              </span>
              <span class="module-action-copy">
                <strong class="module-action-title">开发者中心</strong>
                <small class="module-action-description"
                  >了解酸橙云如何帮助开发者，以及接入和测试各种接口</small
                >
              </span>
              <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
            </RouterLink>
          </div>
        </div>
      </section>

      <section class="content-module test-content-module">
        <div class="module-intro">
          <h2 class="module-title">关于酸橙云</h2>
          <div class="module-info">
            <p class="draft-module-description">了解项目缘起、能力、技术和开发信息。</p>
          </div>
        </div>

        <div class="module-operation about-module-actions">
          <RouterLink class="module-action-link" to="/about">
            <span class="module-action-icon">
              <v-icon icon="mdi-information-outline" size="22"></v-icon>
            </span>
            <span class="module-action-copy">
              <strong class="module-action-title">查看关于酸橙云</strong>
              <small class="module-action-description">了解服务定位、数据范围和使用边界</small>
            </span>
            <v-icon icon="mdi-arrow-top-right" size="18"></v-icon>
          </RouterLink>
          <a
            class="module-action-link"
            href="https://github.com/Arknights-yituliu/user-center-frontend-v1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="module-action-icon">
              <v-icon icon="mdi-github" size="22"></v-icon>
            </span>
            <span class="module-action-copy">
              <strong class="module-action-title">前往 GitHub 前端仓库</strong>
              <small class="module-action-description">查看酸橙云用户中心的前端代码</small>
            </span>
            <v-icon icon="mdi-open-in-new" size="18"></v-icon>
          </a>
        </div>
      </section>

      <section class="content-module test-content-module other-links-module">
        <div class="module-intro">
          <h2 class="module-title">其他链接</h2>
        </div>

        <div class="module-operation other-links-actions">
          <a
            class="flat-module-link"
            href="https://space.bilibili.com/688411531"
            target="_blank"
            rel="noopener noreferrer"
          >
            <v-icon icon="mdi-play-circle-outline" size="20"></v-icon>
            <span>逻辑元 LogicalByte · B站</span>
            <v-icon icon="mdi-open-in-new" size="16"></v-icon>
          </a>
        </div>
      </section>
    </template>

    <v-dialog v-model="loginDialog" max-width="520" scrollable>
      <div class="login-dialog-shell">
        <button
          class="login-dialog-close"
          type="button"
          aria-label="关闭登录窗口"
          @click="loginDialog = false"
        >
          <v-icon icon="mdi-close" size="20"></v-icon>
        </button>
        <LoginView v-if="loginDialog" embedded @success="handleLoginSuccess" />
      </div>
    </v-dialog>
  </main>
</template>

<style scoped>
.account-page {
  width: min(1100px, calc(100% - 64px));
  margin: 0 auto;
  padding: 38px 0 64px;
}

.account-loading {
  display: grid;
  min-height: 60vh;
  place-items: center;
}

.account-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 60px;
  align-items: end;
  min-height: 360px;
  padding: 30px 0 54px;
  border-bottom: 1px solid var(--site-ink);
}

.eyebrow {
  margin: 0;
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.16em;
  line-height: 1.4;
  text-transform: uppercase;
}

.account-header h1 {
  margin: 18px 0 0;
  color: var(--site-ink);
  font-size: clamp(48px, 5vw, 68px);
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 0.96;
}

.account-header h1 em {
  color: var(--site-accent);
  font-style: normal;
}

.account-intro {
  max-width: 430px;
  margin: 24px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.8;
}

.identity-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 20px;
  border: 1px solid var(--site-ink);
  background: var(--site-surface);
  box-shadow: 10px 10px 0 var(--site-cyan);
}

.login-card-trigger {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 20px;
  gap: 14px;
  align-items: center;
  width: 320px;
  min-height: 150px;
  padding: 20px;
  border: 1px solid var(--site-ink);
  background: var(--site-surface);
  box-shadow: 10px 10px 0 var(--site-cyan);
  color: var(--site-ink);
  cursor: pointer;
  text-align: left;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.login-card-trigger:hover {
  box-shadow: 6px 6px 0 var(--site-cyan);
  transform: translate(4px, 4px);
}

.login-card-trigger:focus-visible,
.login-dialog-close:focus-visible,
.identity-edit:focus-visible {
  outline: 3px solid var(--site-warm);
  outline-offset: 3px;
}

.login-card-icon {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 50%;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.login-card-copy {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.login-card-copy strong {
  font-size: 18px;
  font-weight: 750;
}

.login-card-copy small {
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.6;
}

.identity-avatar {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--site-accent-soft);
  color: var(--site-accent);
  font-size: 27px;
  font-weight: 750;
}

.identity-avatar .v-img {
  width: 100%;
  height: 100%;
}

.identity-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.identity-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.identity-name-editing {
  gap: 4px;
  width: 100%;
}

.identity-nickname-input {
  min-width: 0;
  flex: 1;
  height: 30px;
  padding: 4px 8px;
  border: 1px solid var(--site-ink);
  background: var(--site-surface);
  color: var(--site-ink);
  font: inherit;
  font-size: 15px;
  line-height: 1.2;
}

.identity-nickname-input:focus {
  outline: 2px solid var(--site-accent);
  outline-offset: 1px;
}

.identity-copy strong {
  overflow: hidden;
  color: var(--site-ink);
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-edit {
  display: grid;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
  cursor: pointer;
}

.identity-edit:hover {
  background: var(--site-accent);
  color: var(--site-surface);
}

.identity-edit:disabled {
  cursor: wait;
  opacity: 0.5;
}

.identity-copy span {
  color: var(--site-muted);
  font-size: 11px;
}

.identity-security {
  display: grid;
  grid-column: 1 / -1;
  gap: 0;
  padding-top: 11px;
  border-top: 1px solid var(--site-line);
}

.identity-security-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  min-height: 49px;
  padding: 8px 0;
}

.identity-security-row + .identity-security-row {
  border-top: 1px solid var(--site-line);
}

.identity-security-row div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.identity-security-row strong {
  font-size: 12px;
}

.identity-security-row small {
  overflow: hidden;
  color: var(--site-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-security-row a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}

.content-module {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 60px;
  align-items: start;
  padding: 58px 0;
  border-bottom: 1px solid var(--site-line);
}

.module-intro {
  min-width: 0;
}

.module-title {
  margin: 0;
  color: var(--site-ink);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.1;
}

.module-info {
  min-width: 0;
}

.module-operation {
  min-width: 0;
}

.security-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.module-action-link {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 11px;
  width: min(100%, 320px);
  min-width: 0;
  min-height: 94px;
  margin-left: 0;
  padding: 14px 16px;
  border: 1px solid var(--site-ink);
  border-radius: 16px;
  background: var(--site-warm);
  box-shadow: 6px 6px 0 var(--site-pink);
  color: var(--site-ink);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.module-action-link:hover {
  box-shadow: 3px 3px 0 var(--site-pink);
  transform: translate(3px, 3px);
}

.module-action-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: var(--site-surface);
  color: var(--site-accent);
}

.module-action-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.module-action-title {
  font-size: 13px;
  font-weight: 750;
  line-height: 1.35;
}

.module-action-description {
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.5;
}

.login-dialog-shell {
  position: relative;
}

.login-dialog-close {
  position: absolute;
  z-index: 2;
  top: 13px;
  right: 13px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--site-muted);
  cursor: pointer;
}

.login-dialog-close:hover {
  color: var(--site-ink);
}

.draft-module-description {
  max-width: 220px;
  margin: 0;
  color: var(--site-muted);
  font-size: 14px;
  line-height: 1.65;
}

.test-content-module {
  position: relative;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 56px;
  padding: 48px 0;
}

.test-content-module::after {
  position: absolute;
  top: 48px;
  bottom: 48px;
  left: calc(380px + 28px);
  width: 1px;
  background: var(--site-line);
  content: '';
}

.test-content-module .module-intro {
  display: grid;
  gap: 8px;
}

.test-content-module .module-title {
  padding: 0 20px 10px;
}

.test-content-module .module-info {
  padding: 10px 20px 0;
}

.test-content-module .draft-module-description {
  max-width: 260px;
  font-size: 16px;
  line-height: 1.6;
}

.data-status-list {
  display: grid;
  gap: 4px;
}

.data-status {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
}

.data-status-fresh {
  color: var(--site-green);
}

.data-status-stale {
  color: #ff7d00;
}

.data-status-empty {
  color: var(--site-muted);
}

.test-content-module .module-action-link {
  width: min(100%, 300px);
  min-height: 90px;
}

.test-content-module .module-action-copy {
  gap: 3px;
}

.test-content-module .module-action-title {
  font-size: 14px;
  font-weight: 650;
}

.test-content-module .module-action-description {
  font-size: 12px;
  line-height: 1.5;
}

.draft-help-preview-compact {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(100%, 620px);
  margin-left: 0;
  gap: 10px;
}

.about-module-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: min(100%, 620px);
  gap: 10px;
}

.about-module-actions .module-action-link {
  width: 100%;
}

.other-links-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 18px;
}

.flat-module-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--site-line);
  border-radius: 4px;
  background: var(--site-surface);
  color: var(--site-ink);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.flat-module-link:hover,
.flat-module-link:focus-visible {
  background: var(--site-accent-soft);
  border-color: var(--site-accent);
  color: var(--site-accent);
}

.flat-module-link:focus-visible {
  outline: 2px solid var(--site-warm);
  outline-offset: 5px;
}

@media (max-width: 900px) {
  .account-page {
    width: min(100% - 48px, 700px);
  }

  .account-header,
  .content-module {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .test-content-module::after {
    display: none;
  }

  .account-header {
    min-height: 0;
  }

  .identity-card {
    max-width: 340px;
  }

  .login-card-trigger {
    width: min(100%, 340px);
  }
}

@media (max-width: 600px) {
  .account-page {
    width: calc(100% - 32px);
    padding-top: 24px;
  }

  .account-header h1 {
    font-size: 52px;
  }
}
</style>
