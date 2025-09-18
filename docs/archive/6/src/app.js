/* =========================================
   AI File Manager - アプリケーション初期化
   ========================================= */

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', async function() {
    // プロバイダー情報読み込み
    await APIClient.loadProviders();

    // 設定適用
    UIController.applyTheme();

    // イベントリスナー設定
    EventHandler.init();

    // ファイルリスト読み込み
    await FileManager.loadFileList();

    // 初期メッセージ表示
    setTimeout(() => {
        const providerName = AppState.availableProviders[AppState.llmProvider]?.name || AppState.llmProvider;
        const historyStatus = ConversationHistory.getHistoryStatus();
        
        MessageHandler.addMessage('ai', `🎉 AI File Manager - 拡張版へようこそ！\\n\\n**🤖 現在のAI設定:**\\n• プロバイダー: ${providerName}\\n• モデル: ${AppState.llmModel}\\n• 会話履歴: ${historyStatus.count}件 ${historyStatus.shouldWarn ? '⚠️' : '✅'}\\n\\n**⚡ 新機能 - 拡張AIコマンド:**\\n📝 **ファイル作成** - "新しいファイルを作って" "config.json を作成して"\\n📁 **ディレクトリ作成** - "docs フォルダを作って" "新しいフォルダを作成"\\n📖 **ファイル読み込み** - "README.md を読んで" "内容を表示して"\\n✏️ **ファイル編集** - "README.md を編集して" "内容を変更して"\\n📋 **ファイルコピー** - "ファイルをコピーして" "backup フォルダにコピー"\\n🔄 **ファイル移動** - "ファイルを移動して" "別のフォルダに移動"\\n🗑️ **ファイル削除** - "sample.txt を削除して" "不要なファイルを消して"\\n📋 **ファイル一覧** - "ファイル一覧を表示して" "何があるか教えて"\\n\\n**🔄 一括操作:**\\n• **一括削除** - "全ての .txt ファイルを削除して"\\n• **一括コピー** - "画像ファイル全部を images フォルダにコピー"\\n• **一括移動** - "古いファイルを全部 archive に移動"\\n\\n**📱 操作方法:**\\n• **複数選択** - Ctrl/Cmd + クリックで複数選択\\n• **長押し選択** - ファイルを長押しで操作メニュー表示\\n• **会話履歴管理** - 設定画面で履歴の確認・クリアが可能\\n\\n**🚀 使用例:**\\n• "プロジェクト用の docs フォルダを作って、README.md も作成して"\\n• "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\\n• "画像ファイルを全部 images フォルダに整理して"\\n\\n**help** と入力すると詳細なコマンド一覧を確認できます。\\n\\nさあ、さらに進化した自然言語でファイル操作を試してみてください！`);
    }, 1000);
});