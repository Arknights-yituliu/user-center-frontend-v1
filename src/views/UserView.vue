<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  getUcToken,
  getUcUid,
  getUserProfile,
  logoutUcSession,
  updateProfile,
  type UcProfileVO,
} from '../api/uc/uc-api'
import { mockUserProfile } from '../data/mock-user'
import { projects } from '../data/projects'
import { createMessage } from '../utils/message'

const router = useRouter()
const pageLoading = ref(true)
const editNicknameDialog = ref(false)
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

onMounted(async () => {
  if (!getUcToken()) {
    if (import.meta.env.DEV) {
      profile.value = { ...mockUserProfile }
    }
    pageLoading.value = false
    return
  }
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
})

function openEditNickname(): void {
  newNickname.value = profile.value.nickname || ''
  editNicknameDialog.value = true
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
    editNicknameDialog.value = false
    createMessage({ text: '昵称修改成功', type: 'success' })
  } catch {
    // 错误提示已在 ucRequest 内部统一弹出
  } finally {
    editNicknameLoading.value = false
  }
}

async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
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
          <p class="eyebrow">酸橙云 / 个人中心</p>
          <h1>管理你的账号<br /><em>与数据。</em></h1>
          <p class="account-intro">
            个人信息、安全设置，以及第三方应用保存的数据，都可以从这里进入。
          </p>
        </div>

        <div class="identity-card">
          <div class="identity-avatar">
            <v-img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
            <span v-else>{{ profile.nickname.charAt(0) }}</span>
          </div>
          <div class="identity-copy">
            <div class="identity-name">
              <strong>{{ profile.nickname }}</strong>
              <button class="identity-edit" type="button" aria-label="修改昵称" @click="openEditNickname">
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
      </header>

      <section class="center-section">
        <div class="section-heading">
          <span class="section-number">01</span>
          <div>
            <p class="eyebrow">我的工具</p>
            <h2>继续使用<br />你的工具。</h2>
          </div>
        </div>

        <div class="section-content">
          <div class="tools-heading">
            <p class="section-description">
              已接入酸橙云的工具，都可以从这里继续使用，并找回保存在云端的个人数据。
            </p>
            <RouterLink class="tools-link" to="/projects">
              查看全部工具
              <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
            </RouterLink>
          </div>

          <div class="my-tools-grid">
            <RouterLink
              v-for="(project, index) in projects"
              :key="project.slug"
              class="my-tool-card"
              :to="{ name: 'PROJECT_DETAIL', params: { slug: project.slug } }"
            >
              <div class="my-tool-top">
                <span class="my-tool-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="my-tool-category">{{ project.category }}</span>
              </div>
              <span class="my-tool-icon">
                <v-icon :icon="project.icon" size="24"></v-icon>
              </span>
              <strong>{{ project.name }}</strong>
              <small>{{ project.description }}</small>
              <div class="my-tool-bottom">
                <span>查看工具</span>
                <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
              </div>
            </RouterLink>
          </div>
        </div>
      </section>

      <section class="center-section data-section">
        <div class="section-heading">
          <span class="section-number">02</span>
          <div>
            <p class="eyebrow">数据编辑</p>
            <h2>保存、编辑<br />和同步用户数据。</h2>
          </div>
        </div>

        <div class="section-content">
          <div class="data-intro">
            <p class="section-description">
              为第三方应用提供按用户隔离的云端配置。应用可以保存、读取、编辑和删除自己的用户数据。
            </p>
            <RouterLink class="solid-link" to="/user/oauth-config-guide">
              查看数据服务
              <v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
            </RouterLink>
          </div>
          <div class="data-points">
            <div>
              <span class="data-point-number">01</span>
              <strong>云端持久保存</strong>
              <small>不依赖单一浏览器</small>
            </div>
            <div>
              <span class="data-point-number">02</span>
              <strong>按应用隔离</strong>
              <small>不同工具互不干扰</small>
            </div>
            <div>
              <span class="data-point-number">03</span>
              <strong>版本冲突保护</strong>
              <small>编辑时避免覆盖新数据</small>
            </div>
          </div>
        </div>
      </section>

      <section class="center-section help-section">
        <div class="section-heading">
          <span class="section-number">03</span>
          <div>
            <p class="eyebrow">帮助</p>
            <h2>遇到问题，<br />从指南开始。</h2>
          </div>
        </div>

        <div class="section-content">
          <p class="section-description">
            无论你是使用工具，还是准备接入酸橙云，都可以从对应的指南开始了解。
          </p>
          <div class="help-grid">
            <RouterLink class="help-card help-card-user" to="/projects">
              <span class="help-card-top">
                <span class="help-card-label">面向用户</span>
                <v-icon icon="mdi-arrow-top-right" size="20"></v-icon>
              </span>
              <span class="help-card-icon">
                <v-icon icon="mdi-book-open-page-variant-outline" size="28"></v-icon>
              </span>
              <strong>用户指南</strong>
              <small>了解如何使用已入驻工具，以及如何让数据保存到云端。</small>
            </RouterLink>
            <RouterLink class="help-card help-card-developer" to="/user/oauth-guide">
              <span class="help-card-top">
                <span class="help-card-label">面向开发者</span>
                <v-icon icon="mdi-arrow-top-right" size="20"></v-icon>
              </span>
              <span class="help-card-icon">
                <v-icon icon="mdi-code-braces-box" size="28"></v-icon>
              </span>
              <strong>开发者指南</strong>
              <small>从创建应用开始，接入酸橙云登录和用户数据服务。</small>
            </RouterLink>
          </div>
        </div>
      </section>

      <footer class="account-footer">
        <span>酸橙云 · 让工具数据跟着用户走</span>
        <button class="logout-action" type="button" @click="handleLogout">
          退出当前账号
          <v-icon icon="mdi-logout-variant" size="17"></v-icon>
        </button>
      </footer>
    </template>

    <v-dialog v-model="editNicknameDialog" max-width="420">
      <v-card class="edit-dialog">
        <v-card-title>修改昵称</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newNickname"
            label="新昵称"
            variant="outlined"
            density="comfortable"
            maxlength="20"
            counter
            @keyup.enter="handleSubmitNickname"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="editNicknameDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="editNicknameLoading" @click="handleSubmitNickname">
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
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
  font-size: clamp(48px, 6.5vw, 82px);
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

