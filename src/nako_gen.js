//
// nako_gen.js
//
'use strict'

const { OffsetToLineColumn } = require('./nako_source_mapping')

class NakoGenError extends Error {
  /**
   * @param {string} msg
   * @param {number} line
   */
  constructor (msg, line) {
    if (line)
      {msg = '[文法エラー](' + line + ') ' + msg}
     else
      {msg = '[文法エラー] ' + msg}

    super(msg)
  }
}

let speedMode = false
let lastLineNo = -1

/**
 * @typedef {import('./nako_parser_base').Ast} Ast
 * 
 * @typedef {import('./nako3').TokenWithSourceMap} TokenWithSourceMap
 * 
 * @typedef {{
 *   file: string
 *   nadesiko: { start: number | null, end: number | null }
 *   js: { start: number, end: number }
 * }[]} SourceMap
 */

/**
 * JavaScriptのコードを連結し、ソースマップを付けて返す。
 * pushした各要素について、文字列なら `node` へのソースマップを付け、すでにソースマップを持つならその位置をずらす。
 */
class JavaScriptCode {
  /**
   * @param {Ast | null} sourceNode 追加するコードに対応するASTのノード。無い場合はnullを指定する。
   */
  constructor(sourceNode) {
    /**
     * @type {(JavaScriptCode | string | number)[]}
     * @private
     */
    this.arr = []
    this.node = sourceNode
    if (typeof sourceNode === 'object' && sourceNode !== null) {
      this.file = sourceNode.file
    } else {
      this.file = null
    }
  }

  /**
   * @param {(JavaScriptCode | string | number)[]} code
   */
  push(...code) {
    this.arr.push(...code)
    return this
  }

  /**
   * @returns {{ code: string, sourceMap: SourceMap }}
   */
  build() {
    /** @type {{ code: string, sourceMap: SourceMap }} */
    const result = { code: '', sourceMap: [] }
    for (const item of this.arr) {
      /** @type {SourceMap} */
      let sourceMap
      const left = result.code.length

      if (item instanceof JavaScriptCode) {
        // クラスならビルドしてから結合する。ただしnodeやfileがnullなら自身のもつ値で上書きする。
        if (!item.node) {
          item.node = this.node
        }
        if (!item.file) {
          item.file = this.file
        }
        const obj = item.build()
        result.code += obj.code
        sourceMap = obj.sourceMap
      } else  {
        // 文字列ならそのまま結合する
        result.code += item
        sourceMap = [{
          file: this.file,
          js: { start: 0, end: (item + '').length },
          nadesiko: (!this.node) ?
            { start: null, end: null } :
            { start: this.node.startOffset, end: this.node.endOffset },
        }]
      }

      // ソースマップをずらす
      for (const mapItem of sourceMap) {
        result.sourceMap.push({
          file: mapItem.file,
          js: this.shiftRange(mapItem.js, left),
          nadesiko: mapItem.nadesiko,
        })
      }
    }
    return result
  }

  /**
   * [Source Map Revision 3 Proposal](https://sourcemaps.info/spec.html) に従ったソースマップに変換する。
   * @param {Record<string, string>} inFiles 各なでしこファイルの中身
   * @param {string | undefined} [outFileName] 生成されるJavaScrptファイルの名前
   * @returns {{ code: string, sourceMap: string }}
   */
  buildAsStandardFormat(inFiles, outFileName) {
    const { code, sourceMap } = this.build()

    // offset を (line, column) に変換するためのオブジェクトを作る
    const offsetToLineColumnJS = new OffsetToLineColumn(code)
    /** @type {Record<string, OffsetToLineColumn>} */
    const offsetToLineColumnNadesiko = {}
    for (const name of Object.keys(inFiles)) {
      offsetToLineColumnNadesiko[name] = new OffsetToLineColumn(inFiles[name])
    }

    // ソースマップを生成
    const { SourceMapGenerator } = require('source-map')
    const map = new SourceMapGenerator({ file: outFileName })
    for (const item of sourceMap) {
      if (!item.file) {
        continue
      }

      // start
      if (typeof item.js.start === 'number' && typeof item.nadesiko.start === 'number') {
        map.addMapping({
          generated: offsetToLineColumnJS.map(item.js.start, true),
          source: item.file,
          original: offsetToLineColumnNadesiko[item.file].map(item.nadesiko.start, true),
        })
      }
    }
    return { code, sourceMap: map.toString() }
  }

  copy() {
    const js = new JavaScriptCode(this.node)
    js.arr = [...this.arr]
    return js
  }

  /**
   * 各要素を区切り文字列で結合する。
   * @param {string} separator
   *
   * 例: 次の2つは等しい。
   * ```
   * new JavaScriptCode(null).push('1', '2', '3').join(',')
   * new JavaScriptCode(null).push('1', ', ', '2', ',', '3')
   * ```
   */
  join(separator) {
    const js = new JavaScriptCode(this.node)
    for (let i = 0; i < this.arr.length; i++) {
      js.push(this.arr[i])
      if (i !== this.arr.length - 1) {
        js.push(separator)
      }
    }
    return js
  }

