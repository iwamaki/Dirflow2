import json

# システムプロンプト定義（空：各エージェントが独自プロンプトを持つ）
SYSTEM_PROMPTS = {}

# コンテキスト情報テンプレート
CONTEXT_TEMPLATES = {
    "basic": "[コンテキスト情報]\n現在のディレクトリ: {{CURRENT_PATH}}\nファイル数: {{FILE_COUNT}}\n現在編集中: {{CURRENT_FILE}}",

    "withCustomPrompt": "[コンテキスト情報]\n現在のディレクトリ: {{CURRENT_PATH}}\nファイル数: {{FILE_COUNT}}\n現在編集中: {{CURRENT_FILE}}\nカスタムプロンプト: {{CUSTOM_PROMPT_NAME}} (有効)",

    "withOpenFile": "[コンテキスト情報]\n現在のディレクトリ: {{CURRENT_PATH}}\nファイル数: {{FILE_COUNT}}\n現在編集中: {{CURRENT_FILE}}\n\n[現在開いているファイルの詳細]\n{{OPEN_FILE_INFO}}"
}

class PromptBuilder:
    def __init__(self):
        self.system_prompt = ""
        self.user_message = ""
        self.context = {}
        self.conversation_history = []
        self.custom_prompt = None
        self.max_history_items = 15  # デフォルトの履歴数

    def set_system_prompt(self, prompt_key: str):
        if prompt_key in SYSTEM_PROMPTS:
            self.system_prompt = SYSTEM_PROMPTS[prompt_key]
        else:
            raise ValueError(f"Unknown system prompt: {prompt_key}")
        return self

    def set_custom_prompt(self, custom_prompt: dict):
        self.custom_prompt = custom_prompt
        return self

    def set_context(self, context: dict):
        self.context = context
        return self

    def set_conversation_history(self, history: list):
        self.conversation_history = history if history is not None else []
        return self

    def set_max_history_items(self, max_items: int):
        self.max_history_items = max_items
        return self

    def set_user_message(self, message: str):
        self.user_message = message
        return self

    def _replace_template_vars(self, text: str, context: dict):
        file_list = context.get("fileList", [])
        conversation_history = context.get("conversationHistory", [])

        return text.replace("{{CURRENT_PATH}}", context.get("currentPath", "/workspace")) \
                   .replace("{{FILE_COUNT}}", str(len(file_list))) \
                   .replace("{{FILE_LIST}}", json.dumps(file_list, indent=2)) \
                   .replace("{{HISTORY_COUNT}}", str(len(conversation_history))) \
                   .replace("{{CURRENT_FILE}}", context.get("currentFile", "なし")) \
                   .replace("{{CUSTOM_PROMPT_NAME}}", self.custom_prompt.get("name", "") if self.custom_prompt else "") \
                   .replace("{{OPEN_FILE_INFO}}", context.get("openFileInfo", ""))

    def build_system_prompt(self):
        if self.custom_prompt and self.custom_prompt.get("content"):
            return self.custom_prompt["content"]

        prompt = self.system_prompt
        if "contextTemplate" in SYSTEM_PROMPTS:
            prompt += "\n\n" + SYSTEM_PROMPTS["contextTemplate"]

        return self._replace_template_vars(prompt, self.context)

    def build_context_info(self):
        template = ""
        if self.context.get("openFileInfo"):
            template = CONTEXT_TEMPLATES["withOpenFile"]
        elif self.custom_prompt and self.custom_prompt.get("enabled"):
            template = CONTEXT_TEMPLATES["withCustomPrompt"]
        else:
            template = CONTEXT_TEMPLATES["basic"]

        return self._replace_template_vars(template, self.context)

    def build_conversation_history(self, provider: str):
        recent_history = self.conversation_history[-self.max_history_items:]
        messages = []

        if provider in ["claude", "openai", "local"]:
            for exchange in recent_history:
                messages.append({"role": "user", "content": exchange.get("user", "")})
                if exchange.get("ai"):
                    messages.append({"role": "assistant", "content": exchange["ai"]})
        elif provider == "gemini":
            history_text = ""
            if len(recent_history) > 0:
                for exchange in recent_history:
                    history_text += f"【ユーザー】\n{exchange.get('user', '')}\n\n"
                    if exchange.get("ai"):
                        ai_response = exchange["ai"]
                        try:
                            parsed = json.loads(ai_response)
                            history_text += f"【アシスタント】\n{parsed.get('message', ai_response)}\n\n"
                        except json.JSONDecodeError:
                            history_text += f"【アシスタント】\n{ai_response}\n\n"
            return history_text
        
        return messages

    def build_final_user_message(self):
        context_info = self.build_context_info()
        return f"{self.user_message}\n\n{context_info}"

    def build_for_provider(self, provider: str):
        system_prompt = self.build_system_prompt()

        if provider == "claude":
            claude_messages = self.build_conversation_history("claude")
            claude_messages.append({
                "role": "user",
                "content": self.build_final_user_message()
            })
            return {
                "system": system_prompt,
                "messages": claude_messages
            }
        elif provider in ["openai", "local"]:
            messages = [{"role": "system", "content": system_prompt}]
            history = self.build_conversation_history(provider)
            messages.extend(history)
            messages.append({
                "role": "user",
                "content": self.build_final_user_message()
            })
            return {"messages": messages}
        elif provider == "gemini":
            history_text = self.build_conversation_history("gemini")
            user_message = self.build_final_user_message()

            full_content = (
                "【システムプロンプト】\n" + system_prompt + "\n\n" +
                "【過去の会話】\n" + history_text +
                "【現在の質問】\n【ユーザー】\n" + user_message
            )
            return {"content": full_content}
        else:
            raise ValueError(f"Unsupported provider: {provider}")

def create_prompt_builder():
    return PromptBuilder()

def log_prompt_debug_info(prompt_data: dict, provider: str):
    if True:  # デバッグログを強制的に有効化
        print(f"--- {provider.upper()} API Request ---")
        print("Prompt Data:")
        print(json.dumps(prompt_data, indent=2, ensure_ascii=False))
        print("--------------------------")
