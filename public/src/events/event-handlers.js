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

import { elements, storageManager } from '../core/config.js';
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
        elements.backBtn?.addEventListener('click', () => FileEditor.setFileViewMode(false));
        elements.editBtn?.addEventListener('click', this.toggleEditMode);
        elements.saveBtn?.addEventListener('click', this.handleSaveClick);
        elements.settingsBtn?.addEventListener('click', () => ModalController.showModal('settingsModal'));

        // チャット
        elements.sendBtn?.addEventListener('click', () => MessageProcessor.sendMessage());
        elements.chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !AppState.isLoading) MessageProcessor.sendMessage();
        });
        elements.chatInput?.addEventListener('focus', () => {
            if (!AppState.isChatOpen) NavigationController.toggleChat();
        });
        elements.chatCloseBtn?.addEventListener('click', () => NavigationController.toggleChat());

        // FAB メニュー
        elements.fabBtn.addEventListener('click', this.toggleFabMenu);
        elements.fabMenuOverlay.addEventListener('click', this.toggleFabMenu);
        elements.fabMenu.addEventListener('click', this.handleFabMenuClick);

        // FAB アクション
        elements.fabNewFile?.addEventListener('click', () => ModalController.showModal('fileModal'));
        elements.fabNewFolder?.addEventListener('click', this.handleCreateFolder);
        elements.fabImport?.addEventListener('click', () => ModalController.showModal('importModal'));
        elements.fabChat?.addEventListener('click', () => NavigationController.toggleChat());

        // モーダルイベント
        elements.createFileBtn?.addEventListener('click', this.handleCreateFile);
        elements.confirmRename?.addEventListener('click', this.handleRename);
        elements.confirmImport?.addEventListener('click', this.handleImportFiles);

        // プロンプト管理
        elements.promptToggleBtn?.addEventListener('click', () => PromptUIController.toggleDrawer());
        elements.promptOverlay?.addEventListener('click', () => PromptUIController.closeDrawer());
        elements.confirmSystemPrompt?.addEventListener('click', this.handleSystemPrompt);

        // キーボードイベント
        document.addEventListener('keydown', this.handleKeyDown);

        // モーダルを閉じるボタンのイベントリスナー
        document.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal, .chat-overlay'); // .chat-overlay もモーダルとして扱う
                if (modal) {
                    ModalController.hideModal(modal.id);
                }
            });
        });

        // data-modal="close" を持つボタンのイベントリスナー
        document.querySelectorAll('[data-modal="close"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    ModalController.hideModal(modal.id);
                }
            });
        });

        console.log('✅ Event handlers initialized');
    }

    // クリーンアップメソッド（アプリ再起動時用）
    static cleanup() {
        // イベントリスナーのクリーンアップ（必要に応じて）
        console.log('🧹 Event handlers cleanup');
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

    // 保存ボタンクリック処理
    static handleSaveClick() {
        console.log('Save button clicked');
        FileEditor.saveFile();
    }

    // キーボードイベント処理
    static handleKeyDown(e) {
        // ESCキーでモーダルやチャットを閉じる
        if (e.key === 'Escape') {
            if (AppState.isChatOpen) {
                NavigationController.toggleChat();
            } else if (AppState.isFabOpen) {
                NavigationController.setFabOpen(false);
            } else {
                ModalController.hideAllModals();
                PromptUIController.closeDrawer();
            }
        }

        // Ctrl+S でファイル保存（ブラウザのデフォルト保存を無効化）
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (AppState.currentEditingFile) {
                EventHandlers.handleSaveClick();
            }
        }
    }

    // ファイル作成処理
    static async handleCreateFile() {
        const fileName = elements.fileNameInput?.value.trim();
        const initialContent = elements.fileContentInput?.value || '';

        if (!fileName) {
            MessageProcessor.addMessage('system', '⚠️ ファイル名を入力してください');
            return;
        }

        // ファイル名の妥当性チェック
        if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
            MessageProcessor.addMessage('system', '⚠️ ファイル名には英数字、ピリオド、ハイフン、アンダースコアのみ使用できます');
            return;
        }

        elements.confirmFile.disabled = true;
        elements.confirmFile.textContent = '作成中...';

        try {
            await FileManagerController.createFile(fileName, initialContent);
            MessageProcessor.addMessage('system', `✅ ファイル "${fileName}" を作成しました`);
            
            ModalController.hideModal('fileModal');
            await FileManagerController.loadFileList();
            
            // フォームリセット
            elements.fileNameInput.value = '';
            elements.fileContentInput.value = '';

        } catch (error) {
            console.error('File creation failed:', error);
            MessageProcessor.addMessage('system', `❌ ファイル作成に失敗しました: ${error.message}`);
        } finally {
            elements.confirmFile.disabled = false;
            elements.confirmFile.textContent = '作成';
        }
    }

    // フォルダ作成処理
    static async handleCreateFolder() {
        const folderName = prompt('フォルダ名を入力してください:');
        
        if (!folderName || !folderName.trim()) {
            return;
        }

        const trimmedName = folderName.trim();

        // フォルダ名の妥当性チェック
        if (!/^[a-zA-Z0-9._-]+$/.test(trimmedName)) {
            MessageProcessor.addMessage('system', '⚠️ フォルダ名には英数字、ピリオド、ハイフン、アンダースコアのみ使用できます');
            return;
        }

        try {
            await FileManagerController.createDirectory(trimmedName);
            MessageProcessor.addMessage('system', `✅ フォルダ "${trimmedName}" を作成しました`);
            await FileManagerController.loadFileList();

        } catch (error) {
            console.error('Folder creation failed:', error);
            MessageProcessor.addMessage('system', `❌ フォルダ作成に失敗しました: ${error.message}`);
        }
    }

    // ファイルリネーム処理
    static async handleRename() {
        const oldFileName = elements.renameOldName?.textContent;
        const newFileName = elements.renameNewNameInput?.value.trim();

        if (!oldFileName || !newFileName) {
            MessageProcessor.addMessage('system', '⚠️ 新しいファイル名を入力してください');
            return;
        }

        if (oldFileName === newFileName) {
            ModalController.hideModal('renameModal');
            return;
        }

        // ファイル名の妥当性チェック
        if (!/^[a-zA-Z0-9._-]+$/.test(newFileName)) {
            MessageProcessor.addMessage('system', '⚠️ ファイル名には英数字、ピリオド、ハイフン、アンダースコアのみ使用できます');
            return;
        }

        elements.confirmRename.disabled = true;
        elements.confirmRename.textContent = 'リネーム中...';

        try {
            await FileManagerController.moveFile(oldFileName, newFileName);
            MessageProcessor.addMessage('system', `✅ "${oldFileName}" を "${newFileName}" にリネームしました`);
            
            ModalController.hideModal('renameModal');
            await FileManagerController.loadFileList();

        } catch (error) {
            console.error('Rename failed:', error);
            MessageProcessor.addMessage('system', `❌ リネームに失敗しました: ${error.message}`);
        } finally {
            elements.confirmRename.disabled = false;
            elements.confirmRename.textContent = 'リネーム';
        }
    }

    // ファイルインポート処理
    static async handleImportFiles() {
        const files = elements.fileImportInput?.files;
        const importPath = elements.importPathInput?.value.trim() || AppState.currentPath;

        if (!files || files.length === 0) {
            MessageProcessor.addMessage('system', '⚠️ インポートするファイルを選択してください');
            return;
        }

        elements.confirmImport.disabled = true;
        elements.confirmImport.textContent = 'インポート中...';

        let successCount = 0;
        const fileNames = [];

        try {
            await storageManager.ensureInitialized();

            for (const file of files) {
                // ファイル名の妥当性チェック
                if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
                    console.warn(`Skipping invalid filename: ${file.name}`);
                    continue;
                }

                const content = await this._readFileAsText(file);
                const targetPath = importPath.startsWith('/') ? 
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

            MessageProcessor.addMessage('system', 
                `📂 ${successCount}/${files.length} 個のファイルをインポートしました: ${fileNames.join(', ')}`);
            
            ModalController.hideModal('importModal');
            await FileManagerController.loadFileList();

            // フォームリセット
            elements.fileImportInput.value = '';
            elements.importPathInput.value = '';

        } catch (error) {
            console.error('Import failed:', error);
            MessageProcessor.addMessage('system', `❌ インポートに失敗しました: ${error.message}`);
        } finally {
            elements.confirmImport.disabled = false;
            elements.confirmImport.textContent = 'インポート';
        }
    }

    // ファイルをテキストとして読み込むヘルパーメソッド
    static _readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`ファイル読み込みエラー: ${e.target.error}`));
            reader.readAsText(file, 'UTF-8');
        });
    }

    // システムプロンプト登録・更新処理
    static async handleSystemPrompt() {
        const name = elements.promptNameInput?.value.trim();
        const content = elements.promptContentInput?.value.trim();
        const description = elements.promptDescriptionInput?.value.trim();

        if (!name || !content) {
            MessageProcessor.addMessage('system', '⚠️ プロンプト名とプロンプト内容を入力してください');
            return;
        }

        elements.confirmSystemPrompt.disabled = true;
        const originalText = elements.confirmSystemPrompt.textContent;
        elements.confirmSystemPrompt.textContent = originalText === '更新' ? '更新中...' : '登録中...';

        try {
            // プロンプトマネージャーを使用してプロンプトを保存
            const isUpdate = SystemPromptManager.currentEditingPromptId !== null;
            
            if (isUpdate) {
                SystemPromptManager.updatePrompt(SystemPromptManager.currentEditingPromptId, {
                    name,
                    content,
                    description
                });
            } else {
                SystemPromptManager.addPrompt(name, content, description);
            }

            MessageProcessor.addMessage('system', 
                `✅ システムプロンプト "${name}" を${isUpdate ? '更新' : '登録'}しました`);

            // UI更新
            if (window.PromptUIController) {
                PromptUIController.updatePromptsList();
            }

            // フォームリセット
            elements.promptNameInput.value = '';
            elements.promptContentInput.value = '';
            elements.promptDescriptionInput.value = '';
            elements.confirmSystemPrompt.textContent = '登録';
            SystemPromptManager.currentEditingPromptId = null;

        } catch (error) {
            console.error('System prompt save failed:', error);
            MessageProcessor.addMessage('system', 
                `❌ システムプロンプトの${originalText === '更新' ? '更新' : '登録'}に失敗しました: ${error.message}`);
        } finally {
            elements.confirmSystemPrompt.disabled = false;
            elements.confirmSystemPrompt.textContent = originalText;
        }
    }

    // 削除確認ダイアログ
    static async showDeleteConfirmation(fileName) {
        const confirmed = confirm(`"${fileName}" を削除してもよろしいですか？\nこの操作は取り消せません。`);
        
        if (confirmed) {
            try {
                await FileManagerController.deleteFile(fileName);
                MessageProcessor.addMessage('system', `🗑️ "${fileName}" を削除しました`);
                await FileManagerController.loadFileList();
            } catch (error) {
                console.error('Delete failed:', error);
                MessageProcessor.addMessage('system', `❌ 削除に失敗しました: ${error.message}`);
            }
        }
    }

    // バルク操作（複数ファイルの一括処理）
    static async handleBulkDelete() {
        if (AppState.selectedFiles.length === 0) {
            MessageProcessor.addMessage('system', '⚠️ 削除するファイルを選択してください');
            return;
        }

        const confirmed = confirm(
            `選択した${AppState.selectedFiles.length}個のファイルを削除してもよろしいですか？\nこの操作は取り消せません。`
        );

        if (!confirmed) return;

        let successCount = 0;
        const errors = [];

        for (const fileName of AppState.selectedFiles) {
            try {
                await FileManagerController.deleteFile(fileName);
                successCount++;
            } catch (error) {
                errors.push(`${fileName}: ${error.message}`);
            }
        }

        // 結果報告
        if (successCount > 0) {
            MessageProcessor.addMessage('system', `🗑️ ${successCount}個のファイルを削除しました`);
        }
        
        if (errors.length > 0) {
            MessageProcessor.addMessage('system', `❌ 削除に失敗: ${errors.join(', ')}`);
        }

        // 選択モードを終了してリストを更新
        NavigationController.setSelectionMode(false);
        await FileManagerController.loadFileList();
    }
}
