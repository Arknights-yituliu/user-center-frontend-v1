<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

/** 侧边导航项 */
interface NavItem {
  /** 导航标题 */
  title: string
  /** 目标路由路径 */
  to: string
  /** 前置图标（mdi 图标名） */
  icon: string
}

/** 用户中心侧边导航项，第一项为用户信息 */
const navItems: NavItem[] = [
  { title: '用户信息', to: '/user/profile', icon: 'mdi-account-outline' },
  { title: '换绑邮箱', to: '/user/email', icon: 'mdi-email-sync-outline' },
  { title: '重置密码', to: '/user/retrieve', icon: 'mdi-lock-reset' },
]
</script>

<template>
  <div class="user-layout">
    <aside class="user-sidebar">
      <RouterLink to="/user/profile" class="sidebar-brand">用户中心</RouterLink>
      <v-divider />
      <v-list nav density="compact" class="sidebar-list">
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="lg"
          color="primary"
        />
      </v-list>
    </aside>
    <main class="user-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.user-layout {
  display: flex;
  min-height: 100vh;
}

.user-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
}

.sidebar-brand {
  display: block;
  padding: 16px 20px;
  font-size: 18px;
  font-weight: 600;
  text-decoration: none;
  color: inherit;
}

.sidebar-list {
  padding: 8px;
}

.user-main {
  flex: 1;
  min-width: 0;
}

[data-theme='dark'] .user-sidebar {
  background: #1e1e1e;
  border-right-color: rgba(255, 255, 255, 0.08);
}
</style>
