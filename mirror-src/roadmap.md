# AI-DLC Workflows 2.0 - ロードマップ

2026-08-10 時点のステータス。

- 現在の v2 バージョンは **2.5.62**（`origin/v2` tip `18bcc468`）である。バージョン番号はコミット済みの framework ツリーを表し、GitHub Releases ではない。
- AI-DLC Workflows 2.0 は **GA** である。README での発表は、reviewer-as-verifier と 3 ロールアンサンブルのマイルストーンが出荷された後、#627 で行われた。
- リリース公開は v2 ブランチとまだ揃っていない: GitHub は依然として `v1.0.1` を Latest としており、#635 で追跡している。パッケージングとリリース配布は #722 で再検討中である。

以下のバージョン番号は、作業が v2 ブランチのどこに着地したかを示す。今後のテーマとオープンな pull request は方向性であり、確定したリリースの約束ではない。

## North Star（参照）

AI-DLC Workflows 2.0 North Star の 7 つの機能ゴール。意図を忠実に写す:

1. **実世界での実践の模倣** - 構成可能なアンサンブル（Owner・Collaborator・Verifier）が実行する stage を、harness 横断で一貫した意味論のもとで実現する。
2. **振る舞いのカスタマイズ** - 新しい振る舞い・ポリシー・制約を、狙いを絞った 2 箇所以内の変更でエンコードでき、ツール固有の書き直しなしに harness 横断で再利用できる。
3. **ワークフローの適応性** - スケールイン（レポートのトリアージを Fix・Test・PR に圧縮）とスケールアウト（境界で次の stage 群を決定）。構成はハードワイヤしない。
4. **真の敵対者としての Verifier** - 敵対的な品質 gate。producer と異なる LLM を使ってよい。機械検証可能な証拠に対して検証する。予算付きの自己修復ループが HITL へエスカレーションする。
5. **循環的・方向付きフローのサポート** - 前進の進行に加えて、統制された方向付きフィードバックループ。
6. **成果物トレーサビリティの保持** - 下流 stage は、切り離された成果物を生むのではなく上流の成果物を豊かにする。
7. **プロジェクトローカルでない、組織の成果物リポジトリ** - プロジェクト・intent・リポジトリを横断する共有の組織ナレッジ層。6 つの名前付きシナリオ。

## 戦略的デリバリー支柱

North Star がユーザーに届き、進化していく方法を、2 つの戦略的支柱が形作る:

- **プロダクト化と配布（#722）** - サポートされる harness 横断で、AI-DLC のインストール・設定・アップグレード・リリース・ロールバックを容易にする。
- **プラグインエコシステムとマーケットプレイス（#723）** - 信頼された拡張を発見可能・インストール可能・再利用可能にし、外部プラグインから第一級機能への明確な道筋を用意する。

## ゴールスコアカード

<!-- markdownlint-disable MD013 -->

| # | ゴール | 状態 | 提供したもの | 残りの作業 |
| --- | --- | --- | --- | --- |
| 1 | 実世界のアンサンブル | 達成 | 2.5.0 の独立した collaborator と選択可能なトポロジー（#568）; reviewer receipt の強制（#569） | ネイティブの live-team トランスポートと unit 単位の並列ウェーブは拡張として残る（#617） |
| 2 | カスタマイズ | 達成（フォローアップあり） | 2.3.0 の plugin seam、2.3.5 のコンテンツ投影・選択（#550）、決定論的な rule 配信（#658）、plugin scopes（#664） | stage 単位の rules、`when:` の評価、リモートディスカバリーとマーケットプレイス（#723） |
| 3 | 適応性 | 達成 | 2.2.0 の composer、エントロピースコアによる composition（#595）、決定論的 ARS（#644）、unit-major な Code Generation（#705） | 境界の変更は設計上、人間の承認を要するまま |
| 4 | 敵対者としての Verifier | 達成 | 2.4.0 の敵対的な証拠契約（#566）、completion-path の強制（#569）、reviewer-class のコストダイヤル（#718） | sensor のブロッキング重大度は隣接するフォローアップ（#431） |
| 5 | 循環フロー | 部分達成 | stage 内のレビュー/修正ループ、境界付きの復旧機構、明示的に人間が許可した前方/後方/やり直しの stage ジャンプ | stage 起点で統制された stage 間フィードバックループは未実装のまま; #616 はより狭い Build & Test の巻き戻し |
| 6 | トレーサビリティ | 部分達成 | 成果物グラフ、upstream coverage、claim の provenance（#647, #686）、共有 CodeKB の保護策（#670） | 漸進的なインプレースエンリッチメント、陳腐化結果の伝播（#716）、source に紐づいた receipt（#646）、stage 単位の強制（#401）、unit 横断のディスカバリー |
| 7 | 組織リポジトリ | 達成 | 2.1.0 の spaces/intents/org-KB、宣言的なマルチリポジトリ manifest と同期（#674）、clone に安全な active-space カーソル（#709） | ドキュメント検索と監査可能な補助ナレッジは現在進行中の拡張（#694, #714, #731） |

