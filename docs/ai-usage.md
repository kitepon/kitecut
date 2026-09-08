# AIからKiteCutを操作する

操作者のAIが動画の内容と目的を理解し、構成・コピー・カットを決めます。KiteCutは公開APIから受けた操作を、人と共通のタイムラインと履歴へ反映します。

## 接続を確かめる

`Start-Editor.ps1` でアプリを起動した後、別のPowerShell 7でリポジトリのフォルダーへ移動し、次を実行します。

```powershell
node experiments/mcp-client.mjs tools
node experiments/mcp-client.mjs get_timeline
node experiments/mcp-client.mjs get_playback_state
```

`tools` は、そのアプリが公開している操作と入力形式を返します。操作名や引数はこの一覧を確認して使用してください。同梱クライアントはアプリの依存パッケージと認証トークンを読み、ローカルのMCPサーバーへ接続します。トークンを画面へ表示したり、チャットやIssueへ貼り付ける必要はありません。

## 画面と同じ状態を編集する

1. 現在の作品とタイムラインを読み、素材の観察結果と依頼から構成を決める。
2. 公開操作から素材の配置・カット・文字・音声を編集する。
3. プレビューと状態の読戻しで、時刻・画面・音を確かめる。
4. 人が手直しした後は最新状態を読み直し、そこから続きを編集する。
5. 保存・書出しの終了を確認し、完成した動画を見て仕上がりを判断する。

プレビューを再生・停止する例です。

```powershell
node experiments/mcp-client.mjs play_preview
node experiments/mcp-client.mjs pause_preview
```

スクリプトから使う場合は、同じクライアントを読み込めます。

```javascript
import { connect } from './experiments/mcp-client.mjs';
const { client, json } = await connect();
try {
  const timeline = await json('get_timeline');
  console.log(timeline);
} finally {
  await client.close();
}
```

人が操作を引き取るときは、AI欄の「外部AIの後続操作を停止」を使います。作品を直接書き換えると共通の履歴や画面との同期を通らないため、編集には公開APIを使ってください。

## 補助モデルの役割

動画理解は採用済みVideoChat3、素材生成や読み上げは採用台帳のモデルを使います。構成や編集判断を補助モデルに再決定させる処理は置いていません。採用版・利用条件は [配布台帳](../distribution/components.json) と各採用ファイルに記録しています。

[トップページへ戻る](../README.md)

