/* =========================================
    マルチエージェント・ルーティングシステム
   ========================================= */

/*
## 概要
窓口LLM（Router Agent）と専門LLM（Specialist Agents）を管理し、
ユーザーの意図に基づいて適切な専門エージェントにタスクを振り分けるシステム。

## 主要機能
- 意図認識とルーティング
- 専門エージェントの定義と管理
- 多段階タスクの実行制御
*/

import { createPromptBuilder } from './prompt-builder.js';

// 専門エージェントの定義
export const SPECIALIST_AGENTS = {
    file_operations: {
        name: 'ファイル操作エキスパート',
        description: 'ファイル・ディレクトリの作成、編集、削除、移動、コピー等の操作を専門とする',
        systemPrompt: `あなたはファイル操作の専門家です。
ユーザーの指示に基づいて、効率的かつ安全にファイル操作を実行します。

利用可能なアクション：
- create_file: ファイル作成
- create_directory: ディレクトリ作成
- edit_file: ファイル編集
- copy_file: ファイルコピー
- move_file: ファイル移動
- delete_file: ファイル削除
- batch_delete: 一括削除
- batch_copy: 一括コピー
- batch_move: 一括移動

必ずJSON形式で応答してください：
{
  "message": "操作の説明",
  "commands": [
    {
      "action": "アクション名",
      "path": "ファイルパス",
      "content": "内容（必要な場合）",
      "description": "操作の説明"
    }
  ]
}`,
        tools: ['create_file', 'create_directory', 'edit_file', 'copy_file', 'move_file', 'delete_file', 'batch_delete', 'batch_copy', 'batch_move'],
        keywords: ['ファイル', 'ディレクトリ', 'フォルダ', '作成', '削除', '移動', 'コピー', '編集', '保存', '一括']
    },

    content_analysis: {
        name: 'コンテンツ分析エキスパート',
        description: 'ファイル内容の読み込み、分析、要約、検索を専門とする',
        systemPrompt: `あなたはコンテンツ分析の専門家です。
ファイルの内容を読み込んで分析し、ユーザーに有用な情報を提供します。

利用可能なアクション：
- read_file: ファイル読み込み
- list_files: ファイル一覧表示

必ずJSON形式で応答してください：
{
  "message": "分析結果の説明",
  "commands": [
    {
      "action": "read_file",
      "path": "ファイルパス",
      "description": "読み込みの目的"
    }
  ]
}`,
        tools: ['read_file', 'list_files'],
        keywords: ['読み込み', '読んで', '内容', '確認', '表示', 'リスト', '一覧', '分析', '要約', '検索']
    },

    general_assistant: {
        name: '汎用アシスタント',
        description: '一般的な質問応答、説明、ガイダンスを提供する',
        systemPrompt: `あなたは親切で知識豊富なAIファイルマネージャーアシスタントです。
ユーザーの質問に自然で丁寧に答えます。

あなたの役割：
- ファイル管理システムの使い方の説明
- 一般的な質問への回答
- システムの機能やヘルプの提供
- 親しみやすい会話とサポート

必ずJSON形式で応答してください：
{
  "message": "自然で親しみやすい回答（日本語）",
  "commands": []
}

基本ルール：
1. 自然で親しみやすい口調で話す
2. ファイル操作は他の専門エージェントが担当するため、commands: [] を使用
3. システムの機能や使い方について聞かれた場合は詳しく説明
4. わからないことがあれば正直に伝える
5. ユーザーが困っていることを理解し、適切なガイダンスを提供`,
        tools: [],
        keywords: ['ヘルプ', 'help', '説明', '方法', 'どうやって', 'なに', '何', '教えて', 'わからない', '仕事', '機能', '使い方']
    }
};

// 窓口LLM用のプロンプト
export const ROUTER_SYSTEM_PROMPT = `あなたは高度なルーティング専門AIです。
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
- "使い方を教えて" → general_assistant`;

// 意図認識とルーティング
export class AgentRouter {

    // ユーザーの意図を分析し、適切な専門エージェントを選択
    static async routeToAgent(userMessage, context, provider, model) {
        try {
            console.log('🚪 Router: Analyzing user intent...');

            // 窓口LLMに意図分析を依頼
            const routingDecision = await this.getRoutingDecision(userMessage, context, provider, model);

            if (!routingDecision.agent || !SPECIALIST_AGENTS[routingDecision.agent]) {
                console.warn('⚠️ Router: Invalid agent selected, falling back to general_assistant');
                routingDecision.agent = 'general_assistant';
                routingDecision.refined_message = userMessage;
            }

            console.log(`🎯 Router: Selected agent: ${routingDecision.agent}`);
            console.log(`💭 Router: User intent: ${routingDecision.user_intent}`);

            // 選択された専門エージェントでタスクを実行
            const result = await this.executeWithSpecialist(
                routingDecision.agent,
                routingDecision.refined_message,
                context,
                provider,
                model
            );

            // ルーティング情報を結果に付加
            result.routing = {
                selectedAgent: routingDecision.agent,
                userIntent: routingDecision.user_intent,
                reasoning: routingDecision.reasoning
            };

            return result;

        } catch (error) {
            console.error('❌ Router: Error in routing process:', error);

            // エラー時は汎用アシスタントにフォールバック
            return await this.executeWithSpecialist(
                'general_assistant',
                userMessage,
                context,
                provider,
                model
            );
        }
    }

