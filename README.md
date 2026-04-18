# Feelingを用いたリハ・レク用のゲーム
## 使い方（ソフトウェアの設定）
1. クローンする
   
`git clone git@github.com:humonii/GameCenter.git`

3. index.htmlをブラウザ上で開く

---
### ゲームを選択する


https://github.com/user-attachments/assets/f44582af-137e-4306-af4b-946283200c92




---
## 使い方（ハードウェアの設定）
1. Feelingを起動する
2. Feelingソフトを起動する
3. Feeling for GAMESを接続する

---
# 開発の仕方
## GeminiやGPTに投げる方法
1. `game-template.html` と `AI-GAME-PROMPT-TEMPLATE.md` を AI に渡す
2. 作りたいゲーム仕様を追記して送信する
3. 生成した HTML は `games/` に、必要なアセットは `asset/` または `games/assets/` に格納する
4. ローカルサーバーで開く場合は、現在の `games/` フォルダを自動検出する
5. `file://` で直接開く場合は、初回だけ `Game（games）フォルダ` を選ぶと、次回以降は自動で同じフォルダを開く
