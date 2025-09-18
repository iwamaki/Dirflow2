/* =========================================
   AI File Manager - メインクライアントサイド JavaScript
   
   【概要】
   ブラウザ上で動作するAI統合ファイルマネージャーのフロントエンド
   自然言語でのファイル操作、リアルタイムUI制御、複数LLMプロバイダー対応
   
   【主要クラス構成】
   - AppState: アプリケーション状態管理（テーマ、LLMプロバイダー設定等）
   - APIClient: server.jsとの通信処理（チャット、プロバイダー情報取得）
   - UIController: UI制御、モード切替、設定画面生成
   - FileManager: ファイル操作UI、モックファイルシステム管理
   - MessageHandler: AIコマンド実行、server.jsからの応答処理
   - EventHandler: DOM イベント処理、ユーザーインタラクション制御
   - Utils: ユーティリティ関数（ファイルアイコン、Markdown解析等）
   
   【server.js連携ポイント】
   - /api/chat: AIチャット機能（Claude/OpenAI/Gemini API呼び出し）
   - /api/llm-providers: 利用可能プロバイダー・モデル一覧取得
   - /api/health: サーバー状態・API接続確認
   ========================================= */

//   アプリケーション状態管理
const AppState = {
    // 基本状態
    currentPath: '/workspace',
    selectedFile: null,
    currentEditingFile: null,

    // UI状態
    isSelectionMode: false,
    isFileViewMode: false,
    isEditMode: false,
    isChatOpen: false,
    isLoading: false,

    // 設定
    theme: localStorage.getItem('theme') || 'dark',
    fontSize: localStorage.getItem('fontSize') || 'medium',
    llmProvider: localStorage.getItem('llmProvider') || 'claude',
    llmModel: localStorage.getItem('llmModel') || '',

    // LLMプロバイダー情報
    availableProviders: {},

    // 状態更新メソッド
    setState(updates) {
        Object.assign(this, updates);
        this.saveSettings();
    },

    saveSettings() {
        localStorage.setItem('theme', this.theme);
        localStorage.setItem('fontSize', this.fontSize);
        localStorage.setItem('llmProvider', this.llmProvider);
        localStorage.setItem('llmModel', this.llmModel);
    }
};

//   モックデータ（デモ用）
const mockFileSystem = {
    '/workspace': [
        { 
            name: 'README.md', 
            type: 'file', 
            size: '1.2 KB', 
            content: '# AI File Manager - 基本機能統合版\\n\\n## 新機能\\n- Claude API統合\\n- 基本ファイル操作コマンド\\n- JSON形式レスポンス対応\\n- セキュリティ強化\\n\\n## 使い方\\n\\n### 基本コマンド\\n- **ファイル作成**: "新しいファイルを作って" "sample.txt を作成して"\\n- **ファイル読み込み**: "README.md を読んで" "ファイルの内容を表示して"\\n- **ファイル編集**: "README.md を編集して" "内容を変更して"\\n- **ファイル削除**: "sample.txt を削除して" "不要なファイルを消して"\\n- **ファイル一覧**: "ファイル一覧を表示して" "何があるか教えて"\\n\\n### 自然な会話例\\n- "プロジェクトの説明を書いたREADME.mdを作成して"\\n- "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\\n- "このディレクトリにあるファイルを教えて"\\n\\n**help** と入力すると詳細なコマンド一覧を確認できます！' 
        }
    ]
};

