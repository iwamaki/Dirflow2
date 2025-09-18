/* =========================================
    LLMプロバイダー設定・API呼び出し処理
   ========================================= */

/*

## 概要
大規模言語モデル（LLM）プロバイダー（Claude, OpenAI, Gemini, Local LLM）の設定、API呼び出し、および応答の解析を一元的に管理するモジュール。

## 主要機能
- **定数**: LLM_PROVIDERS: 各LLMプロバイダーのAPI情報、利用可能なモデル、デフォルトモデルを定義。
- **関数**: callClaudeAPI(message, model, context): Claude APIを呼び出し、応答を処理。
- **関数**: callOpenAIAPI(message, model, context): OpenAI APIを呼び出し、応答を処理。
- **関数**: callGeminiAPI(message, model, context): Gemini APIを呼び出し、応答を処理。
- **関数**: callLocalLLMAPI(message, model, context): ローカルLLM APIを呼び出し、応答を処理。
- **関数**: parseStructuredResponse(response): LLMからの構造化された応答（JSON形式）を解析し、メッセージとコマンドを抽出。
- **関数**: handleChatRequest(message, provider, model, context): メインのチャット処理関数。選択されたLLMプロバイダーのAPIを呼び出し、応答を解析して返却。

## 依存関係
- **インポート**:
  - `createPromptBuilder`, `logPromptDebugInfo` (from './prompt-builder.js'): プロンプト構築とデバッグ情報ロギングに使用。
- **エクスポート**: LLM_PROVIDERS, callClaudeAPI, callOpenAIAPI, callGeminiAPI, callLocalLLMAPI, parseStructuredResponse, handleChatRequest

## 特記事項
- 複数のLLMプロバイダーに対応し、柔軟な切り替えが可能。
- 環境変数からAPIキーを読み込むことでセキュリティを確保。
- プロンプト構築ロジックを`prompt-builder.js`に分離し、再利用性を高めている。
- LLMからの応答にJSON形式のコマンドが含まれる場合、それを解析して実行可能なコマンドとして抽出。
- 会話履歴が長くなった場合に新しいチャットを提案する機能。
- カスタムプロンプトの使用状況をログ出力するデバッグ機能。
- 各API呼び出しにおけるエラーハンドリングと、構造化応答のパースエラー処理。

*/

import { createPromptBuilder, logPromptDebugInfo } from './prompt-builder.js';
import { AgentRouter } from './agent-router.js';

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

