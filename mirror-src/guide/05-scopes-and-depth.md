# Scope・Depth・テスト戦略

scope は**どの stage を実行するか**を制御する。depth は各 stage が**どれだけ詳細に**成果物を作るかを制御する。テスト戦略は**いくつのテストを**生成するかを制御する。3 つが合わさって、包括的なエンタープライズ機能から素早い bugfix まで、ライフサイクルをタスクに適応させる。

---

## 9 つのコア scope

core は 9 つの名前付き scope を同梱する。各 scope は stage の集合と既定の depth レベルを定義する。plugin のインストールで scope を追加でき、`bun .claude/tools/aidlc-utility.ts select-plugins <names>` で可視の plugin scope を絞れる。`plugins` の選択が core を無効化した（`aidlc` を外した）場合、core の scope ファイルはインストールされたまま残るが、core が再有効化されるまで有効なランタイム scope にはならない。Initialization の stage は有効な全 scope で引き続き実行される。

### enterprise

**使いどころ:** 完全な audit トレイル・コンプライアンスレビュー・本番級の運用を要する、規制下のエンタープライズ機能を作るとき。

- **Stage:** 全 32
- **既定 depth:** Comprehensive
- **含むもの:** コンプライアンス・セキュリティ・運用の stage 一式

### feature

**使いどころ:** 規模を問わず新機能を作るとき。AI-DLC がより特定的なマッチを決められないときの既定 scope である。

- **Stage:** 全 32
- **既定 depth:** Standard
- **含むもの:** 全 stage、標準の成果物詳細度

### mvp

**使いどころ:** greenfield の minimum viable product を作るとき。後段の運用をスキップするが、設計と construction は完全に保つ。

- **Stage:** 32 中 22
- **既定 depth:** Standard
- **スキップ:** Operation の全 7 stage（deployment pipeline・environment provisioning・deployment execution・observability・incident response・performance validation・feedback）に加え、Ideation の Market Research・Team Formation・Approval Handoff（スキップ 10・実行 22）

### poc

**使いどころ:** 実現可能性を素早く証明するとき。Ideation と Inception の大半をスキップし、早くコードに到達することに集中する。

- **Stage:** 32 中 8
- **既定 depth:** Minimal
- **スキップ:** Market Research、Feasibility、Team Formation、Mockups、User Stories、Operation の大半

### bugfix

**使いどころ:** 特定のバグを直すとき。intent の捕捉からコード生成・テストまでの効率化された経路。

- **Stage:** 32 中 7
- **既定 depth:** Minimal
- **スキップ:** Market Research、Feasibility、Team Formation、Mockups、設計・アーキテクチャ系の大半、Operation の全 stage

### refactor

**使いどころ:** 機能を変えずに既存コードを整理・再構成するとき。

- **Stage:** 32 中 8
- **既定 depth:** Minimal
- **スキップ:** bugfix に類似 — コード分析・設計・実装に集中

### infra

**使いどころ:** インフラの変更（新しい環境、CDK/CloudFormation の更新、コスト最適化）を行うとき。

- **Stage:** 32 中 13
- **既定 depth:** Standard
- **スキップ:** ユーザー向けの stage（ストーリー・モックアップ・ユーザーフロー）— アーキテクチャ・インフラ・デプロイに集中

### security-patch

**使いどころ:** CVE やセキュリティ脆弱性への対応。セキュリティ関連 stage を通る高速経路。

- **Stage:** 32 中 10
- **既定 depth:** Minimal
- **スキップ:** Market Research、Team Formation、Mockups、セキュリティ以外の設計 stage

### workshop

**使いどころ:** AI-DLC のワークショップやトレーニングを運営するとき。プロジェクトはファシリテーターが事前決定しており、参加者は mob として inception・construction・operation を進める。

- **Stage:** 32 中 25
- **既定 depth:** Standard
- **既定テスト戦略:** Minimal（Nyquist）— ワークショップのペースを速く保つ
- **スキップ:** Ideation の全 stage（1.1-1.7）— プロジェクトの scope は事前決定済み

複数開発者での手動レシピと claim の意味論は [Workshop モード](workshop-mode.md) を参照。

---

## scope ルーティング表

権威あるデータは `.claude/scopes/aidlc-<name>.md` ファイル（scope の同一性）、plugin の scope ファイル、そして各 stage の `scopes:` frontmatter（所属）にあり、`.claude/tools/data/scope-grid.json` へコンパイルされる。コンパイル済みグリッドは現在の plugin 選択で有効な scope だけを含む。生きたコンパイル済みの表は `bun .claude/tools/aidlc-utility.ts scope-table` で（ユーザー向けの 1 行説明は `bun .claude/tools/aidlc-utility.ts help` で）確認できる。