//   DOM要素参照
const elements = {
    // ヘッダー
    backBtn: document.getElementById('backBtn'),
    saveBtn: document.getElementById('saveBtn'),
    editBtn: document.getElementById('editBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    currentPath: document.getElementById('currentPath'),
    selectionInfo: document.getElementById('selectionInfo'),

    // メインコンテンツ
    fileListContainer: document.getElementById('fileListContainer'),
    fileList: document.getElementById('fileList'),
    fileView: document.getElementById('fileView'),
    fileContent: document.getElementById('fileContent'),

    // ボトムナビ
    chatContainer: document.getElementById('chatContainer'),
    actionContainer: document.getElementById('actionContainer'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    cancelBtn: document.getElementById('cancelBtn'),

    // FAB・チャット
    fabBtn: document.getElementById('fabBtn'),
    chatOverlay: document.getElementById('chatOverlay'),
    chatMessages: document.getElementById('chatMessages'),
    chatCloseBtn: document.getElementById('chatCloseBtn'),

    // モーダル
    settingsModal: document.getElementById('settingsModal'),
    createModal: document.getElementById('createModal'),
    renameModal: document.getElementById('renameModal'),
    filePathInput: document.getElementById('filePathInput'),
    fileContentInput: document.getElementById('fileContentInput'),
    renameInput: document.getElementById('renameInput'),
    createFileBtn: document.getElementById('createFileBtn'),
    renameFileBtn: document.getElementById('renameFileBtn')
};

//   API通信クラス
class APIClient {
    static async sendChatMessage(message, context = {}) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    provider: AppState.llmProvider,
                    model: AppState.llmModel,
                    context: context
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async loadProviders() {
        try {
            const response = await fetch('/api/llm-providers');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const providers = await response.json();
            AppState.setState({ availableProviders: providers });
            
            // デフォルトモデルの設定
            if (!AppState.llmModel && providers[AppState.llmProvider]) {
                AppState.setState({ 
                    llmModel: providers[AppState.llmProvider].defaultModel 
                });
            }
            
            return providers;
        } catch (error) {
            console.error('Failed to load providers:', error);
            return {};
        }
    }

    static async checkHealth() {
        try {
            const response = await fetch('/api/health');
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', providers: {} };
        }
    }
}

//   ユーティリティ関数
const Utils = {
    // ファイルアイコン取得
    getFileIcon(file) {
        if (file.type === 'directory') return '📁';
        const ext = file.name.split('.').pop()?.toLowerCase();
        const icons = {
            'md': '📝', 'txt': '📄', 'json': '⚙️', 'js': '💛',
            'html': '🌐', 'css': '🎨', 'py': '🐍', 'jpg': '🖼️',
            'png': '🖼️', 'pdf': '📕'
        };
        return icons[ext] || '📄';
    },

    // Markdown簡易パーサー
    parseMarkdown(text) {
        return text
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            .replace(/\\n/gim, '<br>');
    },

    // HTMLエスケープ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 遅延実行
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

//   UI制御クラス
class UIController {
    // テーマ適用
    static applyTheme() {
        document.body.classList.toggle('theme-light', AppState.theme === 'light');
        document.body.classList.remove('font-small', 'font-large');
        if (AppState.fontSize !== 'medium') {
            document.body.classList.add(`font-${AppState.fontSize}`);
        }

        // 設定UIの更新
        this.updateSettingsUI();
    }

    // 設定UI更新
    static updateSettingsUI() {
        // テーマボタン
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.className = btn.dataset.theme === AppState.theme ? 'btn' : 'btn secondary';
        });
        
        // フォントサイズボタン
        document.querySelectorAll('[data-font]').forEach(btn => {
            btn.className = btn.dataset.font === AppState.fontSize ? 'btn' : 'btn secondary';
        });

        // LLMプロバイダーボタン
        document.querySelectorAll('[data-provider]').forEach(btn => {
            btn.className = btn.dataset.provider === AppState.llmProvider ? 'btn' : 'btn secondary';
        });

        // モデル選択ドロップダウン
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect && AppState.availableProviders[AppState.llmProvider]) {
            const models = AppState.availableProviders[AppState.llmProvider].models;
            modelSelect.innerHTML = models.map(model => 
                `<option value="${model}" ${model === AppState.llmModel ? 'selected' : ''}>${model}</option>`
            ).join('');
        }
    }

    // 設定UI生成
    static generateSettingsUI() {
        const settingsBody = document.querySelector('#settingsModal .modal-body');
        if (!settingsBody) return;

        settingsBody.innerHTML = `
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🎨 テーマ</label>
                <div style="display: flex; gap: 10px;">
                    <button class="btn" data-theme="dark">ダーク</button>
                    <button class="btn secondary" data-theme="light">ライト</button>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">📝 フォントサイズ</label>
                <div style="display: flex; gap: 10px;">
                    <button class="btn secondary" data-font="small">小</button>
                    <button class="btn" data-font="medium">中</button>
                    <button class="btn secondary" data-font="large">大</button>
                </div>
            </div>

            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🤖 AI プロバイダー</label>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;" id="providerButtons">
                    <button class="btn" data-provider="claude">Claude</button>
                    <button class="btn secondary" data-provider="openai">OpenAI</button>
                    <button class="btn secondary" data-provider="gemini">Gemini</button>
                </div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">モデル</label>
                <select class="input" id="modelSelect" style="width: 100%;">
                    <option>読み込み中...</option>
                </select>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🔌 接続状態</label>
                <div id="connectionStatus" style="padding: 12px; border-radius: 8px; background: var(--hover-bg); font-size: 13px;">
                    確認中...
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">⚡ 利用可能な機能</label>
                <div style="padding: 12px; border-radius: 8px; background: var(--hover-bg); font-size: 13px;">
                    📝 create_file - ファイル作成<br>
                    📖 read_file - ファイル読み込み<br>
                    ✏️ edit_file - ファイル編集<br>
                    🗑️ delete_file - ファイル削除<br>
                    📋 list_files - ファイル一覧<br>
                </div>
            </div>
        `;

        // イベントリスナーを再設定
        this.setupSettingsEventListeners();
        this.updateSettingsUI();
        this.updateConnectionStatus();
    }

    // 設定イベントリスナー設定
    static setupSettingsEventListeners() {
        // テーマ変更
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                AppState.setState({ theme: e.target.dataset.theme });
                this.applyTheme();
            });
        });

        // フォントサイズ変更
        document.querySelectorAll('[data-font]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                AppState.setState({ fontSize: e.target.dataset.font });
                this.applyTheme();
            });
        });

        // プロバイダー変更
        document.querySelectorAll('[data-provider]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.target.dataset.provider;
                const defaultModel = AppState.availableProviders[provider]?.defaultModel || '';
                AppState.setState({ 
                    llmProvider: provider,
                    llmModel: defaultModel
                });
                this.updateSettingsUI();
            });
        });

        // モデル変更
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                AppState.setState({ llmModel: e.target.value });
            });
        }
    }

    // 接続状態更新
    static async updateConnectionStatus() {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) return;

        try {
            const health = await APIClient.checkHealth();
            let statusHtml = `<strong>サーバー:</strong> ${health.status}<br>`;
            
            if (health.features) {
                statusHtml += `<strong>基本機能:</strong> ${health.features.basic_commands ? '✅' : '❌'}<br>`;
            }
            
            Object.entries(health.providers || {}).forEach(([provider, available]) => {
                const providerName = AppState.availableProviders[provider]?.name || provider;
                statusHtml += `<strong>${providerName}:</strong> ${available ? '✅ 利用可能' : '❌ APIキー未設定'}<br>`;
            });

            statusDiv.innerHTML = statusHtml;
        } catch (error) {
            statusDiv.innerHTML = `<strong>サーバー:</strong> ❌ 接続エラー<br>サーバーが起動していることを確認してください。`;
        }
    }

    // モード切り替え（既存のまま）
    static setSelectionMode(enabled) {
        AppState.setState({ isSelectionMode: enabled });

        if (enabled) {
            elements.chatContainer.style.display = 'none';
            elements.actionContainer.style.display = 'flex';
            elements.selectionInfo.style.display = 'block';
            elements.selectionInfo.textContent = `"${AppState.selectedFile?.name}" を選択中`;
            elements.fabBtn.classList.add('hidden');
        } else {
            elements.chatContainer.style.display = 'flex';
            elements.actionContainer.style.display = 'none';
            elements.selectionInfo.style.display = 'none';
            elements.fabBtn.classList.remove('hidden');

            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected');
            });
            AppState.setState({ selectedFile: null });
        }
    }

    static setFileViewMode(enabled) {
        AppState.setState({ isFileViewMode: enabled });

        if (enabled) {
            elements.fileListContainer.style.display = 'none';
            elements.fileView.style.display = 'flex';
            elements.backBtn.classList.remove('hidden');
            elements.editBtn.classList.remove('hidden');
            elements.saveBtn.classList.remove('hidden');
            elements.settingsBtn.classList.add('hidden');
        } else {
            elements.fileListContainer.style.display = 'block';
            elements.fileView.style.display = 'none';
            elements.backBtn.classList.add('hidden');
            elements.editBtn.classList.add('hidden');
            elements.saveBtn.classList.add('hidden');
            elements.settingsBtn.classList.remove('hidden');

            AppState.setState({ 
                currentEditingFile: null, 
                isEditMode: false 
            });
        }

        this.setSelectionMode(false);
    }

    static toggleChat() {
        const newState = !AppState.isChatOpen;
        AppState.setState({ isChatOpen: newState });
        elements.chatOverlay.classList.toggle('show', newState);
    }

    static showModal(modalId) {
        if (modalId === 'settingsModal') {
            this.generateSettingsUI();
        }
        document.getElementById(modalId).style.display = 'block';
    }

    static hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    static hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
}

