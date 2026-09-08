# KiteCutを扱うAIへ

KiteCutは、人と操作者AIが共通のタイムラインで動画を編集するWindowsアプリです。利用の入口は [README](README.md)、APIの入口は [AI操作案内](docs/ai-usage.md)、開発の入口は [CONTRIBUTING](CONTRIBUTING.md) です。

## 動画を編集する

- 構成・コピー・カット・完成品の判断は操作者AIが担います。補助モデルへ同じ編集判断を繰り返し依頼しません。
- 操作名と引数は `node experiments/mcp-client.mjs tools` で確認し、公開APIから操作します。
- 人が編集した後は最新の状態を読み直します。観察と編集結果の時刻、映像、音声を確認してから完成とします。

## ソースを変更する

- 固定版と改変差分は `experiments/frontstage.json`、依存と利用条件は `distribution/` が案内します。
- 改変ソースは起動時に `.work/frontstage` へ展開されます。変更を公開するには、対応する差分も更新してください。
- 変更した機能の試験を行い、公開前に `node scripts/check-source.mjs` で復元を確認します。この検査はGPU処理や画面操作の試験を代行しません。
- Frontstageの著作権とGPL-3.0の表示を保持します。作品、認証情報、モデル重みはソースへ含めません。

