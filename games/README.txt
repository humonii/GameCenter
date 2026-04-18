# Feeling Game Collection

## 変更点
- `games/index.html` をゲーム選択ランチャーに変更
- 選択時に、DSのカセットを差し込むような立体エフェクトを追加
- クイズ本体を `quiz.html` に整理
- 古い `quize.html` からは自動で `quiz.html` へ移動
- 効果音がなかったゲームに効果音を追加
  - `car.html`
  - `ice-cream.html`
  - `quiz.html`
- 各ゲームに `← ゲーム選択` ボタンを追加

## ファイル構成
- `../index.html` : ルートから開いたときの案内 / リダイレクト
- `index.html` : ゲーム選択画面
- `car.html`
- `ice-cream.html`
- `rhythm.html`
- `sushi.html`
- `quiz.html`
- `quize.html` : 旧ファイル名からのリダイレクト

## 起動方法
### いちばん簡単
ZIPを展開して、`games/index.html` を開いてください。ローカルサーバーで開く場合は現在の games フォルダを自動検出します。

### 単体 HTML について
- `car.html` / `ice-cream.html` / `rhythm.html` / `sushi.html` / `quiz.html` / `sky-ribbon-rise-racer-start.html` / `taikan-groove-theater-sound-racer-start.html` は、ゲーム本体としては単一 HTML で完結しています。
- `games/index.html` はランチャー画面なので、`launcher-sync.js` を読み込みます。


## AI でゲームを増やすとき
- `../game-template.html` と `../AI-GAME-PROMPT-TEMPLATE.md` を AI に渡してください。
- 完成物は **追加ファイルなしの単一 HTML** を前提にしています。画像 / 音声 / JSON / CSV / 別 JS / 別 CSS を増やさず、`games/` に置くだけで起動できる形にしてください。
- `file://` で直接開く場合は、初回だけ `Game（games）フォルダ` を選ぶと次回以降は自動で同じフォルダを読み込みます。

## 今回の確認
- `games/car.html` は単一 HTML のまま動作します。
- `games/sky-ribbon-rise-racer-start.html` は外部 BGM 参照をやめ、単一 HTML で動く形に更新しました。
- この 2 本はそのまま `games/` フォルダ内にあります。
