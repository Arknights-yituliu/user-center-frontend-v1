import { createRouter, createWebHistory } from 'vue-router'
import UserView from '../views/UserView.vue'
import { getUcToken } from '../api/uc/uc-api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 根路径重定向到用户信息页
    { path: '/', redirect: { name: 'USER_PROFILE' } },
    {
      // 用户信息页：requiresAuth=true 需登录
      path: '/user/profile',
      name: 'USER_PROFILE',
      component: UserView,
      meta: {
        title: '用户信息',
        requiresAuth: true,
      },
    },
    {
      // 绑定/换绑邮箱：requiresAuth=true 需登录
      path: '/user/email',
      name: 'BIND_EMAIL',
      component: () => import('../pages/account/bind-email.vue'),
      meta: {
        title: '绑定/换绑邮箱',
        requiresAuth: true,
      },
    },
    {
      // 重置密码（找回密码）：未登录可从登录页进入，无需登录
      path: '/user/retrieve',
      name: 'RETRIEVE',
      component: () => import('../pages/account/retrieve.vue'),
      meta: {
        title: '重置密码',
      },
    },
    {
      // OAuth 客户端自助管理：开发者维护自己名下的 OAuth 客户端（/oauth2/client/**），需登录
      path: '/user/oauth-clients',
      name: 'OAUTH_CLIENTS',
      component: () => import('../pages/account/oauth-clients.vue'),
      meta: {
        title: '客户端管理',
        requiresAuth: true,
      },
    },
    {
      // 无后端 Web 应用 OAuth2 接入指南：可从客户端管理页带入接入参数，需登录
      path: '/user/oauth-guide',
      name: 'OAUTH_WEB_GUIDE',
      component: () => import('../pages/account/oauth-web-guide.vue'),
      meta: {
        title: '无后端 Web 授权',
        requiresAuth: true,
      },
    },
    {
      // 加密客户端 OAuth2 接入指南：密钥、PKCE 和令牌均由可信业务后端管理，需登录
      path: '/user/oauth-server-guide',
      name: 'OAUTH_SERVER_GUIDE',
      component: () => import('../pages/account/oauth-server-guide.vue'),
      meta: {
        title: '加密客户端授权',
        requiresAuth: true,
      },
    },
    {
      // OAuth access token 用户配置接口指南：保存、读取、删除、配额与 CAS 冲突处理，需登录
      path: '/user/oauth-config-guide',
      name: 'OAUTH_CONFIG_GUIDE',
      component: () => import('../pages/account/oauth-config-guide.vue'),
      meta: {
        title: 'OAuth 用户配置',
        requiresAuth: true,
      },
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js)
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/account/login',
      name: 'LOGIN',
      component: () => import('../pages/account/login.vue'),
      meta: {
        title: '登录账号',
        hideSidebar: true,
      },
    },
    {
      // OAuth 安全登录页：authorize 未登录时跳转进入（302 携带 ?redirect=<authorize地址>）。
      // 区别于普通登录页：不读取本地 UC token 自动换票、登录后不将 token 写入 localStorage
      path: '/oauth2/login',
      name: 'OAUTH_LOGIN',
      component: () => import('../pages/account/oauth-login.vue'),
      meta: {
        title: '授权登录',
        hideSidebar: true,
      },
    },
    {
      path: '/account/register',
      name: 'REGISTER',
      component: () => import('../pages/account/register.vue'),
      meta: {
        title: '注册账号',
        hideSidebar: true,
      },
    },
    {
      // OAuth 授权确认页：第三方网站接入时展示申请权限，未登录时页内跳授权登录页
      path: '/oauth2/consent',
      name: 'OAUTH_CONSENT',
      component: () => import('../pages/account/consent.vue'),
      meta: {
        title: '授权确认',
        hideSidebar: true,
      },
    },
    // 旧路径兼容：重定向到用户中心页面
    { path: '/account/retrieve', redirect: { name: 'RETRIEVE' } },
    { path: '/account/email', redirect: { name: 'BIND_EMAIL' } },
  ],
})

/** 全局登录守卫：meta.requiresAuth 的路由在未登录时重定向到登录页 */
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getUcToken()) {
    return { name: 'LOGIN' }
  }
  return true
})

/** 路由切换后同步页面标题（取自路由 meta.title） */
router.afterEach((to) => {
  if (to.meta && typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
