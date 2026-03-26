/**
 * もりもり版（予約 + QA）正式名
 *
 * 注意:
 * - メモリー機能（画像保存/履歴表示）は分離済みです。
 * - 実体コードは `gas/Code.gs` にあります。
 *
 * 使い方:
 * 1) `gas/Code.gs` の全文をコピー
 * 2) GAS の `Code.gs` に貼り付けてデプロイ
 *
 * 3本管理:
 * - main(予約-only): `gas/Code_reservation_only_base.gs`
 * - もりもり(予約+QA+メモリー): `gas/Code.gs` + GAS上の `MemoryPage.html`（=このファイルの実体）
 * - 参考: 別チャネルだけ切り出すとき `gas/Code_memory_standalone.gs`（通常は不要）
 */

