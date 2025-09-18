/* =========================================
    ファイル表示・編集制御
   ========================================= */

/*
## 概要
ファイルの内容表示と編集モードの切り替え、および関連するUI要素の制御を行うモジュール。

## 責任
- ファイルビューモードの有効/無効切り替え
- ファイル内容の表示（Markdownレンダリング、プレーンテキスト、編集用テキストエリア）
- 編集モードとプレビューモードの切り替え
- 差分表示モードとの連携
- UI要素の表示状態の調整
*/

import { elements } from '../core/config.js';
import { AppState } from '../core/state.js';
import { MarkdownUtils } from '../utils/markdown.js';
import { DOMHelpers } from '../utils/dom-helpers.js';
import { NavigationController } from './navigation.js';

export class FileViewController {
    static setFileViewMode(enabled) {
        AppState.setState({ isFileViewMode: enabled });

        if (enabled) {
            elements.fileListContainer.style.display = 'none';
            elements.fileView.style.display = 'flex';
            elements.backBtn.classList.remove('hidden');
            elements.editBtn.classList.remove('hidden');
            elements.saveBtn.classList.remove('hidden');
            elements.settingsBtn.classList.add('hidden');
        } else {
            elements.fileListContainer.style.display = 'block';
            elements.fileView.style.display = 'none';
            elements.backBtn.classList.add('hidden');
            elements.editBtn.classList.add('hidden');
            elements.saveBtn.classList.add('hidden');
            elements.settingsBtn.classList.remove('hidden');

            // ファイルビューを閉じる時は編集内容をクリア
            if (window.EventHandlers) {
                window.EventHandlers.currentEditingContent = null;
            }

            AppState.setState({
                currentEditingFile: null,
                isEditMode: false,
                isContentModified: false
            });
            NavigationController.updateSaveButtonState();
        }

        NavigationController.setSelectionMode(false);
    }

    static showFileContent(content, filename) {
        if (AppState.isDiffMode) {
            // 差分表示モードは DiffViewer が処理
            if (window.DiffViewer) {
                window.DiffViewer.showDiffView();
            }
        } else if (AppState.isEditMode) {
            elements.fileContent.innerHTML = `<textarea placeholder="ファイルの内容を編集してください...">${DOMHelpers.escapeHtml(content)}</textarea>`;
            
            const textarea = elements.fileContent.querySelector('textarea');
            textarea.addEventListener('input', () => {
                const isModified = textarea.value !== AppState.originalContent;
                if (isModified !== AppState.isContentModified) {
                    AppState.setState({ isContentModified: isModified });
                    NavigationController.updateSaveButtonState();
                }
            });

            elements.editBtn.textContent = '👁️';
            elements.editBtn.title = 'プレビュー';
        } else {
            if (filename?.endsWith('.md')) {
                elements.fileContent.innerHTML = MarkdownUtils.parse(content);
            } else {
                elements.fileContent.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; line-height: 1.6;">${DOMHelpers.escapeHtml(content)}</pre>`;
            }
            elements.editBtn.textContent = '✏️';
            elements.editBtn.title = '編集';
        }
    }
}