//   ファイル操作クラス
class FileManager {
    static async loadFileList() {
        elements.fileList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--accent-primary);">読み込み中...</div>';
        await Utils.delay(300);

        let files = mockFileSystem[AppState.currentPath] || [];
        this.displayFiles(files);
        elements.currentPath.textContent = AppState.currentPath;

        UIController.setSelectionMode(false);
    }

    static displayFiles(files) {
        elements.fileList.innerHTML = '';

        if (AppState.currentPath !== '/workspace') {
            const parentItem = this.createFileItem({ name: '..', type: 'directory', size: '' });
            elements.fileList.appendChild(parentItem);
        }

        files.forEach(file => {
            const item = this.createFileItem(file);
            elements.fileList.appendChild(item);
        });

        if (files.length === 0 && AppState.currentPath === '/workspace') {
            const emptyMessage = document.createElement('div');
            emptyMessage.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-muted);">📁 このディレクトリは空です<br><small>右下のFABボタンまたはAIコマンドでファイルを作成できます</small></div>';
            elements.fileList.appendChild(emptyMessage);
        }
    }

    static createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';

        const icon = Utils.getFileIcon(file);
        const size = file.size || '';

        item.innerHTML = `
            <span class="file-icon">${icon}</span>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${size}</span>
        `;

        item.addEventListener('click', () => this.handleFileClick(file));

        if (file.name !== '..') {
            let longPressTimer;
            const startLongPress = () => {
                longPressTimer = setTimeout(() => {
                    if (!AppState.isFileViewMode) {
                        AppState.setState({ selectedFile: file });
                        item.classList.add('selected');
                        UIController.setSelectionMode(true);
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                }, 500);
            };
            const cancelLongPress = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };

            item.addEventListener('touchstart', startLongPress, { passive: true });
            item.addEventListener('touchend', cancelLongPress);
            item.addEventListener('touchcancel', cancelLongPress);
            item.addEventListener('mousedown', startLongPress);
            item.addEventListener('mouseup', cancelLongPress);
            item.addEventListener('mouseleave', cancelLongPress);
        }

        return item;
    }

    static async handleFileClick(file) {
        if (AppState.isSelectionMode) {
            UIController.setSelectionMode(false);
            return;
        }

        if (file.type === 'directory') {
            if (file.name === '..') {
                const pathParts = AppState.currentPath.split('/');
                pathParts.pop();
                AppState.setState({ currentPath: pathParts.join('/') || '/workspace' });
            } else {
                AppState.setState({ currentPath: `${AppState.currentPath}/${file.name}` });
            }
            await this.loadFileList();
        } else {
            this.openFile(file.name);
        }
    }

    static openFile(filename) {
        const files = mockFileSystem[AppState.currentPath] || [];
        const file = files.find(f => f.name === filename);

        if (!file || file.content === undefined) {
            MessageHandler.addMessage('system', `⚠️ ファイル "${filename}" を読み込めませんでした。`);
            return;
        }

        AppState.setState({ 
            currentEditingFile: filename,
            isEditMode: false 
        });

        UIController.setFileViewMode(true);
        this.showFileContent(file.content, filename);

        MessageHandler.addMessage('system', `📖 "${filename}" を開きました。`);
    }

    static showFileContent(content, filename) {
        if (AppState.isEditMode) {
            elements.fileContent.innerHTML = `<textarea placeholder="ファイルの内容を編集してください...">${content}</textarea>`;
            elements.editBtn.textContent = '👁️';
            elements.editBtn.title = 'プレビュー';
        } else {
            if (filename?.endsWith('.md')) {
                elements.fileContent.innerHTML = Utils.parseMarkdown(content);
            } else {
                elements.fileContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; line-height: 1.6;">${Utils.escapeHtml(content)}</pre>`;
            }
            elements.editBtn.textContent = '✏️';
            elements.editBtn.title = '編集';
        }
    }

    static async createFile(filePath, content = '') {
        await Utils.delay(500);

        const fullPath = filePath.startsWith('/') ? filePath : `${AppState.currentPath}/${filePath}`;
        const pathSegments = fullPath.split('/').filter(segment => segment !== '');

        const fileName = pathSegments.pop();
        const directorySegments = pathSegments;

        let currentPath = '';
        let parentPath = '';

        // Create intermediate directories
        for (const segment of directorySegments) {
            parentPath = currentPath;
            currentPath += (currentPath === '' ? '/' : '/') + segment;

            if (!mockFileSystem[currentPath]) {
                mockFileSystem[currentPath] = [];
            }

            if (parentPath !== '') {
                const parentDirFiles = mockFileSystem[parentPath];
                if (parentDirFiles && !parentDirFiles.some(f => f.name === segment && f.type === 'directory')) {
                    parentDirFiles.push({
                        name: segment,
                        type: 'directory',
                        size: ''
                    });
                }
            }
        }

        const targetDirectoryPath = currentPath;

        const existingFile = mockFileSystem[targetDirectoryPath].find(f => f.name === fileName);
        if (existingFile) {
            throw new Error(`ファイル "${fileName}" は既に存在します`);
        }

        const sizeInBytes = new Blob([content]).size;
        const formattedSize = this.formatFileSize(sizeInBytes);

        mockFileSystem[targetDirectoryPath].push({
            name: fileName,
            type: 'file',
            size: formattedSize,
            content: content
        });

        return fileName;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    static async saveFile() {
        if (!AppState.currentEditingFile) return;

        elements.saveBtn.disabled = true;
        await Utils.delay(500);

        const textarea = elements.fileContent.querySelector('textarea');
        if (textarea) {
            const files = mockFileSystem[AppState.currentPath] || [];
            const fileIndex = files.findIndex(f => f.name === AppState.currentEditingFile);
            if (fileIndex !== -1) {
                files[fileIndex].content = textarea.value;
                
                // ファイルサイズ更新
                const sizeInBytes = new Blob([textarea.value]).size;
                files[fileIndex].size = this.formatFileSize(sizeInBytes);
                
                MessageHandler.addMessage('system', `💾 ファイル "${AppState.currentEditingFile}" を保存しました`);

                if (!AppState.isEditMode) {
                    this.showFileContent(textarea.value, AppState.currentEditingFile);
                }
            }
        }

        elements.saveBtn.disabled = false;
    }
}

