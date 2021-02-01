const NakoPrepare = require('./nako_prepare')

/**
 * インデント構文指定があればコードを変換する
 * @param {String} code 
 * @return String of convert
 */
function convert(code) {
    // プログラム冒頭に「!インデント構文」があれば変換
    const keywords = ['!インデント構文', '!ここまでだるい']
    // 最初の30行をチェック
    const lines = code.split('\n', 30)
    let bConv = false
    lines.forEach((line) => {
        const s9 = line.substr(0, 8).replace('！', '!')
        if (keywords.indexOf(s9) >= 0) {
            bConv = true
            return true
        }
    })
    if (bConv) {
        return convertGo(code)
    }
    return code
}

/**
 * @param src {string}
 * @returns {string}
 */
function createRetMark(src) {
    // ソースコード中の "0" の連続の最大個数を数える
    let count = 0
    let max = 0
    for (const char of src) {
        if (char === "0") {
            count++
            max = Math.max(max, count)
        } else {
            count = 0
        }
    }
    // それよりも多い "0" の連続の後、"1" が続く文字列をRetMarkとする。
    // max = 2 の場合の例:
    // - '\n001\n' -> '00010010001' -> '\n001\n'
    // - '\n100\n' -> '00011000001' -> '\n100\n'
    // - '\nab0\n' -> '0001ab00001' -> '\nab0\n'
    return "0".repeat(max + 1) + "1"
}

/**
 * @param code {string}
 * @returns {string}
 */
function convertGo(code) {
    // 改行文字を置換するためのマークを生成
    const specialRetMark = createRetMark(code)
    
    const END = 'ここまで‰'
    const code2 = replaceRetMark(code, specialRetMark) // 文字列の中などの改行を置換
    const lines = code2.split('\n')
    const lines2 = []
    const indentStack = []
    let lastIndent = 0
    lines.forEach((line) => {
        // trim line
        const lineTrimed = line.replace(/^\s+/, '').replace(/\s+$/, '')
        if (lineTrimed === '') { return }

        // check indent
        const indent = countIndent(line)
        if (lastIndent == indent) {
            lines2.push(line)
            return
        }

        // indent
        if (lastIndent < indent) {
            indentStack.push(lastIndent)
            lastIndent = indent
            lines2.push(line)
            return
        }
        // unindent
        if (lastIndent > indent) {
            // 5回
            //   3回
            //     1を表示
            //   |
            // |
            lastIndent = indent
            while (indentStack.length > 0) {
                const n = indentStack.pop()
                if (n == indent) {
                    if (lineTrimed != '違えば') {
                        lines2.push(makeIndent(n) + END)
                    }
                    lines2.push(line)
                    return
                }
                if (indent < n) {
                    lines2.push(makeIndent(n) + END)
                    continue
                }
            }
        }
    })
    // 残りのインデントを処理
    while (indentStack.length > 0) {
        const n = indentStack.pop()
        lines2.push(makeIndent(n) + END)
    }
    // 特別マーカーを改行に置換
    const code3 = lines2.join('\n')
    return code3.split(specialRetMark).join('\n')
}

function makeIndent(count) {
    let s = ''
    for (let i = 0; i < count; i++) {
        s += ' '
    }
    return s
}

/**
 * インデントの個数を数える
 * @param {String} line 
 */
function countIndent(line) {
    let cnt = 0
    for (let i = 0; i < line.length; i++) {
        const ch = line.charAt(i)
        if (ch == ' ') {
            cnt++
            continue
        }
        if (ch == '　') {
            cnt += 2
            continue
        }
        if (ch == '・') {
            cnt += 2
            continue
        }
        if (ch == '\t') {
            cnt += 4
            continue
        }
        break
    }
    return cnt
}

/**
 * @param src {string}
 * @param specialRetMark {string}
 * @returns {string}
 */
function replaceRetMark(src, specialRetMark) {
    const prepare = new NakoPrepare()  // `※`, `／/`, `／＊` といったパターン全てに対応するために必要
    const len = src.length
    let result = ''
    let eos = ''
    let i = 0
    while (i < len) {
        const c = src.charAt(i)
        const ch2 = src.substr(i, 2)
        const cPrepared = prepare.convert1ch(c)
        const ch2Prepared = [...ch2].map((c) => prepare.convert1ch(c)).join("")

        // eosか?
        if (eos != '') {
            // srcのi文字目以降がeosで始まるなら文字列を終了、そうでなければ1文字進める
            if (eos === (eos.length === 1 ? cPrepared : ch2Prepared)) {
                result += (eos.length === 1 ? c : ch2)
                i += eos.length
                eos = ''
            } else {
                if (c == '\n') {
                    result += specialRetMark
                } else {
                    result += c
                }
                i++
            }
            continue
        }
        // 文字列の改行も無視する
        switch (c) {
            case '"':
            case '\'':
                eos = c
                result += c
                i++
                continue
            case '「':
                eos = '」'
                result += c
                i++
                continue
            case '『':
                eos = '』'
                result += c
                i++
                continue
            case '“':
                eos = '”'
                result += c
                i++
                continue
            case '{':
                eos = '}'
                result += c
                i++
                continue
            case '｛':
                eos = '｝'
                result += c
                i++
                continue
            case '[':
                eos = ']'
                result += c
                i++
                continue
            case '🌴':
                eos = '🌴'
                result += c
                i++
                continue
            case '🌿':
                eos = '🌿'
                result += c
                i++
                continue
            case '【':
                eos = '】'
                result += c
                i++
                continue
        }

        // 行コメント
        if (cPrepared === '#') {
            eos = '\n'
            result += c
            i++
            continue
        }
        if (ch2Prepared === '//') {
            eos = '\n'
            result += ch2
            i += 2
            continue
        }

        // 複数行コメント
        if (ch2Prepared === '/*') {
            eos = '*/'
            result += ch2
            i += 2
            continue
        }

        result += c
        i++
    }
    return result
}


module.exports = {
    'convert': convert
}

