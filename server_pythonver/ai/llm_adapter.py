import os
import json
import httpx # 非同期HTTPクライアント
from .prompt_builder import create_prompt_builder, log_prompt_debug_info # prompt_builderをインポート

# LLM Providers Configuration (JavaScript版をPythonに移植)
LLM_PROVIDERS = {
    "claude": {
        "name": "Claude",
        "api_url": "https://api.anthropic.com/v1/messages",
        "models": [
            "claude-3-haiku-20240307",
            "claude-3-5-haiku-20241022",
            "claude-sonnet-4-20250514",
            "claude-opus-4-1-20250805"
        ],
        "default_model": "claude-3-5-haiku-20241022"
    },
    "openai": {
        "name": "OpenAI GPT",
        "api_url": "https://api.openai.com/v1/chat/completions",
        "models": [
            "gpt-4.1-mini",
            "gpt-4",
            "gpt-4-turbo"
        ],
        "default_model": "gpt-4"
    },
    "gemini": {
        "name": "Google Gemini",
        "api_url": "https://generativelanguage.googleapis.com/v1beta/models",
        "models": [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.5-pro"
        ],
        "default_model": "gemini-2.5-flash"
    },
    "local": {
        "name": "Local LLM",
        "api_url": "http://localhost:11434/api/chat",
        "models": [
            "phi3:latest",
            "llama3:latest",
            "gemma3:4b",
            "gpt-oss:20b"
        ],
        "default_model": "phi3:latest"
    }
}

class LLMAdapter:
    def __init__(self):
        self.providers = LLM_PROVIDERS
        self.http_client = httpx.AsyncClient() # 非同期HTTPクライアントを初期化

    async def call_llm(self, message: str, provider: str = "claude", model: str = None, context: dict = None):
        if context is None:
            context = {}

        self._validate_provider(provider)

        selected_model = model if model else self.providers[provider]["default_model"]

        try:
            print(f"🤖 LLM Adapter: Calling {provider} with model {selected_model}")

            response = None
            if provider == "claude":
                response = await self._call_claude_api(message, selected_model, context)
            elif provider == "openai":
                response = await self._call_openai_api(message, selected_model, context)
            elif provider == "gemini":
                response = await self._call_gemini_api(message, selected_model, context)
            elif provider == "local":
                response = await self._call_local_llm_api(message, selected_model, context)
            else:
                raise ValueError(f"Unsupported provider: {provider}")

            print(f"✅ LLM Adapter: Successfully received response from {provider}")
            print(f"--- {provider.upper()} LLM Response ---")
            print(response)
            return response

        except Exception as e:
            print(f"❌ LLM Adapter: Error calling {provider}: {e}")
            raise Exception(f"{provider} API error: {e}")

    def _validate_provider(self, provider: str):
        if not provider or provider not in self.providers:
            raise ValueError(f"Unknown provider: {provider}")

    async def _call_claude_api(self, message: str, model: str, context: dict):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured")

        prompt_builder = create_prompt_builder() \
            .set_custom_prompt(context.get("customPrompt")) \
            .set_context(context) \
            .set_conversation_history(context.get("conversationHistory")) \
            .set_user_message(message)
        
        prompt_data = prompt_builder.build_for_provider("claude")
        log_prompt_debug_info(prompt_data, "claude")

        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01"
        }
        payload = {
            "model": model,
            "max_tokens": 2048,
            "messages": prompt_data["messages"],
            "system": prompt_data["system"]
        }

        response = await self.http_client.post(self.providers["claude"]["api_url"], headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]

    async def _call_openai_api(self, message: str, model: str, context: dict):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured")

        prompt_builder = create_prompt_builder() \
            .set_custom_prompt(context.get("customPrompt")) \
            .set_context(context) \
            .set_conversation_history(context.get("conversationHistory")) \
            .set_user_message(message)
        
        prompt_data = prompt_builder.build_for_provider("openai")
        log_prompt_debug_info(prompt_data, "openai")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        payload = {
            "model": model,
            "max_tokens": 2048,
            "messages": prompt_data["messages"],
            "temperature": 0.7
        }

        response = await self.http_client.post(self.providers["openai"]["api_url"], headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def _call_gemini_api(self, message: str, model: str, context: dict):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is not configured")

        prompt_builder = create_prompt_builder() \
            .set_custom_prompt(context.get("customPrompt")) \
            .set_context(context) \
            .set_conversation_history(context.get("conversationHistory")) \
            .set_user_message(message)
        
        prompt_data = prompt_builder.build_for_provider("gemini")
        log_prompt_debug_info(prompt_data, "gemini")

        headers = {
            "Content-Type": "application/json"
        }
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt_data["content"]
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 2048,
                "stopSequences": []
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
            ]
        }

        response = await self.http_client.post(
            f"{self.providers['gemini']['api_url']}/{model}:generateContent?key={api_key}",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        if data.get("candidates") and data["candidates"][0].get("content"):
            return data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            raise ValueError("Unexpected Gemini API response format")

    async def _call_local_llm_api(self, message: str, model: str, context: dict):
        api_key = os.getenv("OPENAI_API_KEY") # Local LLMはOpenAIと同じAPIキーを使用する想定
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured for Local LLM")

        prompt_builder = create_prompt_builder() \
            .set_custom_prompt(context.get("customPrompt")) \
            .set_context(context) \
            .set_conversation_history(context.get("conversationHistory")) \
            .set_user_message(message)

        prompt_data = prompt_builder.build_for_provider("local")
        log_prompt_debug_info(prompt_data, "local")

        headers = {
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": prompt_data["messages"],
            "stream": False
        }

        response = await self.http_client.post(self.providers["local"]["api_url"], headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]

    def get_providers(self):
        return self.providers

    def is_provider_available(self, provider: str):
        if provider not in self.providers:
            return False

        if provider == "claude":
            return bool(os.getenv("ANTHROPIC_API_KEY"))
        elif provider == "openai":
            return bool(os.getenv("OPENAI_API_KEY"))
        elif provider == "gemini":
            return bool(os.getenv("GOOGLE_API_KEY"))
        elif provider == "local":
            return True # Local is always available if Ollama is running
        return False

    def get_providers_status(self):
        status = {}
        for provider_name, provider_config in self.providers.items():
            status[provider_name] = {
                "name": provider_config["name"],
                "available": self.is_provider_available(provider_name),
                "models": provider_config["models"],
                "default_model": provider_config["default_model"]
            }
        return status