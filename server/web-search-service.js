/* =========================================
    Web検索サービス（LangChain統合）
   ========================================= */

/*
## 概要
LangChainを使用したWeb検索機能を提供する専門サービス。
複数の検索プロバイダーを統合し、結果の整形・フィルタリングを行う。

## 責任
- LangChainを使った検索実行
- 検索結果の整形・要約
- 検索ソースの管理
- 検索履歴の保持
*/

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { GoogleCustomSearch } from "@langchain/community/tools/google_custom_search";

export class WebSearchService {
    constructor() {
        this.searchProviders = new Map();
        this.searchHistory = [];
        this.maxHistoryItems = 50;
        this.maxResultsPerSearch = 10;
        
        // 利用可能な検索プロバイダーを初期化
        this._initializeSearchProviders();
    }

    /**
     * 検索プロバイダーの初期化
     */
    _initializeSearchProviders() {
        // Tavily Search (推奨 - AIに最適化された検索)
        if (process.env.TAVILY_API_KEY) {
            this.searchProviders.set('tavily', new TavilySearchResults({
                maxResults: this.maxResultsPerSearch,
                apiKey: process.env.TAVILY_API_KEY
            }));
        }

        // Google Custom Search
        if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_CSE_ID) {
            this.searchProviders.set('google', new GoogleCustomSearch({
                apiKey: process.env.GOOGLE_SEARCH_API_KEY,
                googleCSEId: process.env.GOOGLE_CSE_ID
            }));
        }

        // DuckDuckGo (APIキー不要、フォールバック用)
        this.searchProviders.set('duckduckgo', new DuckDuckGoSearch({
            maxResults: this.maxResultsPerSearch
        }));

