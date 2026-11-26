# 第7回評議会 — 収益化・市場調査（途中記録）
2026-11-27。確定価格・契約・製品コード変更なし。ユーザーは市場調査、料金設計、集客設計をAIに委任。1日課金の追加とオフラインデータエクスポートの別料金を希望。本人が日々の宣伝・営業をする前提にしない。無料でも十分な価値を重視。

## 追加の競合調査
前回 competitive-research.md の内容は保持。追加発見：
- [AstroPlanner 日本App Store](https://apps.apple.com/jp/app/astroplanner/id6821403587)：無料掲載、GSI地形・航空写真・建物、天体、被写体から地点/日時逆算、気象、オフライン保存、登録・広告なしと説明。全機能の価格・実機・精度は未検証。レビュー数不足。重要比較先に追加。
- [Sidekick Planner](https://www.sidekick-lab.com/sidekick-planner)：国内PC向けβ。地形・太陽アライメント、期間検索、QRによるスマホ閲覧。公式ページの取得版はβ1.00と検索結果のβ1.03が混在するため最新機能・価格を未確定とする。
- [ダイヤモンド・パール富士マップ](https://decoincidence.jp/fuji)、[富士山とともに](https://fujisantotomoni.jp/calendar/)：公開Webツール・撮影日程。無料代替の存在を考慮。
- [国交省ダイヤモンド富士](https://www.ktr.mlit.go.jp/chiiki/chiiki00000111.html)、[山中湖観光協会](https://lake-yamanakako.com/feature/diamondfuji)：公的な撮影情報の需要例。検索量、MAU、購入者数を示す証拠ではない。
- [TPE Web](https://photoephemeris.com/en/help/tpe-web/choosing-and-purchasing-a-tpe-web-subscription/)：4段階、地域別価格はログイン後。価格未確認。
- [PrimeHour](https://primehourapp.com/)：月$4.99・年$39.99、有料/無料機能の例。ただし直接同等競合でない。
- [Topo GPS](https://www.topo-gps.com/maps-coverage-in-topo-gps/)：地域/国ごとの買い切りと年額混在、日本GSI地形図€3.99・航空写真€4.99の掲示。RidgeArcのDEM配布許諾や単価を証明しない。
- [Locus Map](https://docs.locusmap.app/doku.php?id=manual:user_guide:maps_locusmaps)：地図別購入、初回3地図無料の例。

## 料金仮説（ユーザーの要望を含む、支払意欲未検証）
- Free：広告・登録不要の基本表示、太陽月、日時、遮蔽、限定された実用的な逆探索。試用で実際に成果を得られる。精度を意図的に劣化させない。画像・撮影計画の簡易保存/共有は無料候補。
- Day pass：150円/購入後24時間、非自動更新。任意日時の探索は利用権の有効時間と別。利用開始時に有効化する方式も検討。月390円、年1980円は従来の試算価格を保持し、実測で決定。日・月・年のオンライン機能差は基本なし、計算資源の濫用対策は明示。気象は商用契約・原価・法的ゲートで別枠を検討し、最初から全プランに確約しない。
- オフラインデータエクスポート：別途買い切り候補、地域・容量・解像度・有効範囲を表示。仮300〜800円/パック、実測前。購入済みパックはサブスク失効後も保存/利用できる設計を候補とする。簡易計画の保存と、任意地点・日時を圏外で再計算可能なDEM/地図/索引パックは区別。予報は取得時点のスナップショット、更新不能時は明示。通常キャッシュを故意に消さない。オフライン動作、ブラウザ容量・永続化・再取得・版管理・許諾を検証。料金は加工・圧縮・検証・パッケージ化のサービス対価。
- [GSIタイル](https://maps.gsi.go.jp/development/ichiran.html) はリアルタイム読込なら出典明示で申請不要と説明。別途 [測量成果手続](https://www.gsi.go.jp/LAW/2930-index.html)・[規約](https://www.gsi.go.jp/GSI/chosaku.htm) を確認し、オフライン配布/加工成果/有償販売の承認要否を個別に照会。リアルタイム利用の扱いを販売に拡張しない。
- [Stripe料金](https://stripe.com/jp/pricing)：国内カード3.6%、Billing継続課金0.7%の公開例。1日パス・パックは単発決済、税/返金/海外カード・決済条件は別。150円の手数料控除後144.6円の仮試算。最小決済額や審査・法定表示・本人確認等は公開前確認。
- クライアント計算中心では課金制御の完全な耐改変性は保証できない。オンライン権限は署名付き期限とサーバ側の権限判定、決済Webhookの署名・冪等性。重いサーバ計算や配布は別制限。常時接続必須のDRMで圏外利用を壊さない。実装は後。

## 集客：製品が宣伝になる構造
1. 国内から検証。公開検索ページ（例：ダイヤモンド富士、パール富士、山頂の最初/最後の光、地形による日没）に実計算の条件・結果・制約・更新日・プレビューを掲載し、同条件のRidgeArcへ遷移。実際に役立つページを少数制作。検索エンジン向け低価値ページの量産はしない。[Google helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) / [spam policies](https://developers.google.com/search/docs/essentials/spam-policies)。
2. 共有画像・URL/QR。稜線+天体+日時+小さなRidgeArc署名、公開プレビューから自分の条件で再計算。共有操作は本人が選択し、隠したい撮影点は座標省略/丸め/非公開（リンク・EXIF含む）。丸めた位置で正確な構図の再現は保証しない。SNS投稿の強要や勝手な公開なし。共有機能は無料。
3. 写真・登山系のコミュニティやブログに、規約を守って少数の有用な実測事例を紹介。アプリの宣伝だけを大量に投稿しない。写真コンテスト/観光サイトへの埋め込み、地元メディア掲載は後段候補。本人が毎日営業することを前提としない。
4. 計測：Search Console、プライバシー配慮したイベント集計。検索表示・流入→実稜線初表示→日時変更/探索成功→共有→再訪→料金表示→購入→更新/解約。正確な撮影地点/個人情報を解析ログに不要に保持しない。公開前の想定CVRは市場実測でない。定性試用と少数価格検証で無料境界/価格を更新。架空購入や偽の希少性は用いない。

## 原価・公開ゲート
[Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)・[Workers](https://developers.cloudflare.com/workers/platform/pricing/)・[R2](https://developers.cloudflare.com/r2/pricing/) を候補とし、静的配信と動的処理・保存・オブジェクト操作を区別。データライセンス、上限、予算、キャッシュ、濫用、失敗時の機能縮退を設計する。
[Open-Meteo](https://open-meteo.com/en/pricing) 無料API非商用、Standard月100万換算calls、Professional500万。商用金額未取得。独自予報許可要否は第5回の公開ゲート維持。課金契約なし。地形・天体の公開を不必要に遅らせない。
市場規模・検索ボリューム・実CVR・継続率・運用原価・実機比較は未検証。価格、収益、初期製品範囲、販売開始は決定しない。次の工程は競合実機比較と検証可能な初期リリース範囲/技術優先順位の整理。調査は開発を止める障害にしない。
