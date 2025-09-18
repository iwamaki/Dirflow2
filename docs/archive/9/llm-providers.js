/* =========================================
    LLMプロバイダー設定・API呼び出し処理
   ========================================= */

import { parseStructuredResponse, validateCommand, getMockResponse } from './response-utils.js';

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
        apiUrl: 'http://localhost:11434/v1/chat/completions',
        models: [
            'llama3',
            'phi3',
            'gemma3',
            'gpt-oss:20b'
        ],
        defaultModel: 'llama3'
    }
};

// ベースシステムプロンプト（ファイル操作機能）
export const BASE_SYSTEM_PROMPT = `あなたは高度なAIファイルマネージャーのアシスタントです。
ユーザーとの自然な会話を行いながら、必要に応じてファイルシステム操作を実行できます。

応答は必ず以下のJSON形式で行ってください：

{
  "message": "ユーザーへの自然な応答メッセージ（必須）",
  "commands": [
    {
      "action": "create_file",
      "path": "example.txt",
      "content": "ファイルの内容",
      "description": "操作の説明"
    }
  ]
}

利用可能なアクション：
- create_file: ファイル作成 (path, content?, description?)
- create_directory: ディレクトリ作成 (path, description?)
- delete_file: ファイル削除 (path, description?)
- copy_file: ファイルコピー (source, destination, description?)
- move_file: ファイル移動/名前変更 (source, destination, description?)
- read_file: ファイル読み込み (path, description?)
- edit_file: ファイル編集 (path, content, description?)
- list_files: ファイル一覧表示 (path?, description?)
- batch_delete: 一括削除 (paths[], description?)
- batch_copy: 一括コピー (sources[], destination, description?)
- batch_move: 一括移動 (sources[], destination, description?)

現在の状態:
- ディレクトリ: {{CURRENT_PATH}}
- ファイル数: {{FILE_COUNT}}
- ファイル一覧: {{FILE_LIST}}
- 会話履歴数: {{HISTORY_COUNT}}

基本ルール:
1. 必ずmessageフィールドを含める
2. ファイル操作不要な場合は commands: [] を使用
3. パスは現在のディレクトリからの相対パスまたは絶対パス
4. 危険な操作（削除）の場合は確認メッセージを含める
5. エラーが予想される場合は事前に警告する
6. レスポンスは必ずJSONとして有効な形式にする
7. 会話が長くなった場合（15回以上の往復）は新しいチャット開始を提案する`;

// カスタムプロンプトとベースプロンプトを統合する関数
export function combineSystemPrompts(customPrompt, basePrompt, context = {}) {
    let combinedPrompt = '';
    
    // カスタムプロンプトがある場合は最初に配置
    if (customPrompt && customPrompt.content) {
        combinedPrompt += `=== カスタムシステムプロンプト ===\n`;
        combinedPrompt += `プロンプト名: ${customPrompt.name}\n`;
        if (customPrompt.description) {
            combinedPrompt += `説明: ${customPrompt.description}\n`;
        }
        combinedPrompt += `\n${customPrompt.content}\n\n`;
    }
    
    // ベースプロンプト（ファイル操作機能）を追加
    combinedPrompt += `=== ファイル操作システムプロンプト ===\n`;
    combinedPrompt += basePrompt;
    
    // カスタムプロンプトがある場合の統合指示
    if (customPrompt && customPrompt.content) {
        combinedPrompt += `\n\n=== 統合指示 ===\n`;
        combinedPrompt += `上記のカスタムプロンプトの性格・役割・指示に従いつつ、ファイル操作が必要な場合は必ずJSON形式で応答してください。\n`;
        combinedPrompt += `カスタムプロンプトとファイル操作プロンプトの両方の要求を満たすよう心がけてください。`;
    }
    
    // コンテキスト情報の置換
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    
    combinedPrompt = combinedPrompt
        .replace('{{CURRENT_PATH}}', context.currentPath || '/workspace')
        .replace('{{FILE_COUNT}}', fileList.length)
        .replace('{{FILE_LIST}}', JSON.stringify(fileList, null, 2))
        .replace('{{HISTORY_COUNT}}', conversationHistory.length);

    return combinedPrompt;
}

