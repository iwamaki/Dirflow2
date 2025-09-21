from typing import Dict, Any, Optional
from langchain.tools import BaseTool
from pydantic import Field
from ..tool.web_search_service import WebSearchService


class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = """
    インターネット上の情報を検索します。
    最新の情報、ニュース、技術情報、事実確認が必要な場合に使用してください。
    引数: query (検索クエリの文字列)
    """

    web_search_service: WebSearchService = Field(default_factory=WebSearchService)

    def _run(self, query: str) -> str:
        """Web検索を実行し、結果を文字列で返す"""
        try:
            result = self.web_search_service.perform_search_sync(query)
            search_results = result.get("results", [])

            if not search_results:
                return f"「{query}」に関する検索結果が見つかりませんでした。"

            # 検索結果を整形
            formatted_results = []
            for i, res in enumerate(search_results[:5], 1):
                title = res.get('title', 'タイトルなし')
                url = res.get('url', '')
                snippet = res.get('snippet', '')
                formatted_results.append(f"[{i}] {title}\nURL: {url}\n概要: {snippet}\n")

            return "\n".join(formatted_results)

        except Exception as e:
            return f"Web検索中にエラーが発生しました: {str(e)}"

    async def _arun(self, query: str) -> str:
        """非同期でWeb検索を実行"""
        try:
            result = await self.web_search_service.perform_search(query)
            search_results = result.get("results", [])

            if not search_results:
                return f"「{query}」に関する検索結果が見つかりませんでした。"

            # 検索結果を整形
            formatted_results = []
            for i, res in enumerate(search_results[:5], 1):
                title = res.get('title', 'タイトルなし')
                url = res.get('url', '')
                snippet = res.get('snippet', '')
                formatted_results.append(f"[{i}] {title}\nURL: {url}\n概要: {snippet}\n")

            return "\n".join(formatted_results)

        except Exception as e:
            return f"Web検索中にエラーが発生しました: {str(e)}"