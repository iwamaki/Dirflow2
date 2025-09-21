import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from server_pythonver.ai.agent_dispatcher import AgentDispatcher
from server_pythonver.tool.web_search_service import WebSearchService
from server_pythonver.validation.command_validator import CommandValidator

@pytest.fixture
def mock_llm_adapter():
    """LLMAdapterのモック"""
    mock = AsyncMock()
    mock.call_llm.return_value = "general_assistant" # デフォルトの応答
    return mock

@pytest.fixture
def mock_web_search_service():
    """WebSearchServiceのモック"""
    return MagicMock(spec=WebSearchService)

@pytest.fixture
def mock_command_validator():
    """CommandValidatorのモック"""
    mock = MagicMock(spec=CommandValidator)
    mock.validate.return_value = True # デフォルトでバリデーション成功
    return mock

@pytest.fixture
def agent_dispatcher(mock_llm_adapter, mock_web_search_service, mock_command_validator):
    """AgentDispatcherのインスタンス"""
    return AgentDispatcher(mock_llm_adapter, mock_web_search_service, mock_command_validator)

@pytest.mark.asyncio
async def test_select_agent_with_llm_general_assistant(agent_dispatcher, mock_llm_adapter):
    """LLMがgeneral_assistantを選択する場合のテスト"""
    mock_llm_adapter.call_llm.return_value = "general_assistant"
    selected_agent = await agent_dispatcher._select_agent_with_llm("こんにちは", {})
    assert selected_agent["name"] == "汎用アシスタント"
    mock_llm_adapter.call_llm.assert_called_once()

@pytest.mark.asyncio
async def test_select_agent_with_llm_file_expert(agent_dispatcher, mock_llm_adapter):
    """LLMがfile_expertを選択する場合のテスト"""
    mock_llm_adapter.call_llm.return_value = "file_expert"
    selected_agent = await agent_dispatcher._select_agent_with_llm("ファイルを作成して", {})
    assert selected_agent["name"] == "ファイル操作エキスパート"

@pytest.mark.asyncio
async def test_select_agent_with_llm_web_search_expert(agent_dispatcher, mock_llm_adapter):
    """LLMがweb_search_expertを選択する場合のテスト"""
    mock_llm_adapter.call_llm.return_value = "web_search_expert"
    selected_agent = await agent_dispatcher._select_agent_with_llm("今日のニュースを検索して", {})
    assert selected_agent["name"] == "Web検索エキスパート"

@pytest.mark.asyncio
async def test_select_agent_with_llm_fallback_to_general_assistant(agent_dispatcher, mock_llm_adapter):
    """LLMの応答が不正な場合にgeneral_assistantにフォールバックするテスト"""
    mock_llm_adapter.call_llm.return_value = "unknown_agent"
    selected_agent = await agent_dispatcher._select_agent_with_llm("何か質問", {})
    assert selected_agent["name"] == "汎用アシスタント"

@pytest.mark.asyncio
async def test_dispatch_general_assistant_message(agent_dispatcher, mock_llm_adapter):
    """汎用アシスタントがメッセージを返す場合のdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = ["general_assistant", "こんにちは、何かお手伝いできますか？"]
    result = await agent_dispatcher.dispatch("こんにちは", {})
    assert result["agent"] == "汎用アシスタント"
    assert "こんにちは、何かお手伝いできますか？" in result["message"]
    assert not result["commands"]
    assert result["parse_success"] is True
    assert result["error"] is None

@pytest.mark.asyncio
async def test_dispatch_file_expert_single_command(agent_dispatcher, mock_llm_adapter, mock_command_validator):
    """ファイル操作エキスパートが単一コマンドを返す場合のdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = [
        "file_expert",
        '```json\n{"action": "create_file", "path": "test.txt", "content": "Hello"}\n```'
    ]
    mock_command_validator.validate.return_value = True
    result = await agent_dispatcher.dispatch("test.txtを作成して", {})
    assert result["agent"] == "ファイル操作エキスパート"
    assert result["commands"] == [{"action": "create_file", "path": "test.txt", "content": "Hello"}]
    assert result["parse_success"] is True
    assert result["error"] is None

@pytest.mark.asyncio
async def test_dispatch_file_expert_multiple_commands(agent_dispatcher, mock_llm_adapter, mock_command_validator):
    """ファイル操作エキスパートが複数コマンドを返す場合のdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = [
        "file_expert",
        '```json\n[{"action": "create_directory", "path": "new_dir"}, {"action": "create_file", "path": "new_dir/file.txt", "content": "Hello"}]\n```'
    ]
    mock_command_validator.validate.return_value = True
    result = await agent_dispatcher.dispatch("new_dirを作成し、その中にfile.txtを作成して", {})
    assert result["agent"] == "ファイル操作エキスパート"
    assert len(result["commands"]) == 2
    assert result["commands"][0]["action"] == "create_directory"
    assert result["commands"][1]["action"] == "create_file"
    assert result["parse_success"] is True
    assert result["error"] is None

@pytest.mark.asyncio
async def test_dispatch_web_search_expert_command(agent_dispatcher, mock_llm_adapter, mock_command_validator):
    """Web検索エキスパートがコマンドを返す場合のdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = [
        "web_search_expert",
        '```json\n{"action": "web_search", "query": "Pythonの最新情報"}\n```'
    ]
    mock_command_validator.validate.return_value = True
    result = await agent_dispatcher.dispatch("Pythonの最新情報を検索して", {})
    assert result["agent"] == "Web検索エキスパート"
    assert result["commands"] == [{"action": "web_search", "query": "Pythonの最新情報"}]
    assert result["parse_success"] is True
    assert result["error"] is None

