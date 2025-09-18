/* =========================================
   AI File Manager - イベント処理
   ========================================= */

// イベントハンドラー設定
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

        // FAB メニュー
        elements.fabBtn.addEventListener('click', this.toggleFabMenu);
        elements.fabMenuOverlay.addEventListener('click', this.toggleFabMenu);
        elements.fabMenu.addEventListener('click', this.handleFabMenuClick);

        // ファイル作成
        elements.createFileBtn.addEventListener('click', this.handleCreateFile);

        // 名前変更
        elements.renameFileBtn.addEventListener('click', this.handleRename);
        
        // インポート
        elements.confirmImport.addEventListener('click', this.handleImport);
        
        // システムプロンプト
        elements.confirmSystemPrompt.addEventListener('click', this.handleSystemPrompt);

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
        // 差分モードの場合は編集モードに戻る
        if (AppState.isDiffMode) {
            UIController.setDiffMode(false);
            AppState.setState({ isEditMode: true });
            const files = mockFileSystem[AppState.currentPath] || [];
            const file = files.find(f => f.name === AppState.currentEditingFile);
            if (file) {
                FileManager.showFileContent(file.content, AppState.currentEditingFile);
                MessageHandler.addMessage('system', '✏️ 編集モードに戻りました');
            }
            return;
        }

        const newEditMode = !AppState.isEditMode;
        
        // 編集モードを終了する際に差分をチェック
        if (AppState.isEditMode && !newEditMode) {
            const textarea = elements.fileContent.querySelector('textarea');
            if (textarea && AppState.originalContent !== null) {
                const currentContent = textarea.value;
                if (currentContent !== AppState.originalContent) {
                    // 変更があった場合は差分表示モードに切り替え
                    UIController.setDiffMode(true, AppState.originalContent, currentContent);
                    MessageHandler.addMessage('system', '📊 変更が検出されました。差分を確認してください');
                    return;
                }
            }
        }
        
        // 編集モードに入る際にオリジナルコンテンツを保存
        if (!AppState.isEditMode && newEditMode) {
            const files = mockFileSystem[AppState.currentPath] || [];
            const file = files.find(f => f.name === AppState.currentEditingFile);
            if (file) {
                AppState.setState({ originalContent: file.content });
            }
        }

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

    // FABメニューの開閉制御
    static toggleFabMenu() {
        const isMenuOpen = AppState.isFabMenuOpen || false;
        AppState.setState({ isFabMenuOpen: !isMenuOpen });
        
        elements.fabBtn.textContent = !isMenuOpen ? '×' : '+';
        elements.fabMenu.classList.toggle('show', !isMenuOpen);
        elements.fabMenuOverlay.classList.toggle('show', !isMenuOpen);
    }

    // FABメニュー項目クリック処理
    static handleFabMenuClick(e) {
        const menuItem = e.target.closest('.fab-menu-item');
        if (!menuItem) return;

        const action = menuItem.dataset.action;
        switch (action) {
            case 'create':
                UIController.showModal('createModal');
                break;
            case 'import':
                UIController.showModal('importModal');
                break;
            case 'system-prompt':
                UIController.showModal('systemPromptModal');
                break;
        }
        EventHandler.toggleFabMenu(); // メニューを閉じる
    }

    // ファイルインポート処理
    static async handleImport() {
        const files = elements.fileImportInput.files;
        const importPath = elements.importPathInput.value.trim();

        if (!files || files.length === 0) {
            MessageHandler.addMessage('system', '⚠️ インポートするファイルを選択してください');
            return;
        }

        elements.confirmImport.disabled = true;
        elements.confirmImport.textContent = 'インポート中...';

        try {
            let successCount = 0;
            const fileNames = [];

            for (const file of files) {
                const reader = new FileReader();
                const content = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsText(file);
                });

                const targetPath = importPath ? 
                    Utils.joinPath(importPath, file.name) : 
                    file.name;

                try {
                    await FileManager.createFile(targetPath, content);
                    fileNames.push(file.name);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to import ${file.name}:`, error);
                }
            }

            MessageHandler.addMessage('system', `📂 ${successCount}/${files.length} 個のファイルをインポートしました: ${fileNames.join(', ')}`);
            UIController.hideModal('importModal');
            await FileManager.loadFileList();

            // フォーム初期化
            elements.fileImportInput.value = '';
            elements.importPathInput.value = '';

        } catch (error) {
            MessageHandler.addMessage('system', `❌ インポートに失敗しました: ${error.message}`);
        } finally {
            elements.confirmImport.disabled = false;
            elements.confirmImport.textContent = 'インポート';
        }
    }

    // システムプロンプト登録処理
    static async handleSystemPrompt() {
        const name = elements.promptNameInput.value.trim();
        const content = elements.promptContentInput.value.trim();
        const description = elements.promptDescriptionInput.value.trim();

        if (!name || !content) {
            MessageHandler.addMessage('system', '⚠️ プロンプト名とプロンプト内容を入力してください');
            return;
        }

        elements.confirmSystemPrompt.disabled = true;
        elements.confirmSystemPrompt.textContent = '登録中...';

        try {
            const promptData = {
                id: Date.now().toString(),
                name: name,
                content: content,
                description: description,
                createdAt: new Date().toISOString()
            };

            // LocalStorageに保存
            let prompts = JSON.parse(localStorage.getItem('ai-file-manager-system-prompts') || '[]');
            prompts.push(promptData);
            localStorage.setItem('ai-file-manager-system-prompts', JSON.stringify(prompts));

            MessageHandler.addMessage('system', `🧠 システムプロンプト "${name}" を登録しました`);
            UIController.hideModal('systemPromptModal');

            // フォーム初期化
            elements.promptNameInput.value = '';
            elements.promptContentInput.value = '';
            elements.promptDescriptionInput.value = '';

        } catch (error) {
            MessageHandler.addMessage('system', `❌ プロンプト登録に失敗しました: ${error.message}`);
        } finally {
            elements.confirmSystemPrompt.disabled = false;
            elements.confirmSystemPrompt.textContent = '登録';
        }
    }
}