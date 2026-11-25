# RidgeArc — 競合調査（公開情報・限定試用・レビュー）
調査日：2026-11-26  
位置づけ：公開資料、公開レビュー、開発者本人の限定試用を比較。定量ベンチマーク・市場規模調査は未実施。日本の一部iOS価格のみ確認。  
基準：[製品構想・目的定義](product-vision.md)

## 1. 結論

2026年の競合は既に地形、太陽・月、撮影日時の探索、3Dプレビュー、天候の統合に進んでいる。RidgeArcは機能数や逆算機能の存在だけで差別化できるとは考えない。
最重要比較先は TPE Web v4、PlanIt Earth、Inverza。操作の簡潔さはPeakFinderも比較先とする。

## 2. 主要競合

| 製品 | 確認できた機能 | 課金・対応環境（公開資料） |
|---|---|---|
| TPE Web | 地形・天体、日時検索、可視領域・地平線、被写体基準の撮影地点逆算、気象、3D | Web無料＋Supporter/PRO/MAX、別途iOS製品 |
| PlanIt Earth | 地形VR、太陽・月・星空、日時・地点のアライメント、気象、光害、潮汐、オフライン地域 | 無料部分＋年額・買い切りPlanIt+、PC/モバイル/Web |
| Inverza | 地形の地平線と天体軌跡、3Dと地形影、朝夕焼け・霧・雲海・水鏡等16条件、日時アライメント | iOS、年額方式。公式プライバシー文書は$4.99/年と記載。試用期間・地域別実売額は現行の購入画面で未確認 |
| PhotoPills | 太陽・月・天の川、固定地点の日時探索、地図とAR、撮影計算 | iOS/Android、日本iOS ¥1,800 |
| PeakFinder | 360°の山岳線画パノラマ、太陽・月、世界の山名、300km描画範囲（ストアの説明）、オフライン | iOS/Android、日本iOS ¥1,000、継続課金なしと説明 |
| Sun Surveyor | 太陽・月・天の川の位置検索、地図・AR、地形の遮蔽物プレビュー | iOS/Android、価格未確認 |
| PlanIt Pro | 旧来の統合撮影計画、地形ビューファインダー、天体・潮位探索 | iOS/Android、日本iOS ¥1,500＋アプリ内購入 |
| LightChance / SkyCandy | 朝夕焼けなどの気象条件予測 | 個別の機能・価格は追加調査 |

## 3. 主要目的G1〜G5に対する評価

- G1（地形による出現・遮蔽）：InverzaのHorizon Paths、TPE iOSの山・稜線からの太陽・月の出現時刻検索、PlanIt EarthのHorizon Sun & MoonとSun & Moon Visibility（公式ガイドではpro beta）を確認。円盤の全接触・再出現を自動一覧化する仕様と精度は未確認。
- G2（稜線と軌跡）：PeakFinder、Inverza、PlanIt Earth、TPEなどが対応。RidgeArcの距離別のシンプルな2D表現は操作性・見た目を比較する。
- G3（固定観測地点から日時）：PhotoPills、Sun Surveyor、TPE、PlanIt Earth、Inverzaなどが対応。既に一般化した機能。
- G4（山間地で水平線・地平線まで日没を見られる場所）：TPEは指定時刻の天体が地形より上に見える地点を地図で表示できる。探索地域を指定して真の地平線まで遮られない地点と日時を自動探索するという厳密な条件をそのまま満たすかは未確認。差別化候補として実査する。
- G5（被写体から日時・撮影地点）：TPE WebのShot Alignmentは被写体、天体、時刻窓、角度許容差、カメラ高、最大距離に基づく地図上のヒートマップを提供。被写体への視線遮蔽を考慮し、候補選択で時刻と地点が連動する。公式解説にはダイヤモンド富士の例もある。PlanIt Earthにもカメラ・被写体ピンを用いた探索機能があるが、G5と同一の範囲指定・逆算条件の実機確認は未実施。複数日を一括して候補曲線・帯として比較する能力、太陽までの遮蔽、地形精度は別途検証する。

## 4. 差別化仮説（未検証）

1. 日本の1m・5m DEM等を適切に活用し、急斜面・近景・稜線の複雑な遮蔽を扱う。高解像度の入力を使うだけで競合より正確になるとは限らず、実写・独立計算で比較する。
2. 地図上のピンドラッグから風景が連続的に変化し、日付・時刻を変えても構図が維持される体験。60fps目標は競合と同じ実機で測定する。
3. G4の条件を直接指定できる探索と、G5の長期間の候補曲線・帯、日時、遮蔽と不確実性を一体表示する仕組み。
4. 写実性や機能数ではなく、現在の2Dの視認性、操作の少なさ、撮影したくなる体験を優先する。
5. 遮蔽・日照・気象に関する根拠と不確実性をわかりやすく表示する。Inverzaも予測理由・信頼度を提供するため、独自性は検証が必要。

