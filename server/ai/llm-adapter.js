/* =========================================
    LLM API統一インターフェース
   ========================================= */

/*
## 概要
すべてのLLMプロバイダーの差異を吸収し、統一されたインターフェースを提供する責任を持つ。

## 責任
- LLM API呼び出しの統一化
- プロバイダー間の差異の吸収
- API エラーハンドリング
- プロンプト形式の最適化
*/

import { createPromptBuilder, logPromptDebugInfo } from './prompt-builder.js';

// LLM Providers Configuration
export const LLM_PROVIDERS = {
    claude: {
        name: 'Claude',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        models: [
            'claude-3-haiku-20240307',
            'claude-3-5-haiku-20241022',
            'claude-sonnet-4-20250514',
            'claude-opus-4-1-20250805'
        ],
        defaultModel: 'claude-3-5-haiku-20241022'
    },
    openai: {
        name: 'OpenAI GPT',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        models: [
            'gpt-4.1-mini',
            'gpt-4',
            'gpt-4-turbo'
        ],
        defaultModel: 'gpt-4'
    },
    gemini: {
        name: 'Google Gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: [
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash',
            'gemini-2.5-pro'
        ],
        defaultModel: 'gemini-2.5-flash'
    },
    local: {
        name: 'Local LLM',
        apiUrl: 'http://localhost:11434/api/chat',
        models: [
            'phi3:latest',
            'llama3:latest',
            'gemma3:4b',
            'gpt-oss:20b'
        ],
        defaultModel: 'phi3:latest'
    }
};

export class LLMAdapter {
    constructor() {
        this.providers = LLM_PROVIDERS;
    }

    /**
     * 統一されたLLM呼び出しインターフェース
     */
    async callLLM(message, provider = 'claude', model, context = {}) {
        // プロバイダーの検証
        this._validateProvider(provider);

        // モデルのデフォルト設定
        const selectedModel = model || this.providers[provider].defaultModel;

        try {
            console.log(`🤖 LLM Adapter: Calling ${provider} with model ${selectedModel}`);

            // プロバイダー別のAPI呼び出し
            let response;
            switch (provider) {
                case 'claude':
                    response = await this._callClaudeAPI(message, selectedModel, context);
                    break;
                case 'openai':
                    response = await this._callOpenAIAPI(message, selectedModel, context);
                    break;
                case 'gemini':
                    response = await this._callGeminiAPI(message, selectedModel, context);
                    break;
                case 'local':
                    response = await this._callLocalLLMAPI(message, selectedModel, context);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }

            console.log(`✅ LLM Adapter: Successfully received response from ${provider}`);
            console.log(`--- ${provider.toUpperCase()} LLM Response ---`);
            console.log(response);
            return response;

        } catch (error) {
            console.error(`❌ LLM Adapter: Error calling ${provider}:`, error);
            throw new Error(`${provider} API error: ${error.message}`);
        }
    }

    /**
     * プロバイダーの妥当性検証
     */
    _validateProvider(provider) {
        if (!provider || !this.providers[provider]) {
            throw new Error(`Unknown provider: ${provider}`);
        }
    }

    /**
     * Claude API呼び出し
     */
    async _callClaudeAPI(message, model, context) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY is not configured');
        }

        const promptBuilder = createPromptBuilder()
            .setCustomPrompt(context.customPrompt)
            .setContext(context)
            .setConversationHistory(context.conversationHistory)
            .setUserMessage(message);
        
        const promptData = promptBuilder.buildForProvider('claude');
        logPromptDebugInfo(promptData, 'claude');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2048,
                messages: promptData.messages,
                system: promptData.system
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * OpenAI API呼び出し
     */
    async _callOpenAIAPI(message, model, context) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        const promptBuilder = createPromptBuilder()
            .setCustomPrompt(context.customPrompt)
            .setContext(context)
            .setConversationHistory(context.conversationHistory)
            .setUserMessage(message);
        
        const promptData = promptBuilder.buildForProvider('openai');
        logPromptDebugInfo(promptData, 'openai');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2048,
                messages: promptData.messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Gemini API呼び出し
     */
    async _callGeminiAPI(message, model, context) {
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('GOOGLE_API_KEY is not configured');
        }

        const promptBuilder = createPromptBuilder()
            .setCustomPrompt(context.customPrompt)
            .setContext(context)
            .setConversationHistory(context.conversationHistory)
            .setUserMessage(message);
        
        const promptData = promptBuilder.buildForProvider('gemini');
        logPromptDebugInfo(promptData, 'gemini');

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: promptData.content
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    stopSequences: []
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Unexpected Gemini API response format');
        }
    }

    /**
     * Local LLM API呼び出し
     */
    async _callLocalLLMAPI(message, model, context) {
        const promptBuilder = createPromptBuilder()
            .setCustomPrompt(context.customPrompt)
            .setContext(context)
            .setConversationHistory(context.conversationHistory)
            .setUserMessage(message);

        const promptData = promptBuilder.buildForProvider('local');
        logPromptDebugInfo(promptData, 'local');

        const response = await fetch(this.providers.local.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: promptData.messages,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.message.content;
    }

    /**
     * 利用可能なプロバイダー一覧を取得
     */
    getProviders() {
        return this.providers;
    }

    /**
     * 特定のプロバイダーの利用可能性をチェック
     */
    isProviderAvailable(provider) {
        if (!this.providers[provider]) {
            return false;
        }

        switch (provider) {
            case 'claude':
                return !!process.env.ANTHROPIC_API_KEY;
            case 'openai':
                return !!process.env.OPENAI_API_KEY;
            case 'gemini':
                return !!process.env.GOOGLE_API_KEY;
            case 'local':
                return true; // Local is always available if Ollama is running
            default:
                return false;
        }
    }

    /**
     * すべてのプロバイダーの利用可能性を取得
     */
    getProvidersStatus() {
        const status = {};
        
        Object.keys(this.providers).forEach(provider => {
            status[provider] = {
                name: this.providers[provider].name,
                available: this.isProviderAvailable(provider),
                models: this.providers[provider].models,
                defaultModel: this.providers[provider].defaultModel
            };
        });

        return status;
    }
}
