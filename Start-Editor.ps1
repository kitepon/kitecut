# 完成版の依存と採用モデルを用意し、最後の編集を再開する。
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& (Join-Path $PSScriptRoot 'experiments/prepare-dependencies.ps1') -ToolsOnly
if(-not $?){throw '公式ツールの導入に失敗した'}
$candidate = Get-Content -Raw -LiteralPath 'experiments/frontstage.json' | ConvertFrom-Json
$sourceRoot = Join-Path $PSScriptRoot $candidate.workspace
if (-not (Test-Path -LiteralPath $sourceRoot)) {
    $bundle=Join-Path $PSScriptRoot 'distribution/frontstage.bundle'
    $source=if(Test-Path -LiteralPath $bundle){$bundle}else{$candidate.repository}
    git clone --no-checkout $source $sourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'Frontstageの取得に失敗した' }
    git -C $sourceRoot checkout --detach $candidate.revision
    if ($LASTEXITCODE -ne 0) { throw '採用したコミットへ切り替えられなかった' }
}
& (Join-Path $PSScriptRoot 'experiments/prepare-dependencies.ps1')
if(-not $?){throw '依存と採用モデルの導入に失敗した'}
node experiments/prepare-editor-update.mjs
if ($LASTEXITCODE -ne 0) { throw '更新前の編集保存・終了に失敗した' }
uv run --no-project --python 3.12 experiments/update-editor-source.py
if ($LASTEXITCODE -ne 0) { throw '編集用差分の更新に失敗した' }
$fontDestination = Join-Path $sourceRoot 'apps/desktop/src/renderer/public/fonts'
New-Item -ItemType Directory -Path $fontDestination -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'experiments/fonts') -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $fontDestination -Force }
$dependencies=Get-Content distribution/dependencies.json -Raw|ConvertFrom-Json
npx --yes "pnpm@$($dependencies.pnpm)" --dir $sourceRoot install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw '公式依存パッケージの導入に失敗した' }
node experiments/open-editor.mjs
if ($LASTEXITCODE -ne 0) { throw '編集アプリの起動に失敗した' }
