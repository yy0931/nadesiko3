const { JavaScriptCode } = require('../src/nako_gen')
const assert = require('assert')

describe('nako_gen_test', () => {
    it('JavaScriptCode - 単純な例', () => {
        const out = new JavaScriptCode({ startOffset: 5, endOffset: 8 }).push('a', 'b', 'c').build()

        // ソースコードを結合する。
        assert.strictEqual(out.code, 'abc')

        // ソースコードの各部分についてソースマップを生成する。
        assert.deepStrictEqual(out.sourceMap, [
            { js: { start: 0, end: 1 }, nadesiko: { start: 5, end: 8 } },
            { js: { start: 1, end: 2 }, nadesiko: { start: 5, end: 8 } },
            { js: { start: 2, end: 3 }, nadesiko: { start: 5, end: 8 } },
        ])
    })

    it('JavaScriptCode - ネストする場合', () => {
        const out = new JavaScriptCode({ startOffset: 5, endOffset: 8 })
            .push('--')
            .push(new JavaScriptCode({ startOffset: 1, endOffset: 3 }).push('a', 'b', 'c'))
            .push('==')
            .build()

        // ソースコードを再帰的に結合する。
        assert.strictEqual(out.code, '--abc==')

        // ソースコードの各部分についてソースマップを生成する。
        assert.deepStrictEqual(out.sourceMap, [
            // -- の部分
            { js: { start: 0, end: 2 }, nadesiko: { start: 5, end: 8 } },
            
            // a, b, c の部分
            { js: { start: 2, end: 3 }, nadesiko: { start: 1, end: 3 } },
            { js: { start: 3, end: 4 }, nadesiko: { start: 1, end: 3 } },
            { js: { start: 4, end: 5 }, nadesiko: { start: 1, end: 3 } },

            // == の部分
            { js: { start: 5, end: 7 }, nadesiko: { start: 5, end: 8 } },
        ])
    })

    it('JavaScriptCode - joinメソッド', () => {
        const out = new JavaScriptCode(null).push('a', 'b').join(', ').build()
        assert.strictEqual(out.code, 'a, b')
        assert.deepStrictEqual(out.sourceMap, [
            { js: { start: 0, end: 1 }, nadesiko: { start: null, end: null } }, // a
            { js: { start: 1, end: 3 }, nadesiko: { start: null, end: null } }, // ,
            { js: { start: 3, end: 4 }, nadesiko: { start: null, end: null } }, // b
        ])
    })
})
