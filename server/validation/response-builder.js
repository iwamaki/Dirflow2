/* =========================================
    レスポンス構築・フォーマット
   ========================================= */

/*
## 概要
APIレスポンスの構築、エラーハンドリング、フォールバック処理を行う責任を持つ。

## 責任
- 成功レスポンスの構築
- エラーレスポンスの整形
- フォールバック処理
- レスポンス形式の統一
*/

import { getMockResponse } from '../utils/response-utils.js';

export class ResponseBuilder {
    constructor() {
        this.defaultResponseFormat = {
            message: '',
            commands: [],
            provider: '',
            model: '',
            timestamp: '',
            parseSuccess: false,
            warning: null,
            error: null
        };
    }

    /**
     * 成功レスポンスの構築
     */
    buildSuccessResponse(data) {
        const response = {
            ...this.defaultResponseFormat,
            ...data,
            timestamp: new Date().toISOString(),
            parseSuccess: data.parseSuccess !== false,
        };

        // メッセージの最終調整
        response.message = this._enhanceMessage(response.message, data);

        // メタデータの追加
        response.metadata = this._buildMetadata(data);

        // ログ出力
        this._logResponseInfo(response);

        return response;
    }

    /**
     * エラーレスポンスの構築
     */
    buildErrorResponse(error, provider, model, originalMessage, originalContext) {
        console.error(`❌ Building error response for ${provider}:`, error);

        // フォールバック応答の取得
        const fallbackResult = getMockResponse(originalMessage, originalContext);

        const errorResponse = {
            ...this.defaultResponseFormat,
            message: this._buildErrorMessage(fallbackResult.message, error),
            commands: fallbackResult.commands || [],
            provider: provider || 'unknown',
            model: model || 'unknown',
            timestamp: new Date().toISOString(),
            parseSuccess: false,
            warning: 'API接続に問題があります。設定を確認してください。',
            error: error.message || 'Unknown error',
            errorType: this._classifyError(error),
            shouldSuggestNewChat: false,
            customPromptUsed: !!(originalContext?.customPrompt?.enabled),
            fallbackMode: true
        };

        // メタデータの追加
        errorResponse.metadata = this._buildErrorMetadata(error, originalContext);

        // ログ出力
        this._logErrorInfo(errorResponse);

        return errorResponse;
    }

    /**
     * フォールバックレスポンスの構築
     */
    buildFallbackResponse(originalMessage, context, reason = 'unknown') {
        const fallbackResult = getMockResponse(originalMessage, context);

        return {
            ...this.defaultResponseFormat,
            message: `${fallbackResult.message}\n\n(フォールバック応答: ${reason})`,
            commands: fallbackResult.commands || [],
            provider: 'fallback',
            model: 'mock',
            timestamp: new Date().toISOString(),
            parseSuccess: true,
            warning: `フォールバック応答が使用されました: ${reason}`,
            fallbackMode: true,
            fallbackReason: reason,
            metadata: this._buildFallbackMetadata(context, reason)
        };
    }

    /**
     * メッセージの拡張（新しいチャット提案など）
     */
    _enhanceMessage(originalMessage, data) {
        let enhancedMessage = originalMessage || '';

        // 新しいチャット提案の追加
        if (data.shouldSuggestNewChat && !enhancedMessage.includes('新しいチャット')) {
            enhancedMessage += '\n\n💡 会話が長くなってきました。新しい話題であれば、新しいチャットの開始をお勧めします。';
        }

        // カスタムプロンプト使用の表示
        if (data.customPromptUsed && data.customPromptName) {
            enhancedMessage += `\n\n🧠 カスタムプロンプト「${data.customPromptName}」を使用して応答しました。`;
        }

        // エージェント情報の追加
        if (data.agentName && data.agentUsed) {
            enhancedMessage += `\n\n🤖 ${data.agentName} が処理を担当しました。`;
        }

        return enhancedMessage;
    }

