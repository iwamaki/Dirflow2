/* =========================================
    Express設定・ルーティング・メイン処理
   ========================================= */

/*
## 概要
AI File ManagerのバックエンドExpressアプリケーションのメインエントリポイント。

## 責任
- Expressサーバーの初期設定とミドルウェアの適用
- APIエンドポイントのルーティング定義
- ChatOrchestratorを介したチャットリクエストの処理
- LLMプロバイダー情報、ヘルスチェック、システムステータスなどの提供
- エラーハンドリングとサーバー起動ログの出力
*/

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 新しいモジュール構成のインポート
import { ChatOrchestrator } from './chat-orchestrator.js';
import { LLMAdapter } from './llm-adapter.js';
import { validateChatInput, generateHealthStatus, logServerStart } from './response-utils.js';

// ES6 モジュールで __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// サービスインスタンスの初期化
const chatOrchestrator = new ChatOrchestrator();
const llmAdapter = new LLMAdapter();

/* =========================================
    Middleware設定
   ========================================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/* =========================================
    API Routes
   ========================================= */

// Get available LLM providers and models
app.get('/api/llm-providers', (req, res) => {
    try {
        const providers = llmAdapter.getProvidersStatus();
        res.json(providers);
    } catch (error) {
        console.error('Error getting LLM providers:', error);
        res.status(500).json({ 
            error: 'Failed to get LLM providers',
            message: error.message 
        });
    }
});

// Chat endpoint - メイン処理はChatOrchestratorに委譲
app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { message, provider = 'claude', model, context = {} } = req.body;

        // 基本的な入力バリデーション
        validateChatInput(message, provider, model, context);

        console.log(`🚀 Processing chat request: ${provider}/${model || 'default'}`);

        // ChatOrchestratorに処理を委譲
        const result = await chatOrchestrator.processChat(message, provider, model, context);
        
        // 処理時間のログ
        const processingTime = Date.now() - startTime;
        console.log(`✅ Chat request completed in ${processingTime}ms`);

        // 処理時間をレスポンスに追加
        result.processingTime = processingTime;
        
        res.json(result);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`❌ Chat request failed after ${processingTime}ms:`, error);

        // エラーレスポンスの構築（ChatOrchestratorが処理できない場合）
        const errorResponse = {
            message: 'リクエストの処理中にエラーが発生しました。',
            commands: [],
            provider: req.body.provider || 'unknown',
            model: req.body.model || 'unknown',
            timestamp: new Date().toISOString(),
            parseSuccess: false,
            error: error.message,
            processingTime: processingTime,
            fallbackMode: true
        };

        res.status(200).json(errorResponse);
    }
});

// Health check endpoint - 詳細な状態情報を提供
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

// Available agents endpoint - エージェント一覧を取得
app.get('/api/agents', (req, res) => {
    try {
        const agents = chatOrchestrator.getAvailableAgents();
        res.json({
            agents: agents,
            count: agents.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting agents:', error);
        res.status(500).json({
            error: 'Failed to get available agents',
            message: error.message
        });
    }
});

// System status endpoint - システム全体の詳細な状態
app.get('/api/system/status', (req, res) => {
    try {
        const systemStatus = {
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                platform: process.platform,
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            },
            services: {
                chatOrchestrator: chatOrchestrator.getSystemStatus(),
                llmAdapter: llmAdapter.getProvidersStatus()
            },
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                port: PORT
            }
        };

        res.json(systemStatus);
    } catch (error) {
        console.error('System status error:', error);
        res.status(500).json({
            error: 'Failed to get system status',
            message: error.message
        });
    }
});

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

/* =========================================
    Error Handling Middleware
   ========================================= */
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled server error:', err);
    
    const errorResponse = {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
    };

    res.status(500).json(errorResponse);
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
    });
});

/* =========================================
    Server起動
   ========================================= */
app.listen(PORT, () => {
    console.log('\n🎉 AI File Manager Server (RDD Architecture) started successfully!');
    console.log('==========================================');
    
    // 詳細なログ出力
    logServerStart(PORT, llmAdapter.getProviders());
    
    console.log('\n🏗️ Architecture Information:');
    console.log('   📋 Design Pattern: Responsibility-Driven Design (RDD)');
    console.log('   🎯 Chat Orchestrator: Coordinates all chat processing');
    console.log('   🤖 Agent Dispatcher: Routes requests to specialist agents');
    console.log('   🔌 LLM Adapter: Unified interface for all LLM providers');
    console.log('   ✅ Command Validator: Validates and secures all commands');
    console.log('   💬 Conversation Manager: Manages chat history and context');
    console.log('   🔧 Context Builder: Builds and formats all responses');
    
    console.log('\n📊 Available Endpoints:');
    console.log('   POST /api/chat - Main chat processing');
    console.log('   GET  /api/llm-providers - LLM provider information');
    console.log('   GET  /api/agents - Available specialist agents');
    console.log('   GET  /api/health - Basic health check');
    console.log('   GET  /api/system/status - Detailed system status');
    
    console.log('==========================================');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// デフォルトエクスポート
export default app;