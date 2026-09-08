# 同梱書体

書体・出典・収録ファイル・SHA-256・個別ライセンスは [catalog.json](catalog.json) を正本とする。公式 Google Fonts リポジトリの未改変フォントを収録し、個別の OFL 原文を同じフォルダに置く。書体は SIL Open Font License 1.1 に基づいて再配布でき、商用の映像制作にも利用できる。フォント単体の販売や改変時の予約名など、条件の詳細は各ライセンス原文に従う。

Start-Editor.ps1 がこのフォルダをアプリの公開リソースへ配置する。画面用は公式 Fontsource パッケージ、Inkscape の輪郭化用はここに収録した TTF を使う。書体の追加は catalog.json、core の生成カタログ、font-pack.ts、pnpm の依存、OFL を一緒に更新する。
