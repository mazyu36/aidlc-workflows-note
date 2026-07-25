# Agent を足す

agent はフレームワークの *who* である — ドメイン、ツールの allowlist、tier を持つ
ペルソナ。同梱される 14 の agent は、product・design・delivery・architecture・
AWS platform・compliance・DevSecOps・development・quality・pipeline-deploy・
operations を扱う 11 のドメインエキスパート、2 つの review 専用 agent、そして
adaptive-workflows composer から成る。フレームワークが扱わないドメイン（例えば
data-governance の reviewer やモバイルのスペシャリスト）をチームが要するとき、
`core/agents/` に 1 つの Markdown ファイルを落とすことでペルソナを足す。TypeScript は無い。

この章はワークフローを歩く: ペルソナファイルとは何か、その frontmatter における判断の
ポイント、そして *visible* な agent はまだ *active* ではない、という 2 段階の真実。
フィールドごとの契約について、この章は開発者リファレンスへリンクで降りる。これらの agent が
ユーザーの席から誰なのかは、[ユーザーガイド — Agent](../guide/06-agents.md) を参照。

---

## ペルソナファイルとは何か、そしてどこに住むか

すべての agent は `core/agents/<slug>-agent.md` にある 1 つのフラットなファイルである:
上に YAML frontmatter、下に Markdown 本体。同梱されるファイルはすべて `aidlc-`
プレフィックスを運ぶ（`aidlc-architect-agent.md`、`aidlc-developer-agent.md`）; あなたが
足すファイルはあなたのものであり、そのプレフィックスを使う必要は無い。同梱される 14 個は
フレームワークファイルとして扱う — アップグレードで上書きされるので、*既存の agent が
何を知るか*はファイルを編集するのではなくチーム knowledge を通してカスタマイズする
（[チーム Knowledge](07-team-knowledge.md) を参照）。真に新しいペルソナは別の一手である:
あなたが所有し、アップグレードを生き延びる新しいファイル。

frontmatter はフレームワークがパースする部分である。本体は、agent が起動するとき自身に
ついて読む散文である — その責務、所有する stage、knowledge をどうロードするか、その働きの
原則。frontmatter だけが機械可読である; 本体は agent 自身のフレーミングのためであり、同梱
ファイルの構造に合わせて書く。

本物の agent の frontmatter を示す。`core/agents/aidlc-architect-agent.md` に
著述されたもの:

```yaml
---
name: aidlc-architect-agent
display_name: Architect Agent
examples:
  - tech-stack.md
  - infrastructure-preferences.md
description: >
  Solutions architect responsible for application design, domain modelling,
  NFR patterns, and component decomposition.
disallowedTools: Task
tier: judgment
---
```

---

## frontmatter の契約と、あなたが行う判断

完全なフィールドごとのスキーマはリファレンスに住む; ここにあるのは、実際に著述するときに
あなたが行う判断のポイントである。

**`name` はファイル名の語幹と一致せねばならない。** `aidlc-data-governance-agent.md` に
あるファイルは `name: aidlc-data-governance-agent` を宣言する。パーサーはこれをキーに
するので、不一致は決して解決しない agent を著述する最も簡単な方法である。ローダーは
ファイル間で重複した agent の `name` 値を拒否し、エラーで両方のファイルを名指す。

**agent は既定でセッションのツールセット全体を継承する。** 同梱される 14 の agent の
どれも `tools:` allowlist を宣言しないので、各々はセッションが提供するすべてのツールに
手が届く — `Read`、`Edit`、`Write`、`Glob`、`Grep`、`AskUserQuestion`、`Bash`、
`WebSearch`、そして継承した MCP ツールも同様に。ペルソナを絞るには、使ってよいツールだけを
名指す任意の `tools:` allowlist を足す。`tools:` を挙げるとペルソナはそれが名指すツール
ちょうどに絞られ、完全修飾の `mcp__<server>__<tool>` id も名指さない限り継承した MCP
ツールを落とす（下の MCP 継承の注記を参照）。ドメインが本当により小さな面を要するときだけ
それに手を伸ばす; ほとんどのペルソナはすべてを継承させるのが最善である。

**MCP サーバーは継承されるものであり、agent ごとに付与されるものではない。** プロジェクトルートの `.mcp.json` で宣言された 5 つの MCP サーバーはセッションにプロビジョンされ、すべての agent が自動的にそれらすべてを継承する — 著述すべき agent ごとの付与は無い。ペルソナをあるサーバーから*遠ざけて*おくには、その `tools:` allowlist を、そのサーバーを省いた完全修飾の `mcp__<server>__<tool>` リストに絞る（裸の `mcp__<server>` トークンは no-op であり、サーバーレベルの付与ではない）。継承と制限のモデルは `t110` registry-integrity テストで行使される（[テスト](../reference/09-testing.md) を参照）。

