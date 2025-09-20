/* =========================================
    エージェント選択・実行制御
   ========================================= */

/*
## 概要
ユーザーの意図に基づいて適切な専門エージェントを選択し、タスクの実行を制御する責任を持つ。

## 責任
- ユーザー意図の分析
- 適切な専門エージェントの選択
- 専門エージェントでのタスク実行
- エージェント間の協調制御
*/

import { json } from 'stream/consumers';
import { LLMAdapter } from './llm-adapter.js';
import { WebSearchService } from '../tool/web-search-service.js';

// 窓口LLM用のプロンプト
const ROUTER_SYSTEM_PROMPT = `あなたは高度なルーティング専門AIです。
ユーザーの入力を分析し、最適な専門エージェントを選択してタスクを振り分けます。

## 利用可能な専門エージェント：
1. **file_operations** - ファイル・ディレクトリの操作（作成、編集、削除、移動、コピー等）
2. **content_analysis** - ファイル内容の読み込み、分析、確認、一覧表示
3. **web_search** - インターネット検索、情報収集、リサーチ、最新情報の取得
4. **general_assistant** - 一般的な質問応答、説明、ヘルプ

ユーザー入力とエージェント選択の基準：

**file_operations:**
- "ファイルを作成"、"フォルダを作って"、"削除して"、"コピー"、"移動"
- "保存"、"編集"、"一括操作"
- 具体的なファイル操作が必要な指示

**content_analysis:**
- "ファイルを読んで"、"内容を確認"、"リストアップ"
- "分析して"、"要約して"（既存ファイルに対して）
- ローカルファイルの内容に関する質問

**web_search:**
- "検索して"、"調べて"、"最新情報"、"リサーチ"
- "ニュース"、"トレンド"、"比較"、"口コミ"
- "〜について教えて"（インターネット上の情報が必要な場合）
- "今の状況"、"現在の"（最新情報が必要）
- 技術情報、製品情報、価格比較等

**general_assistant:**
- "使い方"、"ヘルプ"、"機能"、"説明"
- アプリケーション自体に関する質問
- 明確な操作が伴わない一般的な会話

応答形式：
以下の構造を守ってください：
{
  "agent": "選択されたエージェント名",
  "reasoning": "選択理由",
  "user_intent": "ユーザーの意図の要約",
  "refined_message": "専門エージェントに送る最適化されたメッセージ"
}

基本ルール：
- 応答は必ず有効なJSON形式で、余計なテキストやマークダウンを含めないでください。
- JSONパースエラーを避けるため、厳密なJSON形式を守ってください。`;

