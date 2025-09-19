/* =========================================
    設定とグローバルデータ (IndexedDB完全移行版)
   ========================================= */

/*
## 概要
アプリケーション全体で使用される設定、IndexedDBストレージ管理、およびDOM要素への参照を一元的に管理するモジュール。

## 責任
- アプリケーション設定の定義
- IndexedDBストレージの管理
- 主要なDOM要素への参照提供
- 初期データの作成管理
*/

import { storageAdapter } from '../storage/storage-adapter.js';

// IndexedDB専用設定
export const STORAGE_CONFIG = {
    useIndexedDB: true,
    fallbackToMemory: false,  // フォールバック無効化
    migrationEnabled: false,   // mockFileSystem移行無効化
    createInitialData: true    // 初期データ作成有効化
};

// 初期データ定義（初回起動時にIndexedDB内に作成）
export const INITIAL_DATA = {
    '/workspace/README.md': `# AIファイルマネージャー - IndexedDB版

## 新機能
* Claude API統合
* 会話履歴管理
* ファイルコピー・移動
* ディレクトリ作成
* 一括操作
* 複数選択
* JSON形式レスポンス対応
* セキュリティ強化
* **IndexedDB完全移行（永続化強化）**

## データ永続化
このアプリケーションはIndexedDBを使用してデータを永続化します：
- ブラウザを閉じてもデータが保持されます
- 大容量ファイルの保存が可能です
- 高速な検索・操作が可能です

## 使い方

### 基本コマンド
* **ファイル作成**: "新しいファイルを作って"、"sample.txt を作成して"
* **ディレクトリ作成**: "docs フォルダを作って"、"新しいフォルダを作成"
* **ファイル読み込み**: "README.md を読んで"、"ファイルの内容を表示して"
* **ファイル編集**: "README.md を編集して"、"内容を変更して"
* **ファイルコピー**: "ファイルをコピーして"、"backup フォルダにコピー"
* **ファイル移動**: "ファイルを移動して"、"別のフォルダに移動"
* **ファイル削除**: "sample.txt を削除して"、"不要なファイルを消して"
* **ファイル一覧**: "ファイル一覧を表示して"、"何があるか教えて"

### 一括操作
* **一括削除**: "全ての .txt ファイルを削除して"
* **一括コピー**: "画像ファイル全部を images フォルダにコピー"
* **一括移動**: "古いファイルを全部 archive に移動"

### 自然な会話例
* "プロジェクト用の docs フォルダを作って、README.md も作成して"
* "設定ファイルconfig.jsonを作って、デフォルト値を入れて"
* "このディレクトリにあるファイルを教えて"
* "画像ファイルを全部 images フォルダに整理して"

**help** と入力すると詳細なコマンド一覧を確認できます。`,

    '/workspace/docs/guide.md': `# ユーザーガイド

AI File Manager の使い方について説明します。

## データ永続化について

このアプリケーションはIndexedDBを使用してデータを永続化します：

- ブラウザを閉じてもデータが保持されます
- 大容量ファイルの保存が可能です
- 高速な検索・操作が可能です
- ブラウザのローカルストレージより高機能です

## トラブルシューティング

### データが消えた場合
1. ブラウザの開発者ツールでIndexedDBを確認
2. プライベートモードでないことを確認
3. ブラウザのストレージクリアを実行していないか確認

### 動作が重い場合
1. 不要なファイルを削除
2. ブラウザのキャッシュをクリア
3. 他のタブを閉じる

## バックアップとエクスポート
設定画面からデータのエクスポート・インポートが可能です。`,

    '/workspace/examples/sample.txt': `これはサンプルテキストファイルです。

IndexedDBによる永続化テストのために作成されました。

編集して保存してみてください！`
};

// ストレージマネージャークラス（IndexedDB専用）
export class StorageManager {
    constructor() {
        this.storageAdapter = storageAdapter;
        this.initialized = false;
    }

    /**
     * ストレージの初期化（IndexedDB専用）
     */
    async initialize() {
        if (this.initialized) {
            return 'indexeddb';
        }

        try {
            await this.storageAdapter.initialize();
            
            // 初期データの作成チェック
            if (STORAGE_CONFIG.createInitialData) {
                await this.createInitialDataIfNeeded();
            }

            this.initialized = true;
            console.log('✅ IndexedDB Storage initialized successfully');
            return 'indexeddb';

        } catch (error) {
            console.error('❌ IndexedDB initialization failed:', error);
            throw new Error(`ストレージの初期化に失敗しました: ${error.message}`);
        }
    }

