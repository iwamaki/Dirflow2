# 循環依存・グローバル変数 リファクタリング計画

## 📊 現状分析

### 問題箇所の特定

#### 1. グローバル変数の濫用
- **場所**: `src/core/state.js:125-147`
- **問題**: SystemPromptManagerの遅延読み込みでグローバル参照を使用
- **影響**: メモリリーク、テスタビリティの低下、競合状態のリスク

#### 2. 未定義グローバル参照
- **場所**: `src/events/event-handlers.js:102` - `window.FileViewController`
- **場所**: `src/events/event-handlers.js:171` - `window.EventHandlers`
- **場所**: `src/events/event-handlers.js:183` - `window.MessageProcessor`
- **問題**: 存在しないオブジェクトへの参照、実行時エラーの原因

#### 3. 循環依存の可能性
- **MessageProcessor** ↔ **FileManagerController** ↔ **EventHandlers**
- **AppState** ↔ **SystemPromptManager**

### 依存関係マップ

```
core/app.js
├── core/state.js ⚠️
├── core/config.js
├── api/client.js
├── ui/navigation.js
├── file-system/file-manager.js ⚠️
├── api/message-processor.js ⚠️
└── events/event-handlers.js ⚠️

⚠️ = 問題のあるモジュール
```

## 🎯 解決戦略

### フェーズ1: 依存性注入パターンの導入
- **目標**: グローバル変数を排除し、明示的な依存性注入を実装
- **期間**: 2-3日
- **リスク**: 低

### フェーズ2: イベントシステムの統一
- **目標**: 疎結合なイベントベースアーキテクチャに変更
- **期間**: 3-4日
- **リスク**: 中

### フェーズ3: サービスロケーターパターンの導入
- **目標**: 中央集権的な依存性管理
- **期間**: 2-3日
- **リスク**: 低

## 📋 実装ロードマップ

### ✅ Phase 1: 準備とアーキテクチャ設計
- [ ] **1.1** 現在の依存関係を詳細分析
- [ ] **1.2** 新しいアーキテクチャの設計
- [ ] **1.3** 依存性注入コンテナの実装
- [ ] **1.4** イベントバスの実装

### ⏳ Phase 2: グローバル変数の段階的除去
- [ ] **2.1** `src/core/state.js` のグローバル参照を依存性注入に変更
- [ ] **2.2** `src/events/event-handlers.js` の未定義参照を修正
- [ ] **2.3** `window` オブジェクトへの依存を除去
- [ ] **2.4** テストの実行と動作確認

### ⏳ Phase 3: 循環依存の解消
- [ ] **3.1** `MessageProcessor` ↔ `FileManagerController` の循環依存解消
- [ ] **3.2** `EventHandlers` の依存関係整理
- [ ] **3.3** `AppState` と `SystemPromptManager` の分離
- [ ] **3.4** 統合テストの実行

### ⏳ Phase 4: 検証と最適化
- [ ] **4.1** 新しいアーキテクチャでの動作テスト
- [ ] **4.2** パフォーマンステスト
- [ ] **4.3** メモリリークテスト
- [ ] **4.4** 文書化の更新

## 🏗️ 新しいアーキテクチャ設計

### 依存性注入コンテナ
```javascript
// src/core/container.js
export class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  register(name, factory, options = {}) {
    this.services.set(name, { factory, options });
  }

  get(name) {
    // シングルトン管理付きの依存性解決
  }
}
```

### イベントバス
```javascript
// src/core/event-bus.js
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  emit(event, data) {
    // イベント配信
  }

  on(event, callback) {
    // リスナー登録
  }
}
```

### サービスロケーター
```javascript
// src/core/service-locator.js
export class ServiceLocator {
  static container = new DIContainer();
  static eventBus = new EventBus();

  static getService(name) {
    return this.container.get(name);
  }
}
```

## 📈 進捗管理

### チェックポイント
- **CP1**: 依存性注入コンテナとイベントバスの実装完了
- **CP2**: グローバル変数50%除去完了
- **CP3**: 主要な循環依存解消完了
- **CP4**: 全機能の動作確認完了

### 成功指標
- [ ] グローバル変数使用箇所: 0箇所
- [ ] `window` オブジェクト参照: 0箇所（DOM要素除く）
- [ ] 循環依存: 0件
- [ ] 既存機能: 100%動作
- [ ] パフォーマンス劣化: なし

## ⚠️ リスク管理

### 高リスク項目
1. **既存機能の破綻**: 段階的リファクタリングで最小化
2. **パフォーマンス劣化**: ベンチマークテストで監視
3. **開発期間の延長**: 小さな単位での検証を徹底

### 緊急時対応
- バックアップブランチの作成
- 各フェーズでのロールバック準備
- 最小限の機能で動作確認

## 📝 実装メモ

### 作業ログ
- **2025-09-23**: リファクタリング計画作成
- 今後の進捗はここに追記

### 技術的な注意点
- ES Modulesの特性を活用した依存性解決
- 既存のIndexedDB機能への影響を最小限に
- TypeScript導入の準備も視野に入れる

---

**最終更新**: 2025-09-23
**ステータス**: 計画策定完了
**次のアクション**: Phase 1の詳細設計開始