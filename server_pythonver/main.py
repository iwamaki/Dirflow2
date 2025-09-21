from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .langchain_agent.chat_agent import LangChainChatAgent
from .tool.web_search_service import WebSearchService
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
langchain_agent = LangChainChatAgent()
web_search_service = WebSearchService()

# チャットエンドポイント
@app.post("/api/chat")
async def chat(request: DispatchRequest):
    try:
        return await langchain_agent.process_chat(
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
        return await langchain_agent.process_chat(message, provider, model, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# その他のAPIエンドポイント
@app.get("/api/llm-providers")
async def get_llm_providers():
    return {
        "gemini": {
            "name": "Google Gemini",
            "models": ["gemini-1.5-flash", "gemini-1.5-pro"],
            "available": True
        }
    }

@app.get("/api/conversation-status")
async def get_conversation_status():
    return {
        "history": langchain_agent.get_conversation_history(),
        "message_count": len(langchain_agent.get_conversation_history())
    }

@app.get("/api/search-status")
async def get_search_status():
    return web_search_service.get_status()

@app.get("/api/agent-status")
async def get_agent_status():
    return langchain_agent.get_status()

@app.get("/api/health")
async def get_health_status():
    return {
        "status": "healthy",
        "agent_status": langchain_agent.get_status(),
        "search_status": web_search_service.get_status(),
        "langchain_enabled": True
    }

@app.post("/api/dispatch")
async def dispatch_message(request: DispatchRequest):
    try:
        return await langchain_agent.process_chat(
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
    return await langchain_agent.process_chat(message, provider, model, context)

# 会話履歴管理エンドポイント
@app.post("/api/clear-history")
async def clear_conversation_history():
    langchain_agent.clear_memory()
    return {"message": "会話履歴がクリアされました"}

# 静的ファイル配信の設定
app.mount("/", StaticFiles(directory="public", html=True), name="public")

# サーバー起動
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
