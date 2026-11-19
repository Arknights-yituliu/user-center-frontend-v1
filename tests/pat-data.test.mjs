import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function loadModule(path, imports) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in imports, `Unexpected runtime import: ${name}`)
      return imports[name]
    },
    get localStorage() {
      throw new Error('PAT reads must not access browser sessions')
    },
  })
  return module.exports
}

test('both PAT data endpoints use only the supplied credential and no account query parameters', async () => {
  const requests = []
  const response = { status: 200, data: { code: 200, data: null } }
  const api = loadModule('../src/api/user-center/pat-data-api.ts', {
    axios: {
      get: async (...args) => {
        requests.push(args)
        return response
      },
    },
    '../BASE_URL': { TCL_BASE_URL: 'https://auth.example.test' },
  })
  const controller = new AbortController()
  assert.equal(
    await api.readPatGameData('endfield', ' Bearer tlc_pat_test ', controller.signal),
    response,
  )
  assert.equal(await api.readPatGameData('arknights', 'legacy-pat'), response)
  assert.equal(requests[0][0], 'https://auth.example.test/pat/ef-accounts/player-data')
  assert.equal(requests[1][0], 'https://auth.example.test/pat/ak-accounts/operators')
  assert.equal(requests[0][1].headers.Authorization, 'Bearer tlc_pat_test')
  assert.equal(requests[1][1].headers.Authorization, 'Bearer legacy-pat')
  assert.equal(requests[0][1].signal, controller.signal)
  for (const [, config] of requests) {
    assert.equal(config.withCredentials, false)
    assert.equal(config.timeout, 15000)
    assert.equal(config.validateStatus(401), true)
    assert.equal(config.params, undefined)
  }
  for (const emptyToken of ['', ' ', 'Bearer ']) {
    await assert.rejects(api.readPatGameData('endfield', emptyToken), /请填写 PAT/)
  }
  assert.equal(requests.length, 2)
})

test('PAT reads preserve business errors and HTTP status for the response viewer', async () => {
  const response = { status: 200, data: { code: 80008, msg: '无权限操作', data: null } }
  const api = loadModule('../src/api/user-center/pat-data-api.ts', {
    axios: { get: async () => response },
    '../BASE_URL': { TCL_BASE_URL: 'https://auth.example.test' },
  })
  assert.equal(await api.readPatGameData('endfield', 'pat'), response)
})

test('PAT management sends the new server field without dropping source metadata', async () => {
  const requests = []
  const api = loadModule('../src/api/user-center/pat-api.ts', {
    './request': {
      tclRequest: async (config) => {
        requests.push(config)
        return { code: 200 }
      },
    },
    './client-id': { TCL_CLIENT_ID: 'this_land_cloud' },
  })
  const payload = { game_uid: '42', server_id: '2', game_name: '终末地', source: 'web' }
  await api.issuePat({ name: '终末地', expiresIn: 3600, scope: 'endfield-data.read', payload })
  assert.equal(requests[0].url, '/user/pat')
  assert.equal(requests[0].data.payload, payload)
  assert.equal(requests[0].data.expires_in, 3600)
})
