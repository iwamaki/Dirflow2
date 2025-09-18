/* =========================================
    差分表示・管理
   ========================================= */

/*
## 概要
ファイルの内容変更における差分を検出し、視覚的に表示・管理するためのモジュール。

## 責任
- ファイルの差分検出と生成（LCSアルゴリズムを使用）
- 差分情報のHTMLレンダリングとUI表示
- ユーザーによる変更ブロックの選択と選択状態の管理
- 選択された変更のみを適用した新しいファイル内容の生成と保存
- 差分表示モードの有効/無効切り替え
*/

import { elements, mockFileSystem } from '../core/config.js';
import { AppState } from '../core/state.js';
import { DOMHelpers } from '../utils/dom-helpers.js';
import { NavigationController } from '../ui/navigation.js';
import { FileViewController } from '../ui/file-view.js';
import { FileManagerController } from './file-manager.js';

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

// 差分表示制御クラス
export class DiffViewer {
    // 差分表示モードの設定
    static setDiffMode(enabled, originalContent = null, newContent = null) {
        AppState.setState({
            isDiffMode: enabled,
            originalContent: originalContent 
        });

        if (enabled && originalContent !== null && newContent !== null) {
            // 差分を生成
            const diff = this.generateDiff(originalContent, newContent);
            AppState.setState({ currentDiff: diff });
            
            // 差分表示用のUI要素を更新
            elements.editBtn.textContent = '📝';
            elements.editBtn.title = '編集モードに戻る';
        } else {
            AppState.setState({
                currentDiff: null,
                originalContent: null 
            });
            // 差分管理をリセット
            DiffManager.reset();
        }

        FileViewController.showFileContent(newContent || originalContent, AppState.currentEditingFile);
    }

    // 差分生成（行単位）- 変更ブロック対応
    static generateDiff(originalText, newText) {
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
    }

    // LCS（最長共通部分列）計算
    static computeLCS(arr1, arr2) {
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
    }

    // 差分をHTMLに変換（変更ブロック単位の選択機能付き）
    static renderDiffAsHtml(diffArray) {
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
            
            const escapedContent = DOMHelpers.escapeHtml(line.content);
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

    // 差分ビューの表示
    static showDiffView() {
        if (!AppState.currentDiff) return;

        // 差分管理を初期化
        DiffManager.initializeDiff();

        const diff = AppState.currentDiff;
        const addedLines = diff.filter(line => line.type === 'added').length;
        const deletedLines = diff.filter(line => line.type === 'deleted').length;
        const totalChanges = addedLines + deletedLines;
        
        // 差分統計情報
        const statsHtml = `
            <div class="diff-stats">
                <span class="added">+${addedLines}</span> / 
                <span class="deleted">-${deletedLines}</span> 変更
            </div>
        `;

        // ツールバー
        const toolbarHtml = `
            <div class="diff-toolbar">
                <div class="diff-toolbar-left">
                    <h3 style="margin: 0; color: var(--text-primary);">📊 差分表示</h3>
                    ${statsHtml}
                </div>
                <div class="diff-toolbar-right">
                    <button class="diff-btn diff-all-btn" onclick="DiffManager.toggleAllSelection()">☑ All</button>
                    <button class="diff-btn" onclick="DiffViewer.setDiffMode(false)">❌ 差分を閉じる</button>
                    <button class="diff-btn primary diff-apply-btn" onclick="DiffViewer.applySelectedChanges()">✅ 適用 (${totalChanges}件)</button>
                </div>
            </div>
        `;

        // 差分内容
        const diffHtml = this.renderDiffAsHtml(diff);
        
        elements.fileContent.innerHTML = toolbarHtml + diffHtml;

        // 初期選択状態のUI更新
        setTimeout(() => {
            DiffManager.updateSelectionUI();
        }, 100);
    }

    // 選択された変更のみを適用
    static async applySelectedChanges() {
        if (!AppState.currentDiff || !AppState.currentEditingFile) return;

        const selectedCount = DiffManager.selectedBlocks.size;
        if (selectedCount === 0) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', '⚠️ 適用する変更を選択してください');
            }
            return;
        }

        // 選択された変更のみで新しい内容を生成
        const newContent = DiffManager.generateSelectedContent();
        
        if (newContent === null) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', '❌ 内容の生成に失敗しました');
            }
            return;
        }
        
        try {
            // ファイルを更新
            const files = mockFileSystem[AppState.currentPath] || [];
            const fileIndex = files.findIndex(f => f.name === AppState.currentEditingFile);
            if (fileIndex !== -1) {
                files[fileIndex].content = newContent;
                
                // ファイルサイズ更新
                const sizeInBytes = new Blob([newContent]).size;
                files[fileIndex].size = FileManagerController.formatFileSize(sizeInBytes);
                
                if (window.MessageProcessor) {
                    window.MessageProcessor.addMessage('system', `💾 "${AppState.currentEditingFile}" に選択された変更 (${selectedCount}件) を適用し、保存しました`);
                }
                
                // 差分モードを終了して通常表示に戻る
                this.setDiffMode(false);
                AppState.setState({
                    isEditMode: false,
                    isContentModified: false,
                    originalContent: newContent
                });
                NavigationController.updateSaveButtonState();
                FileViewController.showFileContent(newContent, AppState.currentEditingFile);
                
                // 差分管理をリセット
                DiffManager.reset();
            }
        } catch (error) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `❌ 差分適用エラー: ${error.message}`);
            }
        }
    }
}