.center-section {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 60px;
  padding: 58px 0;
  border-bottom: 1px solid var(--site-line);
}

.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.section-number {
  color: var(--site-pink);
  font-size: 12px;
  font-weight: 750;
}

.section-heading h2 {
  margin: 13px 0 0;
  color: var(--site-ink);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.05em;
  line-height: 1.08;
}

.section-content {
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

.section-description {
  max-width: 540px;
  margin: 0 0 24px;
  color: var(--site-muted);
  font-size: 14px;
  line-height: 1.8;
}

.tools-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.tools-link {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--site-ink);
  color: var(--site-ink);
  font-size: 12px;
  font-weight: 750;
}

.tools-link:hover {
  color: var(--site-accent);
  border-color: var(--site-accent);
}

.my-tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.my-tool-card {
  display: grid;
  min-height: 190px;
  padding: 17px;
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  color: var(--site-ink);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.my-tool-card:nth-child(1) {
  border-top: 3px solid var(--site-accent);
}

.my-tool-card:nth-child(2) {
  border-top: 3px solid var(--site-warm);
}

.my-tool-card:nth-child(3) {
  border-top: 3px solid var(--site-pink);
}

.my-tool-card:nth-child(4) {
  border-top: 3px solid var(--site-cyan);
}

.my-tool-card:hover {
  box-shadow: 5px 5px 0 var(--site-cyan);
  transform: translateY(-3px);
}

.my-tool-top,
.my-tool-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.my-tool-index,
.my-tool-category {
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.my-tool-icon {
  display: grid;
  width: 42px;
  height: 42px;
  margin: 25px 0 16px;
  place-items: center;
  border-radius: 12px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.my-tool-card > strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-tool-card > small {
  overflow: hidden;
  margin-top: 6px;
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.55;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-tool-bottom {
  align-self: end;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--site-line);
  color: var(--site-accent);
  font-size: 11px;
  font-weight: 750;
}

.data-section {
  border-bottom: 0;
}

.data-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 30px;
}

.solid-link {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 7px;
  padding: 12px 15px;
  background: var(--site-accent);
  color: var(--site-surface);
  font-size: 12px;
  font-weight: 750;
}

.solid-link:hover {
  background: var(--site-ink);
}

.data-points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 28px;
}

.data-points > div {
  display: grid;
  gap: 7px;
  min-height: 112px;
  padding: 15px;
  border-top: 2px solid var(--site-cyan);
  background: var(--site-surface);
}

.data-point-number {
  color: var(--site-pink);
  font-size: 11px;
  font-weight: 750;
}

.data-points strong {
  font-size: 14px;
}

.data-points small {
  color: var(--site-muted);
  font-size: 11px;
}

.help-section {
  border-bottom: 0;
}

.help-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.help-card {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--site-ink);
  color: var(--site-ink);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.help-card:hover {
  box-shadow: 7px 7px 0 var(--site-ink);
  transform: translateY(-3px);
}

.help-card-user {
  background: var(--site-warm);
}

.help-card-developer {
  background: var(--site-accent);
  color: var(--site-surface);
}

.help-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.help-card-label {
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.help-card-icon {
  display: grid;
  width: 48px;
  height: 48px;
  margin-top: 40px;
  place-items: center;
  border-radius: 14px;
  background: var(--site-surface);
  color: var(--site-ink);
}

.help-card strong {
  margin-top: 18px;
  font-size: 22px;
  font-weight: 700;
}

.help-card small {
  max-width: 280px;
  margin-top: 8px;
  color: var(--site-muted);
  font-size: 12px;
  line-height: 1.65;
}

.help-card-developer small {
  color: rgb(255 253 246 / 0.75);
}

.account-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 24px;
  color: var(--site-muted);
  font-size: 12px;
}

.logout-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--site-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.logout-action:hover {
  color: var(--site-accent);
}

.edit-dialog {
  border: 1px solid var(--site-ink);
  border-radius: 14px !important;
  background: var(--site-surface) !important;
}

@media (max-width: 900px) {
  .account-page {
    width: min(100% - 48px, 700px);
  }

  .account-header,
  .center-section {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .account-header {
    min-height: 0;
  }

  .identity-card {
    max-width: 340px;
  }

  .my-tools-grid {
    grid-template-columns: 1fr;
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

  .data-points,
  .help-grid {
    grid-template-columns: 1fr;
  }

  .data-intro {
    flex-direction: column;
    gap: 4px;
  }

  .tools-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .account-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
