/* =========================================
    状態管理
   ========================================= */

/*
## 概要
アプリケーションの様々な状態（UI状態、ファイルシステム状態、設定、会話履歴など）を一元的に管理するモジュール。`AppState` オブジェクトと `ConversationHistory` クラスを提供する。

## 主要機能
- **オブジェクト**: AppState (アプリケーションの現在の状態を保持し、更新・保存する)
- **クラス**: ConversationHistory (ユーザーとAI間の会話履歴を管理し、永続化する)
- **主要メソッド (AppState)**:
  - `setState(updates)`: AppStateのプロパティを更新し、設定をローカルストレージに保存する。
  - `saveSettings()`: 現在のAppStateの設定をローカルストレージに保存する。
- **主要メソッド (ConversationHistory)**:
  - `addExchange(userMessage, aiResponse)`: 会話のやり取りを履歴に追加し、履歴数を制限する。
  - `getHistory()`: 現在の会話履歴を返す。
  - `clearHistory()`: 会話履歴をクリアする。
  - `save()`: 会話履歴をローカルストレージに保存する。
  - `shouldWarnAboutHistory()`: 会話履歴が警告閾値を超えているか判定する。
  - `getHistoryStatus()`: 会話履歴の現在の状態（件数、最大数、警告フラグ）を返す。

## 依存関係
- **インポート**: `SystemPromptManager` (from '../prompts/prompt-manager.js')
- **エクスポート**: AppState, ConversationHistory, SystemPromptManager

## 特記事項
- 永続化: `AppState` の設定と `ConversationHistory` はローカルストレージに保存され、アプリケーションを再起動しても状態が維持される。
- 状態の一元管理: アプリケーションのほぼ全ての動的なデータがこのモジュールで管理される。
- 循環依存の回避: `MessageProcessor` との循環依存を避けるため、`MessageProcessor` は `window` オブジェクト経由で参照される場合がある。
- プロンプト管理: `SystemPromptManager` は別のモジュールに移動されたが、後方互換性のためここからもエクスポートされる。
*/

// アプリケーション状態管理
export const AppState = {
    // 基本状態
    currentPath: '/workspace',
    selectedFiles: [], // 複数選択対応
    currentEditingFile: null,

    // UI状態
    isSelectionMode: false,
    isMultiSelectMode: false, // 複数選択モード
    isFileViewMode: false,
    isEditMode: false,
    isChatOpen: false,
    isLoading: false,
    isDiffMode: false, // 差分表示モード
    isFabMenuOpen: false, // FABメニュー開閉状態
    isContentModified: false, // コンテンツ変更状態

    // 差分関連状態
    currentDiff: null, // 現在の差分データ
    originalContent: null, // 編集前の内容

    // システムプロンプト関連状態
    isPromptDrawerOpen: false, // ドロワーメニュー開閉状態
    currentPromptSection: 'create', // 現在のセクション（create, manage, workflow）
    isCustomPromptEnabled: false, // カスタムプロンプト有効/無効
    selectedPromptId: null, // 選択されたプロンプトID
    customPrompts: [], // カスタムプロンプト一覧（キャッシュ）

    // 設定
    theme: localStorage.getItem('theme') || 'dark',
    fontSize: localStorage.getItem('fontSize') || 'medium',
    llmProvider: localStorage.getItem('llmProvider') || 'claude',
    llmModel: localStorage.getItem('llmModel') || '',

    // LLMプロバイダー情報
    availableProviders: {},

    // 状態更新メソッド
    setState(updates) {
        Object.assign(this, updates);
        this.saveSettings();
    },

    saveSettings() {
        localStorage.setItem('theme', this.theme);
        localStorage.setItem('fontSize', this.fontSize);
        localStorage.setItem('llmProvider', this.llmProvider);
        localStorage.setItem('llmModel', this.llmModel);
        // システムプロンプト設定も保存
        localStorage.setItem('isCustomPromptEnabled', this.isCustomPromptEnabled);
        localStorage.setItem('selectedPromptId', this.selectedPromptId || '');
    }
};

// 会話履歴管理クラス
export class ConversationHistory {
    static maxHistory = 15; // 最大履歴数
    static warningThreshold = 10; // 警告表示の閾値
    
    static history = JSON.parse(localStorage.getItem('conversationHistory') || '[]');

    static addExchange(userMessage, aiResponse) {
        this.history.push({
            user: userMessage,
            ai: aiResponse,
            timestamp: new Date().toISOString()
        });

        // 履歴制限
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }

        this.save();
    }

    static getHistory() {
        return this.history;
    }

    static clearHistory() {
        this.history = [];
        this.save();
        // MessageProcessorは循環依存を避けるため、グローバル参照
        if (typeof window !== 'undefined' && window.MessageProcessor) {
            window.MessageProcessor.addMessage('system', '🗑️ 会話履歴をクリアしました。新しい会話を開始してください。');
        }
    }

    static save() {
        localStorage.setItem('conversationHistory', JSON.stringify(this.history));
    }

    static shouldWarnAboutHistory() {
        return this.history.length >= this.warningThreshold;
    }

    static getHistoryStatus() {
        return {
            count: this.history.length,
            max: this.maxHistory,
            shouldWarn: this.shouldWarnAboutHistory()
        };
    }
}

// SystemPromptManager は prompts/prompt-manager.js に移動されました
// 後方互換性のため、こちらからもエクスポート
export { SystemPromptManager } from '../prompts/prompt-manager.js';

// 初期化時にプロンプト関連設定を読み込み
document.addEventListener('DOMContentLoaded', () => {
    const isCustomPromptEnabled = localStorage.getItem('isCustomPromptEnabled') === 'true';
    const selectedPromptId = localStorage.getItem('selectedPromptId') || null;
    
    AppState.setState({
        isCustomPromptEnabled: isCustomPromptEnabled,
        selectedPromptId: selectedPromptId,
        // SystemPromptManagerは遅延読み込みされるため、初期化時は空配列
        customPrompts: []
    });
    
    // SystemPromptManagerが利用可能になったらキャッシュを更新
    setTimeout(() => {
        if (window.SystemPromptManager || typeof SystemPromptManager !== 'undefined') {
            const SystemPrompt = window.SystemPromptManager || SystemPromptManager;
            AppState.setState({
                customPrompts: SystemPrompt.getAllPrompts()
            });
        }
    }, 100);
});