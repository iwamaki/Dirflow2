/* =========================================
    Express設定・ルーティング・メイン処理
   ========================================= */

/*

## 概要
Expressフレームワークを使用してAI File Managerのバックエンドサーバーを構築するモジュール。APIエンドポイントの定義、ミドルウェアの設定、チャットリクエストの処理、ヘルスチェック、エラーハンドリング、サーバー起動ロジックを含む。

## 主要機能
- **Expressアプリケーション**: `app`: Expressアプリケーションインスタンス。
- **ミドルウェア設定**: CORS、JSONボディパーシング、静的ファイルの提供。
- **APIエンドポイント**:
    - `GET /api/llm-providers`: 利用可能なLLMプロバイダーとモデルのリストを返却。
    - `POST /api/chat`: ユーザーからのチャットリクエストを受け付け、LLMプロバイダーに処理を委譲し、応答を返却。
    - `GET /api/health`: サーバーのヘルスチェックステータスを返却。
- **エラーハンドリング**: グローバルなエラーハンドリングミドルウェアを設定し、サーバーエラーを捕捉して適切な応答を返す。
- **サーバー起動**: 指定されたポートでサーバーをリッスンし、起動ログを出力。

## 依存関係
- **インポート**:
    - `express` (from 'express'): Webアプリケーションフレームワーク。
    - `cors` (from 'cors'): クロスオリジンリソース共有を有効にするミドルウェア。
    - `path` (from 'path'): パス操作ユーティリティ。
    - `fileURLToPath` (from 'url'): `import.meta.url`からファイルパスを取得。
    - `dotenv` (from 'dotenv'): `.env`ファイルから環境変数をロード。
    - `LLM_PROVIDERS`, `handleChatRequest` (from './llm-providers.js'): LLMプロバイダーの設定とチャットリクエスト処理。
    - `validateChatInput`, `generateHealthStatus`, `formatApiError`, `logServerStart` (from './response-utils.js'): 応答処理、バリデーション、ヘルスチェック、エラー整形、ログ出力ユーティリティ。
- **エクスポート**: `app` (Expressアプリケーションインスタンス)

## 特記事項
- ES6モジュール形式で`__dirname`を安全に取得。
- 環境変数（`.env`ファイル）から設定を読み込み、APIキーなどを管理。
- `llm-providers.js`と`response-utils.js`に処理を委譲することで、関心の分離とコードのモジュール化を実現。
- API呼び出し中のエラーを捕捉し、ユーザーフレンドリーなフォールバック応答を提供する。
- 開発環境と本番環境で異なるエラーメッセージを表示する設定。

*/

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// モジュールのインポート
import { LLM_PROVIDERS, handleChatRequest } from './llm-providers.js';
import { 
    validateChatInput, 
    generateHealthStatus, 
    formatApiError, 
    logServerStart 
} from './response-utils.js';

// ES6 モジュールで __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
    res.json(LLM_PROVIDERS);
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, provider = 'claude', model, context = {} } = req.body;

        // 入力バリデーション
        validateChatInput(message, provider, model, context);

        // LLMプロバイダーに処理を委譲
        const result = await handleChatRequest(message, provider, model, context);
        
        res.json(result);

    } catch (error) {
        // エラーハンドリング（フォールバック応答含む）
        const errorResponse = formatApiError(error, req.body.provider || 'unknown', req.body.message, req.body.context);
        res.status(200).json(errorResponse);
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const status = generateHealthStatus();
    res.json(status);
});

/* =========================================
    Error Handling Middleware
   ========================================= */
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

/* =========================================
    Server起動
   ========================================= */
app.listen(PORT, () => {
    logServerStart(PORT, LLM_PROVIDERS);
});

// デフォルトエクスポート
export default app;