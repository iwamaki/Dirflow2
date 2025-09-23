# 依存関係分析レポート

## 🔍 現在の依存関係マッピング

### モジュール間依存関係

```
src/core/app.js (エントリーポイント)
├── src/core/state.js
├── src/core/config.js
├── src/api/client.js
├── src/ui/navigation.js
├── src/file-system/file-manager.js
├── src/api/message-processor.js
└── src/events/event-handlers.js

src/core/state.js
├── src/prompts/prompt-manager.js ⚠️ 後方互換性エクスポート
└── [遅延読み込み] window.SystemPromptManager ❌

src/core/config.js
├── src/storage/storage-adapter.js
└── [DOM要素への直接参照] ✅ 問題なし

src/api/client.js
└── src/core/state.js

src/ui/navigation.js
└── [依存なし] ✅

src/file-system/file-manager.js
├── src/core/config.js
├── src/core/state.js
├── src/utils/helpers.js
├── src/file-system/file-editor.js
└── src/ui/navigation.js

src/api/message-processor.js
├── src/core/config.js
├── src/core/state.js ⚠️ SystemPromptManager含む
├── src/utils/markdown.js
├── src/api/client.js
├── src/file-system/file-manager.js ⚠️ 相互依存
└── src/file-system/file-editor.js

src/events/event-handlers.js
├── src/core/config.js
├── src/core/state.js ⚠️ SystemPromptManager含む
├── src/utils/helpers.js
├── src/ui/navigation.js
├── src/ui/modals.js
├── src/file-system/file-editor.js
├── src/file-system/file-manager.js ⚠️ 相互依存
├── src/api/message-processor.js ⚠️ 相互依存
├── src/prompts/prompt-ui.js
└── [グローバル参照] window.FileViewController ❌
└── [グローバル参照] window.EventHandlers ❌
└── [グローバル参照] window.MessageProcessor ❌
```

## 🚨 問題の詳細分析

### 1. 循環依存パターン

#### Pattern A: MessageProcessor ↔ FileManagerController
```
api/message-processor.js
├── imports: file-system/file-manager.js
└── calls: FileManagerController.loadFileList()

file-system/file-manager.js
├── potentially calls: MessageProcessor.addMessage()
└── via window.MessageProcessor (lines 183, 403, 421)
```

#### Pattern B: EventHandlers → Multiple → EventHandlers
```
events/event-handlers.js
├── imports: api/message-processor.js
├── imports: file-system/file-manager.js
└── called by: UI event listeners

api/message-processor.js
└── calls: FileManagerController.loadFileList()

file-system/file-manager.js
└── references: window.EventHandlers.currentEditingContent
```

### 2. グローバル変数問題

#### 未定義グローバル参照
```javascript
// src/events/event-handlers.js:102
if (AppState.isFileViewMode) FileViewController.setFileViewMode(false);
//                          ^^^^^^^^^^^^^^^^ 未定義

// src/events/event-handlers.js:171
if (window.EventHandlers) {
    window.EventHandlers.currentEditingContent = null;
}
//  ^^^^^^^^^^^^^^^^^^^^ 自己参照の異常パターン

// src/file-system/file-manager.js:183, 403, 421
if (window.MessageProcessor) {
    window.MessageProcessor.addMessage(...)
}
//  ^^^^^^^^^^^^^^^^^^^^^^ グローバル依存
```

#### 遅延読み込みによるグローバル汚染
```javascript
// src/core/state.js:140-147
setTimeout(() => {
    if (window.SystemPromptManager || typeof SystemPromptManager !== 'undefined') {
        const SystemPrompt = window.SystemPromptManager || SystemPromptManager;
        // グローバル空間への依存
    }
}, 100);
```

## 📊 依存性の重大度評価

### 🔴 緊急 (Critical)
1. **未定義参照エラー**
   - `FileViewController` (events/event-handlers.js:102)
   - 実行時にエラーを引き起こす可能性

### 🟡 高優先度 (High)
2. **循環依存リスク**
   - MessageProcessor ↔ FileManagerController
   - EventHandlers → MessageProcessor → FileManagerController

3. **グローバル変数濫用**
   - window.MessageProcessor の使用
   - window.EventHandlers の自己参照

### 🟢 中優先度 (Medium)
4. **設計上の問題**
   - SystemPromptManagerの遅延読み込み
   - 後方互換性のためのエクスポート

## 🎯 解決すべき依存関係

### 1. 即座に解決が必要
```
events/event-handlers.js:102
└── FileViewController.setFileViewMode(false)
    ❌ 未定義 → FileEditor.setFileViewMode()に変更
```

### 2. アーキテクチャ変更が必要
```
api/message-processor.js → file-system/file-manager.js
file-system/file-manager.js → window.MessageProcessor
events/event-handlers.js → api/message-processor.js
```

### 3. グローバル変数除去対象
```
- window.MessageProcessor
- window.EventHandlers
- window.SystemPromptManager
- 未定義のFileViewController
```

## 🔧 推奨される解決順序

### ステップ1: 未定義参照の修正
- `FileViewController` → `FileEditor`に変更
- 即座に実装可能、リスクなし

### ステップ2: グローバル参照の依存性注入化
- `window.MessageProcessor` → DIコンテナ経由
- `window.EventHandlers` → イベントバス経由

### ステップ3: 循環依存の解消
- MessageProcessor ↔ FileManagerController
- イベントベースアーキテクチャに変更

### ステップ4: 遅延読み込みの正規化
- SystemPromptManagerの適切な依存性管理
- 後方互換性を保ちつつモダン化

## 📋 チェックリスト

### 分析完了項目
- [x] 全モジュールの import/export 関係の調査
- [x] グローバル変数使用箇所の特定
- [x] 循環依存パターンの識別
- [x] 重大度の評価

### 次のアクション
- [ ] 依存性注入コンテナの設計
- [ ] イベントバスシステムの設計
- [ ] 段階的実装計画の詳細化
- [ ] テスト戦略の策定

---

**作成日**: 2025-09-23
**分析者**: Claude Code
**次回更新**: 実装開始時