import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

/**
 * 森空岛导入链路单测：一次 binding 分流 / 预选规则 / 失败隔离 / 勾选 / 正式会话 / 凭证复用
 *
 * 全部模块在 vm 中执行，网络与 Vue 运行时均用确定性替身，不产生真实请求。
 */

function loadModule(path, imports) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(
    source,
    {
      module,
      exports: module.exports,
      URLSearchParams,
      TextEncoder,
      crypto: globalThis.crypto,
      require(name) {
        assert.ok(name in imports, `Unexpected import: ${name}`)
        return imports[name]
      },
    },
    { filename: path },
  )
  return module.exports
}

/** 只实现 composable 用到的 Vue 能力，避免引入真实运行时 */
const vue = {
  ref: (value) => ({ value }),
  reactive: (value) => value,
  computed: (getter) => ({
    get value() {
      return getter()
    },
  }),
  onBeforeUnmount: () => {},
}

function setup(options = {}) {
  /** skland 官方签名请求（axios.get）与 TCL 请求（tclRequest）统一记录 */
  const calls = []
  const responses = []

  const nextResponse = () => {
    assert.ok(responses.length, `Unexpected request: ${calls[calls.length - 1]?.url}`)
    const response = responses.shift()
    if (response instanceof Error) throw response
    return response
  }

  const axios = {
    get: async (url, config) => {
      calls.push({ kind: 'skland', url, config })
      return nextResponse()
    },
    isAxiosError: () => false,
  }

  // 与真实 tclRequest 一致：成功解包 {code:200,data}，业务失败 throw 响应体
  const tclRequest = async (config) => {
    calls.push({ kind: 'tcl', url: config.url, config })
    const body = nextResponse()
    if (!body || body.code !== 200) throw body
    return body
  }

  const request = {
    tclRequest,
    getTclToken: () => options.tclToken ?? 'formal-session',
    getTclTmpToken: () => options.tmpToken ?? '',
    getTclUid: () => 'tcl-uid',
  }

  const types = loadModule('../src/types/skland-import.ts', {})
  const core = loadModule('../src/api/skland-core.ts', {
    axios,
    './user-center/request': request,
  })
  const akApi = loadModule('../src/api/user-center/ak-account-api.ts', { './request': request })
  const efApi = loadModule('../src/api/user-center/ef-account-api.ts', { './request': request })
  const efSklandApi = loadModule('../src/api/skland-endfield-api.ts', { './skland-core': core })

  const warehouse = { playerInfo: { akUid: '1001' }, operators: [{ id: 'char_002_amiya' }], itemList: [] }
  const akUtils = {
    getWarehouseInfo: async (akUid) => {
      if (options.warehouseError) throw options.warehouseError
      return { ...warehouse, playerInfo: { akUid } }
    },
  }

  const akAdapter = loadModule('../src/api/skland-ak-adapter.ts', {
    './skland-core': core,
    './user-center/ak-account-api': akApi,
    '../utils/skland': akUtils,
    '../types/skland-import': types,
  })
  const efAdapter = loadModule('../src/api/skland-ef-adapter.ts', {
    './skland-core': core,
    './skland-endfield-api': efSklandApi,
    './user-center/ef-account-api': efApi,
    '../types/skland-import': types,
  })

  const binding = loadModule('../src/composables/useSklandBinding.ts', {
    vue,
    '../api/skland-core': core,
    '../api/skland-ak-adapter': akAdapter,
    '../api/skland-ef-adapter': efAdapter,
    '../types/skland-import': types,
  }).useSklandBinding()
  const importer = loadModule('../src/composables/useSklandImport.ts', {
    vue,
    '../api/user-center/request': request,
    '../api/skland-core': core,
    '../api/skland-ak-adapter': akAdapter,
    '../api/skland-ef-adapter': efAdapter,
    '../types/skland-import': types,
  }).useSklandImport()

  return { calls, responses, core, types, akAdapter, efAdapter, binding, importer }
}

