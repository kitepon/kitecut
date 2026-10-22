# 初回起動とUnicodeを含む動画検索

出典: KiteCutの公開ソースとWindowsでの実測、[LM Format EnforcerのTokenEnforcer](https://github.com/noamgat/lm-format-enforcer/blob/main/lmformatenforcer/tokenenforcer.py)、[Transformers接続](https://github.com/noamgat/lm-format-enforcer/blob/main/lmformatenforcer/integrations/transformers.py)。取得日: 2026-10-22。確度: 原因の最小再現と修理後の実行を確認。

## 公開モデルの取得

保存済みのHugging Face認証が期限切れだと、公開モデルの取得にも暗黙に認証が付いて401になる。同じ採用版の匿名要求は200だった。公開配布だけを扱う取得処理では、HfApi・snapshot_download・hf_hub_downloadへtoken=Falseを渡す。認証ファイルは変更しない。無効なHF_TOKENを指定した照会でも、匿名で採用版を取得できることを確認した。

## 新しい設定からの起動

新しいプロファイルのMCPは既定で無効だった。open-editor.mjsは有効化前にhealthzへ接続して終了していた。起動入口が使う認証付きローカルAPIは、rendererのdesktopMcp.setEnabled経由で有効にしてから照会する。実際に新しい設定から起動でき、再起動では保存作品を復元した。

## 日本語の途中でJSONが終了する原因

環境はlm-format-enforcer 0.11.3、Transformers 4.57.1、VideoChat3-4Bの採用版。採用tokenizerでは「緑」が2トークンに分かれ、TokenEnforcerTokenizerDataの文字集合に含まれなかった。自由文字列用の高速処理はそのトークンを許可したが、復元された「緑」を文字パーサーが受け取ると構文のスタックが空になり、JSONの引用符も配列も閉じていない状態で終了トークンを許可した。

生成済みトークンから復元された文字を、トークンを文字パーサーへ渡す前に許可文字集合へ反映する接続処理を加えた。JSONの制御文字は追加しない。欠けた引用符の補完、再推論、回答の置換は行わず、最終的なJSONと区間の検証を維持する。

scripts/test-video-json-prefix.pyは実際の採用tokenizerを使い、日本語・韓国語・絵文字を含むJSONを1トークンずつ進め、未完の時点では終了を許可せず、完成後だけ終了を許可することを確認する。GPU推論の代わりにはしない。

## 編集で確認したこと

RTX 5090のWindows端末で、新規導入、公開APIからの素材取り込み、映像とリンク音声の分割、取り消し・やり直し、映像と音声のトリム、日英の文字入れ、音量調整、標準声の日本語音声生成、作品保存と再起動後の復元、音声付きMP4への書き出しを確認した。練習素材は9秒から8秒へ編集し、1280×720・30fpsのH.264映像と48kHzのAAC音声を確認した。文字の合成結果は静止画と出力動画からの抽出画像で確認した。

修理後の実際の動画検索は完了した。ただしテストパターンの時刻表示を「時計の針」と表現するなど、モデルの観察には誤りがあった。構文の成功と観察内容の正しさは別であり、操作者が原映像と照合した範囲だけを根拠にする。今回の練習素材は実機デモの証拠ではない。
