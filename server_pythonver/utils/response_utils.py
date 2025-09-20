import json
import datetime
import os

# Fallback Mock Response（デモモード用）
def get_mock_response(message: str, context: dict = None):
    if context is None:
        context = {}

    cmd = message.lower()

    if "help" in cmd or "ヘルプ" in cmd:
        return {
            "message": """🤖 AI File Manager のコマンド一覧（RDD版 + Web検索対応）：

**📋 基本コマンド:**
• **ファイル作成** - "新しいファイルを作って" "sample.txt を作成"
• **ディレクトリ作成** - "フォルダを作って" "documents フォルダを作成"
• **ファイル読み込み** - "ファイルを読んで" "内容を表示して"
• **ファイル編集** - "ファイルを編集して" "内容を変更して"
• **ファイルコピー** - "ファイルをコピーして" "backup フォルダにコピー"
• **ファイル移動** - "ファイルを移動して" "フォルダを移動"
• **ファイル削除** - "ファイルを削除して" "不要なファイルを消して"
• **ファイル一覧** - "ファイル一覧" "何があるか教えて"

**🔍 Web検索・リサーチ（新機能）:**
• **一般検索** - "〜について調べて" "〜を検索して"
• **最新情報** - "最新のAI技術は？" "今の株価は？"
• **技術情報** - "React 18の新機能は？" "TypeScript最新版"
• **比較・調査** - "iPhone vs Android" "プログラミング言語比較"
• **ニュース・トレンド** - "今日のニュース" "最新トレンド"

**🔄 一括操作:**
• **一括削除** - "全ての .txt ファイルを削除して"
• **一括コピー** - "画像ファイル全部を images フォルダにコピー"
• **一括移動** - "古いファイルを全部 archive に移動"

**🤖 マルチエージェントシステム:**
• **ファイル操作エキスパート** - ファイル/フォルダの操作
• **コンテンツ分析エキスパート** - ファイル読み込み/分析
• **Web検索エキスパート** - インターネット検索/リサーチ（新追加）
• **汎用アシスタント** - 一般的な質問・ヘルプ

**📱 操作方法:**
• **ファイル表示** - ファイルをクリックでプレビュー
• **ファイル操作** - ファイルを長押しで操作メニュー表示
• **複数選択** - Ctrl/Cmd + クリックで複数選択
• **編集切替** - 右上の✏️ボタンで編集/プレビュー切り替え
• **AIコマンド** - 自然な日本語でファイル操作・検索が可能
• **カスタムプロンプト** - 🧠ボタンでカスタムプロンプト有効/無効

**🔍 検索例:**
• "JavaScript フレームワーク 2024 最新動向を調べて"
• "OpenAI GPT-4の料金体系について検索して"
• "React vs Vue.js 比較情報を探して"
• "今日の為替レートを調べて"

**🏗️ 統合例:**
• "最新のNext.jsについて調べて、その設定ファイルを作って"
• "TypeScript設定のベストプラクティスを検索して、tsconfig.jsonを生成して"
""",
            "commands": []
        }

    if "検索" in cmd or "調べて" in cmd or "リサーチ" in cmd:
        return {
            "message": "Web検索を実行します。（デモモード: 検索API接続を確認してください）",
            "commands": []
        }

    if "作成" in cmd or "create" in cmd:
        return {
            "message": "ファイル/フォルダ作成を実行します。（デモモード: API接続を確認してください）",
            "commands": []
        }

    if "コピー" in cmd or "copy" in cmd:
        return {
            "message": "ファイルコピーを実行します。（デモモード: API接続を確認してください）",
            "commands": []
        }

    if "移動" in cmd or "move" in cmd:
        return {
            "message": "ファイル移動を実行します。（デモモード: API接続を確認してください）",
            "commands": []
        }

    if "一覧" in cmd or "list" in cmd:
        return {
            "message": f"現在のディレクトリ: {context.get('currentPath', '/workspace')}\nファイル数: {len(context.get('fileList', []))}",
            "commands": []
        }

    mock_responses = [
        "ファイル操作を実行しました。",
        "AIによる分析が完了しました。",
        "処理が正常に完了しました。",
        "ご質問にお答えします。何かお手伝いできることはありますか？",
        "理解しました。他にも何かサポートが必要でしたらお知らせください。"
    ]

    return {
        "message": mock_responses[datetime.datetime.now().microsecond % len(mock_responses)],
        "commands": []
    }

