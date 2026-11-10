# 操作マニュアルの画面キャプチャ

アプリ内の操作マニュアル(`web/src/pages/Manual.tsx`、サイドメニュー「操作マニュアル」)に載せている画面の画像を撮るスクリプト。
画像は `web/public/manual/` に PNG で出力する。操作する場所には、本文の番号(`<N n={1} />` など)と対応する赤枠と番号を重ねる。

画面を変えたら、このスクリプトで撮り直す。番号の位置を変えたときは、`Manual.tsx` の説明文の番号も合わせる。

## 使い方

```bash
cd product-db
# 1. 手元でアプリを起動する(README の「方法2」。DB・API・SPA)
#    → http://localhost:5173 にログインできる状態にする
# 2. Playwright を用意する(初回のみ。リポジトリの依存には入れていない)
cd tools/manual-screenshots
npm init -y >/dev/null && npm i --no-save playwright && npx playwright install chromium
# 3. 撮る(出力先の既定は web/public/manual/)
node capture.mjs
```

| 環境変数 | 既定値 | 内容 |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:5173` | 撮影するアプリの URL |
| `MANUAL_EMAIL` / `MANUAL_PASSWORD` | seed の初期管理者 | ログインに使う管理者 |

## 注意

- `web/public/` の画像は、本番でもログインなしで配信される。業務上見せたくない値は写さない。
  仕入値は撮影時に伏せ字にしている(`maskCost`)。ほかに写したくない項目が出たら、同じように伏せるか、撮る範囲から外す。
- 本番の DB ではなく、手元の DB で撮る。ユーザー管理の画像に、実在の利用者のメールアドレスが写らないようにするため。
- 撮影用に作った `package.json`・`node_modules` はコミットしない。
