# 宝の迷宮 (Treasure Labyrinth) — Web / Farcaster Mini App

なぞって進むドット絵の迷路ゲーム。完全オフライン・広告なし・19言語対応。
これは Web公開版（Vercel配信・Farcaster Mini App対応）です。Play/AAB版は別リポジトリ。

## デプロイ（Vercel）
静的サイト（ビルド不要）。

1. このリポジトリを GitHub に push（`maimmaim20230728-blip/treasure_labyrinth_web`）。
2. Vercel で「New Project」→ このリポジトリを Import。
   - Framework Preset: **Other**（ビルドコマンド・出力ディレクトリともに空でOK＝ルートをそのまま配信）
   - Root Directory: `./`
3. デプロイ後のドメインを **`treasure-labyrinth-web.vercel.app`** に設定
   （※ farcaster.json / index.html / manifest 内の絶対URLがこのドメイン前提のため。別ドメインにする場合は各ファイルのURLを一括置換）。

## Farcaster Mini App 登録
1. デプロイ後、`https://treasure-labyrinth-web.vercel.app/.well-known/farcaster.json` が配信されることを確認。
2. Farcaster の Manifest / Mini App ツールで **accountAssociation（header/payload/signature）を署名**し、`.well-known/farcaster.json` の空欄を埋めて再 push。
3. ツールで Reverify → Submit して登録確定。

- 埋め込みカード画像: `icons/farcaster-embed.png`（1200×800・3:2）
- スプラッシュ: `icons/icon-192.png` / アイコン: `icons/icon-512.png`
- カード・OG画像の再生成: `node gen-store.js`（sharp が必要）

介護と支援の相談どころ「そよぎ」 https://soyogi.hp.peraichi.com/top
