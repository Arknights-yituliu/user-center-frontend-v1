import { createRouter, createWebHistory } from 'vue-router'
import UserView from '../views/UserView.vue'
import { getUcToken } from '../api/uc/uc-api'
import LandingView from '../views/LandingView.vue'
import ProjectsView from '../views/ProjectsView.vue'
import ClassicUserView from '../classic-pages/UserView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 根路径是公开介绍页
    {
      path: '/',
      name: 'LANDING',
      component: LandingView,
      meta: {
        title: '酸橙云 · 让这片大地数据互通',
        hideSidebar: true,
      },
    },
    {
      path: '/projects',
      name: 'PROJECTS',
      component: ProjectsView,
      meta: {
        title: '工具列表 · 酸橙云',
        hideSidebar: true,
      },
    },
    {
      path: '/ui-preview',
      name: 'UI_PREVIEW',
      component: () => import('../views/UIPreviewView.vue'),
      meta: {
        title: '标题模块预览 · 酸橙云',
        hideSidebar: true,
      },
    },
    {
      path: '/color',
      name: 'COLOR',
      component: () => import('../views/ColorView.vue'),
      meta: {
        title: '配色方案 · 酸橙云',
        hideSidebar: true,
      },
    },
    {
      // 面向所有用户的产品使用指南，无需登录即可查看
      path: '/user-guide',
      name: 'USER_GUIDE',
      component: () => import('../views/UserGuideView.vue'),
      meta: {
        title: '用户指南 · 酸橙云',
        hideSidebar: true,
      },
    },
    {
      path: '/projects/:slug',
      name: 'PROJECT_DETAIL',
      redirect: { name: 'PROJECTS' },
    },
    {
      // 新版用户中心允许未登录访问，登录后再展示真实资料
      path: '/home',
      name: 'USER_PROFILE',
      component: UserView,
      meta: {
        title: '账号首页',
      },
    },
    {
      // 统一承载开发者中心的客户端管理和三类接入文档
      path: '/developer',
      name: 'DEVELOPER',
      component: () => import('../views/DeveloperView.vue'),
      meta: {
        title: '开发者中心',
        requiresAuth: true,
      },
    },
    { path: '/user/profile', redirect: { name: 'USER_PROFILE' } },
    {
      // 通用数据维护：用户维护可被多个工具共同使用的个人数据
      path: '/common-data',
      name: 'COMMON_DATA',
      component: () => import('../views/CommonDataView.vue'),
      meta: {
        title: '通用数据维护',
      },
    },
    { path: '/user/common-data', redirect: { name: 'COMMON_DATA' } },
    {
      // 原版项目入口：完整旧版站点统一挂在 /classic/ 下
      path: '/classic/',
      name: 'CLASSIC_HOME',
      component: ClassicUserView,
      meta: {
        title: '用户信息',
        requiresAuth: true,
        classicShell: true,
      },
    },
    { path: '/classic', redirect: { name: 'CLASSIC_HOME' } },
    {
      path: '/classic/user/profile',
      name: 'CLASSIC_USER_PROFILE',
      component: ClassicUserView,
      meta: {
        title: '用户信息',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/user/email',
      name: 'CLASSIC_BIND_EMAIL',
      component: () => import('../classic-pages/account/bind-email.vue'),
      meta: {
        title: '绑定/换绑邮箱',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/user/retrieve',
      name: 'CLASSIC_RETRIEVE',
      component: () => import('../classic-pages/account/retrieve.vue'),
      meta: {
        title: '重置密码',
        classicShell: true,
      },
    },
    {
      path: '/classic/user/oauth-clients',
      name: 'CLASSIC_OAUTH_CLIENTS',
      component: () => import('../classic-pages/account/oauth-clients.vue'),
      meta: {
        title: '客户端管理',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/user/oauth-grants',
      name: 'CLASSIC_OAUTH_GRANTS',
      component: () => import('../classic-pages/account/oauth-grants.vue'),
      meta: {
        title: '我的授权应用',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/user/oauth-guide',
      name: 'CLASSIC_OAUTH_WEB_GUIDE',
      component: () => import('../classic-pages/account/oauth-web-guide.vue'),
      meta: {
        title: '无后端 Web 授权',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/user/oauth-server-guide',
      name: 'CLASSIC_OAUTH_SERVER_GUIDE',
      component: () => import('../classic-pages/account/oauth-server-guide.vue'),
      meta: {
        title: '加密客户端授权',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/user/oauth-config-guide',
      name: 'CLASSIC_OAUTH_CONFIG_GUIDE',
      component: () => import('../classic-pages/account/oauth-config-guide.vue'),
      meta: {
        title: 'OAuth 用户配置',
        requiresAuth: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/about',
      name: 'CLASSIC_ABOUT',
      component: () => import('../classic-pages/AboutView.vue'),
      meta: {
        classicShell: true,
      },
    },
    {
      path: '/classic/account/login',
      name: 'CLASSIC_LOGIN',
      component: () => import('../classic-pages/account/login.vue'),
      meta: {
        title: '登录账号',
        hideSidebar: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/oauth2/login',
      name: 'CLASSIC_OAUTH_LOGIN',
      component: () => import('../classic-pages/account/oauth-login.vue'),
      meta: {
        title: '授权登录',
        hideSidebar: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/account/register',
      name: 'CLASSIC_REGISTER',
      component: () => import('../classic-pages/account/register.vue'),
      meta: {
        title: '注册账号',
        hideSidebar: true,
        classicShell: true,
      },
    },
    {
      path: '/classic/oauth2/consent',
      name: 'CLASSIC_OAUTH_CONSENT',
      component: () => import('../classic-pages/account/consent.vue'),
      meta: {
        title: '授权确认',
        hideSidebar: true,
        classicShell: true,
      },
    },
    { path: '/classic/account/retrieve', redirect: { name: 'CLASSIC_RETRIEVE' } },
    { path: '/classic/account/email', redirect: { name: 'CLASSIC_BIND_EMAIL' } },
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
      // OAuth 客户端自助管理：开发者维护自己名下的 OAuth 客户端（/user/oauth/client/**），需登录
      path: '/user/oauth-clients',
      name: 'OAUTH_CLIENTS',
      component: () => import('../pages/account/oauth-clients.vue'),
      meta: {
        title: '客户端管理',
        requiresAuth: true,
      },
    },
    {
      // 我的授权应用：查看授权过的第三方应用并按应用撤销（/user/oauth/grants），需登录
      path: '/user/oauth-grants',
      name: 'OAUTH_GRANTS',
      component: () => import('../pages/account/oauth-grants.vue'),
      meta: {
        title: '我的授权应用',
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
      meta: {
        title: '关于酸橙云',
      },
    },
    {
      path: '/login',
      name: 'LOGIN',
      component: () => import('../pages/account/login.vue'),
      meta: {
        title: '登录账号',
        hideSidebar: true,
      },
    },
    {
      path: '/account/login',
      redirect: (to) => ({
        name: 'LOGIN',
        query: to.query,
        hash: to.hash,
      }),
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

const classicRouteNames: Record<string, string> = {
  USER_PROFILE: 'CLASSIC_USER_PROFILE',
  BIND_EMAIL: 'CLASSIC_BIND_EMAIL',
  RETRIEVE: 'CLASSIC_RETRIEVE',
  OAUTH_CLIENTS: 'CLASSIC_OAUTH_CLIENTS',
  OAUTH_GRANTS: 'CLASSIC_OAUTH_GRANTS',
  OAUTH_WEB_GUIDE: 'CLASSIC_OAUTH_WEB_GUIDE',
  OAUTH_SERVER_GUIDE: 'CLASSIC_OAUTH_SERVER_GUIDE',
  OAUTH_CONFIG_GUIDE: 'CLASSIC_OAUTH_CONFIG_GUIDE',
  about: 'CLASSIC_ABOUT',
  LOGIN: 'CLASSIC_LOGIN',
  OAUTH_LOGIN: 'CLASSIC_OAUTH_LOGIN',
  REGISTER: 'CLASSIC_REGISTER',
  OAUTH_CONSENT: 'CLASSIC_OAUTH_CONSENT',
}

function isClassicRoute(route: { matched: Array<{ meta: Record<string, unknown> }> }): boolean {
  return route.matched.some((record) => record.meta.classicShell === true)
}

/** 把旧版页面里的绝对路径/路由名继续留在 /classic/ 命名空间内 */
router.beforeEach((to, from) => {
  if (isClassicRoute(from) && !isClassicRoute(to)) {
    const classicName = typeof to.name === 'string' ? classicRouteNames[to.name] : undefined
    if (classicName) {
      return {
        name: classicName,
        query: to.query,
        hash: to.hash,
      }
    }
    if (to.path === '/') {
      return {
        name: 'CLASSIC_HOME',
        query: to.query,
        hash: to.hash,
      }
    }
    if (
      to.path.startsWith('/user/') ||
      to.path.startsWith('/account/') ||
      to.path.startsWith('/oauth2/') ||
      to.path === '/about'
    ) {
      return {
        path: `/classic${to.path}`,
        query: to.query,
        hash: to.hash,
      }
    }
  }

  // 受保护页面在开发和生产环境都要求有效登录态。
  if (to.meta.requiresAuth && !getUcToken()) {
    return {
      name: to.meta.classicShell ? 'CLASSIC_LOGIN' : 'LOGIN',
      query: { returnTo: to.fullPath },
    }
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
