import datetime
import json
from ..utils.response_utils import get_mock_response

class ResponseBuilder:
    def __init__(self):
        self.default_response_format = {
            "message": "",
            "commands": [],
            "provider": "",
            "model": "",
            "timestamp": "",
            "parse_success": False,
            "warning": None,
            "error": None
        }

    def build_success_response(self, data: dict):
        response = {
            **self.default_response_format,
            **data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "parse_success": data.get("parse_success", True),
        }

        response["message"] = self._enhance_message(response.get("message", ""), data)
        response["metadata"] = self._build_metadata(data)
        self._log_response_info(response)
        return response

    def build_error_response(self, error: Exception, provider: str, model: str, original_message: str, original_context: dict):
        print(f"❌ Building error response for {provider}:", error)

        fallback_result = get_mock_response(original_message, original_context)

        error_response = {
            **self.default_response_format,
            "message": self._build_error_message(fallback_result["message"], error),
            "commands": fallback_result.get("commands", []),
            "provider": provider or "unknown",
            "model": model or "unknown",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "parse_success": False,
            "warning": "API接続に問題があります。設定を確認してください。",
            "error": str(error),
            "error_type": self._classify_error(error),
            "should_suggest_new_chat": False,
            "custom_prompt_used": bool(original_context.get("customPrompt", {}).get("enabled")),
            "fallback_mode": True
        }

        error_response["metadata"] = self._build_error_metadata(error, original_context)
        self._log_error_info(error_response)
        return error_response

    def build_fallback_response(self, original_message: str, context: dict, reason: str = "unknown"):
        fallback_result = get_mock_response(original_message, context)

        return {
            **self.default_response_format,
            "message": f"{fallback_result["message"]}\n\n(フォールバック応答: {reason})",
            "commands": fallback_result.get("commands", []),
            "provider": "fallback",
            "model": "mock",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "parse_success": True,
            "warning": f"フォールバック応答が使用されました: {reason}",
            "fallback_mode": True,
            "fallback_reason": reason,
            "metadata": self._build_fallback_metadata(context, reason)
        }

    def _enhance_message(self, original_message: str, data: dict) -> str:
        enhanced_message = original_message or ""

        if data.get("should_suggest_new_chat") and "新しいチャット" not in enhanced_message:
            enhanced_message += "\n\n💡 会話が長くなってきました。新しい話題であれば、新しいチャットの開始をお勧めします。"

        if data.get("custom_prompt_used") and data.get("custom_prompt_name"):
            enhanced_message += f"\n\n🧠 カスタムプロンプト「{data["custom_prompt_name"]}」を使用して応答しました。"

        if data.get("agent_name") and data.get("agent_used"):
            enhanced_message += f"\n\n🤖 {data["agent_name"]} が処理を担当しました。"

        return enhanced_message

    def _build_error_message(self, fallback_message: str, error: Exception) -> str:
        error_message = fallback_message or "申し訳ございません。処理中にエラーが発生しました。"
        error_type = self._classify_error(error)

        if error_type == "api_key_missing":
            error_message += "\n\n🔑 APIキーが設定されていません。環境設定を確認してください。"
        elif error_type == "rate_limit":
            error_message += "\n\n⏱️ API利用制限に達しました。しばらく待ってから再試行してください。"
        elif error_type == "network_error":
            error_message += "\n\n🌐 ネットワークエラーが発生しました。接続を確認してください。"
        elif error_type == "server_error":
            error_message += "\n\n🔧 サーバーエラーが発生しました。しばらく待ってから再試行してください。"
        else:
            error_message += f"\n\n⚠️ {str(error) or '不明なエラーが発生しました。'}"

        error_message += "\n\n(フォールバック応答: API接続エラーのため)"
        return error_message

    def _classify_error(self, error: Exception) -> str:
        message = str(error).lower()

        if "api_key" in message or "authentication" in message:
            return "api_key_missing"
        if "rate limit" in message or "429" in message:
            return "rate_limit"
        if "network" in message or "connection" in message or "fetch" in message:
            return "network_error"
        if "500" in message or "502" in message or "503" in message:
            return "server_error"
        return "unknown"

    def _build_metadata(self, data: dict) -> dict:
        return {
            "response_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "command_count": len(data.get("commands", [])),
            "has_warning": bool(data.get("warning")),
            "response_source": data.get("agent_used", "unknown"),
            "context_size": self._estimate_context_size(data),
            "custom_prompt_used": bool(data.get("custom_prompt_used")),
            "fallback_mode": bool(data.get("fallback_mode")),
            "routing": data.get("routing")
        }

    def _build_error_metadata(self, error: Exception, context: dict) -> dict:
        return {
            "error_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "error_type": self._classify_error(error),
            "error_message": str(error) or "Unknown error",
            "context_present": bool(context),
            "custom_prompt_used": bool(context.get("customPrompt", {}).get("enabled")),
            "fallback_mode": True,
            "recovery": "mock_response"
        }

    def _build_fallback_metadata(self, context: dict, reason: str) -> dict:
        return {
            "fallback_time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "fallback_reason": reason,
            "context_present": bool(context),
            "custom_prompt_used": bool(context.get("customPrompt", {}).get("enabled")),
            "recovery": "mock_response"
        }

    def _estimate_context_size(self, data: dict) -> int:
        size = 0
        if data.get("message"): size += len(data["message"])
        if data.get("raw_llm_response"): size += len(data["raw_llm_response"])
        if data.get("commands"): size += len(json.dumps(data["commands"]))
        return size

    def _log_response_info(self, response: dict):
        message = response.get("message", "")
        commands = response.get("commands", [])
        provider = response.get("provider", "")
        model = response.get("model", "")
        agent_used = response.get("agent_used", "")
        parse_success = response.get("parse_success", False)
        
        print("✅ Response built successfully:", {
            "provider": provider,
            "model": model,
            "agent_used": agent_used,
            "command_count": len(commands),
            "parse_success": parse_success,
            "message_length": len(message),
            "timestamp": response.get("timestamp")
        })

        if response.get("warning"):
            print("⚠️ Response warning:", response["warning"])

    def _log_error_info(self, error_response: dict):
        print("❌ Error response built:", {
            "provider": error_response.get("provider"),
            "error_type": error_response.get("error_type"),
            "fallback_mode": error_response.get("fallback_mode"),
            "timestamp": error_response.get("timestamp")
        })

    def get_response_stats(self):
        return {
            "default_format": list(self.default_response_format.keys()),
            "supported_error_types": ["api_key_missing", "rate_limit", "network_error", "server_error", "unknown"],
            "enhancement_features": ["newChatSuggestion", "customPromptInfo", "agentInfo"],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    def validate_response_format(self, response: dict):
        required_fields = ["message", "commands", "provider", "model", "timestamp"]
        missing_fields = [field for field in required_fields if field not in response]
        
        if missing_fields:
            raise ValueError(f"Invalid response format: missing fields {", ".join(missing_fields)}")
        
        if not isinstance(response.get("commands"), list):
            raise ValueError("Invalid response format: commands must be an array")
        
        return True
