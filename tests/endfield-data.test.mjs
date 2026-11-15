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
  const axios = { get: transport }
  const shared = loadModule('../src/api/skland-operator-api.ts', {
    axios,
    './BASE_URL': { BACKEND_BASE_URL: 'https://backend.test' },
  })
  const session = { ucRequest: transport, getUcToken: () => 'formal-session' }
  const skland = loadModule('../src/api/skland-endfield-api.ts', {
    axios,
    './skland-operator-api': shared,
    './user-center/request': session,
  })
  const cloud = loadModule('../src/api/user-center/ef-account-api.ts', { './request': session })
  return { requests, responses, shared, skland, cloud }
}

const credential = { cred: 'test-cred', token: 'test-token' }
const ok = (data) => ({ status: 200, data: { code: 0, data } })
const binding = (entries) => ok({ list: [{ appCode: 'endfield', bindingList: entries }] })
const role = { roleId: '42', serverId: '1', userId: 'account', nickname: '管理员' }

test('direct cred refreshes signing token, while credential pairs require no request', async () => {
  const { skland, responses, requests } = setup()
  responses.push(ok({ token: 'refreshed' }))
  assert.equal((await skland.getEndfieldCredential(' cred-only ')).token, 'refreshed')
  assert.equal(requests[0][1].headers.cred, 'cred-only')
  assert.equal((await skland.getEndfieldCredential('cred,token')).cred, 'cred')
  assert.equal(requests.length, 1)
  await assert.rejects(skland.getEndfieldCredential(' '), /请输入/)
})

test('role extraction filters other games and deleted bindings, normalizes and deduplicates IDs', async () => {
  const { skland, responses } = setup()
  responses.push(
    binding([
      {
        uid: 'fallback',
        roles: [
          { roleId: 42, serverId: 1, nickname: '管理员' },
          { roleId: 42, serverId: 1 },
          { roleId: '' },
        ],
      },
      { uid: 'deleted', isDelete: true, roles: [{ roleId: 43, serverId: 1 }] },
    ]),
    ok({ teenager: { userId: 123 } }),
  )
  const result = await skland.getEndfieldRoles(credential)
  assert.equal(result.length, 1)
  assert.equal(result[0].roleId, '42')
  assert.equal(result[0].serverId, '1')
  assert.equal(result[0].userId, '123')
})

test('missing teenager data falls back to the UID of each binding independently', async () => {
  const { skland, responses } = setup()
  responses.push(
    binding([
      { uid: 'account-a', roles: [{ roleId: 42, serverId: 1 }] },
      { uid: 'account-b', roles: [{ roleId: 43, serverId: 1 }] },
    ]),
    new Error('teenager unavailable'),
  )
  const result = await skland.getEndfieldRoles(credential)
  assert.equal(result[0].userId, 'account-a')
  assert.equal(result[1].userId, 'account-b')
})

test('expired credentials abort role lookup instead of silently falling back', async () => {
  const { skland, responses } = setup()
  responses.push(binding([{ uid: 'account', roles: [role] }]), {
    status: 200,
    data: { code: 10002, message: 'expired' },
  })
  await assert.rejects(skland.getEndfieldRoles(credential), skland.isEndfieldCredentialExpired)
})

test('missing or malformed game groups produce an empty role list', async () => {
  const { skland, responses } = setup()
  for (const data of [{ list: [{ appCode: 'arknights' }] }, { list: {} }, null]) {
    responses.push(ok(data))
    assert.equal((await skland.getEndfieldRoles(credential)).length, 0)
  }
})

test('card query and HMAC signature use exactly the same encoded parameter order', async () => {
  const { skland, responses, requests } = setup()
  const detail = { base: { roleId: '42' }, extraFutureField: { keep: true } }
  responses.push(ok({ detail }))
  assert.equal(
    (await skland.getEndfieldCardDetail(credential, { ...role, userId: 'a+b&c' })).extraFutureField
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

test('empty or mismatched card data cannot be imported', async () => {
  const { skland, responses, requests } = setup()
  for (const detail of [undefined, {}, { base: { roleId: 'someone-else' } }]) {
    responses.push(ok({ detail }))
    await assert.rejects(skland.getEndfieldCardDetail(credential, role), /角色|数据/)
  }
  const count = requests.length
  await assert.rejects(
    skland.getEndfieldCardDetail(credential, { ...role, userId: '' }),
    /账号标识/,
  )
  assert.equal(requests.length, count)
})

test('credential and QR bridges use public UC endpoints without session auth', async () => {
  const { skland, responses, requests } = setup()
  responses.push(
    { data: credential },
    { data: { scanId: 'scan', qrContent: 'qr-content' } },
    { data: { status: 101 } },
  )
  await skland.getEndfieldCredentialByOfficialToken('official')
  await skland.createEndfieldQrCode()
  await skland.checkEndfieldQrStatus('a+b')
  assert.equal(requests[0][0].url, '/skland/hg/cred-token')
  assert.equal(requests[0][0].data.token, 'official')
  assert.equal(requests[1][0].url, '/skland/qr/create')
  assert.equal(requests[2][0].url, '/skland/qr/check?scanId=a%2Bb')
  assert.ok(requests.every(([config]) => config.auth === false))
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
