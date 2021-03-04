const assert = require('assert')
const NakoCompiler = require('../src/nako3')

describe('flow_test', () => {
  const nako = new NakoCompiler()
  // nako.logger.addSimpleLogger('trace')
  const cmp = (code, res) => {
    nako.logger.debug('code=' + code)
    assert.strictEqual(nako.runReset(code).log, res)
  }
  it('もし', () => {
    cmp('もし3>1ならば「あ」と表示。', 'あ')
    cmp('もし3<1ならば「あ」と表示。違えば「い」と表示。', 'い')
  })
  it('もし - AがBならば', () => {
    cmp('もし3が3ならば\n「OK」と表示。\n違えば\n「NG」と表示。\nここまで\n', 'OK')
  })
  it('もし - ネスト', () => {
    cmp('A=5\n' +
      'もしAが3以上ならば\n' +
      '　　もしA=5ならば\n' +
      '　　　　「OK」と表示。\n' +
      '　　違えば\n' +
      '　　　　「NG」と表示。\n' +
      '　　ここまで。\n' +
      '違えば\n' +
      '　　「NG」と表示。\n' +
      'ここまで。\n', 'OK')
    cmp('A=1\n' +
      'もしAが3以上ならば\n' +
      '　　もしA=5ならば\n' +
      '　　　　「NG」と表示。\n' +
      '　　違えば\n' +
      '　　　　「NG」と表示。\n' +
      '　　ここまで。\n' +
      '違えば\n' +
      '　　「OK」と表示。\n' +
      'ここまで。\n', 'OK')
  })
  it('もし - ネスト - 違えばの一致', () => {
    cmp('A=2\n' +
      'もしAが3以上ならば\n' +
      '　　もしA=5ならば\n' +
      '　　　　「NG」と表示。\n' +
      '　　ここまで\n' +
      '違えば\n' +
      '　　「OK」と表示。\n' +
      'ここまで。\n' +
      '', 'OK')
  })
  it('回', () => {
    cmp('3回「あ」と表示。', 'あ\nあ\nあ')
    cmp('A=3;(A)回、Aを表示。', '3\n3\n3')
  })
  it('回、ここから', () => {
    cmp('A=3;(A)回、ここから\nAを表示。\nここまで\n', '3\n3\n3')
    cmp('A=3;(A)回ここから\nAを表示。\nここまで\n', '3\n3\n3')
  })
  it('回 - 「それ」の自動挿入', () => {
    cmp('1と2を足す\n回\n1を表示\nここまで', '1\n1\n1')
  })
  it('の間', () => {
    cmp('N=3;\n(N>0)の間\nNを表示\nN=N-1\nここまで', '3\n2\n1')
  })
  it('の間、ここから', () => {
    cmp('N=3;\n(N>0)の間、ここから\nNを表示\nN=N-1\nここまで', '3\n2\n1')
    cmp('N=3;\n(N>0)の間ここから\nNを表示\nN=N-1\nここまで', '3\n2\n1')
  })
  it('一致する間', () => {
    cmp('●（AとBが）超一致するとは\n' +
        '    それはAとBが等しい\n' +
        'ここまで\n' +
        'a=1\n' +
        'i=0\n' +
        'aと1が超一致する間\n' +
        '    iを表示\n' +
        '    i=i+1\n' +
        '    もしiが3以上ならば\n' +
        '        a=0\n' +
        '    ここまで\n' +
        'ここまで',
        // ---
        '0\n1\n2')
  })
  it('等しい間', () => {
    cmp('a=1\n' +
        'i=0\n' +
        'aと1が等しい間\n' +
        '    iを表示\n' +
        '    i=i+1\n' +
        '    もしiが3以上ならば\n' +
        '        a=0\n' +
        '    ここまで\n' +
        'ここまで',
        // ---
        '0\n1\n2')
  })
  it('未満の間', () => {
    cmp('i=0' +
        'iが3未満の間\n' +
        '    iを表示\n' +
        '    i=i+1\n' +
        'ここまで',
        // ---
        '0\n1\n2')
  })
  it('超えの間', () => {
    cmp('i=0' +
        'iが-3超えの間\n' +
        '    iを表示\n' +
        '    i=i-1\n' +
        'ここまで',
        // ---
        '0\n-1\n-2')
  })
  it('範囲内の間', () => {
    cmp('i=0' +
        'iが-3から3の範囲内の間\n' +
        '    iを表示\n' +
        '    i=i+1\n' +
        'ここまで',
        // ---
        '0\n1\n2\n3')
  })
  it('繰り返す', () => {
    cmp('Nを1から3まで繰り返す\nNを表示\nここまで', '1\n2\n3')
    cmp('Nを１から３まで繰り返す\n　　Nを表示\nここまで', '1\n2\n3')
  })
  it('繰り返す2', () => {
    cmp('1から3まで繰り返す\nそれを表示\nここまで', '1\n2\n3')
  })
  it('連続計算', () => {
    cmp('3に5を足してNに代入;Nを表示', '8')
    cmp('3に5を足して2を掛けて表示', '16')
  })
  it('もし-日本語による比較', () => {
    cmp('もし3が3と等しいならば「OK」と表示。', 'OK')
    cmp('もし(3+2)が5と等しいならば「OK」と表示。', 'OK')
    cmp('もし(3+2)が1以上ならば「OK」と表示。', 'OK')
    cmp('もし3が5未満ならば「OK」と表示。', 'OK')
    cmp('もし(3+10)が(5+10)以下ならば「OK」と表示。', 'OK')
  })
  it('もし--一行文。違えば', () => {
    cmp('もし(3+10)が5以下ならば「ng」と表示。違えば「ok」と表示。', 'ok')
  })
  it('もし-しなければ', () => {
    cmp('もし{ "a": 30 }に「b」がハッシュキー存在しなければ\n「ok」と表示\nここまで', 'ok')
    cmp('もし1と2が等しくなければ\n「ok」と表示\nここまで', 'ok')
  })
  it('回-break', () => {
    cmp('3回\n\'a\'と表示。もし(回数=2)ならば、抜ける;\n;ここまで;', 'a\na')
    cmp('3回\n\'a\'と表示。もし、回数が2ならば、抜ける;\n;ここまで;', 'a\na')
  })
  it('反復 - 配列', () => {
    cmp('[1,2,3]を反復\n対象を表示\nここまで\n', '1\n2\n3')
  })
  it('反復 - オブジェクト', () => {
    cmp('{\'a\':1,\'b\':2,\'c\':3}を反復\n対象を表示\nここまで\n', '1\n2\n3')
    cmp('{\'a\':1,\'b\':2,\'c\':3}を反復\n対象キーを表示\nここまで\n', 'a\nb\nc')
  })
  it('反復 - 変数付き', () => {
    cmp('A=[1,2,3];NでAを反復\nNを表示\nここまで\n', '1\n2\n3')
    cmp('Nで[1,2,3]を反復\nNを表示\nここまで\n', '1\n2\n3')
  })
  it('反復2 - 変数付き', () => {
    cmp('A=[[3,30],[1,10],[2,20]];NでAを反復\nN[1]を表示\nここまで\n', '30\n10\n20')
  })
  it('反復 - prototypeを無視', () => {
    cmp('f=『function F(){}; F.prototype.foo = 20; const f = new F(); f.p1 = 10; f』をJS実行。fを反復して表示', '10')
  })
  it('ここから反復', () => {
    cmp('それは[1,2,3];ここから反復\n表示\nここまで\n', '1\n2\n3')
  })
  it('ここから繰り返し', () => {
    cmp('ここから1から3まで繰り返し\n表示\nここまで\n', '1\n2\n3')
  })
  it('ここから3回', () => {
    cmp('ここから3回\n表示\nここまで\n', '1\n2\n3')
  })
  it('不等号', () => {
    cmp('もし、5≧5ならば、「あ」と表示。', 'あ')
    cmp('もし、5≧3ならば、「あ」と表示。', 'あ')
    cmp('もし、5≦5ならば、「あ」と表示。', 'あ')
    cmp('もし、3≦5ならば、「あ」と表示。', 'あ')
    cmp('もし、5＝5ならば、「あ」と表示。', 'あ')
    cmp('もし、3≠5ならば、「あ」と表示。', 'あ')
  })
  it('繰り返しのネスト', () => {
    cmp('C=0;Iを0から3まで繰り返す\nJを0から3まで繰り返す\nC=C+1;ここまで;ここまで;Cを表示', '16')
  })
  it('繰り返し:AからBまででA>Bの時', () => {
    cmp('Iを3から0まで繰り返す;Iを表示;ここまで', '3\n2\n1\n0')
    cmp('Iを11から9まで繰り返す;Iを表示;ここまで', '11\n10\n9')
  })
  it('繰り返し:AからBまででA>Bの時', () => {
    cmp('Iを3から0まで繰り返す;Iを表示;ここまで', '3\n2\n1\n0')
    cmp('Iを11から9まで繰り返す;Iを表示;ここまで', '11\n10\n9')
  })
  it('もし、と戻るの組み合わせ', () => {
    cmp('●テスト処理\n' +
        '　　「あ」と表示\n' +
        '　　もし、3=3ならば、戻る。\n' +
        '　　「ここには来ない」と表示\n' +
        'ここまで\n' +
        'テスト処理。', 'あ')
    cmp('●(Sを)テスト処理\n' +
        '　　Sを大文字変換して表示。\n' +
        '　　もし、そうならば、戻る。\n' +
        '　　「ここには来ない」と表示\n' +
        'ここまで\n' +
        '「a」をテスト処理。', 'A')
  })
  it('もしと抜けるの組み合わせ', () => {
    cmp('Iを1から3まで繰り返す\n' +
        '　　「あ」と表示\n' +
        '　　もし、I=2ならば、抜ける。\n' +
        '　　「い」と表示\n' +
        'ここまで\n', 'あ\nい\nあ')
    cmp('Iを1から3まで繰り返す\n' +
        '　　2回、「あ」と表示。\n' +
        '　　もし、I=2ならば、抜ける。\n' +
        '　　「い」と表示\n' +
        'ここまで\n', 'あ\nあ\nい\nあ\nあ')
    cmp('Iを1から3まで繰り返す\n' +
        '　　「あ」と表示\n' +
        '　　もし、I=2ならば、「う」と表示して、抜ける。\n' +
        '　　「い」と表示\n' +
        'ここまで\n', 'あ\nい\nあ\nう')
  })
  it('もし文のエラー(#378)', () => {
    cmp('●AAAとは\n' +
        '　　列を1から3まで繰り返す。\n' +
        '   　　列を表示。'+
        '　　　　もし、列=2ならば、「*」と表示。\n' +
        '　　ここまで。\n' +
        'ここまで\n' +
        'AAA', '1\n2\n*\n3')
  })
  it('条件分岐(#694)', () => {
    cmp('2で条件分岐\n' +
        '  1ならば\n「a」と表示\nここまで\n' +
        '  2ならば\n「b」と表示\nここまで\n' +
        '  3ならば\n「c」と表示\nここまで\n' +
        '  違えば\n「d」と表示\nここまで\n' +
        'ここまで\n',
        'b')
    cmp('3で条件分岐\n' +
    '  1ならば\n「a」と表示\nここまで\n' +
    '  2ならば\n「b」と表示\nここまで\n' +
    '  3ならば\n「c」と表示\nここまで\n' +
    '  違えば\n「d」と表示\nここまで\n' +
    'ここまで\n',
    'c')
    cmp('5で条件分岐\n' +
    '  1ならば\n「a」と表示\nここまで\n' +
    '  2ならば\n「b」と表示\nここまで\n' +
    '  3ならば\n「c」と表示\nここまで\n' +
    '  違えば\n「d」と表示\nここまで\n' +
    'ここまで\n',
    'd')
  })
  it('条件分岐で違えばを省略', () => {
    cmp('2で条件分岐\n' +
        '  1ならば\n「a」と表示\nここまで\n' +
        '  2ならば\n「b」と表示\nここまで\n' +
        '  3ならば\n「c」と表示\nここまで\n' +
        'ここまで\n',
        'b')
    cmp('5で条件分岐\n' +
    '  1ならば\n「a」と表示\nここまで\n' +
    '  2ならば\n「b」と表示\nここまで\n' +
    '  3ならば\n「c」と表示\nここまで\n' +
    'ここまで\n',
    '')
  })
  it('N回をN|回に分ける', () => {
    cmp('S="";N=3;N回、S=S&"a";Sを表示。', 'aaa')
    cmp('S="";N=3;N回\nS=S&"a";💧;Sを表示。', 'aaa')
  })
})