const credential = { cred: 'test-cred', token: 'test-token' }
const sklandOk = (data) => ({ status: 200, data: { code: 0, data } })
const tclOk = (data) => ({ code: 200, data })
const akEntry = (over = {}) => ({
  uid: '1001',
  nickName: '刀客塔',
  channelName: '官服',
  channelMasterId: 1,
  isOfficial: true,
  ...over,
})
const efRole = (over = {}) => ({ roleId: '42', serverId: '1', nickname: '管理员', ...over })
const bindingPayload = ({ ak = [], ef = [], app = {} } = {}) => ({
  list: [
    { appCode: 'arknights', bindingList: ak },
    { appCode: 'endfield', bindingList: ef, ...app },
  ],
})
const sklandCalls = (calls) => calls.filter((call) => call.kind === 'skland')
const tclCalls = (calls) => calls.filter((call) => call.kind === 'tcl')

test('a single binding request fans out to both games and preselects defaults', async () => {
  const { binding, responses, calls } = setup()
  responses.push(
    sklandOk(
      bindingPayload({
        ak: [akEntry()],
        ef: [{ uid: 'acct', roles: [efRole({ isDefault: true }), efRole({ roleId: '43' })] }],
      }),
    ),
  )

  await binding.load(credential)

  const official = sklandCalls(calls).filter((call) => call.url.includes('/game/player/binding'))
  assert.equal(official.length, 1, '绑定接口只应请求一次')
  assert.equal(binding.akTargets.value.length, 1)
  assert.equal(binding.efTargets.value.length, 2)
  assert.equal(binding.selectedAkKey.value, binding.akTargets.value[0].key)
  assert.equal(binding.selectedEf.value.roleId, '42')
  // userId 直接取绑定项 uid，不再额外请求 user/teenager
  assert.equal(binding.efTargets.value[0].userId, 'acct')
})

test('preselection never falls back to the first item', async () => {
  const cases = [
    { name: '唯一候选', ak: [akEntry({ isOfficial: false })], expect: 0 },
    { name: '唯一默认', ak: [akEntry({ isOfficial: false }), akEntry({ uid: '1002' })], expect: 1 },
    {
      name: '多个默认',
      ak: [akEntry(), akEntry({ uid: '1002' })],
      expect: -1,
    },
    { name: '无默认', ak: [akEntry({ isOfficial: false }), akEntry({ uid: '1002', isOfficial: false })], expect: -1 },
  ]

  for (const scenario of cases) {
    const { binding, responses } = setup()
    responses.push(sklandOk(bindingPayload({ ak: scenario.ak })))
    await binding.load(credential)

    const selected = binding.selectedAkKey.value
    if (scenario.expect === -1) {
      assert.equal(selected, '', `${scenario.name}：不应自动选中任何账号`)
    } else {
      assert.equal(selected, binding.akTargets.value[scenario.expect].key, scenario.name)
    }
  }
})

test('endfield targets drop deleted bindings, normalize IDs and deduplicate roles', async () => {
  const { binding, responses } = setup()
  responses.push(
    sklandOk(
      bindingPayload({
        ef: [
          {
            uid: 'acct',
            roles: [
              { roleId: 42, serverId: 1, nickname: '管理员' },
              { roleId: 42, serverId: 1 },
              { roleId: '' },
            ],
          },
          { uid: 'gone', isDelete: true, roles: [{ roleId: 43, serverId: 1 }] },
        ],
      }),
    ),
  )

  await binding.load(credential)

  assert.equal(binding.efTargets.value.length, 1)
  const target = binding.efTargets.value[0]
  assert.equal(target.roleId, '42')
  assert.equal(target.serverId, '1')
  assert.equal(target.nickname, '管理员')
  // userId 来自绑定项 uid；绑定项没有 uid 时留空，card/detail 会省略该参数
  assert.equal(target.userId, 'acct')
})