// 専門エージェントの定義
export const SPECIALIST_AGENTS = {
    file_operations: {
        name: 'ファイル操作エキスパート',
        description: 'ファイル・ディレクトリの作成、編集、削除、移動、コピー等の操作を専門とする',
        systemPrompt: `あなたはファイル操作の専門家です。
ユーザーとの自然な会話を行いながら、効率的かつ安全にファイル操作を実行します。

利用可能なアクション：
- create_file: ファイル作成 (path, content?, description?)
- create_directory: ディレクトリ作成 (path, description?)
- edit_file: ファイル編集 (path, content, description?)
- copy_file: ファイルコピー (source, destination, description?)
- move_file: ファイル移動/名前変更 (source, destination, description?)
- delete_file: ファイル削除 (path, description?)
- batch_delete: 一括削除 (paths[], description?)
- batch_copy: 一括コピー (sources[], destination, description?)
- batch_move: 一括移動 (sources[], destination, description?)

応答形式：
{
  "message": "ユーザーへの自然な応答メッセージ（必須）",
  "commands": [
    {
      "action": "アクション名",
      "path": "ファイルパス",
      "content": "内容（必要な場合）",
      "description": "操作の説明"
    }
  ],
  "suggest_reset": false
}

基本ルール：
1. 必ずmessageフィールドを含める
2. ファイル操作不要な場合は commands: [] を使用
3. パスは現在のディレクトリからの相対パスまたは絶対パス
4. 危険な操作（削除）の場合は確認メッセージを含める
5. エラーが予想される場合は事前に警告する
6. タスクが完了したと判断したら "suggest_reset": true を設定
`,
        tools: ['create_file', 'create_directory', 'edit_file', 'copy_file', 'move_file', 'delete_file', 'batch_delete', 'batch_copy', 'batch_move'],
    },

    content_analysis: {
        name: 'コンテンツ分析エキスパート',
        description: 'ファイル内容の読み込み、分析、要約、検索を専門とする',
        systemPrompt: `あなたはコンテンツ分析の専門家です。
ユーザーとの自然な会話を行いながら、ファイルの内容を読み込んで分析し、有用な情報を提供します。

利用可能なアクション：
- read_file: ファイル読み込み (path, description?)
- list_files: ファイル一覧表示 (path?, description?)

応答形式：
{
  "message": "ユーザーへの自然な応答メッセージ（必須）",
  "commands": [
    {
      "action": "read_file",
      "path": "ファイルパス",
      "description": "読み込みの目的"
    }
  ],
  "suggest_reset": false
}

基本ルール：
1. 必ずmessageフィールドを含める
2. ファイル操作不要な場合は commands: [] を使用
3. ファイル内容を分析して要約・説明を提供する
4. ユーザーが求める情報を的確に抽出する
5. タスクが完了したと判断したら "suggest_reset": true を設定
`,
        tools: ['read_file', 'list_files'],
    },

    general_assistant: {
        name: '汎用アシスタント',
        description: '一般的な質問応答、説明、ガイダンスを提供する',
        systemPrompt: `あなたは親切で知識豊富なAIファイルマネージャーアシスタントです。
ユーザーとの自然な会話を行い、システムの説明やガイダンスを提供します。

あなたの役割：
- ファイル管理システムの使い方の説明
- 一般的な質問への回答
- システムの機能やヘルプの提供
- 親しみやすい会話とサポート

応答形式：
{
  "message": "ユーザーへの自然で親しみやすい回答（日本語）",
  "commands": []
}

基本ルール：
1. 必ずmessageフィールドを含める
2. 自然で親しみやすい口調で話す
3. ファイル操作は他の専門エージェントが担当するため、常に commands: [] を使用
4. システムの機能や使い方について聞かれた場合は詳しく説明
5. わからないことがあれば正直に伝える
6. ユーザーが困っていることを理解し、適切なガイダンスを提供
7. レスポンスは必ずJSONとして有効な形式にする

注意：
- 汎用アシスタントは基本的にタスクリセットを提案しません
- 継続的な会話を前提としています`,
        tools: [],
    }
};

const WEB_SEARCH_AGENT = {
    web_search: {
        name: 'Web検索エキスパート',
        description: 'インターネット検索、情報収集、リサーチを専門とする',
        systemPrompt: `あなたはWeb検索とリサーチの専門家です。
ユーザーとの自然な会話を行いながら、インターネットから最新の情報を検索・収集し、有用な情報を提供します。

利用可能なアクション：
- web_search: Web検索実行 (query, options?, description?)
  - query: 検索クエリ（必須）
  - options: 検索オプション（省略可）
    - maxResults: 最大結果数（デフォルト: 10）
    - provider: 検索プロバイダー（'auto', 'tavily', 'google', 'duckduckgo'）
    - language: 言語設定（デフォルト: 'ja'）
    - region: 地域設定（デフォルト: 'jp'）
  - description: 検索の目的や説明

検索のベストプラクティス：
- 日本語のクエリは日本語で検索
- 技術的な情報は英語での検索も併用
- トレンドや最新情報は時間軸を意識
- 複数の角度から情報を収集
- 情報源の多様性を確保

応答形式：
{
  "message": "ユーザーへの自然な応答メッセージ（検索結果の要約と分析を含む）",
  "commands": [
    {
      "action": "web_search",
      "query": "検索クエリ",
      "options": {
        "maxResults": 10,
        "provider": "auto",
        "language": "ja"
      },
      "description": "検索の目的"
    }
  ],
  "suggest_reset": false
}

基本ルール：
1. 必ずmessageフィールドを含める
2. 検索不要な場合は commands: [] を使用
3. 検索結果を分析し、要約して提供する
4. 信頼できる情報源を優先し、情報の信頼性を評価する
5. 複数の検索が必要な場合は段階的に実行する
6. 最新情報が重要な場合はその旨を明記する
7. タスクが完了したと判断したら "suggest_reset": true を設定

`,
        tools: ['web_search'],
    }
};



