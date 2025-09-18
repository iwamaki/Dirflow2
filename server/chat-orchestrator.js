/* =========================================
    チャット処理オーケストレーター
   ========================================= */

/*
## 概要
チャット処理の全体フローを管理し、各専門サービスを協調させる責任を持つ。
server.jsから呼ばれるメインエントリーポイント。

## 責任
- チャット処理フローの管理
- サービス間の協調
- エラー時のフォールバック制御
- レスポンス統合
*/

import { AgentDispatcher } from './agent-dispatcher.js';
import { ConversationManager } from './conversation-manager.js';
import { ContextBuilder } from './context-builder.js';
import { CommandValidator } from './command-validator.js';

export class ChatOrchestrator {
    constructor() {
        this.agentDispatcher = new AgentDispatcher();
        this.conversationManager = new ConversationManager();
        this.contextBuilder = new ContextBuilder();
        this.commandValidator = new CommandValidator();
    }

    /**
     * メインのチャット処理エントリーポイント
     */
    async processChat(message, provider = 'claude', model, context = {}) {
        try {
            // 1. 入力バリデーション
            this._validateInput(message, provider, model, context);

            // 2. 会話コンテキストの準備
            const enrichedContext = await this.conversationManager.prepareContext(context);
            
            // 3. 新しいチャット提案の判定
            const shouldSuggestNewChat = this.conversationManager.shouldSuggestNewChat(enrichedContext);

            // 4. エージェント処理の実行
            const agentResult = await this.agentDispatcher.dispatch(
                message, 
                provider, 
                model, 
                enrichedContext
            );

            // 5. コマンドの検証
            const validatedCommands = await this._validateCommands(agentResult.commands);

            // 6. 最終レスポンスの構築
            return this.contextBuilder.buildSuccessResponse({
                ...agentResult,
                commands: validatedCommands,
                shouldSuggestNewChat,
                historyCount: enrichedContext.conversationHistory?.length || 0,
                customPromptUsed: !!(enrichedContext.customPrompt?.enabled)
            });

        } catch (error) {
            console.error('❌ Chat Orchestrator Error:', error);
            
            // エラー時のフォールバック処理
            return this.contextBuilder.buildErrorResponse(
                error, 
                provider, 
                model, 
                message, 
                context
            );
        }
    }

    /**
     * 入力パラメータの基本バリデーション
     */
    _validateInput(message, provider, model, context) {
        if (!message || typeof message !== 'string') {
            throw new Error('メッセージが無効です');
        }

        if (provider && typeof provider !== 'string') {
            throw new Error('プロバイダーは文字列である必要があります');
        }

        if (model && typeof model !== 'string') {
            throw new Error('モデルは文字列である必要があります');
        }

        if (context && typeof context !== 'object') {
            throw new Error('コンテキストはオブジェクトである必要があります');
        }
    }

    /**
     * コマンド配列の検証
     */
    async _validateCommands(commands) {
        if (!Array.isArray(commands)) {
            return [];
        }

        const validatedCommands = [];
        for (const command of commands) {
            try {
                if (this.commandValidator.validate(command)) {
                    validatedCommands.push(command);
                }
            } catch (validationError) {
                console.warn('❌ Command validation failed:', validationError.message);
                // 無効なコマンドはスキップして処理を継続
            }
        }

        return validatedCommands;
    }

    /**
     * 利用可能なエージェント一覧を取得
     */
    getAvailableAgents() {
        return this.agentDispatcher.getAvailableAgents();
    }

    /**
     * システム状態の取得
     */
    getSystemStatus() {
        return {
            agents: this.agentDispatcher.getAvailableAgents(),
            conversationManager: this.conversationManager.getStatus(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 検索履歴を取得
     */
    getSearchHistory(limit = 10) {
        return this.agentDispatcher.getSearchHistory(limit);
    }

    /**
     * 検索履歴をクリア
     */
    clearSearchHistory() {
        return this.agentDispatcher.clearSearchHistory();
    }

    /**
     * 検索サービスの状態を取得
     */
    getSearchServiceStatus() {
        return this.agentDispatcher.getSearchServiceStatus();
    }
}