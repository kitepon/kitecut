# KiteCutの開発

KiteCutの公開ソースは、起動・更新コード、固定したFrontstageのソース、改変差分で構成する。制作素材とモデル重みは含めない。

## ソースを読む・変更する

`Start-Editor.ps1` を実行すると、`experiments/frontstage.json` の版に同梱差分を適用し、`.work/frontstage` に完全なソースを展開する。UIは `packages/ui`、編集データと操作は `packages/core`、再生・書出しは `packages/engine`、AI操作は `packages/ai`、Windowsとの接続は `apps/desktop` にある。

モデルを取得せずにソースだけを展開する場合は、PowerShell 7で次を実行する。

```powershell
$adopted = Get-Content experiments/frontstage.json -Raw | ConvertFrom-Json
git clone --no-checkout distribution/frontstage.bundle .work/frontstage
git -C .work/frontstage checkout --detach $adopted.revision
foreach ($patch in $adopted.patches) {
    git -C .work/frontstage apply -- (Join-Path $PWD $patch)
    if ($LASTEXITCODE -ne 0) { throw '差分の適用に失敗した' }
}
```

この手動展開はコード閲覧・開発用。通常の起動と更新は `Start-Editor.ps1` を使う。起動入口は編集用ソースの手修正を検出すると上書きを止める。

改変差分には機能別のテストも含む。対象パッケージで依存を導入し、変更した機能に対応するVitestのテストを実行する。起動用コードの採用版は `distribution/dependencies.json`、モデルと第三者の条件は `distribution/components.json` を参照する。

不具合の報告には、再現手順、期待した動作、実際の動作、OS・GPU、利用したコミットを添えて [Issues](https://github.com/kitepon/kitecut/issues) へ。作品、認証情報、個人の収録素材は添付しない。

## ライセンス

KiteCutの改変ソースと起動コードはGPL-3.0で提供する。Frontstageの著作権・ライセンス表記を保持する。依存ソフト、フォント、モデルの条件は [第三者の権利](THIRD_PARTY_NOTICES.md) に記載している。

## 公開ソースの検証

`node scripts/check-source.mjs` で、同梱bundleと差分から新しい作業領域へソースを復元し、採用版・参照音声・書体・JavaScriptの構文・文書のローカルリンクを確認します。追加パッケージとモデル重みは取得しません。Windows上のCIも同じ入口を実行します。

このCIはソース配布の検証です。編集機能の試験、GPUでの生成、映像と音声の仕上がりは、変更した機能に応じて別途確認してください。

改変を提案するときは、対象の差分と機能別テストを更新し、何を確認したかをPRに記載してください。大きな設計変更は先にIssueで目的と影響を相談できます。
