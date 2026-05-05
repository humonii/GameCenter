# AIゲーム作成プロンプト雛形

以下の `game-template.html` を土台に、新規ゲームを 1 本作成してください。
最終目的は、生成した HTML を `games/` フォルダへ置くだけで使えるようにすることです。ランチャー一覧への即時反映は、`watch_games_manifest.py` または `start_game_center.bat` が更新する `games-manifest.js` を前提にします。

## 固定制約
1. 生成物は **完成済みの HTML 1 ファイル** とする。保存先は `games/<slug>.html`。
2. `head` 内の `game:title / game:tag / game:cover / game:cover-color / game:emoji / game:order` を必ず設定する。
3. `homeButton / #app / #stage / #introOverlay / #phaseBadge / #microcopy / #soundToggle / #startButton / #controllerSelect` の id は変更しない。
4. 開始画面には必ず **タイトル / 1 プレイ説明 / 操作方法 / 失敗時の扱い / 入力方法選択 / 入力状態 / 開始ボタン** を含める。
5. 開始画面には **十字キー / キーボード** と **ゲームコントローラー** の両方の選択肢を残す。
6. `syncHomeButtonHref()` と `registerGameInLauncher()` は削除しない。
7. `Esc` または `Start / Menu` でゲーム選択へ戻れるようにする。
8. 外部ライブラリ、`type="module"`、ビルド手順、Webpack/Vite 前提、CDN 依存は禁止。
9. **追加ファイル禁止。** 画像 / 音声 / JSON / CSV / フォント / 動画 / 別 JS / 別 CSS を増やさず、1 本の HTML にすべて内包する。`fetch()` や外部 URL 読込も禁止。
10. **キーボード / ゲームパッドとも既定は `左 / 右 / 前` の 3 系統を基本とし、回転入力は作らない。** LB / RB / LT / RT や右スティック回転を前提にしない。
11. タッチ操作ボタンを置く場合も、開始画面で選んだ入力モードと矛盾しないようにする。
12. `index.html` や `launcher-sync.js` の追加修正を前提にしない。
13. 1 プレイは短時間で完結させ、開始後すぐ遊べる構成にする。

## 出力要件
- 完成した HTML 本文をそのまま返す。
- ファイル名案を 1 つ添える。
- 追加ファイルは作らない。画像や音は HTML 内に埋め込むか、Canvas / SVG / WebAudio で生成する。

## 実装チェックリスト
- 開始画面がある
- 操作説明がある
- 入力方法選択がある
- 戻る導線がある
- `game:*` meta が埋まっている
- 追加ファイルなしの自己完結 HTML になっている
- キーボード / ゲームパッドとも不要な回転入力を出していない

## 今回のゲーム仕様
ここに今回作りたいゲーム内容を書いてください。
例:
- テーマ
- ルール
- スコア条件
- 1 プレイ時間
- 使用したい入力（キーボード / ゲームパッド / タッチ）
- 演出や世界観
