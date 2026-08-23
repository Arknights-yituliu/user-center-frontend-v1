import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import UserLayout from '../layouts/UserLayout.vue'
import UserView from '../views/UserView.vue'
import { getUcToken } from '../api/uc/uc-api'

/** 未登录守卫：本地无 UC token 时重定向到登录页；meta.public 的路由（如找回密码）放行 */
function requireAuth(to: RouteLocationNormalized): { name: 'LOGIN' } | true {
  if (to.meta.public) {
    return true
  }
  if (!getUcToken()) {
    return { name: 'LOGIN' }
  }
  return true
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 根路径重定向到用户信息页
    { path: '/', redirect: { name: 'USER_PROFILE' } },
    {
      // 用户中心模块：使用 UserLayout 作为外壳（侧边导航栏 + 主内容区）
      path: '/user',
      component: UserLayout,
      beforeEnter: requireAuth,
      children: [
        {
          path: 'profile',
          name: 'USER_PROFILE',
          component: UserView,
          meta: {
            title: '用户信息',
          },
        },
        {
          // 绑定/换绑邮箱：作为 UserLayout 子路由，保留侧边导航
          path: 'email',
          name: 'BIND_EMAIL',
          component: () => import('../pages/account/bind-email.vue'),
          meta: {
            title: '绑定/换绑邮箱',
          },
        },
        {
          // 重置密码（找回密码）：meta.public=true 允许未登录从登录页进入，仍在布局内展示
          path: 'retrieve',
          name: 'RETRIEVE',
          component: () => import('../pages/account/retrieve.vue'),
          meta: {
            title: '重置密码',
            public: true,
          },
        },
      ],
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
      },
    },
    {
      path: '/account/register',
      name: 'REGISTER',
      component: () => import('../pages/account/register.vue'),
      meta: {
        title: '注册账号',
      },
    },
    {
      // OAuth 授权确认页：第三方网站接入时展示申请权限（public=true 允许未登录进入，未登录时页内跳登录页）
      path: '/oauth2/consent',
      name: 'OAUTH_CONSENT',
      component: () => import('../pages/account/consent.vue'),
      meta: {
        title: '授权确认',
        public: true,
      },
    },
    // 旧路径兼容：重定向到 UserLayout 子路由
    { path: '/account/retrieve', redirect: { name: 'RETRIEVE' } },
    { path: '/account/email', redirect: { name: 'BIND_EMAIL' } },
  ],
})

/** 路由切换后同步页面标题（取自路由 meta.title） */
router.afterEach((to) => {
  if (to.meta && typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