    // 窓口LLMで意図分析・エージェント選択
    static async getRoutingDecision(userMessage, context, provider, model) {
        // ルーティング専用のコンテキスト（最小限の情報のみ）
        const routingContext = {
            currentPath: context.currentPath,
            hasOpenFile: !!context.currentFile,
            messageLength: userMessage.length
        };

        // ルーティング用メッセージを構築
        const routingMessage = `ユーザーメッセージ: "${userMessage}"`;

        // ルーティング専用のコンテキスト（ROUTER_SYSTEM_PROMPTを適用）
        const routingContextWithPrompt = {
            ...routingContext,
            customPrompt: {
                enabled: true,
                name: 'Router System',
                content: ROUTER_SYSTEM_PROMPT
            },
            conversationHistory: [] // 履歴も不要
        };

        // LLM APIを直接呼び出し（llm-providers.jsの関数を使用）
        const { callClaudeAPI, callOpenAIAPI, callGeminiAPI, callLocalLLMAPI } = await import('./llm-providers.js');

        let response;

        // ルーティング用の特別なAPI呼び出し（システムプロンプトをROUTER_SYSTEM_PROMPTに変更）
        switch (provider) {
            case 'claude':
                response = await callClaudeAPI(routingMessage, model, routingContextWithPrompt);
                break;
            case 'openai':
                response = await callOpenAIAPI(routingMessage, model, routingContextWithPrompt);
                break;
            case 'gemini':
                response = await callGeminiAPI(routingMessage, model, routingContextWithPrompt);
                break;
            case 'local':
                response = await callLocalLLMAPI(routingMessage, model, routingContextWithPrompt);
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }

        // JSON応答をパース
        try {
            const parsed = JSON.parse(response);
            return {
                agent: parsed.agent || 'general_assistant',
                reasoning: parsed.reasoning || 'No reasoning provided',
                user_intent: parsed.user_intent || userMessage,
                refined_message: parsed.refined_message || userMessage
            };
        } catch (parseError) {
            console.warn('⚠️ Router: Failed to parse routing decision, using fallback');

            // 簡単なキーワードベースのフォールバック
            return this.keywordBasedRouting(userMessage);
        }
    }

    // 専門エージェントでタスク実行
    static async executeWithSpecialist(agentName, message, context, provider, model) {
        const agent = SPECIALIST_AGENTS[agentName];
        if (!agent) {
            throw new Error(`Unknown specialist agent: ${agentName}`);
        }

        console.log(`🔧 Executing with ${agent.name}...`);

        // 専門エージェント用のコンテキスト（専用システムプロンプトを適用）
        const specialistContext = {
            ...context,
            customPrompt: {
                enabled: true,
                name: agent.name,
                content: agent.systemPrompt
            },
            conversationHistory: context.conversationHistory || []
        };

        // LLM APIを呼び出し（メッセージを文字列として渡す）
        const { callClaudeAPI, callOpenAIAPI, callGeminiAPI, callLocalLLMAPI, parseStructuredResponse } = await import('./llm-providers.js');

        let response;
        switch (provider) {
            case 'claude':
                response = await callClaudeAPI(message, model, specialistContext);
                break;
            case 'openai':
                response = await callOpenAIAPI(message, model, specialistContext);
                break;
            case 'gemini':
                response = await callGeminiAPI(message, model, specialistContext);
                break;
            case 'local':
                response = await callLocalLLMAPI(message, model, specialistContext);
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }

        // 応答をパース
        const parsedResponse = parseStructuredResponse(response);

        return {
            message: parsedResponse.message,
            commands: parsedResponse.commands || [],
            rawResponse: response,
            provider,
            model,
            timestamp: new Date().toISOString(),
            parseSuccess: parsedResponse.success,
            warning: parsedResponse.warning,
            agentUsed: agentName,
            agentName: agent.name
        };
    }

    // キーワードベースのフォールバックルーティング
    static keywordBasedRouting(message) {
        const lowerMessage = message.toLowerCase();

        // ファイル操作キーワードをチェック
        const fileOpKeywords = SPECIALIST_AGENTS.file_operations.keywords;
        if (fileOpKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return {
                agent: 'file_operations',
                reasoning: 'Keyword-based routing (file operations detected)',
                user_intent: 'ファイル操作',
                refined_message: message
            };
        }

        // コンテンツ分析キーワードをチェック
        const contentKeywords = SPECIALIST_AGENTS.content_analysis.keywords;
        if (contentKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return {
                agent: 'content_analysis',
                reasoning: 'Keyword-based routing (content analysis detected)',
                user_intent: 'コンテンツ確認',
                refined_message: message
            };
        }

        // デフォルト: 汎用アシスタント
        return {
            agent: 'general_assistant',
            reasoning: 'Keyword-based fallback to general assistant',
            user_intent: '一般的な質問',
            refined_message: message
        };
    }

    // 利用可能なエージェント一覧を取得
    static getAvailableAgents() {
        return Object.keys(SPECIALIST_AGENTS).map(key => ({
            id: key,
            name: SPECIALIST_AGENTS[key].name,
            description: SPECIALIST_AGENTS[key].description,
            tools: SPECIALIST_AGENTS[key].tools
        }));
    }
}