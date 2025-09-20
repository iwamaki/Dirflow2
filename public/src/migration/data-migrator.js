/* =========================================
    データ移行・エクスポート管理 
   ========================================= */

/*
## 概要
IndexedDBデータのエクスポート・インポート機能を提供するモジュール。
mockFileSystemからの移行機能を削除し、JSON形式でのデータバックアップ・復元に特化。

## 責任
- IndexedDBからJSONへのエクスポート
- JSONからIndexedDBへのインポート
- データのバックアップとリストア
- 移行進捗の管理とUI表示
- エラーハンドリング
*/

import { MessageProcessor } from '../api/message-processor.js';
import { storageManager } from '../core/config.js';

export class DataMigrator {
    constructor() {
        this.migrationInProgress = false;
        this.migrationStatus = {
            inProgress: false,
            completed: false,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    /**
     * IndexedDBからJSONファイルへのエクスポート
     */
    async exportToJSON(showProgress = true) {
        if (this.migrationInProgress) {
            throw new Error('エクスポート処理が既に実行中です');
        }

        this.migrationInProgress = true;
        this.migrationStatus = {
            inProgress: true,
            completed: false,
            errors: [],
            startTime: new Date(),
            endTime: null
        };

        try {
            if (showProgress) {
                MessageProcessor.addMessage('system', '📤 データエクスポートを開始しています...');
            }

            await storageManager.ensureInitialized();

            if (storageManager.getStorageMode() !== 'indexeddb') {
                throw new Error('IndexedDBモードが必要です');
            }

            // ストレージ統計情報取得
            const stats = await storageManager.storageAdapter.getStorageStats();
            
            if (stats.totalFiles === 0) {
                if (showProgress) {
                    MessageProcessor.addMessage('system', '⚠️ エクスポートするデータがありません');
                }
                return { success: true, exportedCount: 0 };
            }

            // データエクスポート
            const data = await storageManager.storageAdapter.exportToMockFileSystem();
            
            // JSONファイルとしてダウンロード
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `ai-file-manager-backup-${timestamp}.json`;
            
            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.migrationStatus.completed = true;
            this.migrationStatus.endTime = new Date();

            if (showProgress) {
                const duration = this.migrationStatus.endTime - this.migrationStatus.startTime;
                MessageProcessor.addMessage('system', 
                    `✅ データエクスポートが完了しました\n` +
                    `📊 ${stats.totalFiles} ファイル、${stats.totalDirectories} フォルダ\n` +
                    `💾 ファイル名: ${filename}\n` +
                    `⏱️ 処理時間: ${duration}ms`
                );
            }

            console.log('✅ Data export completed successfully');
            return { success: true, exportedCount: stats.totalFiles, filename };

        } catch (error) {
            this.migrationStatus.errors.push(error.message);
            this.migrationStatus.endTime = new Date();

            if (showProgress) {
                MessageProcessor.addMessage('system', `❌ データエクスポートに失敗しました: ${error.message}`);
            }

            console.error('Data export failed:', error);
            throw error;

        } finally {
            this.migrationInProgress = false;
            this.migrationStatus.inProgress = false;
        }
    }

    /**
     * JSONファイルからIndexedDBへのインポート
     */
    async importFromJSON(jsonData, showProgress = true) {
        if (this.migrationInProgress) {
            throw new Error('インポート処理が既に実行中です');
        }

        this.migrationInProgress = true;
        this.migrationStatus = {
            inProgress: true,
            completed: false,
            errors: [],
            startTime: new Date(),
            endTime: null
        };

        try {
            if (showProgress) {
                MessageProcessor.addMessage('system', '📥 データインポートを開始しています...');
            }

            await storageManager.ensureInitialized();

            if (storageManager.getStorageMode() !== 'indexeddb') {
                throw new Error('IndexedDBモードが必要です');
            }

            // データ形式の検証
            if (!jsonData || typeof jsonData !== 'object') {
                throw new Error('無効なJSONデータ形式です');
            }

            const fileCount = Object.keys(jsonData).length;
            if (fileCount === 0) {
                if (showProgress) {
                    MessageProcessor.addMessage('system', '⚠️ インポートするデータがありません');
                }
                return { success: true, importedCount: 0 };
            }

            // 既存データのバックアップ確認
            const existingStats = await storageManager.storageAdapter.getStorageStats();
            if (existingStats.totalFiles > 0) {
                const confirmed = confirm(
                    `既存のデータ（${existingStats.totalFiles}ファイル）を削除してインポートしますか？\n` +
                    `この操作は取り消せません。`
                );
                
                if (!confirmed) {
                    throw new Error('ユーザーによりキャンセルされました');
                }
            }

            // インポート実行
            const result = await storageManager.storageAdapter.importFromJSON(jsonData);

            this.migrationStatus.completed = true;
            this.migrationStatus.endTime = new Date();

            if (showProgress) {
                const duration = this.migrationStatus.endTime - this.migrationStatus.startTime;
                MessageProcessor.addMessage('system', 
                    `✅ データインポートが完了しました\n` +
                    `📊 ${result.importedCount} ファイルをインポート\n` +
                    `⏱️ 処理時間: ${duration}ms`
                );
            }

            // ファイルリストの更新
            if (window.FileManagerController) {
                await window.FileManagerController.loadFileList();
            }

            console.log('✅ Data import completed successfully');
            return result;

        } catch (error) {
            this.migrationStatus.errors.push(error.message);
            this.migrationStatus.endTime = new Date();

            if (showProgress) {
                MessageProcessor.addMessage('system', `❌ データインポートに失敗しました: ${error.message}`);
            }

            console.error('Data import failed:', error);
            throw error;

        } finally {
            this.migrationInProgress = false;
            this.migrationStatus.inProgress = false;
        }
    }

    /**
     * ファイル選択によるインポート
     */
    async importFromFile(showProgress = true) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    reject(new Error('ファイルが選択されていません'));
                    return;
                }

                if (!file.name.endsWith('.json')) {
                    reject(new Error('JSONファイルを選択してください'));
                    return;
                }

                try {
                    const text = await file.text();
                    const jsonData = JSON.parse(text);
                    const result = await this.importFromJSON(jsonData, showProgress);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`ファイル読み込みに失敗しました: ${error.message}`));
                }
            };

            input.click();
        });
    }

    /**
     * レガシーデータの自動移行（既存ユーザー向け）
     */
    async migrateLegacyData(showProgress = true) {
        // 旧バージョンのIndexedDBからの移行
        try {
            if (showProgress) {
                MessageProcessor.addMessage('system', '🔄 レガシーデータの移行チェック中...');
            }

            // 旧DB名 "DirectoryFlow" から新DB名 "DirectoryFlowPro" への移行
            const legacyDbName = 'DirectoryFlow';
            const legacyData = await this._checkLegacyDatabase(legacyDbName);
            
            if (legacyData && Object.keys(legacyData).length > 0) {
                if (showProgress) {
                    MessageProcessor.addMessage('system', '📦 旧バージョンのデータを発見しました。移行を開始します...');
                }
                
                await this.importFromJSON(legacyData, false);
                
                if (showProgress) {
                    MessageProcessor.addMessage('system', '✅ レガシーデータの移行が完了しました');
                }
                
                return { success: true, migrated: true };
            } else {
                if (showProgress) {
                    MessageProcessor.addMessage('system', '📂 移行対象のレガシーデータはありませんでした');
                }
                
                return { success: true, migrated: false };
            }

        } catch (error) {
            console.warn('Legacy data migration failed:', error);
            if (showProgress) {
                MessageProcessor.addMessage('system', `⚠️ レガシーデータの移行に失敗: ${error.message}`);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * 旧データベースの確認
     */
    async _checkLegacyDatabase(dbName) {
        return new Promise((resolve) => {
            const request = indexedDB.open(dbName);
            
            request.onsuccess = async () => {
                try {
                    const db = request.result;
                    
                    if (db.objectStoreNames.contains('files')) {
                        const transaction = db.transaction(['files'], 'readonly');
                        const store = transaction.objectStore('files');
                        const files = await this._promisifyRequest(store.getAll());
                        
                        const legacyData = {};
                        for (const file of files) {
                            if (file.path && file.content !== undefined) {
                                legacyData[file.path] = file.content;
                            }
                        }
                        
                        db.close();
                        resolve(legacyData);
                    } else {
                        db.close();
                        resolve(null);
                    }
                } catch (error) {
                    console.warn('Error reading legacy database:', error);
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    /**
     * ストレージ統計情報の取得
     */
    async getStorageInfo() {
        try {
            await storageManager.ensureInitialized();
            
            const stats = await storageManager.storageAdapter.getStorageStats();
            
            return {
                mode: 'indexeddb',
                isHealthy: true,
                stats,
                canExport: stats.totalFiles > 0,
                canImport: true,
                migrationStatus: { ...this.migrationStatus }
            };

        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                mode: 'error',
                isHealthy: false,
                error: error.message,
                canExport: false,
                canImport: false,
                migrationStatus: { ...this.migrationStatus }
            };
        }
    }

    /**
     * 移行状況の取得
     */
    getMigrationStatus() {
        return {
            ...this.migrationStatus,
            inProgress: this.migrationInProgress
        };
    }

    /**
     * 移行状況のリセット
     */
    resetMigrationStatus() {
        this.migrationInProgress = false;
        this.migrationStatus = {
            inProgress: false,
            completed: false,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    // ヘルパーメソッド
    _promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// シングルトンインスタンス
export const dataMigrator = new DataMigrator();
