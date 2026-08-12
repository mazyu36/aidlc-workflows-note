# Workshop モード

`workshop` scope は、*ファシリテーション付きのグループセッション*のために設計された唯一の AI-DLC scope である — 典型的には、1 人（ファシリテーター）がグループの作るものを決めており、N 人の参加者が共有リモートに対して別々の Construction Bolt を並列で駆動するワークショップやトレーニングラボである。

本章は**手動のレシピ**である: 今日すでに同梱されているプリミティブ（`aidlc-worktree`・`aidlc-bolt`・通常の git）を使ってワークショップのフローを文書化する。専用の `--claim-bolt` CLI はまだ無い — claim の意味論は共有リモートへの `git push` に乗っており、このレシピがその契約を明示する。将来のリリースが本章の手順を自動化するかもしれないが、いまはレシピが契約である。

scope の depth / テスト戦略 / スキップ一覧は [Scope と Depth § workshop](05-scopes-and-depth.md#workshop) を参照。本章が前提とする Bolt ごとの worktree の仕組みは [状態と audit](10-state-and-audit.md) と orchestrator の [Construction フロー](../reference/03-orchestrator.md) を参照。初めてのファシリテーターは、まず [はじめかた](01-getting-started.md) を一巡すること — 以下のどのワークショップ手順よりも前に、bun と harness のフレームワークコピーが揃っていなければならない。

> **Harness に関する注記。** このレシピは harness 非依存である: `aidlc-worktree` と
> `aidlc-bolt` のツール（全 harness で共有）と通常の git を駆動する。コマンド例は
> orchestrator を `/aidlc`（Claude Code / Kiro / opencode / Copilot）として呼び出す。Codex では `$aidlc` を
> 使う。claim とマージの git 契約はどこでも同一である。

---

## workshop モードの使いどころ

workshop モードが合うのは、次が**すべて**成り立つときである:

- ファシリテーターがプロジェクトの scope を事前決定している（ワークショップにはテーマがある — 参加者は作るものを選ばない）
- 複数の開発者が Construction の異なる部分を同時に、それぞれ共有リポジトリの自分のクローンで進める
- 全 stage の必須 gate が受け入れられる（workshop モードは gate の儀式を保つ — 目的は方法論を教えることであり、飛ばすことではない）
- テストの深さよりペースが重要 — workshop はセッションを走らせ続けるために、Standard depth・**Minimal** テスト戦略で出荷される

単独開発、アドホックな並列コラボレーション、参加者が Bolt を claim したまま明示的な引き継ぎなしに離脱しうる状況には**合わない**。単独作業には `feature`・`mvp` か、より小さい scope を選ぶ。

---

## ワークショップ実行のかたち

ワークショップの実行には 3 つの当事者がいる:

| 役割 | すること |
|------|--------------|
| **ファシリテーター** | プロジェクトを事前決定し、共有リモート上で Inception を単独で走らせ（全参加者が同じ承認済み Inception 成果物から始められるように）、Construction を並列 claim に開放する |
| **参加者** | 共有リモートをクローンし、ブランチを最初に push することで Bolt を claim し、その Bolt の Construction stage を自分の worktree でローカルに走らせ、gate 承認後に push で返す |
| **グループ** | 各 gate を一緒にレビューする — 仕事は LLM がやり、gate は人間が駆動する |

Inception はファシリテーターがキーボードに座って直列に走る。並列性が効くのは Construction だ — `bolt-plan.md` が承認されると、すべての Bolt が claim 可能になる。

---

## ファシリテーターのセットアップ

### セッションの前に

プロジェクトで Claude Code を起動し（`cd workshop-project && claude`）、workshop scope で最初の intent を birth する:

```
/aidlc --scope workshop
```

新しいワークスペースで scope を名指しすると、最初の intent が birth し、その intent の `aidlc-state.md` に `Scope: workshop` と `Default Test Strategy: Minimal` が刻まれる。参加者が「自分がワークショップだと知っている」プロジェクトをクローンできるよう、birth した intent の状態を共有リモートへ push する。

プロジェクト単位の既定 scope は `.claude/settings.json` の `AWS_AIDLC_DEFAULT_SCOPE=workshop` で設定できる。これを設定すると、クローンで `/aidlc` を実行したすべての参加者が、フラグを覚えることなく自動的に workshop のルーティングを得る — [カスタマイズ § プロジェクト単位の既定 scope](13-customization.md#per-project-default-scope) を参照。

### Inception を単独で走らせる

ファシリテーターは Inception の stage 2.1 から 2.8 を順に駆動し、すべての gate を通す。workshop scope は Ideation（1.1–1.7）を丸ごとスキップする — プロジェクトは事前決定済みで、構想することが無いからだ。

**stage 2.2（practices-discovery）は workshop モードの荷重を受ける。** ここでチームがブランチ戦略・walking-skeleton の立場・テスト姿勢・デプロイのリズムを確認し、Construction は Bolt ごとのすべての判断でその確認を読む。確認の gate は単独ではなくグループで走らせること: その回答が、ワークショップの残り全体で全参加者のマシン上の挙動を統べる。

`delivery-planning`（2.8）が `bolt-plan.md` を出したら、**Construction へ進む前にグループでレビューする。** Bolt のリストが誰が何を claim するかを決める — 参加者はそれを見る必要がある。

承認済みの Inception 成果物を共有リモートへ push する。ここから先、参加者は pull して claim する。

---

## claim の意味論: git push が claim である

このレシピは、クローン間の slug 一意性を通常の git で強制する。AI-DLC 固有の claim レジストリは無い — **共有リモートのブランチ名前空間**がレジストリであり、`git push` が 2 人の参加者が同じ Bolt を取り合うのを防ぐアトミックなプリミティブである。

契約:

1. **claim の直前に必ず `git fetch --all` する。** 古いローカル参照は並行する claim を隠す。
2. **`foo` という Bolt の claim は、`bolt-foo` を共有リモートへ最初に push することを意味する。** 先に push した者が勝つ。
3. **遅れて claim した者は non-fast-forward の push 拒否を見る**（リモートに既に `bolt-foo` があるとき）。それが別の Bolt を選べという合図である。
4. **ブランチの形は practices が統べる — 推測せず読むこと。** `aidlc/spaces/<active-space>/memory/{project,team,org}.md` の解決済み `## Way of Working` の記述が、merge dispatch 時に `aidlc-pipeline-deploy-agent` が読んでマージ先と戦略を選ぶものである。worktree を作るベースブランチは、その確認済みの形と一致しなければならない: トランクベースのチームは `main`、gitflow のチームは `develop`、リリースブランチのチームはアクティブなリリースブランチをベースにする。これは参加者が選ぶのではない — ファシリテーターの確認済み practices が既に選んでいる。aidlc-pipeline-deploy-agent が守る契約は [branching-strategies のナレッジファイル](../../core/knowledge/aidlc-pipeline-deploy-agent/branching-strategies.md)（harness の `knowledge/` ディレクトリに同梱される）を参照。

> **なぜここでは参加者が `--base` を手で渡すのか。** 標準の（単独エンジニアの）Construction フローでは、conductor が `aidlc-pipeline-deploy-agent` を dispatch してアクティブ space の `## Way of Working` を読み、`--base` を解決してくれる。ワークショップのレシピは*手動の*マルチクローン変種である — conductor 駆動のワークショップディスパッチャは今日存在しないため、各参加者は全員が pull したアクティブ space の memory ファイルから同じ `--base` 値を書き写す。stage 2.2 のファシリテーターによる確認が荷重を受けるのはこのためだ: それが全参加者の読む単一の正である。

実際の `aidlc-worktree create` サブコマンドはローカルの worktree とローカルブランチを作るが、push は**しない**。push が claim を公開する。この分離は意図的である: 回線の悪い参加者は、ローカルの作業を全部済ませてから、準備ができたときに claim をアトミックに push できる。

---

## 参加者のフロー

### 1. クローン

```bash
git clone <shared-remote> participant-clone
cd participant-clone
```

クローンには、intent の `aidlc-state.md` が既に `Scope: workshop` に固定され、承認済みの Inception 成果物が intent の record dir に入った状態で届く。

### 2. Bolt を選んで claim する

```bash
# MANDATORY before claiming — refresh local refs
git fetch --all

# Inspect what's already claimed
git ls-remote --heads origin "bolt-*"

# Pick an unclaimed Bolt from bolt-plan.md (e.g. user-profile-api)
# and create the worktree + branch locally. The --base value MUST match
# the team's affirmed branching strategy (read from the active-space memory files):
#   trunk-based  → --base main
#   gitflow      → --base develop
#   release-branch → --base release/<version>
bun .claude/tools/aidlc-worktree.ts create --slug user-profile-api --base main

# Publish the claim atomically. If another participant raced you,
# this push is rejected — pick a different Bolt.
git push origin bolt-user-profile-api
```

push には 3 つの結果がありうる:

| 結果 | 意味 | すべきこと |
|---------|--------------|------------|
| `* [new branch]      bolt-user-profile-api -> bolt-user-profile-api` | claim 成功。ブランチは origin 上で予約された。 | 手順 3 へ進む。 |
| `! [rejected]        bolt-user-profile-api -> bolt-user-profile-api (non-fast-forward)` または `(fetch first)` | 準備している間に別の参加者が先に claim した。 | ローカル worktree を破棄し（`aidlc-worktree discard --slug user-profile-api`）、別の Bolt を選ぶ。 |
| ネットワークエラー / 認証タイムアウト | push が origin に届かなかった。 | `git fetch --all` の後に再試行 — ローカル worktree は無事である。 |

### 3. Bolt をローカルで走らせる

claim が公開されたら、通常どおり Bolt を走らせる — Claude Code のセッションで:

```
/aidlc
```

orchestrator は Bolt ごとのループから拾い上げる。worktree が既に存在しブランチが origin にあるため、参加者は単独開発のどの scope とも同じように作業する — 状態と audit は worktree にフォークし（[状態と audit § Construction の worktree](10-state-and-audit.md) を参照）、Construction の stage は worktree の中で走り、Bolt 末尾の必須 gate がグループレビューのために開く。

### 4. マージして push する

gate が承認したら、標準の `aidlc-bolt complete --merge --slug user-profile-api` のフローが worktree の状態と audit を参加者のローカル main にマージし戻す。**更新された状態ファイルを origin へ push すること**（`git push origin main`）— 参加者のローカルマージは `aidlc-state.md` を更新しており（例: 最初の claim 者に ladder prompt が発火した後の `Construction Autonomy Mode: autonomous`）、他の参加者はワークフローのモードを引き継ぐために、再開の前にそのファイルを pull しなければならない。conductor は `aidlc-pipeline-deploy-agent` を dispatch して `aidlc/spaces/<active-space>/memory/{project,team,org}.md` の `## Way of Working` を読み、マージ先と戦略を選ばせる。audit ログは各 dispatch を `MERGE_DISPATCH_INVOKED` → `MERGE_DISPATCH_RETURNED`（エージェントがタイムアウトして conductor が `org.md` の既定にフォールバックした場合は `MERGE_DISPATCH_FALLBACK`）で挟む。ワークショップ後にこれらの行を確認するのが、チームの確認済みブランチ戦略が実際に守られたかを確かめる最速の方法である。

```bash
# After aidlc-bolt complete --merge succeeds — push the merged target branch
git push origin main    # or develop / release-* per the team's affirmed branching
```

### 5. 引き継ぐ（完了しない場合）

参加者が Bolt を claim したが完了できない場合、手動の引き継ぎは次のとおり:

```bash
# On the original claimant's clone
bun .claude/tools/aidlc-worktree.ts discard --slug user-profile-api
git push origin :bolt-user-profile-api    # delete the remote branch

# On the new claimant's clone, after fetch
git fetch --all
bun .claude/tools/aidlc-worktree.ts create --slug user-profile-api --base main
git push origin bolt-user-profile-api
```

各クローンの audit トレイルはローカルのライフサイクルを記録する（`WORKTREE_CREATED` / `WORKTREE_DISCARDED` / 新しいクローンでの新規 `WORKTREE_CREATED`）。マシンをまたいだ resume は無い — 新しい claim 者は Bolt を最初から始める。

---

## 実例: 開発者 2 人・Bolt 3 つ

共有リモートには 3 つの Bolt を持つ `bolt-plan.md` がある: `user-profile-api`、`billing-service`、`notifications-worker`。

Alice と Bob はそれぞれワークショップのリポジトリをクローン済みである。Inception の stage 2.2 でチームは `aidlc/spaces/<active-space>/memory/team.md` の `## Walking Skeleton` の下で always-skeleton の立場を確認したため、orchestrator は walking-skeleton の印が付いた Bolt（`user-profile-api`）を選び、並列 claim を開放する前に単独で走らせる。**skeleton が最初にマージされる規則は orchestrator が強制する** — Bob が待つのを覚えている必要はない。skeleton が共有リモートに載るまで、orchestrator は並列バッチを dispatch しないだけである。

### walking-skeleton の Bolt — Alice 単独

```bash
# Alice's clone
# (Worked example assumes a trunk-based team — substitute --base develop for
# gitflow teams or --base release/<version> for release-branch teams, per
# aidlc/spaces/<active-space>/memory/team.md.)
git fetch --all
bun .claude/tools/aidlc-worktree.ts create --slug user-profile-api --base main
git push origin bolt-user-profile-api    # claim succeeds — first claimant
# In Claude Code (`claude`), run: /aidlc
#   — runs Construction stages 3.1–3.5 in the worktree
# Group reviews and approves the always-gate (workshop keeps every gate)
bun .claude/tools/aidlc-bolt.ts complete --merge --slug user-profile-api
git push origin main                      # publishes the merged result
```

skeleton がマージされた後、conductor は **ladder prompt** を 1 回発火する:「残りの Bolt はどう走らせる？ Continue autonomously / Gate every Bolt」。グループの選択は `aidlc-state.md` に `Construction Autonomy Mode` として永続する。Bob は次の `git fetch --all` でその選択を拾う — Alice と Bob が口頭で調整する必要はない。

> **`bolt-plan.md` が walking-skeleton の印を付けたのに practices が skeleton-off と言っていたら？** practices が勝つ。orchestrator は衝突を記録する `PRACTICES_OVERRIDE` の audit 行（`Reason: bolt-plan-marker-conflict` に加え、practices の立場と bolt-plan の印）を発行し、印の付いた Bolt は通常の Bolt として走る — always-gate も ladder prompt も無し。practices はチームの常設の声であり、bolt-plan は 1 つのワークフローの解釈である。

### 並列の Bolt — Alice + Bob

両者は `git fetch --all` で Alice のマージ済み main を拾う。（下の両ブロックはトランクベースを想定 — Alice の単独 skeleton ブロックと同じく、gitflow のチームは `--base develop`、リリースブランチのチームは `--base release/<version>` に置き換える。）

```bash
# Alice picks billing-service
git fetch --all
bun .claude/tools/aidlc-worktree.ts create --slug billing-service --base main
git push origin bolt-billing-service      # succeeds
```

```bash
# Bob picks notifications-worker concurrently
git fetch --all
bun .claude/tools/aidlc-worktree.ts create --slug notifications-worker --base main
git push origin bolt-notifications-worker # succeeds — different slug, no race
```

両者はそれぞれのクローンで `/aidlc` を実行する。状態と audit は Bolt ごとの worktree に独立してフォークする。各参加者の Construction の作業は、マージするまでローカルである。

### Alice と Bob が同じ slug を選んだら

両者が `billing-service` を claim しようとしたとする:

```bash
# Alice
git push origin bolt-billing-service
# * [new branch]      bolt-billing-service -> bolt-billing-service     (Alice wins)
```

```bash
# Bob (races a few seconds later)
git push origin bolt-billing-service
# ! [rejected]        bolt-billing-service -> bolt-billing-service (fetch first)
# error: failed to push some refs to '<remote>'
# hint: Updates were rejected because the remote contains work that you do
# hint: not have locally.
```

Bob のローカル worktree は `.aidlc/worktrees/bolt-billing-service/` にまだ存在する — 無駄になったローカルコピーであって、破損ではない。Bob はそれを破棄して代わりに `notifications-worker` を選ぶ:

```bash
bun .claude/tools/aidlc-worktree.ts discard --slug billing-service
git fetch --all
bun .claude/tools/aidlc-worktree.ts create --slug notifications-worker --base main
git push origin bolt-notifications-worker
```

このレースで Bob が失ったのはローカルセットアップの約 30 秒である。状態の破損は無く、ブロックされた参加者もいない。

### 最終収束

両方の Bolt が完了したら:

```bash
# Alice (after gate approval)
bun .claude/tools/aidlc-bolt.ts complete --merge --slug billing-service
git push origin main                      # may need a fetch+rebase if Bob got there first
```

```bash
# Bob (after gate approval)
bun .claude/tools/aidlc-bolt.ts complete --merge --slug notifications-worker
git fetch --all
git rebase origin/main                    # if Alice pushed in the meantime
git push origin main
```

最後の 2 つの push は通常の git の仕組みで直列化される。共有リモートは 3 つの Bolt すべてが main にマージされた状態になり、3 つの `bolt-*` ブランチは掃除できる:

```bash
# Anyone can clean up after the workshop
git push origin :bolt-user-profile-api :bolt-billing-service :bolt-notifications-worker
```

### ワークショップの締め

すべての Bolt がマージされ `bolt-*` ブランチが削除されたら、ファシリテーターは次を行う:

1. **`Bolt Refs` が空であることの確認** — `bun .claude/tools/aidlc-utility.ts status`（または `aidlc-state.md` を読む）が `Bolt Refs: [empty list]` を示すこと。残っている slug はきれいにマージされなかった Bolt を示す。ワークショップを閉じる前に調査する。
2. **保全された worktree の点検** — `bun .claude/tools/aidlc-worktree.ts list` が保全された `.aidlc/worktrees/bolt-*/` ディレクトリをすべて示す。これらは参加者が halt-and-ask で Skip か Abort を選んだために残っている。破棄するか（`aidlc-worktree discard --slug <slug>`）、ワークショップ後の振り返りのために残すかを決める。
3. **audit ログの流し読み** — intent の `audit/` シャードは全参加者の worktree からの audit エントリを運ぶ（各クローンのシャードはコンフリクトなしにきれいにマージされる）。`MERGE_DISPATCH_FALLBACK` の行は「チームの確認済みブランチ戦略ではなく trunk の既定を静かに使った」ことのブレッドクラムである — 振り返りで表に出す。
4. **必要ならリリースをタグ付けする** — workshop scope はすべての Construction Bolt のマージで完了する。ワークショップのプロジェクトが先へ進むなら、ここが自然なタグの位置である。`aidlc/spaces/<active-space>/memory/team.md` にあるチームの確認済みデプロイのリズムによっては、これが staging デプロイを自動で引き起こすことがある。

フレームワークは参加者ごとのセッション再開のケースを処理する — 下の [ワークショップセッションの再開](#resuming-a-workshop-session) を参照 — バッチ途中でセッションが落ちた参加者が遅れて合流する場合に有用である。

---

## workshop モードの gate

workshop モードは**全 stage の必須 gate**を保つ — それこそが要点である。パターンは:

1. LLM が参加者のクローンで stage の作業を完了する
2. 状態ファイルが `[?]`（承認待ち）に移る
3. グループが成果物を一緒にレビューする（同じ部屋で、共有スクリーンで、ビデオ通話で — ワークショップ次第）
4. 参加者が自分の Claude Code セッションで Approve を押すと gate が晴れ、次の stage が始まる

グループレビューこそが workshop モードを `feature` や `mvp` と分けるものだ — 状態ファイルの `[?]` チェックボックスは同じで、レビューの場が違う。gate は成果物を見ているのが 1 人か 20 人かを知らない。

### 並列バッチの gate

conductor が Bolt の並列バッチを走らせるとき（例: 4 人の参加者が 4 Bolt バッチの 1 Bolt ずつを駆動）、gate は **Bolt ごとではなくバッチレベル**である — 1 回の承認がバッチ内の全 Bolt をカバーする。グループは各 worktree の diff を順にレビューし、全承認 / 精査 / 一部差し戻しを決める。差し戻された Bolt の worktree はフォローアップのためにディスクに保全される。

### 複数失敗の halt-and-ask

**単独 Bolt の失敗**（m=1）は、[orchestrator の Construction フロー](../reference/03-orchestrator.md) に記載の標準的な halt-and-ask の単一 AUQ 経路を使う。walking-skeleton の Bolt は常に単独で走るため、その失敗はこの経路を通る。

**同じ並列バッチ内で 2 つ以上の Bolt が失敗**したとき（例: `email-delivery` と `admin-panel` の両方が code-generation のエラーに当たった）、conductor は**逐次の AUQ** を描画する — 失敗した Bolt を slug 順に 1 つずつ、質問本文に `failure <k> of <m>` のタグを付けて。同じバッチの成功した Bolt は **HOLD-MERGE 不変条件**によりマージを保留される。これは散文ではなくツーリングで強制される:

- AUQ のシーケンスを開く前に、conductor は成功した各 Bolt に `aidlc-bolt hold-merge --slug <slug>` を実行する。これはその Bolt の Bolt 別フォーク状態ファイルに `Merge-Held: true` を書く（冪等 — 既に保留中の Bolt の再保留は静かに成功する）。
- マーカーが立っている間、`aidlc-bolt complete --merge --slug <slug>` は非ゼロ終了と `{ok:false, reason:"merge-held", ...}` のエンベロープで拒否する。conductor が AUQ シーケンスの途中で生存者をうっかりマージすることはできない — ツール自体がブロックする。
- 失敗した AUQ がすべて解決されたら（再試行して成功、スキップ、または中止）、conductor は保留中の各生存者に `aidlc-bolt release-merge --slug <slug>` を実行し、元のバッチ順でマージを dispatch する。

各失敗について AUQ は Retry（同じ worktree で code-generation を再実行 — 反復回数は状態で追跡）、Skip（状態で `[S]` にし、worktree をディスクに保全）、Abort（Construction を停止。未描画の AUQ k+1..m は次のセッション再開に持ち越し）を提示する。hold のマーカーはセッションの kill を生き延びる — 下の再開の規則を参照。

> **2 つの別々のクリーンアップ動詞。** `aidlc-bolt abort --name "<name>" --slug <slug> --reason "<text>"` は正準の Bolt レベルの中止である — `Reason: aborted` 付きの `BOLT_FAILED` を発行し、（US-1 AC4 により）既定で worktree ディレクトリを保全する。worktree も取り壊すには `--discard` を足す。`aidlc-worktree discard --slug <slug>` は、レース敗北の復旧（claim レースに負けた参加者が、別の Bolt を選ぶ前にローカル worktree を処分したいだけのとき）に使う、より低レベルの worktree 専用クリーンアップである。両者は交換可能ではない — 失敗として印を付けるべき Bolt があるなら `aidlc-bolt abort`、無いなら `aidlc-worktree discard` を使う。

保留中の Bolt に `aidlc-bolt complete --merge --slug <slug>` を実行したとき参加者が見るエラーメッセージは、一字一句こうである:

```
Merge held by HOLD-MERGE invariant; resolve the failed-sibling halt-and-ask sequence
and run `aidlc-bolt release-merge --slug <slug>` before retrying.
```

これが見えたら、orchestrator は AUQ シーケンスの途中である。まず失敗した兄弟の AUQ をすべて解決すれば、`aidlc-bolt release-merge --slug <slug>` がマーカーを晴らす。

### ワークショップセッションの再開

ワークショップの参加者はセッションを失う — ラップトップのスリープ、ネットワーク断、昼休み。荷重を受ける決定はすべてコミット済みの成果物（`aidlc-state.md`・`audit/` シャード・`aidlc/spaces/<active-space>/memory/team.md`）にあり、再開するセッションが読み直せるため、フレームワークは再開をきれいに処理する。

契約:

1. **再開の前に pull する。** 参加者のクローンで `git fetch --all && git pull` — 他の参加者からのマージ・autonomy mode の変更・新しい claim を拾う。
2. **`/aidlc` はディスクから状態を再導出する。** エンジンはメイン状態から `Bolt Refs` を読み、audit ログを歩き、どの Bolt がどのライフサイクル段階にあるかを再構成する。
3. **`Bolt Refs` にあり、`STATE_FORKED` の行はあるが `STATE_MERGED` が無い Bolt**: orchestrator は Phase 3 に再入する（code-gen を再開）。
4. **`Bolt Refs` にあり、既に `STATE_MERGED` の Bolt**: スキップされる — マージ済み。
5. **フォーク状態に `Merge-Held: true` を持つ生存者**: マージされない。orchestrator は `aidlc-worktree info --slug <slug>` を実行して JSON エンベロープの `merge_held: boolean` フィールドを確認することで、これを決定論的に検出する（マージ後のマイルストーン 13 の取り込みで設定される — orchestrator が状態ファイルを手で解析する必要はない）。未解決の失敗 Bolt の AUQ を先に再描画し、`aidlc-bolt release-merge --slug <slug>` で晴れたら、保留されていたマージを元のバッチ順で dispatch する。
6. **walking-skeleton の ladder prompt が未設定**: 再開したセッションが `Construction Autonomy Mode: unset` を見て、skeleton が既に `[x]` なら、ladder prompt は再開したエンジニアに発火する。最初に再開した者がモードを設定し、以後の再開者は `git pull` でそれを引き継ぐ。

practices と autonomy mode は共有リポジトリの明示的なコミット済み成果物である — マシン間の魔法のような状態同期は無い。pull し、再開し、続ける。

---

## このレシピが扱わないもの

- **専用の `--claim-bolt` CLI ユーティリティ。** 実際のワークショップのドッグフードが具体的な要件（レース時のより良いエラーメッセージ、audit 専用のオフラインモード、古い claim の自動検出）を浮かび上がらせたら、将来のリリースで出荷されるかもしれない。それまでは、`aidlc-worktree create` + `git push` を使う上のレシピが契約である。
- **古い claim の検出。** Bolt を claim したまま解放せずに離脱した参加者は、origin に孤児の `bolt-<slug>` ブランチを残す。ファシリテーターが手で削除する（`git push origin :bolt-<slug>`）。v0.4.0 マイルストーン 15 の将来の `--doctor` 拡張が古いブランチを自動でフラグするかもしれない。
- **audit 専用 / オフラインモード。** 共有リモートが無い場合、claim の調整はファシリテーターと参加者の口頭合意にフォールバックする。workshop モードは本質的にマルチクローンのパターンである。workshop scope の単一ラップトップ実行も可能だが、並列 claim の利点を失う。
- **マルチクローンのワークショップ中の practices の鮮度。** practices は **Construction 開始時に一度だけ**読まれる — conductor は `aidlc/spaces/<active-space>/memory/{project,team,org}.md` から `## Walking Skeleton` と `## Way of Working` を読み込み、その 1 回の読みがその参加者のセッションの Construction phase 全体に効く。参加者の Bolt が走っている間にファシリテーターが practices-discovery を再実行しても、進行中の参加者は `/aidlc` セッションを再起動する（そして新しい確認を `git pull` する）までライブのアクティブ space memory を読み直さない。**ファシリテーターの規則:** どれかの Bolt が走っている間は practices-discovery を再実行しない。進行中のすべての Bolt の gate を先に終わらせる。**参加者の規則:** セッション再開の直前に必ず `git fetch --all && git pull` を実行する — 離席中に着地した practices の変更を拾える。同じ規則は参加者フロー手順 2 の `--base` 値にも効く: アクティブ space memory から書き写す値は、最後の pull 時点の鮮度でしかない。

---

## 関連の読み物

- [Scope と Depth § workshop](05-scopes-and-depth.md#workshop) — scope の stage 一覧・depth・テスト戦略
- [状態と audit](10-state-and-audit.md) — Construction の worktree が状態と audit をフォークする仕組み
- [CLI コマンド](12-cli-commands.md) — `aidlc-worktree` と `aidlc-bolt` のサブコマンドリファレンス
- [Orchestrator: Construction フロー](../reference/03-orchestrator.md) — 各 Bolt の中で何が起きるか
- [ブランチ戦略（ナレッジファイル）](../../core/knowledge/aidlc-pipeline-deploy-agent/branching-strategies.md) — aidlc-pipeline-deploy-agent の merge-dispatch 契約
