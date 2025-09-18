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

import { elements, mockFileSystem } from '../core/config.js';
import { AppState } from '../core/state.js';
import { Helpers } from '../utils/helpers.js';
import { FileViewController } from '../ui/file-view.js';
import { NavigationController } from '../ui/navigation.js';

export class FileManagerController {
    // ファイルリスト読み込み
    static async loadFileList() {
        elements.fileList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--accent-primary);">読み込み中...</div>';
        await Helpers.delay(300);

        let files = mockFileSystem[AppState.currentPath] || [];
        this.displayFiles(files);
        elements.currentPath.textContent = AppState.currentPath;

        NavigationController.setSelectionMode(false);
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

    static openFile(filename) {
        const files = mockFileSystem[AppState.currentPath] || [];
        const file = files.find(f => f.name === filename);

        if (!file || file.content === undefined) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `⚠️ ファイル "${filename}" を読み込めませんでした。`);
            }
            return;
        }

        // 新しいファイルを開く時は編集内容をクリア
        if (window.EventHandlers) {
            window.EventHandlers.currentEditingContent = null;
        }

        AppState.setState({
            currentEditingFile: filename,
            isEditMode: false
        });

        FileViewController.setFileViewMode(true);
        FileViewController.showFileContent(file.content, filename);

        if (window.MessageProcessor) {
            window.MessageProcessor.addMessage('system', `📖 "${filename}" を開きました。`);
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

    // ファイル作成
    static async createFile(filePath, content = '') {
        await Helpers.delay(500);

        const fullPath = filePath.startsWith('/') ? filePath : Helpers.joinPath(AppState.currentPath, filePath);
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
        await Helpers.delay(500);

        const fullPath = dirPath.startsWith('/') ? dirPath : Helpers.joinPath(AppState.currentPath, dirPath);
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
        const newDirPath = Helpers.joinPath(targetDirectoryPath, dirName);
        mockFileSystem[newDirPath] = [];

        return dirName;
    }

    // ファイル・ディレクトリコピー
    static async copyFile(sourcePath, destPath) {
        await Helpers.delay(500);

        const sourceFullPath = sourcePath.startsWith('/') ? sourcePath : Helpers.joinPath(AppState.currentPath, sourcePath);
        const destFullPath = destPath.startsWith('/') ? destPath : Helpers.joinPath(AppState.currentPath, destPath);

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
            const sourceDirPath = Helpers.joinPath(sourceDir, sourceFileName);
            const destDirPath = Helpers.joinPath(destDir, destFileName);
            mockFileSystem[destDirPath] = [];

            const sourceDirFiles = mockFileSystem[sourceDirPath] || [];
            for (const file of sourceDirFiles) {
                await this.copyFile(
                    Helpers.joinPath(sourceDirPath, file.name),
                    Helpers.joinPath(destDirPath, file.name)
                );
            }
        }

        return destFileName;
    }

    // ファイル・ディレクトリ移動
    static async moveFile(sourcePath, destPath) {
        await Helpers.delay(500);

        // First copy the file
        const destFileName = await this.copyFile(sourcePath, destPath);

        // Then delete the source
        await this.deleteFile(sourcePath);

        return destFileName;
    }

    // ファイル・ディレクトリ削除
    static async deleteFile(filePath) {
        await Helpers.delay(500);

        const fullPath = filePath.startsWith('/') ? filePath : Helpers.joinPath(AppState.currentPath, filePath);
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
            const dirPath = Helpers.joinPath(dir, fileName);
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
        await Helpers.delay(500);

        const textarea = elements.fileContent.querySelector('textarea');
        if (textarea) {
            const files = mockFileSystem[AppState.currentPath] || [];
            const fileIndex = files.findIndex(f => f.name === AppState.currentEditingFile);
            if (fileIndex !== -1) {
                files[fileIndex].content = textarea.value;
                
                // ファイルサイズ更新
                const sizeInBytes = new Blob([textarea.value]).size;
                files[fileIndex].size = this.formatFileSize(sizeInBytes);
                
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
        }

        elements.saveBtn.disabled = false;
    }
}

