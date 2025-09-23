/* =========================================
    ファイル表示・編集・差分管理統合モジュール
   ========================================= */

/*
## 概要
ファイルの表示（ビューア）、編集、差分管理を統合したモジュール。
拡張子に応じた様々なファイル形式に対応可能な設計。

## 責任
- ファイル内容の表示（拡張子別ビューア機能）
- 編集モードとプレビューモードの切り替え
- 差分検出・表示・適用
- ファイル保存処理
- UI状態の統合管理
*/

import { elements } from '../core/config.js';
import { AppState } from '../core/state.js';
import { MarkdownUtils } from '../utils/markdown.js';
import { DOMHelpers } from '../utils/dom-helpers.js';
import { NavigationController } from '../ui/navigation.js';
import { FileManagerController } from './file-manager.js';

// ファイル表示モード列挙（DIFFモードを削除）
const ViewMode = {
    CONTENT: 'content',      // コンテンツ表示（マークダウン形式）
    EDIT: 'edit',           // 編集画面（差分表示含む）
    PREVIEW: 'preview'      // プレビュー画面
};

// 拡張子別ビューア設定
const FileViewers = {
    // テキスト系ファイル
    text: {
        extensions: ['txt', 'log', 'cfg', 'ini'],
        render: (content) => `<pre style="white-space: pre-wrap; font-family: monospace; line-height: 1.6;">${DOMHelpers.escapeHtml(content)}</pre>`,
        editable: true
    },

    // マークダウンファイル
    markdown: {
        extensions: ['md', 'markdown'],
        render: (content) => MarkdownUtils.parse(content),
        editable: true
    },

    // コードファイル
    code: {
        extensions: ['js', 'ts', 'py', 'java', 'c', 'cpp', 'css', 'html', 'json', 'xml', 'yaml', 'yml'],
        render: (content) => `<pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; line-height: 1.4; background: #f5f5f5; padding: 16px; border-radius: 4px;">${DOMHelpers.escapeHtml(content)}</pre>`,
        editable: true
    },

    // 将来の拡張用
    image: {
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'],
        render: (content, filename) => `<div style="text-align: center; padding: 20px;"><img src="data:image;base64,${content}" alt="${filename}" style="max-width: 100%; height: auto;"></div>`,
        editable: false
    },

    // PDFファイル（プレースホルダー）
    pdf: {
        extensions: ['pdf'],
        render: (content, filename) => `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><h3>📕 PDF ファイル</h3><p>${filename}</p><small>PDFビューアは今後実装予定です</small></div>`,
        editable: false
    },

    // デフォルト（バイナリファイル等）
    default: {
        extensions: [],
        render: (content, filename) => `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><h3>📄 ${filename}</h3><p>このファイル形式はプレビューできません</p><small>ファイルサイズ: ${new Blob([content]).size} bytes</small></div>`,
        editable: false
    }
};

// 差分管理クラス
class DiffManager {
    static selectedBlocks = new Set();

    static initializeDiff() {
        this.selectedBlocks.clear();

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

    static toggleBlockSelection(blockId) {
        if (this.selectedBlocks.has(blockId)) {
            this.selectedBlocks.delete(blockId);
        } else {
            this.selectedBlocks.add(blockId);
        }
        this.updateSelectionUI();
    }

    static toggleAllSelection() {
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
            this.selectedBlocks = new Set(allChangeBlocks);
        }

        this.updateAllCheckboxes();
        this.updateSelectionUI();
    }

    static updateAllCheckboxes() {
        const checkboxes = document.querySelectorAll('.diff-checkbox');
        checkboxes.forEach(checkbox => {
            const blockId = parseInt(checkbox.dataset.blockId);
            checkbox.checked = this.selectedBlocks.has(blockId);
        });
    }

    static updateSelectionUI() {
        const selectedCount = this.selectedBlocks.size;

        const allChangeBlocks = new Set();
        AppState.currentDiff?.forEach((line) => {
            if (line.changeBlockId !== null) {
                allChangeBlocks.add(line.changeBlockId);
            }
        });
        const totalChanges = allChangeBlocks.size;

        const allBtn = document.querySelector('.diff-all-btn');
        if (allBtn) {
            const allSelected = selectedCount === totalChanges && totalChanges > 0;
            allBtn.textContent = allSelected ? '☑ All' : '☐ All';
            allBtn.title = allSelected ? '全て解除' : '全て選択';
        }

        const applyBtn = document.querySelector('.diff-apply-btn');
        if (applyBtn) {
            applyBtn.disabled = selectedCount === 0;
            applyBtn.textContent = `✅ 適用 (${selectedCount}件)`;
        }
    }