**`disallowedTools` は `Task` を含まねばならない。** これは任意ではない。agent は委譲された
ワーカーとして走る; conductor（ライブの `/aidlc` セッション）が、エンジンの `run-stage`
ディレクティブが `mode: subagent` を運ぶときに `Task` 呼び出しを行う。`Task` を許すと
agent が自身の subagent を産み、フレームワークが防ぐために作られた委譲の連鎖をカスケード
させてしまう。すべての同梱 agent は `Task` を disallow し、あなたのものもそうせねばならない。

**`tier` は仕事の種類を名指す; パッケージャがそれを harness 別の model/effort キーに
射影する。** core の agent frontmatter に生の `model:` や `effort:` を著述することは
決してない — それらは `dist/<harness>/` における射影の OUTPUT であり、
`core/tools/aidlc-tiers.ts` の tier テーブルから導かれる。下流にカスケードする多制約の
推論が仕事であるペルソナには `judgment` を選ぶ — 曖昧な intent を解釈する、濃いコンテキスト
下でアーキテクチャのトレードオフを量る; judgment agent はセッションの model と effort の
両方を継承するので、静かに格下げされることは決してない。明示的な基準に対して新規の入力を
判定する reviewer 型のペルソナには `balanced` を選ぶ。出力が支配的にパターン追従で、方法論が
既に agent の knowledge ファイルに符号化されているとき — delivery plan、CI/CD YAML、
runbook のスキャフォールディングのように — だけ `templated` を選ぶ; templated は effort を
段階的に下げる唯一の tier である（Claude Code、Codex、opencode で; Kiro ではすべての
tier がセッションの model と effort を継承するので、tier はそこでは何も変えない）。迷ったら
`judgment` を使う: 射影テーブル（とプロジェクトの `tier_cap`）は後でいつでもコストを
段階的に下げられるが、低く著述しすぎたペルソナは静かに推論不足になる。完全な射影テーブルと
cap の上書きは [Agent System](../reference/05-agent-system.md) を参照。

さらに 2 つのフィールドは、振る舞いではなく提示を駆動する。`display_name` は statusline が
描画する人間可読なラベルである（architect は "Architect Agent" と表示される）。`examples`
は agent→examples テーブルに文書化された、示唆される knowledge のファイル名を挙げる —
それらは*ユーザーに提示される示唆*である; ランタイムはそれらを決してロードせず、エンジンは
それらをディスクに決して書かない。

