/* =========================================
    agent-dispatcher.js への追加
   ========================================= */

// SPECIALIST_AGENTS オブジェクトに追加する新しいエージェント
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

必ずJSON形式で応答してください：
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
7. レスポンスは必ずJSONとして有効な形式にする
8. 自然で親しみやすい口調で応答する

検索のベストプラクティス：
- 日本語のクエリは日本語で検索
- 技術的な情報は英語での検索も併用
- トレンドや最新情報は時間軸を意識
- 複数の角度から情報を収集
- 情報源の多様性を確保

タスク完了時の注意：
- リサーチが完了したと判断したら "suggest_reset": true を設定
- ユーザーに「検索・調査が完了しました。他にご用はありますか？新しいトピックがあれば会話をリセットしましょう」等のメッセージを含める`,
        tools: ['web_search'],
        keywords: ['検索', 'search', '調べて', '最新', '情報', 'リサーチ', '探して', '見つけて', 'ググって', 'ニュース', 'トレンド', '比較', '調査']
    }
};

// agent-dispatcher.jsのimport文に追加
import { WebSearchService } from './web-search-service.js';

// AgentDispatcherクラスのコンストラクターに追加
export class AgentDispatcher {
    constructor() {
        this.llmAdapter = new LLMAdapter();
        this.webSearchService = new WebSearchService(); // 追加
        this.agents = {
            ...SPECIALIST_AGENTS,
            ...WEB_SEARCH_AGENT // 新エージェントを統合
        };
        this.currentAgent = null;
        this.sessionStartTime = Date.now();
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

        // 専門エージェント用のコンテキスト
        const specialistContext = {
            ...context,
            customPrompt: {
                enabled: true,
                name: agent.name,
                content: agent.systemPrompt
            },
            conversationHistory: context.conversationHistory || []
        };

        // LLM APIを呼び出し
        const response = await this.llmAdapter.callLLM(message, provider, model, specialistContext);

        // 応答をパース
        const parsedResponse = this._parseStructuredResponse(response);

        // Web検索コマンドがある場合は実行
        if (parsedResponse.commands && parsedResponse.commands.length > 0) {
            await this._executeWebSearchCommands(parsedResponse.commands);
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

        // リセット提案があった場合の処理
        if (parsedResponse.suggest_reset) {
            console.log('💡 Agent suggests session reset');
            result.suggestReset = true;
            this.currentAgent = null;
        }

        return result;
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

                    // 検索結果をコマンドに添付
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