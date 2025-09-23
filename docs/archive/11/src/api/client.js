/* =========================================
    API通信クライアント
   ========================================= */

/*
## 概要
LLMプロバイダーとのAPI通信を管理するクライアントクラス。

## 責任
- チャットメッセージの送信
- 利用可能なLLMプロバイダーの取得と状態管理
- APIのヘルスチェック
*/
import { AppState, ConversationHistory } from '../core/state.js';

// API通信クラス
export class APIClient {
    
    static async sendChatMessage(message, context = {}) {
        try {
            // 会話履歴をコンテキストに追加
            context.conversationHistory = ConversationHistory.getHistory();
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    provider: AppState.llmProvider,
                    model: AppState.llmModel,
                    context: context
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // 会話履歴に追加
            ConversationHistory.addExchange(message, data.message);
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // 利用可能なLLMプロバイダーを取得
    static async loadProviders() {
        try {
            const response = await fetch('/api/llm-providers');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const providers = await response.json();
            AppState.setState({ availableProviders: providers });
            
            // デフォルトモデルの設定
            if (!AppState.llmModel && providers[AppState.llmProvider]) {
                AppState.setState({ 
                    llmModel: providers[AppState.llmProvider].defaultModel 
                });
            }
            
            return providers;
        } catch (error) {
            console.error('Failed to load providers:', error);
            return {};
        }
    }

    // ヘルスチェック 
    static async checkHealth() {
        try {
            const response = await fetch('/api/health');
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', providers: {} };
        }
    }
}