// Claude API Call（カスタムプロンプト対応）
export async function callClaudeAPI(message, model = 'claude-3-sonnet-20240229', context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    const customPrompt = context.customPrompt;
    
    // システムプロンプトを統合
    const systemPrompt = combineSystemPrompts(customPrompt, BASE_SYSTEM_PROMPT, context);

    // 会話履歴をClaude形式に変換
    const messages = [];
    
    // 過去の会話履歴を追加（最新10件のみ）
    const recentHistory = conversationHistory.slice(-10);
    for (const exchange of recentHistory) {
        messages.push({ role: 'user', content: exchange.user });
        if (exchange.ai) {
            messages.push({ role: 'assistant', content: exchange.ai });
        }
    }
    
    // 現在のメッセージを追加
    let contextInfo = `[コンテキスト情報]\n現在のディレクトリ: ${context.currentPath || '/workspace'}\nファイル数: ${fileList.length}\n現在編集中: ${context.currentFile || 'なし'}`;
    
    // カスタムプロンプトの情報を追加
    if (customPrompt && customPrompt.enabled) {
        contextInfo += `\nカスタムプロンプト: ${customPrompt.name} (有効)`;
    }
    
    // 現在開いているファイルの内容を追加
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    messages.push({
        role: 'user',
        content: `${message}\n\n${contextInfo}`
    });

    if (process.env.DEBUG_LLM_CONTEXT === 'true') {
        console.log('--- Claude API Request ---');
        console.log('Messages:', JSON.stringify(messages, null, 2));
        console.log('--------------------------');
    }

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
            messages: messages,
            system: systemPrompt
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// Gemini API Call（カスタムプロンプト対応）
export async function callGeminiAPI(message, model = 'gemini-1.5-pro', context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    const customPrompt = context.customPrompt;
    
    // システムプロンプトを統合
    const systemPrompt = combineSystemPrompts(customPrompt, BASE_SYSTEM_PROMPT, context);

    // 会話履歴を含む内容を構築
    let fullContent = systemPrompt + '\n\n';
    
    // 過去の会話履歴を追加（最新10件のみ）
    const recentHistory = conversationHistory.slice(-10);
    if (recentHistory.length > 0) {
        fullContent += '=== 過去の会話履歴 ===\n';
        for (const exchange of recentHistory) {
            fullContent += `ユーザー: ${exchange.user}\n`;
            if (exchange.ai) {
                fullContent += `AI: ${exchange.ai}\n`;
            }
            fullContent += '\n';
        }
        fullContent += '=== 現在の質問 ===\n';
    }
    
    let contextInfo = `[コンテキスト情報]\n現在のディレクトリ: ${context.currentPath || '/workspace'}\nファイル数: ${fileList.length}`;
    
    // カスタムプロンプトの情報を追加
    if (customPrompt && customPrompt.enabled) {
        contextInfo += `\nカスタムプロンプト: ${customPrompt.name} (有効)`;
    }
    
    // 現在開いているファイルの内容を追加
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    fullContent += `ユーザー: ${message}\n\n${contextInfo}`;

    if (process.env.DEBUG_LLM_CONTEXT === 'true') {
        console.log('--- Gemini API Request ---');
        console.log('Full Content:', fullContent);
        console.log('--------------------------');
    }

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
                            text: fullContent
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

// OpenAI API Call（カスタムプロンプト対応）
export async function callOpenAIAPI(message, model = 'gpt-4', context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    const customPrompt = context.customPrompt;
    
    // システムプロンプトを統合
    const systemPrompt = combineSystemPrompts(customPrompt, BASE_SYSTEM_PROMPT, context);

    const messages = [
        {
            role: 'system',
            content: systemPrompt
        }
    ];
    
    // 過去の会話履歴を追加（最新10件のみ）
    const recentHistory = conversationHistory.slice(-10);
    for (const exchange of recentHistory) {
        messages.push({ role: 'user', content: exchange.user });
        if (exchange.ai) {
            messages.push({ role: 'assistant', content: exchange.ai });
        }
    }
    
    // 現在のメッセージを追加
    let contextInfo = `[コンテキスト情報]\n現在のディレクトリ: ${context.currentPath || '/workspace'}\nファイル数: ${fileList.length}`;
    
    // カスタムプロンプトの情報を追加
    if (customPrompt && customPrompt.enabled) {
        contextInfo += `\nカスタムプロンプト: ${customPrompt.name} (有効)`;
    }
    
    // 現在開いているファイルの内容を追加
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    messages.push({
        role: 'user',
        content: `${message}\n\n${contextInfo}`
    });

    if (process.env.DEBUG_LLM_CONTEXT === 'true') {
        console.log('--- OpenAI API Request ---');
        console.log('Messages:', JSON.stringify(messages, null, 2));
        console.log('--------------------------');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 2048,
            messages: messages,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Local LLM API Call (OpenAI-compatible)
export async function callLocalLLMAPI(message, model, context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    const customPrompt = context.customPrompt;
    
    const systemPrompt = combineSystemPrompts(customPrompt, BASE_SYSTEM_PROMPT, context);

    const messages = [
        {
            role: 'system',
            content: systemPrompt
        }
    ];
    
    const recentHistory = conversationHistory.slice(-10);
    for (const exchange of recentHistory) {
        messages.push({ role: 'user', content: exchange.user });
        if (exchange.ai) {
            messages.push({ role: 'assistant', content: exchange.ai });
        }
    }
    
    let contextInfo = `[コンテキスト情報]\n現在のディレクトリ: ${context.currentPath || '/workspace'}\nファイル数: ${fileList.length}`;
    
    if (customPrompt && customPrompt.enabled) {
        contextInfo += `\nカスタムプロンプト: ${customPrompt.name} (有効)`;
    }
    
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    messages.push({
        role: 'user',
        content: `${message}\n\n${contextInfo}`
    });

    if (process.env.DEBUG_LLM_CONTEXT === 'true') {
        console.log('--- Local LLM API Request ---');
        console.log(`History Length: ${conversationHistory.length} `);
        console.log('Messages:', JSON.stringify(messages, null, 2));
        console.log('--------------------------');
    }

    const response = await fetch(LLM_PROVIDERS.local.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 2048,
            messages: messages,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`Local LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// メインのチャット処理関数（サーバーから呼び出される）
export async function handleChatRequest(message, provider = 'claude', model, context = {}) {
    // 会話履歴制限チェック
    const conversationHistory = context.conversationHistory || [];
    let shouldSuggestNewChat = false;
    
    if (conversationHistory.length >= 15) {
        shouldSuggestNewChat = true;
    }

    // カスタムプロンプトのログ出力（デバッグ用）
    if (context.customPrompt && context.customPrompt.enabled) {
        console.log(`📝 Using custom prompt: "${context.customPrompt.name}" (${context.customPrompt.id})`);
    }

    let response;
    const selectedModel = model || LLM_PROVIDERS[provider]?.defaultModel;

    switch (provider) {
        case 'claude':
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }
            response = await callClaudeAPI(message, selectedModel, context);
            break;

        case 'openai':
            if (!process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API key not configured');
            }
            response = await callOpenAIAPI(message, selectedModel, context);
            break;

        case 'gemini':
            if (!process.env.GOOGLE_API_KEY) {
                throw new Error('Google API key not configured');
            }
            response = await callGeminiAPI(message, selectedModel, context);
            break;

        case 'local':
            response = await callLocalLLMAPI(message, selectedModel, context);
            break;

        default:
            console.warn(`Unknown provider: ${provider}, using mock response`);
            const mockResult = getMockResponse(message, context);
            return {
                message: mockResult.message,
                commands: mockResult.commands,
                provider: 'fallback',
                model: 'mock',
                timestamp: new Date().toISOString(),
                warning: 'フォールバック応答: 指定されたプロバイダーが無効です',
                shouldSuggestNewChat: shouldSuggestNewChat,
                customPromptUsed: false
            };
    }

    // 構造化応答をパース
    const parsedResponse = parseStructuredResponse(response);

    // コマンドバリデーション
    const validatedCommands = [];
    if (parsedResponse.commands && parsedResponse.commands.length > 0) {
        for (const command of parsedResponse.commands) {
            try {
                validateCommand(command);
                validatedCommands.push(command);
            } catch (error) {
                console.warn(`Invalid command filtered out: ${error.message}`);
                // 無効なコマンドは除外するが、エラーにはしない
            }
        }
    }

    // 新しいチャット提案のメッセージを追加
    let finalMessage = parsedResponse.message;
    if (shouldSuggestNewChat && !finalMessage.includes('新しいチャット')) {
        finalMessage += '\n\n💡 **ヒント**: 会話が長くなってきました。より良い応答のため、新しいチャットを開始することをお勧めします！';
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
        customPromptName: customPromptUsed ? context.customPrompt.name : null
    };
}