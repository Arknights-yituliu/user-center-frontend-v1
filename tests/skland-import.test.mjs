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
      const path = new URL(url).pathname
      if (path === '/api/v1/game/player/info') {
        if (options.detailError) throw options.detailError
        return sklandOk(options.playerDetails ?? {})
      }
      if (path === '/api/v1/game/cultivate/player') {
        if (options.warehouseError) throw options.warehouseError
        return sklandOk({ characters: options.characters ?? [{ id: 'char_002_amiya' }] })
      }
      return nextResponse()
    },
    isAxiosError: () => false,
  }

  // 与真实 tclRequest 一致：成功解包 {code:200,data}，业务失败 throw 响应体
  const tclRequest = async (config) => {
    calls.push({ kind: 'tcl', url: config.url, config })
    const body = config.url === '/user/ak-accounts/operators/save' && options.akSaveResponse
      ? options.akSaveResponse
      : nextResponse()
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

  const akUtils = loadModule('../src/utils/skland.ts', {
    './operator-table': { loadOperatorStaticData: async () => ({}), getOperatorEntry: () => undefined },
    '../api/skland-core': core,
  })

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
  assert.equal(calls.length, 1)
  assert.equal(binding.akTargets.value.length, 1)
  assert.equal(binding.efTargets.value.length, 2)
  assert.equal(binding.selectedAkKey.value, binding.akTargets.value[0].key)
  assert.equal(binding.selectedEf.value.roleId, '42')
  // 绑定列表保留 uid，实际导入时才解析账号级 userId
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
  // 此处保留绑定项 uid，供账号级 userId 不可用时回退
  assert.equal(target.userId, 'acct')
})

test('Arknights uploads the selected binding profile inside playerInfo with string channel IDs', async () => {
  for (const profile of [
    { nickName: '所选刀客塔', channelName: 'B服', channelMasterId: '2' },
    { nickName: '官服刀客塔', channelName: '官服', channelMasterId: 1 },
    { nickName: '', channelName: '', channelMasterId: 0 },
    { nickName: '', channelName: '', channelMasterId: '' },
    { nickName: undefined, channelName: undefined, channelMasterId: undefined },
  ]) {
    const { binding, importer, responses, calls } = setup({
      playerDetails: { skins: [{ id: 'skin#1', ts: 123 }], status: { level: 96 }, currentTs: 234 },
    })
    responses.push(
      sklandOk(bindingPayload({ ak: [akEntry(), akEntry({ uid: '1002', ...profile })] })),
      tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }),
    )

    await binding.load(credential)
    binding.select('arknights', binding.akTargets.value[1].key)
    await importer.run(credential, binding.selectedTargets())

    assert.equal(importer.results.value[0].ok, true)
    const uploads = tclCalls(calls)
    assert.equal(uploads.length, 1)
    assert.equal(uploads[0].url, '/user/ak-accounts/operators/save')
    for (const path of ['/api/v1/game/cultivate/player', '/api/v1/game/player/info']) {
      const reads = sklandCalls(calls).filter((call) => new URL(call.url).pathname === path)
      assert.equal(reads.length, 1)
      assert.equal(new URL(reads[0].url).searchParams.get('uid'), '1002')
      assert.equal(reads[0].config.headers.cred, credential.cred)
    }
    assert.equal(uploads[0].config.token, 'formal-session')
    const data = JSON.parse(JSON.stringify(uploads[0].config.data))
    assert.deepEqual(data.playerInfo, {
      akUid: '1002',
      channelName: profile.channelName ?? '',
      channelMasterId: String(profile.channelMasterId ?? ''),
      nickName: profile.nickName ?? '',
    })
    assert.deepEqual(data.operators.map((operator) => operator.id), ['char_002_amiya'])
    assert.deepEqual(data.skins, [{ skinId: 'skin#1', gainTs: 123 }])
    assert.deepEqual(JSON.parse(data.playerData), { status: { level: 96 }, currentTs: 234 })
  }
})

async function runAkImport(options) {
  const { importer, calls } = setup({
    ...options,
    akSaveResponse: tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }),
  })
  await importer.run(credential, [{ game: 'arknights', akUid: '1001', nickname: '刀客塔',
    serverName: '官服', channelMasterId: '1' }])
  const uploads = tclCalls(calls)
  const result = importer.results.value[0]
  assert.equal(uploads.length, result.ok ? 1 : 0)
  return { result, data: uploads[0]?.config.data }
}

test('skins accept raw, normalized and keyed records and keep the first occurrence', async () => {
  const expected = [{ skinId: 'A@x#1', gainTs: 123 }, { skinId: 'a@x#1', gainTs: 0 }]
  for (const skins of [
    [{ id: ' A@x#1 ', ts: '123' }, { skinId: 'A@x#1', gainTs: 456 }, { id: 'a@x#1' }],
    { 'A@x#1': { ts: 123 }, 'a@x#1': { gainTs: 2_147_483_648 } },
    [{ skinId: 'A@x#1', gainTs: 123 }, { skinId: 'a@x#1', gainTs: -1 }],
  ]) {
    const { result, data } = await runAkImport({ playerDetails: { skins, currentTs: 99 } })
    assert.equal(result.ok, true)
    assert.deepEqual(JSON.parse(JSON.stringify(data.skins)), expected)
    assert.equal('playerData' in data, false)
    assert.match(result.summary, /跳过角色快照/)
  }
})

