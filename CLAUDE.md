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

- `lib.rs` — メイン: Builder, plugin登録, Tauriコマンド定義 (`open_comic`, `get_comic_info`)
- `archive.rs` — CBZ/CBR/画像フォルダからの画像抽出。画像をBase64 data URLに変換してフロントエンドに渡す

### Frontend (`src/`)

- `App.tsx` — ルーティング: Library画面 ↔ Viewer画面の切り替え。ドラッグ&ドロップ対応
- `components/Library.tsx` — 本棚画面: ファイルを開くボタン + 最近のファイル一覧
- `components/Viewer.tsx` — 閲覧画面: ページ表示、キーボード操作、クリックナビゲーション
- `hooks/useComic.ts` — コミックのページ管理 (読み込み、ページ遷移)
- `hooks/useSettings.ts` — 設定永続化 (読み方向、表示モード、履歴)。localStorage使用
- `lib/tauri.ts` — Tauri invokeラッパー
- `types/index.ts` — 型定義

## Key Design Decisions

- **Base64 data URL方式**: アーカイブ内の画像をBase64エンコードしてフロントエンドに渡す。Tauri asset protocolより実装がシンプル
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