    static generateSelectedContent() {
        if (!AppState.currentDiff) return null;

        const newLines = [];

        AppState.currentDiff.forEach((line) => {
            switch (line.type) {
                case 'common':
                    newLines.push(line.content);
                    break;
                case 'added':
                    if (line.changeBlockId !== null && this.selectedBlocks.has(line.changeBlockId)) {
                        newLines.push(line.content);
                    }
                    break;
                case 'deleted':
                    if (line.changeBlockId === null || !this.selectedBlocks.has(line.changeBlockId)) {
                        newLines.push(line.content);
                    }
                    break;
            }
        });

        return newLines.join('\n');
    }

    static reset() {
        this.selectedBlocks.clear();
    }
}

// メインのファイルエディタクラス
export class FileEditor {
    static currentViewMode = ViewMode.CONTENT;
    static originalContent = '';
    static currentContent = '';

    // 保存ボタンの状態更新
    static updateSaveButtonState() {
        const isModified = AppState.isContentModified;
        elements.saveBtn.classList.toggle('active', isModified);
        elements.saveBtn.title = isModified ? '変更を保存' : '変更なし';
    }

    // ファイルビューモードの設定
    static setFileViewMode(enabled) {
        AppState.setState({ isFileViewMode: enabled });

        if (enabled) {
            elements.fileListContainer.style.display = 'none';
            elements.fileView.style.display = 'flex';
            elements.backBtn.classList.remove('hidden');
            elements.editBtn.classList.remove('hidden');
            elements.saveBtn.classList.remove('hidden');
            elements.settingsBtn.classList.add('hidden');
            elements.fabBtn.classList.add('hidden'); 
        } else {
            elements.fileListContainer.style.display = 'block';
            elements.fileView.style.display = 'none';
            elements.backBtn.classList.add('hidden');
            elements.editBtn.classList.add('hidden');
            elements.saveBtn.classList.add('hidden');
            elements.settingsBtn.classList.remove('hidden');
            elements.fabBtn.classList.remove('hidden');
            
            // ファイルビューを閉じる時は編集内容をクリア
            if (window.EventHandlers) {
                window.EventHandlers.currentEditingContent = null;
            }

            AppState.setState({
                currentEditingFile: null,
                isEditMode: false,
                isContentModified: false,
                isDiffMode: false
            });
            this.updateSaveButtonState();
            this.currentViewMode = ViewMode.CONTENT;
            DiffManager.reset();
        }

        NavigationController.setSelectionMode(false);
    }

    // 拡張子からビューア設定を取得
    static getViewerConfig(filename) {
        if (!filename) return FileViewers.default;

        const ext = filename.split('.').pop()?.toLowerCase();
        if (!ext) return FileViewers.default;

        for (const [type, config] of Object.entries(FileViewers)) {
            if (config.extensions.includes(ext)) {
                return config;
            }
        }

        return FileViewers.default;
    }

    // ファイル内容の表示
    static showFileContent(content, filename) {
        this.currentContent = content;

        switch (this.currentViewMode) {
            case ViewMode.CONTENT:
                this.showContentMode(content, filename);
                break;
            case ViewMode.EDIT:
                this.showEditMode(content, filename);
                break;
            case ViewMode.PREVIEW:
                this.showPreviewMode(content, filename);
                break;
            // DIFF case削除
        }
    }

    // コンテンツ表示モード
    static showContentMode(content, filename) {
        const viewerConfig = this.getViewerConfig(filename);
        elements.fileContent.innerHTML = viewerConfig.render(content, filename);

        // ボタン状態の更新
        if (viewerConfig.editable) {
            elements.editBtn.textContent = '✏️';
            elements.editBtn.title = '編集';
            elements.editBtn.disabled = false;
        } else {
            elements.editBtn.textContent = '👁️';
            elements.editBtn.title = '表示のみ';
            elements.editBtn.disabled = true;
        }

        elements.saveBtn.classList.add('hidden');
    }