| Scope | EXECUTE / 総数 | Depth | テスト戦略 | ユースケース |
|-------|-----------------|-------|---------------|----------|
| `enterprise` | 32 / 32 | Comprehensive | Comprehensive | 規制下のエンタープライズ機能、完全な audit トレイル |
| `feature` | 32 / 32 | Standard | Standard | 新機能の既定 |
| `mvp` | 22 / 32 | Standard | Standard | greenfield、後段の運用をスキップ |
| `poc` | 8 / 32 | Minimal | Minimal | 実現可能性を素早く証明 |
| `bugfix` | 7 / 32 | Minimal | Minimal | 特定のバグを修正 |
| `refactor` | 8 / 32 | Minimal | Minimal | 既存コードの整理 |
| `infra` | 13 / 32 | Standard | Standard | インフラ変更 |
| `security-patch` | 10 / 32 | Minimal | Minimal | CVE 対応 |
| `workshop` | 25 / 32 | Standard | **Minimal** | AI-DLC ワークショップ・トレーニング |
| （自動検出） | 可変 | 可変 | 可変 | 自由記述の intent から AI が判定 |

scope の儀式の重さは桁で違う: `poc` は 8 stage・承認 gate 5 個で走り、`feature` は全 32 stage・gate 29 個で、Construction では Unit of Work ごとにファンアウトする設計 stage が 5 つある。そのため scope 確認の行は常に正確な数 — stage 数・承認 gate 数・unit ごとのファンアウト — を、推定ではなくコンパイル済みグリッドから計算して名指しする。ワークフローが始まる前に、自分が何に同意しているのかが分かる。