    /**
     * 初期データの作成（必要な場合のみ）
     */
    async createInitialDataIfNeeded() {
        try {
            const stats = await this.storageAdapter.getStorageStats();
            
            // IndexedDBが空の場合のみ初期データを作成
            if (stats.totalFiles === 0) {
                console.log('🔧 Creating initial data in IndexedDB...');
                
                // 初期ディレクトリ作成
                await this.storageAdapter.createDirectory('/workspace');
                await this.storageAdapter.createDirectory('/workspace/docs');
                await this.storageAdapter.createDirectory('/workspace/examples');
                
                // 初期ファイル作成
                for (const [path, content] of Object.entries(INITIAL_DATA)) {
                    await this.storageAdapter.createFile(path, content);
                }
                
                console.log('✅ Initial data created successfully');
            } else {
                console.log('📂 Existing data found, skipping initial data creation');
            }
        } catch (error) {
            console.warn('⚠️ Initial data creation failed:', error);
            // 初期データ作成の失敗は致命的ではないため継続
        }
    }

    /**
     * ストレージアダプターの取得
     */
    getAdapter() {
        return this.storageAdapter;
    }

    /**
     * ストレージモードの取得
     */
    getStorageMode() {
        return 'indexeddb';
    }

    /**
     * 初期化確認
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    /**
     * ファイルシステムデータの取得
     */
    async getFileSystemData() {
        await this.ensureInitialized();
        return await this.storageAdapter.exportToMockFileSystem();
    }

    /**
     * レガシー移行機能（既存ユーザー向け）
     */
    async checkAndMigrate() {
        // 既存ユーザーのデータ移行は data-migrator.js で処理
        return { success: true, migratedCount: 0 };
    }
}

// DOM要素への参照
export const elements = {
    // ヘッダー
    backBtn: document.getElementById('backBtn'),
    saveBtn: document.getElementById('saveBtn'),
    editBtn: document.getElementById('editBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    currentPath: document.getElementById('currentPath'),
    selectionInfo: document.getElementById('selectionInfo'),
    selectionCount: document.getElementById('selectionCount'),

    // メインコンテンツ
    fileListContainer: document.getElementById('fileListContainer'),
    fileList: document.getElementById('fileList'),
    fileView: document.getElementById('fileView'),
    fileContent: document.getElementById('fileContent'),

    // チャット・インタラクション
    chatContainer: document.getElementById('chatContainer'),
    actionContainer: document.getElementById('actionContainer'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    chatMessages: document.getElementById('chatMessages'),
    chatOverlay: document.getElementById('chatOverlay'),
    chatCloseBtn: document.getElementById('chatCloseBtn'),

    // ボタン類
    previewBtn: document.getElementById('previewBtn'),

    // FAB関連
    fabBtn: document.getElementById('fabBtn'),
    fabMenu: document.getElementById('fabMenu'),
    fabMenuOverlay: document.getElementById('fabMenuOverlay'),

    // モーダル
    settingsModal: document.getElementById('settingsModal'),
    createModal: document.getElementById('createModal'),
    renameModal: document.getElementById('renameModal'),
    importModal: document.getElementById('importModal'),
    systemPromptModal: document.getElementById('systemPromptModal'),

    // フォーム入力
    filePathInput: document.getElementById('filePathInput'),
    fileContentInput: document.getElementById('fileContentInput'),
    renameInput: document.getElementById('renameInput'),
    createFileBtn: document.getElementById('createFileBtn'),
    renameFileBtn: document.getElementById('renameFileBtn'),

    // インポート関連
    fileImportInput: document.getElementById('fileImportInput'),
    importPathInput: document.getElementById('importPathInput'),
    confirmImport: document.getElementById('confirmImport'),

    // システムプロンプト関連
    promptNameInput: document.getElementById('promptNameInput'),
    promptContentInput: document.getElementById('promptContentInput'),
    promptDescriptionInput: document.getElementById('promptDescriptionInput'),
    confirmSystemPrompt: document.getElementById('confirmSystemPrompt'),

    // システムプロンプト管理
    promptMenuBtn: document.getElementById('promptMenuBtn'),
    promptDrawer: document.getElementById('promptDrawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    drawerCloseBtn: document.getElementById('drawerCloseBtn'),
    createSection: document.getElementById('createSection'),
    manageSection: document.getElementById('manageSection'),
    workflowSection: document.getElementById('workflowSection'),
    currentPromptStatus: document.getElementById('currentPromptStatus'),
    promptList: document.getElementById('promptList'),

    // その他のUI
    loadingOverlay: document.getElementById('loadingOverlay'),
    promptOverlay: document.getElementById('promptOverlay')
};

// ストレージマネージャーのシングルトンインスタンス
export const storageManager = new StorageManager();
