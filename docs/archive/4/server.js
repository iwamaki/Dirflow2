/* =========================================
   AI File Manager - サーバーサイド Node.js Express
   
   【概要】
   AI統合ファイルマネージャーのバックエンドAPI
   複数LLMプロバイダー（Claude/OpenAI/Gemini）との通信、構造化応答解析、
   セキュリティバリデーション、フォールバック機能、会話履歴管理を提供
   
   【主要機能・設定】
   - LLM_PROVIDERS: Claude、OpenAI、Gemini の API設定とモデル一覧
   - SYSTEM_PROMPT: AI応答の構造化プロンプト（JSON形式応答指定）
   - callClaudeAPI/callOpenAIAPI/callGeminiAPI: 各プロバイダーとの通信処理
   - parseStructuredResponse: JSON形式応答の解析とエラーハンドリング
   - validateCommand: ファイル操作コマンドのセキュリティ検証
   - getMockResponse: API接続失敗時のフォールバック応答生成
   
   【script.js連携エンドポイント】
   - GET /api/llm-providers: 利用可能プロバイダー・モデル情報を送信
   - POST /api/chat: script.js からのチャット要求を受信、LLM API呼び出し、構造化応答を返却
   - GET /api/health: サーバー状態・API接続可能性をチェック、設定画面で表示
   - GET /: index.html 静的ファイル配信（script.js のホスト）
   ========================================= */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// LLM Providers Configuration
const LLM_PROVIDERS = {
    claude: {
        name: 'Claude (Anthropic)',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        models: [
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            'claude-3-opus-20240229'
        ],
        defaultModel: 'claude-3-sonnet-20240229'
    },
    openai: {
        name: 'OpenAI GPT',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        models: [
            'gpt-4',
            'gpt-4-turbo-preview',
            'gpt-3.5-turbo'
        ],
        defaultModel: 'gpt-4'
    },
    gemini: {
        name: 'Google Gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: [
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.0-pro'
        ],
        defaultModel: 'gemini-1.5-pro'
    }
};

// システムプロンプト
const SYSTEM_PROMPT = `あなたは高度なAIファイルマネージャーのアシスタントです。
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

ルール:
1. 必ずmessageフィールドを含める
2. ファイル操作不要な場合は commands: [] を使用
3. パスは現在のディレクトリからの相対パスまたは絶対パス
4. 危険な操作（削除）の場合は確認メッセージを含める
5. エラーが予想される場合は事前に警告する
6. レスポンスは必ずJSONとして有効な形式にする
7. 会話が長くなった場合（15回以上の往復）は新しいチャット開始を提案する

例:
- ファイル作成: {"message": "新しいファイルを作成しますね！", "commands": [{"action": "create_file", "path": "sample.txt", "content": "サンプル内容", "description": "sample.txt を作成しました"}]}
- ディレクトリ作成: {"message": "新しいフォルダを作成します", "commands": [{"action": "create_directory", "path": "documents", "description": "documents フォルダを作成しました"}]}
- ファイルコピー: {"message": "ファイルをコピーします", "commands": [{"action": "copy_file", "source": "file1.txt", "destination": "backup/file1.txt", "description": "file1.txt を backup フォルダにコピーしました"}]}
- 一括操作: {"message": "複数ファイルを一括処理します", "commands": [{"action": "batch_delete", "paths": ["temp1.txt", "temp2.txt"], "description": "一時ファイル2個を削除しました"}]}
- 単純な会話: {"message": "こんにちは！何かお手伝いできることはありますか？", "commands": []}`;

