import assert from 'node:assert/strict'
import { createHash, createHmac, webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the real API modules with deterministic transports; no credentials or live requests.
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
      crypto: webcrypto,
      require(name) {
        assert.ok(name in imports, `Unexpected import: ${name}`)
        return imports[name]
      },
    },
    { filename: path },
  )
  return module.exports
}

function setup() {
  const requests = []
  const responses = []
  const transport = async (...args) => {
    requests.push(args)
    assert.ok(responses.length, 'Unexpected request')
    const response = responses.shift()
    if (response instanceof Error) throw response
    return response
  }
  const axios = { get: transport, isAxiosError: () => false }
  const session = { ucRequest: transport, getUcToken: () => 'formal-session' }
  const core = loadModule('../src/api/skland-core.ts', { axios, './user-center/request': session })
  const endfield = loadModule('../src/api/skland-endfield-api.ts', { './skland-core': core })
  const cloud = loadModule('../src/api/user-center/ef-account-api.ts', { './request': session })
  return { requests, responses, core, endfield, cloud }
}

const credential = { cred: 'test-cred', token: 'test-token' }
const ok = (data) => ({ status: 200, data: { code: 0, data } })
const bridgeOk = (data) => ({ code: 200, data })
const role = { roleId: '42', serverId: '1', userId: 'account', nickname: '管理员' }

test('credential input must be a cred,token pair and never touches the network', async () => {
  const { core, requests } = setup()
  const pair = core.resolveCredential(' test-cred , test-token ')
  assert.equal(pair.cred, credential.cred)
  assert.equal(pair.token, credential.token)
  assert.throws(() => core.resolveCredential('cred-only'), /cred,token/)
  assert.throws(() => core.resolveCredential(' '), /cred,token/)
  // 砍掉单 cred 入口后，凭证解析是纯函数，不再发起 /auth/refresh 之类的请求
  assert.equal(requests.length, 0)
})

test('bridge and official endpoints judge success by different codes', async () => {
  const { core, endfield, responses } = setup()

  // 桥接（UC 体系）要求 code === 200：返回森空岛体系的 0 必须判为失败
  responses.push({ code: 0, data: credential })
  await assert.rejects(
    core.getSklandCredentialByOfficialToken('official'),
    (error) => error instanceof core.SklandRequestError && error.code === 0,
  )

  // 官方签名接口要求 code === 0：返回 UC 体系的 200 必须判为失败
  responses.push({ status: 200, data: { code: 200, data: { detail: { base: { roleId: '42' } } } } })
  await assert.rejects(
    endfield.getEndfieldCardDetail(credential, role),
    (error) => error instanceof core.SklandRequestError && error.code === 200,
  )
})

test('credential and QR bridges use public UC endpoints without session auth', async () => {
  const { core, responses, requests } = setup()
  responses.push(
    bridgeOk(credential),
    bridgeOk({ scanId: 'scan', qrContent: 'qr-content' }),
    bridgeOk({ status: 101 }),
  )
  await core.getSklandCredentialByOfficialToken('official')
  await core.createSklandQrCode()
  await core.checkSklandQrStatus('a+b')
  assert.equal(requests[0][0].url, '/skland/hg/cred-token')
  assert.equal(requests[0][0].data.token, 'official')
  assert.equal(requests[1][0].url, '/skland/qr/create')
  assert.equal(requests[2][0].url, '/skland/qr/check?scanId=a%2Bb')
  // auth: false 表示桥接不携带会话；silent: true 表示失败不弹全局气泡，由页面自行展示
  assert.ok(requests.every(([config]) => config.auth === false))
  assert.ok(requests.every(([config]) => config.silent === true))
})

test('card query and HMAC signature use exactly the same encoded parameter order', async () => {
  const { endfield, responses, requests } = setup()
  const detail = { base: { roleId: '42' }, extraFutureField: { keep: true } }
  responses.push(ok({ detail }))
  assert.equal(
    (await endfield.getEndfieldCardDetail(credential, { ...role, userId: 'a+b&c' })).extraFutureField
      .keep,
    true,
  )
  const [url, { headers }] = requests[0]
  const path = '/web/v1/game/endfield/card/detail'
  const query = 'roleId=42&serverId=1&userId=a%2Bb%26c'
  assert.equal(new URL(url).search.slice(1), query)
  const { platform, timestamp, dId, vName } = headers
  const message = `${path}${query}${timestamp}${JSON.stringify({ platform, timestamp, dId, vName })}`
  const hmac = createHmac('sha256', credential.token).update(message).digest('hex')
  assert.equal(headers.sign, createHash('md5').update(hmac).digest('hex'))
  assert.equal(headers.cred, credential.cred)
})

test('card detail omits userId when it is unavailable and sends it when present', async () => {
  const { endfield, responses, requests } = setup()
  responses.push(ok({ detail: { base: { roleId: '42' } } }))
  await endfield.getEndfieldCardDetail(credential, {
    roleId: '42',
    serverId: '1',
    nickname: '管理员',
  })
  assert.equal(new URL(requests[0][0]).search.slice(1), 'roleId=42&serverId=1')

  responses.push(ok({ detail: { base: { roleId: '42' } } }))
  await endfield.getEndfieldCardDetail(credential, {
    roleId: '42',
    serverId: '1',
    nickname: '管理员',
    userId: 'account',
  })
  assert.equal(new URL(requests[1][0]).search.slice(1), 'roleId=42&serverId=1&userId=account')
})

test('empty or mismatched card data cannot be imported', async () => {
  const { endfield, responses, requests } = setup()
  for (const detail of [undefined, {}, { base: { roleId: 'someone-else' } }]) {
    responses.push(ok({ detail }))
    await assert.rejects(endfield.getEndfieldCardDetail(credential, role), /角色|数据/)
  }
  assert.equal(requests.length, 3)
})

test('cloud upload preserves complete player data and uses the formal UC session', async () => {
  const { cloud, responses, requests } = setup()
  const playerData = { base: { roleId: '42' }, chars: [], extraFutureField: { keep: true } }
  responses.push(
    { data: [] },
    { data: null },
    { data: { roleId: '42', serverId: '1', updateTime: 'now' } },
  )
  await cloud.listEfAccounts()
  assert.equal(await cloud.getEfPlayerData('42+a', '1&b'), null)
  await cloud.saveEfPlayerData({ roleId: '42', serverId: '1', playerData })
  assert.equal(requests[0][0].url, '/user/ef-accounts')
  assert.equal(requests[1][0].url, '/user/ef-accounts/player-data?roleId=42%2Ba&serverId=1%26b')
  assert.equal(requests[2][0].url, '/user/ef-accounts/player-data/save')
  assert.equal(requests[2][0].data.playerData, playerData)
  assert.ok(requests.every(([config]) => config.token === 'formal-session'))
})
