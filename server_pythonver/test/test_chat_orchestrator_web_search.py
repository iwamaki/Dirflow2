# server_pythonver/test/test_chat_orchestrator_web_search.py
import pytest
from unittest.mock import AsyncMock, MagicMock

# テスト対象のクラスをインポート
from server_pythonver.chat.chat_orchestrator import ChatOrchestrator
from server_pythonver.ai.agent_dispatcher import AgentDispatcher
from server_pythonver.chat.conversation_manager import ConversationManager
from server_pythonver.validation.command_validator import CommandValidator
from server_pythonver.validation.response_builder import ResponseBuilder
from server_pythonver.tool.web_search_service import WebSearchService

@pytest.mark.asyncio
async def test_process_chat_triggers_web_search_and_executes_it():
    """
    Web検索をトリガーするメッセージを受信した際に、
    ChatOrchestratorがweb_search_serviceを呼び出すか検証するテスト。
    """
    # --- 依存関係のモックを作成 ---
    
    # 1. WebSearchServiceのモック
    # perform_searchが呼び出されたかを確認できるようにAsyncMockを設定
    mock_web_search_service = MagicMock(spec=WebSearchService)
    mock_web_search_service.perform_search = AsyncMock(return_value={
        "success": True,
        "results": [{"title": "AI News", "url": "https://example.com"}]
    })

    # 2. AgentDispatcherのモック
    # LLMがweb_searchコマンドを返したように見せかける
    mock_agent_dispatcher = MagicMock(spec=AgentDispatcher)
    mock_agent_dispatcher.dispatch = AsyncMock(return_value={
        "message": "Web検索を実行します。",
        "commands": [{"action": "web_search", "query": "最新のAIニュース"}],
        "agent": "web_search_expert",
        "raw_llm_response": '{"action": "web_search", "query": "最新のAIニュース"}',  # JSON文字列として正しくクォート
        "parse_success": True,
        "warning": None,
        "error": None
    })
    
    # 3. その他の依存関係のモック
    mock_conversation_manager = MagicMock(spec=ConversationManager)
    mock_conversation_manager.prepare_context = AsyncMock(return_value={"currentPath": "/test"})
    mock_conversation_manager.should_suggest_new_chat.return_value = False

    mock_command_validator = MagicMock(spec=CommandValidator)
    # web_searchコマンドを有効とみなす
    mock_command_validator.validate.return_value = True

    # ResponseBuilderは実際のインスタンスを使うか、詳細なモックが必要
    # ここでは基本的な振る舞いをモック
    mock_response_builder = MagicMock(spec=ResponseBuilder)
    def build_success_side_effect(data):
        return {
            "message": data.get("message"),
            "commands": data.get("commands"),
            "agent_used": data.get("agent_used"),
            "parse_success": data.get("parse_success", True),
            "search_results": data.get("search_results")  # テストで重要な部分
        }
    mock_response_builder.build_success_response.side_effect = build_success_side_effect


    # --- テスト対象のインスタンスを生成 ---
    orchestrator = ChatOrchestrator(
        agent_dispatcher=mock_agent_dispatcher,
        conversation_manager=mock_conversation_manager,
        command_validator=mock_command_validator,
        response_builder=mock_response_builder,
        web_search_service=mock_web_search_service  # 修正: コンストラクタで渡す
    )

    # --- テストの実行 ---
    user_message = "最新のAIニュースを教えて"
    response = await orchestrator.process_chat(user_message)


    # --- アサーション（検証） ---

    # 1. AgentDispatcherが正しく呼び出されたか
    mock_agent_dispatcher.dispatch.assert_awaited_once_with(
        user_message,
        {"currentPath": "/test"},
        "gemini",
        None
    )

    # 2. 【重要】WebSearchServiceのperform_searchが呼び出されたか
    # 私の仮説が正しければ、このテストはここで失敗するはずです。
    mock_web_search_service.perform_search.assert_awaited_once_with(
        "最新のAIニュース", {}
    )

    # 3. 最終的なレスポンスに検索結果が含まれているか
    assert response is not None
    assert response.get("search_results") is not None
    assert len(response["search_results"]) == 1
    assert response["search_results"][0]["title"] == "AI News"
