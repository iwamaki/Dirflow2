/* =========================================
   AI File Manager - 状態管理 (ES6 Module)
   ========================================= */

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

    // 差分関連状態
    currentDiff: null, // 現在の差分データ
    originalContent: null, // 編集前の内容

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
    }
};

// 会話履歴管理クラス
export class ConversationHistory {
    static maxHistory = 30; // 最大履歴数
    static warningThreshold = 15; // 警告表示の閾値
    
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
        // MessageHandler.addMessageはcircular dependencyを避けるため、ここでは直接実行
        if (typeof window !== 'undefined' && window.MessageHandler) {
            window.MessageHandler.addMessage('system', '🗑️ 会話履歴をクリアしました。新しい会話を開始してください。');
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