/* =========================================
    アプリケーション初期化
   ========================================= */

/*
## 概要
AI File Managerアプリケーションの初期化と起動を担当するクラス。

## 責任
- アプリケーションの初期設定（プロバイダー読み込み、テーマ適用など）
- イベントリスナーの登録
- ファイルリストの読み込み
- ウェルカムメッセージの表示
- 初期化中のエラーハンドリング
*/

import { AppState, ConversationHistory } from './state.js';
import { storageManager } from './config.js';
import { APIClient } from '../api/client.js';
import { NavigationController } from '../ui/navigation.js';
import { FileManagerController } from '../file-system/file-manager.js';
import { MessageProcessor } from '../api/message-processor.js';
import { EventHandlers } from '../events/event-handlers.js';

// アプリケーション初期化
export class App {
    static async init() {
        try {
            console.log('🚀 AI File Manager - Starting initialization...');

            // ストレージマネージャー初期化（IndexedDB対応）
            const storageMode = await storageManager.initialize();
            console.log(`💾 Storage initialized in ${storageMode} mode`);
            console.log('⚙️ ストレージの初期化に成功しました。');

            // プロバイダー情報読み込み
            await APIClient.loadProviders();
            console.log('🌐 LLMプロバイダーを読み込みました。');

            // 設定適用
            NavigationController.applyTheme();
            console.log('🎨 テーマとフォント設定を適用しました。');

            // イベントリスナー設定
            EventHandlers.init();
            console.log('👂 イベントハンドラーを初期化しました。');

            // ファイルリスト読み込み
            await FileManagerController.loadFileList();
            console.log('📂 ファイルリストを読み込みました。');

            // 初期メッセージ表示
            this.showWelcomeMessage(storageMode);
            console.log('💬 ウェルカムメッセージを表示しました。');

            console.log('✅ AI File Manager - Initialization complete!');

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showErrorMessage(error);
        }
    }

    static showWelcomeMessage(storageMode = 'memory') {
        setTimeout(() => {
            const providerName = AppState.availableProviders[AppState.llmProvider]?.name || AppState.llmProvider;
            const historyStatus = ConversationHistory.getHistoryStatus();
            const storageStatus = storageMode === 'indexeddb' ? '💾 IndexedDB (永続化)' : '🧠 メモリ (一時的)';

            MessageProcessor.addMessage('ai', `🎉 AI File Manager へようこそ！（IndexedDB対応版）

**🤖 現在のAI設定:**
• プロバイダー: ${providerName}
• モデル: ${AppState.llmModel}
• 会話履歴: ${historyStatus.count}件 ${historyStatus.shouldWarn ? '⚠️' : '✅'}
• データ保存: ${storageStatus}

**💾 新機能 - データ永続化:**
• ブラウザを閉じてもデータが保持されます
• 大容量ファイルの保存が可能です
• IndexedDB不対応の場合は自動でメモリモードにフォールバック

**⚡ 拡張AIコマンド:**
📝 **ファイル作成** - "新しいファイルを作って" "config.json を作成して"
📁 **ディレクトリ作成** - "docs フォルダを作って" "新しいフォルダを作成"
📖 **ファイル読み込み** - "README.md を読んで" "内容を表示して"
✏️ **ファイル編集** - "README.md を編集して" "内容を変更して"
📋 **ファイルコピー** - "ファイルをコピーして" "backup フォルダにコピー"
🔄 **ファイル移動** - "ファイルを移動して" "別のフォルダに移動"
🗑️ **ファイル削除** - "sample.txt を削除して" "不要なファイルを消して"
📋 **ファイル一覧** - "ファイル一覧を表示して" "何があるか教えて"

**🔄 一括操作:**
• **一括削除** - "全ての .txt ファイルを削除して"
• **一括コピー** - "画像ファイル全部を images フォルダにコピー"
• **一括移動** - "古いファイルを全部 archive に移動"

**📱 操作方法:**
• **複数選択** - Ctrl/Cmd + クリックで複数選択
• **長押し選択** - ファイルを長押しで操作メニュー表示
• **会話履歴管理** - 設定画面で履歴の確認・クリアが可能

**🚀 使用例:**
• "プロジェクト用の docs フォルダを作って、README.md も作成して"
• "設定ファイルconfig.jsonを作って、デフォルト値を入れて"
• "画像ファイルを全部 images フォルダに整理して"

**help** と入力すると詳細なコマンド一覧を確認できます。

さあ、永続化されたファイルシステムで自然言語でのファイル操作を試してみてください！`);
        }, 1000);
    }

    static showErrorMessage(error) {
        if (typeof window !== 'undefined' && window.MessageProcessor) {
            window.MessageProcessor.addMessage('system', `❌ 初期化エラー: ${error.message}`);
        } else {
            console.error('Failed to show error message:', error);
        }
    }
}

// DOMContentLoaded時の初期化
document.addEventListener('DOMContentLoaded', () => App.init());