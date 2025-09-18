/* =========================================
   AI File Manager - UI制御とファイル管理
   ========================================= */

// UI制御クラス
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
                    🔄 move_file - ファイル移動<br>
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

// ファイル操作クラス
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