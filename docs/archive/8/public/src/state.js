/* =========================================
    状態管理
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

// システムプロンプト管理クラス
export class SystemPromptManager {
    static STORAGE_KEY = 'ai-file-manager-system-prompts';

    // 全プロンプトを取得
    static getAllPrompts() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load prompts:', error);
            return [];
        }
    }

    // プロンプトを保存
    static savePrompt(promptData) {
        try {
            const prompts = this.getAllPrompts();
            const newPrompt = {
                id: Date.now().toString(),
                name: promptData.name,
                content: promptData.content,
                description: promptData.description || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            prompts.push(newPrompt);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prompts));
            
            // キャッシュ更新
            AppState.setState({ customPrompts: prompts });
            
            return newPrompt;
        } catch (error) {
            console.error('Failed to save prompt:', error);
            throw error;
        }
    }

    // プロンプトを更新
    static updatePrompt(id, updates) {
        try {
            const prompts = this.getAllPrompts();
            const index = prompts.findIndex(p => p.id === id);
            if (index === -1) {
                throw new Error('プロンプトが見つかりません');
            }
            
            prompts[index] = {
                ...prompts[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prompts));
            AppState.setState({ customPrompts: prompts });
            
            return prompts[index];
        } catch (error) {
            console.error('Failed to update prompt:', error);
            throw error;
        }
    }

    // プロンプトを削除
    static deletePrompt(id) {
        try {
            const prompts = this.getAllPrompts();
            const filtered = prompts.filter(p => p.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            
            // 選択されているプロンプトが削除された場合はリセット
            if (AppState.selectedPromptId === id) {
                AppState.setState({ 
                    selectedPromptId: null,
                    isCustomPromptEnabled: false
                });
            }
            
            AppState.setState({ customPrompts: filtered });
            return true;
        } catch (error) {
            console.error('Failed to delete prompt:', error);
            throw error;
        }
    }

    // IDでプロンプトを取得
    static getPromptById(id) {
        const prompts = this.getAllPrompts();
        return prompts.find(p => p.id === id) || null;
    }

    // 選択されたプロンプトを取得
    static getSelectedPrompt() {
        if (!AppState.selectedPromptId) return null;
        return this.getPromptById(AppState.selectedPromptId);
    }

    // プロンプト選択
    static selectPrompt(id) {
        const prompt = this.getPromptById(id);
        if (prompt) {
            AppState.setState({ 
                selectedPromptId: id,
                isCustomPromptEnabled: true 
            });
            return prompt;
        }
        return null;
    }

    // プロンプト選択解除
    static deselectPrompt() {
        AppState.setState({ 
            selectedPromptId: null,
            isCustomPromptEnabled: false 
        });
    }

    // カスタムプロンプトの有効/無効切り替え
    static toggleCustomPrompt() {
        const newEnabled = !AppState.isCustomPromptEnabled;
        AppState.setState({ isCustomPromptEnabled: newEnabled });
        
        // 有効になったが選択されたプロンプトがない場合は警告
        if (newEnabled && !AppState.selectedPromptId) {
            console.warn('カスタムプロンプトが有効になりましたが、プロンプトが選択されていません');
            return false;
        }
        
        return newEnabled;
    }

    // プロンプトキャッシュを更新
    static refreshCache() {
        const prompts = this.getAllPrompts();
        AppState.setState({ customPrompts: prompts });
        return prompts;
    }
}

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

// 初期化時にプロンプト関連設定を読み込み
document.addEventListener('DOMContentLoaded', () => {
    const isCustomPromptEnabled = localStorage.getItem('isCustomPromptEnabled') === 'true';
    const selectedPromptId = localStorage.getItem('selectedPromptId') || null;
    
    AppState.setState({
        isCustomPromptEnabled: isCustomPromptEnabled,
        selectedPromptId: selectedPromptId,
        customPrompts: SystemPromptManager.getAllPrompts()
    });
});