// Claude API Call
export async function callClaudeAPI(message, model = 'claude-3-5-haiku-20241022', context = {}) {
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
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// OpenAI API Call
export async function callOpenAIAPI(message, model = 'gpt-4', context = {}) {
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
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Gemini API Call
export async function callGeminiAPI(message, model = 'gemini-2.5-flash', context = {}) {
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
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Unexpected Gemini API response format');
    }
}

// Local LLM API Call
export async function callLocalLLMAPI(message, model = 'phi3:latest', context = {}) {
    console.log(`[DEBUG] Local LLM API call with model: ${model}`);

    const promptBuilder = createPromptBuilder()
        .setCustomPrompt(context.customPrompt)
        .setContext(context)
        .setConversationHistory(context.conversationHistory)
        .setUserMessage(message);

    const promptData = promptBuilder.buildForProvider('local');
    logPromptDebugInfo(promptData, 'local');

    const response = await fetch(LLM_PROVIDERS.local.apiUrl, {
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
        throw new Error(`Local LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
}

// レスポンスからコマンド構造を解析する関数
export function parseStructuredResponse(response) {
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { 
                success: false,
                message: response,
                commands: [],
                warning: "JSONが見つかりませんでした"
            };
        }
        
        const jsonString = jsonMatch[0];
        const data = JSON.parse(jsonString);
        
        return {
            success: true,
            message: data.message || response,
            commands: data.commands || [],
            warning: null
        };
    } catch (error) {
        return {
            success: false,
            message: response,
            commands: [],
            warning: `JSONパースエラー: ${error.message}`
        };
    }
}

// メインのチャット処理関数（サーバーから呼び出される）
export async function handleChatRequest(message, provider = 'claude', model, context = {}) {
    // 入力バリデーション
    if (!message || typeof message !== 'string') {
        throw new Error('メッセージが無効です');
    }

    if (!LLM_PROVIDERS[provider]) {
        throw new Error(`不明なプロバイダー: ${provider}`);
    }

    // 会話履歴の長さチェック
    const conversationHistory = context.conversationHistory || [];
    let shouldSuggestNewChat = false;
    if (conversationHistory.length >= 15) {
        shouldSuggestNewChat = true;
    }

    // カスタムプロンプトのログ出力（デバッグ用）
    if (context.customPrompt && context.customPrompt.enabled && process.env.DEBUG_LLM_CONTEXT === 'true') {
        console.log(`使用中のカスタムプロンプト: ${context.customPrompt.name}`);
    }

    const selectedModel = model || LLM_PROVIDERS[provider]?.defaultModel;

    try {
        // 🚀 マルチエージェント・ルーティングシステムを使用
        console.log('🤖 Using Multi-Agent Routing System');
        const result = await AgentRouter.routeToAgent(message, context, provider, selectedModel);

        // 新しいチャット提案のメッセージを追加
        let finalMessage = result.message;
        if (shouldSuggestNewChat && !finalMessage.includes('新しいチャット')) {
            finalMessage += '\n\n(注: 会話が長くなってきました。もし新しい話題であれば、新しいチャットの開始をお勧めします。)';
        }

        // ルーティング情報をレスポンスに含める
        const routingInfo = result.routing || {};
        if (routingInfo.selectedAgent) {
            console.log(`✅ Task completed by: ${routingInfo.selectedAgent} (${result.agentName || 'Unknown'})`);
        }

        // カスタムプロンプト使用の情報
        const customPromptUsed = !!(context.customPrompt && context.customPrompt.enabled);

        return {
            message: finalMessage,
            commands: result.commands || [],
            rawResponse: result.rawResponse,
            provider,
            model: selectedModel,
            timestamp: new Date().toISOString(),
            parseSuccess: result.parseSuccess !== false,
            warning: result.warning,
            shouldSuggestNewChat: shouldSuggestNewChat,
            historyCount: conversationHistory.length,
            customPromptUsed: customPromptUsed,
            customPromptName: customPromptUsed ? context.customPrompt.name : null,
            // 🆕 マルチエージェント情報
            agentUsed: result.agentUsed,
            agentName: result.agentName,
            routing: routingInfo
        };

    } catch (error) {
        console.error('❌ Multi-Agent System Error:', error);

        // エラー時は従来のシングルエージェント方式にフォールバック
        console.log('⚠️ Falling back to single-agent mode...');

        let response;
        try {
            switch (provider) {
                case 'claude':
                    response = await callClaudeAPI(message, selectedModel, context);
                    break;
                case 'openai':
                    response = await callOpenAIAPI(message, selectedModel, context);
                    break;
                case 'gemini':
                    response = await callGeminiAPI(message, selectedModel, context);
                    break;
                case 'local':
                    response = await callLocalLLMAPI(message, selectedModel, context);
                    break;
                default:
                    throw new Error(`Unknown provider: ${provider}`);
            }
        } catch (fallbackError) {
            return {
                message: `APIエラーが発生しました: ${fallbackError.message}`,
                commands: [],
                rawResponse: null,
                provider,
                model: selectedModel,
                timestamp: new Date().toISOString(),
                parseSuccess: false,
                warning: fallbackError.message,
                error: true
            };
        }

        // 構造化応答をパース
        const parsedResponse = parseStructuredResponse(response);

        // コマンドバリデーション
        const validatedCommands = [];
        if (parsedResponse.commands && parsedResponse.commands.length > 0) {
            for (const cmd of parsedResponse.commands) {
                // 基本的なバリデーション
                if (!cmd.action) continue;

                // パスの正規化と検証
                if (cmd.path && typeof cmd.path === 'string') {
                    // パス正規化ロジック（実際の実装は環境に依存）
                    // 例: パスの安全性チェックなど
                }

                validatedCommands.push(cmd);
            }
        }

        // 新しいチャット提案のメッセージを追加
        let finalMessage = parsedResponse.message;
        if (shouldSuggestNewChat && !finalMessage.includes('新しいチャット')) {
            finalMessage += '\n\n(注: 会話が長くなってきました。もし新しい話題であれば、新しいチャットの開始をお勧めします。)';
        }

        // カスタムプロンプト使用の情報
        const customPromptUsed = !!(context.customPrompt && context.customPrompt.enabled);

        return {
            message: finalMessage,
            commands: validatedCommands,
            rawResponse: response,
            provider,
            model: selectedModel,
            timestamp: new Date().toISOString(),
            parseSuccess: parsedResponse.success,
            warning: parsedResponse.warning,
            shouldSuggestNewChat: shouldSuggestNewChat,
            historyCount: conversationHistory.length,
            customPromptUsed: customPromptUsed,
            customPromptName: customPromptUsed ? context.customPrompt.name : null,
            fallbackMode: true
        };
    }
}