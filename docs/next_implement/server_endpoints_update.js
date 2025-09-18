/* =========================================
    server.js に追加するエンドポイント
   ========================================= */

// 検索履歴取得エンドポイント
app.get('/api/search/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = chatOrchestrator.getSearchHistory(limit);
        
        res.json({
            history: history,
            count: history.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting search history:', error);
        res.status(500).json({
            error: 'Failed to get search history',
            message: error.message
        });
    }
});

// 検索履歴削除エンドポイント
app.delete('/api/search/history', (req, res) => {
    try {
        chatOrchestrator.clearSearchHistory();
        
        res.json({
            message: 'Search history cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error clearing search history:', error);
        res.status(500).json({
            error: 'Failed to clear search history',
            message: error.message
        });
    }
});

// 検索プロバイダー状態取得エンドポイント
app.get('/api/search/providers', (req, res) => {
    try {
        const searchStatus = chatOrchestrator.getSearchServiceStatus();
        
        res.json({
            providers: {
                tavily: {
                    name: 'Tavily AI Search',
                    available: !!process.env.TAVILY_API_KEY,
                    recommended: true
                },
                google: {
                    name: 'Google Custom Search',
                    available: !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_CSE_ID),
                    recommended: false
                },
                duckduckgo: {
                    name: 'DuckDuckGo',
                    available: true,
                    recommended: false,
                    note: 'No API key required (fallback)'
                }
            },
            status: searchStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting search providers:', error);
        res.status(500).json({
            error: 'Failed to get search providers',
            message: error.message
        });
    }
});

// Health check エンドポイントの更新（既存のものを置き換え）
app.get('/api/health', (req, res) => {
    try {
        const baseStatus = generateHealthStatus();
        
        // 検索サービスの状態を追加
        const searchStatus = chatOrchestrator.getSearchServiceStatus();
        
        const extendedStatus = {
            ...baseStatus,
            services: {
                chatOrchestrator: chatOrchestrator.getSystemStatus(),
                llmAdapter: llmAdapter.getProvidersStatus(),
                webSearch: searchStatus // 新規追加
            },
            features: {
                ...baseStatus.features,
                web_search: true,              // 新機能
                langchain_integration: true,   // 新機能
                search_history: true          // 新機能
            }
        };

        res.json(extendedStatus);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// response-utils.js の generateHealthStatus 関数も更新
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