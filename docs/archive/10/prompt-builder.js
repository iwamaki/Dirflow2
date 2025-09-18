/* =========================================
    プロンプト構造化システム
   ========================================= */

/*

## 概要
大規模言語モデル（LLM）へのリクエストに使用するプロンプトを、システムプロンプト、カスタムプロンプト、会話履歴、現在のコンテキスト情報に基づいて動的に構築するモジュール。

## 主要機能
- **定数**: SYSTEM_PROMPTS: ファイルマネージャーの基本指示、コンテキストテンプレート、カスタムプロンプト統合指示を定義。
- **定数**: CONTEXT_TEMPLATES: 基本、カスタムプロンプトあり、ファイルオープン時のコンテキスト情報テンプレートを定義。
- **クラス**: PromptBuilder: プロンプト構築のロジックをカプセル化。
    - `setSystemPrompt(promptKey)`: ベースとなるシステムプロンプトを設定。
    - `setCustomPrompt(customPrompt)`: ユーザー定義のカスタムプロンプトを設定。
    - `setContext(context)`: 現在のアプリケーションコンテキスト（ディレクトリ、ファイル情報など）を設定。
    - `setConversationHistory(history)`: 過去の会話履歴を設定。
    - `setMaxHistoryItems(max)`: 会話履歴の最大数を設定。
    - `setUserMessage(message)`: ユーザーからの現在のメッセージを設定。
    - `_replaceTemplateVars(text, context)`: テンプレート内の変数を実際の値に置換。
    - `buildSystemPrompt()`: ベースプロンプトとカスタムプロンプトを統合した最終的なシステムプロンプトを構築。
    - `buildContextInfo()`: 現在のコンテキスト情報（ディレクトリ、ファイルなど）を構築。
    - `buildConversationHistory(provider)`: LLMプロバイダーの形式に合わせて会話履歴を構築。
    - `buildFinalUserMessage()`: 最終的なユーザーメッセージとコンテキスト情報を結合。
    - `buildForProvider(provider)`: 指定されたLLMプロバイダー向けの完全なプロンプト構造を構築。
- **関数**: createPromptBuilder(): `PromptBuilder`のインスタンスを生成するファクトリー関数。
- **関数**: logPromptDebugInfo(promptData, provider): デバッグ用に構築されたプロンプトデータをコンソールに出力。

## 依存関係
- **インポート**: なし
- **エクスポート**: SYSTEM_PROMPTS, CONTEXT_TEMPLATES, PromptBuilder, createPromptBuilder, logPromptDebugInfo

## 特記事項
- 複数のLLMプロバイダー（Claude, OpenAI, Gemini, Local LLM）の異なるプロンプト形式に対応。
- ユーザーのカスタムプロンプトとファイル操作指示を柔軟に統合。
- 現在のファイルシステムの状態や開いているファイルの情報などをプロンプトに含めることで、LLMがより適切な応答を生成できるように支援。
- 会話履歴を管理し、プロンプトの長さを最適化。
- デバッグフラグに応じて、構築されたプロンプトの詳細をログ出力する機能。

*/

// ベースシステムプロンプト定義
export const SYSTEM_PROMPTS = {
    fileManager: `あなたは高度なAIファイルマネージャーのアシスタントです。
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

基本ルール:
1. 必ずmessageフィールドを含める
2. ファイル操作不要な場合は commands: [] を使用
3. パスは現在のディレクトリからの相対パスまたは絶対パス
4. 危険な操作（削除）の場合は確認メッセージを含める
5. エラーが予想される場合は事前に警告する
6. レスポンスは必ずJSONとして有効な形式にする
7. 自然で親しみやすい口調で応答する`,

    router: `あなたは高度なルーティング専門AIです。
ユーザーの入力を分析し、最適な専門エージェントを選択してタスクを振り分けます。

利用可能な専門エージェント：
1. file_operations - ファイル・ディレクトリの操作（作成、編集、削除、移動、コピー等）
2. content_analysis - ファイル内容の読み込み、分析、確認、一覧表示
3. general_assistant - 一般的な質問応答、説明、ヘルプ

必ず以下のJSON形式で応答してください：
{
  "agent": "選択されたエージェント名",
  "reasoning": "選択理由",
  "user_intent": "ユーザーの意図の要約",
  "refined_message": "専門エージェントに送る最適化されたメッセージ"
}

例：
- "新しいファイルを作って" → file_operations
- "README.mdを読んで" → content_analysis
- "使い方を教えて" → general_assistant`,

    contextTemplate: `現在の状態:
- ディレクトリ: {{CURRENT_PATH}}
- ファイル数: {{FILE_COUNT}}
- ファイル一覧: {{FILE_LIST}}
- 会話履歴数: {{HISTORY_COUNT}}
- 現在編集中: {{CURRENT_FILE}}`,

    customPromptIntegration: `=== 統合指示 ===
上記のカスタムプロンプトの性格・役割・指示に従いつつ、ファイル操作が必要な場合は必ずJSON形式で応答してください。
カスタムプロンプトとファイル操作プロンプトの両方の要求を満たすよう心がけてください。`
};

