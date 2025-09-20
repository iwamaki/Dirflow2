import os
import datetime
from urllib.parse import urlparse

# LangChainのインポート (インストールが必要)
# from langchain_community.tools import TavilySearchResults
# from langchain_community.tools import DuckDuckGoSearch
# from langchain_google_community.tools import GoogleCustomSearch

class WebSearchService:
    def __init__(self):
        self.search_providers = {}
        self.search_history = []
        self.max_history_items = 50
        self.max_results_per_search = 10

        self._initialize_search_providers()

    def _initialize_search_providers(self):
        # Tavily Search (推奨 - AIに最適化された検索)
        if os.getenv("TAVILY_API_KEY"):
            try:
                from langchain_community.tools import TavilySearchResults
                self.search_providers["tavily"] = TavilySearchResults(
                    max_results=self.max_results_per_search,
                    api_key=os.getenv("TAVILY_API_KEY")
                )
            except ImportError:
                print("Warning: TavilySearchResults not installed. Please install langchain-community.")

        # Google Custom Search
        if os.getenv("GOOGLE_SEARCH_API_KEY") and os.getenv("GOOGLE_CSE_ID"):
            try:
                from langchain_community.tools.google_search import GoogleSearchAPIWrapper
                self.search_providers["google"] = GoogleSearchAPIWrapper(
                    google_api_key=os.getenv("GOOGLE_SEARCH_API_KEY"),
                    google_cse_id=os.getenv("GOOGLE_CSE_ID")
                )
            except ImportError:
                print("Warning: GoogleSearchAPIWrapper not installed. Please install langchain-community.")

        # DuckDuckGo (APIキー不要、フォールバック用)
        try:
            from langchain_community.tools import DuckDuckGoSearch
            self.search_providers["duckduckgo"] = DuckDuckGoSearch(
                max_results=self.max_results_per_search
            )
        except ImportError:
            print("Warning: DuckDuckGoSearch not installed. Please install langchain-community.")


        print(f"🔍 WebSearchService: Initialized {len(self.search_providers)} search providers")

    async def perform_search(self, query: str, options: dict = None):
        if options is None:
            options = {}

        provider_pref = options.get("provider", "auto")
        max_results = options.get("maxResults", self.max_results_per_search)
        filter_domains = options.get("filterDomains", [])
        exclude_domains = options.get("excludeDomains", [])
        language = options.get("language", "ja")
        region = options.get("region", "jp")

        try:
            print(f"🔍 WebSearchService: Performing search with query: \"{query}\"")

            selected_provider_instance = self._select_provider(provider_pref)
            if not selected_provider_instance:
                raise ValueError("利用可能な検索プロバイダーがありません")

            start_time = datetime.datetime.now()
            # LangChainのinvokeメソッドは同期的に動作する場合があるため、awaitを付ける
            raw_results = await selected_provider_instance.ainvoke(query)
            search_time = (datetime.datetime.now() - start_time).total_seconds() * 1000

            formatted_results = self._format_search_results(raw_results, {
                "maxResults": max_results,
                "filterDomains": filter_domains,
                "excludeDomains": exclude_domains
            })

            self._add_to_history({
                "query": query,
                "provider": self._get_provider_name(selected_provider_instance),
                "results": formatted_results,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "searchTime": search_time
            })

            print(f"✅ WebSearchService: Found {len(formatted_results)} results in {search_time:.2f}ms")

            return {
                "success": True,
                "query": query,
                "results": formatted_results,
                "metadata": {
                    "provider": self._get_provider_name(selected_provider_instance),
                    "searchTime": search_time,
                    "totalResults": len(formatted_results),
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            }

        except Exception as e:
            print(f"❌ WebSearchService: Search failed: {e}")
            return {
                "success": False,
                "query": query,
                "results": [],
                "error": str(e),
                "metadata": {
                    "provider": provider_pref,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
            }

    def _select_provider(self, preference: str):
        if preference == "auto":
            if "tavily" in self.search_providers:
                return self.search_providers["tavily"]
            if "google" in self.search_providers:
                return self.search_providers["google"]
            return self.search_providers.get("duckduckgo")
        
        return self.search_providers.get(preference)

    def _get_provider_name(self, provider_instance):
        for name, instance in self.search_providers.items():
            if instance == provider_instance:
                return name
        return "unknown"

    def _format_search_results(self, raw_results, options: dict):
        max_results = options.get("maxResults", self.max_results_per_search)
        filter_domains = options.get("filterDomains", [])
        exclude_domains = options.get("excludeDomains", [])

        results = []
        if isinstance(raw_results, list):
            results = raw_results
        elif hasattr(raw_results, 'results') and isinstance(raw_results.results, list):
            results = raw_results.results
        elif isinstance(raw_results, str):
            # 文字列結果の場合（DuckDuckGo等）
            return [{
                "title": "Search Result",
                "url": "",
                "snippet": raw_results,
                "source": "text_result"
            }]

        formatted = []
        for result in results:
            url = result.get("url") or result.get("link")
            if not url:
                continue

            # ドメインフィルタリング
            if filter_domains and not any(domain in url for domain in filter_domains):
                continue
            if exclude_domains and any(domain in url for domain in exclude_domains):
                continue

            formatted.append({
                "title": result.get("title") or result.get("name") or "No Title",
                "url": url,
                "snippet": result.get("snippet") or result.get("description") or result.get("content") or "",
                "source": self._extract_domain(url),
                "score": result.get("score", 0),
                "publishedDate": result.get("published_date")
            })
            if len(formatted) >= max_results:
                break
        return formatted

    def _extract_domain(self, url: str):
        try:
            return urlparse(url).hostname
        except ValueError:
            return "unknown"

    def _add_to_history(self, search_entry: dict):
        self.search_history.append(search_entry)
        if len(self.search_history) > self.max_history_items:
            self.search_history = self.search_history[-self.max_history_items:]

    def get_search_history(self, limit: int = 10):
        return self.search_history[-limit:][::-1] # 新しい順

    def clear_search_history(self):
        self.search_history = []

    def get_available_providers(self):
        providers = {}
        for name in self.search_providers.keys():
            providers[name] = {
                "name": self._get_provider_display_name(name),
                "available": True,
                "requiresApiKey": self._requires_api_key(name)
            }
        return providers

    def _get_provider_display_name(self, name: str):
        display_names = {
            "tavily": "Tavily AI Search",
            "google": "Google Custom Search",
            "duckduckgo": "DuckDuckGo"
        }
        return display_names.get(name, name)

    def _requires_api_key(self, name: str):
        return name != "duckduckgo"

    def generate_search_summary(self, search_results: list, query: str):
        if not search_results:
            return f"\"{query}\" に関する検索結果は見つかりませんでした。"

        total_results = len(search_results)
        top_sources = []
        for result in search_results[:3]:
            source = result.get("source")
            if source and source not in top_sources:
                top_sources.append(source)

        return f"\"{query}\" について {total_results} 件の検索結果が見つかりました。主な情報源: {'. '.join(top_sources)}"

    def get_status(self):
        return {
            "availableProviders": list(self.search_providers.keys()),
            "searchHistoryCount": len(self.search_history),
            "maxResultsPerSearch": self.max_results_per_search,
            "isHealthy": len(self.search_providers) > 0,
            "lastActivity": self.search_history[-1]["timestamp"] if self.search_history else None
        }