test('incomplete skin collections are omitted while all allowlisted snapshot fields survive', async () => {
  const snapshot = {
    status: { level: 1 }, medal: {}, activity: [], rogue: {}, sandbox: {},
    campaign: {}, tower: {}, bossRush: {}, building: {}, assistChars: [],
    recruit: [], routine: { progress: 0 }, currentTs: 0,
  }
  for (const skins of [undefined, [], {}, [null], [{ id: 'owned' }, {}],
    [{ id: 'has space' }], [{ id: 'x'.repeat(129) }]]) {
    const { data, result } = await runAkImport({ playerDetails: {
      ...snapshot, skins, chars: [], skinInfoMap: { a: 1 }, charInfoMap: {}, extra: true,
    } })
    assert.equal('skins' in data, false)
    assert.deepEqual(JSON.parse(data.playerData), snapshot)
    assert.match(result.summary, /跳过皮肤/)
  }
})

test('snapshot limit counts serialized characters and never prevents a complete skin upload', async () => {
  const overhead = JSON.stringify({ status: '' }).length
  for (const length of [2_000_000, 2_000_001]) {
    const { data } = await runAkImport({ playerDetails: {
      status: '字'.repeat(length - overhead), skins: [{ id: 'skin#1' }],
    } })
    assert.equal(data.skins.length, 1)
    if (length === 2_000_000) assert.equal(data.playerData.length, length)
    else assert.equal('playerData' in data, false)
  }
})

test('player detail failure preserves operators while missing operator data blocks the write', async () => {
  const { result, data } = await runAkImport({ detailError: new Error('detail unavailable') })
  assert.equal(result.ok, true)
  assert.match(result.summary, /跳过皮肤和角色快照/)
  assert.deepEqual(Object.keys(data).sort(), ['operators', 'playerInfo'])
  for (const options of [{ warehouseError: new Error('warehouse unavailable') }, { characters: [] }]) {
    const failed = await runAkImport({ ...options, playerDetails: { skins: [{ id: 'a' }], status: {} } })
    assert.equal(failed.result.ok, false)
    assert.equal(failed.result.error.stage, 'fetch')
  }
})

test('Endfield uploads the selected role profile and keeps missing or empty metadata as empty strings', async () => {
  for (const profile of [
    { nickname: '所选管理员', serverType: 'official', serverName: '官服' },
    { nickname: '', serverType: '', serverName: '' },
    { nickname: undefined, serverType: undefined, serverName: undefined },
  ]) {
    const { binding, importer, responses, calls } = setup()
    const detail = { base: { roleId: '43', name: '卡片名称' }, futureField: { keep: true } }
    responses.push(
      sklandOk(bindingPayload({ ef: [{ uid: 'acct', roles: [
        efRole({ serverType: 'other', serverName: '其他服' }),
        efRole({ roleId: '43', serverId: '2', ...profile }),
      ] }] })),
      sklandOk({ teenager: { userId: 'account-user' } }),
      sklandOk({ detail }),
      tclOk({ roleId: '43', serverId: '2', updateTime: 'now' }),
    )

    await binding.load(credential)
    binding.select('endfield', binding.efTargets.value[1].key)
    importer.toggleScope('arknights', false)
    await importer.run(credential, binding.selectedTargets())

    assert.equal(importer.results.value[0].ok, true)
    const uploads = tclCalls(calls)
    assert.equal(uploads.length, 1)
    assert.equal(sklandCalls(calls).some((call) => call.url.includes('/game/player/info')), false)
    assert.deepEqual(JSON.parse(JSON.stringify(uploads[0].config.data)), {
      roleId: '43',
      serverId: '2',
      serverType: profile.serverType ?? '',
      serverName: profile.serverName ?? '',
      nickName: profile.nickname ?? '',
      playerData: detail,
    })
  }
})

test('one side failing does not block the other and never retries', async () => {
  const { importer, responses, calls } = setup({ akSaveResponse: { code: 60002, msg: '外部系统接口调用异常' } })
  responses.push(
    // 终末地成功：账号级 userId + 卡片详情 + 上传
    sklandOk({ teenager: { userId: 'account-user' } }),
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
  assert.deepEqual(sklandCalls(calls).map((call) => new URL(call.url).pathname).sort(), [
    '/api/v1/game/cultivate/player', '/api/v1/game/player/info',
  ])
})

test('uploads use the formal session even when a temporary OAuth token exists', async () => {
  const { importer, calls, responses } = setup({
    tmpToken: 'tmp-session', akSaveResponse: tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }),
  })
  responses.push(
    sklandOk({ teenager: { userId: 'account-user' } }),
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
  const { binding, importer, responses, calls } = setup({
    akSaveResponse: tclOk({ createdCount: 1, updatedCount: 0, unchangedCount: 0 }),
  })
  responses.push(
    sklandOk(bindingPayload({ ak: [akEntry()], ef: [{ uid: 'acct', roles: [efRole()] }] })),
    sklandOk({ teenager: { userId: 'account-user' } }),
    sklandOk({ detail: { base: { roleId: '42' } } }),
    tclOk({ roleId: '42', serverId: '1', updateTime: 'now' }),
  )

  await binding.load(credential)
  await importer.run(credential, binding.selectedTargets())

  assert.ok(importer.results.value.every((result) => result.ok))
  // 绑定、干员、角色详情、账号级 userId、终末地卡片各 1 次。
  const official = sklandCalls(calls)
  assert.equal(official.length, 5)
  assert.ok(official.every((call) => call.config.headers.cred === credential.cred))
  const card = official.find((call) => call.url.includes('/endfield/card/detail'))
  assert.equal(new URL(card.url).searchParams.get('userId'), 'account-user')
  const upload = tclCalls(calls).find((call) => call.url.endsWith('/ef-accounts/player-data/save'))
  assert.equal(upload.config.data.roleId, '42')
  assert.equal(upload.config.data.serverId, '1')
  assert.equal(upload.config.data.playerData.base.roleId, '42')
  assert.equal(
    calls.filter((call) => call.url?.includes('/skland/')).length,
    0,
    '手工凭证不应触发凭证桥接请求',
  )
})
