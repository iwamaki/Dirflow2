/* =========================================
    メッセージ処理・コマンド実行 (IndexedDB完全移行版)
   ========================================= */

/*
## 概要
ユーザーメッセージの送信、AI応答の受信、コマンド実行、メッセージ表示を担当するクラス（完全移行版）。

## 責任
- UIへのメッセージ表示
- ユーザーメッセージの送信とAI応答の処理
- AIから受け取ったコマンドの実行とバリデーション
- ファイルシステム操作（読み込み、編集、一覧表示など）
- アプリケーションのローディング状態管理
*/

import { elements, storageManager } from '../core/config.js';
import { AppState, ConversationHistory, SystemPromptManager } from '../core/state.js';
import { MarkdownUtils } from '../utils/markdown.js';
import { APIClient } from './client.js';
import { FileManagerController } from '../file-system/file-manager.js';
import { FileEditor } from '../file-system/file-editor.js';

/* メッセージ処理クラス
ユーザーメッセージの送信、AI応答の受信、コマンド実行、メッセージ表示を担当
*/

export class MessageProcessor {

    // メッセージ表示（改善版）
    static addMessage(type, content) {
        // UIに表示すべきシステムメッセージのキーワード
        const uiKeywords = ['❌', 'エラー', 'error', '⚠️', 'warning', '警告', 'loading', '📊', '💡', '✅', '🔄', '📂', '🗑️'];

        // typeが'system'で、UI表示キーワードを含まない場合はコンソールに出力
        if (type === 'system' && !uiKeywords.some(keyword => content.includes(keyword))) {
            // HTMLタグを除去してプレーンテキストとしてログ出力
            const plainTextContent = content.replace(/<[^>]*>/g, '');
            console.log(`[System] ${plainTextContent}`);
            return; // UIには追加しない
        }

        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        // タイムスタンプ追加
        const timestamp = new Date().toLocaleTimeString('ja-JP', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        if (type === 'user') {
            // ユーザー入力は安全にエスケープ
            message.innerHTML = `
                <div class="message-content">${this._escapeHtml(content)}</div>
                <div class="message-time">${timestamp}</div>
            `;
        } else if (type === 'ai') {
            // AIの応答はMarkdownとしてパース
            message.innerHTML = `
                <div class="message-content">${MarkdownUtils.parse(content)}</div>
                <div class="message-time">${timestamp}</div>
            `;
        } else {
            // UIに表示するシステムメッセージ（エラー、警告、成功メッセージなど）
            message.innerHTML = `
                <div class="message-content">${content}</div>
                <div class="message-time">${timestamp}</div>
            `;
        }
        
        elements.chatMessages.appendChild(message);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    // HTMLエスケープヘルパー
    static _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ローディング状態設定
    static setLoading(loading) {
        AppState.setState({ isLoading: loading });
        elements.sendBtn.disabled = loading;
        elements.chatInput.disabled = loading;
        
        if (loading) {
            elements.sendBtn.textContent = '送信中...';
        } else {
            elements.sendBtn.textContent = '送信';
        }
    }

    // メッセージ送信（IndexedDB対応）
    static async sendMessage() {
        const message = elements.chatInput.value.trim();
        if (!message || AppState.isLoading) return;

        elements.chatInput.value = '';
        this.addMessage('user', message);
        this.setLoading(true);

        try {
            // 現在のコンテキストを詳細に収集（IndexedDB対応）
            const currentFileContent = await this._getCurrentFileContent();
            const fileList = await this._getCurrentFileList();
            
            const context = {
                currentPath: AppState.currentPath,
                fileList: fileList,
                currentFile: AppState.currentEditingFile,
                currentFileContent: currentFileContent,
                isEditMode: AppState.isEditMode,
                selectedFiles: AppState.selectedFiles,
                timestamp: new Date().toISOString(),
                storageMode: 'indexeddb', // 固定値
                // 現在開いているファイルの詳細情報
                openFileInfo: currentFileContent ? {
                    hasContent: true,
                    length: currentFileContent.length,
                    wordCount: currentFileContent.split(/\s+/).filter(w => w).length,
                    lines: currentFileContent.split('\n').length
                } : null
            };

            // カスタムプロンプトを含めたコンテキスト
            const selectedPrompt = SystemPromptManager.getSelectedPrompt();
            if (selectedPrompt) {
                context.customPrompt = {
                    name: selectedPrompt.name,
                    content: selectedPrompt.content,
                    description: selectedPrompt.description
                };
            }

            // 会話履歴に追加
            ConversationHistory.addMessage('user', message);

            console.log('Sending message with IndexedDB context:', context);

            // バックエンドにメッセージ送信
            const response = await APIClient.sendChatMessage(message, context);
            
            if (response.success) {
                // AI応答をUIに表示
                this.addMessage('ai', response.message);
                
                // 会話履歴に追加
                ConversationHistory.addMessage('ai', response.message);
                
                // コマンドが含まれている場合は実行
                if (response.command) {
                    await this.executeCommand(response.command);
                }
            } else {
                this.addMessage('system', `❌ エラー: ${response.error || 'Unknown error'}`);
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            this.addMessage('system', `❌ 通信エラーが発生しました: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }

    // 現在のファイル内容取得（IndexedDB対応）
    static async _getCurrentFileContent() {
        if (!AppState.currentEditingFile) return null;
        
        try {
            // 編集中の場合はテキストエリアから取得
            const textarea = elements.fileContent?.querySelector('textarea');
            if (textarea && AppState.isEditMode) {
                return textarea.value;
            }
            
            // IndexedDBから直接読み込み
            await storageManager.ensureInitialized();
            const filePath = this._joinPath(AppState.currentPath, AppState.currentEditingFile);
            return await storageManager.storageAdapter.readFile(filePath);
            
        } catch (error) {
            console.warn('Failed to get current file content:', error);
            return null;
        }
    }

    // 現在のファイルリスト取得（IndexedDB対応）
    static async _getCurrentFileList() {
        try {
            await storageManager.ensureInitialized();
            const items = await storageManager.storageAdapter.listChildren(AppState.currentPath);
            
            return items.map(item => ({
                name: item.name,
                type: item.type,
                size: item.size,
                modifiedAt: item.modifiedAt
            }));
            
        } catch (error) {
            console.warn('Failed to get current file list:', error);
            return [];
        }
    }

    // パス結合ヘルパー
    static _joinPath(path1, path2) {
        if (path1.endsWith('/')) {
            return path1 + path2;
        }
        return path1 + '/' + path2;
    }

    // コマンド実行（IndexedDB対応）
    static async executeCommand(command) {
        console.log('Executing command:', command);
        
        try {
            // コマンドの基本検証
            if (!command || !command.action) {
                throw new Error('Invalid command: missing action');
            }

            const { action, ...params } = command;

            // アクション別の処理
            switch (action) {
                case 'create_file':
                    await this._executeCreateFile(params);
                    break;

                case 'create_directory':
                    await this._executeCreateDirectory(params);
                    break;

                case 'read_file':
                    await this._executeReadFile(params);
                    break;

                case 'edit_file':
                    await this._executeEditFile(params);
                    break;

                case 'delete_file':
                    await this._executeDeleteFile(params);
                    break;

                case 'list_files':
                    await this._executeListFiles(params);
                    break;

                case 'move_file':
                    await this._executeMoveFile(params);
                    break;

                case 'copy_file':
                    await this._executeCopyFile(params);
                    break;

                case 'navigate':
                    await this._executeNavigate(params);
                    break;

                default:
                    throw new Error(`Unknown command action: ${action}`);
            }

        } catch (error) {
            console.error('Command execution failed:', error);
            this.addMessage('system', `❌ コマンド実行エラー: ${error.message}`);
        }
    }

    // ファイル作成コマンド実行
    static async _executeCreateFile(params) {
        const { path, content = '' } = params;
        
        if (!path) {
            throw new Error('File path is required');
        }

        try {
            await FileManagerController.createFile(path, content);
            this.addMessage('system', `✅ ファイル "${path}" を作成しました`);
            
            // ファイルリスト更新
            if (this._isInCurrentPath(path)) {
                await FileManagerController.loadFileList();
            }
            
        } catch (error) {
            throw new Error(`ファイル作成に失敗: ${error.message}`);
        }
    }

    // ディレクトリ作成コマンド実行
    static async _executeCreateDirectory(params) {
        const { path } = params;
        
        if (!path) {
            throw new Error('Directory path is required');
        }

        try {
            await FileManagerController.createDirectory(path);
            this.addMessage('system', `✅ ディレクトリ "${path}" を作成しました`);
            
            // ファイルリスト更新
            if (this._isInCurrentPath(path)) {
                await FileManagerController.loadFileList();
            }
            
        } catch (error) {
            throw new Error(`ディレクトリ作成に失敗: ${error.message}`);
        }
    }

    // ファイル読み込みコマンド実行
    static async _executeReadFile(params) {
        const { path } = params;
        
        if (!path) {
            throw new Error('File path is required');
        }

        try {
            const fileName = path.split('/').pop();
            
            // ファイルがあるディレクトリに移動
            const dirPath = path.substring(0, path.lastIndexOf('/')) || '/workspace';
            if (dirPath !== AppState.currentPath) {
                AppState.setState({ currentPath: dirPath });
                await FileManagerController.loadFileList();
            }
            
            // ファイルを開く
            await FileManagerController.openFile(fileName);
            this.addMessage('system', `📖 ファイル "${path}" を開きました`);
            
        } catch (error) {
            throw new Error(`ファイル読み込みに失敗: ${error.message}`);
        }
    }

    // ファイル編集コマンド実行
    static async _executeEditFile(params) {
        const { path, content } = params;
        
        if (!path) {
            throw new Error('File path is required');
        }

        try {
            if (content !== undefined) {
                // コンテンツが指定されている場合は直接保存
                const fileName = path.split('/').pop();
                await FileManagerController.saveFileContent(fileName, content);
                this.addMessage('system', `💾 ファイル "${path}" を更新しました`);
                
                // 現在編集中のファイルの場合は表示も更新
                if (AppState.currentEditingFile === fileName) {
                    FileEditor.showFileContent(content, fileName);
                }
                
            } else {
                // コンテンツが指定されていない場合は編集モードで開く
                const fileName = path.split('/').pop();
                const dirPath = path.substring(0, path.lastIndexOf('/')) || '/workspace';
                
                if (dirPath !== AppState.currentPath) {
                    AppState.setState({ currentPath: dirPath });
                    await FileManagerController.loadFileList();
                }
                
                await FileManagerController.openFile(fileName);
                
                // 編集モードに切り替え
                setTimeout(() => {
                    if (window.FileEditor && window.FileEditor.toggleEditMode) {
                        window.FileEditor.toggleEditMode();
                    }
                }, 100);
                
                this.addMessage('system', `✏️ ファイル "${path}" を編集モードで開きました`);
            }
            
        } catch (error) {
            throw new Error(`ファイル編集に失敗: ${error.message}`);
        }
    }

    // ファイル削除コマンド実行
    static async _executeDeleteFile(params) {
        const { path } = params;
        
        if (!path) {
            throw new Error('File path is required');
        }

        try {
            const fileName = path.split('/').pop();
            await FileManagerController.deleteFile(fileName);
            this.addMessage('system', `🗑️ ファイル "${path}" を削除しました`);
            
            // 現在編集中のファイルが削除された場合
            if (AppState.currentEditingFile === fileName) {
                AppState.setState({ 
                    currentEditingFile: null,
                    isEditMode: false 
                });
                FileEditor.setFileViewMode(false);
            }
            
            // ファイルリスト更新
            await FileManagerController.loadFileList();
            
        } catch (error) {
            throw new Error(`ファイル削除に失敗: ${error.message}`);
        }
    }

    // ファイル一覧表示コマンド実行
    static async _executeListFiles(params) {
        const { path } = params;

        try {
            // 指定されたパスに移動（省略時は現在のパス）
            const targetPath = path || AppState.currentPath;
            
            if (targetPath !== AppState.currentPath) {
                AppState.setState({ currentPath: targetPath });
            }
            
            await FileManagerController.loadFileList();
            
            // ファイル一覧を取得してメッセージで表示
            const items = await storageManager.storageAdapter.listChildren(targetPath);
            
            if (items.length === 0) {
                this.addMessage('system', `📁 "${targetPath}" は空のフォルダです`);
            } else {
                const fileList = items.map(item => {
                    const icon = item.type === 'directory' ? '📁' : '📄';
                    const size = item.type === 'file' ? ` (${this._formatBytes(item.size || 0)})` : '';
                    return `${icon} ${item.name}${size}`;
                }).join('\n');
                
                this.addMessage('system', `📂 "${targetPath}" の内容:\n${fileList}`);
            }
            
        } catch (error) {
            throw new Error(`ファイル一覧取得に失敗: ${error.message}`);
        }
    }

    // ファイル移動コマンド実行
    static async _executeMoveFile(params) {
        const { source, destination } = params;
        
        if (!source || !destination) {
            throw new Error('Source and destination paths are required');
        }

        try {
            const sourceName = source.split('/').pop();
            const destName = destination.split('/').pop();
            
            await FileManagerController.moveFile(sourceName, destName);
            this.addMessage('system', `✂️ "${source}" を "${destination}" に移動しました`);
            
            // ファイルリスト更新
            await FileManagerController.loadFileList();
            
        } catch (error) {
            throw new Error(`ファイル移動に失敗: ${error.message}`);
        }
    }

    // ファイルコピーコマンド実行
    static async _executeCopyFile(params) {
        const { source, destination } = params;
        
        if (!source || !destination) {
            throw new Error('Source and destination paths are required');
        }

        try {
            const sourceName = source.split('/').pop();
            const destName = destination.split('/').pop();
            
            await FileManagerController.copyFile(sourceName, destName);
            this.addMessage('system', `📋 "${source}" を "${destination}" にコピーしました`);
            
            // ファイルリスト更新
            await FileManagerController.loadFileList();
            
        } catch (error) {
            throw new Error(`ファイルコピーに失敗: ${error.message}`);
        }
    }

    // ナビゲーションコマンド実行
    static async _executeNavigate(params) {
        const { path } = params;
        
        if (!path) {
            throw new Error('Path is required for navigation');
        }

        try {
            AppState.setState({ currentPath: path });
            await FileManagerController.loadFileList();
            this.addMessage('system', `📂 "${path}" に移動しました`);
            
        } catch (error) {
            throw new Error(`ナビゲーションに失敗: ${error.message}`);
        }
    }

    // パスが現在のディレクトリ内かチェック
    static _isInCurrentPath(path) {
        const directory = path.substring(0, path.lastIndexOf('/')) || '/workspace';
        return directory === AppState.currentPath;
    }

    // ファイルサイズフォーマット
    static _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // チャット履歴クリア
    static clearChatHistory() {
        elements.chatMessages.innerHTML = '';
        ConversationHistory.clear();
        this.addMessage('system', '🧹 チャット履歴をクリアしました');
    }

    // エラーハンドリング強化
    static handleGlobalError(error, context = '') {
        console.error('Global error in MessageProcessor:', error, context);
        
        const errorMessage = `❌ 予期しないエラーが発生しました${context ? ` (${context})` : ''}`;
        const details = error.message || 'Unknown error';
        
        this.addMessage('system', `${errorMessage}\n詳細: ${details}`);
        
        // 重要なエラーの場合は追加の対処法を提示
        if (error.message?.includes('IndexedDB')) {
            this.addMessage('system', `
💡 **IndexedDBエラーの対処法:**
• ブラウザをプライベートモードで使用していないか確認
• ブラウザのストレージ容量を確認
• 他のタブでアプリが開かれていないか確認
• ページを再読み込みして再試行
            `);
        }
    }
}