//   メッセージ処理クラス
class MessageHandler {
    static addMessage(type, content) {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.innerHTML = content;
        elements.chatMessages.appendChild(message);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    static async sendMessage() {
        const message = elements.chatInput.value.trim();
        if (!message || AppState.isLoading) return;

        elements.chatInput.value = '';
        this.addMessage('user', message);
        this.setLoading(true);

        try {
            // 現在のコンテキストを詳細に収集
            const context = {
                currentPath: AppState.currentPath,
                fileList: this.getCurrentFileList(),
                currentFile: AppState.currentEditingFile,
                isEditMode: AppState.isEditMode,
                timestamp: new Date().toISOString()
            };

            // AI応答を取得
            const response = await APIClient.sendChatMessage(message, context);
            
            // メッセージを表示
            this.addMessage('ai', response.message || response.response);

            // コマンドを実行
            if (response.commands && response.commands.length > 0) {
                const results = await this.executeCommands(response.commands);
                
                // 実行結果に基づいてUI更新
                if (results.some(r => r.success)) {
                    await FileManager.loadFileList();
                }
            }

            // プロバイダー情報を表示（デバッグ用）
            if (response.provider && response.model) {
                const providerName = AppState.availableProviders[response.provider]?.name || response.provider;
                const debugInfo = `<small style="color: var(--text-muted); opacity: 0.7;">via ${providerName} (${response.model})</small>`;
                this.addMessage('system', debugInfo);
            }

            // 警告があれば表示
            if (response.warning) {
                this.addMessage('system', `⚠️ ${response.warning}`);
            }

        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage('system', `❌ エラーが発生しました: ${error.message}\\n\\nサーバーが起動していることを確認してください。`);
        }

        this.setLoading(false);
    }

    static async executeCommands(commands) {
        const results = [];
        
        for (const command of commands) {
            try {
                // コマンドバリデーション
                this.validateCommand(command);
                
                // コマンド実行
                const result = await this.executeCommand(command);
                results.push({ success: true, command, result });
                
                // 成功メッセージ
                if (command.description) {
                    this.addMessage('system', `✅ ${command.description}`);
                }
                
            } catch (error) {
                console.error('Command execution error:', error);
                results.push({ success: false, command, error: error.message });
                this.addMessage('system', `❌ ${command.action} 実行エラー: ${error.message}`);
            }
        }
        
        return results;
    }

    static validateCommand(command) {
        if (!command.action) {
            throw new Error('アクションが指定されていません');
        }

        const allowedActions = ['create_file', 'delete_file', 'read_file', 'edit_file', 'list_files'];
        if (!allowedActions.includes(command.action)) {
            throw new Error(`未サポートのアクション: ${command.action}`);
        }

        // パスのセキュリティチェック
        const paths = [command.path, command.source, command.destination].filter(Boolean);
        for (const path of paths) {
            if (typeof path !== 'string' || path.includes('..')) {
                throw new Error(`無効なパス: ${path}`);
            }
        }

        return true;
    }

    static async executeCommand(command) {
        switch (command.action) {
            case 'create_file':
                const fileName = await FileManager.createFile(command.path, command.content || '');
                return `ファイル "${fileName}" を作成しました`;

            case 'delete_file':
                return await this.deleteFile(command.path);

            case 'read_file':
                const content = await this.readFile(command.path);
                this.addMessage('system', `📖 ${command.path}:\\n\`\`\`\\n${content.slice(0, 500)}${content.length > 500 ? '...' : ''}\\n\`\`\``);
                return content;

            case 'edit_file':
                return await this.editFile(command.path, command.content);

            case 'list_files':
                const files = await this.listFiles(command.path || AppState.currentPath);
                const fileList = files.map(f => `${f.type === 'directory' ? '📁' : '📄'} ${f.name} ${f.size || ''}`).join('\\n');
                this.addMessage('system', `📋 ${command.path || AppState.currentPath}:\\n${fileList}`);
                return files;

            default:
                throw new Error(`未サポートのアクション: ${command.action}`);
        }
    }

    // ファイル操作メソッド
    static async deleteFile(path) {
        const files = mockFileSystem[AppState.currentPath] || [];
        const fileName = path.split('/').pop();
        const fileIndex = files.findIndex(f => f.name === fileName);
        
        if (fileIndex === -1) {
            throw new Error(`ファイル "${fileName}" が見つかりません`);
        }
        
        const deletedFile = files.splice(fileIndex, 1)[0];
        return `ファイル "${deletedFile.name}" を削除しました`;
    }

    static async readFile(path) {
        const files = mockFileSystem[AppState.currentPath] || [];
        const fileName = path.split('/').pop();
        const file = files.find(f => f.name === fileName);
        
        if (!file) {
            throw new Error(`ファイル "${fileName}" が見つかりません`);
        }
        
        if (file.content === undefined) {
            throw new Error(`ファイル "${fileName}" は読み込めません`);
        }
        
        return file.content;
    }

    static async editFile(path, content) {
        const files = mockFileSystem[AppState.currentPath] || [];
        const fileName = path.split('/').pop();
        const fileIndex = files.findIndex(f => f.name === fileName);
        
        if (fileIndex === -1) {
            throw new Error(`ファイル "${fileName}" が見つかりません`);
        }
        
        const oldContent = files[fileIndex].content;
        files[fileIndex].content = content;
        
        // ファイルサイズ更新
        const sizeInBytes = new Blob([content]).size;
        files[fileIndex].size = FileManager.formatFileSize(sizeInBytes);
        
        return `ファイル "${fileName}" を編集しました (${oldContent?.length || 0} → ${content.length} 文字)`;
    }

    static async listFiles(path) {
        const files = mockFileSystem[path] || [];
        if (files.length === 0) {
            throw new Error(`ディレクトリ "${path}" は空か存在しません`);
        }
        return files;
    }

    // ヘルパーメソッド
    static getCurrentFileList() {
        const files = mockFileSystem[AppState.currentPath] || [];
        return files.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            hasContent: file.content !== undefined
        }));
    }

    static setLoading(loading) {
        AppState.setState({ isLoading: loading });
        elements.sendBtn.disabled = loading;
        elements.chatInput.disabled = loading;

        if (loading) {
            this.addMessage('system', '<span class="loading">AI が処理中です</span>');
        } else {
            const loadingMsg = elements.chatMessages.querySelector('.loading');
            if (loadingMsg) {
                loadingMsg.parentElement.remove();
            }
        }
    }

    static isFileOperationCommand(message) {
        const operations = ['create', 'delete', 'move', 'copy', 'mkdir', '作成', '削除', '移動', 'コピー'];
        return operations.some(op => message.toLowerCase().includes(op));
    }
}

