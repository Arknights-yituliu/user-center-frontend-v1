import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

// Exercise real page logic with deterministic PAT records, without network or Vue setup effects.
function loadPageLogic(page, names, globals = {}) {
  const filename = `../src/pages/${page}.vue`
  const { descriptor, errors } = parse(readFileSync(new URL(filename, import.meta.url), 'utf8'))
  assert.equal(errors.length, 0)
  const script = ts.createSourceFile(
    filename,
    descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
  )
  const selected = script.statements.filter((node) => {
    if (ts.isFunctionDeclaration(node)) return names.includes(node.name?.text)
    return (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some((declaration) =>
        names.includes(declaration.name.getText(script)),
      )
    )
  })
  assert.equal(selected.length, names.length)
  const source =
    selected.map((node) => node.getText(script)).join('\n') + `\nexport { ${names.join(', ')} }`
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, { module, exports: module.exports, ...globals })
  return module.exports
}

const projects = loadPageLogic('ProjectsView', [
  'commonDataProjects',
  'commonTokenScopes',
  'splitScopes',
  'coversScope',
  'inferProject',
  'matchesPatAccount',
  'buildPayload',
  'toConnections',
  'scopeLabels',
  'scopeLabel',
])

test('renamed scopes preserve parent coverage and isolate games and read/write access', () => {
  for (const game of ['arknights', 'endfield']) {
    for (const action of ['read', 'write']) {
      const scope = `${game}-data.${action}`
      assert.equal(projects.coversScope(scope, scope), true)
      assert.equal(projects.coversScope(` user.read, gama-data.${action} `, scope), true)
      assert.equal(projects.coversScope('all', scope), true)
      const otherGame = game === 'arknights' ? 'endfield' : 'arknights'
      assert.equal(projects.coversScope(`${otherGame}-data.${action}`, scope), false)
      const otherAction = action === 'read' ? 'write' : 'read'
      assert.equal(projects.coversScope(`${game}-data.${otherAction}`, scope), false)
      assert.equal(projects.coversScope(`gama-data.${otherAction}`, scope), false)
    }
  }
})

test('PATs with renamed scopes map to the correct game, connection and readable label', () => {
  for (const game of ['arknights', 'endfield']) {
    const project = projects.inferProject({ scope: `${game}-data.write` })
    assert.equal(project.id, game)
    const records = [
      { id: 1, scope: `${game}-data.read`, expiresInSeconds: 60 },
      { id: 2, scope: `${game}-data.write`, expiresInSeconds: 60 },
    ]
    const connections = projects.toConnections(project, records)
    assert.equal(connections.length, 2)
    assert.equal(connections[0].scope, 'read')
    assert.equal(connections[0].scopeCode, `${game}-data.read`)
    assert.equal(connections[1].scope, 'write')
    assert.equal(connections[1].scopeCode, `${game}-data.write`)
    assert.match(projects.scopeLabel(records[0].scope), /数据（读）/)
    assert.match(projects.scopeLabel(records[1].scope), /数据（写）/)
    const inherited = projects.toConnections(project, [
      { id: 3, scope: 'gama-data.read', expiresInSeconds: 60 },
    ])
    assert.equal(inherited.length, 1)
    assert.equal(inherited[0].scopeCode, `${game}-data.read`)
  }
})

test('game data page selects new game scopes and inherited scopes for the active account', () => {
  const pats = {
    value: [
      { id: 1, scope: 'endfield-data.read', expiresInSeconds: 60, payload: { game_uid: '42' } },
      { id: 2, scope: 'arknights-data.read', expiresInSeconds: 0, payload: { game_uid: '42' } },
      { id: 3, scope: 'arknights-data.read', expiresInSeconds: 60, payload: { game_uid: 'other' } },
      { id: 4, scope: 'arknights-data.read', expiresInSeconds: 60, payload: { game_uid: '42' } },
      { id: 5, scope: 'gama-data.write', expiresInSeconds: 60, payload: { game_uid: '42' } },
    ],
  }
  const gameData = loadPageLogic(
    'GameDataView',
    ['gameDataTokenScopes', 'coversGameDataScope', 'findActiveGameDataToken'],
    {
      pats,
      activeSource: { value: 'skland' },
      activeAkUid: { value: '42' },
      getTclUid: () => 'user-uid',
    },
  )
  assert.equal(gameData.findActiveGameDataToken(gameData.gameDataTokenScopes.read).id, 4)
  assert.equal(gameData.findActiveGameDataToken(gameData.gameDataTokenScopes.write).id, 5)
  pats.value = [
    { id: 6, scope: 'gama-data.read', expiresInSeconds: 60, payload: { game_uid: '42' } },
  ]
  assert.equal(gameData.findActiveGameDataToken(gameData.gameDataTokenScopes.read).id, 6)
  assert.equal(gameData.findActiveGameDataToken(gameData.gameDataTokenScopes.write), undefined)
})

test('PAT account matching separates games and exact Endfield servers', () => {
  const efProject = projects.inferProject({ scope: 'endfield-data.read' })
  const akProject = projects.inferProject({ scope: 'arknights-data.read' })
  const account = { gameUid: '42', serverId: '1', project: efProject, source: 'skland' }
  const pat = {
    scope: 'endfield-data.read',
    payload: { game_uid: ' 42 ', server_id: ' 1 ' },
  }
  assert.equal(projects.matchesPatAccount(pat, account), true)
  assert.equal(projects.matchesPatAccount(pat, { ...account, serverId: '2' }), false)
  assert.equal(projects.matchesPatAccount(pat, { ...account, gameUid: '43' }), false)
  assert.equal(projects.matchesPatAccount(pat, { ...account, project: akProject }), false)
  assert.equal(projects.matchesPatAccount({ ...pat, payload: { game_uid: '42' } }, account), false)
  assert.equal(
    projects.matchesPatAccount(
      { ...pat, payload: { game_uid: '42', server_id: ' ' } },
      { ...account, serverId: '' },
    ),
    true,
  )
  assert.equal(projects.matchesPatAccount({ scope: 'endfield-data.read' }, account), false)
  assert.equal(
    projects.matchesPatAccount(
      {
        scope: 'gama-data.read',
        payload: { game_uid: '42', server_id: '1', game_name: efProject.name },
      },
      account,
    ),
    true,
  )
})

test('PAT issuance preserves Endfield server identity and source', () => {
  for (const serverId of ['1', '2', '']) {
    const payload = projects.buildPayload({
      gameUid: '42',
      serverId,
      source: 'skland',
      project: projects.inferProject({ scope: 'endfield-data.read' }),
    })
    assert.equal(payload.game_uid, '42')
    assert.equal(payload.server_id, serverId)
    assert.equal(payload.source, 'skland')
  }
  const akPayload = projects.buildPayload({
    gameUid: '42',
    source: 'skland',
    project: projects.inferProject({ scope: 'arknights-data.read' }),
  })
  assert.equal('server_id' in akPayload, false)
})

test('Endfield account cards retain the server returned by the account API', () => {
  const page = loadPageLogic('ProjectsView', ['commonDataProjects', 'buildAccounts'], {
    getTclUid: () => 'user-uid',
    arknightsIcon: 'ak-icon',
    endfieldIcon: 'ef-icon',
  })
  const accounts = page.buildAccounts(
    [],
    [
      { roleId: '42', serverId: '1' },
      { roleId: '42', serverId: '2' },
    ],
  )
  assert.notEqual(accounts[0].id, accounts[1].id)
  assert.equal(accounts[0].serverId, '1')
  assert.equal(accounts[1].serverId, '2')
})
