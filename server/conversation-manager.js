/* =========================================
    会話履歴・コンテキスト管理
   ========================================= */

/*
## 概要
会話履歴の管理、コンテキスト情報の整理、セッション状態の追跡を行う責任を持つ。

## 責任
- 会話履歴の管理と最適化
- コンテキスト情報の整理と拡張
- セッション状態の追跡
- メモリ使用量の最適化
*/

export class ConversationManager {
    constructor() {
        this.maxHistoryItems = 15;
        this.maxHistoryLength = 10000; // 文字数制限
        this.contextDefaults = {
            currentPath: '/workspace',
            fileList: [],
            currentFile: null,
            openFileInfo: null
        };
    }

    /**
     * コンテキストを準備・拡張
     */
    async prepareContext(context = {}) {
        // デフォルト値との統合
        const enrichedContext = {
            ...this.contextDefaults,
            ...context
        };

        // 会話履歴の最適化
        enrichedContext.conversationHistory = this._optimizeConversationHistory(
            enrichedContext.conversationHistory || []
        );

        // ファイル一覧の整理
        enrichedContext.fileList = this._normalizeFileList(enrichedContext.fileList);

        // カスタムプロンプトの状態確認
        enrichedContext.customPrompt = this._validateCustomPrompt(enrichedContext.customPrompt);

        // コンテキストのメタデータを追加
        enrichedContext.metadata = this._generateContextMetadata(enrichedContext);

        return enrichedContext;
    }

    /**
     * 新しいチャットを提案すべきかどうかを判定
     */
    shouldSuggestNewChat(context) {
        const history = context.conversationHistory || [];
        
        // 履歴数ベースの判定
        if (history.length >= this.maxHistoryItems) {
            return true;
        }

        // 文字数ベースの判定
        const totalLength = this._calculateTotalHistoryLength(history);
        if (totalLength >= this.maxHistoryLength) {
            return true;
        }

        // コンテキストスイッチの検出
        if (this._detectContextSwitch(history)) {
            return true;
        }

        return false;
    }

    /**
     * 会話履歴の最適化
     */
    _optimizeConversationHistory(history) {
        if (!Array.isArray(history)) {
            return [];
        }

        // 履歴数の制限
        let optimizedHistory = history.slice(-this.maxHistoryItems);

        // 文字数制限の適用
        const totalLength = this._calculateTotalHistoryLength(optimizedHistory);
        if (totalLength > this.maxHistoryLength) {
            optimizedHistory = this._truncateHistoryByLength(optimizedHistory);
        }

        // 重複の除去
        optimizedHistory = this._removeDuplicateHistory(optimizedHistory);

        // 不完全な履歴エントリの除去
        optimizedHistory = this._removeIncompleteHistory(optimizedHistory);

        return optimizedHistory;
    }

    /**
     * ファイル一覧の正規化
     */
    _normalizeFileList(fileList) {
        if (!Array.isArray(fileList)) {
            return [];
        }

        return fileList
            .filter(file => file && typeof file === 'string')
            .map(file => file.trim())
            .filter(file => file.length > 0)
            .slice(0, 1000); // 上限設定
    }

    /**
     * カスタムプロンプトの検証
     */
    _validateCustomPrompt(customPrompt) {
        if (!customPrompt || typeof customPrompt !== 'object') {
            return null;
        }

        return {
            enabled: !!customPrompt.enabled,
            name: customPrompt.name || 'Unknown',
            content: customPrompt.content || '',
            description: customPrompt.description || ''
        };
    }

    /**
     * コンテキストメタデータの生成
     */
    _generateContextMetadata(context) {
        return {
            timestamp: new Date().toISOString(),
            historyCount: (context.conversationHistory || []).length,
            fileCount: (context.fileList || []).length,
            hasCustomPrompt: !!(context.customPrompt?.enabled),
            hasOpenFile: !!context.currentFile,
            contextSize: this._calculateContextSize(context)
        };
    }

    /**
     * 会話履歴の総文字数を計算
     */
    _calculateTotalHistoryLength(history) {
        return history.reduce((total, entry) => {
            const userLength = entry.user ? entry.user.length : 0;
            const aiLength = entry.ai ? entry.ai.length : 0;
            return total + userLength + aiLength;
        }, 0);
    }

    /**
     * 文字数制限による履歴の切り詰め
     */
    _truncateHistoryByLength(history) {
        const truncated = [];
        let currentLength = 0;

        // 新しい履歴から順に追加
        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i];
            const entryLength = (entry.user?.length || 0) + (entry.ai?.length || 0);
            
