import datetime
import json
from ..ai.agent_dispatcher import AgentDispatcher
from ..chat.conversation_manager import ConversationManager
from ..validation.command_validator import CommandValidator
from ..validation.response_builder import ResponseBuilder # ResponseBuilderをインポート
from ..utils.response_utils import get_mock_response # 必要に応じて利用

class ChatOrchestrator:
    def __init__(self, agent_dispatcher: AgentDispatcher, conversation_manager: ConversationManager, command_validator: CommandValidator, response_builder: ResponseBuilder):
        self.agent_dispatcher = agent_dispatcher
        self.conversation_manager = conversation_manager
        self.command_validator = command_validator
        self.response_builder = response_builder # ResponseBuilderを追加

    async def process_chat(self, message: str, provider: str = "gemini", model: str = None, context: dict = None):
        if context is None:
            context = {}
            
        try:
            # 1. 入力バリデーション (ここでは簡易的に、必要に応じてresponse_utils.validate_chat_inputを使用)
            if not message or not isinstance(message, str):
                raise ValueError("メッセージが無効です")

            # 2. 会話コンテキストの準備
            enriched_context = await self.conversation_manager.prepare_context(context)
            if enriched_context is None:
                enriched_context = {}  # None の場合のフォールバック

            # 3. エージェント処理の実行
            agent_result = await self.agent_dispatcher.dispatch(
                message,
                enriched_context,
                provider,
                model
            )
            if agent_result is None:
                print("⚠️ Agent dispatcher returned None. Building fallback response.")
                return self.response_builder.build_fallback_response(
                    message,
                    enriched_context,
                    reason="Agent dispatcher failed to return a result."
                )

            # 4. コマンドの検証
            validated_commands = self._validate_commands(agent_result.get("commands", []))

            # 5. 最終レスポンスの構築 (ResponseBuilderを使用)
            custom_prompt = enriched_context.get("customPrompt") or {}
            return self.response_builder.build_success_response({
                "message": agent_result.get("message", "処理が完了しました。"),
                "commands": validated_commands,
                "agent_used": agent_result.get("agent"),
                "raw_llm_response": agent_result.get("raw_llm_response"),
                "provider": provider,
                "model": model,
                "parse_success": agent_result.get("parse_success", True), # agent_resultからparse_successを取得
                "warning": agent_result.get("warning"),
                "error": agent_result.get("error"),
                "should_suggest_new_chat": self.conversation_manager.should_suggest_new_chat(enriched_context), # 会話マネージャーから取得
                "custom_prompt_used": bool(custom_prompt.get("enabled")),
                "custom_prompt_name": custom_prompt.get("name"),
                "debug_context": enriched_context # デバッグ用にコンテキストを追加
            })

        except Exception as e:
            print(f"❌ Chat Orchestrator Error: {e}")

            # contextがNoneの場合に備えて空の辞書を渡す
            safe_context = context if context is not None else {}

            # エラー時のフォールバック処理 (ResponseBuilderを使用)
            return self.response_builder.build_error_response(
                e,
                provider,
                model,
                message,
                safe_context
            )

    def _validate_commands(self, commands: list) -> list:
        if not isinstance(commands, list):
            return []

        validated_commands = []
        for cmd in commands:
            try:
                if self.command_validator.validate(cmd):
                    validated_commands.append(cmd)
            except ValueError as e:
                print(f"Command validation failed: {e} for command: {cmd}")
        return validated_commands

    def get_available_agents(self):
        return self.agent_dispatcher.get_available_agents()

    def get_system_status(self):
        # import datetime # 不要（トップレベルでインポート済み）
        return {
            "agent_dispatcher": self.agent_dispatcher.get_status(),
            "conversation_manager": self.conversation_manager.get_status(),
            "command_validator": self.command_validator.get_validator_stats(),
            "response_builder": self.response_builder.get_response_stats(), # ResponseBuilderのステータスを追加
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }