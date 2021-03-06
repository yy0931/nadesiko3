/**
 * 助詞の一覧
 */

const josiList = [
  'について', 'くらい', 'なのか', 'までを', 'までの', 'による', 'である',
  'とは', 'から', 'まで', 'だけ', 'より', 'ほど', 'など',
  'いて', 'えて', 'きて', 'けて', 'して', 'って', 'にて', 'みて',
  'めて', 'ねて', 'では', 'には', 'は~', 'んで', 'こと',
  'は', 'を', 'に', 'へ', 'で', 'と', 'が', 'の'
]
// ただし「こと」は「＊＊すること」のように使う特殊な助詞 #936
// 「である」は「＊＊である」のように使う特殊な助詞 #939

const tararebaJosiList = [
  'でなければ', 'なければ', 'ならば', 'なら', 'たら', 'れば'
]

// 一覧をプログラムで扱いやすいようマップに変換
const tarareba = {}
tararebaJosiList.forEach(e => {
  josiList.push(e)
  tarareba[e] = true
})

// 文字数の長い順に並び替え
josiList.sort((a, b) => b.length - a.length)

// 正規表現で助詞をマッチできるようにする
const josiRE = new RegExp('^(' + josiList.join('|') + ')')

module.exports = {
  tarareba,
  josiRE
}