//   イベントハンドラー設定
class EventHandler {
    static init() {
        // ヘッダーボタン
        elements.backBtn.addEventListener('click', () => UIController.setFileViewMode(false));
        elements.editBtn.addEventListener('click', this.toggleEditMode);
        elements.saveBtn.addEventListener('click', () => FileManager.saveFile());
        elements.settingsBtn.addEventListener('click', () => UIController.showModal('settingsModal'));

        // チャット
        elements.sendBtn.addEventListener('click', () => MessageHandler.sendMessage());
        elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !AppState.isLoading) MessageHandler.sendMessage();
        });
        elements.chatInput.addEventListener('focus', () => {
            if (!AppState.isChatOpen) UIController.toggleChat();
        });
        elements.chatCloseBtn.addEventListener('click', () => UIController.toggleChat());

        // アクションボタン
        elements.cancelBtn.addEventListener('click', () => UIController.setSelectionMode(false));
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFileAction(e.target.dataset.action));
        });

        // FAB
        elements.fabBtn.addEventListener('click', () => UIController.showModal('createModal'));

        // ファイル作成
        elements.createFileBtn.addEventListener('click', this.handleCreateFile);

        // 名前変更
        elements.renameFileBtn.addEventListener('click', this.handleRename);

        // モーダル閉じる
        document.querySelectorAll('.modal-close, [data-modal="close"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // オーバーレイクリック
        document.querySelectorAll('.modal, .chat-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                    if (overlay.classList.contains('chat-overlay')) {
                        UIController.toggleChat();
                    }
                }
            });
        });

        // ESCキー
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                UIController.hideAllModals();
                if (AppState.isSelectionMode) UIController.setSelectionMode(false);
                if (AppState.isFileViewMode) UIController.setFileViewMode(false);
                if (AppState.isChatOpen) UIController.toggleChat();
            }
        });
    }

    // 編集モード切り替え
    static toggleEditMode() {
        const newEditMode = !AppState.isEditMode;
        AppState.setState({ isEditMode: newEditMode });

        const files = mockFileSystem[AppState.currentPath] || [];
        const file = files.find(f => f.name === AppState.currentEditingFile);
        if (file) {
            FileManager.showFileContent(file.content, AppState.currentEditingFile);
            MessageHandler.addMessage('system', newEditMode ? '✏️ 編集モードに切り替えました' : '📖 プレビューモードに切り替えました');
        }
    }

    // ファイル操作処理
    static async handleFileAction(action) {
        if (!AppState.selectedFile) return;

        switch (action) {
            case 'copy':
                MessageHandler.addMessage('system', `📋 "${AppState.selectedFile.name}" をコピーしました（デモ）`);
                break;
            case 'rename':
                elements.renameInput.value = AppState.selectedFile.name;
                UIController.showModal('renameModal');
                setTimeout(() => elements.renameInput.focus(), 100);
                return;
            case 'delete':
                if (confirm(`"${AppState.selectedFile.name}" を削除しますか？`)) {
                    const files = mockFileSystem[AppState.currentPath] || [];
                    const fileIndex = files.findIndex(f => f.name === AppState.selectedFile.name);
                    if (fileIndex !== -1) {
                        const deletedFile = files.splice(fileIndex, 1)[0];
                        MessageHandler.addMessage('system', `🗑️ "${deletedFile.name}" を削除しました`);
                        await FileManager.loadFileList();
                    }
                }
                break;
        }
        UIController.setSelectionMode(false);
    }

    // ファイル作成処理
    static async handleCreateFile() {
        const filePath = elements.filePathInput.value.trim();
        const content = elements.fileContentInput.value;

        if (!filePath) {
            MessageHandler.addMessage('system', '⚠️ ファイルパスを入力してください');
            return;
        }

        elements.createFileBtn.disabled = true;
        elements.createFileBtn.textContent = '作成中...';

        try {
            const fileName = await FileManager.createFile(filePath, content);
            UIController.hideModal('createModal');
            MessageHandler.addMessage('system', `✅ ファイル "${fileName}" を作成しました`);
            await FileManager.loadFileList();

            elements.filePathInput.value = '';
            elements.fileContentInput.value = '';
        } catch (error) {
            MessageHandler.addMessage('system', `❌ ファイル作成に失敗しました: ${error.message}`);
        } finally {
            elements.createFileBtn.disabled = false;
            elements.createFileBtn.textContent = '作成';
        }
    }

    // 名前変更処理
    static async handleRename() {
        const newName = elements.renameInput.value.trim();

        if (!newName) {
            MessageHandler.addMessage('system', '⚠️ 新しい名前を入力してください');
            return;
        }

        if (!AppState.selectedFile) return;

        const files = mockFileSystem[AppState.currentPath] || [];
        const existingFile = files.find(f => f.name === newName);

        if (existingFile && existingFile !== AppState.selectedFile) {
            MessageHandler.addMessage('system', '⚠️ その名前のファイルは既に存在します');
            return;
        }

        const fileIndex = files.findIndex(f => f.name === AppState.selectedFile.name);
        if (fileIndex !== -1) {
            const oldName = files[fileIndex].name;
            files[fileIndex].name = newName;
            MessageHandler.addMessage('system', `✏️ "${oldName}" を "${newName}" に名前変更しました`);
            await FileManager.loadFileList();
        }

        UIController.hideModal('renameModal');
        UIController.setSelectionMode(false);
    }
}

