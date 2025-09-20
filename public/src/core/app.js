/* =========================================
    アプリケーション初期化
   ========================================= */

/*
## 概要
アプリケーションの初期化と起動を担当するクラス。
初期化プロセスと堅牢なエラーハンドリング。

## 責任
- ストレージの初期化
- レガシーデータの自動移行
- アプリケーション設定の読み込み
- イベントリスナーの登録
- ファイルリストの読み込み
- ウェルカムメッセージの表示
- 初期化エラーのハンドリング
*/

import { AppState, ConversationHistory } from './state.js';
import { storageManager } from './config.js';
import { APIClient } from '../api/client.js';
import { NavigationController } from '../ui/navigation.js';
import { FileManagerController } from '../file-system/file-manager.js';
import { MessageProcessor } from '../api/message-processor.js';
import { EventHandlers } from '../events/event-handlers.js';
import { dataMigrator } from '../migration/data-migrator.js';

// アプリケーション初期化
export class App {
    static async init() {
        console.log('🚀 AI File Manager (IndexedDB Pro) - Starting initialization...');

        // 初期化段階の状態管理
        const initializationSteps = {
            storage: false,
            migration: false,
            providers: false,
            ui: false,
            events: false,
            fileList: false,
            complete: false
        };

        try {
            // === ステップ1: ストレージ初期化 ===
            console.log('📦 Step 1: Initializing IndexedDB storage...');
            await this._initializeStorage();
            initializationSteps.storage = true;
            console.log('✅ IndexedDB storage initialized successfully');

            // === ステップ2: レガシーデータ移行 ===
            console.log('🔄 Step 2: Checking for legacy data migration...');
            await this._handleLegacyMigration();
            initializationSteps.migration = true;
            console.log('✅ Legacy data migration check completed');

            // === ステップ3: LLMプロバイダー読み込み ===
            console.log('🌐 Step 3: Loading LLM providers...');
            await APIClient.loadProviders();
            initializationSteps.providers = true;
            console.log('✅ LLM providers loaded successfully');

            // === ステップ4: UI設定適用 ===
            console.log('🎨 Step 4: Applying UI theme and settings...');
            NavigationController.applyTheme();
            initializationSteps.ui = true;
            console.log('✅ UI theme and settings applied');

            // === ステップ5: イベントハンドラー初期化 ===
            console.log('👂 Step 5: Initializing event handlers...');
            EventHandlers.init();
            initializationSteps.events = true;
            console.log('✅ Event handlers initialized');

            // === ステップ6: ファイルリスト読み込み ===
            console.log('📂 Step 6: Loading file list...');
            await FileManagerController.loadFileList();
            initializationSteps.fileList = true;
            console.log('✅ File list loaded successfully');

            // === ステップ7: ウェルカムメッセージ表示 ===
            console.log('💬 Step 7: Displaying welcome message...');
            await this._showWelcomeMessage();
            initializationSteps.complete = true;
            console.log('✅ Welcome message displayed');

            console.log('🎉 AI File Manager initialization completed successfully!');

        } catch (error) {
            console.error('❌ Initialization failed at step:', this._getFailedStep(initializationSteps));
            console.error('Error details:', error);
            await this._showErrorMessage(error, initializationSteps);
        }
    }

    /**
     * ストレージ初期化
     */
    static async _initializeStorage() {
        try {
            const storageMode = await storageManager.initialize();
            
            if (storageMode !== 'indexeddb') {
                throw new Error('IndexedDBの初期化に失敗しました');
            }

            // ストレージ統計情報をログ出力
            const stats = await storageManager.storageAdapter.getStorageStats();
            console.log(`💾 Storage initialized: ${stats.totalFiles} files, ${stats.totalDirectories} directories`);

        } catch (error) {
            throw new Error(`ストレージ初期化エラー: ${error.message}`);
        }
    }

    /**
     * レガシーデータ移行処理
     */
    static async _handleLegacyMigration() {
        try {
            // 自動的にレガシーデータをチェックして移行
            const migrationResult = await dataMigrator.migrateLegacyData(false);
            
            if (migrationResult.migrated) {
                console.log('📦 Legacy data migrated successfully');
                
                // ユーザーに移行完了を通知（遅延実行）
                setTimeout(() => {
                    if (window.MessageProcessor) {
                        MessageProcessor.addMessage('system', 
                            '🔄 旧バージョンからのデータ移行が完了しました。' +
                            'データが正常に引き継がれています。'
                        );
                    }
                }, 2000);
            }

        } catch (error) {
            console.warn('⚠️ Legacy migration failed (non-critical):', error);
            // レガシー移行の失敗は致命的ではないため継続
        }
    }

