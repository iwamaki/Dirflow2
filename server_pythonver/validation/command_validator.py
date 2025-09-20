class CommandValidator:
    def __init__(self):
        self.allowed_actions = [
            'create_file', 'create_directory', 'delete_file', 'copy_file', 'move_file',
            'read_file', 'edit_file', 'list_files',
            'batch_delete', 'batch_copy', 'batch_move',
            'web_search'
        ]

        self.required_fields = {
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
        }

        self.dangerous_actions = ['delete_file', 'batch_delete', 'move_file', 'batch_move']

        self.path_fields = ['path', 'source', 'destination']

        self.search_fields = ['query']

    def validate(self, command: dict):
        if not isinstance(command, dict):
            raise ValueError('無効なコマンド形式です')

        self._validate_action(command.get('action'))

        if self.is_search_command(command.get('action')):
            self._validate_web_search_command(command)
        else:
            self._validate_paths(command)
            self._validate_batch_paths(command)

        self._validate_required_fields(command)

        self._check_dangerous_operations(command)

        return True

    def validate_batch(self, commands: list):
        if not isinstance(commands, list):
            raise ValueError('コマンドは配列である必要があります')

        validated_commands = []
        errors = []

        for i, command in enumerate(commands):
            try:
                if self.validate(command):
                    validated_commands.append(command)
            except Exception as error:
                errors.append({
                    'index': i,
                    'command': command,
                    'error': str(error)
                })

        return {
            'validCommands': validated_commands,
            'errors': errors,
            'totalProcessed': len(commands),
            'successCount': len(validated_commands),
            'errorCount': len(errors)
        }

    def _validate_action(self, action: str):
        if not action or not isinstance(action, str):
            raise ValueError('アクションが指定されていません')

        if action not in self.allowed_actions:
            raise ValueError(f'未サポートのアクション: {action}')

    def _validate_paths(self, command: dict):
        for field in self.path_fields:
            if command.get(field):
                self._validate_single_path(command[field], field)

    def _validate_single_path(self, path: str, field_name: str):
        if not isinstance(path, str):
            raise ValueError(f'{field_name}は文字列である必要があります')

        dangerous_patterns = [
            '..',
            '~',
            '/etc',
            '/var',
            '/usr',
            '/bin',
            '/sbin',
            '/root',
            'C:\\Windows',
            'C:\\Program',
        ]

        for pattern in dangerous_patterns:
            if pattern in path or path.startswith(pattern):
                raise ValueError(f'安全でないパス: {path} (危険なパターン: {pattern})')

        if path.startswith('/') and not path.startswith('/workspace'):
            print(f'⚠️ Warning: Absolute path detected: {path}')

        if not path.strip():
            raise ValueError(f'{field_name}が空です')

    def _validate_batch_paths(self, command: dict):
        batch_fields = ['paths', 'sources']

        for field in batch_fields:
            if command.get(field):
                if not isinstance(command[field], list):
                    raise ValueError(f'{field}は配列である必要があります')

                if not command[field]:
                    raise ValueError(f'{field}が空の配列です')

                for i, path in enumerate(command[field]):
                    self._validate_single_path(path, f'{field}[{i}]')

                if len(command[field]) > 100:
                    raise ValueError(f'一括操作の上限（100個）を超えています: {len(command[field])}個')

    def _validate_web_search_command(self, command: dict):
        if not command.get('query') or not isinstance(command['query'], str):
            raise ValueError('web_search: queryは文字列である必要があります')

        if not command['query'].strip():
            raise ValueError('web_search: queryが空です')

        if len(command['query']) > 500:
            raise ValueError('web_search: クエリが長すぎます（500文字以内）')

        if command.get('options') and not isinstance(command['options'], dict):
            raise ValueError('web_search: optionsはオブジェクトである必要があります')
        
        if command.get('options'):
            self._validate_search_options(command['options'])

        print(f'✅ Web search command validated: "{command['query']}"')

    def _validate_search_options(self, options: dict):
        if 'maxResults' in options:
            max_results = options['maxResults']
            if not isinstance(max_results, int) or not (1 <= max_results <= 20):
                raise ValueError('web_search: maxResultsは1-20の整数である必要があります')

        if 'provider' in options:
            provider = options['provider']
            valid_providers = ['auto', 'tavily', 'google', 'duckduckgo']
            if provider not in valid_providers:
                raise ValueError(f'web_search: 無効なprovider: {provider}')

        if 'language' in options:
            language = options['language']
            if not isinstance(language, str) or len(language) != 2:
                raise ValueError('web_search: languageは2文字の言語コードである必要があります')

        if 'region' in options:
            region = options['region']
            if not isinstance(region, str) or len(region) != 2:
                raise ValueError('web_search: regionは2文字の地域コードである必要があります')

        if 'filterDomains' in options and not isinstance(options['filterDomains'], list):
            raise ValueError('web_search: filterDomainsは配列である必要があります')

        if 'excludeDomains' in options and not isinstance(options['excludeDomains'], list):
            raise ValueError('web_search: excludeDomainsは配列である必要があります')

    def _validate_required_fields(self, command: dict):
        required = self.required_fields.get(command.get('action'))
        if not required:
            return

        for field in required:
            if command.get(field) is None:
                raise ValueError(f'必須フィールドが不足: {field}')

            if field != 'content' and isinstance(command.get(field), str) and not command[field].strip():
                raise ValueError(f'必須フィールドが空です: {field}')

    def _check_dangerous_operations(self, command: dict):
        if command.get('action') in self.dangerous_actions:
            print(f'⚠️ Dangerous operation detected: {command["action"]} on {command.get("path") or (", ".join(command["paths"]) if command.get("paths") else "unknown")}')

            if command['action'] in ['delete_file', 'batch_delete']:
                self._validate_deletion_safety(command)

    def _validate_deletion_safety(self, command: dict):
        paths_to_check = command.get('paths') or ([command['path']] if command.get('path') else [])

        for path in paths_to_check:
            if not path:
                continue

            critical_patterns = [
                'package.json',
                '.env',
                'config.json',
                'settings.json',
                '.git',
                'node_modules',
                'README.md'
            ]

            for pattern in critical_patterns:
                if pattern in path:
                    print(f'⚠️ Critical file deletion detected: {path}')

            if path in ['/', '.', '*'] or '*' in path:
                raise ValueError(f'危険な削除操作が検出されました: {path}')

    def get_allowed_actions(self):
        return list(self.allowed_actions)

    def get_required_fields(self, action: str):
        return self.required_fields.get(action, [])

    def is_dangerous_action(self, action: str):
        return action in self.dangerous_actions

    def is_search_command(self, action: str):
        return action == 'web_search'

    def get_validator_stats(self):
        return {
            'totalAllowedActions': len(self.allowed_actions),
            'dangerousActionsCount': len(self.dangerous_actions),
            'pathFieldsCount': len(self.path_fields),
            'actionsWithRequiredFields': len(self.required_fields)
        }

    def get_search_validation_stats(self):
        return {
            'searchCommandsSupported': ['web_search'],
            'validProviders': ['auto', 'tavily', 'google', 'duckduckgo'],
            'maxQueryLength': 500,
            'maxResultsRange': '1-20',
            'supportedLanguages': 'ISO 639-1 codes',
            'supportedRegions': 'ISO 3166-1 alpha-2 codes'
        }
