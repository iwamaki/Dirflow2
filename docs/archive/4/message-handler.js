/* =========================================
   AI File Manager - メッセージとコマンド処理
   ========================================= */

// メッセージ処理クラス
class MessageHandler {
    static addMessage(type, content) {
        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        // AIメッセージの場合はMarkdownレンダリングを適用
        if (type === 'ai') {
            message.innerHTML = Utils.parseMarkdown(content);
        } else {
            // ユーザーメッセージとシステムメッセージは安全にエスケープ
            message.innerHTML = Utils.escapeHtml(content);
        }
        
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
            const currentFileContent = this.getCurrentFileContent();
            const context = {
                currentPath: AppState.currentPath,
                fileList: this.getCurrentFileList(),
                currentFile: AppState.currentEditingFile,
                currentFileContent: currentFileContent,
                isEditMode: AppState.isEditMode,
                selectedFiles: AppState.selectedFiles,
                timestamp: new Date().toISOString(),
                // 現在開いているファイルの詳細情報をメッセージに含める
                openFileInfo: currentFileContent ? `現在開いているファイル: ${currentFileContent.filename} (${currentFileContent.size})\n内容:\n${currentFileContent.content}` : null
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

    static getCurrentFileContent() {
        // 現在開いているファイルの内容を取得
        if (!AppState.currentEditingFile) return null;
        
        const files = mockFileSystem[AppState.currentPath] || [];
        const file = files.find(f => f.name === AppState.currentEditingFile);
        
        if (file && file.content !== undefined) {
            return {
                filename: file.name,
                content: file.content,
                size: file.size,
                type: file.type
            };
        }
        
        return null;
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