    /**
     * ウェルカムメッセージ表示
     */
    static async _showWelcomeMessage() {
        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    const providerName = AppState.availableProviders[AppState.llmProvider]?.name || AppState.llmProvider;
                    const historyStatus = ConversationHistory.getHistoryStatus();
                    const stats = await storageManager.storageAdapter.getStorageStats();

                    const welcomeMessage = `🎉 AI File Manager Pro へようこそ！


**📊 現在の状況:**
• ファイル: ${stats.totalFiles}個
• フォルダ: ${stats.totalDirectories}個
• ストレージ使用量: ${this._formatBytes(stats.totalSize)}

**🤖 AI設定:**
• プロバイダー: ${providerName}
• モデル: ${AppState.llmModel}
• 会話履歴: ${historyStatus.count}件 ${historyStatus.shouldWarn ? '⚠️' : '✅'}

**⚡ 拡張AIコマンド:**
📝 **ファイル操作** - "新しいファイルを作って" "README.md を編集して"
📁 **フォルダ操作** - "docs フォルダを作って" "ファイルを整理して"
📋 **コピー・移動** - "バックアップを作って" "ファイルを移動して"
🗑️ **削除・管理** - "不要なファイルを削除" "一覧を表示して"

**🔄 一括操作:**
• "全ての .txt ファイルを削除して"
• "画像ファイル全部を images フォルダに整理"
• "プロジェクトファイルをバックアップして"

**💾 データ管理:**
• 設定画面からデータのエクスポート・インポートが可能
• 自動バックアップ機能搭載
• 安全なデータ移行をサポート

**🚀 使用例:**
• "プロジェクト構成を作って、README とドキュメントフォルダも"
• "設定ファイルconfig.jsonに初期値を入れて保存して"
• "古いファイルを全部 archive フォルダに移動して"

**help** と入力すると詳細なコマンド一覧を確認できます。

さあ、強化された永続化ストレージで快適なファイル管理を始めましょう！🎯`;

                    if (window.MessageProcessor) {
                        MessageProcessor.addMessage('ai', welcomeMessage);
                    }

                } catch (error) {
                    console.error('Failed to show welcome message:', error);
                    // ウェルカムメッセージの失敗は致命的ではない
                    if (window.MessageProcessor) {
                        MessageProcessor.addMessage('ai', '🎉 AI File Manager Pro へようこそ！');
                    }
                }

                resolve();
            }, 1000);
        });
    }

    /**
     * エラーメッセージ表示
     */
    static async _showErrorMessage(error, initializationSteps) {
        const failedStep = this._getFailedStep(initializationSteps);
        const isStorageError = failedStep === 'storage';
        
        const errorMessage = `❌ 初期化エラーが発生しました

**エラー箇所:** ${failedStep}
**エラー内容:** ${error.message}

${isStorageError ? `
**🔧 対処方法:**
1. ブラウザがIndexedDBをサポートしているか確認
2. プライベートモードを無効にして再試行
3. ブラウザのストレージ制限を確認
4. 他のタブでアプリが開かれていないか確認
5. ページを再読み込みして再試行

**🚨 重要:** データが失われる可能性があるため、設定からバックアップを取ることをお勧めします。
` : `
**🔧 対処方法:**
1. ページを再読み込みして再試行
2. ブラウザのキャッシュをクリア
3. 開発者ツールでコンソールエラーを確認

エラーが継続する場合は、開発者にお問い合わせください。
`}`;

        if (window.MessageProcessor) {
            setTimeout(() => {
                MessageProcessor.addMessage('system', errorMessage);
            }, 500);
        } else {
            // MessageProcessorが利用できない場合の代替手段
            alert(`初期化エラー: ${error.message}\n\nページを再読み込みしてください。`);
        }

        // エラー情報をローカルストレージに保存（問題解析用）
        try {
            localStorage.setItem('ai-file-manager-last-error', JSON.stringify({
                timestamp: new Date().toISOString(),
                step: failedStep,
                error: error.message,
                stack: error.stack,
                steps: initializationSteps
            }));
        } catch (e) {
            console.warn('Failed to save error info to localStorage:', e);
        }
    }

    /**
     * 失敗したステップを特定
     */
    static _getFailedStep(steps) {
        const stepNames = ['storage', 'migration', 'providers', 'ui', 'events', 'fileList', 'complete'];
        
        for (const stepName of stepNames) {
            if (!steps[stepName]) {
                return stepName;
            }
        }
        
        return 'unknown';
    }

    /**
     * バイト数のフォーマット
     */
    static _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * アプリケーション再起動
     */
    static async restart() {
        console.log('🔄 Restarting AI File Manager...');
        
        try {
            // 現在の状態をクリア
            if (window.EventHandlers) {
                EventHandlers.cleanup?.();
            }
            
            // 再初期化
            await this.init();
            
        } catch (error) {
            console.error('❌ Restart failed:', error);
            alert('再起動に失敗しました。ページを手動で再読み込みしてください。');
        }
    }
}

// DOMContentLoaded時の初期化
document.addEventListener('DOMContentLoaded', () => {
    App.init().catch(error => {
        console.error('Fatal initialization error:', error);
    });
});

// エラーハンドラー（グローバル）
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    
    // 致命的エラーの場合は保存を試行
    if (event.error?.message?.includes('IndexedDB')) {
        console.warn('IndexedDB related error detected, attempting emergency save...');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Promise拒否を適切にログ記録
    if (event.reason?.message?.includes('IndexedDB')) {
        console.warn('IndexedDB promise rejection detected');
    }
});
