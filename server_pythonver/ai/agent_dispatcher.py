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

    async def dispatch(self, user_message: str, context: dict, provider: str = "gemini", model: str = None, test_invalid_command: bool = False):
        try:
            selected_agent = await self._select_agent_with_llm(user_message, context)
            
            print(f"Selected Agent: {selected_agent['name']}")

            prompt = self._build_agent_prompt(selected_agent, user_message, context)
            
            actual_provider = provider if provider else context.get("provider", "gemini")
            actual_model = model if model else context.get("model", "gemini-1.5-flash")

            llm_response = ""
            parse_success = False
            warning = None
            error = None
            message_from_llm = None

            try:
                if test_invalid_command:
                    llm_response = "```json\n{\"action\": \"non_existent_action\", \"path\": \"test.txt\"}\n```"
                else:
                    llm_response = await self.llm_adapter.call_llm(prompt, actual_provider, actual_model, context)
                
                # 汎用アシスタントの場合は直接メッセージとして扱う
                if selected_agent["name"] == "汎用アシスタント":
                    parsed_data = {
                        "commands": [],
                        "parse_success": True,  # 常に成功とみなす
                        "warning": None,
                        "message": llm_response
                    }
                else:
                    parsed_data = self._parse_llm_response_for_commands(llm_response)
                
                commands = parsed_data["commands"]
                parse_success = parsed_data["parse_success"]
                warning = parsed_data["warning"]
                message_from_llm = parsed_data["message"]

            except Exception as e:
                error = str(e)
                warning = f"LLM応答処理中にエラーが発生: {e}"
                commands = []  # エラー時はコマンドなし
                print(f"❌ AgentDispatcher: LLM call failed: {e}")

            validated_commands = []
            if commands:
                for cmd in commands:
                    try:
                        if self.command_validator.validate(cmd):
                            validated_commands.append(cmd)
                        else:
                            if warning is None:
                                warning = f"コマンドバリデーション失敗: {cmd}"
                            else:
                                warning += f"; コマンドバリデーション失敗: {cmd}"
                    except ValueError as e:
                        print(f"Command validation failed: {e} for command: {cmd}")
                        if warning is None:
                            warning = f"コマンドバリデーション失敗: {e}"
                        else:
                            warning += f"; コマンドバリデーション失敗: {e}"

            result = {
                "agent": selected_agent["name"],
                "commands": validated_commands,
                "raw_llm_response": llm_response,
                "parse_success": parse_success,
                "warning": warning,
                "error": error,
                "message": message_from_llm if message_from_llm else (llm_response if not parse_success and not error else "処理が完了しました。")
            }

            return result

        except Exception as e:
            print(f"❌ AgentDispatcher: Critical error in dispatch: {e}")
            # 致命的エラーが発生した場合のフォールバック
            return {
                "agent": "general_assistant",
                "commands": [],
                "raw_llm_response": "",
                "parse_success": False,
                "warning": "AgentDispatcherで予期せぬエラーが発生しました",
                "error": str(e),
                "message": f"申し訳ありません。処理中にエラーが発生しました: {e}"
            }

    def _parse_llm_response_for_commands(self, llm_response: str):
        commands = []
        parse_success = False
        warning = None
        message_from_llm = None

        try:
            # JSONブロックの抽出
            json_content = llm_response.strip()
            if "```json" in json_content:
                start = json_content.find("```json") + len("```json")
                end = json_content.rfind("```")
                if end > start:
                    json_content = json_content[start:end].strip()
        
            # JSONとして解析
            try:
                parsed = json.loads(json_content)
                
                # パースされたJSONの処理
                if isinstance(parsed, dict):
                    if "action" in parsed:  # 単一コマンドの場合
                        commands = [parsed]
                        parse_success = True
                    elif "commands" in parsed and isinstance(parsed["commands"], list):
                        commands = parsed["commands"]
                        parse_success = True
                    if "message" in parsed:
                        message_from_llm = parsed["message"]
                        parse_success = True
                elif isinstance(parsed, list):
                    commands = parsed
                    parse_success = True
                else:
                    warning = "LLM応答は有効なJSONですが、予期しない形式です (dictまたはlistではありません)。"
                    message_from_llm = llm_response  # フォールバックとして元のレスポンスを使用
        
            except json.JSONDecodeError:
                # JSONとして解析できない場合
                warning = "LLM応答のJSONパースに失敗しました"
                message_from_llm = llm_response
                parse_success = False  # コマンド系エージェントの場合、JSONパース失敗は処理失敗とみなす
                
        except Exception as e:
            warning = f"LLM応答のパース中に予期せぬエラーが発生しました: {e}"
            message_from_llm = llm_response  # エラー時は元のレスポンスをメッセージとして設定
        
        return {
            "commands": commands, 
            "parse_success": parse_success, 
            "warning": warning, 
            "message": message_from_llm or llm_response  # message_from_llmがNoneの場合は元のレスポンスを使用
        }

    def get_status(self):
        """AgentDispatcherの現在の状態を取得する"""
        import datetime # ここでインポート
        return {
            "initialized_agents": list(self.agents.keys()),
            "web_search_service_status": self.web_search_service.get_status(),
            "command_validator_stats": self.command_validator.get_validator_stats(),
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    async def _select_agent_with_llm(self, user_message: str, context: dict):
        """LLMを使用してユーザーの意図を分析し、最適なエージェントを選択する"""
        # エージェント選択用のプロンプト
        agent_selection_prompt = self._build_agent_selection_prompt(user_message)
        
        # LLMを呼び出して意図分析を行う（より軽量なモデルを使用可能）
        model = context.get("agent_selection_model", context.get("model", "gemini-1.5-flash"))
        provider = context.get("provider", "gemini")
        
        try:
            llm_response = await self.llm_adapter.call_llm(
                agent_selection_prompt, 
                provider, 
                model, 
                {"max_tokens": 100}  # 短い応答で十分
            )
            
            # LLMの応答から選択されたエージェントを特定
            agent_key = self._parse_agent_selection_response(llm_response)
            if agent_key in self.agents:
                return self.agents[agent_key]
        except Exception as e:
            print(f"エージェント選択中にエラーが発生: {e}")
        
        # エラー時やLLMが明確な選択を返さなかった場合はデフォルトを使用
        return self.agents["general_assistant"]
    
    def _build_agent_selection_prompt(self, user_message: str):
        """エージェント選択のためのプロンプトを構築する"""
        agent_descriptions = "\n".join([
            f"- {key}: {agent['name']} - {agent['description']}"
            for key, agent in self.agents.items()
        ])
        
        return f"""ユーザーの入力メッセージから、どのエージェントが対応すべきか判断してください。
選択肢は次のとおりです：
{agent_descriptions}

応答は、選択したエージェントのキー（file_expert、web_search_expert、general_assistant）のみを返してください。
他の説明は不要です。

ユーザーのメッセージ：{user_message}

選択されたエージェント："""

    def _parse_agent_selection_response(self, response: str):
        """LLMの応答からエージェントのキーを抽出する"""
        response = response.strip().lower()
        
        # キーワードの完全一致を試す
        if response == "file_expert":
            return "file_expert"
        elif response == "web_search_expert":
            return "web_search_expert"
        elif response == "general_assistant":
            return "general_assistant"
            
        # 部分一致を試す
        if "file" in response or "ファイル" in response:
            return "file_expert"
        elif "search" in response or "検索" in response or "web" in response:
            return "web_search_expert"
        
        # デフォルト
        return "general_assistant"

    def _build_agent_prompt(self, agent_info: dict, user_message: str, context: dict):
        prompt = agent_info["prompt_template"]
        if agent_info["name"] == "ファイル操作エキスパート":
            prompt = prompt.format(current_path=context.get("currentPath", "/workspace"))
        
        # ユーザーメッセージを追加
        prompt += f"\nユーザーの指示: {user_message}"
        print(f"Generated Agent Prompt:\n{prompt}")
        return prompt


