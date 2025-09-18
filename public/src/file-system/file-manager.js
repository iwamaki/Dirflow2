/* =========================================
    ファイル操作管理
   ========================================= */

/*
## 概要
アプリケーション内のファイルシステム（モックデータ）に対するCRUD操作（作成、読み込み、更新、削除）およびファイル表示を管理するモジュール。ファイルリストの表示、ファイルアイコンの取得、ファイル選択、ファイル内容の保存などの機能を提供する。

## 主要機能
- **クラス**: FileManagerController (ファイルシステム操作と表示を制御する)
- **主要メソッド**:
  - `loadFileList()`: 現在のパスに基づいてファイルリストを読み込み、UIに表示する。
  - `displayFiles(files)`: 指定されたファイルリストをUIにレンダリングする。
  - `createFileItem(file)`: 個々のファイルまたはディレクトリのDOM要素を作成する。
  - `selectFile(file, itemElement)`: ファイルを選択状態にする（単一選択・複数選択対応）。
  - `handleFileClick(file, event)`: ファイルまたはディレクトリがクリックされた際の処理。ディレクトリの場合は移動、ファイルの場合は開く。
  - `openFile(filename)`: 指定されたファイルの内容を読み込み、ファイルビューに表示する。
  - `getFileIcon(file)`: ファイルの拡張子に基づいて適切なアイコン（絵文字）を返す。
  - `createFile(filePath, content)`: 指定されたパスに新しいファイルを作成する。中間ディレクトリも自動作成。
  - `createDirectory(dirPath)`: 指定されたパスに新しいディレクトリを作成する。中間ディレクトリも自動作成。
  - `copyFile(sourcePath, destPath)`: ファイルまたはディレクトリをコピーする。
  - `moveFile(sourcePath, destPath)`: ファイルまたはディレクトリを移動する（コピー後に元を削除）。
  - `deleteFile(filePath)`: 指定されたファイルまたはディレクトリを削除する。
  - `formatFileSize(bytes)`: バイト数を読みやすい形式（KB, MBなど）にフォーマットする。
  - `saveFile()`: 現在編集中のファイルの内容を保存する。

## 依存関係
- **インポート**:
  - `elements`, `mockFileSystem` (from '../core/config.js'): DOM要素参照とモックファイルシステムデータ。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `Helpers` (from '../utils/helpers.js'): ユーティリティ関数。
  - `FileViewController` (from '../ui/file-view.js'): ファイル内容表示制御。
  - `NavigationController` (from '../ui/navigation.js'): UIナビゲーション制御。
- **エクスポート**: FileManagerControllerクラス

## 特記事項
- モックファイルシステム: 実際のファイルシステムではなく、`mockFileSystem` オブジェクト（`config.js`で定義）を操作する。
- UIとの連携: `FileViewController` や `NavigationController` と密接に連携し、ファイル操作の結果をUIに反映させる。
- 複数選択と長押し: ユーザーがファイルを複数選択したり、長押しで操作メニューを表示したりする機能に対応。
- パス解決: 相対パスと絶対パスの両方に対応し、適切なファイルパスを解決する。
*/

import { elements, storageManager } from '../core/config.js';
import { AppState } from '../core/state.js';
import { Helpers } from '../utils/helpers.js';
import { FileViewController } from '../ui/file-view.js';
import { NavigationController } from '../ui/navigation.js';

export class FileManagerController {
    // ファイルリスト読み込み（IndexedDB対応）
    static async loadFileList() {
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

            FileViewController.setFileViewMode(true);
            FileViewController.showFileContent(content, filename);

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
                NavigationController.updateSaveButtonState();

                if (!AppState.isEditMode) {
                    FileViewController.showFileContent(textarea.value, AppState.currentEditingFile);
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