@pytest.mark.asyncio
async def test_dispatch_invalid_command_filtered(agent_dispatcher, mock_llm_adapter, mock_command_validator):
    """無効なコマンドがフィルタリングされるdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = [
        "file_expert",
        '```json\n[{"action": "create_file", "path": "valid.txt"}, {"action": "invalid_action", "path": "invalid.txt"}]\n```'
    ]
    mock_command_validator.validate.side_effect = [True, False] # 1つ目は成功、2つ目は失敗
    result = await agent_dispatcher.dispatch("ファイルを作成して", {})
    assert result["agent"] == "ファイル操作エキスパート"
    assert len(result["commands"]) == 1
    assert result["commands"][0]["action"] == "create_file"
    assert "コマンドバリデーション失敗" in result["warning"]
    assert result["parse_success"] is True
    assert result["error"] is None

@pytest.mark.asyncio
async def test_dispatch_llm_response_json_decode_error(agent_dispatcher, mock_llm_adapter):
    """LLM応答がJSONデコードエラーになる場合のdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = ["file_expert", "これはJSONではありません"]
    result = await agent_dispatcher.dispatch("ファイルを作成して", {})
    assert result["agent"] == "ファイル操作エキスパート"
    assert not result["commands"]
    assert result["parse_success"] is False
    assert "LLM応答のJSONパースに失敗しました" in result["warning"]
    assert result["error"] is None

@pytest.mark.asyncio
async def test_dispatch_llm_call_error(agent_dispatcher, mock_llm_adapter):
    """LLM呼び出し中にエラーが発生する場合のdispatchテスト"""
    mock_llm_adapter.call_llm.side_effect = [
        "general_assistant",
        Exception("LLM呼び出しエラー")
    ]
    result = await agent_dispatcher.dispatch("何か質問", {})
    assert result["agent"] == "汎用アシスタント"
    assert not result["commands"]
    assert result["parse_success"] is False
    assert "LLM応答処理中にエラーが発生: LLM呼び出しエラー" in result["warning"]
    assert "LLM呼び出しエラー" in result["error"]

def test_build_agent_selection_prompt(agent_dispatcher):
    """エージェント選択プロンプトの生成テスト"""
    prompt = agent_dispatcher._build_agent_selection_prompt("ファイルを作成して")
    assert "ファイル操作エキスパート" in prompt
    assert "Web検索エキスパート" in prompt
    assert "汎用アシスタント" in prompt
    assert "ファイルを作成して" in prompt
    assert "選択されたエージェント：" in prompt

def test_parse_agent_selection_response(agent_dispatcher):
    """エージェント選択応答のパーステスト"""
    assert agent_dispatcher._parse_agent_selection_response("file_expert") == "file_expert"
    assert agent_dispatcher._parse_agent_selection_response("web_search_expert") == "web_search_expert"
    assert agent_dispatcher._parse_agent_selection_response("general_assistant") == "general_assistant"
    assert agent_dispatcher._parse_agent_selection_response("file") == "file_expert"
    assert agent_dispatcher._parse_agent_selection_response("検索") == "web_search_expert"
    assert agent_dispatcher._parse_agent_selection_response("unknown") == "general_assistant"

def test_build_agent_prompt_file_expert(agent_dispatcher):
    """ファイル操作エキスパートのプロンプト生成テスト"""
    agent_info = agent_dispatcher.agents["file_expert"]
    context = {"currentPath": "/app"}
    prompt = agent_dispatcher._build_agent_prompt(agent_info, "test.txtを作成", context)
    assert "あなたはファイル操作のエキスパートAIです。" in prompt
    assert "現在の作業ディレクトリは /app です。" in prompt
    assert "ユーザーの指示: test.txtを作成" in prompt

def test_build_agent_prompt_general_assistant(agent_dispatcher):
    """汎用アシスタントのプロンプト生成テスト"""
    agent_info = agent_dispatcher.agents["general_assistant"]
    context = {}
    prompt = agent_dispatcher._build_agent_prompt(agent_info, "今日の天気は？", context)
    assert "あなたは親切で有能な汎用アシスタントAIです。" in prompt
    assert "ユーザーの指示: 今日の天気は？" in prompt

def test_get_status(agent_dispatcher, mock_web_search_service, mock_command_validator):
    """get_statusメソッドのテスト"""
    mock_web_search_service.get_status.return_value = {"web_status": "ok"}
    mock_command_validator.get_validator_stats.return_value = {"validator_stats": "ok"}
    status = agent_dispatcher.get_status()
    assert "initialized_agents" in status
    assert "file_expert" in status["initialized_agents"]
    assert status["web_search_service_status"] == {"web_status": "ok"}
    assert status["command_validator_stats"] == {"validator_stats": "ok"}
    assert "timestamp" in status
