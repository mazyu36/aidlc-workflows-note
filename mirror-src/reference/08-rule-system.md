# Rule System

> 対象読者: Tier 2/3（team adopter、framework contributor）。

この章は、v0.5.0 の rule システムのスキーマレベルのリファレンスである: rule ファイルがどこに住むか、scope がどう導出されるか、継承チェーンがどう解決するか、そしてどの frontmatter フィールドが有効か。resolver（`aidlc-graph.ts compile`）と doctor の rule-drift チェックが照合して読む仕様である。rule は制御ループのフィードフォワードの半分である; [Sensor System](07-sensor-system.md) はそれがペアになる決定論的検証の半分を扱う。ユーザー向けのウォークスルー — learning-loop 儀式、ANZ の実例、確認された learning がどう rule ファイルに着地するか — は、User Guide の [Rules and the Learning Loop](../guide/09-rules-and-the-learning-loop.md) を参照。

## Layout

rule は、アクティブな space の memory レイヤー `aidlc/spaces/<active-space>/memory/`（workspace ルートの手編集可能な 1 セットで、各 harness がそのネイティブ include 経由で読む — Claude の `@`-import スタブ、Kiro CLI と Kiro IDE の resources glob、Codex の `AIDLC_RULES_DIR`）に、scope 名の中立的なファイルとして住む:

```
aidlc/spaces/<active-space>/memory/
├── org.md
├── team.md
├── project.md
└── phases/
    ├── ideation.md
    ├── inception.md
    ├── construction.md
    └── operation.md
```

このレイアウトは、team が著述する harness 設定（かつては別の practices 名前空間にあった）と自己学習の guardrail（かつては 2 階層深かった）を、`aidlc/spaces/<active-space>/memory/` の単一のアクティブ space memory ディレクトリに統合する。

## ファイル名由来の scope

rule ファイルは `scope:` frontmatter フィールドを **運ばない**。scope はファイル名から導出される:

| ファイル名パターン | Scope |
|---|---|
| `org.md` | `org` |
| `team.md` | `team` |
| `project.md` | `project` |
| `phases/<phase>.md` | `phase`（phase 値 = ファイル名） |

org、team、project、phase の rule は path-scoping の frontmatter を運ばない — pull 著述が関係を stage 側に置く。org / team / project は普遍的な既定としてすべての stage に適用される（ファイル名由来）; 合致する phase rule が付くのは、stage の frontmatter の `phase: <name>` フィールドが `phases/<name>.md` の pull import だからである。

## 5 レイヤー継承

rule はワークフロー開始時に 5 レイヤーのチェーンを通して解決する:

```
org → team → project → phase → stage
```

org はフレームワークの既定を運ぶ; team と project のレイヤーは team が肯定し project が特化した内容で拡張する。phase は直交する — 合致する `phases/<name>.md` rule を付けるのは、stage が既に frontmatter で `phase: <name>` を宣言しているからである（`requires_stage` や `consumes` と同じ著述の方向）。stage rule は将来のための予約である; 著述されたとき、各 `aidlc-stage-<slug>.md` は stage の `slug:` 宣言経由で付く。このチェーンが具体化する、より広い 2 軸構成モデルへは [01-architecture.md § Configuration layers](01-architecture.md) をクロスリンクせよ。

コンパイル出力（`stage-graph.json` の stage ごとの `rules_in_context` フィールド）は、解決済みのチェーンを各 stage ノードに焼き込む。ランタイムはチェーンを決して歩かない — コンパイルが解決を所有する。

## Strict-additive なランタイムモデル

適用可能なすべての rule が `rules_in_context` に現れる。org、team、project の rule は連結される; ランタイムで何も落ちない。phase rule は、rule のファイル名が stage の `phase:` 宣言に合致するとき付く — glob フィルタも、具体パスの合成も無い。agent はセッション開始時にフルチェーンを読む。

conflict（より狭い scope がより広いポリシーに矛盾すること）は、learning が resolver に届く前に memory gate — §13 Learnings Ritual の admission チェック — で拒否される。チェックはセクションレベルである: 提案された日付付き learning エントリが `memory/project.md`（または `memory/team.md`）に書かれようとするとき、orchestrator はそれを `memory/org.md` の合致する見出しと LLM チェックで比較する; conflict が見つかれば、ユーザーは **revise、skip、または escalate** する（override 経路は無い）。Practices-discovery の affirmation gate はもう 1 つの admission gate だが、その promotion は決定論的なセクション置換（`aidlc-state.ts practices-promote`）でユーザーの affirmation によって正当化される — 自動の org-conflict チェックは走らせない。org と team/project の内容の書き込み後のドリフトは、doctor の rule-drift 行（下）で別途表面化される。

この設計は、以前の `enforcement: enforced` キーワードと `overrides:` ブロックモデルを置き換える。両キーワードはスキーマから除かれた。frontmatter パースは下の unknown-key 許容ポリシー経由でそれらを拒否する — throw するのではなく静かに通り抜けるが、resolver は無視する。

doctor の rule-drift チェックは、書き込み後のドリフトをオンデマンドで表面化する: org rule が team や project の内容が既にディスクに着地した後に変わったとき、doctor は決定論的に、team/project の practice ファイル（`memory/team.md`、`memory/project.md`）が *populated* な org 見出しと共有する `##` 見出しを見つけ、各オーバーラップを advisory 候補 — ファイル、セクション、引用された org の文 — として表面化し、`Rule drift: N team/project rule(s) overlap org policy (review for contradiction)` とレンダーする。doctor 自身は LLM を走らせない: 検出はバイト再現可能な見出し/文字列の仕事である。contradiction の判定 — admission gate が走らせるのと同じセクションレベルの LLM チェック — は、観察時の、消費側 orchestrator のもので、非ブロッキングである。人間はそれから、表面化されたドリフトを revise、escalate、または accept する。

