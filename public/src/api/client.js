/* =========================================
    API通信クライアント
   ========================================= */

/*
## 概要
LLMプロバイダーとのAPI通信を管理するクライアントクラス

## 主要機能
- **クラス**: APIClient (静的メソッドのみ)
- **主要メソッド**:
  - `sendChatMessage(message, context)`: チャットメッセージを送信し、会話履歴を管理
  - `loadProviders()`: 利用可能なLLMプロバイダーを取得し、AppStateに設定
  - `checkHealth()`: APIのヘルスチェックを実行

## 依存関係
- **インポート**:
  - `AppState` (from '../core/state.js'): LLMプロバイダーやモデルの状態管理 
   - 使用メソッド: setState, get llmProvider, llmModel
  - `ConversationHistory` (from '../core/state.js'): 会話履歴の管理
   - 使用メソッド: getHistory, addExchange
- **エクスポート**: APIClientクラス

## 特記事項
- エラーハンドリング: fetch失敗時にコンソールエラー出力と例外スロー
- 状態同期: AppStateとConversationHistoryを自動更新
- 非同期処理: すべてのメソッドがPromiseベース
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