test('one side failing does not block the other and never retries', async () => {
  const { importer, responses, calls } = setup()
  responses.push(
    // 明日方舟上传失败
    { code: 60002, msg: '外部系统接口调用异常' },
    // 终末地成功：卡片详情 + 上传
    sklandOk({ detail: { base: { roleId: '42' } } }),
    tclOk({ roleId: '42', serverId: '1', updateTime: 'now' }),
  )

  const akTarget = { game: 'arknights', key: 'arknights:1001', akUid: '1001', nickname: '刀客塔', serverName: '官服', isDefault: true }
  const efTarget = { game: 'endfield', key: 'endfield:1:42', roleId: '42', serverId: '1', userId: '123', nickname: '管理员', serverName: '官服', isDefault: false }

  await importer.run(credential, [akTarget, efTarget])

  assert.equal(importer.results.value.length, 2)
  const ak = importer.results.value.find((item) => item.game === 'arknights')
  const ef = importer.results.value.find((item) => item.game === 'endfield')
  assert.equal(ak.ok, false)
  assert.equal(ak.error.stage, 'upload')
  assert.equal(ak.error.code, 60002)
  assert.equal(ef.ok, true)

  // 失败后不得有任何重试：请求数到此为止
  const total = calls.length
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(calls.length, total)
})

test('unchecked games produce neither fetch nor upload requests', async () => {
  const { importer, calls, responses } = setup()
  responses.push(tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }))
  importer.scope.endfield = false

  const akTarget = { game: 'arknights', key: 'arknights:1001', akUid: '1001', nickname: '刀客塔', serverName: '官服', isDefault: true }
  const efTarget = { game: 'endfield', key: 'endfield:1:42', roleId: '42', serverId: '1', userId: '123', nickname: '管理员', serverName: '官服', isDefault: false }

  await importer.run(credential, [akTarget, efTarget])

  assert.equal(
    importer.results.value.map((item) => item.game).join(','),
    'arknights',
  )
  assert.equal(tclCalls(calls).length, 1)
  assert.equal(sklandCalls(calls).length, 0, '未勾选的终末地不应拉取卡片详情')
})

test('uploads use the formal session even when a temporary OAuth token exists', async () => {
  const { importer, calls, responses } = setup({ tmpToken: 'tmp-session' })
  responses.push(
    tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }),
    sklandOk({ detail: { base: { roleId: '42' } } }),
    tclOk({ roleId: '42', serverId: '1', updateTime: 'now' }),
  )

  const akTarget = { game: 'arknights', key: 'arknights:1001', akUid: '1001', nickname: '刀客塔', serverName: '官服', isDefault: true }
  const efTarget = { game: 'endfield', key: 'endfield:1:42', roleId: '42', serverId: '1', userId: '123', nickname: '管理员', serverName: '官服', isDefault: false }

  await importer.run(credential, [akTarget, efTarget])

  const uploads = tclCalls(calls)
  assert.equal(uploads.length, 2)
  assert.ok(uploads.every((call) => call.config.token === 'formal-session'))
})

test('without a formal session nothing is written to the cloud', async () => {
  const { importer, calls } = setup({ tclToken: '' })
  const akTarget = { game: 'arknights', key: 'arknights:1001', akUid: '1001', nickname: '刀客塔', serverName: '官服', isDefault: true }

  await importer.run(credential, [akTarget])

  assert.equal(importer.sessionError.value, '请先登录酸橙云账号后再导入')
  assert.equal(calls.length, 0)
})

test('the same credential object is reused by both adapters without re-parsing', async () => {
  const { binding, importer, responses, calls } = setup()
  responses.push(
    sklandOk(bindingPayload({ ak: [akEntry()], ef: [{ uid: 'acct', roles: [efRole()] }] })),
    tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }),
    sklandOk({ detail: { base: { roleId: '42' } } }),
    tclOk({ roleId: '42', serverId: '1', updateTime: 'now' }),
  )

  await binding.load(credential)
  await importer.run(credential, binding.selectedTargets())

  // 绑定 1 次 + 卡片详情 1 次，没有任何重复的凭证桥接与多余的 user/teenager
  assert.equal(sklandCalls(calls).length, 2)
  assert.equal(
    calls.filter((call) => call.url?.includes('/skland/')).length,
    0,
    '手工凭证不应触发凭证桥接请求',
  )
})
