/* =========================================
    IndexedDB Storage Adapter (完全移行版)
   ========================================= */

/*
## 概要
IndexedDBを使用したファイルシステムデータの永続化アダプター（完全移行版）。
mockFileSystemへの依存を完全に削除し、IndexedDBのみで動作。

## 責任
- IndexedDBの初期化と管理
- ファイルおよびディレクトリのCRUD操作（作成、読み込み、更新、削除）
- ファイル/ディレクトリの移動とコピー
- ストレージ統計情報の提供
- 初期データの作成
- データのエクスポート・インポート
*/

export class StorageAdapter {
    constructor() {
        this.dbName = 'DirectoryFlowPro';  // DB名を更新（完全移行版）
        this.version = 2;  // バージョンアップ
        this.db = null;
        this.initialized = false;

        // ストレージ形式
        this.stores = {
            files: 'files',           // ファイルコンテンツ
            directories: 'directories', // ディレクトリ構造
            metadata: 'metadata'      // メタデータ（作成日時等）
        };
    }

    /**
     * IndexedDBの初期化
     */
    async initialize() {
        if (this.initialized) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                const error = new Error(`IndexedDB初期化に失敗しました: ${request.error}`);
                console.error('❌ IndexedDB initialization failed:', error);
                reject(error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔧 IndexedDB upgrade needed, creating object stores...');

                // ファイルストア作成
                if (!db.objectStoreNames.contains(this.stores.files)) {
                    const filesStore = db.createObjectStore(this.stores.files, {
                        keyPath: 'path'
                    });
                    filesStore.createIndex('name', 'name', { unique: false });
                    filesStore.createIndex('parentPath', 'parentPath', { unique: false });
                    filesStore.createIndex('extension', 'extension', { unique: false });
                    filesStore.createIndex('createdAt', 'createdAt', { unique: false });
                    filesStore.createIndex('modifiedAt', 'modifiedAt', { unique: false });
                }

                // ディレクトリストア作成
                if (!db.objectStoreNames.contains(this.stores.directories)) {
                    const dirsStore = db.createObjectStore(this.stores.directories, {
                        keyPath: 'path'
                    });
                    dirsStore.createIndex('parentPath', 'parentPath', { unique: false });
                    dirsStore.createIndex('name', 'name', { unique: false });
                    dirsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // メタデータストア作成
                if (!db.objectStoreNames.contains(this.stores.metadata)) {
                    const metadataStore = db.createObjectStore(this.stores.metadata, {
                        keyPath: 'key'
                    });
                }

                console.log('✅ Object stores created successfully');
            };

            request.onblocked = () => {
                console.warn('⚠️ IndexedDB upgrade blocked - close other tabs');
            };
        });
    }

    // ===== ファイル操作 =====

    /**
     * ファイル作成・更新
     */
    async createFile(path, content = '', metadata = {}) {
        await this.ensureInitialized();

        const now = new Date().toISOString();
        const { parent, name } = this._parsePath(path);
        const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

        const fileData = {
            path,
            name,
            parentPath: parent,
            content,
            extension,
            type: 'file',
            size: new Blob([content]).size,
            createdAt: metadata.createdAt || now,
            modifiedAt: now,
            ...metadata
        };

        const transaction = this.db.transaction([this.stores.files], 'readwrite');
        const store = transaction.objectStore(this.stores.files);

        try {
            await this._promisifyRequest(store.put(fileData));
            console.log(`✅ File saved: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to create file:', error);
            throw error;
        }
    }

    /**
     * ファイル読み込み
     */
    async readFile(path) {
        await this.ensureInitialized();

        const transaction = this.db.transaction([this.stores.files], 'readonly');
        const store = transaction.objectStore(this.stores.files);
        const result = await this._promisifyRequest(store.get(path));

        if (!result) {
            throw new Error(`ファイルが見つかりません: ${path}`);
        }

        return result.content;
    }

    /**
     * ファイル削除
     */
    async deleteFile(path) {
        await this.ensureInitialized();

        const transaction = this.db.transaction([this.stores.files], 'readwrite');
        const store = transaction.objectStore(this.stores.files);

        try {
            await this._promisifyRequest(store.delete(path));
            console.log(`✅ File deleted: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
        }
    }

    // ===== ディレクトリ操作 =====

    /**
     * ディレクトリ作成
     */
    async createDirectory(path) {
        await this.ensureInitialized();

        const now = new Date().toISOString();
        const { parent, name } = this._parsePath(path);

        const dirData = {
            path,
            name,
            parentPath: parent,
            type: 'directory',
            createdAt: now,
            modifiedAt: now
        };

        const transaction = this.db.transaction([this.stores.directories], 'readwrite');
        const store = transaction.objectStore(this.stores.directories);

        try {
            await this._promisifyRequest(store.put(dirData));
            console.log(`✅ Directory created: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to create directory:', error);
            throw error;
        }
    }

    /**
     * ディレクトリ削除（再帰的）
     */
    async deleteDirectory(path) {
        await this.ensureInitialized();

        // 子要素を全て削除
        const children = await this.listChildren(path);
        
        for (const child of children) {
            const childPath = path === '/' ? `/${child.name}` : `${path}/${child.name}`;
            if (child.type === 'directory') {
                await this.deleteDirectory(childPath);
            } else {
                await this.deleteFile(childPath);
            }
        }

        // ディレクトリ自体を削除
        const transaction = this.db.transaction([this.stores.directories], 'readwrite');
        const store = transaction.objectStore(this.stores.directories);

        try {
            await this._promisifyRequest(store.delete(path));
            console.log(`✅ Directory deleted: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to delete directory:', error);
            throw error;
        }
    }

    // ===== 一覧・検索操作 =====

    /**
     * 指定パスの子要素一覧取得
     */
    async listChildren(parentPath) {
        await this.ensureInitialized();

        const normalizedPath = parentPath === '/' ? '' : parentPath;

        // ファイル一覧取得
        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const filesIndex = filesStore.index('parentPath');
        const files = await this._promisifyRequest(filesIndex.getAll(normalizedPath));

        // ディレクトリ一覧取得
        const dirsTransaction = this.db.transaction([this.stores.directories], 'readonly');
        const dirsStore = dirsTransaction.objectStore(this.stores.directories);
        const dirsIndex = dirsStore.index('parentPath');
        const directories = await this._promisifyRequest(dirsIndex.getAll(normalizedPath));

        // 結果をマージしてソート
        const combined = [...directories, ...files];
        
        return combined.sort((a, b) => {
            // ディレクトリを先に表示
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            // 同じタイプの場合は名前でソート
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * アイテム情報取得（ファイル・ディレクトリ共通）
     */
    async getItem(path) {
        await this.ensureInitialized();

        // ファイルをチェック
        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const fileResult = await this._promisifyRequest(filesStore.get(path));

        if (fileResult) {
            return fileResult;
        }

        // ディレクトリをチェック
        const dirsTransaction = this.db.transaction([this.stores.directories], 'readonly');
        const dirsStore = dirsTransaction.objectStore(this.stores.directories);
        const dirResult = await this._promisifyRequest(dirsStore.get(path));

        return dirResult || null;
    }

    // ===== 移動・コピー操作 =====

    /**
     * ファイル移動
     */
    async _moveFile(oldPath, newPath) {
        const fileData = await this._promisifyRequest(
            this.db.transaction([this.stores.files], 'readonly')
                .objectStore(this.stores.files).get(oldPath)
        );

        if (!fileData) {
            throw new Error(`移動元ファイルが見つかりません: ${oldPath}`);
        }

        const { parent, name } = this._parsePath(newPath);
        const updatedFileData = {
            ...fileData,
            path: newPath,
            name,
            parentPath: parent,
            modifiedAt: new Date().toISOString()
        };

        const transaction = this.db.transaction([this.stores.files], 'readwrite');
        const store = transaction.objectStore(this.stores.files);

        await this._promisifyRequest(store.delete(oldPath));
        await this._promisifyRequest(store.put(updatedFileData));
    }

    /**
     * ディレクトリ移動（再帰的）
     */
    async _moveDirectory(oldPath, newPath) {
        const dirData = await this._promisifyRequest(
            this.db.transaction([this.stores.directories], 'readonly')
                .objectStore(this.stores.directories).get(oldPath)
        );

        if (!dirData) {
            throw new Error(`移動元ディレクトリが見つかりません: ${oldPath}`);
        }

        // 子要素を先に移動
        const children = await this.listChildren(oldPath);
        
        for (const child of children) {
            const childOldPath = `${oldPath}/${child.name}`;
            const childNewPath = `${newPath}/${child.name}`;
            
            if (child.type === 'directory') {
                await this._moveDirectory(childOldPath, childNewPath);
            } else {
                await this._moveFile(childOldPath, childNewPath);
            }
        }

        // ディレクトリ自体を移動
        const { parent, name } = this._parsePath(newPath);
        const updatedDirData = {
            ...dirData,
            path: newPath,
            name,
            parentPath: parent,
            modifiedAt: new Date().toISOString()
        };

        const transaction = this.db.transaction([this.stores.directories], 'readwrite');
        const store = transaction.objectStore(this.stores.directories);

        await this._promisifyRequest(store.delete(oldPath));
        await this._promisifyRequest(store.put(updatedDirData));
    }

    /**
     * アイテム移動（ファイル・ディレクトリ共通）
     */
    async moveItem(oldPath, newPath) {
        await this.ensureInitialized();

        const item = await this.getItem(oldPath);
        if (!item) {
            throw new Error(`移動元が見つかりません: ${oldPath}`);
        }

        if (item.type === 'directory') {
            await this._moveDirectory(oldPath, newPath);
        } else {
            await this._moveFile(oldPath, newPath);
        }

        console.log(`✅ Item moved: ${oldPath} → ${newPath}`);
        return true;
    }

    /**
     * ディレクトリコピー（再帰的）
     */
    async _copyDirectory(sourcePath, destPath) {
        // ディレクトリ作成
        await this.createDirectory(destPath);

        // 子要素をコピー
        const children = await this.listChildren(sourcePath);
        
        for (const child of children) {
            const childSourcePath = `${sourcePath}/${child.name}`;
            const childDestPath = `${destPath}/${child.name}`;
            
            if (child.type === 'directory') {
                await this._copyDirectory(childSourcePath, childDestPath);
            } else {
                const content = await this.readFile(childSourcePath);
                await this.createFile(childDestPath, content);
            }
        }
    }

    /**
     * アイテムコピー（ファイル・ディレクトリ共通）
     */
    async copyItem(sourcePath, destPath) {
        await this.ensureInitialized();

        const item = await this.getItem(sourcePath);
        if (!item) {
            throw new Error(`コピー元が見つかりません: ${sourcePath}`);
        }

        if (item.type === 'directory') {
            await this._copyDirectory(sourcePath, destPath);
        } else {
            const content = await this.readFile(sourcePath);
            await this.createFile(destPath, content);
        }

        console.log(`✅ Item copied: ${sourcePath} → ${destPath}`);
        return true;
    }

    // ===== エクスポート・統計情報 =====

    /**
     * 全データをmockFileSystem形式で取得（エクスポート用）
     */
    async exportToMockFileSystem() {
        await this.ensureInitialized();

        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const allFiles = await this._promisifyRequest(filesStore.getAll());

        const exportData = {};
        for (const file of allFiles) {
            exportData[file.path] = file.content;
        }

        console.log('📤 Data exported from IndexedDB:', exportData);
        return exportData;
    }

    /**
     * JSON形式データからのインポート
     */
    async importFromJSON(jsonData) {
        await this.ensureInitialized();

        console.log('📥 Importing data to IndexedDB...');
        
        // 既存データをクリア
        await this.clear();

        let importedCount = 0;
        
        // ディレクトリを先に作成
        const directories = new Set();
        for (const path of Object.keys(jsonData)) {
            const pathParts = path.split('/');
            for (let i = 1; i < pathParts.length - 1; i++) {
                const dirPath = '/' + pathParts.slice(1, i + 1).join('/');
                directories.add(dirPath);
            }
        }

        for (const dirPath of directories) {
            await this.createDirectory(dirPath);
        }

        // ファイルを作成
        for (const [path, content] of Object.entries(jsonData)) {
            await this.createFile(path, content);
            importedCount++;
        }

        console.log(`✅ Import completed: ${importedCount} files imported`);
        return { success: true, importedCount };
    }

    /**
     * ストレージ統計情報取得
     */
    async getStorageStats() {
        await this.ensureInitialized();

        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const files = await this._promisifyRequest(filesStore.getAll());

        const dirsTransaction = this.db.transaction([this.stores.directories], 'readonly');
        const dirsStore = dirsTransaction.objectStore(this.stores.directories);
        const directories = await this._promisifyRequest(dirsStore.getAll());

        const totalSize = files.reduce((size, file) => size + (file.size || 0), 0);

        return {
            totalFiles: files.length,
            totalDirectories: directories.length,
            totalSize,
            lastModified: new Date().toISOString()
        };
    }

    /**
     * ストレージクリア
     */
    async clear() {
        await this.ensureInitialized();

        const transaction = this.db.transaction([
            this.stores.files,
            this.stores.directories,
            this.stores.metadata
        ], 'readwrite');

        await Promise.all([
            this._promisifyRequest(transaction.objectStore(this.stores.files).clear()),
            this._promisifyRequest(transaction.objectStore(this.stores.directories).clear()),
            this._promisifyRequest(transaction.objectStore(this.stores.metadata).clear())
        ]);

        console.log('🗑️ IndexedDB storage cleared');
    }

    // ===== 内部ヘルパーメソッド =====

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    _promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _parsePath(path) {
        const parts = path.split('/').filter(part => part !== '');
        if (parts.length === 0) {
            return { parent: '', name: '' };
        }

        const name = parts[parts.length - 1];
        const parentParts = parts.slice(0, -1);
        const parent = parentParts.length > 0 ? '/' + parentParts.join('/') : '';

        return { parent, name };
    }
}

// シングルトンインスタンス
export const storageAdapter = new StorageAdapter();