// Claude API Call
async function callClaudeAPI(message, model = 'claude-3-sonnet-20240229', context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    
    const systemPrompt = SYSTEM_PROMPT
        .replace('{{CURRENT_PATH}}', context.currentPath || '/workspace')
        .replace('{{FILE_COUNT}}', fileList.length)
        .replace('{{FILE_LIST}}', JSON.stringify(fileList, null, 2))
        .replace('{{HISTORY_COUNT}}', conversationHistory.length);

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
    
    // 現在開いているファイルの内容を追加
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    messages.push({
        role: 'user',
        content: `${message}\n\n${contextInfo}`
    });

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

// Gemini API Call
async function callGeminiAPI(message, model = 'gemini-1.5-pro', context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    
    const systemPrompt = SYSTEM_PROMPT
        .replace('{{CURRENT_PATH}}', context.currentPath || '/workspace')
        .replace('{{FILE_COUNT}}', fileList.length)
        .replace('{{FILE_LIST}}', JSON.stringify(fileList, null, 2))
        .replace('{{HISTORY_COUNT}}', conversationHistory.length);

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
    
    // 現在開いているファイルの内容を追加
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    fullContent += `ユーザー: ${message}\n\n${contextInfo}`;

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

// OpenAI API Call
async function callOpenAIAPI(message, model = 'gpt-4', context = {}) {
    const fileList = context.fileList || [];
    const conversationHistory = context.conversationHistory || [];
    
    const systemPrompt = SYSTEM_PROMPT
        .replace('{{CURRENT_PATH}}', context.currentPath || '/workspace')
        .replace('{{FILE_COUNT}}', fileList.length)
        .replace('{{FILE_LIST}}', JSON.stringify(fileList, null, 2))
        .replace('{{HISTORY_COUNT}}', conversationHistory.length);

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
    
    // 現在開いているファイルの内容を追加
    if (context.openFileInfo) {
        contextInfo += `\n\n[現在開いているファイルの詳細]\n${context.openFileInfo}`;
    }
    
    messages.push({
        role: 'user',
        content: `${message}\n\n${contextInfo}`
    });

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

// 構造化応答パーサー（JSON形式対応）
function parseStructuredResponse(response) {
    try {
        // JSON形式を優先的に試行
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    message: parsed.message || 'AI応答を処理中...',
                    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
                    success: true
                };
            } catch (e) {
                console.warn('JSON parse failed:', e);
            }
        }

        // JSONが見つからない場合、レスポンス全体をメッセージとして扱う
        return {
            message: response,
            commands: [],
            success: false,
            warning: 'AIの応答をJSON形式で解析できませんでした'
        };

    } catch (error) {
        console.warn('Failed to parse structured response:', error);
        return {
            message: response || 'AIからの応答を処理できませんでした',
            commands: [],
            success: false,
            error: error.message
        };
    }
}

// コマンドバリデーション
function validateCommand(command) {
    const allowedActions = [
        'create_file', 'create_directory', 'delete_file', 'copy_file', 'move_file',
        'read_file', 'edit_file', 'list_files', 
        'batch_delete', 'batch_copy', 'batch_move'
    ];
    
    if (!command.action || !allowedActions.includes(command.action)) {
        throw new Error(`未サポートのアクション: ${command.action}`);
    }

    // パスのセキュリティチェック
    const pathFields = ['path', 'source', 'destination'];
    for (const field of pathFields) {
        if (command[field]) {
            if (typeof command[field] !== 'string' || 
                command[field].includes('..') || 
                command[field].includes('~') || 
                command[field].startsWith('/etc') || 
                command[field].startsWith('/var')) {
                throw new Error(`安全でないパス: ${command[field]}`);
            }
        }
    }

    // 一括操作のパス配列チェック
    if (command.paths || command.sources) {
        const pathArray = command.paths || command.sources;
        if (!Array.isArray(pathArray)) {
            throw new Error('一括操作にはパス配列が必要です');
        }
        for (const path of pathArray) {
            if (typeof path !== 'string' || 
                path.includes('..') || 
                path.includes('~') || 
                path.startsWith('/etc') || 
                path.startsWith('/var')) {
                throw new Error(`安全でないパス: ${path}`);
            }
        }
    }

    // 必須フィールドチェック
    const requiredFields = {
        'create_file': ['path'],
        'create_directory': ['path'],
        'delete_file': ['path'],
        'copy_file': ['source', 'destination'],
        'move_file': ['source', 'destination'],
        'read_file': ['path'],
        'edit_file': ['path', 'content'],
        'list_files': [],
        'batch_delete': ['paths'],
        'batch_copy': ['sources', 'destination'],
        'batch_move': ['sources', 'destination']
    };

    const required = requiredFields[command.action];
    if (required) {
        for (const field of required) {
            if (!command[field] && command[field] !== '') {
                throw new Error(`必須フィールドが不足: ${field}`);
            }
        }
    }

    return true;
}

