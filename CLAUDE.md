# Mekuri

macOS向けの軽量ローカル漫画/コミックリーダー。CBZ/CBR/画像フォルダを開いて閲覧できる。

## Tech Stack

- **Tauri v2** (Rust backend)
- **React + Vite + TypeScript** (frontend)
- **pnpm** (package manager)
- **zip** crate — CBZ (ZIP) アーカイブ展開
- **unrar** crate — CBR (RAR) アーカイブ展開

## Architecture

### Rust Backend (`src-tauri/src/`)

- `lib.rs` — メイン: Builder, plugin登録, Tauriコマンド定義 (`open_comic_meta`), `mekuri:` URIスキームの登録
- `archive.rs` — CBZ/CBR/画像フォルダからの画像抽出。開いたコミックを `ComicStore` に保持し、ページのバイト列を返す

### Frontend (`src/`)

- `App.tsx` — ルーティング: Library画面 ↔ Viewer画面の切り替え。ドラッグ&ドロップ対応
- `components/Library.tsx` — 本棚画面: ファイルを開くボタン + 最近のファイル一覧
- `components/Viewer.tsx` — 閲覧画面: ページ表示、キーボード操作、クリックナビゲーション
- `hooks/useComic.ts` — コミックのページ管理 (読み込み、ページ遷移)
- `hooks/useSettings.ts` — 設定永続化 (読み方向、表示モード、履歴)。localStorage使用
- `lib/tauri.ts` — Tauri invokeラッパー
- `types/index.ts` — 型定義

## Key Design Decisions

- **`mekuri:` URIスキーム**: ページ画像は `mekuri://localhost/page/<generation>/<index>`（Windows/Android では `http://mekuri.localhost/...`）で生のバイト列のまま配る。Base64 で IPC に載せると 33% 膨らむため。generation はコミックを開くたびに変わり、前のコミックの画像が出ることはない
- **アーカイブは開いたまま保持**: CBZ は ZipArchive を保持してページごとに読む。CBR は先頭から順にしか読めないため、一覧は開いたときに一度だけ作り、未取得のページを要求されたら前後の数ページをまとめて1回の走査で取り出し、件数上限つきでメモリに置く
- **ダークテーマ固定**: 漫画リーダーとして背景は暗い方が読みやすいため
- **RTLデフォルト**: 日本の漫画が主な用途のため右から左がデフォルト
- **localStorage使用**: 設定と履歴はlocalStorageに保存。tauri-plugin-storeは将来の拡張用に依存に含めている

## Commands

```bash
pnpm tauri dev      # 開発サーバー起動
```

## ビルド

```bash
APPLE_SIGNING_IDENTITY="-" pnpm tauri build
```
