/* =========================================
    設定とグローバルデータ
   ========================================= */

/*
## 概要
アプリケーション全体で使用される設定、ストレージ管理、およびDOM要素への参照を一元的に管理するモジュール。

## 責任
- アプリケーション設定の定義
- IndexedDBとメモリストレージの統合管理
- 主要なDOM要素への参照提供
- 既存データからIndexedDBへの移行処理
*/

import { storageAdapter } from '../storage/storage-adapter.js';

// IndexedDB対応の設定
export const STORAGE_CONFIG = {
    useIndexedDB: true,
    fallbackToMemory: true,
    migrationEnabled: true
};

// Legacy mockFileSystem（移行用・フォールバック用）
// ディレクトリ構造からフラットなファイルシステムに変換
export const mockFileSystem = {
    '/workspace/README.md': '# AIファイルマネージャー - 拡張版\n\n## 新機能\n* Claude API統合\n* 会話履歴管理\n* ファイルコピー・移動\n* ディレクトリ作成\n* 一括操作\n* 複数選択\n* JSON形式レスポンス対応\n* セキュリティ強化\n* IndexedDB永続化対応（新機能）\n\n## 使い方\n\n### 基本コマンド\n* **ファイル作成**: "新しいファイルを作って"、"sample.txt を作成して"\n* **ディレクトリ作成**: "docs フォルダを作って"、"新しいフォルダを作成"\n* **ファイル読み込み**: "README.md を読んで"、"ファイルの内容を表示して"\n* **ファイル編集**: "README.md を編集して"、"内容を変更して"\n* **ファイルコピー**: "ファイルをコピーして"、"backup フォルダにコピー"\n* **ファイル移動**: "ファイルを移動して"、"別のフォルダに移動"\n* **ファイル削除**: "sample.txt を削除して"、"不要なファイルを消して"\n* **ファイル一覧**: "ファイル一覧を表示して"、"何があるか教えて"\n\n### 一括操作\n* **一括削除**: "全ての .txt ファイルを削除して"\n* **一括コピー**: "画像ファイル全部を images フォルダにコピー"\n* **一括移動**: "古いファイルを全部 archive に移動"\n\n### 自然な会話例\n* "プロジェクト用の docs フォルダを作って、README.md も作成して"\n* "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\n* "このディレクトリにあるファイルを教えて"\n* "画像ファイルを全部 images フォルダに整理して"\n\n**help** と入力すると詳細なコマンド一覧を確認できます。',
    '/workspace/docs/guide.md': '# ユーザーガイド\n\nAI File Manager の使い方について説明します。\n\n## データ永続化について\n\nこのアプリケーションはIndexedDBを使用してデータを永続化します：\n\n- ブラウザを閉じてもデータが保持されます\n- 大容量ファイルの保存が可能です\n- 高速な検索・操作が可能です\n\n万が一IndexedDBが利用できない環境では、自動的にメモリストレージにフォールバックします。'
};

// ストレージマネージャークラス
export class StorageManager {
    constructor() {
        this.isIndexedDBEnabled = STORAGE_CONFIG.useIndexedDB;
        this.storageAdapter = storageAdapter;
        this.initialized = false;
        this.fallbackMode = false;
    }

    /**
     * ストレージの初期化
     */
    async initialize() {
        if (this.initialized) {
            return this.fallbackMode ? 'memory' : 'indexeddb';
        }

        try {
            if (this.isIndexedDBEnabled) {
                await this.storageAdapter.initialize();

                // データ移行チェック
                if (STORAGE_CONFIG.migrationEnabled) {
                    await this.checkAndMigrate();
                }

                this.initialized = true;
                console.log('✅ Storage initialized with IndexedDB');
                return 'indexeddb';
            }
        } catch (error) {
            console.warn('IndexedDB initialization failed, falling back to memory:', error);

            if (STORAGE_CONFIG.fallbackToMemory) {
                this.fallbackMode = true;
                this.initialized = true;
                console.log('⚠️ Storage initialized with memory fallback');
                return 'memory';
            } else {
                throw error;
            }
        }

        this.fallbackMode = true;
        this.initialized = true;
        return 'memory';
    }

    /**
     * データ移行チェックと実行
     */
    async checkAndMigrate() {
        try {
            const stats = await this.storageAdapter.getStorageStats();

            // IndexedDBが空で、mockFileSystemにデータがある場合は移行
            if (stats.totalFiles === 0 && Object.keys(mockFileSystem).length > 0) {
                console.log('🔄 No data found in IndexedDB, starting migration...');
                await this.storageAdapter.migrateFromMockFileSystem(mockFileSystem);
                console.log('✅ Migration completed successfully');
            }
        } catch (error) {
            console.warn('Migration check/execution failed:', error);
        }
    }

