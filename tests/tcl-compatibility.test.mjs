import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

// Execute real request/page code with in-memory storage and transports only.
function setupRequest() {
  const storage = new Map([
    ['UC_TOKEN', 'existing-session'],
    ['UC_UID', '42'],
    ['UC_TMP_TOKEN', 'existing-oauth-session'],
    ['uc-theme-mode', 'dark'],
  ])
  const calls = []
  const axios = async (config) => {
    calls.push(config)
    return { data: { code: 200, msg: 'ok', data: null } }
  }
  const imports = {
    axios,
    '../../utils/message': { createMessage: assert.fail },
    '../BASE_URL': { TCL_BASE_URL: 'https://auth.example.test' },
    './client-id': { TCL_CLIENT_ID: 'this_land_cloud' },
  }
  const module = { exports: {} }
  const source = readFileSync(new URL('../src/api/user-center/request.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`)
      return imports[name]
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  })
  return { api: module.exports, storage, calls }
}

test('TCL helpers read and update existing browser sessions without changing storage keys', () => {
  const { api, storage } = setupRequest()
  assert.equal(api.getTclToken(), 'existing-session')
  assert.equal(api.getTclUid(), '42')
  assert.equal(api.getTclTmpToken(), 'existing-oauth-session')
  api.setTclSession('new-session', 99)
  api.setTclTmpToken('new-oauth-session')
  assert.equal(storage.get('UC_TOKEN'), 'new-session')
  assert.equal(storage.get('UC_UID'), '99')
  assert.equal(storage.get('UC_TMP_TOKEN'), 'new-oauth-session')
  assert.equal(storage.size, 4)
  api.clearTclTmpToken()
  assert.equal(api.getTclToken(), 'new-session')
  assert.equal(api.getTclTmpToken(), '')
  api.clearTclSession()
  assert.equal(api.getTclToken(), '')
  assert.equal(api.getTclUid(), '')
  assert.equal(storage.size, 1)
  assert.equal(storage.get('uc-theme-mode'), 'dark')
})

test('requests send TCL client header with unchanged client ID and Bearer priority', async () => {
  const { api, calls } = setupRequest()
  await api.tclRequest({ url: '/oauth2/ticket', token: 'explicit-session' })
  await api.tclRequest({ url: '/oauth2/ticket' })
  api.clearTclTmpToken()
  await api.tclRequest({ url: '/user/profile' })
  await api.tclRequest({ url: '/auth/login', auth: false })
  assert.deepEqual(calls.map((call) => call.headers.Authorization), [
    'Bearer explicit-session', 'Bearer existing-oauth-session', 'Bearer existing-session', undefined,
  ])
  for (const call of calls) {
    assert.equal(call.headers['TCL-Client-Id'], 'this_land_cloud')
    assert.equal(call.headers['UC-Client-Id'], undefined)
    assert.equal(call.baseURL, 'https://auth.example.test')
    assert.equal(call.withCredentials, true)
  }
})

for (const folder of ['pages', 'classic-pages']) {
  for (const page of ['login', 'oauth-login', 'register']) {
    test(`${folder}/${page} replaces stale tickets while preserving OAuth parameters`, async () => {
      const filename = `../src/${folder}/account/${page}.vue`
      const source = readFileSync(new URL(filename, import.meta.url), 'utf8')
      const { descriptor, errors } = parse(source)
      assert.equal(errors.length, 0)
      const script = ts.createSourceFile(filename, descriptor.scriptSetup.content, ts.ScriptTarget.Latest)
      const redirect = script.statements.find(
        (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'redirectIfOAuth',
      )
      assert.ok(redirect, 'OAuth redirect function must exist')
      const requests = []
      const destinations = []
      const messages = []
      const getTicket = async (token) => {
        requests.push(token)
        return { data: { ticket: 'fresh-ticket' } }
      }
      const context = vm.createContext({
        URL,
        oauthRedirect: { value: 'https://auth.example.test/oauth2/authorize?client_id=existing-app&redirect_uri=https%3A%2F%2Fapp.example.test%2Fcallback&state=keep-state&code_challenge=keep-pkce&uc_ticket=old&uc_ticket=older&tcl_ticket=stale' },
        sessionToken: 'memory-session',
        getTclToken: () => 'existing-session',
        getOAuthTicket: getTicket,
        tclRequest: async (config) => {
          assert.equal(config.url, '/oauth2/ticket')
          return getTicket(config.token)
        },
        createMessage: (message) => messages.push(message),
        window: { location: { replace: (url) => destinations.push(url) } },
      })
      vm.runInContext(redirect.getText(script), context)
      await context.redirectIfOAuth('registration-session')
      assert.equal(requests.length, 1)
      assert.equal(requests[0], page === 'register' ? 'registration-session' : page === 'oauth-login' ? 'memory-session' : undefined)
      assert.equal(destinations.length, 1)
      const target = new URL(destinations[0])
      assert.equal(target.pathname, '/oauth2/authorize')
      assert.equal(target.searchParams.has('uc_ticket'), false)
      assert.deepEqual(target.searchParams.getAll('tcl_ticket'), ['fresh-ticket'])
      assert.equal(target.searchParams.get('client_id'), 'existing-app')
      assert.equal(target.searchParams.get('redirect_uri'), 'https://app.example.test/callback')
      assert.equal(target.searchParams.get('state'), 'keep-state')
      assert.equal(target.searchParams.get('code_challenge'), 'keep-pkce')
      assert.equal(messages.at(-1).type, 'success')
    })
  }
}