//   アプリケーション初期化
document.addEventListener('DOMContentLoaded', async function() {
    // プロバイダー情報読み込み
    await APIClient.loadProviders();

    // 設定適用
    UIController.applyTheme();

    // イベントリスナー設定
    EventHandler.init();

    // ファイルリスト読み込み
    await FileManager.loadFileList();

    // 初期メッセージ表示
    setTimeout(() => {
        const providerName = AppState.availableProviders[AppState.llmProvider]?.name || AppState.llmProvider;
        MessageHandler.addMessage('ai', `🎉 AI File Manager - 基本機能統合版へようこそ！\\n\\n**🤖 現在のAI設定:**\\n• プロバイダー: ${providerName}\\n• モデル: ${AppState.llmModel}\\n\\n**⚡ 新機能 - AIコマンド:**\\n📝 **ファイル作成** - "新しいファイルを作って" "config.json を作成して"\\n📖 **ファイル読み込み** - "README.md を読んで" "内容を表示して"\\n✏️ **ファイル編集** - "README.md を編集して" "内容を変更して"\\n🗑️ **ファイル削除** - "sample.txt を削除して" "不要なファイルを消して"\\n📋 **ファイル一覧** - "ファイル一覧を表示して" "何があるか教えて"\\n\\n**🚀 使用例:**\\n• "プロジェクトの説明を書いたREADME.mdを作成して"\\n• "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\\n• "このディレクトリにあるファイルを教えて"\\n\\n**help** と入力すると詳細なコマンド一覧を確認できます。\\n\\nさあ、自然な日本語でファイル操作を試してみてください！`);
    }, 1000);
});