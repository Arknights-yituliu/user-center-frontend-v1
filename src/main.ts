import { createApp } from 'vue'
import 'vuetify/styles'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify/vuetify'
// 全局原子样式（布局/间距/文本等工具类，迁移自原项目 assets/css/atomic）
import './assets/css/atomic/margin.scss'
import './assets/css/atomic/padding.scss'
import './assets/css/atomic/flex.scss'
import './assets/css/atomic/color.scss'
import './assets/css/atomic/font.scss'
import './assets/css/atomic/opacity.scss'

const app = createApp(App)

app.use(router)
app.use(vuetify)

app.mount('#app')
