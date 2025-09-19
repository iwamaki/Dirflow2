/* =========================================
    ファイル操作管理 (完全マージ版)
   ========================================= */

/*
## 概要
既存の実装を保持しつつ、IndexedDB完全移行に対応したファイル管理モジュール。

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
    
    // ===== 既存メソッド（更新版） =====

    /**
     * ファイルリスト読み込み（IndexedDB対応・UI改善版）
     */
    static async loadFileList() {
        console.log('FileManagerController: Loading file list for path:', AppState.currentPath);
        
        // 改善されたローディング表示
        elements.fileList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--accent-primary);">
                <div style="margin-bottom: 10px;">📂 読み込み中...</div>
                <div style="font-size: 0.9em; opacity: 0.7;">IndexedDB検索中</div>
            </div>
        `;
        
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
            elements.fileList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--error);">
                    <div style="margin-bottom: 10px;">❌ ファイル一覧の読み込みに失敗</div>
                    <div style="font-size: 0.9em; opacity: 0.8;">${error.message}</div>
                    <button onclick="FileManagerController.loadFileList()" 
                            style="margin-top: 10px; padding: 5px 15px; 
                                   background: var(--accent-primary); color: white; 
                                   border: none; border-radius: 4px; cursor: pointer;">
                        再試行
                    </button>
                </div>
            `;
        }
    }

    /**
     * ファイル表示（UI改善版）
     */
    static displayFiles(files) {
        elements.fileList.innerHTML = '';

        // 上位ディレクトリへのナビゲーション
        if (AppState.currentPath !== '/workspace') {
            const parentItem = this.createFileItem({ 
                name: '..', 
                type: 'directory', 
                size: '',
                isParent: true 
            });
            elements.fileList.appendChild(parentItem);
        }

        // ファイル・フォルダが存在しない場合
        if (files.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-folder-message';
            emptyMessage.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
                    <div style="font-size: 3em; margin-bottom: 15px;">📁</div>
                    <div style="margin-bottom: 10px; font-weight: 500;">このフォルダは空です</div>
                    <div style="font-size: 0.9em; opacity: 0.8;">
                        AIに話しかけてファイルやフォルダを作成しましょう！<br>
                        例：「新しいファイルを作って」「docs フォルダを作成して」
                    </div>
                </div>
            `;
            elements.fileList.appendChild(emptyMessage);
            return;
        }

        // ファイル・フォルダの表示
        files.forEach(file => {
            const fileItem = this.createFileItem(file);
            elements.fileList.appendChild(fileItem);
        });

        // 統計情報の表示
        this._displayFolderStats(files);
    }

    /**
     * ファイルアイテム作成（既存のcreateFileItemを改善）
     */
    static createFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        if (file.isParent) {
            fileItem.classList.add('parent-directory');
        }

        const icon = this.getFileIcon(file);
        const size = file.type === 'directory' ? '' : this.formatFileSize(file.size || 0);
        const modifiedAt = file.modifiedAt ? 
            new Date(file.modifiedAt).toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'short', day: 'numeric'
            }) : '';

        fileItem.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-info">
                <div class="file-name">${Helpers.escapeHtml ? Helpers.escapeHtml(file.name) : file.name}</div>
                ${file.type === 'file' && size ? `<div class="file-details">${size} • ${modifiedAt}</div>` : ''}
                ${file.type === 'directory' && modifiedAt ? `<div class="file-details">${modifiedAt}</div>` : ''}
            </div>
        `;

        // イベントリスナー（既存の動作を維持）
        fileItem.addEventListener('click', (e) => {
            this.handleFileClick(file);
        });

        return fileItem;
    }

    /**
     * ファイルクリック処理（既存ロジック維持）
     */
    static async handleFileClick(file) {
        // 選択モード中の処理
        if (AppState.isSelectionMode && !file.isParent) {
            NavigationController.setSelectionMode(false);
            return;
        }

        // ナビゲーション処理
        if (file.type === 'directory') {
            if (file.name === '..') {
                const pathParts = AppState.currentPath.split('/').filter(part => part);
                pathParts.pop();
                AppState.setState({ currentPath: '/' + pathParts.join('/') });
            } else {
                AppState.setState({ 
                    currentPath: Helpers.joinPath(AppState.currentPath, file.name) 
                });
            }
            await this.loadFileList();
        } else {
            this.openFile(file.name);
        }
    }

    /**
     * ファイルを開く（既存ロジック維持）
     */
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

    /**
     * ファイルアイコン取得（既存ロジック拡張）
     */
    static getFileIcon(file) {
        if (file.name === '..') return '⬆️';
        if (file.type === 'directory') return '📁';
        
        const ext = file.name.split('.').pop()?.toLowerCase();
        const icons = {
            // 既存のアイコン
            'md': '📝', 'txt': '📄', 'json': '⚙️', 'js': '💛',
            'html': '🌐', 'css': '🎨', 'py': '🐍', 'jpg': '🖼️',
            'png': '🖼️', 'pdf': '📕', 'zip': '🗄️', 'doc': '📝',
            'xlsx': '📊', 'ppt': '📋',
            // 追加のアイコン
            'ts': '🔷', 'jsx': '⚛️', 'tsx': '⚛️', 'yml': '⚙️', 'yaml': '⚙️',
            'ini': '⚙️', 'conf': '⚙️', 'java': '☕', 'c': '🔧', 'cpp': '🔧',
            'php': '🐘', 'rb': '💎', 'go': '🐹', 'rs': '🦀', 'webp': '🖼️'
        };
        return icons[ext] || '📄';
    }

    // ===== CRUD操作（既存メソッドを完全保持） =====

    /**
     * ファイル作成（既存ロジック維持）
     */
    static async createFile(filePath, content = '') {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const fullPath = filePath.startsWith('/') ? filePath : 
                Helpers.joinPath(AppState.currentPath, filePath);

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

    /**
     * ディレクトリ作成（既存ロジック維持）
     */
    static async createDirectory(dirPath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const fullPath = dirPath.startsWith('/') ? dirPath : 
                Helpers.joinPath(AppState.currentPath, dirPath);

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

    /**
     * ファイル・ディレクトリコピー（既存ロジック維持）
     */
    static async copyFile(sourcePath, destPath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const sourceFullPath = sourcePath.startsWith('/') ? sourcePath : 
                Helpers.joinPath(AppState.currentPath, sourcePath);
            const destFullPath = destPath.startsWith('/') ? destPath : 
                Helpers.joinPath(AppState.currentPath, destPath);

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

    /**
     * ファイル・ディレクトリ移動（既存ロジック維持）
     */
    static async moveFile(sourcePath, destPath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const sourceFullPath = sourcePath.startsWith('/') ? sourcePath : 
                Helpers.joinPath(AppState.currentPath, sourcePath);
            const destFullPath = destPath.startsWith('/') ? destPath : 
                Helpers.joinPath(AppState.currentPath, destPath);

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

    /**
     * ファイル・ディレクトリ削除（既存ロジック維持）
     */
    static async deleteFile(filePath) {
        await Helpers.delay(500);

        try {
            await storageManager.ensureInitialized();
            const adapter = storageManager.getAdapter();

            const fullPath = filePath.startsWith('/') ? filePath : 
                Helpers.joinPath(AppState.currentPath, filePath);

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

    /**
     * ファイルサイズフォーマット（既存ロジック維持）
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * FileEditor用のファイル保存メソッド（既存ロジック維持）
     */
    static async saveFileContent(filename, content) {
        if (!filename) {
            throw new Error('ファイル名が指定されていません');
        }

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

    /**
     * ファイル保存（既存ロジック維持）
     */
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

    // ===== 新機能追加 =====

    /**
     * フォルダ統計情報表示（新機能）
     */
    static _displayFolderStats(files) {
        const fileCount = files.filter(f => f.type === 'file').length;
        const folderCount = files.filter(f => f.type === 'directory').length;
        const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

        if (fileCount === 0 && folderCount === 0) return;

        const statsElement = document.createElement('div');
        statsElement.className = 'folder-stats';
        statsElement.style.cssText = `
            padding: 10px 15px;
            margin: 10px 0;
            background: var(--bg-secondary);
            border-radius: 6px;
            font-size: 0.85em;
            color: var(--text-secondary);
            display: flex;
            justify-content: space-between;
            border: 1px solid var(--border);
        `;

        statsElement.innerHTML = `
            <span>📊 ${folderCount}個のフォルダ, ${fileCount}個のファイル</span>
            <span>💾 ${this.formatFileSize(totalSize)}</span>
        `;

        elements.fileList.appendChild(statsElement);
    }
}
