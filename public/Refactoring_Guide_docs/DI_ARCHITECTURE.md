# 依存性注入アーキテクチャ設計

## 🏗️ 新しいアーキテクチャ概要

### 設計原則
1. **単一責任原則**: 各サービスは明確に定義された責任を持つ
2. **依存性逆転**: 高レベルモジュールは低レベルモジュールに依存しない
3. **疎結合**: コンポーネント間の直接的な依存を最小化
4. **テスタビリティ**: 依存性の注入により単体テストが容易

## 🔧 コアコンポーネント設計

### 1. DIコンテナ (Dependency Injection Container)

```javascript
// src/core/di-container.js
export class DIContainer {
    constructor() {
        this.services = new Map();
        this.instances = new Map();
        this.factories = new Map();
    }

    // サービス登録
    register(name, factory, options = {}) {
        this.services.set(name, {
            factory,
            singleton: options.singleton || false,
            dependencies: options.dependencies || []
        });
    }

    // サービス取得（依存性解決付き）
    get(name) {
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not found`);
        }

        // 依存性解決
        const dependencies = service.dependencies.map(dep => this.get(dep));
        const instance = service.factory(...dependencies);

        if (service.singleton) {
            this.instances.set(name, instance);
        }

        return instance;
    }

    // サービス存在確認
    has(name) {
        return this.services.has(name);
    }

    // インスタンスクリア（テスト用）
    clear() {
        this.instances.clear();
    }
}
```

### 2. イベントバス (Event Bus)

```javascript
// src/core/event-bus.js
export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
    }

    // イベントリスナー登録
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    // 一回限りのリスナー登録
    once(event, callback) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        this.onceListeners.get(event).add(callback);
    }

    // イベント発火
    emit(event, data) {
        // 通常のリスナー
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Event listener error for '${event}':`, error);
                }
            });
        }

        // 一回限りのリスナー
        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Once event listener error for '${event}':`, error);
                }
            });
            this.onceListeners.delete(event);
        }
    }

    // リスナー削除
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    // 全リスナー削除
    removeAllListeners(event) {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
    }
}
```

### 3. サービスロケーター (Service Locator)

```javascript
// src/core/service-locator.js
import { DIContainer } from './di-container.js';
import { EventBus } from './event-bus.js';

class ServiceLocator {
    constructor() {
        this.container = new DIContainer();
        this.eventBus = new EventBus();
        this.initialized = false;
    }

    // 初期化
    initialize() {
        if (this.initialized) return;

        // コアサービスの登録
        this.registerCoreServices();
        this.initialized = true;
    }

    // コアサービス登録
    registerCoreServices() {
        // イベントバス
        this.container.register('eventBus', () => this.eventBus, { singleton: true });

        // 設定管理
        this.container.register('configManager',
            (eventBus) => new ConfigManager(eventBus),
            { singleton: true, dependencies: ['eventBus'] }
        );

        // ストレージ管理
        this.container.register('storageManager',
            (eventBus) => new StorageManager(eventBus),
            { singleton: true, dependencies: ['eventBus'] }
        );

        // メッセージサービス
        this.container.register('messageService',
            (eventBus) => new MessageService(eventBus),
            { singleton: true, dependencies: ['eventBus'] }
        );
    }

    // サービス取得
    getService(name) {
        return this.container.get(name);
    }

    // イベントバス取得
    getEventBus() {
        return this.eventBus;
    }

    // 追加サービス登録
    registerService(name, factory, options) {
        this.container.register(name, factory, options);
    }
}

// シングルトンインスタンス
export const serviceLocator = new ServiceLocator();
```

## 📦 サービス定義

### 1. メッセージサービス

```javascript
// src/services/message-service.js
export class MessageService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('ui:message:add', (data) => {
            this.addMessage(data.type, data.content);
        });
    }

    addMessage(type, content) {
        // メッセージ表示ロジック
        this.eventBus.emit('message:added', { type, content });
    }

    setLoading(loading) {
        this.eventBus.emit('ui:loading:set', { loading });
    }
}
```

### 2. ファイルサービス

```javascript
// src/services/file-service.js
export class FileService {
    constructor(eventBus, storageManager) {
        this.eventBus = eventBus;
        this.storageManager = storageManager;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('file:create', (data) => this.createFile(data));
        this.eventBus.on('file:delete', (data) => this.deleteFile(data));
        this.eventBus.on('file:read', (data) => this.readFile(data));
    }

