/* =========================================
    アプリケーション初期化
   ========================================= */

/*
## 概要
AI File Managerアプリケーションの初期化と起動を担当するクラス。各種コンポーネントの初期設定、イベントリスナーの登録、初期メッセージの表示を行う。

## 主要機能
- **クラス**: App (静的メソッドのみ)
- **主要メソッド**:
  - `init()`: アプリケーションの初期化処理を実行。プロバイダーの読み込み、テーマ適用、イベントリスナー設定、ファイルリスト読み込み、ウェルカムメッセージ表示を行う。
  - `showWelcomeMessage()`: アプリケーション起動時のウェルカムメッセージをAI応答形式で表示。現在のAI設定や利用可能なコマンドの概要をユーザーに伝える。
  - `showErrorMessage(error)`: 初期化中に発生したエラーメッセージをUIに表示。

## 依存関係
- **インポート**:
  - `AppState`, `ConversationHistory` (from './state.js'): アプリケーションの状態管理と会話履歴。
  - `APIClient` (from '../api/client.js'): API通信クライアント。
  - `NavigationController` (from '../ui/navigation.js'): UIナビゲーションとテーマ適用。
  - `FileManagerController` (from '../file-system/file-manager.js'): ファイルシステム操作。
  - `MessageProcessor` (from '../api/message-processor.js'): メッセージの表示と処理。
  - `EventHandlers` (from '../events/event-handlers.js'): イベントリスナーの登録。
- **エクスポート**: Appクラス

## 特記事項
- DOMContentLoadedイベント: DOMの読み込み完了後に `App.init()` が自動的に実行される。
- エラーハンドリング: 初期化失敗時にエラーメッセージを表示し、コンソールにも出力。
- ユーザーガイダンス: ウェルカムメッセージを通じて、アプリケーションの機能と使い方をユーザーに提示。
*/

import { AppState, ConversationHistory } from './state.js';
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

            // プロバイダー情報読み込み
            await APIClient.loadProviders();

            // 設定適用
            NavigationController.applyTheme();

            // イベントリスナー設定
            EventHandlers.init();

            // ファイルリスト読み込み
            await FileManagerController.loadFileList();

            // 初期メッセージ表示
            this.showWelcomeMessage();

            console.log('✅ AI File Manager - Initialization complete!');

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showErrorMessage(error);
        }
    }

    static showWelcomeMessage() {
        setTimeout(() => {
            const providerName = AppState.availableProviders[AppState.llmProvider]?.name || AppState.llmProvider;
            const historyStatus = ConversationHistory.getHistoryStatus();
            
            MessageProcessor.addMessage('ai', `🎉 AI File Managerへようこそ！

**🤖 現在のAI設定:**
• プロバイダー: ${providerName}
• モデル: ${AppState.llmModel}
• 会話履歴: ${historyStatus.count}件 ${historyStatus.shouldWarn ? '⚠️' : '✅'}

**⚡ 新機能 - 拡張AIコマンド:**
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

さあ、さらに進化した自然言語でファイル操作を試してみてください！`);
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