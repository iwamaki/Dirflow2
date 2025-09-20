import json
from ..tool.web_search_service import WebSearchService
from ..validation.command_validator import CommandValidator

class AgentDispatcher:
    def __init__(self, llm_adapter, web_search_service=None, command_validator=None):
        self.llm_adapter = llm_adapter
        self.web_search_service = web_search_service if web_search_service else WebSearchService()
        self.command_validator = command_validator if command_validator else CommandValidator()

        self.agents = {
            "file_expert": {
                "name": "ファイル操作エキスパート",
                "description": "ファイルやディレクトリの作成、読み込み、編集、削除、コピー、移動、一覧表示、一括操作など、ファイルシステム関連のタスクを処理します。",
                "capabilities": [
                    "create_file", "create_directory", "delete_file", "copy_file", "move_file",
                    "read_file", "edit_file", "list_files",
                    "batch_delete", "batch_copy", "batch_move"
                ],
                "prompt_template": """あなたはファイル操作のエキスパートAIです。ユーザーの指示に基づいて、ファイルシステム操作コマンドをJSON形式で生成します。
利用可能なコマンド:
- create_file: ファイルを作成します。例: {{"action": "create_file", "path": "path/to/file.txt", "content": "ファイルの内容"}}
- create_directory: ディレクトリを作成します。例: {{"action": "create_directory", "path": "path/to/directory"}}
- delete_file: ファイルを削除します。例: {{"action": "delete_file", "path": "path/to/file.txt"}}
- copy_file: ファイルをコピーします。例: {{"action": "copy_file", "source": "path/to/source.txt", "destination": "path/to/destination.txt"}}
- move_file: ファイルを移動またはリネームします。例: {{"action": "move_file", "source": "path/to/old_name.txt", "destination": "path/to/new_name.txt"}}
- read_file: ファイルの内容を読み込みます。例: {{"action": "read_file", "path": "path/to/file.txt"}}
- edit_file: ファイルの内容を編集します。例: {{"action": "edit_file", "path": "path/to/file.txt", "content": "新しいファイルの内容"}}
- list_files: ディレクトリ内のファイルとディレクトリを一覧表示します。例: {{"action": "list_files", "path": "path/to/directory"}}
- batch_delete: 複数のファイルを一括削除します。例: {{"action": "batch_delete", "paths": ["path/to/file1.txt", "path/to/file2.txt"]}}
- batch_copy: 複数のファイルを一括コピーします。例: {{"action": "batch_copy", "sources": ["path/to/file1.txt", "path/to/file2.txt"], "destination": "path/to/directory"}}
- batch_move: 複数のファイルを一括移動します。例: {{"action": "batch_move", "sources": ["path/to/file1.txt", "path/to/file2.txt"], "destination": "path/to/directory"}}

ユーザーの指示を正確に理解し、適切なコマンドを1つ以上生成してください。
複数のコマンドが必要な場合は、JSON配列として返してください。
例: [{{"action": "create_directory", "path": "new_dir"}}, {{"action": "create_file", "path": "new_dir/file.txt", "content": "Hello"}}]
ファイルの内容を生成する場合は、具体的な内容を含めてください。
現在の作業ディレクトリは {current_path} です。相対パスを使用してください。
"""
            },
            "web_search_expert": {
                "name": "Web検索エキスパート",
                "description": "インターネット上の情報を検索し、ユーザーの質問に答えるための情報収集を行います。",
                "capabilities": ["web_search"],
                "prompt_template": """あなたはWeb検索のエキスパートAIです。ユーザーの質問や指示に基づいて、Web検索コマンドをJSON形式で生成します。
利用可能なコマンド:
- web_search: 指定されたクエリでWeb検索を実行します。例: {{"action": "web_search", "query": "検索クエリ", "options": {{"maxResults": 5, "provider": "auto"}}}}
  - options:
    - maxResults: 検索結果の最大数 (1-20, デフォルト: 10)
    - provider: 検索プロバイダー ('auto', 'tavily', 'google', 'duckduckgo', デフォルト: 'auto')
    - language: 検索結果の言語 (ISO 639-1コード, 例: 'ja', 'en')
    - region: 検索結果の地域 (ISO 3166-1 alpha-2コード, 例: 'JP', 'US')
    - filterDomains: 特定のドメインに絞って検索 (配列)
    - excludeDomains: 特定のドメインを除外して検索 (配列)

ユーザーの指示を正確に理解し、最適な検索クエリとオプションを含むコマンドを1つ生成してください。
例: {{"action": "web_search", "query": "最新のAI技術トレンド 2024", "options": {{"maxResults": 3, "language": "ja"}}}}
"""
            },
            "general_assistant": {
                "name": "汎用アシスタント",
                "description": "上記のエキスパートエージェントで処理できない一般的な質問やタスクに対応します。",
                "capabilities": [], # 特定のコマンドは持たない
                "prompt_template": """あなたは親切で有能な汎用アシスタントAIです。
ユーザーの質問や指示に対して、最も適切と思われる情報を提供したり、対話を行ったりします。
もし、ファイル操作やWeb検索が必要な場合は、その旨をユーザーに伝え、具体的な指示を促してください。
例: \"ファイルを作成するには、具体的なファイル名と内容を教えていただけますか？\"
例: \"Web検索を行うには、どのような情報を知りたいか、具体的なキーワードを教えてください。\"
"""
            }
        }

    def dispatch(self, user_message: str, context: dict):
        # ユーザーメッセージから意図を推測し、適切なエージェントを選択
        # ここでは簡略化のため、キーワードベースでエージェントを選択する
        # 実際にはLLMを使って意図を推測する
        if "ファイル" in user_message or "ディレクトリ" in user_message or "フォルダ" in user_message or \
           "作成" in user_message or "読んで" in user_message or "編集" in user_message or \
           "削除" in user_message or "コピー" in user_message or "移動" in user_message or \
           "一覧" in user_message or "一括" in user_message:
            selected_agent = self.agents["file_expert"]
        elif "検索" in user_message or "調べて" in user_message or "リサーチ" in user_message:
            selected_agent = self.agents["web_search_expert"]
        else:
            selected_agent = self.agents["general_assistant"]

        print(f"Selected Agent: {selected_agent['name']}")

        # 選択されたエージェントのプロンプトを構築
        prompt = self._build_agent_prompt(selected_agent, user_message, context)

        # LLMを呼び出して応答を取得
        llm_response = self.llm_adapter.get_completion(prompt, context.get("provider", "gemini"), context.get("model", "gemini-pro"))

        # LLMの応答をパースし、コマンドを抽出
        commands = self._parse_llm_response_for_commands(llm_response)

        # コマンドのバリデーション
        if commands:
            validated_commands = []
            for cmd in commands:
                try:
                    if self.command_validator.validate(cmd):
                        validated_commands.append(cmd)
                except ValueError as e:
                    print(f"Command validation failed: {e} for command: {cmd}")
            return {"agent": selected_agent["name"], "commands": validated_commands, "raw_llm_response": llm_response}
        else:
            return {"agent": selected_agent["name"], "message": llm_response, "raw_llm_response": llm_response}

    def _build_agent_prompt(self, agent_info: dict, user_message: str, context: dict):
        prompt = agent_info["prompt_template"]
        if agent_info["name"] == "ファイル操作エキスパート":
            prompt = prompt.format(current_path=context.get("currentPath", "/workspace"))
        
        # ユーザーメッセージを追加
        prompt += f"\nユーザーの指示: {user_message}"
        return prompt

    def _parse_llm_response_for_commands(self, llm_response: str):
        # LLMの応答からJSON形式のコマンドを抽出するロジック
        # ここでは、応答が直接JSON文字列であると仮定
        try:
            # LLMの応答がMarkdownのコードブロック形式で返される場合を考慮
            if llm_response.strip().startswith("```json"):
                json_str = llm_response.strip()[len("```json"):].strip()
                if json_str.endswith("```"):
                    json_str = json_str[:-len("```")].strip()
                return json.loads(json_str)
            else:
                # 直接JSONとしてパースを試みる
                return json.loads(llm_response)
        except json.JSONDecodeError:
            return []
