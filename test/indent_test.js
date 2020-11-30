const assert = require('assert')
const NakoIndent = require('../src/nako_indent')

describe('indent', () => {
    const cmp = (src, expected) => {
        src = NakoIndent.convert(src)
        src = src.replace(/\s+$/, '')
        expected = expected.replace(/\s+$/, '')
        assert.strictEqual(src, expected)
    }
    it('もし', () => {
        cmp('##インデント構文\n'+
            'もしA=1ならば\n'+
            '　　1を表示\n',
            // ---
            '##インデント構文\n'+
            'もしA=1ならば\n' +
            '　　1を表示\n' +
            'ここまで\n')
    })
    it('もし 違えば', () => {
        cmp('##インデント構文\n'+
            'もしA=1ならば\n'+
            '　　1を表示\n' +
            '違えば\n'+
            '　　2を表示\n',
            // ---
            '##インデント構文\n'+
            'もしA=1ならば\n' +
            '　　1を表示\n' +
            '違えば\n' +
            '　　2を表示\n' +
            'ここまで\n')
    })
    it('3回と5回', () => {
        cmp('##インデント構文\n'+
            '5回\n' +
            '　　3回\n'+
            '　　　　1を表示\n',
            // ---
            '##インデント構文\n'+
            '5回\n' +
            '　　3回\n' +
            '　　　　1を表示\n' +
            '    ここまで\n' +
            'ここまで\n')
    })
    it('もし 違えば 入れ子', () => {
        cmp('##インデント構文\n'+
            'もしA=1ならば\n'+
            '　　もしB=1ならば\n' +
            '　　　　1を表示\n' +
            '　　違えば\n' +
            '　　　　2を表示\n' +
            '違えば\n'+
            '　　3を表示\n',
            // ---
            '##インデント構文\n'+
            'もしA=1ならば\n'+
            '　　もしB=1ならば\n' +
            '　　　　1を表示\n' +
            '　　違えば\n' +
            '　　　　2を表示\n' +
            '    ここまで\n' +
            '違えば\n'+
            '　　3を表示\n' +
            'ここまで\n')
    })
})