// Fallback Mock Response
function getMockResponse(message, context = {}) {
    const cmd = message.toLowerCase();
    
    if (cmd.includes('help') || cmd.includes('ヘルプ')) {
        return {
            message: `🤖 AI File Manager のコマンド一覧（拡張版）：
        
**📋 基本コマンド:**
• **ファイル作成** - "新しいファイルを作って" "sample.txt を作成"
• **ディレクトリ作成** - "フォルダを作って" "documents フォルダを作成"
• **ファイル読み込み** - "ファイルを読んで" "内容を表示して"  
• **ファイル編集** - "ファイルを編集して" "内容を変更して"
• **ファイルコピー** - "ファイルをコピーして" "backup フォルダにコピー"
• **ファイル移動** - "ファイルを移動して" "フォルダを移動"
• **ファイル削除** - "ファイルを削除して" "不要なファイルを消して"
• **ファイル一覧** - "ファイル一覧" "何があるか教えて"

**🔄 一括操作:**
• **一括削除** - "全ての .txt ファイルを削除して"
• **一括コピー** - "画像ファイル全部を images フォルダにコピー"
• **一括移動** - "古いファイルを全部 archive に移動"

**📱 操作方法:**
• **ファイル表示** - ファイルをクリックでプレビュー
• **ファイル操作** - ファイルを長押しで操作メニュー表示
• **複数選択** - Ctrl/Cmd + クリックで複数選択
• **編集切替** - 右上の✏️ボタンで編集/プレビュー切り替え
• **AIコマンド** - 自然な日本語でファイル操作が可能

例: "プロジェクト用の docs フォルダを作って、README.md も作成して"`,
            commands: []
        };
    }

    // 簡単なコマンド検出とモック応答
    if (cmd.includes('作成') || cmd.includes('create')) {
        return {
            message: "ファイル/フォルダ作成を実行します。（デモモード: API接続を確認してください）",
            commands: []
        };
    }

    if (cmd.includes('コピー') || cmd.includes('copy')) {
        return {
            message: "ファイルコピーを実行します。（デモモード: API接続を確認してください）",
            commands: []
        };
    }

    if (cmd.includes('移動') || cmd.includes('move')) {
        return {
            message: "ファイル移動を実行します。（デモモード: API接続を確認してください）",
            commands: []
        };
    }

    if (cmd.includes('一覧') || cmd.includes('list')) {
        return {
            message: `現在のディレクトリ: ${context.currentPath || '/workspace'}\nファイル数: ${context.fileList?.length || 0}`,
            commands: []
        };
    }

    const mockResponses = [
        "ファイル操作を実行しました。",
        "AIによる分析が完了しました。", 
        "処理が正常に完了しました。",
        "ご質問にお答えします。何かお手伝いできることはありますか？",
        "理解しました。他にも何かサポートが必要でしたらお知らせください。"
    ];
    
    return {
        message: mockResponses[Math.floor(Math.random() * mockResponses.length)],
        commands: []
    };
}

// API Routes

