/* =========================================
    agent-dispatcher.js の ROUTER_SYSTEM_PROMPT 更新
   ========================================= */

// 更新されたROUTER_SYSTEM_PROMPT
const ROUTER_SYSTEM_PROMPT = `あなたは高度なルーティング専門AIです。
ユーザーの入力を分析し、最適な専門エージェントを選択してタスクを振り分けます。

利用可能な専門エージェント：
1. **file_operations** - ファイル・ディレクトリの操作（作成、編集、削除、移動、コピー等）
2. **content_analysis** - ファイル内容の読み込み、分析、確認、一覧表示
3. **web_search** - インターネット検索、情報収集、リサーチ、最新情報の取得
4. **general_assistant** - 一般的な質問応答、説明、ヘルプ

エージェント選択の基準：

**file_operations を選ぶべき場合:**
- "ファイルを作成"、"フォルダを作って"、"削除して"、"コピー"、"移動"
- "保存"、"編集"、"一括操作"
- 具体的なファイル操作が必要な指示

**content_analysis を選ぶべき場合:**
- "ファイルを読んで"、"内容を確認"、"リストアップ"
- "分析して"、"要約して"（既存ファイルに対して）
- ローカルファイルの内容に関する質問

**web_search を選ぶべき場合:**
- "検索して"、"調べて"、"最新情報"、"リサーチ"
- "ニュース"、"トレンド"、"比較"、"口コミ"
- "〜について教えて"（インターネット上の情報が必要な場合）
- "今の状況"、"現在の"（最新情報が必要）
- 技術情報、製品情報、価格比較等

**general_assistant を選ぶべき場合:**
- "使い方"、"ヘルプ"、"機能"、"説明"
- アプリケーション自体に関する質問
- 明確な操作が伴わない一般的な会話

必ずJSON形式で応答してください：
{
  "agent": "選択されたエージェント名",
  "reasoning": "選択理由",
  "user_intent": "ユーザーの意図の要約",
  "refined_message": "専門エージェントに送る最適化されたメッセージ"
}

例：
- "新しいファイルを作って" → file_operations
- "README.mdを読んで" → content_analysis
- "最新のAI技術について調べて" → web_search
- "使い方を教えて" → general_assistant
- "TypeScriptの最新バージョンは？" → web_search
- "設定ファイルをバックアップして" → file_operations`;

// chat-orchestrator.js にも追加メソッドが必要
export class ChatOrchestrator {
    // 既存のメソッドに追加...

    /**
     * 検索履歴を取得
     */
    getSearchHistory(limit = 10) {
        return this.agentDispatcher.getSearchHistory(limit);
    }

    /**
     * 検索履歴をクリア
     */
    clearSearchHistory() {
        return this.agentDispatcher.clearSearchHistory();
    }

    /**
     * 検索サービスの状態を取得
     */
    getSearchServiceStatus() {
        return this.agentDispatcher.getSearchServiceStatus();
    }
}