import datetime
import json

class ConversationManager:
    def __init__(self):
        self.max_history_items = 15
        self.max_history_length = 10000  # 文字数制限
        self.context_defaults = {
            "currentPath": "/workspace",
            "fileList": [],
            "currentFile": None,
            "openFileInfo": None
        }

    async def prepare_context(self, context: dict = None):
        if context is None:
            context = {}

        enriched_context = {
            **self.context_defaults,
            **context
        }

        enriched_context["conversationHistory"] = self._optimize_conversation_history(
            enriched_context.get("conversationHistory", [])
        )

        enriched_context["fileList"] = self._normalize_file_list(enriched_context.get("fileList", []))

        enriched_context["customPrompt"] = self._validate_custom_prompt(enriched_context.get("customPrompt"))

        enriched_context["metadata"] = self._generate_context_metadata(enriched_context)

        return enriched_context

    def should_suggest_new_chat(self, context: dict):
        history = context.get("conversationHistory", [])

        if len(history) >= self.max_history_items:
            return True

        total_length = self._calculate_total_history_length(history)
        if total_length >= self.max_history_length:
            return True

        if self._detect_context_switch(history):
            return True

        return False

    def _optimize_conversation_history(self, history: list):
        if not isinstance(history, list):
            return []

        optimized_history = history[-self.max_history_items:]

        total_length = self._calculate_total_history_length(optimized_history)
        if total_length > self.max_history_length:
            optimized_history = self._truncate_history_by_length(optimized_history)

        optimized_history = self._remove_duplicate_history(optimized_history)

        optimized_history = self._remove_incomplete_history(optimized_history)

        return optimized_history

    def _normalize_file_list(self, file_list: list):
        if not isinstance(file_list, list):
            return []

        return [
            file.strip() for file in file_list
            if isinstance(file, str) and len(file.strip()) > 0
        ][:1000]

    def _validate_custom_prompt(self, custom_prompt: dict):
        if not isinstance(custom_prompt, dict):
            return None

        return {
            "enabled": bool(custom_prompt.get("enabled")),
            "name": custom_prompt.get("name", "Unknown"),
            "content": custom_prompt.get("content", ""),
            "description": custom_prompt.get("description", "")
        }

    def _generate_context_metadata(self, context: dict):
        return {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "historyCount": len(context.get("conversationHistory", [])),
            "fileCount": len(context.get("fileList", [])),
            "hasCustomPrompt": bool(context.get("customPrompt", {}).get("enabled")),
            "hasOpenFile": bool(context.get("currentFile")),
            "contextSize": self._calculate_context_size(context)
        }

    def _calculate_total_history_length(self, history: list):
        total = 0
        for entry in history:
            user_length = len(entry.get("user", ""))
            ai_length = len(entry.get("ai", ""))
            total += user_length + ai_length
        return total

    def _truncate_history_by_length(self, history: list):
        truncated = []
        current_length = 0

        for entry in reversed(history):
            entry_length = len(entry.get("user", "")) + len(entry.get("ai", ""))
            if current_length + entry_length <= self.max_history_length:
                truncated.insert(0, entry)
                current_length += entry_length
            else:
                break
        return truncated

    def _remove_duplicate_history(self, history: list):
        seen = set()
        unique_history = []
        for entry in history:
            key = f"{entry.get('user', '')}_{entry.get('ai', '')}"
            if key not in seen:
                seen.add(key)
                unique_history.append(entry)
        return unique_history

    def _remove_incomplete_history(self, history: list):
        return [
            entry for entry in history
            if entry.get("user") and len(entry["user"].strip()) > 0 and \
               (not entry.get("ai") or len(entry["ai"].strip()) >= 3)
        ]

    def _detect_context_switch(self, history: list):
        if len(history) < 3:
            return False

        recent_messages = [entry.get("user", "").lower() for entry in history[-3:]]

        keywords = [
            "新しい", "別の", "違う", "change", "switch", "切り替え",
            "help", "ヘルプ", "使い方", "機能"
        ]

        last_message = recent_messages[-1]
        return any(keyword in last_message for keyword in keywords)

    def _calculate_context_size(self, context: dict):
        size = 0

        size += len(context.get("currentPath", ""))
        size += len(json.dumps(context.get("fileList", [])))
        size += len(context.get("currentFile", ""))
        size += len(context.get("openFileInfo", ""))

        size += self._calculate_total_history_length(context.get("conversationHistory", []))

        if context.get("customPrompt"):
            size += len(context["customPrompt"].get("content", ""))
            size += len(context["customPrompt"].get("name", ""))
            size += len(context["customPrompt"].get("description", ""))

        return size

    def add_history_entry(self, context: dict, user_message: str, ai_response: str):
        history = context.get("conversationHistory", [])

        new_entry = {
            "user": user_message,
            "ai": ai_response,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        history.append(new_entry)
        context["conversationHistory"] = self._optimize_conversation_history(history)

        return context

    def clear_history(self, context: dict):
        context["conversationHistory"] = []
        return context

    def get_history_stats(self, context: dict):
        history = context.get("conversationHistory", [])

        return {
            "totalEntries": len(history),
            "totalLength": self._calculate_total_history_length(history),
            "shouldSuggestNewChat": self.should_suggest_new_chat(context),
            "oldestEntry": history[0]["timestamp"] if history else None,
            "newestEntry": history[-1]["timestamp"] if history else None
        }

    def get_configuration(self):
        return {
            "maxHistoryItems": self.max_history_items,
            "maxHistoryLength": self.max_history_length,
            "contextDefaults": {**self.context_defaults}
        }

    def update_configuration(self, config: dict):
        if config.get("maxHistoryItems") and config["maxHistoryItems"] > 0:
            self.max_history_items = min(config["maxHistoryItems"], 50)

        if config.get("maxHistoryLength") and config["maxHistoryLength"] > 0:
            self.max_history_length = min(config["maxHistoryLength"], 50000)

        if config.get("contextDefaults") and isinstance(config["contextDefaults"], dict):
            self.context_defaults = {**self.context_defaults, **config["contextDefaults"]}

    def get_status(self):
        return {
            "maxHistoryItems": self.max_history_items,
            "maxHistoryLength": self.max_history_length,
            "contextDefaults": self.context_defaults,
            "isHealthy": True,
            "lastActivity": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