// Get available LLM providers and models
app.get('/api/llm-providers', (req, res) => {
    res.json(LLM_PROVIDERS);
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, provider = 'claude', model, context = {} } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ 
                error: 'Message is required and must be a string' 
            });
        }

        // 会話履歴制限チェック
        const conversationHistory = context.conversationHistory || [];
        let shouldSuggestNewChat = false;
        
        if (conversationHistory.length >= 15) {
            shouldSuggestNewChat = true;
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

            default:
                console.warn(`Unknown provider: ${provider}, using mock response`);
                const mockResult = getMockResponse(message, context);
                return res.json({
                    message: mockResult.message,
                    commands: mockResult.commands,
                    provider: 'fallback',
                    model: 'mock',
                    timestamp: new Date().toISOString(),
                    warning: 'フォールバック応答: 指定されたプロバイダーが無効です',
                    shouldSuggestNewChat: shouldSuggestNewChat
                });
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

        res.json({ 
            message: finalMessage,
            commands: validatedCommands,
            rawResponse: response,
            provider,
            model: selectedModel,
            timestamp: new Date().toISOString(),
            parseSuccess: parsedResponse.success,
            warning: parsedResponse.warning,
            shouldSuggestNewChat: shouldSuggestNewChat,
            historyCount: conversationHistory.length
        });

    } catch (error) {
        console.error('Chat API error:', error);
        
        // API失敗時のフォールバック応答
        const fallbackResult = getMockResponse(req.body.message, req.body.context);
        
        res.status(200).json({
            message: fallbackResult.message + "\n\n⚠️ (フォールバック応答: API接続エラーのため)",
            commands: [],
            provider: 'fallback',
            model: 'mock',
            timestamp: new Date().toISOString(),
            warning: 'API接続に問題があります。設定を確認してください。',
            error: error.message,
            shouldSuggestNewChat: false
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        providers: {},
        features: {
            basic_commands: true,
            file_operations: true,
            json_parsing: true,
            conversation_history: true,
            batch_operations: true,
            directory_creation: true,
            file_copy_move: true
        }
    };

    // Check if API keys are configured
    status.providers.claude = !!process.env.ANTHROPIC_API_KEY;
    status.providers.openai = !!process.env.OPENAI_API_KEY;
    status.providers.gemini = !!process.env.GOOGLE_API_KEY;

    res.json(status);
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AI File Manager Server running on http://localhost:${PORT}`);
    console.log(`📋 Available providers:`);
    
    Object.entries(LLM_PROVIDERS).forEach(([key, provider]) => {
        const hasKey = key === 'claude' ? !!process.env.ANTHROPIC_API_KEY : 
                       key === 'openai' ? !!process.env.OPENAI_API_KEY :
                       key === 'gemini' ? !!process.env.GOOGLE_API_KEY : false;
        console.log(`   ${provider.name}: ${hasKey ? '✅' : '❌'}`);
    });
    
    console.log(`\n🎯 利用可能な機能:`);
    console.log(`   📝 create_file - ファイル作成`);
    console.log(`   📁 create_directory - ディレクトリ作成`);
    console.log(`   📖 read_file - ファイル読み込み`);
    console.log(`   ✏️ edit_file - ファイル編集`);
    console.log(`   📋 copy_file - ファイルコピー`);
    console.log(`   🔄 move_file - ファイル移動/名前変更`);
    console.log(`   🗑️ delete_file - ファイル削除`);
    console.log(`   📋 list_files - ファイル一覧`);
    console.log(`   🔄 batch_delete - 一括削除`);
    console.log(`   🔄 batch_copy - 一括コピー`);
    console.log(`   🔄 batch_move - 一括移動`);
    console.log(`   💬 conversation_history - 会話履歴管理`);
    
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
        console.log(`\n⚠️  No API keys configured. Add them to .env file:`);
        console.log(`   ANTHROPIC_API_KEY=your_claude_api_key`);
        console.log(`   OPENAI_API_KEY=your_openai_api_key`);
        console.log(`   GOOGLE_API_KEY=your_gemini_api_key`);
    }
});