  isEmpty() {
    return this.arr.map((v) => {
      if (v instanceof JavaScriptCode) {
        return v.build().code
      } else {
        return v + ''
      }
    }).join("").length === 0
  }
  
  /**
   * { start: number | null, end: number | null } の位置をずらす。
   * @param {{ start: number | null, end: number | null }} range
   * @param {number} n
   * @returns {{ start: number | null, end: number | null }}
   * @private
   */
  shiftRange(range, n) {
    return {
      start: typeof range.start === "number" ? range.start + n : null,
      end: typeof range.end === "number" ? range.end + n : null,
    }
  }
}

/**
 * 構文木からJSのコードを生成するクラス
 */
class NakoGen {
  /**
   * @param com {import('./nako3')} コンパイラのインスタンス
   */
  constructor (com) {
    this.header = NakoGen.getHeader()

    /**
     * プラグインで定義された関数の一覧
     * @type {Record<string, { type: string }>}
     */
    this.funclist = com.funclist

    /**
     * なでしこで定義した関数の一覧
     * @type {Record<string, { type: string, josi: string[][], fn: JavaScriptCode }>}
     */
    this.nako_func = {}

    /**
     * なでしこで定義したテストの一覧
     * @type {{}}
     */
    this.nako_test = {}

    /**
     * JS関数でなでしこ内で利用された関数
     * 利用した関数を個別にJSで定義する
     * (全関数をインクルードしなくても良いように)
     * @type {Record<string, boolean>}
     */
    this.used_func = {}

    /**
     * ループ時の一時変数が被らないようにIDで管理
     * @type {number}
     */
    this.loop_id = 1

    /**
     * 変換中の処理が、ループの中かどうかを判定する
     * @type {boolean}
     */
    this.flagLoop = false

    /**
     * それ
     */
    this.sore = NakoGen.varname('それ')

    /**
     * なでしこのローカル変数をスタックで管理
     * __varslist[0] プラグイン領域
     * __varslist[1] なでしこグローバル領域
     * __varslist[2] 最初のローカル変数 ( == __vars }
     * @type {any[]}
     * @private
     */
    this.__varslist = com.__varslist
    this.__self = com

    /**
     * なでしこのローカル変数(フレームトップ)
     * @type {*}
     * @private
     */
    this.__vars = this.__varslist[2]

    /**
     * 利用可能なプラグイン(ファイル 単位)
     * @type {{}}
     */
    this.__module = com.__module

    /**
     * コマンドオプションがあれば記録
     * @type {{}}
     */
    this.__options = com.options
  }

  setOptions (options) {
    this.__options = options
    if (this.__options.speed) { speedMode = true }
  }

  /** @returns {JavaScriptCode} */
  static getHeader () {
    return new JavaScriptCode(null).push('',
      'var __varslist = this.__varslist = [{}, {}, {}];\n',
      'var __vars = this.__varslist[2];\n',
      'var __self = this;\n',
      'var __module = {};\n')
  }

  /** @returns {JavaScriptCode} */
  static convLineno (node, forceUpdate) {
    const js = new JavaScriptCode(node)
    if (node.line === undefined) {return js.push('')}
    if (speedMode) return js.push(`/* line=`, node.line, ` */`)
    // 強制的に行番号をアップデートするか
    if (!forceUpdate) {
      if (node.line == lastLineNo) return js.push('')
      lastLineNo = node.line
    }
    return js.push(`__v0.line=`, node.line, `;`)
  }