export class AgentDispatcher {
    constructor() {
        this.llmAdapter = new LLMAdapter();
        this.webSearchService = new WebSearchService();
        this.agents = {
            ...SPECIALIST_AGENTS,
            ...WEB_SEARCH_AGENT
        };
        this.currentAgent = null;
        this.sessionStartTime = Date.now();
    }

    /**
     * メイン処理: ユーザー意図を分析し、適切なエージェントで実行
     */
    async dispatch(message, provider, model, context) {
        try {
            // 現在エージェントが選択されている場合は継続対話
            if (this.currentAgent && this.currentAgent !== 'general_assistant') {
                console.log(`🔄 Agent Dispatcher: Continuing with ${this.currentAgent}...`);
                const result = await this._executeWithAgent(
                    this.currentAgent,
                    message,
                    context,
                    provider,
                    model
                );
                result.routing = {
                    selectedAgent: this.currentAgent,
                    userIntent: 'タスク継続',
                    reasoning: 'Continuing with selected agent',
                    routingSkipped: true
                };
                return result;
            }

            // ルーティング中（currentAgent = null or general_assistant）
            console.log('🚪 Agent Dispatcher: Analyzing user intent...');
            const routingDecision = await this._analyzeIntent(message, context, provider, model);
            const selectedAgent = this._validateSelectedAgent(routingDecision.agent);

            console.log(`🎯 Agent Dispatcher: Selected agent: ${selectedAgent}`);
            console.log(`💭 Agent Dispatcher: User intent: ${routingDecision.user_intent}`);

            // 専門エージェントが決定したら保存（general_assistantは除く）
            if (selectedAgent !== 'general_assistant') {
                this.currentAgent = selectedAgent;
                console.log(`✅ Agent locked: ${selectedAgent}`);
            }

            const result = await this._executeWithAgent(
                selectedAgent,
                routingDecision.refined_message,
                context,
                provider,
                model
            );

            result.routing = {
                selectedAgent: selectedAgent,
                userIntent: routingDecision.user_intent,
                reasoning: routingDecision.reasoning,
                routingSkipped: false
            };

            return result;

        } catch (error) {
            console.error('❌ Agent Dispatcher Error:', error);
            throw error;
        }
    }

    /**
     * ユーザー意図を分析し、エージェントを選択
     */
    async _analyzeIntent(message, context, provider, model) {
        try {
            console.log('🤖 Agent Dispatcher: Using LLM routing for user intent analysis');

            const routingContext = {
                currentPath: context.currentPath,
                hasOpenFile: !!context.currentFile,
                messageLength: message.length,
                customPrompt: {
                    enabled: true,
                    name: 'Router System',
                    content: ROUTER_SYSTEM_PROMPT
                },
                conversationHistory: []
            };

            const response = await this.llmAdapter.callLLM(
                message,
                provider,
                model,
                routingContext
            );

            const parsedResponse = this._parseStructuredResponse(response);
            if (!parsedResponse.success) {
                throw new Error(`JSON extraction failed: ${parsedResponse.warning}`);
            }

            const routingData = JSON.parse(parsedResponse.message);
            return {
                agent: routingData.agent || 'general_assistant',
                reasoning: routingData.reasoning || 'LLM routing decision',
                user_intent: routingData.user_intent || message,
                refined_message: routingData.refined_message || message
            };

        } catch (parseError) {
            console.error('❌ Agent Dispatcher: JSON parse error:', parseError);
            throw new Error(`Routing failed: Unable to parse LLM response - ${parseError.message}`);
        }
    }

