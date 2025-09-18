/* =========================================
    IndexedDB Storage Adapter
   ========================================= */

/*
## 概要
IndexedDBを使用したファイルシステムデータの永続化アダプター。

## 責任
- IndexedDBの初期化と管理
- ファイルおよびディレクトリのCRUD操作（作成、読み込み、更新、削除）
- mockFileSystemからのデータ移行と互換性維持
- ファイル/ディレクトリの移動とコピー
- ストレージ統計情報の提供
*/

export class StorageAdapter {
    constructor() {
        this.dbName = 'DirectoryFlow';
        this.version = 1;
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
                console.error('IndexedDB initialization failed:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // ファイルストア作成
                if (!db.objectStoreNames.contains(this.stores.files)) {
                    const filesStore = db.createObjectStore(this.stores.files, {
                        keyPath: 'path'
                    });
                    filesStore.createIndex('name', 'name', { unique: false });
                    filesStore.createIndex('parentPath', 'parentPath', { unique: false });
                }

                // ディレクトリストア作成
                if (!db.objectStoreNames.contains(this.stores.directories)) {
                    const dirsStore = db.createObjectStore(this.stores.directories, {
                        keyPath: 'path'
                    });
                    dirsStore.createIndex('parentPath', 'parentPath', { unique: false });
                }

                // メタデータストア作成
                if (!db.objectStoreNames.contains(this.stores.metadata)) {
                    db.createObjectStore(this.stores.metadata, {
                        keyPath: 'path'
                    });
                }

                console.log('✅ IndexedDB schema created');
            };
        });
    }

    /**
     * ファイルの作成/更新
     */
    async createFile(path, content = '', type = 'file') {
        await this.ensureInitialized();

        const transaction = this.db.transaction([this.stores.files, this.stores.metadata], 'readwrite');
        const filesStore = transaction.objectStore(this.stores.files);
        const metadataStore = transaction.objectStore(this.stores.metadata);

        const pathParts = this._parsePath(path);
        const fileData = {
            path: path,
            name: pathParts.name,
            parentPath: pathParts.parent,
            content: content,
            type: type
        };

        const metadataData = {
            path: path,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            size: content.length
        };

        try {
            await Promise.all([
                this._promisifyRequest(filesStore.put(fileData)),
                this._promisifyRequest(metadataStore.put(metadataData))
            ]);

            // 親ディレクトリが存在しない場合は作成
            if (pathParts.parent !== '') {
                await this._ensureDirectoryExists(pathParts.parent);
            }

            console.log(`✅ File created/updated: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to create file:', error);
            throw error;
        }
    }

    /**
     * ディレクトリの作成
     */
    async createDirectory(path) {
        await this.ensureInitialized();

        const transaction = this.db.transaction([this.stores.directories, this.stores.metadata], 'readwrite');
        const dirsStore = transaction.objectStore(this.stores.directories);
        const metadataStore = transaction.objectStore(this.stores.metadata);

        const pathParts = this._parsePath(path);
        const dirData = {
            path: path,
            name: pathParts.name,
            parentPath: pathParts.parent,
            type: 'directory'
        };

        const metadataData = {
            path: path,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            size: 0
        };

        try {
            await Promise.all([
                this._promisifyRequest(dirsStore.put(dirData)),
                this._promisifyRequest(metadataStore.put(metadataData))
            ]);

            // 親ディレクトリも確保
            if (pathParts.parent !== '') {
                await this._ensureDirectoryExists(pathParts.parent);
            }

            console.log(`✅ Directory created: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to create directory:', error);
            throw error;
        }
    }

    /**
     * ファイル読み込み
     */
    async readFile(path) {
        await this.ensureInitialized();

        const transaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = transaction.objectStore(this.stores.files);

        try {
            const result = await this._promisifyRequest(filesStore.get(path));
            if (result) {
                return result.content;
            } else {
                throw new Error(`File not found: ${path}`);
            }
        } catch (error) {
            console.error('Failed to read file:', error);
            throw error;
        }
    }

    /**
     * ファイル削除
     */
    async deleteFile(path) {
        await this.ensureInitialized();

        const transaction = this.db.transaction([this.stores.files, this.stores.metadata], 'readwrite');
        const filesStore = transaction.objectStore(this.stores.files);
        const metadataStore = transaction.objectStore(this.stores.metadata);

        try {
            await Promise.all([
                this._promisifyRequest(filesStore.delete(path)),
                this._promisifyRequest(metadataStore.delete(path))
            ]);

            console.log(`✅ File deleted: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
        }
    }

    /**
     * ディレクトリ削除（再帰的）
     */
    async deleteDirectory(path) {
        await this.ensureInitialized();

        // 子ファイル・ディレクトリを取得
        const children = await this.listChildren(path);

        // 再帰的に削除
        for (const child of children) {
            if (child.type === 'directory') {
                await this.deleteDirectory(child.path);
            } else {
                await this.deleteFile(child.path);
            }
        }

        // ディレクトリ自体を削除
        const transaction = this.db.transaction([this.stores.directories, this.stores.metadata], 'readwrite');
        const dirsStore = transaction.objectStore(this.stores.directories);
        const metadataStore = transaction.objectStore(this.stores.metadata);

        try {
            await Promise.all([
                this._promisifyRequest(dirsStore.delete(path)),
                this._promisifyRequest(metadataStore.delete(path))
            ]);

            console.log(`✅ Directory deleted: ${path}`);
            return true;
        } catch (error) {
            console.error('Failed to delete directory:', error);
            throw error;
        }
    }

    /**
     * ファイル/ディレクトリ一覧取得
     */
    async listChildren(parentPath = '') {
        await this.ensureInitialized();

        const results = [];

        // ファイル一覧取得
        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const filesIndex = filesStore.index('parentPath');

        const filesRequest = filesIndex.getAll(parentPath);
        const files = await this._promisifyRequest(filesRequest);
        results.push(...files);

        // ディレクトリ一覧取得
        const dirsTransaction = this.db.transaction([this.stores.directories], 'readonly');
        const dirsStore = dirsTransaction.objectStore(this.stores.directories);
        const dirsIndex = dirsStore.index('parentPath');

        const dirsRequest = dirsIndex.getAll(parentPath);
        const dirs = await this._promisifyRequest(dirsRequest);
        results.push(...dirs);

        return results.sort((a, b) => {
            // ディレクトリを先に、その後はアルファベット順
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * ファイル/ディレクトリ移動
     */
    async moveItem(oldPath, newPath) {
        await this.ensureInitialized();

        // まず存在確認
        const item = await this.getItem(oldPath);
        if (!item) {
            throw new Error(`Item not found: ${oldPath}`);
        }

        if (item.type === 'directory') {
            // ディレクトリの場合は再帰的に移動
            await this._moveDirectory(oldPath, newPath);
        } else {
            // ファイルの場合
            await this._moveFile(oldPath, newPath);
        }

        console.log(`✅ Item moved: ${oldPath} → ${newPath}`);
        return true;
    }

    /**
     * ファイル/ディレクトリコピー
     */
    async copyItem(sourcePath, destPath) {
        await this.ensureInitialized();

        const item = await this.getItem(sourcePath);
        if (!item) {
            throw new Error(`Item not found: ${sourcePath}`);
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

    /**
     * アイテム情報取得
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

    /**
     * 既存のmockFileSystemからデータ移行
     */
    async migrateFromMockFileSystem(mockFileSystem) {
        console.log('🔄 Starting migration from mockFileSystem...');

        await this.ensureInitialized();
        let migratedCount = 0;

        try {
            for (const [path, content] of Object.entries(mockFileSystem)) {
                await this.createFile(path, content);
                migratedCount++;
            }

            console.log(`✅ Migration completed: ${migratedCount} files migrated`);
            return { success: true, migratedCount };
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }

    /**
     * 全データをmockFileSystem形式で取得
     */
    async exportToMockFileSystem() {
        await this.ensureInitialized();

        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const allFiles = await this._promisifyRequest(filesStore.getAll());

        const mockFileSystem = {};
        for (const file of allFiles) {
            mockFileSystem[file.path] = file.content;
        }

        return mockFileSystem;
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

        console.log('✅ Storage cleared');
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

    async _ensureDirectoryExists(dirPath) {
        if (dirPath === '') return;

        const existing = await this.getItem(dirPath);
        if (!existing) {
            await this.createDirectory(dirPath);
        }
    }

    async _moveFile(oldPath, newPath) {
        const content = await this.readFile(oldPath);
        await this.createFile(newPath, content);
        await this.deleteFile(oldPath);
    }

    async _moveDirectory(oldPath, newPath) {
        // 新しいディレクトリを作成
        await this.createDirectory(newPath);

        // 子要素を移動
        const children = await this.listChildren(oldPath);
        for (const child of children) {
            const newChildPath = child.path.replace(oldPath, newPath);
            await this.moveItem(child.path, newChildPath);
        }

        // 元のディレクトリを削除
        await this.deleteDirectory(oldPath);
    }

    async _copyDirectory(sourcePath, destPath) {
        // 新しいディレクトリを作成
        await this.createDirectory(destPath);

        // 子要素をコピー
        const children = await this.listChildren(sourcePath);
        for (const child of children) {
            const newChildPath = child.path.replace(sourcePath, destPath);
            await this.copyItem(child.path, newChildPath);
        }
    }

    /**
     * ストレージ統計情報の取得
     */
    async getStorageStats() {
        await this.ensureInitialized();

        const stats = {
            totalFiles: 0,
            totalDirectories: 0,
            totalSize: 0,
            lastModified: null
        };

        // ファイル統計
        const filesTransaction = this.db.transaction([this.stores.files], 'readonly');
        const filesStore = filesTransaction.objectStore(this.stores.files);
        const allFiles = await this._promisifyRequest(filesStore.getAll());

        stats.totalFiles = allFiles.length;
        stats.totalSize = allFiles.reduce((sum, file) => sum + (file.content?.length || 0), 0);

        // ディレクトリ統計
        const dirsTransaction = this.db.transaction([this.stores.directories], 'readonly');
        const dirsStore = dirsTransaction.objectStore(this.stores.directories);
        const allDirs = await this._promisifyRequest(dirsStore.getAll());

        stats.totalDirectories = allDirs.length;

        // メタデータから最終更新日時を取得
        const metaTransaction = this.db.transaction([this.stores.metadata], 'readonly');
        const metaStore = metaTransaction.objectStore(this.stores.metadata);
        const allMeta = await this._promisifyRequest(metaStore.getAll());

        if (allMeta.length > 0) {
            const latestMeta = allMeta.reduce((latest, meta) =>
                new Date(meta.modifiedAt) > new Date(latest.modifiedAt) ? meta : latest
            );
            stats.lastModified = latestMeta.modifiedAt;
        }

        return stats;
    }
}

// シングルトンインスタンス
export const storageAdapter = new StorageAdapter();