> **プロジェクト単位の既定 scope:** チームは `.claude/settings.json` の `AWS_AIDLC_DEFAULT_SCOPE` でプロジェクトの既定 scope を事前設定できる — 全参加者がフラグを覚えずに `workshop` から始めるべきワークショップで有用である。[カスタマイズ § プロジェクト単位の既定 scope](13-customization.md#per-project-default-scope) を参照。

---

## 自由記述 intent からの自動検出

scope を明示的に指定する必要はない。作りたいものを記述すれば、orchestrator がキーワードから適切な scope を検出する:

```
/aidlc Build a REST API for inventory management
```

エンジンは intent をキーワードパターンに照らして分析する:

| キーワード | 検出される scope |
|----------|---------------|
| "fix"、"bug"、"broken" | `bugfix` |
| "refactor"、"clean up"、"simplify" | `refactor` |
| "infrastructure"、"deploy"、"infra" | `infra` |
| "security"、"CVE"、"vulnerability"、"patch" | `security-patch` |
| "proof of concept"、"prototype"、"poc"、"spike" | `poc` |
| "mvp"、"minimum viable" | `mvp` |
| "workshop"、"lab"、"training" | `workshop` |
| それ以外すべて | core 有効時は `feature`。そうでなければ、一意に決まる場合に唯一有効な plugin の最初の scope |

**曖昧性解消の規則:** 入力に scope キーワードと長いプロジェクト記述（5 語超）の両方が含まれる場合、マッチは偶発的なものとして扱われ、代わりに compose の提案（後述）が発火する。これは「Fix the infrastructure monitoring dashboard」が `infra` にルーティングされてしまうようなミスマッチを防ぐ — 仕立てられた計画の方が適切な場面だからだ。

明確なキーワードマッチの後は、マッチした scope とその儀式の重さを、コンパイル済みグリッドから直接名指しする 1 行の確認が出る:

```
Starting a "bugfix" workflow for: "fix login bug" - 7 of 32 stages, 4 approval gates, 1 stage repeats per unit of work in Construction. Confirm to proceed,
name a different scope, or say "compose" for a tailored plan.
```

確認して進むか、別の scope（または `compose`）を返信して、ワークフロー開始前に軌道修正する。

---

## 適応コンポーザー

どの既成 scope も明確には合わないとき（キーワードに当たらない豊かな散文、長い記述に埋もれたキーワード）、`/aidlc` は黙って `feature` に落とすのではなく、仕立てた計画の COMPOSE を提案する。強制もできる:

```
/aidlc compose "harden the deployment pipeline and add observability"
/aidlc-compose "same thing, as a typeable shortcut"
/aidlc compose --report sonar.json     # compose from a scan report
/aidlc --new-scope "..."               # force a custom scope even on a stock match
```

composer エージェントはタスクを読み、5 つの実装エントロピー成分 — intent の曖昧さ、コードベースの構造的不確実性、検証エントロピー、リスク、未解決の仮定 — を推定し、最小実行可能なワークフロー: 結果が依存するすべての成果物をなお生み出す、最小十分な EXECUTE/SKIP グリッドを構成する。構造の推定は、CodeKB サーバーが設定・索引済みのときは CodeKB MCP のコールグラフとコンポーネント分析に接地する（任意の外部ツールで、AI-DLC には同梱されない）。無ければ composer は有界のワークスペーススキャン（brownfield/greenfield、言語）にフォールバックする。gate で見る提案には、スコアの内訳（各成分の LOW/MED/HIGH バンドと根拠）、参考の複合値、そしてすべての EXECUTE と SKIP に理由が付いた stage 別の判断表が載る。承認・編集・拒否はあなたが行い、明示的な承認の前には何も書かれず、どのワークフローも始まらない。承認すると:

- 提案が既成 scope にマッチしていた場合、ワークフローはその scope で直接 birth する（コードレベルの指摘に満ちたスキャンレポートは、たいていこの経路で `bugfix` か `security-patch` にルーティングされる）。
- カスタムのグリッドでは、composer が本物の scope（`scopes/aidlc-<name>.md` と `scope-grid.json` のエントリ）を書き、同じターンでワークフローがその scope で birth する。合成された scope は以後どの既成 scope とも同様に解決され（`/aidlc --scope <name>`）、グラフ再コンパイルでも生き残る: `aidlc-graph.ts compile` は合成済みグリッドエントリを、stage frontmatter だけからグリッドを再構築するのではなく、再生成された `scope-grid.json` に折り戻す。

**CodeKB による接地（任意）:** CodeKB は、コードベースの事前計算された構造分析（コールグラフ、コンポーネントインベントリ、パッケージ間結合）を提供する外部の MCP サーバーである。AI-DLC は同梱も要求もしない — 無い場合 composer は有界のワークスペーススキャンで構造をスコアし、それが通常の経路である。接続した場合、composer はそれを唯一の構造的根拠源として使い、提案に引用する（`method: codekb`）。接続方法は harness に依存する: Claude Code ではプロジェクトの `.mcp.json` にサーバーを追加（subagent はセッションの MCP サーバーを継承）、Codex では `config.toml` に `mcp_servers` エントリを追加、opencode では opencode の設定に追加する。Kiro CLI と Kiro IDE では同梱の composer エージェント設定が MCP ツールを許可していないため、常にワークスペーススキャンのフォールバックを使う。CodeKB をフレームワーク自身の「codekb」ディレクトリ（`aidlc/spaces/<space>/codekb/`）と混同しないこと — あちらは Reverse Engineering stage が書くローカルの成果物ストアで、MCP サーバーとは無関係である。CodeKB の根拠があると composer は Reverse Engineering のスキップを提案することがある。その場合、下流 stage がローカルストア無しで動くことを提案が開示しなければならず、gate で判断するのはあなたである。

**キーワードの衛生:** 合成された scope は `keywords: []` で出荷されるため、一度きりの計画がキーワード自動検出に参加することはない。合成 scope を将来のプロンプトから推測可能にするのは gate での明示的な質問であり、副作用では決して起きない。

**実行中の recompose:** ワークフローの途中で `/aidlc compose` は、実行中ワークフローの PENDING な stage の再形成を提案する — 不要になったものをスキップし、必要と気づいた保留 stage を戻す。composer は完了した stage が実際に解決した内容からエントロピー成分を再推定するため、提案される各フリップにはスコアを動かした根拠が付く（「feasibility が統合の疑問を解消した — リスクは MED に再スコア」）。フリップはカーソルより先の pending な stage にだけ適用され（完了・実行中の stage は凍結）、残りのどの stage も必須入力を欠かないよう厳格に検証され、決定論的な `recompose` 動詞を通じて audit ロックの下で `RECOMPOSED` audit イベントとともに着地する。Construction の最初の EXECUTE stage（walking-skeleton gate のアンカー）はフリップできない。

文字どおりの動詞は必要ない: 「market research はスキップできる？この市場はもう分かってる」のような普通のチャットも、ワークフロー途中では再形成の要望として認識され、同じ gate と同じ `recompose` 動詞にルーティングされる。stage を自分で名指しした場合（「market-research と team-formation を落として」）、conductor は composer エージェントを dispatch せずに gate を直接提示することがある — 承認 gate と検証はどちらでも同一である。非 Claude harness では、文字どおりの `/aidlc compose "<request>"` 動詞が文書化された確実な経路であり続ける。

---

## 3 つの depth レベル

depth は各 stage で生み出される成果物の詳細度を制御する。scope が既定 depth を設定するが、上書きできる。

| Depth | 成果物の詳細度 | 使いどころ |
|-------|----------------|-------------|
| **Minimal** | 中核の要点のみ。短い文書、主要な決定、最小限の補助分析。 | 素早い修正、パッチ、proof of concept |
| **Standard** | バランスの取れた詳細。完全な要件、根拠付きのアーキテクチャ決定、行き届いたテスト計画。 | 大半の機能と MVP |
| **Comprehensive** | エンタープライズの完全詳細。網羅的な要件、コンプライアンスマトリクス、詳細な NFR 仕様、完全な監査文書。 | 規制下の機能、エンタープライズ展開 |

### depth が stage に与える影響

各 stage で、エージェントはアクティブな depth に基づいて出力を調整する:

- **Minimal:** 1〜2 ページの成果物、主要な決定のみ、任意セクションはスキップ
- **Standard:** 完全な成果物、必須セクションすべて、簡潔な根拠
- **Comprehensive:** 拡張された成果物、任意セクションも含む、詳細な正当化、コンプライアンスの相互参照

### depth の上書き

depth は 3 つの時点で変えられる:

1. **`--depth` CLI フラグ** — 呼び出し時に上書き:
   ```
   /aidlc --depth comprehensive
   /aidlc --scope bugfix --depth standard
   /aidlc --stage code-generation --depth minimal
   ```
2. **scope 確認時** — orchestrator が検出 scope を確認するとき、単に確認する代わりに `--depth <level>` を添えて返信する
3. **任意の承認 gate** — フィードバックの一部として別の depth レベルを要望する

各セッション最初の完了メッセージが思い出させてくれる:

```
**Project depth**: Standard — depth adapts artifact detail.
**Test strategy**: Standard — test strategy controls test volume.
You can request different depth or test strategy at any approval gate.
```

---

## scope の直接指定

### 明示的な scope

```
/aidlc feature
/aidlc bugfix
/aidlc enterprise
```

### 記述付きの scope

```
/aidlc bugfix Fix the login timeout issue
/aidlc poc Build a quick prototype for the search feature
```

### ユーティリティコマンドでの scope 上書き

```
/aidlc --scope bugfix
/aidlc --scope enterprise --stage code-generation
```

`--scope` フラグはジャンプ操作のために `--stage`・`--phase`・`--depth` と組み合わせられる。

### depth の上書き

```
/aidlc --depth minimal
/aidlc --scope bugfix --depth comprehensive
/aidlc --scope enterprise --depth standard --stage code-generation
```

`--depth` フラグは scope の既定 depth レベルを上書きする。有効値: `minimal`、`standard`、`comprehensive`（大文字小文字は区別しない）。

### テスト戦略の上書き

```
/aidlc --test-strategy minimal
/aidlc --depth standard --test-strategy minimal
```

`--test-strategy` フラグは depth と独立にテスト戦略を上書きする。完全な説明は下の [3 つのテスト戦略レベル](#the-3-test-strategy-levels) を参照。

---

## 3 つのテスト戦略レベル

テスト戦略は**いくつのテストを**生成し、**どのテスト種別を**含めるかを制御する。depth からは独立している — depth は成果物の詳細度（文書・図・質問）を制御し、テスト戦略はテスト量だけを制御する。この分離により、速度がテストカバレッジより重要な場面で、Standard depth の完全なワークフローを Minimal のテストで走らせられる。

### Minimal — Nyquist モデル

信号処理の Nyquist レート — 信号を再構成するのに必要な最小サンプリング周波数 — に着想を得ている。Minimal のテスト戦略は、すべての要件を検証するのに必要な最小限のテストを生成する — それ以上でも以下でもない。

- **特定された要件 1 つにつき 1 テスト**（要件駆動であり、コンポーネント駆動ではない）
- **ハッピーパスの床:** 要件が対応しないコンポーネントにも、少なくとも 1 つのハッピーパス単体テスト
- **単体テストのみ** — 統合・E2E・性能・セキュリティテストはスキップ
- 典型的なプロジェクトで**合計 約 5〜15 テスト**
- ソフトなガイドライン — 安全性が重要な文脈が要求すればエージェントは超過できる

**向いているもの:** ワークショップ、トレーニング、proof of concept、素早い bugfix — 完全なテストスイートに投資せず正しさを検証したいあらゆる文脈。

### Standard — コンポーネント単位モデル

コンポーネント間の境界を検証する、バランスの取れたテストカバレッジ。

- **コンポーネントごとに 5〜8 テスト**
- **単体 + 統合テスト**（コンポーネント間の主要な境界）
- E2E・性能・セキュリティテストは NFR 要件が明示的に求める場合のみ
- **テストピラミッドの比率:** 単体 約 75% / 統合 約 20% / E2E 約 5%
- ソフトなガイドライン

**向いているもの:** 大半の機能と MVP — テストに過剰投資しない良好なカバレッジ。

### Comprehensive — 完全カバレッジモデル

全テスト種別にわたる徹底したテストカバレッジ。

- **コンポーネントごとに 10〜15 テスト**
- **全テスト種別:** 単体 + 統合 + E2E + 性能（NFR があれば） + セキュリティ（NFR があれば）
- **テストピラミッドの比率**が全種別に適用される
- ソフトなガイドライン

**向いているもの:** エンタープライズ機能、規制下のシステム、テストカバレッジの監査証跡を要するあらゆる文脈。

### テスト戦略の既定の決まり方

テスト戦略は大半の scope で **depth レベル**に従う — depth が Standard ならテスト戦略も Standard になる。ただし一部の scope は独自の既定を宣言する:

| Scope | Depth | テスト戦略 | なぜ違う？ |
|-------|-------|---------------|----------------|
| `workshop` | Standard | **Minimal** | 学習用に完全な成果物を作りつつ、ペースを保つ高速な Nyquist テスト |

他のすべての scope は depth からテスト戦略を継承する。`--test-strategy` でいつでも上書きできる。

### テスト戦略の上書き

テスト戦略は 3 つの時点で変えられる:

1. **`--test-strategy` CLI フラグ** — 呼び出し時に上書き:
   ```
   /aidlc --test-strategy minimal
   /aidlc --depth standard --test-strategy minimal
   /aidlc --scope bugfix --test-strategy comprehensive
   ```
2. **ワークフロー途中** — アクティブなワークフローのテスト戦略を変更:
   ```
   /aidlc --test-strategy comprehensive
   ```
3. **任意の承認 gate** — フィードバックの一部として別のテスト戦略を要望する

### よくある depth + テスト戦略の組み合わせ

| Depth | テスト戦略 | 効果 | 使いどころ |
|-------|--------------|--------|-------------|
| Standard | Standard | 完全な成果物、バランスの取れたテスト | 大半の機能(既定) |
| Standard | Minimal | 完全な成果物、Nyquist テスト | ワークショップ、時間制限のあるセッション |
| Minimal | Minimal | 軽量な成果物、軽量なテスト | 素早い bugfix、パッチ |
| Comprehensive | Comprehensive | すべて完全 | 規制下のエンタープライズ機能 |
| Comprehensive | Standard | 完全な成果物、バランスの取れたテスト | 現実的なテストで進めるエンタープライズ |
| Minimal | Comprehensive | 軽量な成果物、徹底したテスト | 確信が要る重大な bugfix |

---

## 正しい scope の選び方

| 状況 | 推奨 scope |
|-----------|------------------|
| 本番アプリケーションの新機能 | `feature` |
| ゼロからの greenfield プロダクト | `mvp` または `feature` |
| アプローチの素早い検証 | `poc` |
| 直すべきバグが分かっている | `bugfix` |
| 挙動を変えないコード整理 | `refactor` |
| 新しい AWS 環境や CDK の変更 | `infra` |
| CVE・セキュリティ脆弱性への対応 | `security-patch` |
| コンプライアンスを要する規制下の機能 | `enterprise` |
| AI-DLC ワークショップ・トレーニングラボ | `workshop` |

迷ったら `feature` から始める — 全 32 stage を含み、個々の stage は承認 gate でスキップできる。

---

## 次のステップ

- [Phase と Stage](04-phases-and-stages.md) — 各 stage が何をするか
- [エージェント](06-agents.md) — どのエージェントがどの scope に参加するか
- [Skill とランナーコマンド](17-skills.md) — bugfix・feature・mvp・security-patch の一語 `/aidlc-<scope>` ランナー
- [CLI コマンド](12-cli-commands.md) — コマンドの完全リファレンス
- [用語集](glossary.md) — 用語リファレンス
