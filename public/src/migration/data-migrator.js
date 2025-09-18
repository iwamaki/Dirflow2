/* =========================================
    データ移行ユーティリティ
   ========================================= */

/*
## 概要
アプリケーションのデータ移行とリカバリ機能を提供するモジュール。

## 責任
- 既存データ（mockFileSystem）からIndexedDBへの移行
- データのエクスポートとインポート
- ストレージ情報の取得とIndexedDBのクリア
- 移行状況の管理と進捗表示
*/

import { storageManager } from '../core/config.js';
import { MessageProcessor } from '../api/message-processor.js';

export class DataMigrator {
    constructor() {
        this.migrationInProgress = false;
        this.migrationStatus = {
            started: false,
            completed: false,
            totalFiles: 0,
            migratedFiles: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * アプリケーション起動時の自動移行チェック
     */
    async checkAndMigrate() {
        try {
            await storageManager.ensureInitialized();
            const storageMode = storageManager.getStorageMode();

            if (storageMode === 'indexeddb') {
                const stats = await storageManager.storageAdapter.getStorageStats();

                // IndexedDBが空で、移行可能なデータがある場合
                if (stats.totalFiles === 0) {
                    console.log('🔄 Empty IndexedDB detected, checking for migration...');
                    await this.performMigration();
                    return true;
                } else {
                    console.log(`✅ IndexedDB contains ${stats.totalFiles} files, migration not needed`);
                    return false;
                }
            } else {
                console.log('⚠️ Running in memory mode, migration not applicable');
                return false;
            }
        } catch (error) {
            console.error('Migration check failed:', error);
            return false;
        }
    }

    /**
     * 手動でのデータ移行実行
     */
    async performMigration(showProgress = true) {
        if (this.migrationInProgress) {
            throw new Error('Migration is already in progress');
        }

        this.migrationInProgress = true;
        this.migrationStatus = {
            started: true,
            completed: false,
            totalFiles: 0,
            migratedFiles: 0,
            errors: [],
            startTime: new Date(),
            endTime: null
        };

        try {
            if (showProgress) {
                MessageProcessor.addMessage('system', '🔄 データ移行を開始します...');
            }

            await storageManager.ensureInitialized();
            const result = await storageManager.checkAndMigrate();

            this.migrationStatus.completed = true;
            this.migrationStatus.endTime = new Date();

            if (showProgress) {
                const duration = this.migrationStatus.endTime - this.migrationStatus.startTime;
                MessageProcessor.addMessage('system', `✅ データ移行が完了しました（${duration}ms）`);
            }

            console.log('✅ Migration completed successfully');
            return result;

        } catch (error) {
            this.migrationStatus.errors.push(error.message);
            this.migrationStatus.endTime = new Date();

            if (showProgress) {
                MessageProcessor.addMessage('system', `❌ データ移行中にエラーが発生しました: ${error.message}`);
            }

            console.error('Migration failed:', error);
            throw error;

        } finally {
            this.migrationInProgress = false;
        }
    }

    /**
     * IndexedDBからメモリへのエクスポート（バックアップ目的）
     */
    async exportToMemory() {
        try {
            await storageManager.ensureInitialized();

            if (storageManager.getStorageMode() !== 'indexeddb') {
                throw new Error('IndexedDB mode required for export');
            }

            const data = await storageManager.storageAdapter.exportToMockFileSystem();
            const dataStr = JSON.stringify(data, null, 2);

            console.log('📤 Data exported from IndexedDB:', data);

            // ダウンロードリンクを作成
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `file-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            MessageProcessor.addMessage('system', '📤 データがJSONファイルとしてエクスポートされました');
            return data;

        } catch (error) {
            console.error('Export failed:', error);
            MessageProcessor.addMessage('system', `❌ エクスポートに失敗しました: ${error.message}`);
            throw error;
        }
    }

    /**
     * JSONファイルからIndexedDBへのインポート
     */
    async importFromJSON(jsonData) {
        try {
            await storageManager.ensureInitialized();

            if (storageManager.getStorageMode() !== 'indexeddb') {
                throw new Error('IndexedDB mode required for import');
            }

            MessageProcessor.addMessage('system', '📥 JSONデータをインポート中...');

            const adapter = storageManager.storageAdapter;

            // 既存データのクリア（確認後）
            if (confirm('既存のデータを削除してインポートしますか？')) {
                await adapter.clear();
            }

            // データのインポート
            await adapter.migrateFromMockFileSystem(jsonData);

            MessageProcessor.addMessage('system', '✅ JSONデータのインポートが完了しました');

            // ファイルリストの更新
            if (window.FileManagerController) {
                await window.FileManagerController.loadFileList();
            }

            return true;

        } catch (error) {
            console.error('Import failed:', error);
            MessageProcessor.addMessage('system', `❌ インポートに失敗しました: ${error.message}`);
            throw error;
        }
    }

    /**
     * ストレージ統計情報の取得
     */
    async getStorageInfo() {
        try {
            await storageManager.ensureInitialized();
            const storageMode = storageManager.getStorageMode();

            const info = {
                mode: storageMode,
                canMigrate: storageMode === 'indexeddb',
                migrationStatus: { ...this.migrationStatus }
            };

            if (storageMode === 'indexeddb') {
                info.stats = await storageManager.storageAdapter.getStorageStats();
            } else {
                // メモリモードの場合
                const adapter = storageManager.getAdapter();
                const dataSize = JSON.stringify(adapter.data).length;
                info.stats = {
                    totalFiles: Object.keys(adapter.data).length,
                    totalDirectories: 0,
                    totalSize: dataSize,
                    lastModified: null
                };
            }

            return info;

        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                mode: 'unknown',
                canMigrate: false,
                error: error.message
            };
        }
    }

    /**
     * IndexedDBのクリア（開発・テスト用）
     */
    async clearIndexedDB() {
        try {
            await storageManager.ensureInitialized();

            if (storageManager.getStorageMode() !== 'indexeddb') {
                throw new Error('IndexedDB mode required');
            }

            if (confirm('⚠️ IndexedDBの全データを削除しますか？この操作は取り消せません。')) {
                await storageManager.storageAdapter.clear();
                MessageProcessor.addMessage('system', '🗑️ IndexedDBをクリアしました');

                // ファイルリストの更新
                if (window.FileManagerController) {
                    await window.FileManagerController.loadFileList();
                }

                return true;
            }

            return false;

        } catch (error) {
            console.error('Failed to clear IndexedDB:', error);
            MessageProcessor.addMessage('system', `❌ IndexedDBのクリアに失敗しました: ${error.message}`);
            throw error;
        }
    }

    /**
     * 移行状況の確認
     */
    getMigrationStatus() {
        return { ...this.migrationStatus };
    }

    /**
     * 移行の進捗率を計算
     */
    getMigrationProgress() {
        if (!this.migrationStatus.started || this.migrationStatus.totalFiles === 0) {
            return 0;
        }

        return Math.round((this.migrationStatus.migratedFiles / this.migrationStatus.totalFiles) * 100);
    }

    /**
     * デバッグ情報の出力
     */
    async debugInfo() {
        const info = await this.getStorageInfo();
        console.log('🔍 Storage Debug Info:', info);

        if (typeof MessageProcessor !== 'undefined') {
            MessageProcessor.addMessage('system', `🔍 ストレージ情報: ${info.mode}モード、${info.stats?.totalFiles || 0}ファイル`);
        }

        return info;
    }
}

// シングルトンインスタンス
export const dataMigrator = new DataMigrator();

// グローバルアクセス用（開発・デバッグ用）
if (typeof window !== 'undefined') {
    window.dataMigrator = dataMigrator;
}