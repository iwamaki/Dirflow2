# 実装ロードマップ - 循環依存・グローバル変数解消

## 🎯 総合目標
- グローバル変数使用箇所: **8箇所 → 0箇所**
- 循環依存: **3パターン → 0パターン**
- 実行時エラー: **1箇所(未定義参照) → 0箇所**
- 既存機能: **100%動作維持**

## 📅 実装スケジュール

### Week 1: 基盤構築 (3-4日)
```
Day 1-2: コアインフラ実装
Day 3: サービス定義
Day 4: テスト環境構築
```

### Week 2: 緊急修正 (2-3日)
```
Day 1: 未定義参照の修正
Day 2: 基本的なグローバル変数除去
Day 3: 動作確認とテスト
```

### Week 3: 段階的移行 (4-5日)
```
Day 1-2: MessageProcessor の移行
Day 3-4: FileManagerController の移行
Day 5: EventHandlers の移行
```

### Week 4: 最終調整 (2-3日)
```
Day 1: 統合テスト
Day 2: パフォーマンス最適化
Day 3: 文書化とクリーンアップ
```

## 🚀 Phase 1: 基盤構築 (Week 1)

### Day 1: コアインフラストラクチャ

#### ✅ Checkpoint 1.1: DIContainer実装
```bash
# 作成ファイル
src/core/di-container.js
tests/core/di-container.test.js

# 完了条件
- [ ] サービス登録機能
- [ ] 依存性解決機能
- [ ] シングルトン管理
- [ ] エラーハンドリング
- [ ] 基本テスト通過
```

#### ✅ Checkpoint 1.2: EventBus実装
```bash
# 作成ファイル
src/core/event-bus.js
tests/core/event-bus.test.js

# 完了条件
- [ ] イベント登録/削除
- [ ] イベント発火
- [ ] エラーハンドリング
- [ ] パフォーマンステスト
```

### Day 2: サービスロケーター

#### ✅ Checkpoint 1.3: ServiceLocator実装
```bash
# 作成ファイル
src/core/service-locator.js
src/core/bootstrap.js
tests/core/service-locator.test.js

# 完了条件
- [ ] サービスロケーター動作
- [ ] Bootstrap機能
- [ ] 初期化テスト
- [ ] 統合テスト準備
```

### Day 3: サービス定義

#### ✅ Checkpoint 1.4: 基本サービス実装
```bash
# 作成ファイル
src/services/message-service.js
src/services/file-service.js
src/services/ui-service.js
tests/services/*.test.js

# 完了条件
- [ ] MessageService動作
- [ ] FileService基本機能
- [ ] UIService基本機能
- [ ] サービス間通信テスト
```

### Day 4: テスト環境

#### ✅ Checkpoint 1.5: テスト基盤
```bash
# 作成ファイル
tests/mocks/mock-services.js
tests/integration/basic-flow.test.js

# 完了条件
- [ ] モックサービス完備
- [ ] 統合テスト環境
- [ ] CIパイプライン準備
```

## ⚡ Phase 2: 緊急修正 (Week 2)

### Day 1: 未定義参照修正

#### 🚨 Checkpoint 2.1: Critical Fix
```bash
# 修正対象
src/events/event-handlers.js:102
- FileViewController.setFileViewMode(false)
+ FileEditor.setFileViewMode(false)

# 完了条件
- [ ] 実行時エラー解消
- [ ] 動作確認
- [ ] 回帰テスト通過
```

### Day 2: 基本的なグローバル変数除去

#### ✅ Checkpoint 2.2: Basic Global Removal
```bash
# 修正対象ファイル
src/file-system/file-manager.js
- window.MessageProcessor
+ serviceLocator.getService('messageService')

# 完了条件
- [ ] window.MessageProcessor除去
- [ ] 代替実装動作確認
- [ ] 全機能テスト通過
```

### Day 3: 初期統合テスト

#### ✅ Checkpoint 2.3: Integration Test
```bash
# テスト対象
- ファイル作成/削除/編集
- UI更新
- エラーハンドリング

# 完了条件
- [ ] 主要機能100%動作
- [ ] エラー発生なし
- [ ] パフォーマンス劣化なし
```

## 🔄 Phase 3: 段階的移行 (Week 3)

### Day 1-2: MessageProcessor移行

#### ✅ Checkpoint 3.1: MessageProcessor Refactor
```bash
# 修正ファイル
src/api/message-processor.js

# 変更内容
- 直接的なFileManagerController呼び出し除去
- イベントベース通信への変更
- グローバル参照除去

# 完了条件
- [ ] 循環依存解消
- [ ] イベント通信実装
- [ ] 既存API互換性維持
```