    async createFile(data) {
        try {
            const result = await this.storageManager.getAdapter().createFile(data.path, data.content);
            this.eventBus.emit('file:created', { path: data.path, success: true });
            this.eventBus.emit('ui:message:add', {
                type: 'system',
                content: `✅ ファイル "${data.path}" を作成しました`
            });
        } catch (error) {
            this.eventBus.emit('file:created', { path: data.path, success: false, error });
            this.eventBus.emit('ui:message:add', {
                type: 'system',
                content: `❌ ファイル作成に失敗: ${error.message}`
            });
        }
    }

    async deleteFile(data) {
        // 削除処理
    }

    async readFile(data) {
        // 読み込み処理
    }
}
```

## 🔄 マイグレーション戦略

### Phase 1: コアインフラの構築
```javascript
// src/core/bootstrap.js
import { serviceLocator } from './service-locator.js';
import { MessageService } from '../services/message-service.js';
import { FileService } from '../services/file-service.js';

export async function bootstrap() {
    // サービスロケーター初期化
    serviceLocator.initialize();

    // 追加サービス登録
    serviceLocator.registerService('messageService',
        (eventBus) => new MessageService(eventBus),
        { singleton: true, dependencies: ['eventBus'] }
    );

    serviceLocator.registerService('fileService',
        (eventBus, storageManager) => new FileService(eventBus, storageManager),
        { singleton: true, dependencies: ['eventBus', 'storageManager'] }
    );

    // グローバル参照を段階的に除去
    if (typeof window !== 'undefined') {
        window.serviceLocator = serviceLocator; // 移行期間のみ
    }
}
```

### Phase 2: 既存コードの段階的移行

#### Before (現在)
```javascript
// src/api/message-processor.js
if (window.MessageProcessor) {
    window.MessageProcessor.addMessage('system', message);
}
```

#### After (移行後)
```javascript
// src/api/message-processor.js
import { serviceLocator } from '../core/service-locator.js';

const eventBus = serviceLocator.getEventBus();
eventBus.emit('ui:message:add', { type: 'system', content: message });
```

## 🧪 テスト戦略

### 単体テスト用のモックサービス

```javascript
// tests/mocks/mock-services.js
export class MockMessageService {
    constructor() {
        this.messages = [];
    }

    addMessage(type, content) {
        this.messages.push({ type, content });
    }

    getMessages() {
        return this.messages;
    }
}

// テストでの使用例
describe('FileService', () => {
    let fileService;
    let mockEventBus;
    let mockStorageManager;

    beforeEach(() => {
        mockEventBus = new MockEventBus();
        mockStorageManager = new MockStorageManager();
        fileService = new FileService(mockEventBus, mockStorageManager);
    });

    it('should create file and emit events', async () => {
        await fileService.createFile({ path: '/test.txt', content: 'test' });
        expect(mockEventBus.emittedEvents).toContain('file:created');
    });
});
```

## 📊 実装チェックリスト

### フェーズ1: インフラ構築
- [ ] DIContainer実装
- [ ] EventBus実装
- [ ] ServiceLocator実装
- [ ] Bootstrap機能実装

### フェーズ2: サービス定義
- [ ] MessageService実装
- [ ] FileService実装
- [ ] UIService実装
- [ ] ConfigService実装

### フェーズ3: 移行準備
- [ ] 移行ヘルパー関数作成
- [ ] 既存コードのマッピング
- [ ] テストスイート準備

### フェーズ4: 段階的移行
- [ ] グローバル変数の段階的除去
- [ ] イベントベース通信への変更
- [ ] 循環依存の解消

## ⚠️ 移行時の注意点

1. **後方互換性**: 移行期間中は既存のAPIを維持
2. **パフォーマンス**: イベントバスのオーバーヘッドを監視
3. **デバッグ**: イベントフローの可視化ツール必要
4. **テスト**: 各フェーズでの動作確認を徹底

---

**設計日**: 2025-09-23
**ステータス**: 設計完了
**次のステップ**: 実装ロードマップの詳細化