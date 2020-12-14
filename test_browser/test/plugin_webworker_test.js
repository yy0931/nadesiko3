import { strict as assert } from 'assert'
import NakoCompiler from '../../src/nako3.js'
import { importStatus } from './import_plugin_checker.js'
import PluginWebWorker from '../../src/plugin_webworker'

const waitTimer = (second) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, second * 1000)
  })
}

describe('plugin_webworker_test', () => {
  let nako = null
  afterEach(() => {
    nako = null
  })
  beforeEach(() => {
    nako = new NakoCompiler()
    // const pluginClone = Object.assign({}, PluginWebWorker)
    // nako.addPluginFile('PluginWebWorker', 'plugin_webworker.js', pluginClone)
    nako.addPluginFile('PluginWebWorker', 'plugin_webworker.js', PluginWebWorker)
    nako.debug = false
  })

  // --- test ---
  it('auto import for browser', () => {
    const pluginName = 'PluginWebWorker'
    const imported = importStatus.hasImport(pluginName)
    assert.ok(imported, 'was import')
    const autoImport = importStatus.getAutoImport(pluginName)
    assert.equal(typeof (autoImport.obj), 'object')
  })

  it('web worker basic', async () => {
    const msgs = []
    nako.addFunc('報告', [['を']], (msg) => {
      msgs.push(msg)
    })
    const code = `Wは「/wwnako3.js」をワーカー起動
WにNAKOワーカーハンドラ設定
WのNAKOワーカーデータ返信受信した時には、
　受信データを報告
　Wをワーカー終了
ここまで
WのNAKOワーカー表示した時には、
　受信データを報告
ここまで

Wで「"かかかかか"を表示する;"<>?"をHTML変換して表示する;"おわり"をNAKOワーカーデータ返信」をNAKOワーカープログラム起動
Wに「あいうえお」をNAKOワーカーデータ送信
`
    nako.runReset(code)

    await waitTimer(1)

    assert.equal(JSON.stringify(msgs), '["かかかかか","&lt;&gt;?","おわり"]')
  })
})