# RidgeArc — 競合調査（一次調査）
調査日：2026-11-26  
位置づけ：公開資料の比較。実機試験・市場規模・価格の地域別実査は未実施。  
基準：[製品構想・目的定義](product-vision.md)

## 1. 結論

2026年の競合は既に地形、太陽・月、撮影日時の探索、3Dプレビュー、天候の統合に進んでいる。RidgeArcは機能数や逆算機能の存在だけで差別化できるとは考えない。
最重要比較先は TPE Web v4、PlanIt Earth、Inverza。操作の簡潔さはPeakFinderも比較先とする。

## 2. 主要競合

| 製品 | 確認できた機能 | 課金・対応環境（公開資料） |
|---|---|---|
| TPE Web | 地形・天体、日時検索、可視領域・地平線、被写体基準の撮影地点逆算、気象、3D | Web無料＋Supporter/PRO/MAX、別途iOS製品 |
| PlanIt Earth | 地形VR、太陽・月・星空、日時・地点のアライメント、気象、光害、潮汐、オフライン地域 | 無料部分＋年額・買い切りPlanIt+、PC/モバイル/Web |
| Inverza | 地形の地平線と天体軌跡、3Dと地形影、朝夕焼け・霧・雲海・水鏡等16条件、日時アライメント | iOS、7日試用後の年額方式。公式プライバシー文書は$4.99/年と記載、現行の地域別実売額未確認 |
| PhotoPills | 太陽・月・天の川、固定地点の日時探索、地図とAR、撮影計算 | iOS/Android、価格未確認 |
| PeakFinder | 360°の山岳線画パノラマ、太陽・月、世界の山名、300km描画範囲（ストアの説明）、オフライン | iOS/Android、継続課金なしと説明 |
| Sun Surveyor | 太陽・月・天の川の位置検索、地図・AR、地形の遮蔽物プレビュー | iOS/Android、価格未確認 |
| PlanIt Pro | 旧来の統合撮影計画、地形ビューファインダー、天体・潮位探索 | iOS/Android |
| LightChance / SkyCandy | 朝夕焼けなどの気象条件予測 | 個別の機能・価格は追加調査 |

## 3. 主要目的G1〜G5に対する評価

- G1（地形による出現・遮蔽）：InverzaのHorizon Pathsで実際の地形と天体軌跡を重ねる機能を確認。太陽円盤の接触時刻・再出現をすべて自動一覧化できるかは未確認。TPEの地平線と可視領域にも関連機能がある。
- G2（稜線と軌跡）：PeakFinder、Inverza、PlanIt Earth、TPEなどが対応。RidgeArcの距離別のシンプルな2D表現は操作性・見た目を比較する。
- G3（固定観測地点から日時）：PhotoPills、Sun Surveyor、TPE、PlanIt Earth、Inverzaなどが対応。既に一般化した機能。
- G4（山間地で水平線・地平線まで日没を見られる場所）：TPEは指定時刻の天体が地形より上に見える地点を地図で表示できる。探索地域を指定して真の地平線まで遮られない地点と日時を自動探索するという厳密な条件をそのまま満たすかは未確認。差別化候補として実査する。
- G5（被写体から日時・撮影地点）：TPE WebのShot Alignmentは被写体、天体、時刻窓、角度許容差、カメラ高、最大距離に基づく地図上のヒートマップを提供。被写体への視線遮蔽を考慮し、候補選択で時刻と地点が連動する。公式解説にはダイヤモンド富士の例もある。PlanIt Earthも地点と日時のアライメント探索を掲げる。複数日を一括して候補曲線・帯として比較する能力、太陽までの遮蔽、地形精度は別途検証する。

## 4. 差別化仮説（未検証）

1. 日本の1m・5m DEM等を適切に活用し、急斜面・近景・稜線の複雑な遮蔽を扱う。高解像度の入力を使うだけで競合より正確になるとは限らず、実写・独立計算で比較する。
2. 地図上のピンドラッグから風景が連続的に変化し、日付・時刻を変えても構図が維持される体験。60fps目標は競合と同じ実機で測定する。
3. G4の条件を直接指定できる探索と、G5の長期間の候補曲線・帯、日時、遮蔽と不確実性を一体表示する仕組み。
4. 写実性や機能数ではなく、現在の2Dの視認性、操作の少なさ、撮影したくなる体験を優先する。
5. 遮蔽・日照・気象に関する根拠と不確実性をわかりやすく表示する。Inverzaも予測理由・信頼度を提供するため、独自性は検証が必要。

## 5. 次の実機比較

まず無料で利用できるPC/Web機能を試す。TPE WebとPlanIt Earthを優先し、AndroidでPeakFinderやPlanIt Earthも比較。InverzaはiOS実機が利用可能な場合に試す。
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

本資料は一次調査。公開資料に記述が見つからない機能を「存在しない」とは判断しない。実装再開や製品範囲の決定は行わない。
