from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .ai.llm_adapter import LLMAdapter
from .chat.conversation_manager import ConversationManager
from .tool.web_search_service import WebSearchService
from .validation.command_validator import CommandValidator
from .validation.response_builder import ResponseBuilder
from .utils.response_utils import get_mock_response, generate_health_status
from .ai.agent_dispatcher import AgentDispatcher
from .chat.chat_orchestrator import ChatOrchestrator
from dotenv import load_dotenv
import os
import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # スタートアップ処理（必要に応じて追加）
    yield
    # シャットダウン処理（必要に応じて追加）

app = FastAPI(lifespan=lifespan)

# リクエストボディ用のPydanticモデル
class DispatchRequest(BaseModel):
    message: str
    provider: str = "gemini"
    model: str = None
    context: dict = {}

# サービスインスタンス初期化
llm_adapter = LLMAdapter()
conversation_manager = ConversationManager()
web_search_service = WebSearchService()
command_validator = CommandValidator()
response_builder = ResponseBuilder()
agent_dispatcher = AgentDispatcher(llm_adapter, web_search_service, command_validator)
chat_orchestrator = ChatOrchestrator(agent_dispatcher, conversation_manager, command_validator, response_builder)

# チャットエンドポイント
@app.post("/api/chat")
async def chat(request: DispatchRequest):
    try:
        return await chat_orchestrator.process_chat(
            request.message,
            request.provider,
            request.model,
            request.context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat")
async def chat_get(message: str, provider: str = "gemini", model: str = None, context: dict = {}):
    try:
        return await chat_orchestrator.process_chat(message, provider, model, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# その他のAPIエンドポイント
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
    return get_mock_response("ヘルプ")

@app.get("/api/health")
async def get_health_status():
    return {
        "base_status": generate_health_status(),
        "orchestrator_status": chat_orchestrator.get_system_status()
    }

@app.post("/api/dispatch")
async def dispatch_message(request: DispatchRequest):
    try:
        return await chat_orchestrator.process_chat(
            request.message,
            request.provider,
            request.model,
            request.context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dispatch")
async def dispatch_message_get(message: str = "テスト用メッセージ", provider: str = "gemini", model: str = None):
    context = {"currentPath": "/app/project"}
    return await chat_orchestrator.process_chat(message, provider, model, context)

# 静的ファイル配信の設定
app.mount("/", StaticFiles(directory="public", html=True), name="public")

# サーバー起動
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
