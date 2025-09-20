from fastapi import FastAPI
from .ai.llm_adapter import LLMAdapter # LLMAdapterをインポート
from .chat.conversation_manager import ConversationManager # ConversationManagerをインポート
from .tool.web_search_service import WebSearchService # WebSearchServiceをインポート
from .validation.command_validator import CommandValidator # CommandValidatorをインポート
from .utils.response_utils import get_mock_response, generate_health_status # response_utilsから関数をインポート
from .ai.agent_dispatcher import AgentDispatcher # AgentDispatcherをインポート
from dotenv import load_dotenv
import os

load_dotenv()  # .env を読み込み

app = FastAPI()

llm_adapter = LLMAdapter() # LLMAdapterのインスタンスを作成
conversation_manager = ConversationManager() # ConversationManagerのインスタンスを作成
web_search_service = WebSearchService() # WebSearchServiceのインスタンスを作成
command_validator = CommandValidator() # CommandValidatorのインスタンスを作成
agent_dispatcher = AgentDispatcher(llm_adapter, web_search_service, command_validator) # AgentDispatcherのインスタンスを作成

@app.get("/")
async def read_root():
    return {"message": "Hello, Dirflow2 Python Server!"}

@app.get("/api/llm-providers")
async def get_llm_providers():
    return llm_adapter.get_providers_status()

@app.get("/api/conversation-status")
async def get_conversation_status():
    return conversation_manager.get_status()

@app.get("/api/search-status")
async def get_search_status():
    return web_search_service.get_status()

@app.get("/api/validator-stats")
async def get_validator_stats():
    return command_validator.get_validator_stats()

@app.get("/api/mock-response")
async def get_mock_response_endpoint():
    return get_mock_response("ヘルプ") # テスト用に「ヘルプ」メッセージを渡す

@app.get("/api/health-status")
async def get_health_status():
    return generate_health_status()

@app.get("/api/dispatch")
async def dispatch_message(message: str = "ファイルを作成して"): # テスト用にデフォルトメッセージを設定
    context = {"currentPath": "/workspace", "provider": "gemini", "model": "gemini-pro", "action": "create_file"} # 仮のコンテキスト
    return agent_dispatcher.dispatch(message, context)
