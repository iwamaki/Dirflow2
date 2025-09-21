from typing import Dict, Any, List, Optional
from langchain.agents import create_react_agent, AgentExecutor
from langchain.memory import ConversationBufferMemory
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import Tool

from ..langchain_tools.web_search_tool import WebSearchTool
from ..langchain_tools.file_tool import FileOperationTool


class LangChainChatAgent:
    def __init__(self):
        self.tools = [
            WebSearchTool(),
            FileOperationTool()
        ]

        # メモリの設定
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )

        # プロンプトテンプレートの設定
        self.prompt_template = self._create_prompt_template()

        # LLMとエージェントは初回使用時に初期化
        self.llm = None
        self.agent_executor = None

    def _create_prompt_template(self) -> PromptTemplate:
        """ReActエージェント用のプロンプトテンプレートを作成"""
        template = """あなたは親切で有能なAIアシスタントです。ユーザーの質問や要求に対して、適切なツールを使用して回答してください。

TOOLS:
------

You have access to the following tools:

{tools}

To use a tool, please use the following format:

```
Thought: Do I need to use a tool? What should I do?
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
```

When you have a response to say to the Human, or if you do not need to use a tool, you MUST use the format:

```
Thought: Do I need to use a tool? No
Final Answer: [your response here]
```

ルール:
1. 情報が不足している場合や最新の情報が必要な場合は、web_searchツールを使用してください
2. ファイル操作が必要な場合は、file_operationツールを使用してください
3. 単純な挨拶や会話には、ツールを使わずに直接回答してください
4. 日本語で自然な会話を心がけてください

Begin!

Previous conversation history:
{chat_history}

New input: {input}
Thought: {agent_scratchpad}"""

        return PromptTemplate(
            template=template,
            input_variables=["tools", "tool_names", "chat_history", "input", "agent_scratchpad"]
        )

    def _initialize_agent(self, provider: str = "gemini", model: str = "gemini-1.5-flash"):
        """LLMとエージェントを初期化"""
        try:
            print(f"🔧 Initializing LLM with provider: {provider}, model: {model}")

            if provider == "gemini":
                self.llm = ChatGoogleGenerativeAI(
                    model=model,
                    temperature=0.1,
                    max_retries=3
                )
                print("✅ LLM initialized successfully")
            else:
                # 他のプロバイダーも後で追加可能
                raise ValueError(f"サポートされていないプロバイダー: {provider}")

            print(f"🔧 Creating ReAct agent with {len(self.tools)} tools")
            print(f"🔧 Available tools: {[tool.name for tool in self.tools]}")

            # ReActエージェントを作成
            agent = create_react_agent(
                llm=self.llm,
                tools=self.tools,
                prompt=self.prompt_template
            )
            print("✅ ReAct agent created successfully")

            # エージェントエグゼキューターを作成
            self.agent_executor = AgentExecutor(
                agent=agent,
                tools=self.tools,
                memory=self.memory,
                verbose=True,
                max_iterations=5,
                handle_parsing_errors=True
            )
            print("✅ Agent executor created successfully")

        except Exception as e:
            print(f"❌ Agent initialization failed: {str(e)}")
            import traceback
            print(f"❌ Initialization traceback: {traceback.format_exc()}")
            raise

    async def process_chat(
        self,
        message: str,
        provider: str = "gemini",
        model: str = "gemini-1.5-flash",
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """チャットメッセージを処理"""
        try:
            print(f"🤖 LangChainChatAgent: Processing message: {message}")
            print(f"🤖 Provider: {provider}, Model: {model}")

            # 初回または設定変更時にエージェントを初期化
            if self.agent_executor is None:
                print("🤖 Initializing agent...")
                self._initialize_agent(provider, model)
                print("🤖 Agent initialized successfully")

            # コンテキストの情報をメッセージに追加（必要に応じて）
            enhanced_message = message
            if context and context.get("currentPath"):
                enhanced_message = f"現在の作業ディレクトリ: {context['currentPath']}\n\nユーザーの質問: {message}"

            print(f"🤖 Enhanced message: {enhanced_message}")

            # エージェントを実行
            print("🤖 Invoking agent executor...")
            result = await self.agent_executor.ainvoke({
                "input": enhanced_message
            })

            print(f"🤖 Agent result: {result}")

            return {
                "message": result["output"],
                "success": True,
                "agent_used": "LangChain ReAct Agent",
                "provider": provider,
                "model": model,
                "intermediate_steps": result.get("intermediate_steps", [])
            }

        except Exception as e:
            import traceback
            print(f"❌ LangChainChatAgent Error: {str(e)}")
            print(f"❌ Traceback: {traceback.format_exc()}")
            return {
                "message": f"申し訳ありません。処理中にエラーが発生しました: {str(e)}",
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "provider": provider,
                "model": model
            }

    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """会話履歴を取得"""
        try:
            messages = self.memory.chat_memory.messages
            history = []
            for msg in messages:
                if hasattr(msg, 'type'):
                    history.append({
                        "type": msg.type,
                        "content": msg.content
                    })
            return history
        except Exception:
            return []

    def clear_memory(self):
        """会話履歴をクリア"""
        self.memory.clear()

    def get_status(self) -> Dict[str, Any]:
        """エージェントの状態を取得"""
        return {
            "initialized": self.agent_executor is not None,
            "available_tools": [tool.name for tool in self.tools],
            "memory_messages_count": len(self.memory.chat_memory.messages) if self.memory else 0,
            "llm_model": getattr(self.llm, 'model', None) if self.llm else None
        }