    /**
     * エラーメッセージの構築
     */
    _buildErrorMessage(fallbackMessage, error) {
        let errorMessage = fallbackMessage || '申し訳ございません。処理中にエラーが発生しました。';
        
        // エラータイプに応じてメッセージを調整
        const errorType = this._classifyError(error);
        
        switch (errorType) {
            case 'api_key_missing':
                errorMessage += '\n\n🔑 APIキーが設定されていません。環境設定を確認してください。';
                break;
            case 'rate_limit':
                errorMessage += '\n\n⏱️ API利用制限に達しました。しばらく待ってから再試行してください。';
                break;
            case 'network_error':
                errorMessage += '\n\n🌐 ネットワークエラーが発生しました。接続を確認してください。';
                break;
            case 'server_error':
                errorMessage += '\n\n🔧 サーバーエラーが発生しました。しばらく待ってから再試行してください。';
                break;
            default:
                errorMessage += `\n\n⚠️ ${error.message || '不明なエラーが発生しました。'}`;
        }

        errorMessage += '\n\n(フォールバック応答: API接続エラーのため)';
        
        return errorMessage;
    }

    /**
     * エラーの分類
     */
    _classifyError(error) {
        const message = error.message?.toLowerCase() || '';
        
        if (message.includes('api_key') || message.includes('authentication')) {
            return 'api_key_missing';
        }
        
        if (message.includes('rate limit') || message.includes('429')) {
            return 'rate_limit';
        }
        
        if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
            return 'network_error';
        }
        
        if (message.includes('500') || message.includes('502') || message.includes('503')) {
            return 'server_error';
        }
        
        return 'unknown';
    }

    /**
     * メタデータの構築
     */
    _buildMetadata(data) {
        return {
            responseTime: new Date().toISOString(),
            commandCount: (data.commands || []).length,
            hasWarning: !!data.warning,
            responseSource: data.agentUsed || 'unknown',
            contextSize: this._estimateContextSize(data),
            customPromptUsed: !!data.customPromptUsed,
            fallbackMode: !!data.fallbackMode,
            routing: data.routing || null
        };
    }

    /**
     * エラーメタデータの構築
     */
    _buildErrorMetadata(error, context) {
        return {
            errorTime: new Date().toISOString(),
            errorType: this._classifyError(error),
            errorMessage: error.message || 'Unknown error',
            contextPresent: !!context,
            customPromptUsed: !!(context?.customPrompt?.enabled),
            fallbackMode: true,
            recovery: 'mock_response'
        };
    }

    /**
     * フォールバックメタデータの構築
     */
    _buildFallbackMetadata(context, reason) {
        return {
            fallbackTime: new Date().toISOString(),
            fallbackReason: reason,
            contextPresent: !!context,
            customPromptUsed: !!(context?.customPrompt?.enabled),
            recovery: 'mock_response'
        };
    }

    /**
     * コンテキストサイズの概算
     */
    _estimateContextSize(data) {
        let size = 0;
        
        if (data.message) size += data.message.length;
        if (data.rawResponse) size += data.rawResponse.length;
        if (data.commands) size += JSON.stringify(data.commands).length;
        
        return size;
    }

    /**
     * レスポンス情報のログ出力
     */
    _logResponseInfo(response) {
        const { message, commands, provider, model, agentUsed, parseSuccess } = response;
        
        console.log('✅ Response built successfully:', {
            provider,
            model,
            agentUsed,
            commandCount: commands.length,
            parseSuccess,
            messageLength: message.length,
            timestamp: response.timestamp
        });

        if (response.warning) {
            console.warn('⚠️ Response warning:', response.warning);
        }
    }

    /**
     * エラー情報のログ出力
     */
    _logErrorInfo(errorResponse) {
        console.error('❌ Error response built:', {
            provider: errorResponse.provider,
            errorType: errorResponse.errorType,
            fallbackMode: errorResponse.fallbackMode,
            timestamp: errorResponse.timestamp
        });
    }

    /**
     * レスポンス統計の取得
     */
    getResponseStats() {
        return {
            defaultFormat: Object.keys(this.defaultResponseFormat),
            supportedErrorTypes: ['api_key_missing', 'rate_limit', 'network_error', 'server_error', 'unknown'],
            enhancementFeatures: ['newChatSuggestion', 'customPromptInfo', 'agentInfo'],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * レスポンス形式の検証
     */
    validateResponseFormat(response) {
        const requiredFields = ['message', 'commands', 'provider', 'model', 'timestamp'];
        const missingFields = requiredFields.filter(field => !(field in response));
        
        if (missingFields.length > 0) {
            throw new Error(`Invalid response format: missing fields ${missingFields.join(', ')}`);
        }
        
        if (!Array.isArray(response.commands)) {
            throw new Error('Invalid response format: commands must be an array');
        }
        
        return true;
    }
}