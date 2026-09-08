# 正規入口から呼ぶ。公式パッケージと採用版を配置し、端末固有の場所は.workへ記録する。
param([switch]$ToolsOnly)
$ErrorActionPreference='Stop'
$movieRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $movieRoot
function Refresh-ToolPath {
    $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')+';'+$env:Path
}
function Ensure-Tool([string]$Command,[string]$Package) {
    if(Get-Command $Command -ErrorAction SilentlyContinue){return}
    Write-Host "$Command を公式パッケージから導入します。"
    & winget install --id $Package --exact --silent --accept-package-agreements --accept-source-agreements
    if($LASTEXITCODE){throw "$Package の導入に失敗しました"}
    Refresh-ToolPath
    if(-not(Get-Command $Command -ErrorAction SilentlyContinue)){throw "$Command の導入後に実行入口を確認できません"}
}
Ensure-Tool git Git.Git
Ensure-Tool node OpenJS.NodeJS.LTS
Ensure-Tool uv astral-sh.uv
if($ToolsOnly){return}
$settings=Get-Content distribution/dependencies.json -Raw|ConvertFrom-Json
New-Item -ItemType Directory -Force .work/distribution | Out-Null
foreach($environment in $settings.environments){
    $python=Join-Path $movieRoot ($environment.path+'/Scripts/python.exe')
    if(-not(Test-Path -LiteralPath $python)){
        & uv venv --python $settings.python --managed-python (Join-Path $movieRoot $environment.path)
        if($LASTEXITCODE){throw "$($environment.name) のPython環境を作れません"}
    }
    if($environment.torch.Count){
        & uv pip install --python $python --index-url $settings.torchIndex @($environment.torch)
        if($LASTEXITCODE){throw "$($environment.name) のPyTorch導入に失敗しました"}
    }
    & uv pip install --python $python -r ('distribution/requirements/'+$environment.name+'.txt')
    if($LASTEXITCODE){throw "$($environment.name) の依存導入に失敗しました"}
}
$inkscape=Join-Path $env:ProgramFiles 'Inkscape/bin/inkscape.com'
if(-not(Test-Path -LiteralPath $inkscape)){
    & winget install --id Inkscape.Inkscape --exact --silent --accept-package-agreements --accept-source-agreements
    if($LASTEXITCODE -or -not(Test-Path -LiteralPath $inkscape)){throw 'Inkscapeを導入できません'}
}
$sevenZip=Join-Path $env:ProgramFiles '7-Zip/7z.exe'
if(-not(Test-Path -LiteralPath $sevenZip)){
    & winget install --id 7zip.7zip --exact --silent --accept-package-agreements --accept-source-agreements
    if($LASTEXITCODE -or -not(Test-Path -LiteralPath $sevenZip)){throw '7-Zipを導入できません'}
}
function Install-OfficialArchive($Url,$Hash,$Archive,$Destination) {
    if(-not(Test-Path -LiteralPath $Archive)){Invoke-WebRequest -Uri $Url -OutFile $Archive}
    if((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash){throw "取得した公式配布のハッシュが一致しません: $Archive"}
    & $sevenZip x $Archive "-o$Destination" -y
    if($LASTEXITCODE){throw "公式配布を展開できません: $Archive"}
}
$nemo=Join-Path $movieRoot $settings.nemo.path
if(-not(Test-Path -LiteralPath (Join-Path $nemo 'windows-cpu/run.exe'))){
    Install-OfficialArchive $settings.nemo.url $settings.nemo.sha256 (Join-Path $movieRoot '.work/distribution/nemo.7z.001') $nemo
}
# 既存Portableは端末設定で場所を指定し、新規導入はアプリ配下へ置く。
$localSettings=Join-Path $movieRoot '.work/dependency-locations.json'
$locations=if(Test-Path -LiteralPath $localSettings){Get-Content -LiteralPath $localSettings -Raw|ConvertFrom-Json}else{$null}
$comfyRoot=if($env:MOVIE_COMFY_HOME){$env:MOVIE_COMFY_HOME}elseif($locations.comfyRoot){$locations.comfyRoot}else{Join-Path $movieRoot $settings.comfy.path}
if(-not(Test-Path -LiteralPath (Join-Path $comfyRoot 'python_embeded/python.exe'))){
    if($env:MOVIE_COMFY_HOME -or $locations.comfyRoot){throw '指定されたComfyUI Portableがありません'}
    Write-Host 'ComfyUIを公式Portable配布から導入します。'
    Install-OfficialArchive $settings.comfy.portableUrl $settings.comfy.sha256 (Join-Path $movieRoot '.work/distribution/comfyui.7z') (Join-Path $movieRoot '.work/comfyui')
}
Write-Host "画像・動画生成に使うComfyUI: $comfyRoot"
$wingetPackages=Join-Path $env:LOCALAPPDATA 'Microsoft/WinGet/Packages'
function Find-SharedFfmpeg {
    if(Test-Path -LiteralPath $wingetPackages){
        Get-ChildItem -LiteralPath $wingetPackages -Directory -Filter 'Gyan.FFmpeg.Shared_*' | ForEach-Object {
            Get-ChildItem -LiteralPath $_.FullName -Filter 'avcodec-*.dll' -Recurse -File | Select-Object -ExpandProperty DirectoryName
        } | Sort-Object -Unique | Select-Object -First 1
    }
}
$ffmpegDirectory=Find-SharedFfmpeg
if(-not $ffmpegDirectory){
    & winget install --id Gyan.FFmpeg.Shared --exact --silent --accept-package-agreements --accept-source-agreements
    if($LASTEXITCODE){throw '共有FFmpegの導入に失敗しました'}
    $ffmpegDirectory=Find-SharedFfmpeg
    if(-not $ffmpegDirectory){throw '共有FFmpegのDLLを確認できません'}
}
@{comfyRoot=[IO.Path]::GetFullPath($comfyRoot);ffmpegDirectory=$ffmpegDirectory}|ConvertTo-Json|Set-Content -LiteralPath $localSettings -Encoding utf8
& (Join-Path $movieRoot '.work/video-understanding/venv-videochat3/Scripts/python.exe') experiments/prepare-adopted-models.py
if($LASTEXITCODE){throw '採用モデルの配置に失敗しました'}
