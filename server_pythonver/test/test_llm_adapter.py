import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from ..ai.llm_adapter import LLMAdapter

@pytest.fixture
def llm_adapter():
    return LLMAdapter()

@pytest.mark.asyncio
async def test_call_gemini_api_success(llm_adapter):
    # 正常なレスポンスのテスト
    mock_response_data = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": "テスト応答"
                        }
                    ]
                }
            }
        ]
    }
    
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            result = await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})
            assert result == "テスト応答"

@pytest.mark.asyncio
async def test_call_gemini_api_missing_api_key(llm_adapter):
    # APIキーがない場合のテスト
    with patch.dict('os.environ', {}, clear=True):
        with pytest.raises(ValueError, match="GOOGLE_API_KEY is not configured"):
            await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})

@pytest.mark.asyncio
async def test_call_gemini_api_empty_response(llm_adapter):
    # 空のレスポンスのテスト
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = {}
            mock_post.return_value = mock_response
            
            with pytest.raises(ValueError, match="Gemini API returned empty response"):
                await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})

@pytest.mark.asyncio
async def test_call_gemini_api_missing_candidates(llm_adapter):
    # candidatesフィールドがない場合のテスト
    mock_response_data = {"other_field": "value"}
    
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            with pytest.raises(ValueError, match="Gemini API response missing 'candidates' field"):
                await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})

@pytest.mark.asyncio
async def test_call_gemini_api_empty_candidates(llm_adapter):
    # candidatesが空の配列の場合のテスト
    mock_response_data = {"candidates": []}
    
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            with pytest.raises(ValueError, match="Gemini API returned empty candidates array"):
                await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})

@pytest.mark.asyncio
async def test_call_gemini_api_missing_content(llm_adapter):
    # contentフィールドがない場合のテスト
    mock_response_data = {
        "candidates": [
            {
                "other_field": "value"
            }
        ]
    }
    
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            with pytest.raises(ValueError, match="Candidate missing 'content' field"):
                await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})

@pytest.mark.asyncio
async def test_call_gemini_api_empty_parts(llm_adapter):
    # partsが空の場合のテスト
    mock_response_data = {
        "candidates": [
            {
                "content": {
                    "parts": []
                }
            }
        ]
    }
    
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            with pytest.raises(ValueError, match="Content missing 'parts' or has empty parts"):
                await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})

@pytest.mark.asyncio
async def test_call_gemini_api_missing_text(llm_adapter):
    # textフィールドがない場合のテスト
    mock_response_data = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "other_field": "value"
                        }
                    ]
                }
            }
        ]
    }
    
    with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_key'}):
        with patch.object(llm_adapter.http_client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.raise_for_status.return_value = None
            mock_response.json.return_value = mock_response_data
            mock_post.return_value = mock_response
            
            with pytest.raises(ValueError, match="Part missing 'text' field"):
                await llm_adapter._call_gemini_api("テストメッセージ", "gemini-1.5-flash", {})