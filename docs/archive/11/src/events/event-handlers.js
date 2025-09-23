/* =========================================
    イベント処理統合
   ========================================= */

/*
## 概要
アプリケーション内の様々なUI要素からのイベントを一元的に処理し、対応する機能を呼び出すクラス。

## 責任
- アプリケーション起動時の主要なイベントリスナーの設定
- ファイル操作（保存、編集モード切り替え、作成、リネーム、インポート、削除など）のハンドリング
- FABメニュー、モーダル、プロンプト管理ドロワーの表示/非表示制御
- キーボードイベント（ESCキーなど）の処理
*/

import { elements, mockFileSystem } from '../core/config.js';
import { AppState, SystemPromptManager } from '../core/state.js';
import { Helpers } from '../utils/helpers.js';
import { NavigationController } from '../ui/navigation.js';
import { ModalController } from '../ui/modals.js';
import { FileEditor } from '../file-system/file-editor.js';
import { FileManagerController } from '../file-system/file-manager.js';
import { MessageProcessor } from '../api/message-processor.js';
import { PromptUIController } from '../prompts/prompt-ui.js';

// イベントハンドラー設定
export class EventHandlers {
    static init() {
        // ヘッダーボタン
        elements.backBtn.addEventListener('click', () => FileEditor.setFileViewMode(false));
        elements.editBtn.addEventListener('click', this.toggleEditMode);
        elements.saveBtn.addEventListener('click', this.handleSaveClick);
        elements.settingsBtn.addEventListener('click', () => ModalController.showModal('settingsModal'));

        // チャット
        elements.sendBtn.addEventListener('click', () => MessageProcessor.sendMessage());
        elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !AppState.isLoading) MessageProcessor.sendMessage();
        });
        elements.chatInput.addEventListener('focus', () => {
            if (!AppState.isChatOpen) NavigationController.toggleChat();
        });
        elements.chatCloseBtn.addEventListener('click', () => NavigationController.toggleChat());

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
        
        // システムプロンプト管理関連
        elements.promptMenuBtn.addEventListener('click', this.togglePromptDrawer);
        elements.drawerCloseBtn.addEventListener('click', () => PromptUIController.toggleDrawer(false));
        elements.drawerOverlay.addEventListener('click', () => PromptUIController.toggleDrawer(false));
        
        // ドロワーメニュー項目
        document.querySelectorAll('.drawer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                if (section) {
                    PromptUIController.switchSection(section);
                }
            });
        });

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
                        NavigationController.toggleChat();
                    }
                }
            });
        });

        // ESCキー
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                ModalController.hideAllModals();
                if (AppState.isSelectionMode) NavigationController.setSelectionMode(false);
                if (AppState.isFileViewMode) FileViewController.setFileViewMode(false);
                if (AppState.isChatOpen) NavigationController.toggleChat();
                if (AppState.isPromptDrawerOpen) PromptUIController.toggleDrawer(false);
            }
        });
    }

    // プロンプトドロワー切り替え
    static togglePromptDrawer() {
        PromptUIController.toggleDrawer();
    }

    // 保存ボタンクリック処理
    static handleSaveClick() {
        console.log('Save button clicked');
        FileEditor.saveFile();
    }

    // 編集中の内容を一時保持する変数（シンプルなアプローチ）
    static currentEditingContent = null;

    // 編集モード切り替え
    static toggleEditMode() {
        // 差分モードの場合は編集モードに戻る
        if (AppState.isDiffMode) {
            FileEditor.switchToEditMode();
            MessageProcessor.addMessage('system', '✏️ 編集モードに戻りました');
            return;
        }

        const newEditMode = !AppState.isEditMode;

        if (newEditMode) {
            FileEditor.switchToEditMode();
            MessageProcessor.addMessage('system', '✏️ 編集モードに切り替えました');
        } else {
            FileEditor.switchToPreviewMode();
            MessageProcessor.addMessage('system', '👁️ プレビューモードに切り替えました');
        }
    }

    // オリジナルファイル内容を取得
    static getOriginalFileContent() {
        const files = mockFileSystem[AppState.currentPath] || [];
        const file = files.find(f => f.name === AppState.currentEditingFile);
        return file ? file.content : '';
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
                        await FileManagerController.copyFile(selectedFiles[0].name, copyDestination);
                        MessageProcessor.addMessage('system', `📋 "${selectedFiles[0].name}" を "${copyDestination}" にコピーしました`);
                        await FileManagerController.loadFileList();
                    } catch (error) {
                        MessageProcessor.addMessage('system', `❌ コピーに失敗: ${error.message}`);
                    }
                }
                break;

            case 'move':
                const moveDestination = prompt('移動先のパスを入力してください:', `${AppState.currentPath}/${selectedFiles[0].name}`);
                if (moveDestination) {
                    try {
                        await FileManagerController.moveFile(selectedFiles[0].name, moveDestination);
                        MessageProcessor.addMessage('system', `🔄 "${selectedFiles[0].name}" を "${moveDestination}" に移動しました`);
                        await FileManagerController.loadFileList();
                    } catch (error) {
                        MessageProcessor.addMessage('system', `❌ 移動に失敗: ${error.message}`);
                    }
                }
                break;

            case 'rename':
                elements.renameInput.value = selectedFiles[0].name;
                ModalController.showModal('renameModal');
                setTimeout(() => elements.renameInput.focus(), 100);
                return;

            case 'delete':
                if (confirm(`"${selectedFiles[0].name}" を削除しますか？`)) {
                    try {
                        await FileManagerController.deleteFile(selectedFiles[0].name);
                        MessageProcessor.addMessage('system', `🗑️ "${selectedFiles[0].name}" を削除しました`);
                        await FileManagerController.loadFileList();
                    } catch (error) {
                        MessageProcessor.addMessage('system', `❌ 削除に失敗: ${error.message}`);
                    }
                }
                break;

            case 'batch_copy':
                const batchCopyDest = prompt('一括コピー先のフォルダパスを入力してください:', `${AppState.currentPath}/copied`);
                if (batchCopyDest) {
                    let successCount = 0;
                    for (const file of selectedFiles) {
                        try {
                            const destPath = Helpers.joinPath(batchCopyDest, file.name);
                            await FileManagerController.copyFile(file.name, destPath);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to copy ${file.name}:`, error);
                        }
                    }
                    MessageProcessor.addMessage('system', `📋 一括コピー完了: ${successCount}/${selectedFiles.length} 件`);
                    await FileManagerController.loadFileList();
                }
                break;

            case 'batch_move':
                const batchMoveDest = prompt('一括移動先のフォルダパスを入力してください:', `${AppState.currentPath}/moved`);
                if (batchMoveDest) {
                    let successCount = 0;
                    for (const file of selectedFiles) {
                        try {
                            const destPath = Helpers.joinPath(batchMoveDest, file.name);
                            await FileManagerController.moveFile(file.name, destPath);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to move ${file.name}:`, error);
                        }
                    }
                    MessageProcessor.addMessage('system', `🔄 一括移動完了: ${successCount}/${selectedFiles.length} 件`);
                    await FileManagerController.loadFileList();
                }
                break;

            case 'batch_delete':
                const fileNames = selectedFiles.map(f => f.name).join(', ');
                if (confirm(`選択した ${selectedFiles.length} 個のファイル (${fileNames}) を削除しますか？`)) {
                    let successCount = 0;
                    for (const file of selectedFiles) {
                        try {
                            await FileManagerController.deleteFile(file.name);
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to delete ${file.name}:`, error);
                        }
                    }
                    MessageProcessor.addMessage('system', `🗑️ 一括削除完了: ${successCount}/${selectedFiles.length} 件`);
                    await FileManagerController.loadFileList();
                }
                break;
        }
        NavigationController.setSelectionMode(false);
    }

    // ファイル作成処理
    static async handleCreateFile() {
        const filePath = elements.filePathInput.value.trim();
        const content = elements.fileContentInput.value;

        if (!filePath) {
            MessageProcessor.addMessage('system', '⚠️ ファイルパスを入力してください');
            return;
        }

        elements.createFileBtn.disabled = true;
        elements.createFileBtn.textContent = '作成中...';

        try {
            // ファイルかディレクトリかを判定（拡張子があるかどうか）
            const hasExtension = filePath.includes('.') && !filePath.endsWith('/');
            
            if (hasExtension) {
                const fileName = await FileManagerController.createFile(filePath, content);
                MessageProcessor.addMessage('system', `✅ ファイル "${fileName}" を作成しました`);
            } else {
                const dirName = await FileManagerController.createDirectory(filePath);
                MessageProcessor.addMessage('system', `✅ ディレクトリ "${dirName}" を作成しました`);
            }
            
            ModalController.hideModal('createModal');
            await FileManagerController.loadFileList();

            elements.filePathInput.value = '';
            elements.fileContentInput.value = '';
        } catch (error) {
            MessageProcessor.addMessage('system', `❌ 作成に失敗しました: ${error.message}`);
        } finally {
            elements.createFileBtn.disabled = false;
            elements.createFileBtn.textContent = '作成';
        }
    }

    // 名前変更処理
    static async handleRename() {
        const newName = elements.renameInput.value.trim();

        if (!newName) {
            MessageProcessor.addMessage('system', '⚠️ 新しい名前を入力してください');
            return;
        }

        if (AppState.selectedFiles.length === 0) return;

        const selectedFile = AppState.selectedFiles[0];
        const files = mockFileSystem[AppState.currentPath] || [];
        const existingFile = files.find(f => f.name === newName);

        if (existingFile && existingFile !== selectedFile) {
            MessageProcessor.addMessage('system', '⚠️ その名前のファイルは既に存在します');
            return;
        }

        const fileIndex = files.findIndex(f => f.name === selectedFile.name);
        if (fileIndex !== -1) {
            const oldName = files[fileIndex].name;
            files[fileIndex].name = newName;
            
            // ディレクトリの場合、mockFileSystemのキーも更新
            if (files[fileIndex].type === 'directory') {
                const oldDirPath = Helpers.joinPath(AppState.currentPath, oldName);
                const newDirPath = Helpers.joinPath(AppState.currentPath, newName);
                if (mockFileSystem[oldDirPath]) {
                    mockFileSystem[newDirPath] = mockFileSystem[oldDirPath];
                    delete mockFileSystem[oldDirPath];
                }
            }
            
            MessageProcessor.addMessage('system', `✏️ "${oldName}" を "${newName}" に名前変更しました`);
            await FileManagerController.loadFileList();
        }

        ModalController.hideModal('renameModal');
        NavigationController.setSelectionMode(false);
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
                ModalController.showModal('createModal');
                break;
            case 'import':
                ModalController.showModal('importModal');
                break;
            case 'system-prompt':
                ModalController.showModal('systemPromptModal');
                break;
        }
        EventHandlers.toggleFabMenu(); // メニューを閉じる
    }

    // ファイルインポート処理
    static async handleImport() {
        const files = elements.fileImportInput.files;
        const importPath = elements.importPathInput.value.trim();

        if (!files || files.length === 0) {
            MessageProcessor.addMessage('system', '⚠️ インポートするファイルを選択してください');
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
                    Helpers.joinPath(importPath, file.name) : 
                    file.name;

                try {
                    await FileManagerController.createFile(targetPath, content);
                    fileNames.push(file.name);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to import ${file.name}:`, error);
                }
            }

            MessageProcessor.addMessage('system', `📂 ${successCount}/${files.length} 個のファイルをインポートしました: ${fileNames.join(', ')}`);
            ModalController.hideModal('importModal');
            await FileManagerController.loadFileList();

            // フォーム初期化
            elements.fileImportInput.value = '';
            elements.importPathInput.value = '';

        } catch (error) {
            MessageProcessor.addMessage('system', `❌ インポートに失敗しました: ${error.message}`);
        } finally {
            elements.confirmImport.disabled = false;
            elements.confirmImport.textContent = 'インポート';
        }
    }

    // システムプロンプト登録・更新処理
    static async handleSystemPrompt() {
        const name = elements.promptNameInput.value.trim();
        const content = elements.promptContentInput.value.trim();
        const description = elements.promptDescriptionInput.value.trim();

        if (!name || !content) {
            MessageProcessor.addMessage('system', '⚠️ プロンプト名とプロンプト内容を入力してください');
            return;
        }

        elements.confirmSystemPrompt.disabled = true;
        const originalText = elements.confirmSystemPrompt.textContent;
        elements.confirmSystemPrompt.textContent = originalText === '更新' ? '更新中...' : '登録中...';

        try {
            const isEditing = elements.confirmSystemPrompt.dataset.editId;
            
            if (isEditing) {
                // 編集モード
                const updatedPrompt = SystemPromptManager.updatePrompt(isEditing, {
                    name: name,
                    content: content,
                    description: description
                });
                
                MessageProcessor.addMessage('system', `🧠 システムプロンプト "${name}" を更新しました`);
                
                // 編集モードクリア
                delete elements.confirmSystemPrompt.dataset.editId;
                elements.confirmSystemPrompt.textContent = '登録';
            } else {
                // 新規登録モード
                const newPrompt = SystemPromptManager.savePrompt({
                    name: name,
                    content: content,
                    description: description
                });

                MessageProcessor.addMessage('system', `🧠 システムプロンプト "${name}" を登録しました`);
            }

            ModalController.hideModal('systemPromptModal');

            // フォーム初期化
            elements.promptNameInput.value = '';
            elements.promptContentInput.value = '';
            elements.promptDescriptionInput.value = '';

            // プロンプト一覧を更新（管理セクションが開いていれば）
            if (AppState.currentPromptSection === 'manage') {
                PromptUIController.refreshPromptList();
            }

        } catch (error) {
            MessageProcessor.addMessage('system', `❌ プロンプト${originalText === '更新' ? '更新' : '登録'}に失敗しました: ${error.message}`);
        } finally {
            elements.confirmSystemPrompt.disabled = false;
            elements.confirmSystemPrompt.textContent = originalText;
        }
    }
}