// コンテキスト情報テンプレート
export const CONTEXT_TEMPLATES = {
    basic: `[コンテキスト情報]
現在のディレクトリ: {{CURRENT_PATH}}
ファイル数: {{FILE_COUNT}}
現在編集中: {{CURRENT_FILE}}`,

    withCustomPrompt: `[コンテキスト情報]
現在のディレクトリ: {{CURRENT_PATH}}
ファイル数: {{FILE_COUNT}}
現在編集中: {{CURRENT_FILE}}
カスタムプロンプト: {{CUSTOM_PROMPT_NAME}} (有効)`,

    withOpenFile: `[コンテキスト情報]
現在のディレクトリ: {{CURRENT_PATH}}
ファイル数: {{FILE_COUNT}}
現在編集中: {{CURRENT_FILE}}

[現在開いているファイルの詳細]
{{OPEN_FILE_INFO}}`
};

// プロンプトビルダークラス
export class PromptBuilder {
    constructor() {
        this.systemPrompt = '';
        this.userMessage = '';
        this.context = {};
        this.conversationHistory = [];
        this.customPrompt = null;
        this.maxHistoryItems = 15;  // デフォルトの履歴数
    }

    // システムプロンプトを設定
    setSystemPrompt(promptKey) {
        if (SYSTEM_PROMPTS[promptKey]) {
            this.systemPrompt = SYSTEM_PROMPTS[promptKey];
        } else {
            throw new Error(`Unknown system prompt: ${promptKey}`);
        }
        return this;
    }

    // カスタムプロンプトを設定
    setCustomPrompt(customPrompt) {
        this.customPrompt = customPrompt;
        return this;
    }

    // コンテキスト情報を設定
    setContext(context) {
        this.context = context;
        return this;
    }

    // 会話履歴を設定
    setConversationHistory(history) {
        this.conversationHistory = history || [];
        return this;
    }

    // 履歴制限を設定
    setMaxHistoryItems(max) {
        this.maxHistoryItems = max;
        return this;
    }

    // ユーザーメッセージを設定
    setUserMessage(message) {
        this.userMessage = message;
        return this;
    }

    // テンプレート変数を置換
    _replaceTemplateVars(text, context) {
        const fileList = context.fileList || [];
        const conversationHistory = context.conversationHistory || [];
        
        return text
            .replace('{{CURRENT_PATH}}', context.currentPath || '/workspace')
            .replace('{{FILE_COUNT}}', fileList.length)
            .replace('{{FILE_LIST}}', JSON.stringify(fileList, null, 2))
            .replace('{{HISTORY_COUNT}}', conversationHistory.length)
            .replace('{{CURRENT_FILE}}', context.currentFile || 'なし')
            .replace('{{CUSTOM_PROMPT_NAME}}', this.customPrompt?.name || '')
            .replace('{{OPEN_FILE_INFO}}', context.openFileInfo || '');
    }

    // 最終的なシステムプロンプト（ベースプロンプトとカスタムプロンプトを統合）を構築
    buildSystemPrompt() {
        let combinedPrompt = '';
        
        // カスタムプロンプトがある場合
        if (this.customPrompt && this.customPrompt.content) {
            combinedPrompt += `=== カスタムシステムプロンプト ===\n`;
            combinedPrompt += `プロンプト名: ${this.customPrompt.name}\n`;
            if (this.customPrompt.description) {
                combinedPrompt += `説明: ${this.customPrompt.description}\n`;
            }
            combinedPrompt += `\n${this.customPrompt.content}\n\n`;
        }
        
        // ベースプロンプト（ファイル操作機能）
        combinedPrompt += `=== ファイル操作システムプロンプト ===\n`;
        combinedPrompt += this.systemPrompt;
        
        // コンテキスト情報を追加
        if (SYSTEM_PROMPTS.contextTemplate) {
            combinedPrompt += '\n\n' + SYSTEM_PROMPTS.contextTemplate;
        }
        
        // カスタムプロンプト統合指示
        if (this.customPrompt && this.customPrompt.content) {
            combinedPrompt += '\n\n' + SYSTEM_PROMPTS.customPromptIntegration;
        }
        
        // テンプレート変数を置換
        return this._replaceTemplateVars(combinedPrompt, this.context);
    }