  /**
   * @param {string} name
   * @param {Ast | undefined} [node]
   * @returns {JavaScriptCode}
   */
  static varname (name, node) {
    return new JavaScriptCode(node).push(`__vars["`, name,`"]`)
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static getFuncName (name) {
    let name2 = name.replace(/[ぁ-ん]+$/, '')
    if (name2 === '') {name2 = name}
    return name2
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  static convRequire (node) {
    const moduleName = node.value + ''
    return new JavaScriptCode(node).push(
      NakoGen.convLineno(node, false),
      `__module['`, moduleName, `'] = require('`, moduleName, `');\n`,
    )
  }

  reset () {
    // this.nako_func = {}
    // 初期化メソッド以外の関数を削除
    const uf = {}
    for (const key in this.used_func)
      {if (key.match(/^!.+:初期化$/)) {uf[key] = this.used_func[key]}}

    this.used_func = uf
    //
    this.loop_id = 1
    this.__varslist[1] = {} // user global
    this.__vars = this.__varslist[2] = {} // user local
  }

  /**
   * プログラムの実行に必要な関数を書き出す(システム領域)
   * @returns {JavaScriptCode}
   */
  getVarsCode () {
    const js = new JavaScriptCode(null)

    // プログラム中で使った関数を列挙して書き出す
    for (const key in this.used_func) {
      const f = this.__varslist[0][key]
      if (typeof (f) === 'function')
        {js.push(`this.__varslist[0]["`, key, `"]`, '=', f.toString(), ';\n')}
       else
        {js.push(`this.__varslist[0]["`, key, `"]`, '=', JSON.stringify(f), ';\n')}

    }
    return js
  }

  /**
   * プログラムの実行に必要な関数定義を書き出す(グローバル領域)
   * @param {boolean} isTest テストかどうか
   * @returns {JavaScriptCode}
   */
  getDefFuncCode(isTest) {
    const js = new JavaScriptCode(null)
    // よく使う変数のショートカット
    js.push('const __self = this.__self = this;\n')
    js.push('const __varslist = this.__varslist;\n')
    js.push('const __module = this.__module;\n')
    js.push('const __v0 = this.__v0 = this.__varslist[0];\n')
    js.push('const __v1 = this.__v1 = this.__varslist[1];\n')
    js.push('let __vars = this.__vars = this.__varslist[this.__varslist.length - 1];\n')
    // なでしこの関数定義を行う
    const nakoFuncCode = new JavaScriptCode(null)
    for (const key in this.nako_func) {
      const f = this.nako_func[key].fn
      nakoFuncCode.push('',
        `//[DEF_FUNC name='`, key, `']\n`,
        `__v1["`, key, `"]=`, f, `;\n;`,
        `//[/DEF_FUNC name='`, key, `']\n`)
    }
    if (!nakoFuncCode.isEmpty())
      {js.push('__v0.line=0;// なでしこの関数定義\n', nakoFuncCode)}

    // プラグインの初期化関数を実行する
    const pluginCode = new JavaScriptCode(null)
    for (const name in this.__module) {
      const initkey = `!${name}:初期化`
      if (this.__varslist[0][initkey])
        {pluginCode.push(`__v0["!`, name, `:初期化"](__self);\n`)} // セミコロンがないとエラーになったので注意

    }
    if (!pluginCode.isEmpty())
      {js.push('__v0.line=0;// プラグインの初期化\n', pluginCode)}

    // それを初期化
    js.push('__vars["それ"] = \'\';\n')

    // テストの定義を行う
    if (isTest) {
      const testCode = new JavaScriptCode(null)

      for (const key in this.nako_test) {
        const f = this.nako_test[key].fn
        testCode.push(f, `;\n;`)
      }

      if (!testCode.isEmpty()) {
        js.push('__v0.line=0;// テスト定義\n')
        js.push(testCode, '\n')
      }
    }

    return js
  }

  getVarsList () {
    return this.__varslist
  }

  /**
   * プラグイン・オブジェクトを追加
   * @param po プラグイン・オブジェクト
   */
  addPlugin (po) {
    return this.__self.addPlugin(po)
  }

  /**
   * プラグイン・オブジェクトを追加(ブラウザ向け)
   * @param name オブジェクト名
   * @param po 関数リスト
   */
  addPluginObject (name, po) {
    this.__self.addPluginObject(name, po)
  }

  /**
   * プラグイン・ファイルを追加(Node.js向け)
   * @param objName オブジェクト名
   * @param path ファイルパス
   * @param po 登録するオブジェクト
   */
  addPluginFile (objName, path, po) {
    this.__self.addPluginFile(objName, path, po)
  }

  /**
   * 関数を追加する
   * @param key 関数名
   * @param josi 助詞
   * @param fn 関数
   */
  addFunc (key, josi, fn) {
    this.__self.addFunc(key, josi, fn)
  }

  /**
   * 関数をセットする
   * @param key 関数名
   * @param fn 関数
   */
  setFunc (key, fn) {
    this.__self.setFunc(key, fn)
  }

  /**
   * プラグイン関数を参照する
   * @param {string} key プラグイン関数の関数名
   * @returns プラグイン・オブジェクト
   */
  getFunc (key) {
    return this.__self.getFunc(key)
  }

  /**
   * 関数を先に登録してしまう
   */
  registerFunction (ast) {
    if (ast.type !== 'block')
      {throw new NakoGenError('構文解析に失敗しています。構文は必ずblockが先頭になります')}

    for (let i = 0; i < ast.block.length; i++) {
      const t = ast.block[i]
      if (t.type === 'def_func') {
        const name = t.name.value
        this.used_func[name] = true
        this.__varslist[1][name] = function () { } // 事前に適当な値を設定
        this.nako_func[name] = {
          'josi': t.name.meta.josi,
          'fn': new JavaScriptCode(ast).push(''),
          'type': 'func'
        }
      }
    }
  }

  /**
   * @param {Ast} node
   * @param {boolean} isTest
   * @returns {JavaScriptCode}
   */
  convGen(node, isTest) {
    const result = this._convGen(node)
    if (isTest) {
      return new JavaScriptCode(node).push('')
    } else {
      return result
    }
  }

  /**
   * @param {Ast | Ast[] | null | undefined | string} node
   * @returns {JavaScriptCode}
   */
  _convGen(node) {

    if (node instanceof Array) {
      return new JavaScriptCode(null).push(...node.map((n) => this._convGen(n)))
    }
    if (node === null) {return new JavaScriptCode(null).push('null')}
    if (node === undefined) {return new JavaScriptCode(null).push('undefined')}
    if (typeof (node) !== 'object') {return new JavaScriptCode(null).push(node)}

    const code = new JavaScriptCode(node)
    // switch
    switch (node.type) {
      case 'nop':
        break
      case 'block':
        for (let i = 0; i < node.block.length; i++) {
          const b = node.block[i]
          code.push(this._convGen(b))
        }
        break
      case 'comment':
      case 'eol':
        code.push(this.convComment(node))
        break
      case 'break':
        code.push(this.convCheckLoop(node, 'break'))
        break
      case 'continue':
        code.push(this.convCheckLoop(node, 'continue'))
        break
      case 'end':
        code.push('__varslist[0][\'終\']();')
        break
      case 'number':
        code.push('' + node.value)
        break
      case 'string':
        code.push(this.convString(node))
        break
      case 'def_local_var':
        code.push(this.convDefLocalVar(node))
        break
      case 'let':
        code.push(this.convLet(node))
        break
      case 'word':
      case 'variable':
        code.push(this.convGetVar(node))
        break
      case 'op':
      case 'calc':
        code.push(this.convOp(node))
        break
      case 'renbun':
        code.push(this.convRenbun(node))
        break
      case 'not':
        code.push('((', this._convGen(node.value), ')?0:1)')
        break
      case 'func':
      case 'func_pointer':
      case 'calc_func':
        code.push(this.convFunc(node))
        break
      case 'if':
        code.push(this.convIf(node))
        break
      case 'promise':
        code.push(this.convPromise(node))
        break
      case 'for':
        code.push(this.convFor(node))
        break
      case 'foreach':
        code.push(this.convForeach(node))
        break
      case 'repeat_times':
        code.push(this.convRepeatTimes(node))
        break
      case 'while':
        code.push(this.convWhile(node))
        break
      case 'switch':
        code.push(this.convSwitch(node))
        break
      case 'let_array':
        code.push(this.convLetArray(node))
        break
      case 'ref_array':
        code.push(this.convRefArray(node))
        break
      case 'json_array':
        code.push(this.convJsonArray(node))
        break
      case 'json_obj':
        code.push(this.convJsonObj(node))
        break
      case 'func_obj':
        code.push(this.convFuncObj(node))
        break
      case 'bool':
        code.push((node.value) ? 'true' : 'false')
        break
      case 'null':
        code.push('null')
        break
      case 'def_test':
        code.push(this.convDefTest(node))
        break
      case 'def_func':
        code.push(this.convDefFunc(node))
        break
      case 'return':
        code.push(this.convReturn(node))
        break
      case 'try_except':
        code.push(this.convTryExcept(node))
        break
      case 'require':
        code.push(NakoGen.convRequire(node))
        break
      default:
        throw new Error('System Error: unknown_type=' + node.type)
    }
    return code
  }

  /** @param {string} name */
  findVar (name) {
    // __vars ? (ローカル変数)
    if (this.__vars[name] !== undefined)
      {return {i: this.__varslist.length - 1, 'name': name, isTop: true}}

    // __varslist ?
    for (let i = this.__varslist.length - 2; i >= 0; i--) {
      const vlist = this.__varslist[i]
      if (!vlist) {continue}
      if (vlist[name] !== undefined)
        {return {'i': i, 'name': name, isTop: false}}

    }
    return null
  }

  /**
   * @param {string} name
   * @param {number} line
   * @returns {string}
   */
  genVar (name, line) {
    const res = this.findVar(name)
    const lno = line
    if (res === null)
      {return `__vars["${name}"]/*?:${lno}*/`}

    const i = res.i
    // システム関数・変数の場合
    if (i === 0) {
      const pv = this.funclist[name]
      if (!pv) {return `__vars["${name}"]/*err:${lno}*/`}
      if (pv.type === 'const' || pv.type === 'var') {return `__varslist[0]["${name}"]`}
      if (pv.type === 'func') {
        if (pv.josi.length === 0)
          {return `(__varslist[${i}]["${name}"]())`}

        throw new NakoGenError(`『${name}』が複文で使われました。単文で記述してください。(v1非互換)`, line)
      }
      throw new NakoGenError(`『${name}』は関数であり参照できません。`, line)
    }
    if (res.isTop)
      {return `__vars["${name}"]`}
     else
      {return `__varslist[${i}]["${name}"]`}

  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convGetVar (node) {
    const name = node.value
    return new JavaScriptCode(node).push(this.genVar(name, node.line))
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convComment (node) {
    const js = new JavaScriptCode(node)
    let commentSrc = String(node.value)
    commentSrc = commentSrc.replace(/\n/g, '¶')
    const lineNo = NakoGen.convLineno(node, false)
    if (commentSrc === '' && lineNo.code === '') { return js.push(';') }
    if (commentSrc === '') {
      return js.push(';', lineNo, '\n')
    }
    return js.push(';', lineNo, '//', commentSrc, '\n')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convReturn (node) {
    // 関数の中であれば利用可能
    if (typeof (this.__vars['!関数']) === 'undefined')
      {throw new NakoGenError('『戻る』がありますが、関数定義内のみで使用可能です。', node.line)}

    const lno = NakoGen.convLineno(node, false)
    let value
    if (node.value) {
      value = this._convGen(node.value)
      return new JavaScriptCode(node).push(lno, `return `, value, `;`)
    } else {
      value = this.sore
      return new JavaScriptCode(node).push(lno, `return `, value, `;`)
    }
  }

  /**
   * @param {Ast} node
   * @param {'break' | 'continue'} cmd
   * @returns {JavaScriptCode}
   */
  convCheckLoop (node, cmd) {
    // ループの中であれば利用可能
    if (!this.flagLoop) {
      const cmdj = (cmd === 'continue') ? '続ける' : '抜ける'
      throw new NakoGenError(`『${cmdj}』文がありますが、それは繰り返しの中で利用してください。`, node.line)
    }
    return new JavaScriptCode(node).push(NakoGen.convLineno(node.line), cmd, ';')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convDefFuncCommon (node, name) {
    const code = new JavaScriptCode(node).push('(function(){\n')
    code.push('',
      'try {\n',
      '  __vars = {\'それ\':\'\'};\n',
      '  __varslist.push(__vars);\n')
    this.__vars = {'それ': true, '!関数': name}
    // ローカル変数をPUSHする
    this.__varslist.push(this.__vars)
    // JSの引数と引数をバインド
    code.push(`  __vars['引数'] = arguments;\n`)
    // 引数をローカル変数に設定
    let meta = (!name) ? node.meta : node.name.meta
    for (let i = 0; i < meta.varnames.length; i++) {
      const word = meta.varnames[i]
      code.push(`  __vars['`, word, `'] = arguments[`, i + '', `];\n`)
      this.__vars[word] = true
    }
    // 関数定義は、グローバル領域で。
    if (name) {
      this.used_func[name] = true
      this.__varslist[1][name] = function () {
      } // 再帰のために事前に適当な値を設定
      this.nako_func[name] = {
        'josi': node.name.meta.josi,
        'fn': new JavaScriptCode(node).push(''),
        'type': 'func'
      }
    }
    // ブロックを解析
    const block = this._convGen(node.block)
    code.push(block, '\n')
    // 関数の最後に、変数「それ」をreturnするようにする
    code.push(`  return (`, this.sore, `);\n`)
    // 関数の末尾に、ローカル変数をPOP
    const popcode =
      '__varslist.pop(); ' +
      '__vars = __varslist[__varslist.length-1];'
    code.push('',
      `  } finally {\n`,
      `    `, popcode, `\n`,
      `  }\n`,
      `})`)
    if (name)
      {this.nako_func[name]['fn'] = code.copy()}

    this.__varslist.pop()
    this.__vars = this.__varslist[this.__varslist.length-1]
    if (name)
      {this.__varslist[1][name] = code.copy()}

    return code
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convDefTest(node) {
    const name = node.name.value
    const code = new JavaScriptCode(node).push(
      `describe('test', () => {\n`,
      ` it('`, name, `', () => {\n`
    )
    // ブロックを解析
    const block = this._convGen(node.block)

    code.push(
      `   `, block, `\n`,
      ` })\n`,
      `})`,
    )

    this.nako_test[name] = {
      'josi': node.name.meta.josi,
      'fn': code.copy(),
      'type': 'test_func'
    }

    // ★この時点ではテストコードを生成しない★
    // プログラム冒頭でコード生成時にテストの定義を行う
    return code
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convDefFunc(node) {
    const name = NakoGen.getFuncName(node.name.value)
    this.convDefFuncCommon(node, name)
    // ★この時点では関数のコードを生成しない★
    // プログラム冒頭でコード生成時に関数定義を行う
    // return `__vars["${name}"] = ${code};\n`;
    return new JavaScriptCode(node).push('')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convFuncObj (node) {
    return this.convDefFuncCommon(node, '')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convJsonObj (node) {
    const list = /** @type {{ key: Ast, value: Ast }[]} */(node.value)
    const code = new JavaScriptCode(node).push('{')
    list.forEach((e, i) => {
      code.push(this._convGen(e.key), ':', this._convGen(e.value))
      if (i !== list.length - 1) {
        code.push(',')
      }
    })
    return code.push('}')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convJsonArray (node) {
    const list = /** @type {Ast[]} */(node.value)
    const code = new JavaScriptCode(node).push('[')
    list.forEach((e, i) => {
      code.push(this._convGen(e))
      if (i !== list.length - 1) {
        code.push(',')
      }
    })
    return code.push(']')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convRefArray(node) {
    const name = this._convGen(node.name)
    const list = node.index
    const code = new JavaScriptCode(node).push(name)
    for (let i = 0; i < list.length; i++) {
      const idx = this._convGen(list[i])
      code.push('[', idx, ']')
    }
    return code
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convLetArray(node) {
    const name = this._convGen(node.name)
    const list = node.index
    const code = new JavaScriptCode(node).push(name)
    for (let i = 0; i < list.length; i++) {
      const idx = this._convGen(list[i])
      code.push('[', idx, ']')
    }
    const value = this._convGen(node.value)
    code.push(' = ', value, ';\n')
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convGenLoop (node) {
    const tmpflag = this.flagLoop
    this.flagLoop = true
    try {
      return this._convGen(node)
    } finally {
      this.flagLoop = tmpflag
    }
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convFor (node) {
    // ループ変数について
    let word = '__vars[\'__dummy__\']'
    if (node.word !== null) { // ループ変数を使う時
      const varName = node.word.value
      this.__vars[varName] = true
      word = `__vars['${varName}']`
    }
    const idLoop = this.loop_id++
    const varI = `$nako_i${idLoop}`
    // ループ条件を確認
    const kara = this._convGen(node.from)
    const made = this._convGen(node.to)
    // ループ内のブロック内容を得る
    const block = this.convGenLoop(node.block)
    // ループ条件を変数に入れる用
    const varFrom = `$nako_from${idLoop}`
    const varTo = `$nako_to${idLoop}`
    const code = new JavaScriptCode(node).push(
      `\n//[FOR id=`, idLoop, `]\n`,
      `const `, varFrom, ` = `, kara, `;\n`,
      `const `, varTo, ` = `, made, `;\n`,
      `if (`, varFrom, ` <= `, varTo, `) { // up\n`,
      `  for (let `, varI, ` = `, varFrom, `; `, varI, ` <= `, varTo, `; `, varI, `++) {\n`,
      `    `, this.sore, ` = `, word, ` = `, varI, `;\n`,
      `    `, block, `\n`,
      `  };\n`,
      `} else { // down\n`,
      `  for (let `, varI, ` = `, varFrom, `; `, varI, ` >= `, varTo, `; `, varI, `--) {\n`,
      `    `, this.sore, ` = `, word, ` = `, varI, `;`, '\n',
      `    `, block, `\n`,
      `  };\n`,
      `};\n//[/FOR id=`, idLoop, `]\n`,
    )
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convForeach (node) {
    let target
    if (node.target === null)
      {target = this.sore}
     else
      {target = this._convGen(node.target)}

    const block = this.convGenLoop(node.block)
    const id = this.loop_id++
    const key = '__v0["対象キー"]'
    let nameS = '__v0["対象"]'
    if (node.name) {
      nameS = NakoGen.varname(node.name.value)
      this.__vars[node.name] = true
    }
    const code = new JavaScriptCode(node).push(
      `let $nako_foreach_v`, id, `=`, target, `;\n`,
      `for (let $nako_i`, id, ` in $nako_foreach_v`, id, `)`, '{\n',
      `  if ($nako_foreach_v`, id, `.hasOwnProperty($nako_i`, id, `)) {\n`,
      `    `, nameS, ` = `, this.sore, ` = $nako_foreach_v`, id, `[$nako_i`, id, `];`, '\n',
      `    `, key, ` = $nako_i`, id, `;\n`,
      `    `, block, `\n`,
      '  }\n',
      '};\n'
    )
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convRepeatTimes (node) {
    const id = this.loop_id++
    const value = this._convGen(node.value)
    const block = this.convGenLoop(node.block)
    const kaisu = '__v0["回数"]'
    const code = new JavaScriptCode(node).push(
      `for(var $nako_i`, id, ` = 1; $nako_i`, id, ` <= `, value, `; $nako_i`, id, `++)` + '{\n' +
      `  `, this.sore, ` = `, kaisu, ` = $nako_i`, id, `;` + '\n' +
      '  ', block, '\n}\n'
    )
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convWhile (node) {
    const cond = this._convGen(node.cond)
    const block = this.convGenLoop(node.block)
    const code = new JavaScriptCode(node).push(
      `while (`, cond, `)`, '{\n',
      `  `, block, '\n',
      '}\n'
    )
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convSwitch (node) {
    const value = this._convGen(node.value)
    const cases = node.cases
    let body = new JavaScriptCode(node)
    for (let i = 0; i < cases.length; i++) {
      const cvalue = cases[i][0]
      const cblock = this.convGenLoop(cases[i][1])
      if (cvalue.type == '違えば') {
        body.push(new JavaScriptCode(cvalue).push(`  default:\n`))
      } else {
        const cvalue_code = this._convGen(cvalue)
        body.push(new JavaScriptCode(cvalue).push(`  case `, cvalue_code, `:\n`))
      }
      body.push(new JavaScriptCode(cvalue).push(`    `, cblock, `\n`, `    break\n`))
    }
    const code = new JavaScriptCode(node).push(
      `switch (`, value, `)`, '{\n',
      body, '\n',
      '}\n'
    )
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convIf (node) {
    const expr = this._convGen(node.expr)
    const block = this._convGen(node.block)
    const falseBlock = new JavaScriptCode(node)
    if (node.false_block !== null) {
      falseBlock.push('else {', this._convGen(node.false_block), '};\n')
    }
    return new JavaScriptCode(node).push(
      NakoGen.convLineno(node, false),
      `if (`, expr, `) {\n  `,
      block,
      `\n}`, falseBlock, ';\n',
    )
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convPromise (node) {
    const pid = this.loop_id++
    let code = new JavaScriptCode(node).push(`const __pid`, pid, ` = async () => {\n`)
    for (let i = 0; i < node.blocks.length; i++) {
      const block = this._convGen(node.blocks[i])
      code.push(
        'await new Promise((resolve) => {\n',
        '  __self.resolve = resolve;\n',
        '  __self.resolveCount = 0;\n',
        `  `, block, '\n', `\n`,
        '  if (__self.resolveCount === 0) resolve();\n',
        '\n',
        '})\n'
      )
    }
    code.push(`};/* __pid`, pid, ` */\n`)
    code.push(`__pid`, pid, `();\n`)
    code.push('__self.resolve = undefined;\n')
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), code)
  }

  /** @returns {[JavaScriptCode[], unknown]} */
  convFuncGetArgsCalcType (funcName, func, node) {
    const args = []
    const opts = {}
    for (let i = 0; i < node.args.length; i++) {
      const arg = node.args[i]
      if (i === 0 && arg === null) {
        args.push(this.sore)
        opts['sore'] = true
      } else
        {args.push(this._convGen(arg))}

    }
    return [args, opts]
  }

  /** @returns {string[]} */
  getPluginList () {
    const r = []
    for (const name in this.__module) {r.push(name)}
    return r
  }

  /**
   * 関数の呼び出し
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convFunc (node) {
    const funcName = NakoGen.getFuncName(node.name)
    let funcNameS = new JavaScriptCode(node)
    const res = this.findVar(funcName)
    if (res === null) {
      throw new NakoGenError(`関数『${funcName}』が見当たりません。有効プラグイン=[` + this.getPluginList().join(', ') + ']', node.line)
    }
    let func
    if (res.i === 0) { // plugin function
      func = this.funclist[funcName]
      funcNameS.push(`__v0["`, funcName, `"]`)
      if (func.type !== 'func') {
        throw new NakoGenError(`『${funcName}』は関数ではありません。`, node.line)
      }
    } else {
      func = this.nako_func[funcName]
      // 無名関数の可能性
      if (func === undefined) {func = {return_none: false}}

      funcNameS.push(`__varslist[`, res.i, `]["`, funcName, `"]`)
    }
    // 関数の参照渡しか？
    if (node.type === 'func_pointer') {
      return funcNameS
    }
    // 関数の参照渡しでない場合
    // 関数定義より助詞を一つずつ調べる
    const argsInfo = this.convFuncGetArgsCalcType(funcName, func, node)
    const args = new JavaScriptCode(node).push(...argsInfo[0])
    const argsOpts = argsInfo[1]
    // function
    if (typeof (this.used_func[funcName]) === 'undefined') {
      this.used_func[funcName] = true
    }

    // 関数呼び出しで、引数の末尾にthisを追加する-システム情報を参照するため
    args.push('__self')
    let funcBegin = ''
    let funcEnd = ''
    // setter?
    if (node['setter']) {
      funcBegin = ';__self.isSetter = true;'
      funcEnd = ';__self.isSetter = false;'
    }
    // 変数「それ」が補完されていることをヒントとして出力
    if (argsOpts['sore']){funcBegin += '/*[sore]*/'}

    // 関数呼び出しコードの構築
    let argsCode = args.join(',')
    let code = new JavaScriptCode(node).push(funcNameS, `(`, argsCode, `)`)
    if (func.return_none) {
      code = new JavaScriptCode(node).push(funcBegin, code, `;`, funcEnd, `\n`)
    } else {
      code = new JavaScriptCode(node).push(`(function(){ `, funcBegin, `const tmp=`, this.sore, `=`, code, `; return tmp;`, funcEnd, `; }).call(this)`)
      // ...して
      if (node.josi === 'して'){code.push(';\n')}
    }
    return code
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convRenbun(node) {
    let right = this._convGen(node.right)
    let left = this._convGen(node.left)
    return new JavaScriptCode(node).push(
      `(function(){`,
      left,
      `; return `,
      right,
      `}).call(this)`,
    )
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convOp (node) {
    const OP_TBL = { // トークン名からJS演算子
      '&': '+""+',
      'eq': '==',
      'noteq': '!=',
      'gt': '>',
      'lt': '<',
      'gteq': '>=',
      'lteq': '<=',
      'and': '&&',
      'or': '||',
      'shift_l': '<<',
      'shift_r': '>>',
      'shift_r0': '>>>'
    }
    const NUM_OP_TBL = { // 数値限定演算子
      '+': true, '-': true, '*': true, '/': true, '%': true, '^': true
    }
    let op = node.operator // 演算子
    let right = this._convGen(node.right)
    let left = this._convGen(node.left)
    if (NUM_OP_TBL[op]) {
      left = new JavaScriptCode(node).push(`parseFloat(`, left, `)`)
      right = new JavaScriptCode(node).push(`parseFloat(`, right, `)`)
    }
    // 階乗
    if (op === '^')
      {return new JavaScriptCode(node).push('(Math.pow(', left, ',', right, '))')}

    // 一般的なオペレータに変換
    if (OP_TBL[op]) {op = OP_TBL[op]}
    return new JavaScriptCode(node).push(`(`, left, op, right, `)`)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convLet (node) {
    // もし値が省略されていたら、変数「それ」に代入する
    let value = this.sore
    if (node.value) {value = this._convGen(node.value)}
    // 変数名
    const name = node.name.value
    const res = this.findVar(name)
    let isTop

    if (res === null) {
      this.__vars[name] = true
      isTop = true
    } else {
      isTop = res.isTop
      // 定数ならエラーを出す
      if (this.__varslist[res.i].meta)
        {if (this.__varslist[res.i].meta[name]) {
          if (this.__varslist[res.i].meta[name].readonly)
            {throw new NakoGenError(
              `定数『${name}』は既に定義済みなので、値を代入することはできません。`,
              node.line)}

        }}

    }

    /** @type {JavaScriptCode} */
    let code = new JavaScriptCode(node)
    if (isTop)
      {code.push(`__vars["`, name, `"]=`, value, `;`)}
     else
      {code.push(`__varslist[`, res.i, `]["`, name, `"]=`, value, `;`)}

    return new JavaScriptCode(node).push(
      ';',
      NakoGen.convLineno(node, false),
      code,
      '\n',
    )
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convDefLocalVar(node) {
    const value = (node.value === null) ? 'null' : this._convGen(node.value)
    const name = node.name.value
    const vtype = node.vartype // 変数 or 定数
    // 二重定義？
    if (this.__vars[name] !== undefined)
      {throw new NakoGenError(
        `${vtype}『${name}』の二重定義はできません。`,
        node.line)}

    //
    this.__vars[name] = true
    if (vtype === '定数') {
      if (!this.__vars.meta)
        {this.__vars.meta = {}}

      if (!this.__vars.meta[name]) {this.__vars.meta[name] = {}}
      this.__vars.meta[name].readonly = true
    }
    return new JavaScriptCode(node).push(NakoGen.convLineno(node, false), `__vars["`, name, `"]=`, value, `;\n`)
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convString (node) {
    let value = '' + node.value
    let mode = node.mode
    value = value.replace(/\\/g, '\\\\')
    value = value.replace(/"/g, '\\"')
    value = value.replace(/\r/g, '\\r')
    value = value.replace(/\n/g, '\\n')
    if (mode === 'ex') {
      let rf = (a, name) => {
        return '"+' + this.genVar(name) + '+"'
      }
      value = value.replace(/\{(.+?)\}/g, rf)
      value = value.replace(/｛(.+?)｝/g, rf)
    }
    return new JavaScriptCode(node).push('"', value, '"')
  }

  /**
   * @param {Ast} node
   * @returns {JavaScriptCode}
   */
  convTryExcept(node) {
    const block = this._convGen(node.block)
    const errBlock = this._convGen(node.errBlock)
    return new JavaScriptCode(node).push(
      NakoGen.convLineno(node, false),
      `try {\n`,
      block,
      `\n} catch (e) {\n`,
      '__varslist[0]["エラーメッセージ"] = e.message;\n',
      ';\n',
      errBlock,
      `}\n`,
    )
  }
}

module.exports = {
  JavaScriptCode,
  NakoGen,
}
