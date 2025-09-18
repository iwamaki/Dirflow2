/* =========================================
    プロンプト構造化システム
   ========================================= */

/*

## 概要
LLMリクエスト用のプロンプトを動的に構築するモジュール。
システムプロンプト、カスタムプロンプト、会話履歴、コンテキスト情報を統合。

## 主要機能
- SYSTEM_PROMPTS: ベースプロンプト、ルーター、統合指示を定義
- CONTEXT_TEMPLATES: コンテキスト情報テンプレート
- PromptBuilder: プロンプト構築ロジック（複数LLMプロバイダー対応）
- createPromptBuilder(): ファクトリー関数
- logPromptDebugInfo(): デバッグ用ログ出力

## 対応プロバイダー
Claude, OpenAI, Gemini, Local LLM の異なるプロンプト形式に対応
*/

// システムプロンプト定義（空：各エージェントが独自プロンプトを持つ）
export const SYSTEM_PROMPTS = {};

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

    // システムプロンプトを構築（シングルプロンプト化）
    buildSystemPrompt() {
        // カスタムプロンプトがある場合はそれだけを使用
        if (this.customPrompt && this.customPrompt.content) {
            return this.customPrompt.content;
        }

        // カスタムプロンプトがない場合はベースプロンプト + コンテキスト情報
        let prompt = this.systemPrompt;

        // コンテキスト情報を追加
        if (SYSTEM_PROMPTS.contextTemplate) {
            prompt += '\n\n' + SYSTEM_PROMPTS.contextTemplate;
        }

        // テンプレート変数を置換
        return this._replaceTemplateVars(prompt, this.context);
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
    return new PromptBuilder();
}

// デバッグ用ログ出力
export function logPromptDebugInfo(promptData, provider) {
    if (true) { // デバッグログを強制的に有効化
        console.log(`--- ${provider.toUpperCase()} API Request ---`);
        console.log('Prompt Data:');
        console.log(JSON.stringify(promptData, null, 2).replace(/\\n/g, '\n'));
        console.log('--------------------------');
    }
}