    // コンテキスト情報を構築
    buildContextInfo() {
        let template;
        
        if (this.context.openFileInfo) {
            template = CONTEXT_TEMPLATES.withOpenFile;
        } else if (this.customPrompt && this.customPrompt.enabled) {
            template = CONTEXT_TEMPLATES.withCustomPrompt;
        } else {
            template = CONTEXT_TEMPLATES.basic;
        }
        
        return this._replaceTemplateVars(template, this.context);
    }

    // 会話履歴を構築（プロバイダー別）
    buildConversationHistory(provider) {
        const recentHistory = this.conversationHistory.slice(-this.maxHistoryItems);
        const messages = [];
        
        switch (provider) {
            case 'claude':
                for (const exchange of recentHistory) {
                    messages.push({ role: 'user', content: exchange.user });
                    if (exchange.ai) {
                        messages.push({ role: 'assistant', content: exchange.ai });
                    }
                }
                break;
                
            case 'openai':
            case 'local':
                for (const exchange of recentHistory) {
                    messages.push({ role: 'user', content: exchange.user });
                    if (exchange.ai) {
                        messages.push({ role: 'assistant', content: exchange.ai });
                    }
                }
                break;
                
            case 'gemini':
                // Gemini用の履歴形式を改善
                if (recentHistory.length > 0) {
                    let historyText = '';
                    for (const exchange of recentHistory) {
                        historyText += `【ユーザー】\n${exchange.user}\n\n`;
                        if (exchange.ai) {
                            // JSONレスポンスの場合は簡略表示
                            const aiResponse = exchange.ai;
                            try {
                                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    const parsed = JSON.parse(jsonMatch[0]);
                                    historyText += `【アシスタント】\n${parsed.message || aiResponse}\n\n`;
                                } else {
                                    historyText += `【アシスタント】\n${aiResponse}\n\n`;
                                }
                            } catch (e) {
                                historyText += `【アシスタント】\n${aiResponse}\n\n`;
                            }
                        }
                    }
                    return historyText;
                }
                return '';
        }
        
        return messages;
    }

    // 最終的なユーザーメッセージを構築
    buildFinalUserMessage() {
        const contextInfo = this.buildContextInfo();
        return `${this.userMessage}\n\n${contextInfo}`;
    }

    // プロバイダー別の完全なプロンプトを構築
    buildForProvider(provider) {
        const systemPrompt = this.buildSystemPrompt();
        
        switch (provider) {
            case 'claude':
                const claudeMessages = this.buildConversationHistory('claude');
                claudeMessages.push({
                    role: 'user',
                    content: this.buildFinalUserMessage()
                });
                return {
                    system: systemPrompt,
                    messages: claudeMessages
                };
                
            case 'openai':
            case 'local':
                const messages = [{ role: 'system', content: systemPrompt }];
                const history = this.buildConversationHistory(provider);
                messages.push(...history);
                messages.push({
                    role: 'user',
                    content: this.buildFinalUserMessage()
                });
                return { messages };
                
            case 'gemini':
                const historyText = this.buildConversationHistory('gemini');
                const userMessage = this.buildFinalUserMessage();
                
                // Gemini向けにプロンプト構造を明確化
                const fullContent = 
                    "【システムプロンプト】\n" + systemPrompt + "\n\n" + 
                    "【過去の会話】\n" + historyText + 
                    "【現在の質問】\n【ユーザー】\n" + userMessage;
                return { content: fullContent };
                
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
}

// ファクトリー関数
export function createPromptBuilder() {
    return new PromptBuilder().setSystemPrompt('fileManager');
}

// デバッグ用ログ出力
export function logPromptDebugInfo(promptData, provider) {
    if (true) { // デバッグログを強制的に有効化
        console.log(`--- ${provider.toUpperCase()} API Request ---`);
        console.log('Prompt Data:', JSON.stringify(promptData, null, 2));
        console.log('--------------------------');
    }
}