### Day 3-4: FileManagerController移行

#### ✅ Checkpoint 3.2: FileManager Refactor
```bash
# 修正ファイル
src/file-system/file-manager.js

# 変更内容
- MessageProcessor直接呼び出し除去
- イベントベース通信実装
- サービス注入パターン適用

# 完了条件
- [ ] 依存性注入実装
- [ ] イベント通信動作
- [ ] ファイル操作機能維持
```

### Day 5: EventHandlers移行

#### ✅ Checkpoint 3.3: EventHandlers Refactor
```bash
# 修正ファイル
src/events/event-handlers.js

# 変更内容
- 全グローバル参照除去
- サービス経由でのアクセス実装
- イベントハンドリング最適化

# 完了条件
- [ ] グローバル参照ゼロ
- [ ] UI操作100%動作
- [ ] イベント処理最適化
```

## 🏁 Phase 4: 最終調整 (Week 4)

### Day 1: 統合テスト

#### ✅ Checkpoint 4.1: Full Integration Test
```bash
# テスト項目
- 全UI操作のテスト
- ファイルシステム操作
- エラーケースの確認
- ブラウザ互換性テスト

# 完了条件
- [ ] 全機能動作確認
- [ ] エラーケース対応
- [ ] パフォーマンス基準達成
```

### Day 2: パフォーマンス最適化

#### ✅ Checkpoint 4.2: Performance Optimization
```bash
# 最適化項目
- イベントバスのパフォーマンス
- メモリ使用量の監視
- 初期化時間の短縮

# 完了条件
- [ ] レスポンス時間改善
- [ ] メモリリーク解消
- [ ] 初期化高速化
```

### Day 3: 文書化とクリーンアップ

#### ✅ Checkpoint 4.3: Documentation & Cleanup
```bash
# 文書化項目
- 新しいアーキテクチャ文書
- 移行ガイド
- トラブルシューティング

# 完了条件
- [ ] 技術文書完備
- [ ] 不要コード除去
- [ ] コメント更新
```

## 📊 進捗追跡

### KPI指標

| 指標 | 現在 | 目標 | Week1 | Week2 | Week3 | Week4 |
|------|------|------|--------|--------|--------|--------|
| グローバル変数 | 8 | 0 | 8 | 4 | 1 | 0 |
| 循環依存 | 3 | 0 | 3 | 3 | 1 | 0 |
| 未定義参照 | 1 | 0 | 1 | 0 | 0 | 0 |
| テストカバレッジ | 0% | 80% | 20% | 40% | 70% | 80% |

### 毎日のチェックリスト
```bash
# 朝の確認事項
- [ ] 前日の実装が動作するか
- [ ] 新たなエラーが発生していないか
- [ ] パフォーマンスに劣化がないか

# 夕方の確認事項
- [ ] 当日の目標達成したか
- [ ] 問題点と解決策を記録
- [ ] 翌日の計画を調整
```

## 🚨 リスク管理

### High Risk Issues
1. **破綻的変更によるアプリ停止**
   - **対策**: 段階的実装、頻繁なテスト
   - **回復**: バックアップブランチからのロールバック

2. **パフォーマンス劣化**
   - **対策**: ベンチマークテストの実施
   - **回復**: イベントバス最適化、必要に応じて直接呼び出し復活

3. **新しいバグの混入**
   - **対策**: 各フェーズでの動作確認
   - **回復**: 自動テストによる早期発見

### Medium Risk Issues
1. **開発期間の延長**
   - **対策**: 優先順位の明確化
   - **回復**: 必要最小限の機能に絞る

2. **テストの不備**
   - **対策**: テストファースト開発
   - **回復**: 手動テストによる補完

## 🎉 成功基準

### ✅ Must Have
- [ ] グローバル変数使用箇所: 0箇所
- [ ] 実行時エラー: 0件
- [ ] 既存機能: 100%動作

### ✅ Should Have
- [ ] 循環依存: 0件
- [ ] テストカバレッジ: 80%以上
- [ ] パフォーマンス劣化: なし

### ✅ Nice to Have
- [ ] 新機能追加の容易性向上
- [ ] デバッグ効率の改善
- [ ] 保守性の向上

---

**作成日**: 2025-09-23
**更新頻度**: 毎日
**次のアクション**: Phase 1 Day 1の実装開始