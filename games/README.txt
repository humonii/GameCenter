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
ZIPを展開して、`games/index.html` を開いてください。

### クイズを使う場合の注意
クイズは CSV を `fetch()` で読むため、環境によってはファイルを直接開くと読み込めない場合があります。
その場合は次のどちらかでローカルサーバーを起動してください。

#### Python がある場合
```bash
cd FeelingGame
python -m http.server 8000
```
その後、ブラウザで `http://localhost:8000/games/` を開いてください。

#### VS Code を使う場合
Live Server などのローカルサーバー拡張で `FeelingGame` フォルダを開いてください。

## クイズのデータ場所
クイズは `../asset/manifest.json` と `../asset/*.csv` を参照します。
