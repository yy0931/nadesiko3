const assert = require('assert')
const NakoIndent = require('../src/nako_indent')

describe('indent', () => {
    const cmp = (src, expected) => {
        src = NakoIndent.convert(src).code
        src = src.replace(/\s+$/, '')
        expected = expected.replace(/\s+$/, '')
        assert.strictEqual(src, expected)
    }
    it('もし', () => {
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            '　　1を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            '　　1を表示\n' +
            'ここまで‰\n')
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            '　　「わん」と表示。\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            '　　「わん」と表示。\n' +
            'ここまで‰\n')
    })
    it('もし 違えば', () => {
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            '　　1を表示\n' +
            '違えば\n'+
            '　　2を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            '　　1を表示\n' +
            '違えば\n' +
            '　　2を表示\n' +
            'ここまで‰\n')
    })
    it('3回と5回', () => {
        cmp('!インデント構文\n'+
            '5回\n' +
            '　　3回\n'+
            '　　　　1を表示\n',
            // ---
            '!インデント構文\n'+
            '5回\n' +
            '　　3回\n' +
            '　　　　1を表示\n' +
            '    ここまで‰\n' +
            'ここまで‰\n')
    })
    it('もし 違えば 入れ子', () => {
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            '　　もしB=1ならば\n' +
            '　　　　1を表示\n' +
            '　　違えば\n' +
            '　　　　2を表示\n' +
            '違えば\n'+
            '　　3を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n'+
            '　　もしB=1ならば\n' +
            '　　　　1を表示\n' +
            '　　違えば\n' +
            '　　　　2を表示\n' +
            '    ここまで‰\n' +
            '違えば\n'+
            '　　3を表示\n' +
            'ここまで‰\n')
    })
    it('JSONで改行がある場合(#699)', () => {
        cmp('!インデント構文\n'+
            'J={"taro":30,\n'+
            '   "jiro":50}\n',
            // ---
            '!インデント構文\n'+
            'J={"taro":30,\n'+
            '   "jiro":50}\n')
        cmp('!インデント構文\n'+
            'S=「aaa\n'+
            'bbb」\n'+
            'もしS=30ならば\n' +
            '　　「あ」と表示\n',
            // ---
            '!インデント構文\n'+
            'S=「aaa\n'+
            'bbb」\n'+
            'もしS=30ならば\n' +
            '　　「あ」と表示\n' +
            'ここまで‰\n')
    })
    it('コメント内に文字列リテラルの開始記号がある場合', () => {
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            `　　1を表示 # 「\n`+
            '2を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            `　　1を表示 # 「\n`+
            'ここまで‰\n'+
            '2を表示\n'
        )
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            `　　1を表示 // 「\n`+
            '2を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            `　　1を表示 // 「\n`+
            'ここまで‰\n'+
            '2を表示\n'
        )
    })
    it('複数行コメント内に文字列リテラルの開始記号がある場合', () => {
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            `　　1を表示 /* 「 */\n`+
            '2を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            `　　1を表示 /* 「 */\n`+
            'ここまで‰\n'+
            '2を表示\n'
        )
        cmp('!インデント構文\n'+
            'もしA=1ならば\n'+
            `　　1を表示 ／＊ 「 ＊／\n`+
            '2を表示\n',
            // ---
            '!インデント構文\n'+
            'もしA=1ならば\n' +
            `　　1を表示 ／＊ 「 ＊／\n`+
            'ここまで‰\n'+
            '2を表示\n'
        )
    })
    it('改行を含む、絵文字による文字列がある場合', () => {
        cmp(
            '!インデント構文\n' +
            '2回\n' +
            '    🌴１\n' +
            '🌴を表示\n' +
            '「2」を表示\n',
            // ---
            '!インデント構文\n' +
            '2回\n' +
            '    🌴１\n' +
            '🌴を表示\n' +
            'ここまで‰\n' +
            '「2」を表示\n'
        )
    })
    it('前後が一致しない括弧がある場合', () => {
        cmp(
            '!インデント構文\n' +
            '2回\n' +
            '   A=｛\n' +
            '}を表示\n' +
            '1を表示\n',
            // ---
            '!インデント構文\n' +
            '2回\n' +
            '   A=｛\n' +
            '}を表示\n' +
            'ここまで‰\n' +
            '1を表示\n'
        )
    })
    it('ソースマップ', () => {
        const result = NakoIndent.convert(
            '！インデント構文\n' +
            '\n' +
            '●（nを）階乗とは\n' +
            '    もしnが1と等しいならば\n' +
            '        それは1\n' +
            '    違えば\n' +
            '        それは((n - 1)を階乗) * n\n' +
            '\n' +
            'もし１＝１なら\n' +
            '    「こんに\n' +
            'ちは」と表示\n' +
            '\n' +
            '「こんにちは」と表示\n' +
            '\n' +
            '',
        )
        
        /**
         * 出力されるべきコード:
         * ```
         *  0！インデント構文
         *  1 ●（nを）階乗とは
         *  2     もしnが1と等しいならば
         *  3         それは1
         *  4     違えば
         *  5         それは((n - 1)を階乗) * n
         *  6     ここまで‰
         *  7 ここまで‰
         *  8 もし１＝１なら
         *  9     「こんに
         * 10 ちは」と表示
         * 11 ここまで‰
         * 12 「こんにちは」と表示
         * ```
         */

        // 6, 7, 11 行目に「ここまで‰」が挿入された。
        assert.deepStrictEqual(result.insertedLines, [6, 7, 11])

        // 1, 6, 11, 13, 13行目の直前の空白行が消された。
        // ※ 正確には、各空白行を消したときに、それまでに出力した行数（「ここまで‰」を含む）が 1, 6, 11, 13, 13 行。
        assert.deepStrictEqual(result.deletedLines, [
            { lineNumber: 1, len: 0 },
            { lineNumber: 6, len: 0 },
            { lineNumber: 11, len: 0 },
            { lineNumber: 13, len: 0 },
            { lineNumber: 13, len: 0 }
        ])
    })
})