## `pairing:` フィールド

rule は `.claude/sensors/aidlc-*.md` の決定論的な sensor と MAY ペアになる:

```yaml
---
pairing: aidlc-required-sections
---
# or
pairing: feedforward-only
---
```

有効な値:

- `feedforward-only` — rule に sensor の伴侶が無い（フレームワークがそれを決定論的に検証できない）という明示的な宣言。
- `<sensor-id>` — 既存の `.claude/sensors/aidlc-<id>.md` の `id:` フィールドに合致せねばならない。

doctor の paired-coverage 行は、paired 対 feedforward-only の rule を数え、unpaired な rule を coverage ギャップとして表面化する（[Rule-drift detection](#rule-drift-detection) を参照）。

## Rule-drift 検出

`/aidlc --doctor` は、rule/sensor の状態を観察する 2 つの advisory 行を出荷する。両方とも読み取り専用で常に pass する — どちらもヘルスチェックの exit code を変えない。（v0.6.10 時点で `--doctor` は cold-safe である: paired-coverage チェックが発する `GUARDRAIL_LOADED` audit 行は、アクティブな intent の `audit/` シャードが既に存在するときだけ書かれる。まだ intent の無い fresh なシェルでは、doctor は行を表示するが何も発せず、ファイルを作らない。）

- **Rule drift** — 各 team/project practice ファイル（`memory/team.md`、`memory/project.md`）について、doctor は `memory/org.md` の *populated* な見出しの下にも現れる `##` 見出しを見つけ、各オーバーラップを候補ペア — ファイル、セクション、逐語で引用された最初の org の文 — として表面化する。org のボディが空の見出し（例: フレームワーク既定の `## Forbidden`、`## Mandated`、`## Corrections`、これらは HTML コメントのみを保持する）は数えない — オーバーラップは両側に内容を運ばねばならない。数 N は *構造的な* 候補ペアの数であり、LLM 確認済みの contradiction ではない: doctor は決定論的に検出する; contradiction の判定は観察時の orchestrator-LLM のものである（[strict-additive section](#strict-additive-runtime-model) を参照）。
- **Paired sensor coverage** — `pairing: <sensor-id>` を運ぶ各 rule について、doctor は `aidlc-` プレフィックスを剥ぎ、名指された sensor が少なくとも 1 つの stage の解決済み sensor 集合（`sensors_applicable`）に存在することを確認する。行は `Paired sensor coverage: P/(M-X) guardrails paired (X feedforward-only)` と読める、ここで M は `pairing:` 値を運ぶ rule、X は feedforward-only の rule（sensor を決して必要としない）、P は名指された sensor が解決する rule である; unpaired な rule（sensor id は名指されるがどの stage にも束縛されない）はインラインで列挙される。これは **file-existence チェックであり、semantic なものではない** — 束縛が解決することを確認するのであって、sensor が rule に合うことではない。行は初期化済みプロジェクトで実行ごとに 1 回 `GUARDRAIL_LOADED` audit イベントを発する（発行は `audit.md` の無い pristine なプロジェクトでは抑制される — 上の cold-safe ノートを参照）。

## Forward-compat ポリシー

rule frontmatter は additive な拡張によって forward-compatible である:

- 新しいフィールドは additive に着地する — 既存の rule 行は決して書き直しを要さない。
- 消費者は未知の frontmatter キーを MUST 許容する（無視 + 通り抜け）。これがレガシーの `enforcement:` / `overrides:` キー（ユーザー拡張オーバーレイに在れば）がエラー無しでロードされる仕組みである。
- rule ボディの規約（`## Forbidden`、`## Mandated` のようなセクション）は既存の guardrail 規約に従う。
- Learnings Ritual（memory gate）は、確認された各 learning を practice として直接 space memory ファイル — `memory/project.md`（既定）と `memory/team.md`（ワンクリック promote; org-scope 書き込みは無し）— に、その diary-heading トピックの下の日付付きエントリとして書く。確認された learning *は* practice である: これらは practices-discovery が肯定するのと同じファイルであり、別の `*-learnings.md` サーフェスではない。resolver はそれらを清い整数チェーン `SCOPE_PRIORITY`（org:0、team:1、project:2、phase:3）でソートする — 分数の 1.5 / 2.5 tier は無い。`aidlc-learnings.ts` の memory gate は、上の `## Strict-additive runtime model` で述べた admission conflict-check のライブな実装者である（単一の提案された日付付きエントリ 対 `memory/org.md` の合致するセクション; revise / skip / escalate、override 経路無し）。

v0.5.0 より前の rule ファイルは、rename + flatten の着地後も変更なしでロードされる; 移行はパスのみである。

## Next Steps

- **Sensors** — rule が `pairing:` 経由でペアになれる決定論的な半分。
  [Sensor System](07-sensor-system.md) を参照。
- **The compile boundary** — `rules_in_context` がワークフロー開始時に一度
  解決され、ワークフロー全体を通してグラフノードから読まれる仕組み。
  [Plane Architecture](02-plane-architecture.md) を参照。
- **The learning loop in practice** — `memory.md` diary、承認 gate の儀式、
  そして ANZ の実例。User Guide の [Rules and the
  Learning Loop](../guide/09-rules-and-the-learning-loop.md) を参照。
- **The two-axis configuration model** — この 5 レイヤーチェーンが具体化する
  より広いルーティング原則。
  [Architecture § Configuration layers](01-architecture.md) を参照。
