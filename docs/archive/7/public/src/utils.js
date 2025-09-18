/* =========================================
   AI File Manager - ユーティリティとAPI通信 (ES6 Module)
   ========================================= */

import { AppState, ConversationHistory } from './state.js';

// ユーティリティ関数
export const Utils = {
    // ファイルアイコン取得
    getFileIcon(file) {
        if (file.type === 'directory') return '📁';
        const ext = file.name.split('.').pop()?.toLowerCase();
        const icons = {
            'md': '📝', 'txt': '📄', 'json': '⚙️', 'js': '💛',
            'html': '🌐', 'css': '🎨', 'py': '🐍', 'jpg': '🖼️',
            'png': '🖼️', 'pdf': '📕', 'zip': '🗄️', 'doc': '📝',
            'xlsx': '📊', 'ppt': '📋'
        };
        return icons[ext] || '📄';
    },

    // Markdown簡易パーサー
    parseMarkdown(text) {
        if (!text) return '';
        
        return text
            // ヘッダー
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            
            // コードブロック（複数行）
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            
            // インラインコード
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            
            // 太字・斜体
            .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            
            // リスト項目
            .replace(/^[\*\-\+] (.+$)/gim, '<ul><li>$1</li></ul>')
            .replace(/^(\d+)\. (.+$)/gim, '<ol><li>$2</li></ol>')
            
            // リストの連続項目をまとめる
            .replace(/<\/ul>\s*<ul>/gim, '')
            .replace(/<\/ol>\s*<ol>/gim, '')
            
            // リンク
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')
            
            // 改行処理
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>')
            
            // 段落タグで囲む
            .replace(/^(.*)$/gim, '<p>$1</p>')
            
            // 空の段落を削除
            .replace(/<p><\/p>/gim, '');
    },

    // HTMLエスケープ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 遅延実行
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // パス結合
    joinPath(basePath, ...segments) {
        let result = basePath.replace(/\/+$/, ''); // 末尾のスラッシュ削除
        for (const segment of segments) {
            if (segment) {
                result += '/' + segment.replace(/^\/+/, ''); // 先頭のスラッシュ削除
            }
        }
        return result || '/';
    },

    // 差分生成（行単位）- 変更ブロック対応
    generateDiff(originalText, newText) {
        const originalLines = (originalText || '').split('\n');
        const newLines = (newText || '').split('\n');
        
        // シンプルなLCS（最長共通部分列）アルゴリズムの実装
        const lcs = this.computeLCS(originalLines, newLines);
        
        const diff = [];
        let originalIndex = 0;
        let newIndex = 0;
        let lcsIndex = 0;
        let changeBlockId = 0; // 変更ブロックのID

        while (originalIndex < originalLines.length || newIndex < newLines.length) {
            const originalLine = originalLines[originalIndex];
            const newLine = newLines[newIndex];
            const commonLine = lcs[lcsIndex];

            if (originalLine === commonLine && newLine === commonLine) {
                // 共通行
                diff.push({
                    type: 'common',
                    content: originalLine,
                    originalLineNumber: originalIndex + 1,
                    newLineNumber: newIndex + 1,
                    changeBlockId: null
                });
                originalIndex++;
                newIndex++;
                lcsIndex++;
            } else if (originalLine === commonLine) {
                // 追加行
                diff.push({
                    type: 'added',
                    content: newLine,
                    originalLineNumber: null,
                    newLineNumber: newIndex + 1,
                    changeBlockId: changeBlockId
                });
                newIndex++;
                changeBlockId++;
            } else if (newLine === commonLine) {
                // 削除行
                diff.push({
                    type: 'deleted',
                    content: originalLine,
                    originalLineNumber: originalIndex + 1,
                    newLineNumber: null,
                    changeBlockId: changeBlockId
                });
                originalIndex++;
                changeBlockId++;
            } else {
                // 両方の行が共通行と異なる場合、削除と追加として扱う（同じ変更ブロック）
                const currentBlockId = changeBlockId;
                
                if (originalIndex < originalLines.length) {
                    diff.push({
                        type: 'deleted',
                        content: originalLine,
                        originalLineNumber: originalIndex + 1,
                        newLineNumber: null,
                        changeBlockId: currentBlockId
                    });
                    originalIndex++;
                }
                if (newIndex < newLines.length) {
                    diff.push({
                        type: 'added',
                        content: newLine,
                        originalLineNumber: null,
                        newLineNumber: newIndex + 1,
                        changeBlockId: currentBlockId
                    });
                    newIndex++;
                }
                changeBlockId++;
            }
        }

        return diff;
    },

    // LCS（最長共通部分列）計算
    computeLCS(arr1, arr2) {
        const m = arr1.length;
        const n = arr2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        // DPテーブル構築
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (arr1[i - 1] === arr2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // LCSを逆算して構築
        const lcs = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (arr1[i - 1] === arr2[j - 1]) {
                lcs.unshift(arr1[i - 1]);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        return lcs;
    },

    // 差分をHTMLに変換（変更ブロック単位の選択機能付き）
    renderDiffAsHtml(diffArray) {
        let html = '<div class="diff-container">';
        let processedBlocks = new Set(); // 処理済みの変更ブロックID
        
        diffArray.forEach((line, index) => {
            const lineNumber = line.originalLineNumber || line.newLineNumber || '';
            let className = 'diff-line';
            let prefix = '';
            let checkbox = '';
            
            // 変更ブロックの最初の行にのみチェックボックスを表示
            const showCheckbox = line.changeBlockId !== null && !processedBlocks.has(line.changeBlockId);
            if (showCheckbox) {
                processedBlocks.add(line.changeBlockId);
            }
            
            switch (line.type) {
                case 'added':
                    className += ' diff-added';
                    prefix = '+';
                    if (showCheckbox) {
                        checkbox = `<input type="checkbox" class="diff-checkbox" data-block-id="${line.changeBlockId}" checked onchange="DiffManager.toggleBlockSelection(${line.changeBlockId})">`;
                    } else {
                        checkbox = '<span class="diff-checkbox-placeholder"></span>';
                    }
                    break;
                case 'deleted':
                    className += ' diff-deleted';
                    prefix = '-';
                    if (showCheckbox) {
                        checkbox = `<input type="checkbox" class="diff-checkbox" data-block-id="${line.changeBlockId}" checked onchange="DiffManager.toggleBlockSelection(${line.changeBlockId})">`;
                    } else {
                        checkbox = '<span class="diff-checkbox-placeholder"></span>';
                    }
                    break;
                case 'common':
                    className += ' diff-common';
                    prefix = ' ';
                    checkbox = '<span class="diff-checkbox-placeholder"></span>';
                    break;
            }
            
            const escapedContent = this.escapeHtml(line.content);
            html += `
                <div class="${className}" data-line-index="${index}" data-block-id="${line.changeBlockId}">
                    ${checkbox}
                    <span class="diff-line-number">${lineNumber}</span>
                    <span class="diff-prefix">${prefix}</span>
                    <span class="diff-content">${escapedContent}</span>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
};

// 差分管理クラス
export class DiffManager {
    static selectedBlocks = new Set(); // 選択された変更ブロックのID

    // 差分表示の初期化
    static initializeDiff() {
        this.selectedBlocks.clear();
        
        // デフォルトですべての変更ブロックを選択状態にする
        if (AppState.currentDiff) {
            const changeBlocks = new Set();
            AppState.currentDiff.forEach((line) => {
                if (line.changeBlockId !== null) {
                    changeBlocks.add(line.changeBlockId);
                }
            });
            this.selectedBlocks = changeBlocks;
        }
    }

    // 変更ブロックの選択状態を切り替え
    static toggleBlockSelection(blockId) {
        if (this.selectedBlocks.has(blockId)) {
            this.selectedBlocks.delete(blockId);
        } else {
            this.selectedBlocks.add(blockId);
        }
        
        // 選択状態に応じてUIを更新
        this.updateSelectionUI();
    }

    // 全選択/全解除の切り替え
    static toggleAllSelection() {
        // すべての変更ブロックIDを取得
        const allChangeBlocks = new Set();
        AppState.currentDiff?.forEach((line) => {
            if (line.changeBlockId !== null) {
                allChangeBlocks.add(line.changeBlockId);
            }
        });
        
        const allSelected = allChangeBlocks.size > 0 && 
            [...allChangeBlocks].every(blockId => this.selectedBlocks.has(blockId));

        this.selectedBlocks.clear();
        
        if (!allSelected) {
            // 全選択
            this.selectedBlocks = new Set(allChangeBlocks);
        }
        // 全解除の場合は何もしない（すでにクリア済み）
        
        this.updateAllCheckboxes();
        this.updateSelectionUI();
    }

    // すべてのチェックボックスの状態を更新
    static updateAllCheckboxes() {
        const checkboxes = document.querySelectorAll('.diff-checkbox');
        checkboxes.forEach(checkbox => {
            const blockId = parseInt(checkbox.dataset.blockId);
            checkbox.checked = this.selectedBlocks.has(blockId);
        });
    }

    // 選択状態に応じたUI更新
    static updateSelectionUI() {
        const selectedCount = this.selectedBlocks.size;
        
        // 全変更ブロック数を取得
        const allChangeBlocks = new Set();
        AppState.currentDiff?.forEach((line) => {
            if (line.changeBlockId !== null) {
                allChangeBlocks.add(line.changeBlockId);
            }
        });
        const totalChanges = allChangeBlocks.size;
        
        // All ☑ ボタンのテキストを更新
        const allBtn = document.querySelector('.diff-all-btn');
        if (allBtn) {
            const allSelected = selectedCount === totalChanges && totalChanges > 0;
            allBtn.textContent = allSelected ? '☐ All' : '☑ All';
            allBtn.title = allSelected ? '全て解除' : '全て選択';
        }

        // 適用ボタンの状態更新
        const applyBtn = document.querySelector('.diff-apply-btn');
        if (applyBtn) {
            applyBtn.disabled = selectedCount === 0;
            applyBtn.textContent = `✅ 適用 (${selectedCount}件)`;
        }
    }

    // 選択された変更ブロックのみを適用して新しい内容を生成
    static generateSelectedContent() {
        if (!AppState.currentDiff) return null;

        const newLines = [];
        
        AppState.currentDiff.forEach((line) => {
            switch (line.type) {
                case 'common':
                    // 共通行は常に含める
                    newLines.push(line.content);
                    break;
                    
                case 'added':
                    // 追加行：変更ブロックが選択されている場合のみ含める
                    if (line.changeBlockId !== null && this.selectedBlocks.has(line.changeBlockId)) {
                        newLines.push(line.content);
                    }
                    break;
                    
                case 'deleted':
                    // 削除行：変更ブロックが選択されていない場合は残す（削除しない）
                    if (line.changeBlockId === null || !this.selectedBlocks.has(line.changeBlockId)) {
                        newLines.push(line.content);
                    }
                    break;
            }
        });
        
        return newLines.join('\n');
    }

    // 選択状態をリセット
    static reset() {
        this.selectedBlocks.clear();
    }
}

// API通信クラス
export class APIClient {
    static async sendChatMessage(message, context = {}) {
        try {
            // 会話履歴をコンテキストに追加
            context.conversationHistory = ConversationHistory.getHistory();
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    provider: AppState.llmProvider,
                    model: AppState.llmModel,
                    context: context
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // 会話履歴に追加
            ConversationHistory.addExchange(message, data.message);
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async loadProviders() {
        try {
            const response = await fetch('/api/llm-providers');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const providers = await response.json();
            AppState.setState({ availableProviders: providers });
            
            // デフォルトモデルの設定
            if (!AppState.llmModel && providers[AppState.llmProvider]) {
                AppState.setState({ 
                    llmModel: providers[AppState.llmProvider].defaultModel 
                });
            }
            
            return providers;
        } catch (error) {
            console.error('Failed to load providers:', error);
            return {};
        }
    }

    static async checkHealth() {
        try {
            const response = await fetch('/api/health');
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', providers: {} };
        }
    }
}

// グローバル参照用（後方互換性のため）
if (typeof window !== 'undefined') {
    window.DiffManager = DiffManager;
}