# ヘルスチェック用ステータス生成
def generate_health_status():
    status = {
        "status": "healthy",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "providers": {},
        "features": {
            "basic_commands": True,
            "file_operations": True,
            "json_parsing": True,
            "conversation_history": True,
            "batch_operations": True,
            "directory_creation": True,
            "file_copy_move": True,
            "custom_prompts": True,
            "multi_agent_system": True,
            "rdd_architecture": True,
            "web_search": True,
            "langchain_integration": True,
            "search_history": True
        }
    }

    # LLM API keys
    status["providers"]["claude"] = bool(os.getenv("ANTHROPIC_API_KEY"))
    status["providers"]["openai"] = bool(os.getenv("OPENAI_API_KEY"))
    status["providers"]["gemini"] = bool(os.getenv("GOOGLE_API_KEY")),
    status["providers"]["local"] = True

    # Search API keys (新規追加)
    status["providers"]["tavily_search"] = bool(os.getenv("TAVILY_API_KEY")),
    status["providers"]["google_search"] = bool(os.getenv("GOOGLE_SEARCH_API_KEY") and os.getenv("GOOGLE_CSE_ID")),
    status["providers"]["duckduckgo_search"] = True # No API key required

    return status

# 入力バリデーション
def validate_chat_input(message: str, provider: str, model: str, context: dict):
    if not message or not isinstance(message, str):
        raise ValueError('Message is required and must be a string')

    if provider and not isinstance(provider, str):
        raise ValueError('Provider must be a string')

    if model and not isinstance(model, str):
        raise ValueError('Model must be a string')

    if context and not isinstance(context, dict):
        raise ValueError('Context must be an object')

    return True

# ログユーティリティ
def log_server_start(port: int, providers: dict):
    print(f"🚀 AI File Manager Server running on http://localhost:{port}")
    print(f"📋 Available providers:")

    for key, provider_info in providers.items():
        has_key = False
        if key == 'claude':
            has_key = bool(os.getenv("ANTHROPIC_API_KEY"))
        elif key == 'openai':
            has_key = bool(os.getenv("OPENAI_API_KEY")),
        elif key == 'gemini':
            has_key = bool(os.getenv("GOOGLE_API_KEY")),
        elif key == 'local':
            has_key = True
        print(f"   {provider_info['name']}: {{'✅' if has_key else '❌'}}")

    print(f"\n🎯 利用可能な機能:")
    print(f"   📝 create_file - ファイル作成")
    print(f"   📁 create_directory - ディレクトリ作成")
    print(f"   📖 read_file - ファイル読み込み")
    print(f"   ✏️ edit_file - ファイル編集")
    print(f"   📋 copy_file - ファイルコピー")
    print(f"   🔄 move_file - ファイル移動/名前変更")
    print(f"   🗑️ delete_file - ファイル削除")
    print(f"   📋 list_files - ファイル一覧")
    print(f"   🔄 batch_delete - 一括削除")
    print(f"   🔄 batch_copy - 一括コピー")
    print(f"   🔄 batch_move - 一括移動")
    print(f"   💬 conversation_history - 会話履歴管理")
    print(f"   🧠 custom_prompts - カスタムシステムプロンプト")
    print(f"   🤖 multi_agent_system - マルチエージェントシステム")

    if not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("OPENAI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
        print(f"\n⚠️  No API keys configured. Add them to .env file:")
        print(f"   ANTHROPIC_API_KEY=your_claude_api_key")
        print(f"   OPENAI_API_KEY=your_openai_api_key")
        print(f"   GOOGLE_API_KEY=your_gemini_api_key")

    print(f"\n🧠 カスタムプロンプト機能が有効です:")
    print(f"   - ヘッダー🧠ボタンで有効/無効切り替え")
    print(f"   - FABメニュー「システムプロンプト」で管理")
    print(f"   - ベースプロンプト（ファイル操作）と自動統合")