正確な必須／任意のテーブルと共有設定のマトリクスは、
[Agent System: frontmatter の契約](../reference/05-agent-system.md#frontmatter-contract) を参照。

---

## visible は active ではない: 2 段階の真実

これは内面化すべき 1 つのことである。ファイルを落とすと agent は *visible* になる; stage に
配線すると *active* になる。両方のステップが要る、さもなくば存在するが決して走らない agent を
得る。

- **発見がそれを visible にする。** `.claude/tools/aidlc-lib.ts` の `loadAgents()` が、
  次の呼び出しで `.claude/agents/` のすべての `.md` ファイルを読み、メタデータマップを導く。
  コード編集は無く、登録ステップも無い — ファイルの存在が登録である。この時点から
  statusline はその display name を描画でき、チームはその space レベルの
  `aidlc/knowledge/<slug>-agent/` ディレクトリの下に標準を足せる。
- **stage への束縛がそれを active にする。** stage は、その frontmatter の `lead_agent` /
  `support_agents` フィールドで、率いる agent と支える agent を slug で名指す
  （`.claude/tools/data/stage-graph.json` にコンパイルされる）。どこかの stage があなたの
  slug を参照するまで、どの `run-stage` ディレクティブもそれを名指さないので、conductor は
  そのペルソナに決して委譲しない。

これはフレームワークの中核の非対称性を映す — stage はその agent を名指す; agent は自分の
stage を決して名指さない。だから agent ファイル単体は設計上、不活性である。新しいペルソナを
働かせるには、それを使うべき stage を編集する; 束縛の仕組みは
[Stage を足す](02-adding-a-stage.md) に住む。

各 agent はまた、あなたが `core/knowledge/aidlc-<slug>-agent/`（フレームワークの方法論）に
著述する knowledge ディレクトリと、space レベルの任意のチームオーバーレイ
`aidlc/knowledge/<slug>-agent/`（あなたの標準）とペアになる。space レベルの
`aidlc/knowledge/` ディレクトリは自由形式で、ブートストラップ時は空である; チームは内容が
できたときに agent ごとのサブディレクトリを作る — エンジンはそれをスキャフォールドしない。
2 層の knowledge ワークフローは [チーム Knowledge](07-team-knowledge.md) で扱う。

---

## ステップ

リファレンスのレシピを映して、ここにワークフローを end to end で示す。

1. **agent ファイルを作る** — `core/agents/<slug>-agent.md` を必須の frontmatter と
   ともに: `name`、`display_name`、`examples`、`description`、`disallowedTools`
   （`Task` を含む）、`tier`。任意の `tools:` allowlist はペルソナを絞る; セッションの
   ツールセット全体を継承するにはそれを省く。本体は同梱ファイルの構造（Core
   Responsibilities、Stages Owned、Collaboration、Knowledge Loading、Key
   Principles）に合わせて書く。
2. **knowledge ファイルを足す** — ペルソナが起動時にロードすべき方法論のために
   `core/knowledge/aidlc-<slug>-agent/` の下に。
3. **stage に配線する** — それが率いるか支える各 stage ファイル
   （`core/aidlc-common/stages/<phase>/<slug>.md`）の `lead_agent` /
   `support_agents` frontmatter に slug を足し、続けて再コンパイル
   （`bun .claude/tools/aidlc-graph.ts compile`）して `stage-graph.json` を再生成
   させる。`stage-graph.json` を決して手編集しない — それはビルド成果物であり、次の
   compile が手作業の変更を上書きする（[Stage を足す](02-adding-a-stage.md#4-regenerate-the-harnesses-so-stage-graphjson-recompiles) を参照）。
   これがそれを active にするステップである。
4. **チーム knowledge ディレクトリを文書化する** — チームがその標準を space レベルの
   `aidlc/knowledge/<slug>-agent/` の下に足すことを注記する。エンジンはこのディレクトリを
   作らない; チームが内容のあるときに作る（space の `aidlc/knowledge/` は自由形式で、
   ブートストラップ時は空）。
5. **手で保守される docs のテーブルを更新する** — Phase Participation マトリクスと
   agent→examples テーブルは自動再生成されない（下の「何が自動で検証されないか」を参照）。

完全なレシピ — 発見、intent-birth、statusline 検証のコマンドとともに — は
[Contributing: Agent を足す](../reference/11-contributing.md#adding-an-agent) にある。
足すのではなく既存の agent のツール、tier、stage 割り当てを変えるには、
[Agent System: agent を変更する方法](../reference/05-agent-system.md#how-to-modify-an-agent) を参照。

### 何が自動で検証されるか

- `loadAgents()` は次の呼び出しで `.claude/agents/` の任意の新しい `.md` ファイルを
  発見する — コード編集は無く、登録も無い。
- `name` または `display_name` が欠けていればパーサーは投げ、ファイルと欠けたフィールドを
  名指す。
- agent は slug でアルファベット順にソートされて返されるので、発見順はすべての
  プラットフォームで同一である。
- intent birth は空の space レベルの `aidlc/knowledge/` ディレクトリを作る; agent ごとの
  サブディレクトリや README は種付けしない。
- statusline は導かれたメタデータから display name を描画する。

### 何が自動で検証されないか

- **stage-graph への参加。** `stage-graph.json` は agent を slug で参照する; そこに配線
  せずに agent を足すと、存在するが決して走らない。発見と活性化は別々のステップである。
- **knowledge ファイルの存在。** `examples` は agent→examples テーブルに文書化された、
  示唆されるファイル名である — 何もそれらを作らず確認もしない。本物の内容は
  `aidlc/knowledge/<slug>-agent/`（space レベルの knowledge dir）の下に置く。
- **手で保守される docs のテーブル。** [Agent System](../reference/05-agent-system.md#phase-participation) の
  Phase Participation マトリクスと、knowledge README テンプレートの agent→examples
  テーブルは手で編集される。agent を足すのと同じ変更でそれらを更新する。
- **agent ファイルの本体。** frontmatter だけがパースされる; 本体の散文は agent が起動する
  とき自身が読むので、同梱の 14 個に合わせて慎重に書く。

---

## 次へ

[Scope](04-scopes.md) — ある種の仕事に対してどの stage（したがってどの agent）が走るかを
決める。