## 5. 次の実機比較

以下は技術設計時の比較ベンチマーク候補。開発者本人によるTPE・PlanIt・PeakFinderの限定試用は実施済み（第7節）。有料機能・Inverzaは未試用。競合調査フェーズを延長する必須条件にはしない。
- 丹沢湖と富士山など同じ座標・視点高・日付で地形、太陽、接触時刻を比較。過去の丹沢湖写真は地点未確定なので正解値としない。
- 2027年3月6日の候補を、固定地点の日時検索と富士山基準の逆算で検証。
- 山間部の地平線日没探索を比較する。条件、探索範囲、結果、根拠を記録。
- 操作回数、視点高調整、地図ピン移動、フレーム安定性、読み込み、スマホ縦横、オフライン、料金、データ範囲を測定。
- 精度、速度、操作性、市場需要・価格は公開情報だけで優劣を断定しない。

## 6. 出典（公式）

- [TPE Web 4.0、2026-07-02](https://photoephemeris.com/en/news/tpe-web-4-0-launches-today/)
- [TPE Shot Alignment、2026-07-05](https://photoephemeris.com/en/help/tpe-web/using-the-shot-alignment-tool/)
- [TPE Viewshed and Horizon Profile](https://photoephemeris.com/en/help/tpe-web/using-viewshed-and-horizon-profile/)
- [TPE Visual Search](https://photoephemeris.com/en/help/tpe-web/using-visual-search-in-tpe-web/)
- [TPE Web 4.11、2026-11-10](https://photoephemeris.com/en/news/whats-new-4-11/)
- [TPE 料金体系](https://photoephemeris.com/en/help/tpe-web/choosing-and-purchasing-a-tpe-web-subscription/)
- [PlanIt Earth](https://www.planitphoto.com/earth)、[ガイド](https://www.planitphoto.com/earth/guide)、[Google Play](https://play.google.com/store/apps/details?id=com.planitphoto.planitearth)
- [PlanIt Pro](https://www.planitphoto.com/pro)
- [Inverza](https://www.inverza.app/)、[現象一覧](https://www.inverza.app/conditions)、[プライバシー文書（価格記載）](https://www.inverza.app/privacy)
- [PhotoPills](https://www.photopills.com/)、[ガイド](https://www.photopills.com/user-guide)
- [PeakFinder](https://www.peakfinder.com/mobile/)、[App Store](https://apps.apple.com/us/app/peakfinder/id357421934)
- [Sun Surveyor](https://www.sunsurveyor.com/)
- [LightChance](https://lightchance.com/)、[SkyCandy](https://play.google.com/store/apps/details?hl=ja&id=com.pa.skycandy)

第1〜6節は一次調査を基礎とし、第7〜11節で限定試用・追加調査・設計への反映を記録する。公開資料に記述が見つからない機能を「存在しない」とは判断しない。

## 7. 開発者本人の限定試用（2026-11-26まで）

以下は本人の感想であり、代表的利用者の評価や性能測定結果ではない。

| 製品 | 試用範囲・感想 | RidgeArcへの示唆 |
|---|---|---|
| TPE | アカウント未作成で試用。操作しづらく、見づらく、課金意欲が生まれなかった。一方、日の出や薄明等の時系列表示は良い | 登録・学習なしで価値を体験できる導入、現象の時間軸表示 |
| PlanIt | 操作しづらい。地形ビューは有料のため未確認。試用版の厳密な製品バージョン・有料機能の操作性は未確認 | 基本の風景をすぐ見せる。価格と有料機能の境界を分かりやすくする |
| PeakFinder | 山名・稜線・地形の表示が面白い。一方、3Dソフト風の操作感は好みではない | 山名・標高と稜線の輪郭を独立オプションにする。3D世界ではなく投影済みの2D風景を操作する感覚を重視する |
| RidgeArc v0.10 | 拡大して地形の形状を確認したときに魅力を感じ、ダイヤモンド富士の撮影候補日を発見 | 現在の風景表現と探索する楽しさを保持する。実地精度の証明とは区別する |

## 8. 追加公開情報調査

### 8.1 逆算機能

TPEのShot Alignmentは固定被写体と天体を基準に、角度許容差と時刻窓に応じた観測地点の候補を地図上に描く。候補を選択するとカメラ地点・被写体ピン・時刻を更新する。2026年10月の公式フォーラム更新ではMAXプランが必要とされている。すでに時間の変化を含む逆算を提供しているため、単なる曲線描画を独自機能と見なさない。[公式解説](https://photoephemeris.com/en/help/tpe-web/using-the-shot-alignment-tool/) / [公式フォーラム](https://forum.photoephemeris.com/t/tpe-web-4-9-beta-update-beautiful-skies/1347)

PlanIt Earthの公式ガイドは日出・日没の地形条件、可視時間帯、気象モデル比較、潮位と他の撮影条件の組合せ検索を掲載している。[ガイド](https://www.planitphoto.com/earth/guide)

残る差別化候補はG4の条件を直接指定して地点を検索する機能、G5で複数日を比較する操作、2D風景との連続的な同期、精度根拠・遮蔽・欠損の扱い。競合にないことや精度の優位性は未証明。逆算アルゴリズムの設計では画面座標ではなく実空間の条件を解く。

### 8.2 Inverzaの自然現象予測

公式情報では16種類の自然現象を判定し、撮影者と被写体を別地点に設定して各々の地形遮蔽・日照を比較できる。被写体が遠い場合は気象も別地点で取得する設計が説明されている。丹沢湖で想定した「谷が暗く山頂に光が残る」問題に直接関連する。

開発者の技術解説では、Open-Meteoの基本予報、太陽方向の遠方の雲、大気質、水域関連情報、OSMによる地理条件、METAR実測、地域気象モデル、過去の予報ランによる安定性を統合する。データが不足すると簡略モデルへフォールバックするという。これは開発者による説明であり、予測性能を独立検証した研究ではない。

RidgeArcへの示唆：気象量の表示、撮影者と被写体の別予報、光路を考慮する遠方雲、予報の変動、データ欠損と現象判定を分離する。単純な経験則・LLMの説明だけで精度を保証せず、実測で現象ごとに検証する。競合の手法・閾値をそのまま採用する判断はしない。予報スコアは校正済み確率とは限らない。

出典：[現象一覧](https://www.inverza.app/conditions) / [複数データソースの解説](https://www.inverza.app/blog/how-inverza-sees-the-sky) / [撮影者と被写体の日照](https://www.inverza.app/blog/set-subject-and-horizon-paths)

## 9. 公開レビューの定性調査

対象は公開ストアレビューとRedditの関連投稿。無作為抽出・全件集計・重複除去による統計調査は行っていない。旧版レビューも含むので、現行版の不具合発生率を推定しない。PlanIt ProとPlanIt Earthは別製品であり、旧製品のレビューを新製品への直接評価として扱わない。

| 発見 | 出典・内容の要約 | 設計への示唆 |
|---|---|---|
| 学習コスト | PhotoPills米国App Storeの2013年レビューは高評価ながら教程を繰り返し見る必要があったと述べる。Reddit 2022年のPlanIt Pro比較では機能の豊富さと操作難度が指摘される | 最初の価値体験までの時間を測る。詳細を段階的に開く |
| 情報の解釈 | Redditの天の川計画相談（2022年）は位置情報があっても読み解けないという問題を示す | 数値より実際に見える2D構図を優先 |
| 価値への支払意欲 | PhotoPills、PlanIt Proの好意的レビューは構図確認・撮影準備の時短・撮影成功を評価する。習熟後に操作が直感的との評価もある | 競合UIが万人に悪いとは判断しない。探索から撮影判断までの操作数と達成率で比較 |
| 追加課金の認識差 | PlanIt Pro米国App Storeの2023年レビューで、購入済みにもかかわらずVR機能に別の契約が必要だと不満。Androidのレビューにも契約期限の認識不具合が報告される | 有料範囲を購入前に明示。購入復元を検証 |
| 現地での信頼性 | PeakFinder Google Playで保存データの再取得要求により山頂で利用できなかったという報告。方位の認識に関する報告もある | オフラインデータの準備状況、期限、範囲を表示。更新で不用意に消さない。センサー誤差を明示 |
| PCとスマホ | Reddit 2025年の撮影計画投稿でモバイル専用のツールへの不満 | PCで計画、スマホで確認する流れを設計。同期方法は未決定 |
| 気象から行く価値を判断 | Inverza開発者のReddit紹介投稿に、早朝移動の無駄を避ける価値や低価格への好意的反応がある | 構図成立に加え気象条件を判断できること。宣伝スレッドは選択バイアスが強く、利用者の独立した長期評価ではない |

レビュー出典：
- [PhotoPills App Storeレビュー（米国）](https://apps.apple.com/us/app/photopills/id596026805?platform=ipad&see-all=reviews)
- [PlanIt Pro App Storeレビュー（米国）](https://apps.apple.com/us/app/planit-pro-photo-planner/id898876435?platform=iphone&see-all=reviews)
- [PlanIt Pro Google Play](https://play.google.com/store/apps/details?hl=en&id=com.yingwen.photographertoolspro)
- [PeakFinder Google Play](https://play.google.com/store/apps/details/PeakFinder?id=org.peakfinder.area.alps)
- [PeakFinder App Storeレビュー（日本）](https://apps.apple.com/jp/app/peakfinder/id357421934?platform=iphone&see-all=reviews)
- [Reddit: ロケハン方法とPlanIt比較（2022）](https://www.reddit.com/r/photography/comments/y14o60)
- [Reddit: PhotoPillsで天の川の位置が読み取れない（2022）](https://www.reddit.com/r/AskAstrophotography/comments/tqb3p2)
- [Reddit: PC/モバイルの撮影計画ツール（2025）](https://www.reddit.com/r/AmateurPhotography/comments/1mh80yb)
- [Reddit: Inverza開発者による紹介とコメント（2026）](https://www.reddit.com/r/iosapps/comments/1t562ic/ios_inverza_weather_intelligence_for_landscape/)

## 10. 価格・収益化の示唆

2026-11-26に取得した公開情報。地域・プラットフォーム・更新時期で変わる。為替換算や推定価格は記載しない。

| 製品 | 確認価格・課金形態 |
|---|---|
| PeakFinder | 日本iOS ¥1,000。継続料金なし |
| PhotoPills | 日本iOS ¥1,800（ストア掲載購入額） |
| PlanIt Pro | 日本iOS ¥1,500＋アプリ内購入。追加機能の個別金額未確認 |
| PlanIt Earth | 無料部分＋PlanIt+ 年額／買い切り。公式ガイドにアクセスレベルが記載されるが、現行日本価格未確認 |
| TPE Web | Free / Supporter / PRO / MAX。公式ヘルプによると価格はログイン後のアプリ内で表示。地域・税等に依存し、金額未確認 |
| Inverza | 日本iOS無料ダウンロード＋アプリ内購入。2026-09-06発効の公式プライバシー文書はUSD 4.99/年と記載。日本実売額・現行試用期間未確認 |

価格出典：[PeakFinder日本ストア](https://apps.apple.com/jp/app/peakfinder/id357421934) / [PhotoPills日本ストア](https://apps.apple.com/jp/app/photopills/id596026805) / [PlanIt Pro日本ストア](https://apps.apple.com/jp/app/planit-pro-photo-planner/id898876435) / [PlanIt Earth利用規約](https://www.planitphoto.com/terms_earth.html) / [TPE公式料金案内](https://photoephemeris.com/en/help/tpe-web/choosing-and-purchasing-a-tpe-web-subscription/) / [Inverza日本ストア](https://apps.apple.com/jp/app/inverza-photo-weather/id6760370838) / [Inverzaプライバシー文書](https://www.inverza.app/privacy)

初期案：基本の風景表示と直接操作は登録・支払前に体験可能とすることを検討。高度な逆算、広域・長期探索、継続費用を伴う気象予測等を有料候補として分離する。無料枠、買い切り、継続課金の最適解は利用頻度、データ利用条件、運用原価、支払意欲の検証後に決める。価格はまだ決定しない。

## 11. 調査結果から製品設計への反映

合意済み方針は製品構想へ反映：現在の2D風景を直接操作する体験、内部3D表現との分離、山名・標高・稜線輪郭のオプション表示。60fps目標・スマホ対応を保持する。

設計候補：地図・2D風景・動画編集風マルチトラックタイムラインを同期。イベントは点、継続現象は帯、不確実性を伴う予測は濃淡等と根拠、気温・風・潮位等はグラフ。必要なトラックだけを表示する。基本風景の登録不要・無料体験は収益化検討項目。タイムライン詳細、山名データ源、課金方式は未決定。

競合調査の区切り：公開情報と限定試用に基づく設計上の知見は整理済み。市場規模、定量性能、逆算精度、有料画面、Inverzaの予報精度は未検証。競合調査を設計着手の障害とせず、技術設計・検証の段階で必要に応じ比較を継続する。プログラムの実装再開は行わない。