    /**
     * 選択されたエージェントの妥当性検証
     */
    _validateSelectedAgent(agentName) {
        if (!agentName || !this.agents[agentName]) {
            console.warn('⚠️ Agent Dispatcher: Invalid agent selected, falling back to general_assistant');
            return 'general_assistant';
        }
        return agentName;
    }

    /**
     * 専門エージェントでタスク実行 (web_search対応版)
     */
    async _executeWithAgent(agentName, message, context, provider, model) {
        const agent = this.agents[agentName];
        if (!agent) {
            throw new Error(`Unknown specialist agent: ${agentName}`);
        }

        console.log(`🔧 Executing with ${agent.name}...`);

        const specialistContext = {
            ...context,
            customPrompt: {
                enabled: true,
                name: agent.name,
                content: agent.systemPrompt
            },
            conversationHistory: context.conversationHistory || []
        };

        const response = await this.llmAdapter.callLLM(message, provider, model, specialistContext);
        const parsedResponse = this._parseStructuredResponse(response);

        if (parsedResponse.commands && parsedResponse.commands.length > 0) {
            await this._executeWebSearchCommands(parsedResponse.commands);

            // Web検索が実行された場合、結果を含めて再度LLMに問い合わせ
            const hasSearchCommands = parsedResponse.commands.some(cmd => cmd.action === 'web_search' && cmd.executed);
            if (hasSearchCommands) {
                return await this._generateSearchSummary(message, parsedResponse.commands, provider, model, specialistContext);
            }
        }

        const result = {
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

        if (parsedResponse.suggest_reset) {
            console.log('💡 Agent suggests session reset');
            result.suggestReset = true;
            this.currentAgent = null;
        }

        return result;
    }

    /**
     * Web検索結果を含む最終応答を生成
     */
    async _generateSearchSummary(originalMessage, commands, provider, model, context) {
        const searchCommands = commands.filter(cmd => cmd.action === 'web_search' && cmd.executed);

        // 検索結果をまとめる
        let searchResultsText = '';
        let totalResults = 0;

        for (const command of searchCommands) {
            if (command.searchResult && command.searchResult.success) {
                const results = command.searchResult.results;
                totalResults += results.length;

                searchResultsText += `\n\n**検索クエリ: "${command.query}"**\n`;
                results.forEach((result, index) => {
                    searchResultsText += `${index + 1}. **${result.title}**\n`;
                    searchResultsText += `   URL: ${result.url}\n`;
                    searchResultsText += `   概要: ${result.snippet}\n`;
                    if (result.source) {
                        searchResultsText += `   情報源: ${result.source}\n`;
                    }
                    searchResultsText += '\n';
                });
            } else {
                searchResultsText += `\n\n検索クエリ "${command.query}" で問題が発生: ${command.searchResult?.error || '不明なエラー'}\n`;
            }
        }

        // 検索結果を含む新しいプロンプトでLLMに要約を依頼
        const summaryPrompt = `以下の検索結果を基に、ユーザーの質問「${originalMessage}」に対する包括的で有用な回答を作成してください。

検索結果:
${searchResultsText}

要求:
1. 検索結果を分析して、重要な情報を抽出してください
2. 情報源を明記し、信頼性を評価してください
3. 最新の情報と既知の情報を区別してください
4. ユーザーにとって分かりやすく整理して回答してください
5. 必要に応じて複数の観点から情報を提供してください

JSON形式で応答してください：
{
  "message": "検索結果を基にした包括的な回答",
  "commands": [],
  "suggest_reset": false
}`;

        try {
            const summaryContext = {
                ...context,
                customPrompt: {
                    enabled: true,
                    name: 'Search Results Analyzer',
                    content: summaryPrompt
                }
            };

            const summaryResponse = await this.llmAdapter.callLLM(summaryPrompt, provider, model, summaryContext);
            const parsedSummary = this._parseStructuredResponse(summaryResponse);

            return {
                message: parsedSummary.message,
                commands: commands, // 元の検索コマンドを保持
                rawResponse: summaryResponse,
                provider,
                model,
                timestamp: new Date().toISOString(),
                parseSuccess: parsedSummary.success,
                warning: parsedSummary.warning,
                agentUsed: 'web_search',
                agentName: 'Web検索エキスパート',
                searchSummary: true,
                totalSearchResults: totalResults
            };

        } catch (error) {
            console.error('❌ Search summary generation failed:', error);

            // フォールバック: 検索結果を直接整形して返す
            return {
                message: `検索結果（${totalResults}件）:\n${searchResultsText}`,
                commands: commands,
                provider,
                model,
                timestamp: new Date().toISOString(),
                parseSuccess: true,
                agentUsed: 'web_search',
                agentName: 'Web検索エキスパート',
                searchSummary: true,
                totalSearchResults: totalResults,
                fallbackMode: true
            };
        }
    }

    /**
     * Web検索コマンドを実行
     */
    async _executeWebSearchCommands(commands) {
        for (let command of commands) {
            if (command.action === 'web_search') {
                try {
                    console.log(`🔍 Executing web search: ${command.query}`);
                    
                    const searchResult = await this.webSearchService.performSearch(
                        command.query,
                        command.options || {}
                    );

                    command.searchResult = searchResult;
                    command.executed = true;
                    command.executionTime = new Date().toISOString();

                    if (searchResult.success) {
                        console.log(`✅ Web search completed: ${searchResult.results.length} results`);
                    } else {
                        console.log(`❌ Web search failed: ${searchResult.error}`);
                    }

                } catch (error) {
                    console.error('❌ Web search execution error:', error);
                    command.searchResult = {
                        success: false,
                        error: error.message,
                        results: []
                    };
                    command.executed = false;
                }
            }
        }
    }

    /**
     * 会話リセット（新しいタスクの開始）
     */
    resetSession() {
        console.log('🔄 Agent Dispatcher: Session reset - returning to routing mode');
        this.currentAgent = null;
        this.sessionStartTime = Date.now();
    }

    /**
     * 現在のセッション状態を取得
     */
    getSessionStatus() {
        return {
            currentAgent: this.currentAgent,
            isRouting: this.currentAgent === null || this.currentAgent === 'general_assistant',
            sessionDuration: Date.now() - this.sessionStartTime
        };
    }

    /**
     * 構造化応答のパース
     */
    _parseStructuredResponse(response) {
        try {
            const markdownMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
            
            let jsonString;
            if (markdownMatch) {
                jsonString = markdownMatch[1];
                console.log('🔍 マークダウンブロックからJSONを抽出しました');
            } else {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    return { 
                        success: false,
                        message: response,
                        commands: [],
                        warning: "JSONが見つかりませんでした"
                    };
                }
                jsonString = jsonMatch[0];
            }
            
            const data = JSON.parse(jsonString);
            
            return {
                success: true,
                message: data.message || response,
                commands: data.commands || [],
                suggest_reset: data.suggest_reset || false,
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

    /**
     * 利用可能なエージェント一覧を取得
     */
    getAvailableAgents() {
        return Object.keys(this.agents).map(key => ({
            id: key,
            name: this.agents[key].name,
            description: this.agents[key].description,
            tools: this.agents[key].tools
        }));
    }

    /**
     * 検索履歴を取得
     */
    getSearchHistory(limit = 10) {
        return this.webSearchService.getSearchHistory(limit);
    }

    /**
     * 検索履歴をクリア
     */
    clearSearchHistory() {
        this.webSearchService.clearSearchHistory();
    }

    /**
     * 検索サービスの状態を取得
     */
    getSearchServiceStatus() {
        return this.webSearchService.getStatus();
    }
}
