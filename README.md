# tmp-vue-app

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

### Run unit tests

```sh
npm test
```

测试基于 Node 内置 `node --test`，自动发现 `tests/*.test.mjs`；用例在 `vm` 中执行真实模块并注入确定性传输层，不会产生真实网络请求。

## 页面与数据链路

| 路由 | 页面 | 职责 |
| --- | --- | --- |
| `/skland-import` | 森空岛数据同步 | 获取一次凭证 → 一次绑定列表 → 勾选游戏与账号 → 分别拉取并上传；需正式登录会话 |
| `/arknights-game-data` | 游戏数据·明日方舟 | 已绑定账号展示、干员表格与筛选、手动编辑、草稿上传 |
| `/endfield-game-data` | 游戏数据·终末地 | 已导入角色的云端档案详情 |

### 森空岛数据同步（`/skland-import`）

- **凭证来源三选一**：手工粘贴 `cred,token`、官网 Token（通行证 token 或 `account/info/hg` 完整 JSON）、森空岛扫码。三者都直接得到完整的 `{ cred, token }`；**只贴 cred 不再支持**，请改用官网 Token 或扫码。
- **一次凭证、两个游戏**：绑定列表 `player/binding` 只请求一次，响应同时含明日方舟与终末地，按游戏勾选分别导入；未勾选的游戏不拉取、不上传。
- **凭证只在内存**：不写入 localStorage，刷新即失效；凭证过期（`10000`/`10002`）只提示重新获取，不做自动续期。
- **失败不重试**：任一步失败不会自动重试，页面也没有重试按钮；失败的游戏、阶段、错误码与后端原始原因统一列在页面底部。
- **写入使用正式会话**：上传与账号查询一律携带正式登录 token；仅有 OAuth 授权流程的临时会话时按未登录处理，不产生任何写入。
- **终末地账号信息**：上传请求同时携带所选角色的 `serverId`、`serverType`、`serverName` 和 `nickName`（取自森空岛角色的 `nickname`）；缺失的展示信息传空字符串。
- **明日方舟账号信息**：上传请求的 `playerInfo` 同时携带所选绑定账号的 `channelName`、`channelMasterId` 和 `nickName`；渠道标识统一传字符串，缺失的展示信息传空字符串。
- 导入完成后的数据维护（手动编辑、草稿上传、云端档案查看）在对应游戏数据页进行，本页只负责导入。

### PAT 游戏数据读取

- `/projects` 签发的终末地 PAT 在 payload 中保存 `game_uid`（角色 ID）、`server_id`（服务器 ID）、`game_name` 和 `source`；令牌按游戏、角色与服务器匹配到账号卡片。
- 读取测试页分别调用 `GET /pat/ak-accounts/operators` 和 `GET /pat/ef-accounts/player-data`，仅发送填写的 PAT，不读取站内会话或携带 Cookie。
- 终末地新令牌需要 `endfield-data.read`，省略服务器按空串精确定位。此前未包含服务器的令牌若与实际绑定不符，请在对应服务器账号下重新生成；迁移旧令牌仍默认读取当前用户最新保存的数据。