<!-- markdownlint-enable MD013 -->

## 提供済み

<!-- markdownlint-disable MD013 -->

| バージョン | 機能 | ゴール | 主要 PR |
| --- | --- | --- | --- |
| 2.0.0 - 2.0.2 | GA プレビュー: reviewer 機構、複数 harness 対応の core、agent 一覧 | 1, 4 | v2 ベースライン |
| 2.1.0 | intent 単位のワークスペース: spaces・intents・複数リポジトリ・org-KB | 7 | #429 |
| 2.1.2 | unit 単位の `for_each` 反復 | 3 | #444 |
| 2.1.3 - 2.1.8 | ループ整合性と harness 横断の reviewer 配線 | 1, 4, 5 | #405, #443, #466, #482 |
| 2.2.0 - 2.2.19 | 適応的ワークフロー、composer、スケールインと Construction の強化 | 3 | #477, #491, #509-#512, #520-#522, #525 |
| 2.3.0 - 2.3.5 | plugin 機構、agent tier、インストール時の plugin 選択とコンテンツ投影 | 2, 4 | #475, #546, #550 |
| 2.3.6 - 2.3.11 | Phase progress、引用を認識する upstream coverage、pin 済み lint と gate のアカウンティング | 4, 6 | #562, #563, #572, #573 |
| 2.4.0 | Reviewer-as-verifier: 敵対的で証拠に基づく review | 4 | #566 |
| 2.4.2 - 2.4.6 | ルート全体のパッケージング、ネイティブディスパッチャ/バイナリ、ドキュメントのパリティと opencode harness | 1, 2 | #560, #571, #577, #578, #581 |
| 2.5.0 | 3 ロールのアンサンブル: 独立した collaborator、pipeline、mob、hub-and-spoke | 1 | #568 |
| 2.5.1, 2.5.25 | エントロピースコアによる最小ワークフロー composition と決定論的 ARS | 3 | #595, #644 |
| 2.5.2 | マスク済みの `/aidlc --doctor --export` 診断バンドル | - | #576 |
| 2.5.5, 2.5.39, 2.5.41, 2.5.54-2.5.55 | reviewer receipt、review freeze、plan-before-code ガード、reviewer class と authorization receipt | 1, 4 | #569, #677, #692, #702, #718 |
| 2.5.11, 2.5.38, 2.5.57-2.5.58 | claim の provenance、生成前確認と project 言語のグラウンディング | 6 | #647, #686, #703, #707 |
| 2.5.33 - 2.5.36 | 決定論的な steering 配信、plugin scopes、CodeKB の保存とワークスペース manifest/同期 | 2, 7 | #658, #664, #670, #674 |
| 2.5.40, 2.5.53 | stage 単位のトークン/コストアカウンティング、opt-in のメトリクスと使用状況トラッキングの kill switch | - | #673, #720 |
| 2.5.56 | Code Generation が unit-major な Construction ウォークに加わる | 3 | #705 |
| 2.5.60 | Copilot CLI と VS Code の agent mode 向け GitHub Copilot harness | 1, 2 | #657 |

<!-- markdownlint-enable MD013 -->

## 進行中

選定されたオープンな作業をバージョン主張なしに列挙する。マージ可否は頻繁に変わるため、リンクされた各 pull request を正とする。

<!-- markdownlint-disable MD013 -->

