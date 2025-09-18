/* =========================================
   AI File Manager - メインクライアントサイド JavaScript
   
   【概要】
   ブラウザ上で動作するAI統合ファイルマネージャーのフロントエンド
   自然言語でのファイル操作、リアルタイムUI制御、複数LLMプロバイダー対応
   会話履歴管理、複数選択、一括操作、ファイル操作機能（コピー・移動・ディレクトリ作成）対応
   
   【主要クラス構成】
   - AppState: アプリケーション状態管理（テーマ、LLMプロバイダー設定等）
   - ConversationHistory: 会話履歴管理
   - APIClient: server.jsとの通信処理（チャット、プロバイダー情報取得）
   - UIController: UI制御、モード切替、設定画面生成、複数選択機能
   - FileManager: ファイル操作UI、モックファイルシステム管理、
   - MessageHandler: AIコマンド実行、server.jsからの応答処理、コマンド対応
   - EventHandler: DOM イベント処理、ユーザーインタラクション制御
   - Utils: ユーティリティ関数（ファイルアイコン、Markdown解析等）
   
   【server.js連携ポイント】
   - /api/chat: AIチャット機能（会話履歴送信対応）
   - /api/llm-providers: 利用可能プロバイダー・モデル一覧取得
   - /api/health: サーバー状態・API接続確認
   ========================================= */

//   アプリケーション状態管理
const AppState = {
    // 基本状態
    currentPath: '/workspace',
    selectedFiles: [], // 複数選択対応
    currentEditingFile: null,

    // UI状態
    isSelectionMode: false,
    isMultiSelectMode: false, // 複数選択モード
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

//   会話履歴管理クラス
class ConversationHistory {
    static maxHistory = 30; // 最大履歴数
    static warningThreshold = 15; // 警告表示の閾値
    
    static history = JSON.parse(localStorage.getItem('conversationHistory') || '[]');

    static addExchange(userMessage, aiResponse) {
        this.history.push({
            user: userMessage,
            ai: aiResponse,
            timestamp: new Date().toISOString()
        });

        // 履歴制限
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }

        this.save();
    }

    static getHistory() {
        return this.history;
    }

    static clearHistory() {
        this.history = [];
        this.save();
        MessageHandler.addMessage('system', '🗑️ 会話履歴をクリアしました。新しい会話を開始してください。');
    }

    static save() {
        localStorage.setItem('conversationHistory', JSON.stringify(this.history));
    }

    static shouldWarnAboutHistory() {
        return this.history.length >= this.warningThreshold;
    }

    static getHistoryStatus() {
        return {
            count: this.history.length,
            max: this.maxHistory,
            shouldWarn: this.shouldWarnAboutHistory()
        };
    }
}