        console.log(`🔍 WebSearchService: Initialized ${this.searchProviders.size} search providers`);
    }

    /**
     * Web検索を実行
     */
    async performSearch(query, options = {}) {
        const {
            provider = 'auto',
            maxResults = this.maxResultsPerSearch,
            filterDomains = [],
            excludeDomains = [],
            language = 'ja',
            region = 'jp'
        } = options;

        try {
            console.log(`🔍 WebSearchService: Performing search with query: "${query}"`);

            // 検索プロバイダーを選択
            const selectedProvider = this._selectProvider(provider);
            if (!selectedProvider) {
                throw new Error('利用可能な検索プロバイダーがありません');
            }

            // 検索実行
            const startTime = Date.now();
            const rawResults = await selectedProvider.invoke(query);
            const searchTime = Date.now() - startTime;

            // 結果を整形
            const formattedResults = this._formatSearchResults(rawResults, {
                maxResults,
                filterDomains,
                excludeDomains
            });

            // 検索履歴に保存
            this._addToHistory({
                query,
                provider: this._getProviderName(selectedProvider),
                results: formattedResults,
                timestamp: new Date().toISOString(),
                searchTime
            });

            console.log(`✅ WebSearchService: Found ${formattedResults.length} results in ${searchTime}ms`);

            return {
                success: true,
                query,
                results: formattedResults,
                metadata: {
                    provider: this._getProviderName(selectedProvider),
                    searchTime,
                    totalResults: formattedResults.length,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('❌ WebSearchService: Search failed:', error);
            return {
                success: false,
                query,
                results: [],
                error: error.message,
                metadata: {
                    provider: provider,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * 検索プロバイダーの選択
     */
    _selectProvider(preference) {
        if (preference === 'auto') {
            // 優先順位: Tavily > Google > DuckDuckGo
            if (this.searchProviders.has('tavily')) {
                return this.searchProviders.get('tavily');
            }
            if (this.searchProviders.has('google')) {
                return this.searchProviders.get('google');
            }
            return this.searchProviders.get('duckduckgo');
        }

        return this.searchProviders.get(preference) || this.searchProviders.get('duckduckgo');
    }

    /**
     * プロバイダー名を取得
     */
    _getProviderName(provider) {
        for (const [name, providerInstance] of this.searchProviders.entries()) {
            if (providerInstance === provider) {
                return name;
            }
        }
        return 'unknown';
    }

    /**
     * 検索結果の整形
     */
    _formatSearchResults(rawResults, options = {}) {
        const { maxResults, filterDomains, excludeDomains } = options;
        
        let results = [];
        
        // LangChainの結果形式に応じて処理
        if (Array.isArray(rawResults)) {
            results = rawResults;
        } else if (rawResults.results && Array.isArray(rawResults.results)) {
            results = rawResults.results;
        } else if (typeof rawResults === 'string') {
            // 文字列結果の場合（DuckDuckGo等）
            return [{
                title: 'Search Result',
                url: '',
                snippet: rawResults,
                source: 'text_result'
            }];
        }

        return results
            .filter(result => result && result.url)
            .filter(result => {
                // ドメインフィルタリング
                if (filterDomains.length > 0) {
                    return filterDomains.some(domain => result.url.includes(domain));
                }
                if (excludeDomains.length > 0) {
                    return !excludeDomains.some(domain => result.url.includes(domain));
                }
                return true;
            })
            .slice(0, maxResults)
            .map(result => ({
                title: result.title || result.name || 'No Title',
                url: result.url || result.link || '',
                snippet: result.snippet || result.description || result.content || '',
                source: this._extractDomain(result.url || result.link || ''),
                score: result.score || 0,
                publishedDate: result.published_date || null
            }));
    }

    /**
     * URLからドメイン名を抽出
     */
    _extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * 検索履歴に追加
     */
    _addToHistory(searchEntry) {
        this.searchHistory.push(searchEntry);
        
        // 履歴数制限
        if (this.searchHistory.length > this.maxHistoryItems) {
            this.searchHistory = this.searchHistory.slice(-this.maxHistoryItems);
        }
    }

    /**
     * 検索履歴を取得
     */
    getSearchHistory(limit = 10) {
        return this.searchHistory
            .slice(-limit)
            .reverse(); // 新しい順
    }

    /**
     * 検索履歴をクリア
     */
    clearSearchHistory() {
        this.searchHistory = [];
    }

    /**
     * 利用可能な検索プロバイダー一覧
     */
    getAvailableProviders() {
        const providers = {};
        
        for (const [name, provider] of this.searchProviders.entries()) {
            providers[name] = {
                name: this._getProviderDisplayName(name),
                available: true,
                requiresApiKey: this._requiresApiKey(name)
            };
        }

        return providers;
    }

    /**
     * プロバイダー表示名を取得
     */
    _getProviderDisplayName(name) {
        const displayNames = {
            'tavily': 'Tavily AI Search',
            'google': 'Google Custom Search',
            'duckduckgo': 'DuckDuckGo'
        };
        return displayNames[name] || name;
    }

    /**
     * APIキーが必要かどうかを判定
     */
    _requiresApiKey(name) {
        return name !== 'duckduckgo';
    }

    /**
     * 検索結果のサマリーを生成
     */
    generateSearchSummary(searchResults, query) {
        if (!searchResults || searchResults.length === 0) {
            return `"${query}" に関する検索結果は見つかりませんでした。`;
        }

        const totalResults = searchResults.length;
        const topSources = searchResults
            .slice(0, 3)
            .map(result => result.source)
            .filter((source, index, self) => self.indexOf(source) === index);

        return `"${query}" について ${totalResults} 件の検索結果が見つかりました。主な情報源: ${topSources.join(', ')}`;
    }

    /**
     * サービスの状態を取得
     */
    getStatus() {
        return {
            availableProviders: Object.keys(Object.fromEntries(this.searchProviders)),
            searchHistoryCount: this.searchHistory.length,
            maxResultsPerSearch: this.maxResultsPerSearch,
            isHealthy: this.searchProviders.size > 0,
            lastActivity: this.searchHistory.length > 0 
                ? this.searchHistory[this.searchHistory.length - 1].timestamp 
                : null
        };
    }
}