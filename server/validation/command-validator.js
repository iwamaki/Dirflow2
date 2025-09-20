/* =========================================
    コマンド妥当性検証
   ========================================= */

/*
## 概要
AIから提案されたコマンドの妥当性とセキュリティを検証する責任を持つ。

## 責任
- コマンドアクションの妥当性検証
- パスのセキュリティチェック
- 必須フィールドの検証
- 危険な操作の検出と警告
*/

export class CommandValidator {
    constructor() {
        // 許可されたアクションに web_search を追加
        this.allowedActions = [
            'create_file', 'create_directory', 'delete_file', 'copy_file', 'move_file',
            'read_file', 'edit_file', 'list_files', 
            'batch_delete', 'batch_copy', 'batch_move',
            'web_search' 
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
            'web_search': ['query'] 
        };

        // 危険な操作リスト（web_searchは安全なので含めない）
        this.dangerousActions = ['delete_file', 'batch_delete', 'move_file', 'batch_move'];
        
        // パスフィールド（web_searchには適用されない）
        this.pathFields = ['path', 'source', 'destination'];

        // 検索固有のフィールド
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
        if (this.isSearchCommand(command.action)) {
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
     * 複数のコマンドを一括検証
     */
    validateBatch(commands) {
        if (!Array.isArray(commands)) {
            throw new Error('コマンドは配列である必要があります');
        }

        const validatedCommands = [];
        const errors = [];

        for (let i = 0; i < commands.length; i++) {
            try {
                if (this.validate(commands[i])) {
                    validatedCommands.push(commands[i]);
                }
            } catch (error) {
                errors.push({
                    index: i,
                    command: commands[i],
                    error: error.message
                });
            }
        }

        return {
            validCommands: validatedCommands,
            errors: errors,
            totalProcessed: commands.length,
            successCount: validatedCommands.length,
            errorCount: errors.length
        };
    }

    /**
     * アクションの妥当性検証
     */
    _validateAction(action) {
        if (!action || typeof action !== 'string') {
            throw new Error('アクションが指定されていません');
        }

        if (!this.allowedActions.includes(action)) {
            throw new Error(`未サポートのアクション: ${action}`);
        }
    }

    /**
     * パスのセキュリティチェック
     */
    _validatePaths(command) {
        for (const field of this.pathFields) {
            if (command[field]) {
                this._validateSinglePath(command[field], field);
            }
        }
    }

    /**
     * 単一パスの検証
     */
    _validateSinglePath(path, fieldName) {
        if (typeof path !== 'string') {
            throw new Error(`${fieldName}は文字列である必要があります`);
        }

        // 危険なパスパターンをチェック
        const dangerousPatterns = [
            '..',           // ディレクトリトラバーサル
            '~',            // ホームディレクトリ
            '/etc',         // システム設定
            '/var',         // システム変数
            '/usr',         // システムプログラム
            '/bin',         // システムバイナリ
            '/sbin',        // システムバイナリ
            '/root',        // ルートホーム
            'C:\\Windows',  // Windows システム
            'C:\\Program', // Windows プログラム
        ];

        for (const pattern of dangerousPatterns) {
            if (path.includes(pattern) || path.startsWith(pattern)) {
                throw new Error(`安全でないパス: ${path} (危険なパターン: ${pattern})`);
            }
        }

        // 絶対パスの制限（ワークスペース外へのアクセスを防ぐ）
        if (path.startsWith('/') && !path.startsWith('/workspace')) {
            console.warn(`⚠️ Warning: Absolute path detected: ${path}`);
        }

        // 空文字列や null の検証
        if (path.trim().length === 0) {
            throw new Error(`${fieldName}が空です`);
        }
    }

    /**
     * 一括操作のパス配列チェック
     */
    _validateBatchPaths(command) {
        const batchFields = ['paths', 'sources'];
        
        for (const field of batchFields) {
            if (command[field]) {
                if (!Array.isArray(command[field])) {
                    throw new Error(`${field}は配列である必要があります`);
                }

                if (command[field].length === 0) {
                    throw new Error(`${field}が空の配列です`);
                }

                // 配列内の各パスを検証
                for (let i = 0; i < command[field].length; i++) {
                    this._validateSinglePath(command[field][i], `${field}[${i}]`);
                }

                // 一括操作の上限チェック
                if (command[field].length > 100) {
                    throw new Error(`一括操作の上限（100個）を超えています: ${command[field].length}個`);
                }
            }
        }
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
     * 必須フィールドの検証
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
            if (field !== 'content' && typeof command[field] === 'string' && command[field].trim() === '') {
                throw new Error(`必須フィールドが空です: ${field}`);
            }
        }
    }

    /**
     * 危険な操作の検出と警告
     */
    _checkDangerousOperations(command) {
        if (this.dangerousActions.includes(command.action)) {
            console.warn(`⚠️ Dangerous operation detected: ${command.action} on ${command.path || (command.paths ? command.paths.join(', ') : 'unknown')}`);
            
            // 削除操作の場合、特に注意深くチェック
            if (command.action === 'delete_file' || command.action === 'batch_delete') {
                this._validateDeletionSafety(command);
            }
        }
    }

    /**
     * 削除操作の安全性チェック
     */
    _validateDeletionSafety(command) {
        const pathsToCheck = command.paths || [command.path];
        
        for (const path of pathsToCheck) {
            if (!path) continue;

            // 重要なファイルパターンの検証
            const criticalPatterns = [
                'package.json',
                '.env',
                'config.json',
                'settings.json',
                '.git',
                'node_modules',
                'README.md'
            ];

            for (const pattern of criticalPatterns) {
                if (path.includes(pattern)) {
                    console.warn(`⚠️ Critical file deletion detected: ${path}`);
                    // 警告のみで、実際の削除は阻止しない（ユーザーの判断に委ねる）
                }
            }

            // ルートディレクトリやワイルドカードの削除を防ぐ
            if (path === '/' || path === '.' || path === '*' || path.includes('*')) {
                throw new Error(`危険な削除操作が検出されました: ${path}`);
            }
        }
    }

    /**
     * 利用可能なアクション一覧を取得
     */
    getAllowedActions() {
        return [...this.allowedActions];
    }

    /**
     * アクションの必須フィールド情報を取得
     */
    getRequiredFields(action) {
        return this.requiredFields[action] || [];
    }

    /**
     * アクションが危険かどうかを判定
     */
    isDangerousAction(action) {
        return this.dangerousActions.includes(action);
    }

    /**
     * Web検索コマンドかどうかを判定
     */
    isSearchCommand(action) {
        return action === 'web_search';
    }

    /**
     * バリデーター設定の統計情報を取得
     */
    getValidatorStats() {
        return {
            totalAllowedActions: this.allowedActions.length,
            dangerousActionsCount: this.dangerousActions.length,
            pathFieldsCount: this.pathFields.length,
            actionsWithRequiredFields: Object.keys(this.requiredFields).length
        };
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
}
