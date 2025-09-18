/* =========================================
    レスポンス処理・ユーティリティ（更新版）
   ========================================= */

/*
## 概要
RDDアプローチのリファクタリング後の残存ユーティリティ機能。
コマンドバリデーションは command-validator.js に移動し、
レスポンス構築は context-builder.js に移動したため、
ここには基本的なユーティリティのみが残っている。

## 変更点
- validateCommand → CommandValidator クラスに移動
- formatApiError → ContextBuilder クラスに移動
- 残存機能のみを保持
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

// Fallback Mock Response（デモモード用）
export function getMockResponse(message, context = {}) {
    const cmd = message.toLowerCase();
    
    if (cmd.includes('help') || cmd.includes('ヘルプ')) {
        return {
            message: `🤖 AI File Manager のコマンド一覧（RDD版 + Web検索対応）：
        
**📋 基本コマンド:**
• **ファイル作成** - "新しいファイルを作って" "sample.txt を作成"
• **ディレクトリ作成** - "フォルダを作って" "documents フォルダを作成"
• **ファイル読み込み** - "ファイルを読んで" "内容を表示して"  
• **ファイル編集** - "ファイルを編集して" "内容を変更して"
• **ファイルコピー** - "ファイルをコピーして" "backup フォルダにコピー"
• **ファイル移動** - "ファイルを移動して" "フォルダを移動"
• **ファイル削除** - "ファイルを削除して" "不要なファイルを消して"
• **ファイル一覧** - "ファイル一覧" "何があるか教えて"

**🔍 Web検索・リサーチ（新機能）:**
• **一般検索** - "〜について調べて" "〜を検索して"
• **最新情報** - "最新のAI技術は？" "今の株価は？"
• **技術情報** - "React 18の新機能は？" "TypeScript最新版"
• **比較・調査** - "iPhone vs Android" "プログラミング言語比較"
• **ニュース・トレンド** - "今日のニュース" "最新トレンド"

**🔄 一括操作:**
• **一括削除** - "全ての .txt ファイルを削除して"
• **一括コピー** - "画像ファイル全部を images フォルダにコピー"
• **一括移動** - "古いファイルを全部 archive に移動"

**🤖 マルチエージェントシステム:**
• **ファイル操作エキスパート** - ファイル/フォルダの操作
• **コンテンツ分析エキスパート** - ファイル内容の読み込み・分析
• **Web検索エキスパート** - インターネット検索・リサーチ（新追加）
• **汎用アシスタント** - 一般的な質問・ヘルプ

**📱 操作方法:**
• **ファイル表示** - ファイルをクリックでプレビュー
• **ファイル操作** - ファイルを長押しで操作メニュー表示
• **複数選択** - Ctrl/Cmd + クリックで複数選択
• **編集切替** - 右上の✏️ボタンで編集/プレビュー切り替え
• **AIコマンド** - 自然な日本語でファイル操作・検索が可能
• **カスタムプロンプト** - 🧠ボタンでカスタムプロンプト有効/無効

**🔍 検索例:**
• "JavaScript フレームワーク 2024 最新動向を調べて"
• "OpenAI GPT-4の料金体系について検索して"
• "React vs Vue.js 比較情報を探して"
• "今日の為替レートを調べて"

**🏗️ 統合例:**
• "最新のNext.jsについて調べて、その設定ファイルを作って"
• "TypeScript設定のベストプラクティスを検索して、tsconfig.jsonを生成して"`,
            commands: []
        };
    }

    // 検索関連のモック応答を追加
    if (cmd.includes('検索') || cmd.includes('調べて') || cmd.includes('リサーチ')) {
        return {
            message: "Web検索を実行します。（デモモード: 検索API接続を確認してください）",
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
            custom_prompts: true,
            multi_agent_system: true,
            rdd_architecture: true,
            web_search: true,              // 新機能
            langchain_integration: true,   // 新機能
            search_history: true          // 新機能
        }
    };

    // LLM API keys
    status.providers.claude = !!process.env.ANTHROPIC_API_KEY;
    status.providers.openai = !!process.env.OPENAI_API_KEY;
    status.providers.gemini = !!process.env.GOOGLE_API_KEY;
    status.providers.local = true;

    // Search API keys (新規追加)
    status.providers.tavily_search = !!process.env.TAVILY_API_KEY;
    status.providers.google_search = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_CSE_ID);
    status.providers.duckduckgo_search = true; // No API key required

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
    console.log(`   🤖 multi_agent_system - マルチエージェントシステム`);
    
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