const assert = require('assert')

describe('commnder_ja', () => {
    it('version', () => {
        const app = require('../src/commander_ja.js')
        const c1 = app
            .version('1.1.1', '-v,--version')
            .option('-a,--aaa')
            .parseStr(['node.js', 'cnako3.js', '-v'])
        assert.strictEqual(c1, '1.1.1')
        const c2 = app
            .version('1.2.3', '-v,--version')
            .option('-a,--aaa')
            .parseStr(['node.js', 'cnako3.js', '--version'])
        assert.strictEqual(c2, '1.2.3')
    })
    it('help', () => {
        const app = require('../src/commander_ja.js')
        app.version('1.2.3', '-v,--version')
            .usage('[opt] test')
            .option('-a,--aaa')
        const help = app.getHelp()
        const c1 = app.parseStr(['node.js', 'cnako3.js', '-h'])
        assert.strictEqual(c1, help)
    })
    it('args no params', () => {
        const app = require('../src/commander_ja.js')
        app.version('1.2.3', '-v,--version')
            .title('hoge')
            .usage('[opt] test')
            .option('-a,--aaa')
        app.parseStr(['node.js', 'cnako3.js', 'aaa', 'bbb'])
        assert.strictEqual(app.args[0], 'aaa')
        assert.strictEqual(app.args[1], 'bbb')
    })
    it('args has params1', () => {
        const app = require('../src/commander_ja.js')
        app.version('1.2.3', '-v,--version')
            .title('hoge')
            .usage('[opt] test')
            .option('-a,--aaa')
        app.parseStr(['node.js', 'cnako3.js', '-a'])
        assert.strictEqual(app.aaa, true)
    })
    it('args has params2', () => {
        const app = require('../src/commander_ja.js')
        app.version('1.2.3', '-v,--version')
            .title('hoge')
            .usage('[opt] test')
            .option('-a, --aaa')
        app.parseStr(['node.js', 'cnako3.js', '-a', 'bbb'])
        assert.strictEqual(app.aaa, true)
        assert.strictEqual(app.args[0], 'bbb')
    })
    it('args has params3', () => {
        const app = require('../src/commander_ja.js')
        app.version('1.2.3', '-v,--version')
            .title('hoge')
            .usage('[opt] test')
            .option('-e, --eval [source]', 'eval source')
        app.parseStr(['node.js', 'cnako3.js', '-e', 'hoge'])
        assert.strictEqual(app.eval, 'hoge')
    })
})
