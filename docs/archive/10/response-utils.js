/* =========================================
    レスポンス処理・バリデーション・ユーティリティ
   ========================================= */

/*

## 概要
AIからの応答の解析、コマンドのバリデーション、ヘルスチェックステータスの生成、エラー処理、サーバー起動ログ出力など、サーバーサイドの応答処理とユーティリティ機能を提供するモジュール。

## 主要機能
- **関数**: parseStructuredResponse(response): AIからの応答文字列を解析し、JSON形式の構造化データ（メッセージとコマンド）を抽出。JSON形式でない場合はメッセージとして扱う。
- **関数**: validateCommand(command): AIから提案されたコマンドの妥当性を検証。アクションのホワイトリストチェック、パスのセキュリティチェック、必須フィールドの有無などを確認。
- **関数**: getMockResponse(message, context): API接続エラー時やデモモード時に使用されるフォールバック用のモック応答を生成。
- **関数**: generateHealthStatus(): サーバーのヘルスチェックステータスを生成。LLMプロバイダーのAPIキー設定状況や利用可能な機能を示す。
- **関数**: validateChatInput(message, provider, model, context): チャットリクエストの入力パラメータ（メッセージ、プロバイダー、モデル、コンテキスト）をバリデーション。
- **関数**: formatApiError(error, provider, message, context): API呼び出し中に発生したエラーを整形し、ユーザーに返すエラー応答を生成。モック応答をフォールバックとして利用。
- **関数**: logServerStart(port, providers): サーバー起動時に、ポート番号、利用可能なLLMプロバイダー、APIキー設定状況、利用可能な機能などをコンソールにログ出力。

## 依存関係
- **インポート**: なし
- **エクスポート**: parseStructuredResponse, validateCommand, getMockResponse, generateHealthStatus, validateChatInput, formatApiError, logServerStart

## 特記事項
- AIからの応答がJSON形式であるかどうかにかかわらず、柔軟に処理できるパーサーを提供。
- コマンド実行におけるセキュリティを確保するため、厳格なバリデーションルールを適用。
- 開発時やAPIキー未設定時でも基本的な動作を確認できるよう、モック応答機能を提供。
- サーバーの状態を外部から確認できるヘルスチェック機能。
- サーバー起動時の詳細なログ出力により、設定状況や機能の可用性を一目で確認可能。

*/

// 構造化応答パーサー（JSON形式対応）
export function parseStructuredResponse(response) {
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
export function validateCommand(command) {
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
export function getMockResponse(message, context = {}) {
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
• **カスタムプロンプト** - 🧠ボタンでカスタムプロンプト有効/無効

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

// ヘルスチェック用ステータス生成
export function generateHealthStatus() {
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
            file_copy_move: true,
            custom_prompts: true // 新機能
        }
    };

    // Check if API keys are configured
    status.providers.claude = !!process.env.ANTHROPIC_API_KEY;
    status.providers.openai = !!process.env.OPENAI_API_KEY;
    status.providers.gemini = !!process.env.GOOGLE_API_KEY;
    status.providers.local = true; // Local is always available

    return status;
}

// 入力バリデーション
export function validateChatInput(message, provider, model, context) {
    if (!message || typeof message !== 'string') {
        throw new Error('Message is required and must be a string');
    }

    if (provider && typeof provider !== 'string') {
        throw new Error('Provider must be a string');
    }

    if (model && typeof model !== 'string') {
        throw new Error('Model must be a string');
    }

    if (context && typeof context !== 'object') {
        throw new Error('Context must be an object');
    }

    return true;
}

// エラー処理ユーティリティ
export function formatApiError(error, provider, message, context) {
    console.error(`${provider} API error:`, error);
    
    // API失敗時のフォールバック応答
    const fallbackResult = getMockResponse(message, context);
    
    return {
        message: fallbackResult.message + "\n\n (フォールバック応答: API接続エラーのため)",
        commands: [],
        provider: 'fallback',
        model: 'mock',
        timestamp: new Date().toISOString(),
        warning: 'API接続に問題があります。設定を確認してください。',
        error: error.message,
        shouldSuggestNewChat: false,
        customPromptUsed: false
    };
}

// ログユーティリティ
export function logServerStart(port, providers) {
    console.log(`🚀 AI File Manager Server running on http://localhost:${port}`);
    console.log(`📋 Available providers:`);
    
    Object.entries(providers).forEach(([key, provider]) => {
        const hasKey = key === 'claude' ? !!process.env.ANTHROPIC_API_KEY : 
                       key === 'openai' ? !!process.env.OPENAI_API_KEY :
                       key === 'gemini' ? !!process.env.GOOGLE_API_KEY :
                       key === 'local' ? true : false;
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
    console.log(`   🧠 custom_prompts - カスタムシステムプロンプト`);
    
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
        console.log(`\n⚠️  No API keys configured. Add them to .env file:`);
        console.log(`   ANTHROPIC_API_KEY=your_claude_api_key`);
        console.log(`   OPENAI_API_KEY=your_openai_api_key`);
        console.log(`   GOOGLE_API_KEY=your_gemini_api_key`);
    }
    
    console.log(`\n🧠 カスタムプロンプト機能が有効です:`);
    console.log(`   - ヘッダー🧠ボタンで有効/無効切り替え`);
    console.log(`   - FABメニュー「システムプロンプト」で管理`);
    console.log(`   - ベースプロンプト（ファイル操作）と自動統合`);
}