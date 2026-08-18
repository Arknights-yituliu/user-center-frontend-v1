<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUcUid, logoutUcSession } from '../api/uc/uc-api'

const router = useRouter()

/**
 * 账户信息（模板占位数据）
 * TODO: 后续接入 UC GET /user/profile（uc-api.ts 已提供 getUserProfile），替换为真实数据
 */
const profile = ref({
  uid: getUcUid() || '--',
  nickname: '用户昵称',
  email: 'user@example.com',
  avatar: '',
  status: 1,
  registerTime: '2026-01-01 00:00:00',
  lastLoginTime: '2026-08-18 00:00:00',
})

/** 账户状态文案映射 */
const statusText: Record<number, string> = {
  0: '已禁用',
  1: '正常',
}

/**
 * 退出登录：清除服务端与本地会话后跳转登录页
 */
async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
}
</script>

<template>
  <main class="home-page">
    <v-card class="profile-card mx-auto mt-10 pa-4" max-width="480">
      <div class="d-flex align-center mb-4">
        <v-avatar size="64" color="primary">
          <v-img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
          <span v-else class="text-h5">{{ profile.nickname.charAt(0) }}</span>
        </v-avatar>
        <div class="ml-4">
          <div class="text-h6">{{ profile.nickname }}</div>
          <div class="text-caption text-medium-emphasis">UID：{{ profile.uid }}</div>
        </div>
      </div>

      <v-divider />

      <v-list>
        <v-list-item title="邮箱" :subtitle="profile.email || '未绑定'" prepend-icon="mdi-email-outline" />
        <v-list-item
          title="账户状态"
          :subtitle="statusText[profile.status] || '未知'"
          prepend-icon="mdi-shield-account-outline"
        />
        <v-list-item title="注册时间" :subtitle="profile.registerTime" prepend-icon="mdi-calendar-plus-outline" />
        <v-list-item title="上次登录" :subtitle="profile.lastLoginTime" prepend-icon="mdi-login" />
      </v-list>

      <v-divider />

      <div class="d-flex ga-3 mt-4">
        <v-btn variant="outlined" color="primary" block to="/account/email"> 绑定/换绑邮箱 </v-btn>
        <v-btn color="error" block @click="handleLogout"> 退出登录 </v-btn>
      </div>
    </v-card>
  </main>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
}
</style>
