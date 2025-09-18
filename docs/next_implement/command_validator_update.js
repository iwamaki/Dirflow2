/* =========================================
    command-validator.js への更新
   ========================================= */

// CommandValidatorクラスのコンストラクターを更新
export class CommandValidator {
    constructor() {
        // 許可されたアクションに web_search を追加
        this.allowedActions = [
            'create_file', 'create_directory', 'delete_file', 'copy_file', 'move_file',
            'read_file', 'edit_file', 'list_files', 
            'batch_delete', 'batch_copy', 'batch_move',
            'web_search' // 新規追加
        ];

        // 必須フィールドの定義を拡張
        this.requiredFields = {
            'create_file': ['path'],
            'create_directory': ['path'],
            'delete_file': ['path'],
            'copy_file': ['source', 'destination'],
            'move_file': ['source', 'destination'],
            'read_file': ['path'],
            'edit_file': ['path', 'content'],
            'list_files': [],
            'batch_delete': ['paths'],
            'batch_copy': ['sources', 'destination'],
            'batch_move': ['sources', 'destination'],
            'web_search': ['query'] // 新規追加: queryは必須
        };

        // 危険な操作リスト（web_searchは安全なので含めない）
        this.dangerousActions = ['delete_file', 'batch_delete', 'move_file', 'batch_move'];
        
        // パスフィールド（web_searchには適用されない）
        this.pathFields = ['path', 'source', 'destination'];

        // 検索固有のフィールド（新規追加）
        this.searchFields = ['query'];
    }

    /**
     * コマンドの妥当性を検証（web_search対応版）
     */
    validate(command) {
        if (!command || typeof command !== 'object') {
            throw new Error('無効なコマンド形式です');
        }

        // 1. アクションの検証
        this._validateAction(command.action);

        // 2. アクション固有の検証
        if (command.action === 'web_search') {
            this._validateWebSearchCommand(command);
        } else {
            // 既存のファイル操作コマンドの検証
            this._validatePaths(command);
            this._validateBatchPaths(command);
        }

        // 3. 必須フィールドチェック
        this._validateRequiredFields(command);

        // 4. 危険な操作の警告（web_searchは対象外）
        this._checkDangerousOperations(command);

        return true;
    }

    /**
     * Web検索コマンドの固有検証
     */
    _validateWebSearchCommand(command) {
        // クエリの検証
        if (!command.query || typeof command.query !== 'string') {
            throw new Error('web_search: queryは文字列である必要があります');
        }

        if (command.query.trim().length === 0) {
            throw new Error('web_search: queryが空です');
        }

        // クエリの長さ制限
        if (command.query.length > 500) {
            throw new Error('web_search: クエリが長すぎます（500文字以内）');
        }

        // オプションの検証
        if (command.options && typeof command.options === 'object') {
            this._validateSearchOptions(command.options);
        }

        console.log(`✅ Web search command validated: "${command.query}"`);
    }

    /**
     * 検索オプションの検証
     */
    _validateSearchOptions(options) {
        // maxResultsの検証
        if (options.maxResults !== undefined) {
            if (!Number.isInteger(options.maxResults) || options.maxResults < 1 || options.maxResults > 20) {
                throw new Error('web_search: maxResultsは1-20の整数である必要があります');
            }
        }

        // providerの検証
        if (options.provider !== undefined) {
            const validProviders = ['auto', 'tavily', 'google', 'duckduckgo'];
            if (!validProviders.includes(options.provider)) {
                throw new Error(`web_search: 無効なprovider: ${options.provider}`);
            }
        }

        // languageの検証
        if (options.language !== undefined) {
            if (typeof options.language !== 'string' || options.language.length !== 2) {
                throw new Error('web_search: languageは2文字の言語コードである必要があります');
            }
        }

        // regionの検証
        if (options.region !== undefined) {
            if (typeof options.region !== 'string' || options.region.length !== 2) {
                throw new Error('web_search: regionは2文字の地域コードである必要があります');
            }
        }

        // filterDomainsとexcludeDomainsの検証
        if (options.filterDomains && !Array.isArray(options.filterDomains)) {
            throw new Error('web_search: filterDomainsは配列である必要があります');
        }

        if (options.excludeDomains && !Array.isArray(options.excludeDomains)) {
            throw new Error('web_search: excludeDomainsは配列である必要があります');
        }
    }

    /**
     * 必須フィールドの検証（web_search対応版）
     */
    _validateRequiredFields(command) {
        const required = this.requiredFields[command.action];
        if (!required) {
            return; // 必須フィールドが定義されていないアクション
        }

        for (const field of required) {
            if (command[field] === undefined || command[field] === null) {
                throw new Error(`必須フィールドが不足: ${field}`);
            }

            // 空文字列も無効とする（contentフィールドは除く）
            if (field !== 'content' && command[field] === '') {
                throw new Error(`必須フィールドが空です: ${field}`);
            }
        }
    }

    /**
     * 検索関連の統計情報を取得
     */
    getSearchValidationStats() {
        return {
            searchCommandsSupported: ['web_search'],
            validProviders: ['auto', 'tavily', 'google', 'duckduckgo'],
            maxQueryLength: 500,
            maxResultsRange: '1-20',
            supportedLanguages: 'ISO 639-1 codes',
            supportedRegions: 'ISO 3166-1 alpha-2 codes'
        };
    }

    /**
     * Web検索コマンドかどうかを判定
     */
    isSearchCommand(action) {
        return action === 'web_search';
    }
}