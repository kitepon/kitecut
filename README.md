# KiteCut（カイトカット）

**AIと一緒に仕上げる動画編集アプリ — by kitepon**

動画を理解して構成を決めるAIと、人が同じタイムラインで編集するWindowsアプリ。AIの操作を画面で停止して手直しし、その状態から再開できる。動画・画像・字幕・図版・音声を編集し、作品を保存してMP4へ書き出せる。

## 起動と更新

現在はWindows向けのソース公開版。インストーラーはまだ提供していない。

```powershell
git clone https://github.com/kitepon/kitecut.git
cd kitecut
```

WindowsのPowerShell 7で、このフォルダーの `Start-Editor.ps1` を実行する。

```powershell
pwsh -NoProfile -File .\Start-Editor.ps1
```

初回は公式パッケージと採用モデルをダウンロードするため、インターネット接続と大きな空き容量が必要。Git、Node.js、uv、Inkscape、7-Zip、共有FFmpegがなければwingetで導入する。PowerShell 7とwingetは実行前に用意する。モデルの取得・生成にはAPIキーや従量課金サービスを使わない。

同じ入口を実行すると、編集中の内容を保存し、採用版の依存とソースへ更新して最後の作品を再開する。現在の作品に操作中の処理がある場合は、保存と終了が成立したことを確認してから更新する。配布物を更新するときは作品と `.work` を残し、新しい起動コード・採用台帳・差分を展開してから同じ入口を実行する。

採用元の版を更新するときは、旧編集コードを `.work/editor-backups` へ退避する。適用途中で失敗した場合は旧版の復元を確認してからエラーを表示する。編集コードを自分で変更していた場合や、新しいファイルと衝突する場合は、その内容を保持して更新を止める。

依存とモデルは `.work`、作品はアプリで選んだ保存先に置く。既存のComfyUI Portableを利用する場合は、初回起動時に `MOVIE_COMFY_HOME` 環境変数へそのフォルダーを指定できる。場所は `.work/dependency-locations.json` に保存される。指定がない新規環境はアプリ配下へ公式Portableを導入する。

## 編集する

1. 素材を取り込み、タイムラインへ配置する。接続カメラや画面の収録から取り込むこともできる。
2. AIが構成を決め、公開APIから編集する。変更は人が使う画面・履歴にも反映される。
3. 人が手直しするときはAI欄で「外部AIの後続操作を停止」を押す。再開後、AIは最新のタイムラインを読み直して続きを編集する。
4. 保存して再開できる。完成したら「書き出す」から動画を出力する。

標準声は採用済みのQwen3-TTSによる声質参照、落ち着いた声はVOICEVOX Nemo女声6を使う。Nemoの音声を使う作品には「VOICEVOX Nemo」を表記する。音声選定とモデル版は採用台帳に記録し、起動時に別モデルへ置き換えない。

字幕認識は初回使用時にWhisperのモデルを取得して端末へキャッシュする。画像・動画生成はローカルComfyUI、動画理解はVideoChat3を使用する。アプリ内の外部AIサービスには別途契約が必要なものもある。外部API課金を必須にせず、操作者AIは同梱の公開操作入口から直接編集できる。

```powershell
node experiments/mcp-client.mjs tools
node experiments/mcp-client.mjs get_timeline
```

## 実測した環境

Windows、NVIDIA RTX 5090（VRAM 32GB）で、動画理解、標準声、画像・動画生成と編集・書出しを確認した。GPU条件が異なる端末の速度や同時実行を保証する数値ではない。GPUを使うモデル処理は順番に実行する。録音・手ぶれ補正は撮影装置の処理も利用し、必要なときに適用する。

## 配布とソース

採用構成は [配布台帳](distribution/components.json)、第三者の権利は [同梱案内](THIRD_PARTY_NOTICES.md)、ソースのライセンス原文は [GPL-3.0](LICENSE) を参照する。元実演や個人の収録素材はソース配布に含まれない。

KiteCutは [Frontstage](https://github.com/x777/frontstage) を基盤に開発している。上流の固定ソースをGit bundle、変更を差分として同梱し、起動時に完全な編集用ソースを組み立てる。ソースの場所と変更手順は [開発案内](CONTRIBUTING.md) を参照。

`node experiments/build-distribution.mjs` で配布ファイルを作る。固定した上流ソース、改変差分、依存の採用台帳、起動用コード、書体とライセンスをまとめる。公開先への送信は行わない。