    /**
     * ファイルシステムデータの取得
     */
    async getFileSystemData() {
        await this.ensureInitialized();

        if (this.fallbackMode) {
            return mockFileSystem;
        } else {
            return await this.storageAdapter.exportToMockFileSystem();
        }
    }

    /**
     * ストレージモードの取得
     */
    getStorageMode() {
        return this.fallbackMode ? 'memory' : 'indexeddb';
    }

    /**
     * ストレージアダプターの取得
     */
    getAdapter() {
        if (this.fallbackMode) {
            return new MemoryStorageAdapter();
        } else {
            return this.storageAdapter;
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
}

// メモリストレージアダプター（フォールバック用）
class MemoryStorageAdapter {
    constructor() {
        this.data = { ...mockFileSystem };
    }

    async createFile(path, content = '') {
        this.data[path] = content;
        return true;
    }

    async readFile(path) {
        if (!(path in this.data)) {
            throw new Error(`File not found: ${path}`);
        }
        return this.data[path];
    }

    async deleteFile(path) {
        delete this.data[path];
        return true;
    }

    async createDirectory(path) {
        // メモリ版では実際のディレクトリは管理しない（ファイルパスで暗黙的に処理）
        return true;
    }

    async deleteDirectory(path) {
        // 該当パスで始まるすべてのファイルを削除
        const keysToDelete = Object.keys(this.data).filter(key => key.startsWith(path + '/'));
        keysToDelete.forEach(key => delete this.data[key]);
        return true;
    }

    async listChildren(parentPath = '/workspace') {
        const results = [];
        const normalizedParent = parentPath === '' ? '/workspace' : parentPath;

        for (const path of Object.keys(this.data)) {
            if (path.startsWith(normalizedParent + '/')) {
                const relativePath = path.substring(normalizedParent.length + 1);
                const segments = relativePath.split('/');

                if (segments.length === 1) {
                    // 直接の子ファイル
                    results.push({
                        path: path,
                        name: segments[0],
                        type: 'file',
                        content: this.data[path]
                    });
                }
            }
        }

        // ディレクトリも推測して追加
        const directories = new Set();
        for (const path of Object.keys(this.data)) {
            if (path.startsWith(normalizedParent + '/')) {
                const relativePath = path.substring(normalizedParent.length + 1);
                const segments = relativePath.split('/');

                if (segments.length > 1) {
                    directories.add(segments[0]);
                }
            }
        }

        for (const dirName of directories) {
            results.push({
                path: normalizedParent + '/' + dirName,
                name: dirName,
                type: 'directory'
            });
        }

        return results.sort((a, b) => {
            // ディレクトリを先に、その後はアルファベット順
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });
    }

    async moveItem(oldPath, newPath) {
        if (!(oldPath in this.data)) {
            throw new Error(`File not found: ${oldPath}`);
        }
        this.data[newPath] = this.data[oldPath];
        delete this.data[oldPath];
        return true;
    }

    async copyItem(sourcePath, destPath) {
        if (!(sourcePath in this.data)) {
            throw new Error(`File not found: ${sourcePath}`);
        }
        this.data[destPath] = this.data[sourcePath];
        return true;
    }

    async getItem(path) {
        if (path in this.data) {
            return {
                path: path,
                name: path.split('/').pop(),
                type: 'file',
                content: this.data[path]
            };
        }
        return null;
    }

    async clear() {
        this.data = {};
    }
}

// シングルトンインスタンス
export const storageManager = new StorageManager();

// DOM要素参照
export const elements = {
    // ヘッダー
    backBtn: document.getElementById('backBtn'),
    saveBtn: document.getElementById('saveBtn'),
    editBtn: document.getElementById('editBtn'),
    
    settingsBtn: document.getElementById('settingsBtn'),
    currentPath: document.getElementById('currentPath'),
    selectionInfo: document.getElementById('selectionInfo'),

    // メインコンテンツ
    fileListContainer: document.getElementById('fileListContainer'),
    fileList: document.getElementById('fileList'),
    fileView: document.getElementById('fileView'),
    fileContent: document.getElementById('fileContent'),

    // ボトムナビ
    chatContainer: document.getElementById('chatContainer'),
    actionContainer: document.getElementById('actionContainer'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    cancelBtn: document.getElementById('cancelBtn'),

    // FAB・チャット
    fabBtn: document.getElementById('fabBtn'),
    fabMenuOverlay: document.getElementById('fabMenuOverlay'),
    fabMenu: document.getElementById('fabMenu'),
    chatOverlay: document.getElementById('chatOverlay'),
    chatMessages: document.getElementById('chatMessages'),
    chatCloseBtn: document.getElementById('chatCloseBtn'),

    // モーダル
    settingsModal: document.getElementById('settingsModal'),
    createModal: document.getElementById('createModal'),
    renameModal: document.getElementById('renameModal'),
    importModal: document.getElementById('importModal'),
    systemPromptModal: document.getElementById('systemPromptModal'),
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
    promptList: document.getElementById('promptList')
};