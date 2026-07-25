# Agent System

この章は agent アーキテクチャを文書化する: agent がどう構造化され、設定され、framework によってロードされるか、そしてどう足すか、または変更するか。

ユーザー向けの agent 記述については、[User Guide -- Agents](../guide/06-agents.md) を参照。

---

## Agent Structure

各 agent は `.claude/agents/` 内のフラットな `.md` ファイルで、YAML frontmatter に続けて markdown 本体を持つ。conductor は、inline stage の実行中に視点をフレーミングするため、あるいは subagent 委譲のためのコンテキストを構築するために、これらのファイルを読む。

### Frontmatter Contract

すべての agent ファイルは、この YAML frontmatter を含まねばならない:

```yaml
---
name: aidlc-architect-agent               # Agent identifier (matches filename without .md)
description: >                      # Brief role summary (shown in Claude Code agent list)
  System architect responsible for application design,
  NFR design, and component decomposition.
disallowedTools: Task               # Agents cannot spawn subagents
tier: judgment                      # judgment | balanced | templated (see Agent Tiers)
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | agent の識別子。ファイル名に一致せねばならない |
| `description` | Yes | 簡潔な役割のサマリ |
| `tools` | No | 任意の allowlist; 省略するとフルのセッション toolset を継承する。列挙すると agent を絞り、`mcp__<server>__<tool>` の id も列挙されない限り継承された MCP tools を落とす |
| `disallowedTools` | Yes | `Task` を含まねばならない -- conductor だけが委譲する |
| `tier` | Yes | `judgment`、`balanced`、または `templated`。AUTHORED なダイヤル: packager がそれを各 harness のネイティブな model/effort キーへ射影する（下の Agent Tiers を参照）。生の `model:`/`effort:` が著述された frontmatter に現れることは決してない -- それらは `dist/<harness>/` の射影 OUTPUT である |

### Markdown Body Sections

frontmatter の下で、markdown 本体は次を定義する:

| Section | Purpose |
|---------|---------|
| **Core Responsibilities** | agent が自身の所有する各 stage で何をするか |
| **Stages Owned** | lead と supporting の stage 割り当て |
| **Collaboration** | Receives from / Works with / Hands off to |
| **Knowledge Loading** | 6 ステップのロード順（[Knowledge System](10-knowledge-system.md) を参照） |
| **Key Principles** | agent のための振る舞いのガイドライン |

---

## Shared Configuration

14 すべての agent が共通の configuration ベースラインを共有する。どれも `tools:` allowlist を宣言しないので、すべての agent が **フルのセッション toolset** を継承する — Claude Code のすべての組み込み tool に加え、セッションにプロビジョンされた任意の MCP tools。同梱される唯一の制限は `disallowedTools: Task` である。

### The session toolset (inherited by every agent)

すべての agent は組み込みの Claude Code tool を継承する。次を含む:

| Tool | Purpose |
|------|---------|
| Read | ファイルシステムからファイルを読む |
| Edit | ファイル内で正確な文字列置換を行う |
| Write | ファイルシステムへファイルを書く |
| Glob | 高速なファイルパターンマッチング |
| Grep | ripgrep を用いた内容検索 |
| AskUserQuestion | 対話的なユーザープロンプト（メインスレッドの stage のみ） |

### Common Disallowed Claude Code Tools

| Tool | Reason |
|------|--------|
| Task | agent は委譲されたワーカーとして動作する。SKILL.md の conductor だけが Task 呼び出しを行う。`disallowedTools: Task` はカスケードする subagent チェーンを避ける。 |

### Tools each persona is expected to exercise

すべての agent は継承によって Bash と WebSearch に *到達できる*; この表は、どの persona が stage の作業でそれらを使うと方法論が **期待する** かを記録するのであって、agent ごとの付与ではない。persona を真に制限するには、任意の `tools:` allowlist を足す（`mcp__<server>__<tool>` の id も列挙されない限り継承された MCP を落とす）— この実装はそのような制限を同梱しない。

| Tool | Expected to exercise it |
|------|---------------------|
| Bash | aidlc-aws-platform-agent, aidlc-devsecops-agent, aidlc-developer-agent, aidlc-quality-agent, aidlc-pipeline-deploy-agent, aidlc-operations-agent |
| WebSearch | aidlc-product-agent, aidlc-design-agent, aidlc-compliance-agent |

### Agent Tiers

すべての agent の著述されたダイヤルは `tier:` である -- それは persona が行う作業の種類を名指し、packager（`bun scripts/package.ts`）がそれを各 harness のネイティブな model/effort 形式へ射影する。以前の振る舞い（v2.2.15 から v2.2.19; それ以前はキーが不活性な `modelOverride:` だった）は agent ごとに生の `model: opus|sonnet` を固定し、より大きな model を走らせるセッションを強制的にダウングレードしていた; tier の射影はその固定を置き換える。

| Tier | Agents | Meaning |
|------|--------|---------|
| `judgment` | architect, aws-platform, compliance, composer, design, developer, devsecops, product, quality | 曖昧さの下での多制約推論; 出力は下流へカスケードする。決してダウングレードされない: セッションの model と effort の両方を継承する |
| `balanced` | architecture-reviewer, product-lead | レビュアー型の作業 -- 明示的な基準に対する新規の入力。中サイズの model、セッションの effort |
| `templated` | delivery, operations, pipeline-deploy | 支配的にパターン追従の出力; 方法論はすでに knowledge にある（delivery plan、CI/CD YAML、runbook）。Claude Code、Codex、opencode では中サイズの model を減らした effort で -- 唯一の意図的なダウングレード（Kiro では、すべての tier と同様にセッションの model を継承する） |

harness ごとの射影（`core/tools/aidlc-tiers.ts` が single source of truth）:

| Tier | Claude Code (.md frontmatter) | Codex CLI (.toml) | Kiro CLI/IDE (agent JSON `"model"`, CLI / `.md` frontmatter `model:`, IDE) | Kiro cli.json `chat.modelDefaults` | opencode (.md frontmatter) |
|------|-------------------------------|-------------------|--------------------------------------|-------------------------------------|-----------------------------|
| `judgment` | `model: inherit`、`effort:` 行なし | `model`/`model_reasoning_effort` キーなし（config.toml のセッションデフォルトが適用される） | フィールド省略（スキーマのフォールバック: ユーザーのデフォルト model） | tier エントリなし | `model:`/`variant:` キーなし（opencode.json のセッションデフォルトが適用される） |
| `balanced` | `model: sonnet`、`effort:` 行なし | `model = "openai.gpt-5.4"`、effort キーなし | フィールド省略（下記参照） | tier エントリなし | `model: amazon-bedrock/global.anthropic.claude-sonnet-4-6`、variant キーなし |
| `templated` | `model: sonnet`、`effort: medium` | `model = "openai.gpt-5.4"`、`model_reasoning_effort = "medium"` | フィールド省略（下記参照） | tier エントリなし | 同じ model、`variant: medium` |

表の背後にある主要な事実:

- **省略が継承のメカニズムである。** Claude Code では、`effort:` キーの無い agent .md はセッションの effort を継承し、固定された `effort:` は両方向でセッションを上書きする（固定は cap であって floor ではない）-- だから不在が judgment と balanced の契約である。Codex では、`model` の無いロール TOML は同梱の `.codex/config.toml` のセッションデフォルトで spawn する（codex-cli 0.139.0（doctor が強制する最小）と 0.142.5 で live に検証済み）。Kiro では、agent-v1 スキーマが不在-`"model"` のフォールバックを文書化している: "If not specified, uses the default model"（`/model` の永続化された設定）。
- **Kiro は決して model を固定しない。** 同梱の Kiro model ID は、その model がユーザーのインストールで有効なときにだけ解決する; 他の任意の model を走らせるセッションは、委譲された spawn を `Invalid model ID` ですべて拒否し、Kiro は Claude 方言の tier エイリアス（`opus`/`sonnet`）を真っ向から拒否する -- だから普遍的に安全に固定できる値は無い。したがってすべての Kiro tier は `"model"`（および `.md` frontmatter の `model:` 行）を省略する: すべての agent がセッションの model を継承する。`TIER_PROJECTIONS` の kiro スロットと `kiroModelDefaults()` の機構は、解決可能なインストールごとの固定メカニズムが現れたときに備え、休眠状態のまま残る。
- **Kiro は agent ごとの effort サーフェスを持たない。** kiro-cli は agent JSON 内の effort 的なキーに対して fail-close するので、model ごとの effort デフォルトは `settings/cli.json` の `chat.modelDefaults[<modelId>].output_config.effort` にしか乗れない。tier が model を固定しないので、著述された条件付きエントリだけが同梱される（`claude-opus-4.8` -> `xhigh`、セッションが実際にその model を走らせるときにだけ適用される）。そのファイルは CLI 専用である: Kiro IDE は cli.json を完全に無視し、拡張機能に埋め込まれた model ごとのデフォルト（またはユーザーの `/effort` のセッション state）を適用する。

### Tier cap (cost override)

プロジェクトは、どの agent ファイルも編集せずに、pack 時にすべての射影を cap できる:

- **永続的なノブ:** space memory レイヤーのファイル（`core/memory/org.md` -> `team.md` -> `project.md`、最後の書き手が勝つ -- プロジェクトは org の天井を下げても上げてもよい）の YAML frontmatter の `tier_cap:` キー。例: `tier_cap: balanced` は、すべての harness の射影で `judgment` を `balanced` に潰す（tier が model を固定しない Kiro では、cap は不活性 -- すべての tier はすでにセッションの model を継承している）。
- **呼び出しごとの上書き:** `AIDLC_TIER_CAP` env var は、1 回の packager 実行について memory レイヤーに勝つ（`AIDLC_TIER_CAP=templated bun scripts/package.ts`）。memory の cap が効いている間に一度だけ CAP なしでビルドするには、それを最上位の tier に設定する -- `AIDLC_TIER_CAP=judgment` -- これは memory レイヤーに勝ち、何も clamp しない（空の値は uncapped ではなく unset を意味する）。

2 つのノブは scope が異なる: memory の cap はリポジトリとともに移動するので、write と `--check` の両方のモードで適用される（cap した dist をコミットするプロジェクトは自己整合を保つ）。env var は一度きりの WRITE ノブであり、`--check` の下では無視される - drift ガードは、コミットされた dist が正当に何からビルドされたかを比較するのであり、CI やテストランナーの環境にある迷子の `AIDLC_TIER_CAP` は、drift を失敗させても隠してもならない（packager は 1 つを無視するときに通知を出力する）。packager はまた、cap されたすべての実行で、アクティブな cap とそのソースを出力する。

代わりに単一の agent をオプトアウトするには、インストール済みの `dist/<harness>/` のコピーで射影された値を編集する（例: 1 つの Claude agent .md に `model: opus` を設定する）-- その編集は dist シェルを再コピーするまで生き残る。

---

## Agent Comparison Matrix

次の 2 列の `Yes` は、継承された tool の期待される使用を意味するのであって、アクセスの
付与ではない。

| Agent | Bash Expected Use | WebSearch Expected Use | Tier | Lead Stages | Support Stages | Total |
|-------|-------------------|------------------------|------|-------------|----------------|-------|
| aidlc-product-agent | No | Yes | judgment | 5 | 3 | 8 |
| aidlc-design-agent | No | Yes | judgment | 2 | 2 | 4 |
| aidlc-delivery-agent | No | No | templated | 3 | 2 | 5 |
| aidlc-architect-agent | No | No | judgment | 6 | 3 | 9 |
| aidlc-aws-platform-agent | Yes | No | judgment | 2 | 4 | 6 |
| aidlc-compliance-agent | No | Yes | judgment | 0 | 4 | 4 |
| aidlc-devsecops-agent | Yes | No | judgment | 0 | 5 | 5 |
| aidlc-developer-agent | Yes | No | judgment | 2 | 4 | 6 |
| aidlc-quality-agent | Yes | No | judgment | 2 | 3 | 5 |
| aidlc-pipeline-deploy-agent | Yes | No | templated | 4 | 0 | 4 |
| aidlc-operations-agent | Yes | No | templated | 3 | 0 | 3 |

**Observations:**
- aidlc-architect-agent が最も広い stage 関与を持つ（3 つの phase にまたがる 9 stage）。
- 14 agent の全ロスターにわたり、9 つの agent が `judgment` tier を持ち、5 つが Claude Code、Codex、opencode でステップダウンする（2 つの `balanced` レビュアーに加え 3 つの `templated` プランナー; Kiro ではすべての tier がセッションの model と effort を継承するので、そこではどの agent もステップダウンしない）; ステップダウンした agent は、明示的なチェックリストに対するレビュー、または支配的にテンプレート化された planning、CI/CD、runbook の作業を生産する。上のマトリクスは 11 のドメインエキスパート agent をカバーする。
- aidlc-compliance-agent は純粋に助言的な立場で動作する（4 support stage、lead stage なし）。
- 11 agent のうち 6 つが CLI 対話のために Bash を使うと期待される。
- 3 つの agent がリサーチタスクのために WebSearch を使うと期待される。

---

## Phase Participation

| Agent | Init (0) | Ideation (1) | Inception (2) | Construction (3) | Operation (4) |
|-------|----------|--------------|---------------|-------------------|---------------|
| aidlc-product-agent | -- | L (intent-capture, market-research, scope-definition), S (rough-mockups, approval-handoff) | L (requirements-analysis, user-stories), S (refined-mockups) | -- | -- |
| aidlc-design-agent | -- | L (rough-mockups) | L (refined-mockups), S (user-stories, application-design) | -- | -- |
| aidlc-delivery-agent | -- | L (team-formation, approval-handoff), S (scope-definition) | L (delivery-planning), S (units-generation) | -- | -- |
| aidlc-architect-agent | -- | L (feasibility), S (intent-capture) | L (application-design, units-generation), S (reverse-engineering, delivery-planning) | L (functional-design, nfr-requirements, nfr-design) | -- |
| aidlc-aws-platform-agent | -- | S (feasibility) | S (application-design) | L (infrastructure-design), S (nfr-design) | L (environment-provisioning), S (feedback-optimization) |
| aidlc-compliance-agent | -- | S (feasibility) | -- | S (nfr-requirements, infrastructure-design) | S (environment-provisioning) |
| aidlc-devsecops-agent | -- | -- | S (practices-discovery) | S (nfr-requirements, infrastructure-design, build-and-test) | S (environment-provisioning) |
| aidlc-developer-agent | -- | -- | L (reverse-engineering), S (practices-discovery, user-stories) | L (code-generation), S (functional-design) | S (deployment-execution) |
| aidlc-quality-agent | -- | -- | S (practices-discovery, user-stories) | L (build-and-test), S (nfr-requirements) | L (performance-validation) |
| aidlc-pipeline-deploy-agent | -- | -- | L (practices-discovery) | L (ci-pipeline) | L (deployment-pipeline, deployment-execution) |
| aidlc-operations-agent | -- | -- | -- | -- | L (observability-setup, incident-response, feedback-optimization) |

L = Lead、S = Support

---

## How to Add an Agent

agent の display name と example knowledge ファイルは、各 agent の `.md` frontmatter の `display_name` と `examples` フィールドを通じて権威を持つ — TypeScript の編集は不要。完全なレシピ（必須の frontmatter フィールド、verification のステップ、そして何が自動的に対して手動で検証されるか）は [Contributing: Adding an Agent](11-contributing.md#adding-an-agent) を参照。ステップの手短なサマリ:

1. 必須の frontmatter とともに `core/agents/{name}-agent.md` を作成する: `name`、`display_name`、`examples`、`description`、`disallowedTools`（`Task` を含む）、`tier`。core の frontmatter に生の `model:`/`effort:` を決して著述しない -- それらは射影の出力である（上の Agent Tiers を参照）。任意の `tools:` allowlist は継承された toolset を絞る; 省略するとフルのセッション toolset を継承する。`core/tools/aidlc-lib.ts` の `loadAgents()` が次の呼び出しでそのファイルを発見する。
2. knowledge ファイルを `core/knowledge/{name}-agent/` に足す
3. agent が参加する stage ファイル（`core/aidlc-common/stages/`）に agent を足す — 各 stage の frontmatter で `lead_agent` / `support_agents` を設定する。コンパイルされた `tools/data/stage-graph.json` は `bun scripts/package.ts` によってその frontmatter から生成される; 決して手編集しない（`package.ts --check` の drift ガードが手編集された dist で CI を失敗させる）。
4. ディストリビューションを再生成する: `bun scripts/package.ts`（続けて `--check` で drift が無いことを確認する）
5. 手で維持される knowledge テーブルに agent→examples の行を足す（space レベルのチーム knowledge dir は `aidlc/knowledge/{name}-agent/` で、内容があるときにチームによって作成される — engine はそれをスキャフォールドしない）
6. テストを更新する: ファイル存在のための smoke テスト、stage-agent の相互参照のための feature テスト
7. このファイルと [reference/agents/](agents/) のドキュメントを更新する

## How to Modify an Agent

- **tools を変える**: agent を絞るために frontmatter の `tools:` allowlist を足すか編集する; 省略するとフルのセッション toolset を継承する。`tools:` リストは、`mcp__<server>__<tool>` の id も列挙されない限り、継承された MCP tools を落とす。
- **tier を変える**: `tier:` を `judgment`、`balanced`、または `templated` に編集し、再生成する（`bun scripts/package.ts`）。代わりにインストール済みのコピーで単一の agent に特定の model を強制するには、`dist/<harness>/` の agent ファイルで射影された `model:` を編集する（Claude Code はエイリアス、フルの id、`inherit` を受理する）。
- **振る舞いを変える**: markdown 本体のセクション（responsibilities、principles）を編集する。
- **stage の割り当てを変える**: agent ファイル（Stages Owned セクション）と関連する stage ファイル（`core/aidlc-common/stages/`）の両方を編集し、その後 `bun scripts/package.ts` で再生成する — コンパイルされた stage graph は stage frontmatter から導出され、決して手編集されない。

---

## Cross-References

- [Architecture](01-architecture.md) -- agent レイヤーを含む 5 層モデル
- [Knowledge System](10-knowledge-system.md) -- knowledge のロード順
- [Agents Technical Reference](agents/) -- agent ごとの技術的詳細
- [Stage Protocol](04-stage-protocol.md) -- agent persona のロード rule