    // 編集モード
    static showEditMode(content, filename) {
        const viewerConfig = this.getViewerConfig(filename);

        if (!viewerConfig.editable) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', '⚠️ このファイル形式は編集できません');
            }
            return;
        }

        // 差分モードかどうかで表示を分岐
        if (AppState.isDiffMode) {
            this.showEditModeWithDiff(content, filename);
        } else {
            this.showNormalEditMode(content, filename);
        }
    }

    // 通常の編集モード表示
    static showNormalEditMode(content, filename) {
        elements.fileContent.innerHTML = `<textarea placeholder="ファイルの内容を編集してください...">${DOMHelpers.escapeHtml(content)}</textarea>`;

        const textarea = elements.fileContent.querySelector('textarea');
        textarea.addEventListener('input', () => {
            this.currentContent = textarea.value;
            const isModified = textarea.value !== this.originalContent;
            if (isModified !== AppState.isContentModified) {
                AppState.setState({ isContentModified: isModified });
                this.updateSaveButtonState();
            }
        });

        elements.editBtn.textContent = '👁️';
        elements.editBtn.title = 'プレビュー';
        elements.saveBtn.classList.remove('hidden');
    }

    // 差分表示付き編集モード
    static showEditModeWithDiff(content, filename) {
        if (!AppState.currentDiff) return;

        DiffManager.initializeDiff();
        const diff = AppState.currentDiff;
        const totalChanges = new Set(diff.filter(line => line.changeBlockId !== null).map(line => line.changeBlockId)).size;

        // テキストエリアと差分表示を統合したレイアウト（ボタンを下に移動）
        elements.fileContent.innerHTML = `
            <div class="edit-diff-container">
                <div class="edit-diff-content">
                    <div class="diff-preview">
                        ${this.renderDiffAsHtml(diff)}
                    </div>
                </div>
                <div class="edit-diff-footer">
                    <div class="diff-controls">
                        <button class="diff-btn diff-all-btn" onclick="DiffManager.toggleAllSelection()">
                            ☑ All
                        </button>
                        <button class="diff-btn" onclick="FileEditor.cancelDiff()">
                            ❌ キャンセル
                        </button>
                        <button class="diff-btn primary diff-apply-btn" onclick="FileEditor.applySelectedChanges()">
                            ✅ 適用 (${totalChanges}件)
                        </button>
                    </div>
                </div>
            </div>
        `;

        elements.editBtn.textContent = '✏️';
        elements.editBtn.title = '通常編集に戻る';
        elements.saveBtn.classList.add('hidden');

        setTimeout(() => {
            DiffManager.updateSelectionUI();
        }, 100);
    }

    // プレビューモード（拡張子に応じた表示のみ）
    static showPreviewMode(content, filename) {
        // 拡張子に応じたプレビュー表示
        const viewerConfig = this.getViewerConfig(filename);
        elements.fileContent.innerHTML = `

            ${viewerConfig.render(this.currentContent, filename)}
        `;
        
        AppState.setState({ isEditMode: false });

        elements.editBtn.textContent = '✏️';
        elements.editBtn.title = '編集に戻る';
    }

    // 差分適用モード
    static switchToDiffMode() {
        if (this.originalContent !== this.currentContent) {
            const diff = this.generateDiff(this.originalContent, this.currentContent);
            AppState.setState({
                currentDiff: diff,
                isDiffMode: true,
                isEditMode: true // 編集モードのままにする
            });
            this.currentViewMode = ViewMode.EDIT; // EDITモードを維持
            this.showEditMode(this.currentContent, AppState.currentEditingFile);
        }
    }

    // モード切り替えメソッド
    static switchToEditMode() {
        this.currentViewMode = ViewMode.EDIT;
        AppState.setState({ isEditMode: true });
        this.showFileContent(this.currentContent, AppState.currentEditingFile);
    }

    static switchToPreviewMode() {
        this.currentViewMode = ViewMode.PREVIEW;
        AppState.setState({ isEditMode: false });
        this.showFileContent(this.currentContent, AppState.currentEditingFile);
    }

    static switchToContentMode() {
        this.currentViewMode = ViewMode.CONTENT;
        AppState.setState({ isEditMode: false, isDiffMode: false });
        this.showFileContent(this.currentContent, AppState.currentEditingFile);
    }

    // 差分生成
    static generateDiff(originalText, newText) {
        const originalLines = (originalText || '').split('\n');
        const newLines = (newText || '').split('\n');

        const lcs = this.computeLCS(originalLines, newLines);

        const diff = [];
        let originalIndex = 0;
        let newIndex = 0;
        let lcsIndex = 0;
        let changeBlockId = 0;

        while (originalIndex < originalLines.length || newIndex < newLines.length) {
            const originalLine = originalLines[originalIndex];
            const newLine = newLines[newIndex];
            const commonLine = lcs[lcsIndex];

            if (originalLine === commonLine && newLine === commonLine) {
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

    // LCS計算
    static computeLCS(arr1, arr2) {
        const m = arr1.length;
        const n = arr2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (arr1[i - 1] === arr2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

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

    // 差分HTML生成（チェックボックスを右側に移動）
    static renderDiffAsHtml(diffArray) {
        let html = '<div class="diff-container">';
        let processedBlocks = new Set();

        diffArray.forEach((line, index) => {
            const lineNumber = line.originalLineNumber || line.newLineNumber || '';
            let className = 'diff-line';
            let prefix = '';
            let checkbox = '';

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
                    <span class="diff-line-number">${lineNumber}</span>
                    <span class="diff-prefix">${prefix}</span>
                    <span class="diff-content">${escapedContent}</span>
                    ${checkbox}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // 差分適用
    static async applySelectedChanges() {
        if (!AppState.currentDiff || !AppState.currentEditingFile) return;

        const selectedCount = DiffManager.selectedBlocks.size;
        if (selectedCount === 0) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', '⚠️ 適用する変更を選択してください');
            }
            return;
        }

        const newContent = DiffManager.generateSelectedContent();

        if (newContent === null) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', '❌ 内容の生成に失敗しました');
            }
            return;
        }

        try {
            await FileManagerController.saveFileContent(AppState.currentEditingFile, newContent);

            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `💾 "${AppState.currentEditingFile}" に選択された変更 (${selectedCount}件) を適用し、保存しました`);
            }

            this.originalContent = newContent;
            this.currentContent = newContent;
            AppState.setState({
                isEditMode: false,
                isContentModified: false,
                isDiffMode: false,
                originalContent: newContent
            });
            this.updateSaveButtonState();
            this.switchToContentMode();
            DiffManager.reset();

        } catch (error) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `❌ 差分適用エラー: ${error.message}`);
            }
        }
    }

    // 差分キャンセル
    static cancelDiff() {
        // 差分関連の状態をクリア
        AppState.setState({ 
            isDiffMode: false,
            currentDiff: null 
        });
        DiffManager.reset();
        
        // 編集モードを再表示（差分なしで）
        this.showEditMode(this.currentContent, AppState.currentEditingFile);
    }

    // ファイルを開く
    static openFile(filename, content) {
        this.originalContent = content;
        this.currentContent = content;
        this.currentViewMode = ViewMode.CONTENT;

        AppState.setState({
            currentEditingFile: filename,
            isEditMode: false,
            isDiffMode: false,
            originalContent: content
        });

        this.setFileViewMode(true);
        this.showFileContent(content, filename);
    }

    // 保存処理
    static async saveFile() {
        if (!AppState.currentEditingFile) return;
        
        let content;
        
        if (this.currentViewMode === ViewMode.EDIT) {
            const textarea = elements.fileContent.querySelector('textarea');
            if (!textarea) return;
            content = textarea.value;
            this.currentContent = content;
        } else if (this.currentViewMode === ViewMode.PREVIEW) {
            content = this.currentContent;
        } else {
            return; // その他のモードでは何もしない
        }

        if (this.originalContent === this.currentContent) {
            if (window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', '💡 変更がないため保存をスキップしました');
            }
            return;
        }

        this.switchToDiffMode();
    }
}

// グローバルアクセス用
window.FileEditor = FileEditor;
window.DiffManager = DiffManager;