//   モックデータ（デモ用）- ディレクトリ構造拡張
const mockFileSystem = {
    '/workspace': [
        { 
            name: 'README.md', 
            type: 'file', 
            size: '1.2 KB', 
            content: '# AI File Manager - 拡張版\\n\\n## 新機能\\n- Claude API統合\\n- 会話履歴管理\\n- ファイルコピー・移動\\n- ディレクトリ作成\\n- 一括操作\\n- 複数選択\\n- JSON形式レスポンス対応\\n- セキュリティ強化\\n\\n## 使い方\\n\\n### 基本コマンド\\n- **ファイル作成**: "新しいファイルを作って" "sample.txt を作成して"\\n- **ディレクトリ作成**: "docs フォルダを作って" "新しいフォルダを作成"\\n- **ファイル読み込み**: "README.md を読んで" "ファイルの内容を表示して"\\n- **ファイル編集**: "README.md を編集して" "内容を変更して"\\n- **ファイルコピー**: "ファイルをコピーして" "backup フォルダにコピー"\\n- **ファイル移動**: "ファイルを移動して" "別のフォルダに移動"\\n- **ファイル削除**: "sample.txt を削除して" "不要なファイルを消して"\\n- **ファイル一覧**: "ファイル一覧を表示して" "何があるか教えて"\\n\\n### 一括操作\\n- **一括削除**: "全ての .txt ファイルを削除して"\\n- **一括コピー**: "画像ファイル全部を images フォルダにコピー"\\n- **一括移動**: "古いファイルを全部 archive に移動"\\n\\n### 自然な会話例\\n- "プロジェクト用の docs フォルダを作って、README.md も作成して"\\n- "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\\n- "このディレクトリにあるファイルを教えて"\\n- "画像ファイルを全部 images フォルダに整理して"\\n\\n**help** と入力すると詳細なコマンド一覧を確認できます！' 
        },
        {
            name: 'docs',
            type: 'directory',
            size: ''
        },
        {
            name: 'images',
            type: 'directory', 
            size: ''
        }
    ],
    '/workspace/docs': [
        {
            name: 'guide.md',
            type: 'file',
            size: '0.8 KB',
            content: '# ユーザーガイド\\n\\nAI File Manager の使い方について説明します。'
        }
    ],
    '/workspace/images': []
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
            // 会話履歴をコンテキストに追加
            context.conversationHistory = ConversationHistory.getHistory();
            
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
            
            // 会話履歴に追加
            ConversationHistory.addExchange(message, data.message);
            
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
            'png': '🖼️', 'pdf': '📕', 'zip': '🗄️', 'doc': '📝',
            'xlsx': '📊', 'ppt': '📋'
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
    },

    // パス結合
    joinPath(basePath, ...segments) {
        let result = basePath.replace(/\/+$/, ''); // 末尾のスラッシュ削除
        for (const segment of segments) {
            if (segment) {
                result += '/' + segment.replace(/^\/+/, ''); // 先頭のスラッシュ削除
            }
        }
        return result || '/';
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

        const historyStatus = ConversationHistory.getHistoryStatus();

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

            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">💬 会話履歴管理</label>
                <div style="padding: 12px; border-radius: 8px; background: var(--hover-bg); margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span>履歴数: ${historyStatus.count} / ${historyStatus.max}</span>
                        ${historyStatus.shouldWarn ? '<span style="color: #ff9800;">⚠️ 多め</span>' : '<span style="color: #4caf50;">✅ 良好</span>'}
                    </div>
                    <div style="background: var(--bg-primary); border-radius: 4px; height: 6px; overflow: hidden;">
                        <div style="background: ${historyStatus.shouldWarn ? '#ff9800' : '#4caf50'}; height: 100%; width: ${(historyStatus.count / historyStatus.max) * 100}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                <button class="btn secondary" id="clearHistoryBtn" style="width: 100%;">🗑️ 会話履歴をクリア</button>
            </div>

            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🔌 接続状態</label>
                <div id="connectionStatus" style="padding: 12px; border-radius: 8px; background: var(--hover-bg); font-size: 13px;">
                    確認中...
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">⚡ 利用可能な機能</label>
                <div style="padding: 12px; border-radius: 8px; background: var(--hover-bg); font-size: 13px;">
                    📝 create_file - ファイル作成<br>
                    📁 create_directory - ディレクトリ作成<br>
                    📖 read_file - ファイル読み込み<br>
                    ✏️ edit_file - ファイル編集<br>
                    📋 copy_file - ファイルコピー<br>
                    🔄 move_file - ファイル移動/名前変更<br>
                    🗑️ delete_file - ファイル削除<br>
                    📋 list_files - ファイル一覧<br>
                    🔄 一括操作 - batch_delete/copy/move<br>
                    💬 会話履歴管理 - conversation_history<br>
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

        // 会話履歴クリア
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (confirm('会話履歴をすべてクリアしますか？')) {
                    ConversationHistory.clearHistory();
                    this.generateSettingsUI(); // UI再生成
                }
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
                statusHtml += `<strong>会話履歴:</strong> ${health.features.conversation_history ? '✅' : '❌'}<br>`;
                statusHtml += `<strong>一括操作:</strong> ${health.features.batch_operations ? '✅' : '❌'}<br>`;
                statusHtml += `<strong>コピー・移動:</strong> ${health.features.file_copy_move ? '✅' : '❌'}<br>`;
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

    // 選択モード設定（複数選択対応）
    static setSelectionMode(enabled, multiSelect = false) {
        AppState.setState({ 
            isSelectionMode: enabled,
            isMultiSelectMode: multiSelect && enabled
        });

        if (enabled) {
            elements.chatContainer.style.display = 'none';
            elements.actionContainer.style.display = 'flex';
            elements.selectionInfo.style.display = 'block';
            
            const count = AppState.selectedFiles.length;
            const fileNames = AppState.selectedFiles.map(f => f.name).join(', ');
            elements.selectionInfo.textContent = `${count}件選択中: ${fileNames}`;
            
            elements.fabBtn.classList.add('hidden');
            
            // アクションボタンの表示制御
            this.updateActionButtons(count);
        } else {
            elements.chatContainer.style.display = 'flex';
            elements.actionContainer.style.display = 'none';
            elements.selectionInfo.style.display = 'none';
            elements.fabBtn.classList.remove('hidden');

            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected');
            });
            AppState.setState({ selectedFiles: [] });
        }
    }

    // アクションボタン表示更新
    static updateActionButtons(count) {
        const actionContainer = elements.actionContainer;
        if (count === 0) {
            actionContainer.innerHTML = `<button class="btn secondary" id="cancelBtn">キャンセル</button>`;
        } else if (count === 1) {
            actionContainer.innerHTML = `
                <button class="action-btn" data-action="copy">📋 コピー</button>
                <button class="action-btn" data-action="move">🔄 移動</button>
                <button class="action-btn" data-action="rename">✏️ 名前変更</button>
                <button class="action-btn danger" data-action="delete">🗑️ 削除</button>
                <button class="btn secondary" id="cancelBtn">キャンセル</button>
            `;
        } else {
            actionContainer.innerHTML = `
                <button class="action-btn" data-action="batch_copy">📋 一括コピー</button>
                <button class="action-btn" data-action="batch_move">🔄 一括移動</button>
                <button class="action-btn danger" data-action="batch_delete">🗑️ 一括削除</button>
                <button class="btn secondary" id="cancelBtn">キャンセル</button>
            `;
        }

        // イベントリスナー再設定
        this.setupActionEventListeners();
    }

    // アクションイベントリスナー設定
    static setupActionEventListeners() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => EventHandler.handleFileAction(e.target.dataset.action));
        });
        
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.setSelectionMode(false));
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

        item.addEventListener('click', (e) => this.handleFileClick(file, e));

        if (file.name !== '..') {
            let longPressTimer;
            const startLongPress = () => {
                longPressTimer = setTimeout(() => {
                    if (!AppState.isFileViewMode) {
                        this.selectFile(file, item);
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

    // ファイル選択処理（複数選択対応）
    static selectFile(file, itemElement) {
        const isAlreadySelected = AppState.selectedFiles.some(f => f.name === file.name);
        
        if (AppState.isMultiSelectMode) {
            if (isAlreadySelected) {
                // 選択解除
                AppState.setState({ 
                    selectedFiles: AppState.selectedFiles.filter(f => f.name !== file.name)
                });
                itemElement.classList.remove('selected');
            } else {
                // 追加選択
                AppState.setState({ 
                    selectedFiles: [...AppState.selectedFiles, file]
                });
                itemElement.classList.add('selected');
            }
        } else {
            // 単一選択
            AppState.setState({ selectedFiles: [file] });
            itemElement.classList.add('selected');
        }
        
        UIController.setSelectionMode(true, AppState.selectedFiles.length > 1);
    }

    static async handleFileClick(file, event) {
        if (AppState.isSelectionMode) {
            // Ctrl/Cmd キーが押されていれば複数選択モード
            if (event.ctrlKey || event.metaKey) {
                AppState.setState({ isMultiSelectMode: true });
                this.selectFile(file, event.target.closest('.file-item'));
            } else {
                UIController.setSelectionMode(false);
            }
            return;
        }

        if (file.type === 'directory') {
            if (file.name === '..') {
                const pathParts = AppState.currentPath.split('/').filter(part => part);
                pathParts.pop();
                AppState.setState({ currentPath: '/' + pathParts.join('/') });
            } else {
                AppState.setState({ currentPath: Utils.joinPath(AppState.currentPath, file.name) });
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

    // ファイル作成
    static async createFile(filePath, content = '') {
        await Utils.delay(500);

        const fullPath = filePath.startsWith('/') ? filePath : Utils.joinPath(AppState.currentPath, filePath);
        const pathSegments = fullPath.split('/').filter(segment => segment !== '');

        const fileName = pathSegments.pop();
        const directorySegments = pathSegments;

        let currentPath = '';

        // Create intermediate directories
        for (const segment of directorySegments) {
            const parentPath = currentPath;
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

        const existingFile = mockFileSystem[targetDirectoryPath]?.find(f => f.name === fileName);
        if (existingFile) {
            throw new Error(`ファイル "${fileName}" は既に存在します`);
        }

        const sizeInBytes = new Blob([content]).size;
        const formattedSize = this.formatFileSize(sizeInBytes);

        if (!mockFileSystem[targetDirectoryPath]) {
            mockFileSystem[targetDirectoryPath] = [];
        }

        mockFileSystem[targetDirectoryPath].push({
            name: fileName,
            type: 'file',
            size: formattedSize,
            content: content
        });

        return fileName;
    }

    // ディレクトリ作成
    static async createDirectory(dirPath) {
        await Utils.delay(500);

        const fullPath = dirPath.startsWith('/') ? dirPath : Utils.joinPath(AppState.currentPath, dirPath);
        const pathSegments = fullPath.split('/').filter(segment => segment !== '');

        const dirName = pathSegments.pop();
        const parentSegments = pathSegments;

        let currentPath = '';

        // Create intermediate directories
        for (const segment of parentSegments) {
            const parentPath = currentPath;
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
        
        // Check if directory already exists
        const existingDir = mockFileSystem[targetDirectoryPath]?.find(f => f.name === dirName && f.type === 'directory');
        if (existingDir) {
            throw new Error(`ディレクトリ "${dirName}" は既に存在します`);
        }

        // Create directory entry in parent
        if (!mockFileSystem[targetDirectoryPath]) {
            mockFileSystem[targetDirectoryPath] = [];
        }

        mockFileSystem[targetDirectoryPath].push({
            name: dirName,
            type: 'directory',
            size: ''
        });

        // Create empty directory
        const newDirPath = Utils.joinPath(targetDirectoryPath, dirName);
        mockFileSystem[newDirPath] = [];

        return dirName;
    }

    // ファイル・ディレクトリコピー
    static async copyFile(sourcePath, destPath) {
        await Utils.delay(500);

        const sourceFullPath = sourcePath.startsWith('/') ? sourcePath : Utils.joinPath(AppState.currentPath, sourcePath);
        const destFullPath = destPath.startsWith('/') ? destPath : Utils.joinPath(AppState.currentPath, destPath);

        // Find source file
        const sourceDir = sourceFullPath.substring(0, sourceFullPath.lastIndexOf('/')) || '/workspace';
        const sourceFileName = sourceFullPath.substring(sourceFullPath.lastIndexOf('/') + 1);
        
        const sourceFiles = mockFileSystem[sourceDir] || [];
        const sourceFile = sourceFiles.find(f => f.name === sourceFileName);

        if (!sourceFile) {
            throw new Error(`コピー元 "${sourcePath}" が見つかりません`);
        }

        // Determine destination
        const destDir = destFullPath.substring(0, destFullPath.lastIndexOf('/')) || '/workspace';
        const destFileName = destFullPath.substring(destFullPath.lastIndexOf('/') + 1);

        // Ensure destination directory exists
        if (!mockFileSystem[destDir]) {
            throw new Error(`コピー先ディレクトリ "${destDir}" が存在しません`);
        }

        // Check if destination already exists
        const destFiles = mockFileSystem[destDir];
        const existingFile = destFiles.find(f => f.name === destFileName);
        if (existingFile) {
            throw new Error(`コピー先 "${destFileName}" は既に存在します`);
        }

        // Copy file
        const copiedFile = {
            name: destFileName,
            type: sourceFile.type,
            size: sourceFile.size,
            content: sourceFile.content
        };

        destFiles.push(copiedFile);

        // If copying directory, recursively copy contents
        if (sourceFile.type === 'directory') {
            const sourceDirPath = Utils.joinPath(sourceDir, sourceFileName);
            const destDirPath = Utils.joinPath(destDir, destFileName);
            mockFileSystem[destDirPath] = [];

            const sourceDirFiles = mockFileSystem[sourceDirPath] || [];
            for (const file of sourceDirFiles) {
                await this.copyFile(
                    Utils.joinPath(sourceDirPath, file.name),
                    Utils.joinPath(destDirPath, file.name)
                );
            }
        }

        return destFileName;
    }

    // ファイル・ディレクトリ移動
    static async moveFile(sourcePath, destPath) {
        await Utils.delay(500);

        // First copy the file
        const destFileName = await this.copyFile(sourcePath, destPath);

        // Then delete the source
        await this.deleteFile(sourcePath);

        return destFileName;
    }

    // ファイル・ディレクトリ削除
    static async deleteFile(filePath) {
        await Utils.delay(500);

        const fullPath = filePath.startsWith('/') ? filePath : Utils.joinPath(AppState.currentPath, filePath);
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/')) || '/workspace';
        const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1);

        const files = mockFileSystem[dir] || [];
        const fileIndex = files.findIndex(f => f.name === fileName);

        if (fileIndex === -1) {
            throw new Error(`ファイル "${fileName}" が見つかりません`);
        }

        const deletedFile = files[fileIndex];

        // If deleting directory, remove its contents too
        if (deletedFile.type === 'directory') {
            const dirPath = Utils.joinPath(dir, fileName);
            delete mockFileSystem[dirPath];
        }

        files.splice(fileIndex, 1);
        return deletedFile.name;
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
                selectedFiles: AppState.selectedFiles,
                timestamp: new Date().toISOString()
            };

            // AI応答を取得
            const response = await APIClient.sendChatMessage(message, context);
            
            // メッセージを表示
            this.addMessage('ai', response.message || response.response);

            // 新しいチャット提案の表示
            if (response.shouldSuggestNewChat) {
                setTimeout(() => {
                    const historyStatus = ConversationHistory.getHistoryStatus();
                    this.addMessage('system', `💡 **ヒント**: 会話履歴が ${historyStatus.count} 件になりました。より良いAI応答のため、設定画面から履歴をクリアして新しい会話を始めることをお勧めします！`);
                }, 1000);
            }

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
                const debugInfo = `<small style="color: var(--text-muted); opacity: 0.7;">via ${providerName} (${response.model}) | 履歴: ${response.historyCount || 0}件</small>`;
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

        const allowedActions = [
            'create_file', 'create_directory', 'delete_file', 'copy_file', 'move_file',
            'read_file', 'edit_file', 'list_files',
            'batch_delete', 'batch_copy', 'batch_move'
        ];
        
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

        // 一括操作のパス配列チェック
        if (command.paths || command.sources) {
            const pathArray = command.paths || command.sources;
            if (!Array.isArray(pathArray)) {
                throw new Error('一括操作にはパス配列が必要です');
            }
        }

        return true;
    }

    static async executeCommand(command) {
        switch (command.action) {
            case 'create_file':
                const fileName = await FileManager.createFile(command.path, command.content || '');
                return `ファイル "${fileName}" を作成しました`;

            case 'create_directory':
                const dirName = await FileManager.createDirectory(command.path);
                return `ディレクトリ "${dirName}" を作成しました`;

            case 'delete_file':
                const deletedName = await FileManager.deleteFile(command.path);
                return `ファイル "${deletedName}" を削除しました`;

            case 'copy_file':
                const copiedName = await FileManager.copyFile(command.source, command.destination);
                return `"${command.source}" を "${command.destination}" にコピーしました`;

            case 'move_file':
                const movedName = await FileManager.moveFile(command.source, command.destination);
                return `"${command.source}" を "${command.destination}" に移動しました`;

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

            case 'batch_delete':
                const deleteResults = [];
                for (const path of command.paths) {
                    try {
                        const deleted = await FileManager.deleteFile(path);
                        deleteResults.push(deleted);
                    } catch (error) {
                        console.error(`Failed to delete ${path}:`, error);
                    }
                }
                return `一括削除完了: ${deleteResults.length} 件`;

            case 'batch_copy':
                const copyResults = [];
                for (const source of command.sources) {
                    try {
                        const destPath = Utils.joinPath(command.destination, source.split('/').pop());
                        await FileManager.copyFile(source, destPath);
                        copyResults.push(source);
                    } catch (error) {
                        console.error(`Failed to copy ${source}:`, error);
                    }
                }
                return `一括コピー完了: ${copyResults.length} 件`;

            case 'batch_move':
                const moveResults = [];
                for (const source of command.sources) {
                    try {
                        const destPath = Utils.joinPath(command.destination, source.split('/').pop());
                        await FileManager.moveFile(source, destPath);
                        moveResults.push(source);
                    } catch (error) {
                        console.error(`Failed to move ${source}:`, error);
                    }
                }
                return `一括移動完了: ${moveResults.length} 件`;

            default:
                throw new Error(`未サポートのアクション: ${command.action}`);
        }
    }

    // ファイル操作メソッド
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
        const selectedFiles = AppState.selectedFiles;
        if (selectedFiles.length === 0) return;

        switch (action) {
            case 'copy':
                const copyDestination = prompt('コピー先のパスを入力してください:', `${AppState.currentPath}/copy_of_${selectedFiles[0].name}`);
                if (copyDestination) {
                    try {
                        await FileManager.copyFile(selectedFiles[0].name, copyDestination);
                        MessageHandler.addMessage('system', `📋 "${selectedFiles[0].name}" を "${copyDestination}" にコピーしました`);
                        await FileManager.loadFileList();
                    } catch (error) {
                        MessageHandler.addMessage('system', `❌ コピーに失敗: ${error.message}`);
                    }
                }
                break;

            case 'move':
                const moveDestination = prompt('移動先のパスを入力してください:', `${AppState.currentPath}/${selectedFiles[0].name}`);
                if (moveDestination) {
                    try {
                        await FileManager.moveFile(selectedFiles[0].name, moveDestination);
                        MessageHandler.addMessage('system', `🔄 "${selectedFiles[0].name}" を "${moveDestination}" に移動しました`);
                        await FileManager.loadFileList();
                    } catch (error) {
                        MessageHandler.addMessage('system', `❌ 移動に失敗: ${error.message}`);
                    }
                }
                break;

            case 'rename':
                elements.renameInput.value = selectedFiles[0].name;
                UIController.showModal('renameModal');
                setTimeout(() => elements.renameInput.focus(), 100);
                return;

            case 'delete':
                if (confirm(`"${selectedFiles[0].name}" を削除しますか？`)) {
                    try {
                        await FileManager.deleteFile(selectedFiles[0].name);
                        MessageHandler.addMessage('system', `🗑️ "${selectedFiles[0].name}" を削除しました`);
                        await FileManager.loadFileList();
                    } catch (error) {
                        MessageHandler.addMessage('system', `❌ 削除に失敗: ${error.message}`);
                    }
                }
                break;

            case 'batch_copy':
                const batchCopyDest = prompt('一括コピー先のフォルダパスを入力してください:', `${AppState.currentPath}/copied`);
                if (batchCopyDest) {
                    let successCount = 0;
                    for (const file of selectedFiles) {
                        try {
                            const destPath = Utils.joinPath(batchCopyDest, file.name);
                            await FileManager.copyFile(file.name, destPath);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to copy ${file.name}:`, error);
                        }
                    }
                    MessageHandler.addMessage('system', `📋 一括コピー完了: ${successCount}/${selectedFiles.length} 件`);
                    await FileManager.loadFileList();
                }
                break;

            case 'batch_move':
                const batchMoveDest = prompt('一括移動先のフォルダパスを入力してください:', `${AppState.currentPath}/moved`);
                if (batchMoveDest) {
                    let successCount = 0;
                    for (const file of selectedFiles) {
                        try {
                            const destPath = Utils.joinPath(batchMoveDest, file.name);
                            await FileManager.moveFile(file.name, destPath);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to move ${file.name}:`, error);
                        }
                    }
                    MessageHandler.addMessage('system', `🔄 一括移動完了: ${successCount}/${selectedFiles.length} 件`);
                    await FileManager.loadFileList();
                }
                break;

            case 'batch_delete':
                const fileNames = selectedFiles.map(f => f.name).join(', ');
                if (confirm(`選択した ${selectedFiles.length} 個のファイル (${fileNames}) を削除しますか？`)) {
                    let successCount = 0;
                    for (const file of selectedFiles) {
                        try {
                            await FileManager.deleteFile(file.name);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to delete ${file.name}:`, error);
                        }
                    }
                    MessageHandler.addMessage('system', `🗑️ 一括削除完了: ${successCount}/${selectedFiles.length} 件`);
                    await FileManager.loadFileList();
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
            // ファイルかディレクトリかを判定（拡張子があるかどうか）
            const hasExtension = filePath.includes('.') && !filePath.endsWith('/');
            
            if (hasExtension) {
                const fileName = await FileManager.createFile(filePath, content);
                MessageHandler.addMessage('system', `✅ ファイル "${fileName}" を作成しました`);
            } else {
                const dirName = await FileManager.createDirectory(filePath);
                MessageHandler.addMessage('system', `✅ ディレクトリ "${dirName}" を作成しました`);
            }
            
            UIController.hideModal('createModal');
            await FileManager.loadFileList();

            elements.filePathInput.value = '';
            elements.fileContentInput.value = '';
        } catch (error) {
            MessageHandler.addMessage('system', `❌ 作成に失敗しました: ${error.message}`);
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

        if (AppState.selectedFiles.length === 0) return;

        const selectedFile = AppState.selectedFiles[0];
        const files = mockFileSystem[AppState.currentPath] || [];
        const existingFile = files.find(f => f.name === newName);

        if (existingFile && existingFile !== selectedFile) {
            MessageHandler.addMessage('system', '⚠️ その名前のファイルは既に存在します');
            return;
        }

        const fileIndex = files.findIndex(f => f.name === selectedFile.name);
        if (fileIndex !== -1) {
            const oldName = files[fileIndex].name;
            files[fileIndex].name = newName;
            
            // ディレクトリの場合、mockFileSystemのキーも更新
            if (files[fileIndex].type === 'directory') {
                const oldDirPath = Utils.joinPath(AppState.currentPath, oldName);
                const newDirPath = Utils.joinPath(AppState.currentPath, newName);
                if (mockFileSystem[oldDirPath]) {
                    mockFileSystem[newDirPath] = mockFileSystem[oldDirPath];
                    delete mockFileSystem[oldDirPath];
                }
            }
            
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
        const historyStatus = ConversationHistory.getHistoryStatus();
        
        MessageHandler.addMessage('ai', `🎉 AI File Manager - 拡張版へようこそ！\\n\\n**🤖 現在のAI設定:**\\n• プロバイダー: ${providerName}\\n• モデル: ${AppState.llmModel}\\n• 会話履歴: ${historyStatus.count}件 ${historyStatus.shouldWarn ? '⚠️' : '✅'}\\n\\n**⚡ 新機能 - 拡張AIコマンド:**\\n📝 **ファイル作成** - "新しいファイルを作って" "config.json を作成して"\\n📁 **ディレクトリ作成** - "docs フォルダを作って" "新しいフォルダを作成"\\n📖 **ファイル読み込み** - "README.md を読んで" "内容を表示して"\\n✏️ **ファイル編集** - "README.md を編集して" "内容を変更して"\\n📋 **ファイルコピー** - "ファイルをコピーして" "backup フォルダにコピー"\\n🔄 **ファイル移動** - "ファイルを移動して" "別のフォルダに移動"\\n🗑️ **ファイル削除** - "sample.txt を削除して" "不要なファイルを消して"\\n📋 **ファイル一覧** - "ファイル一覧を表示して" "何があるか教えて"\\n\\n**🔄 一括操作:**\\n• **一括削除** - "全ての .txt ファイルを削除して"\\n• **一括コピー** - "画像ファイル全部を images フォルダにコピー"\\n• **一括移動** - "古いファイルを全部 archive に移動"\\n\\n**📱 操作方法:**\\n• **複数選択** - Ctrl/Cmd + クリックで複数選択\\n• **長押し選択** - ファイルを長押しで操作メニュー表示\\n• **会話履歴管理** - 設定画面で履歴の確認・クリアが可能\\n\\n**🚀 使用例:**\\n• "プロジェクト用の docs フォルダを作って、README.md も作成して"\\n• "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\\n• "画像ファイルを全部 images フォルダに整理して"\\n\\n**help** と入力すると詳細なコマンド一覧を確認できます。\\n\\nさあ、さらに進化した自然言語でファイル操作を試してみてください！`);
    }, 1000);
});