| PR | 作業 | テーマ |
| --- | --- | --- |
| [#731](https://github.com/awslabs/aidlc-workflows/pull/731) | DocumentKB S1: agent による引用のためにチームドキュメントをインデックスする | ナレッジと組織リポジトリ |
| [#716](https://github.com/awslabs/aidlc-workflows/pull/716) | 陳腐化した stage 結果を投影・伝播する | トレーサビリティと妥当性 |
| [#661](https://github.com/awslabs/aidlc-workflows/pull/661) | Cursor harness | harness の拡張 |
| [#617](https://github.com/awslabs/aidlc-workflows/pull/617) | バッチ並列な unit 単位ウェーブとフォアグラウンド reviewer | アンサンブルと実行 |
| [#616](https://github.com/awslabs/aidlc-workflows/pull/616) | 境界付きの Build & Test から Code Generation への巻き戻し | 循環フロー |
| [#646](https://github.com/awslabs/aidlc-workflows/pull/646) | Code Generation の review receipt をワークスペースの source 状態に紐づける | トレーサビリティと妥当性 |
| [#653](https://github.com/awslabs/aidlc-workflows/pull/653) | Kiro IDE ネイティブの agent と settings サーフェス | harness のパリティ |
| [#526](https://github.com/awslabs/aidlc-workflows/pull/526) | Ideation でのプロダクトディスカバリー | プロダクトディスカバリー |
| [#401](https://github.com/awslabs/aidlc-workflows/pull/401) | stage 単位のトレーサビリティ強制 sensor | トレーサビリティ |
| [#402](https://github.com/awslabs/aidlc-workflows/pull/402) / [#403](https://github.com/awslabs/aidlc-workflows/pull/403) / [#404](https://github.com/awslabs/aidlc-workflows/pull/404) | 設計/コードの境界、テストの所有権と可観測性の一貫性 | 成果物の品質 |
| [#712](https://github.com/awslabs/aidlc-workflows/pull/712) | ガイド付き初回実行のための tutorial scope | 導入 |
| [#730](https://github.com/awslabs/aidlc-workflows/pull/730) | composed workflow の決定性とテストスイートの強化 | 信頼性 |

<!-- markdownlint-enable MD013 -->

## 方向性のテーマ

これらのテーマはオープンな RFC・issue・実装 pull request に支えられているが、確定したリリースバージョンはまだない。

### トレーサビリティと漸進的エンリッチメント

- stage 単位の upstream トレーサビリティを強制し
  ([#401](https://github.com/awslabs/aidlc-workflows/pull/401))、review の証拠を
  source 状態に紐づけ
  ([#646](https://github.com/awslabs/aidlc-workflows/pull/646))、陳腐化した
  stage 結果を伝播する
  ([#716](https://github.com/awslabs/aidlc-workflows/pull/716))。
- Code Generation の review receipt に unit 単位の帰属を定義し
  ([#662](https://github.com/awslabs/aidlc-workflows/issues/662))、unit 横断の
  ディスカバリー伝播には v2 での新規実装を行う
  ([#299](https://github.com/awslabs/aidlc-workflows/issues/299)/[#300](https://github.com/awslabs/aidlc-workflows/pull/300))。
- 漸進的エンリッチメントを North Star の到達点として維持する: 下流 stage が上流
  成果物をその場で豊かにし、ADR を core の設計成果物とする。
- commit 単位の provenance は未解決の設計課題のまま残る。現在の audit chain は、
  任意の source commit からその intent と workflow への永続的な逆引きを提供しない。

### 統制されたフィードバックループ

- [#616](https://github.com/awslabs/aidlc-workflows/pull/616) は
  [#611](https://github.com/awslabs/aidlc-workflows/issues/611) に対して、
  境界付きの Build & Test から Code Generation への戻りパスを 1 つ実装する。
  これは漸進的なループであり、汎用の循環グラフエンジンではない。
- 汎用の stage 間後方エッジには、依然として engine レベルの統制、陳腐化成果物の
  処理、明示的な人間による許可が必要である。

### プラグインとマーケットプレイス

- plugin 機構、コンテンツ投影、選択、plugin が提供する scopes は出荷済みである。
- リモートディスカバリー、信頼、第一級のマーケットプレイス、graduation の道筋は
  [#723](https://github.com/awslabs/aidlc-workflows/issues/723) で提案されている。
  プロダクトディスカバリー
  ([#652](https://github.com/awslabs/aidlc-workflows/issues/652)) とデザイン
  ([#527](https://github.com/awslabs/aidlc-workflows/issues/527)) は第一級 plugin
  の候補である。

### ナレッジとドキュメント

- [#714](https://github.com/awslabs/aidlc-workflows/issues/714) は DocumentKB を
  定義し、[#731](https://github.com/awslabs/aidlc-workflows/pull/731) がその最初
  のインデックス化スライスを実装する。
- [#694](https://github.com/awslabs/aidlc-workflows/issues/694) は、stage トポロ
  ジー横断で監査可能な補助ナレッジの選択と配信を提案する。

### プロダクトディスカバリー

- core の Ideation デリバリーは
  [#526](https://github.com/awslabs/aidlc-workflows/pull/526) でレビュー中で
  あり、外部ハンドオーバーの契約は
  [#586](https://github.com/awslabs/aidlc-workflows/issues/586)、plugin 形の
  代替案は
  [#652](https://github.com/awslabs/aidlc-workflows/issues/652) にある。
- デリバリーサーフェス、つまり core か第一級 plugin かは、まだ決着していない。

### インストール・アップグレード・リリース

- [#722](https://github.com/awslabs/aidlc-workflows/issues/722) はバイナリ
  パッケージング、インストーラ、npm、リリース自動化、ロールバック、インストール
  後セットアップを扱う。[#399](https://github.com/awslabs/aidlc-workflows/issues/399)
  は Bun への強い依存を追跡する。
- [#636](https://github.com/awslabs/aidlc-workflows/issues/636) は第一級の
  アップグレード契約を追跡する。以前の実装 PR である
  [#535](https://github.com/awslabs/aidlc-workflows/pull/535) はマージされずに
  クローズした。
- [#635](https://github.com/awslabs/aidlc-workflows/issues/635) は、v2 の GA
  発表と、依然として `v1.0.1` を指す GitHub の Latest リリースとの不一致を
  追跡する。

### harness の拡張とパリティ

- GitHub Copilot 対応は
  [#657](https://github.com/awslabs/aidlc-workflows/pull/657) で出荷済みである;
  その RFC である
  [#472](https://github.com/awslabs/aidlc-workflows/issues/472) は依然として
  整合が必要である。
- Cursor 対応は
  [#661](https://github.com/awslabs/aidlc-workflows/pull/661) でオープン中で
  あり、Kiro IDE ネイティブのサーフェスは
  [#653](https://github.com/awslabs/aidlc-workflows/pull/653) でオープンのまま
  残る。
- Antigravity のセットアップは
  [#690](https://github.com/awslabs/aidlc-workflows/issues/690) で提案されている。

### 評価と運用

- [#684](https://github.com/awslabs/aidlc-workflows/issues/684) は AI-DLC の成果
  を測定するための再現可能なベンチマークを提案する;
  [#223](https://github.com/awslabs/aidlc-workflows/issues/223) は、まず
  Claude Code と Kiro を対象にした自動 harness 評価を追跡する。
- Operations フェーズの steering は要望されている方向性のまま残り
  ([#221](https://github.com/awslabs/aidlc-workflows/issues/221),
  [#473](https://github.com/awslabs/aidlc-workflows/issues/473))、アクティブな
  v2 実装ストリームではない。

## 既知のギャップ

- stage 単位の rules（`aidlc-stage-<slug>.md`）は予約済みだが未実装である。
- plugin の `when:` 評価、リモートディスカバリー、マーケットプレイスの信頼はオープンのまま残る。
- sensor の失敗は助言的なものであり、ブロッキングの重大度は #431 でオープンのまま残る。
- 汎用の stage 間サイクルと漸進的なインプレースの成果物エンリッチメントは、North Star のギャップのまま残る。
- Kiro IDE の issue #543 はクローズ済みだが、#555/#653 は依然としてネイティブの agent/settings サーフェスを追跡している。
- いくつかの古いコミュニティ PR がオープンのまま残り、rebase または処理が必要である: #401-#404、#526、#553。PR #432、#535、#552 はマージされずにクローズした。
- Copilot の RFC #472 と決定論的 ARS の issue #618 は、実装がそれぞれ #657 と #644 で出荷済みであるにもかかわらずオープンのまま残る; issue の状態を整合させるべきである。
