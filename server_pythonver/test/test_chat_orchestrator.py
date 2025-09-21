# tests/test_chat_orchestrator.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import datetime
from server_pythonver.chat.chat_orchestrator import ChatOrchestrator


@pytest.mark.asyncio
async def test_process_chat_success():
    """正常ケース：チャット処理が成功する場合"""
    # モック依存関係
    mock_dispatcher = MagicMock()
    mock_dispatcher.dispatch = AsyncMock(return_value={
        "message": "テスト成功",
        "commands": [{"action": "create_file", "path": "test.txt"}],
        "agent": "test_agent",
        "raw_llm_response": "raw response"
    })
    
    mock_conversation = MagicMock()
    mock_conversation.prepare_context = AsyncMock(return_value={"context": "enriched"})
    
    mock_validator = MagicMock()
    mock_validator.validate = MagicMock(return_value=True)
    
    mock_response_builder = MagicMock()
    # 成功レスポンスの設定
    success_response = {
        "message": "テスト成功",
        "parse_success": True,
        "commands": [{"action": "create_file", "path": "test.txt"}],
        "agent_used": "test_agent",
        "provider": "gemini",
        "error": None
    }
    mock_response_builder.build_success_response.return_value = success_response

    orchestrator = ChatOrchestrator(mock_dispatcher, mock_conversation, mock_validator, mock_response_builder)
    
    # テスト実行
    result = await orchestrator.process_chat("テストメッセージ")

    # アサーション
    assert "テスト成功" in result["message"]
    assert result["parse_success"] is True
    assert result["commands"] == [{"action": "create_file", "path": "test.txt"}]
    assert result["agent_used"] == "test_agent"
    assert result["provider"] == "gemini"
    assert result["error"] is None
    
    # モックが正しく呼ばれたか確認
    mock_conversation.prepare_context.assert_called_once()
    mock_dispatcher.dispatch.assert_called_once()
    mock_validator.validate.assert_called_once()


@pytest.mark.asyncio
async def test_process_chat_with_invalid_message():
    """異常ケース：無効なメッセージの場合"""
    mock_dispatcher = MagicMock()
    mock_conversation = MagicMock()
    mock_validator = MagicMock()
    mock_response_builder = MagicMock()
    
    # エラーレスポンスの設定
    error_response = {
        "message": "エラーが発生しました: メッセージが無効です",
        "parse_success": False,
        "fallback_mode": True,
        "commands": [],
        "error": "メッセージが無効です"
    }
    mock_response_builder.build_error_response.return_value = error_response

    orchestrator = ChatOrchestrator(mock_dispatcher, mock_conversation, mock_validator, mock_response_builder)
    
    with patch('server_pythonver.utils.response_utils.get_mock_response') as mock_get_mock:
        mock_get_mock.return_value = {"message": "モックレスポンス"}
        
        result = await orchestrator.process_chat("")
        
        assert result["parse_success"] is False
        assert "エラーが発生しました" in result["message"]
        assert result["fallback_mode"] is True


@pytest.mark.asyncio
async def test_process_chat_dispatcher_error():
    """異常ケース：ディスパッチャーでエラーが発生する場合"""
    mock_dispatcher = MagicMock()
    mock_dispatcher.dispatch = AsyncMock(side_effect=Exception("ディスパッチャーエラー"))
    
    mock_conversation = MagicMock()
    mock_conversation.prepare_context = AsyncMock(return_value={})
    
    mock_validator = MagicMock()
    mock_response_builder = MagicMock()
    
    # エラーレスポンスの設定
    error_response = {
        "message": "エラーが発生しました: ディスパッチャーエラー",
        "parse_success": False,
        "fallback_mode": True,
        "commands": [],
        "error": "ディスパッチャーエラー"
    }
    mock_response_builder.build_error_response.return_value = error_response

    orchestrator = ChatOrchestrator(mock_dispatcher, mock_conversation, mock_validator, mock_response_builder)
    
    with patch('server_pythonver.utils.response_utils.get_mock_response') as mock_get_mock:
        mock_get_mock.return_value = {"message": "フォールバックメッセージ"}
        
        result = await orchestrator.process_chat("テストメッセージ")
        
        assert result["parse_success"] is False
        assert "ディスパッチャーエラー" in result["error"]
        assert result["fallback_mode"] is True


@pytest.mark.asyncio
async def test_validate_commands():
    """_validate_commandsメソッドのテスト"""
    mock_dispatcher = MagicMock()
    mock_conversation = MagicMock()
    mock_validator = MagicMock()
    
    # バリデーションの結果を設定
    def validate_side_effect(cmd):
        return cmd.get("action") == "valid_action"
    
    mock_validator.validate.side_effect = validate_side_effect
    mock_response_builder = MagicMock()  # 追加: response_builder のモック

    orchestrator = ChatOrchestrator(mock_dispatcher, mock_conversation, mock_validator, mock_response_builder)  # 修正: response_builder を追加
    
    commands = [
        {"action": "valid_action", "path": "test1.txt"},
        {"action": "invalid_action", "path": "test2.txt"},
        {"action": "valid_action", "path": "test3.txt"}
    ]
    
    result = orchestrator._validate_commands(commands)
    
    assert len(result) == 2
    assert all(cmd["action"] == "valid_action" for cmd in result)


def test_get_available_agents():
    """get_available_agentsメソッドのテスト"""
    mock_dispatcher = MagicMock()
    mock_dispatcher.get_available_agents.return_value = ["agent1", "agent2"]
    
    mock_conversation = MagicMock()
    mock_validator = MagicMock()
    mock_response_builder = MagicMock()  # 追加: response_builder のモック

    orchestrator = ChatOrchestrator(mock_dispatcher, mock_conversation, mock_validator, mock_response_builder)  # 修正: response_builder を追加
    
    result = orchestrator.get_available_agents()
    
    assert result == ["agent1", "agent2"]
    mock_dispatcher.get_available_agents.assert_called_once()


def test_get_system_status():
    """get_system_statusメソッドのテスト"""
    mock_dispatcher = MagicMock()
    mock_dispatcher.get_status.return_value = {"status": "active"}
    
    mock_conversation = MagicMock()
    mock_conversation.get_status.return_value = {"conversations": 5}
    
    mock_validator = MagicMock()
    mock_validator.get_validator_stats.return_value = {"validated": 10}
    mock_response_builder = MagicMock()  # 追加: response_builder のモック

    orchestrator = ChatOrchestrator(mock_dispatcher, mock_conversation, mock_validator, mock_response_builder)  # 修正: response_builder を追加
    
    result = orchestrator.get_system_status()
    
    assert "agent_dispatcher" in result
    assert "conversation_manager" in result
    assert "command_validator" in result
    assert "timestamp" in result