            if (currentLength + entryLength <= this.maxHistoryLength) {
                truncated.unshift(entry);
                currentLength += entryLength;
            } else {
                break;
            }
        }

        return truncated;
    }

    /**
     * 重複履歴の除去
     */
    _removeDuplicateHistory(history) {
        const seen = new Set();
        return history.filter(entry => {
            const key = `${entry.user || ''}_${entry.ai || ''}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 不完全な履歴エントリの除去
     */
    _removeIncompleteHistory(history) {
        return history.filter(entry => {
            // ユーザーメッセージは必須
            if (!entry.user || entry.user.trim().length === 0) {
                return false;
            }
            
            // AI応答が極端に短い場合は除去
            if (entry.ai && entry.ai.trim().length < 3) {
                return false;
            }

            return true;
        });
    }

    /**
     * コンテキストスイッチの検出
     */
    _detectContextSwitch(history) {
        if (history.length < 3) {
            return false;
        }

        // 最近の会話のトピックを分析
        const recentMessages = history.slice(-3).map(entry => entry.user);
        
        // 簡単なキーワードベースの分析
        const keywords = [
            '新しい', '別の', '違う', 'change', 'switch', '切り替え', 
            'help', 'ヘルプ', '使い方', '機能'
        ];

        const lastMessage = recentMessages[recentMessages.length - 1].toLowerCase();
        return keywords.some(keyword => lastMessage.includes(keyword));
    }

    /**
     * コンテキストサイズの計算（概算）
     */
    _calculateContextSize(context) {
        let size = 0;
        
        // 基本フィールドのサイズ
        size += (context.currentPath || '').length;
        size += JSON.stringify(context.fileList || []).length;
        size += (context.currentFile || '').length;
        size += (context.openFileInfo || '').length;
        
        // 会話履歴のサイズ
        size += this._calculateTotalHistoryLength(context.conversationHistory || []);
        
        // カスタムプロンプトのサイズ
        if (context.customPrompt) {
            size += (context.customPrompt.content || '').length;
            size += (context.customPrompt.name || '').length;
            size += (context.customPrompt.description || '').length;
        }

        return size;
    }

    /**
     * 履歴に新しいエントリを追加
     */
    addHistoryEntry(context, userMessage, aiResponse) {
        const history = context.conversationHistory || [];
        
        const newEntry = {
            user: userMessage,
            ai: aiResponse,
            timestamp: new Date().toISOString()
        };

        history.push(newEntry);
        context.conversationHistory = this._optimizeConversationHistory(history);
        
        return context;
    }

    /**
     * 履歴をクリア
     */
    clearHistory(context) {
        context.conversationHistory = [];
        return context;
    }

    /**
     * 統計情報の取得
     */
    getHistoryStats(context) {
        const history = context.conversationHistory || [];
        
        return {
            totalEntries: history.length,
            totalLength: this._calculateTotalHistoryLength(history),
            shouldSuggestNewChat: this.shouldSuggestNewChat(context),
            oldestEntry: history.length > 0 ? history[0].timestamp : null,
            newestEntry: history.length > 0 ? history[history.length - 1].timestamp : null
        };
    }

    /**
     * 設定の取得/更新
     */
    getConfiguration() {
        return {
            maxHistoryItems: this.maxHistoryItems,
            maxHistoryLength: this.maxHistoryLength,
            contextDefaults: { ...this.contextDefaults }
        };
    }

    updateConfiguration(config) {
        if (config.maxHistoryItems && config.maxHistoryItems > 0) {
            this.maxHistoryItems = Math.min(config.maxHistoryItems, 50); // 上限設定
        }
        
        if (config.maxHistoryLength && config.maxHistoryLength > 0) {
            this.maxHistoryLength = Math.min(config.maxHistoryLength, 50000); // 上限設定
        }

        if (config.contextDefaults && typeof config.contextDefaults === 'object') {
            this.contextDefaults = { ...this.contextDefaults, ...config.contextDefaults };
        }
    }

    /**
     * マネージャーの状態取得
     */
    getStatus() {
        return {
            maxHistoryItems: this.maxHistoryItems,
            maxHistoryLength: this.maxHistoryLength,
            contextDefaults: this.contextDefaults,
            isHealthy: true,
            lastActivity: new Date().toISOString()
        };
    }
}