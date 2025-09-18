# AI File Manager - API統合版

Claudeやその他のLLMと連携できるAIファイルマネージャーアプリケーションです。

## 🚀 セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.template`を`.env`にコピーして、APIキーを設定します。

```bash
cp .env.template .env
```

`.env`ファイルを編集して、使用したいAPIキーを設定：

```env
# 必要に応じて設定
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. APIキーの取得

- **Anthropic Claude**: [console.anthropic.com](https://console.anthropic.com/) でアカウント作成
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) でAPIキーを生成

### 4. サーバー起動

```bash
# 本番環境
npm start

# 開発環境（ファイル変更時に自動再起動）
npm run dev
```

### 5. アプリケーションにアクセス

ブラウザで `http://localhost:3000` を開きます。

## 📋 ファイル構成

```
ai-file-manager/
├── index.html          # フロントエンドHTMLファイル
├── style.css           # CSSスタイル
├── script.js           # 更新されたJavaScript（API統合版）
├── server.js           # Express.jsサーバー
├── package.json        # Node.js依存関係
├── .env.template       # 環境変数テンプレート
├── .env               # 環境変数（作成が必要）
└── README.md          # このファイル
```

## 🔧 機能

### AIチャット機能
- Claude（Anthropic）またはOpenAI GPTとリアルタイム通信
- 設定画面でプロバイダーとモデルを選択可能
- API接続エラー時のフォールバック機能

### ファイル管理機能
- ファイルのプレビュー・編集
- Markdownファイルのレンダリング
- ファイル作成・削除・リネーム
- ディレクトリナビゲーション

### UI機能
- ダーク/ライトテーマ切り替え
- フォントサイズ調整
- レスポンシブデザイン
- モバイル対応

## 🛠️ トラブルシューティング

### サーバーが起動しない
- Node.jsがインストールされているか確認
- `npm install`が完了しているか確認
- ポート3000が使用されていないか確認

### API接続エラー
- `.env`ファイルにAPIキーが正しく設定されているか確認
- APIキーの有効性を確認
- 設定画面の「接続状態」で状況を確認

### チャットが動作しない
- ブラウザのコンソールでエラーをチェック
- サーバーが正常に起動しているか確認
- ネットワーク接続を確認

## 🔐 セキュリティ注意事項

- `.env`ファイルをバージョン管理に含めないでください
- APIキーは適切に管理してください
- 本番環境では適切なCORS設定を行ってください

## 📝 開発

### 新しいLLMプロバイダーの追加

`server.js`の`LLM_PROVIDERS`オブジェクトに新しいプロバイダーを追加し、対応するAPI呼び出し関数を実装してください。

### カスタマイズ

- `style.css`: UI のカスタマイズ
- `script.js`: フロントエンド機能の拡張
- `server.js`: バックエンドAPI の拡張

## 📄 ライセンス

MIT License