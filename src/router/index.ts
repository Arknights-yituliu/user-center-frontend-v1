import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { getUcToken } from '../api/uc/uc-api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: '账户信息',
      },
      // 未登录（本地无 UC token）时重定向到登录页
      beforeEnter: () => {
        if (!getUcToken()) {
          return { name: 'LOGIN' }
        }
      },
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
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
      path: '/account/retrieve',
      name: 'RETRIEVE',
      component: () => import('../pages/account/retrieve.vue'),
      meta: {
        title: '找回账号',
      },
    },
    {
      path: '/account/email',
      name: 'BIND_EMAIL',
      component: () => import('../pages/account/bind-email.vue'),
      meta: {
        title: '绑定/换绑邮箱',
      },
    },
  ],
})

/** 路由切换后同步页面标题（取自路由 meta.title） */
router.afterEach((to) => {
  if (to.meta && typeof to.meta.title === 'string') {
    document.title = to.meta.title
  }
})

export default router
