/* =========================================
    ファイル操作管理
   ========================================= */

/*
## 概要
アプリケーション内のファイルシステムに対するCRUD操作およびファイル表示を管理するモジュール。

## 責任
- ファイルリストの読み込みとUI表示
- ファイルおよびディレクトリの作成、コピー、移動、削除
- ファイル内容の読み込みと保存
- ファイル選択（単一・複数）とクリックイベントのハンドリング
- ファイルアイコンの取得とファイルサイズのフォーマット
*/

import { elements, storageManager } from '../core/config.js';
import { AppState } from '../core/state.js';
import { Helpers } from '../utils/helpers.js';
import { FileEditor } from './file-editor.js';
import { NavigationController } from '../ui/navigation.js';

export class FileManagerController {
    // ファイルリスト読み込み（IndexedDB対応）
    static async loadFileList() {
        console.log('FileManagerController: Loading file list for path:', AppState.currentPath);
        elements.fileList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--accent-primary);">読み込み中...</div>';
        await Helpers.delay(300);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();
            const files = await adapter.listChildren(AppState.currentPath);
            this.displayFiles(files);
            elements.currentPath.textContent = AppState.currentPath;

            NavigationController.setSelectionMode(false);
        } catch (error) {
            console.error('Failed to load file list:', error);
            elements.fileList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--error);">ファイル一覧の読み込みに失敗しました</div>';
        }
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

    // ファイルアイテム作成
    static createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'file-item';

        const icon = this.getFileIcon(file);
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
        
        NavigationController.setSelectionMode(true, AppState.selectedFiles.length > 1);
    }

    // ファイル・ディレクトリクリック処理
    static async handleFileClick(file, event) {
        if (AppState.isSelectionMode) {
            // Ctrl/Cmd キーが押されていれば複数選択モード
            if (event.ctrlKey || event.metaKey) {
                AppState.setState({ isMultiSelectMode: true });
                this.selectFile(file, event.target.closest('.file-item'));
            } else {
                NavigationController.setSelectionMode(false);
            }
            return;
        }

        if (file.type === 'directory') {
            if (file.name === '..') {
                const pathParts = AppState.currentPath.split('/').filter(part => part);
                pathParts.pop();
                AppState.setState({ currentPath: '/' + pathParts.join('/') });
            } else {
                AppState.setState({ currentPath: Helpers.joinPath(AppState.currentPath, file.name) });
            }
            await this.loadFileList();
        } else {
            this.openFile(file.name);
        }
    }

    static async openFile(filename) {
        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();
            const filePath = Helpers.joinPath(AppState.currentPath, filename);

            const content = await adapter.readFile(filePath);

            // 新しいファイルを開く時は編集内容をクリア
            if (window.EventHandlers) {
                window.EventHandlers.currentEditingContent = null;
            }

            AppState.setState({
                currentEditingFile: filename,
                isEditMode: false
            });

            FileEditor.openFile(filename, content);

            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `📖 "${filename}" を開きました。`);
            }
        } catch (error) {
            console.error('Failed to open file:', error);
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `⚠️ ファイル "${filename}" を読み込めませんでした。`);
            }
        }
    }

    // ファイルアイコン取得
    static getFileIcon(file) {
        if (file.type === 'directory') return '📁';
        const ext = file.name.split('.').pop()?.toLowerCase();
        const icons = {
            'md': '📝', 'txt': '📄', 'json': '⚙️', 'js': '💛',
            'html': '🌐', 'css': '🎨', 'py': '🐍', 'jpg': '🖼️',
            'png': '🖼️', 'pdf': '📕', 'zip': '🗄️', 'doc': '📝',
            'xlsx': '📊', 'ppt': '📋'
        };
        return icons[ext] || '📄';
    }

    // ファイル作成（IndexedDB対応）
    static async createFile(filePath, content = '') {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const fullPath = filePath.startsWith('/') ? filePath : Helpers.joinPath(AppState.currentPath, filePath);

            // 既存ファイルの確認
            const existingFile = await adapter.getItem(fullPath);
            if (existingFile) {
                throw new Error(`ファイル "${filePath}" は既に存在します`);
            }

            // ファイル作成
            await adapter.createFile(fullPath, content);

            return filePath;
        } catch (error) {
            console.error('Failed to create file:', error);
            throw error;
        }
    }

    // ディレクトリ作成（IndexedDB対応）
    static async createDirectory(dirPath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const fullPath = dirPath.startsWith('/') ? dirPath : Helpers.joinPath(AppState.currentPath, dirPath);

            // 既存ディレクトリの確認
            const existingDir = await adapter.getItem(fullPath);
            if (existingDir) {
                throw new Error(`ディレクトリ "${dirPath}" は既に存在します`);
            }

            // ディレクトリ作成
            await adapter.createDirectory(fullPath);

            return dirPath;
        } catch (error) {
            console.error('Failed to create directory:', error);
            throw error;
        }    

    }

    // ファイル・ディレクトリコピー（IndexedDB対応）
    static async copyFile(sourcePath, destPath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const sourceFullPath = sourcePath.startsWith('/') ? sourcePath : Helpers.joinPath(AppState.currentPath, sourcePath);
            const destFullPath = destPath.startsWith('/') ? destPath : Helpers.joinPath(AppState.currentPath, destPath);

            // コピー元の存在確認
            const sourceItem = await adapter.getItem(sourceFullPath);
            if (!sourceItem) {
                throw new Error(`コピー元 "${sourcePath}" が見つかりません`);
            }

            // コピー先の重複確認
            const destItem = await adapter.getItem(destFullPath);
            if (destItem) {
                throw new Error(`コピー先 "${destPath}" は既に存在します`);
            }

            // コピー実行
            await adapter.copyItem(sourceFullPath, destFullPath);

            return destPath;
        } catch (error) {
            console.error('Failed to copy file:', error);
            throw error;
        }
    }

    // ファイル・ディレクトリ移動（IndexedDB対応）
    static async moveFile(sourcePath, destPath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const sourceFullPath = sourcePath.startsWith('/') ? sourcePath : Helpers.joinPath(AppState.currentPath, sourcePath);
            const destFullPath = destPath.startsWith('/') ? destPath : Helpers.joinPath(AppState.currentPath, destPath);

            // 移動元の存在確認
            const sourceItem = await adapter.getItem(sourceFullPath);
            if (!sourceItem) {
                throw new Error(`移動元 "${sourcePath}" が見つかりません`);
            }

            // 移動先の重複確認
            const destItem = await adapter.getItem(destFullPath);
            if (destItem) {
                throw new Error(`移動先 "${destPath}" は既に存在します`);
            }

            // 移動実行
            await adapter.moveItem(sourceFullPath, destFullPath);

            return destPath;
        } catch (error) {
            console.error('Failed to move file:', error);
            throw error;
        }
    }

    // ファイル・ディレクトリ削除（IndexedDB対応）
    static async deleteFile(filePath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const fullPath = filePath.startsWith('/') ? filePath : Helpers.joinPath(AppState.currentPath, filePath);

            // 削除対象の存在確認
            const item = await adapter.getItem(fullPath);
            if (!item) {
                throw new Error(`ファイル "${filePath}" が見つかりません`);
            }

            // 削除実行
            if (item.type === 'directory') {
                await adapter.deleteDirectory(fullPath);
            } else {
                await adapter.deleteFile(fullPath);
            }

            return item.name;
        } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
        }
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // FileEditor用のファイル保存メソッド
    static async saveFileContent(filename, content) {
        if (!filename) throw new Error('ファイル名が指定されていません');

        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const filePath = Helpers.joinPath(AppState.currentPath, filename);

            // ファイル更新（上書き）
            await adapter.createFile(filePath, content);

            return true;
        } catch (error) {
            console.error('Failed to save file content:', error);
            throw error;
        }
    }

    static async saveFile() {
        if (!AppState.currentEditingFile) return;

        elements.saveBtn.disabled = true;
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const textarea = elements.fileContent.querySelector('textarea');
            if (textarea) {
                const filePath = Helpers.joinPath(AppState.currentPath, AppState.currentEditingFile);

                // ファイル更新（上書き）
                await adapter.createFile(filePath, textarea.value);

                if (window.MessageProcessor) {
                    window.MessageProcessor.addMessage('system', `💾 ファイル "${AppState.currentEditingFile}" を保存しました`);
                }

                AppState.setState({
                    isContentModified: false,
                    originalContent: textarea.value
                });
                if (window.FileEditor) {
                    window.FileEditor.updateSaveButtonState();
                }

                if (!AppState.isEditMode) {
                    FileEditor.showFileContent(textarea.value, AppState.currentEditingFile);
                }
            }
        } catch (error) {
            console.error('Failed to save file:', error);
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `⚠️ ファイルの保存に失敗しました: ${error.message}`);
            }
        }

        elements.saveBtn.disabled = false;
    }
}

