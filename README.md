# Feeling GameCenter

GitHub Pagesなどの静的ホスティングでも動くゲームセンターです。
ローカル確認では **`start_game_center.bat`**（Windows）または **`start_game_center.command`**（macOS）を使ってください。

## 使い方

1. GitHub Pagesへこのフォルダを公開
2. 公開URLの `index.html` を開く
3. ブラウザが開いたら、そのままゲームを選択

ローカルで確認する場合は `start_game_center.bat` / `start_game_center.command` / `python3 start_game_center.py` を実行してください。

## この版の仕様

- GitHub Pagesでは `games/games-manifest.js` からゲーム一覧を読み込みます
- ローカルサーバー経由では `games` フォルダへの **追加 / 削除** が選択画面へ自動反映されます
- `file://` で HTML を直接開くと、PlayCanvas の `config.json` や音声ファイルがブラウザにブロックされます

## 今回の修正

- **スカイリボン・ライズ**
  - 音まわりを安全側に修正
  - 音声初期化や再生エラーが出た場合は、音だけ自動停止してゲーム本体は継続するように変更
  - リザルト画面・タブ非表示・終了時に音を確実に停止するように修正

- **ゲーム選択画面**
  - GitHub Pages向けの静的 `games-manifest.js` を追加
  - 起動スクリプト専用のライブ一覧 API を追加
  - `games` フォルダの追加 / 削除を自動反映
  - 直接 HTML を開いたときは、HTTP/HTTPSで開く案内を出すように変更

## 同梱ファイル

- `start_game_center.py` : ローカルサーバー起動
- `start_game_center.bat` / `start_game_center.command` : 起動用
- `games/` : 実ゲーム本体
- `games/games-manifest.js` : GitHub Pages向けの静的ゲーム一覧
- `asset/` : クイズ用データ
