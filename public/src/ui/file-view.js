/* =========================================
    ファイル表示・編集制御
   ========================================= */

/*
## 概要
ファイルの内容表示と編集モードの切り替え、および関連するUI要素の制御を行うモジュール。ファイルビューモードの有効化/無効化、ファイル内容の表示（Markdownレンダリング、プレーンテキスト、編集用テキストエリア）、差分表示モードとの連携などを担当する。

## 主要機能
- **クラス**: FileViewController (ファイルビューの表示と編集を制御する)
- **主要メソッド**:
  - `setFileViewMode(enabled)`: ファイルビューモードの有効/無効を切り替える。ファイルリストとファイルビューの表示を切り替え、ヘッダーボタンの表示状態を調整する。
  - `showFileContent(content, filename)`: 指定されたファイルの内容をUIに表示する。ファイルの種類（Markdown、プレーンテキスト）に応じてレンダリング方法を切り替え、編集モードの場合はテキストエリアを表示する。

## 依存関係
- **インポート**:
  - `elements` (from '../core/config.js'): DOM要素参照。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `MarkdownUtils` (from '../utils/markdown.js'): Markdownコンテンツのパースユーティリティ。
  - `DOMHelpers` (from '../utils/dom-helpers.js'): DOM操作ヘルパー。
  - `NavigationController` (from './navigation.js'): UIナビゲーション制御。
- **エクスポート**: FileViewControllerクラス

## 特記事項
- モード切り替え: ファイルビューモード、編集モード、差分表示モードの間でUIが適切に切り替わるように制御する。
- コンテンツ表示: Markdownファイルはレンダリングされ、その他のファイルはプレーンテキストとして表示される。編集モードではテキストエリアが提供される。
- 状態管理との連携: `AppState` を利用して現在のモードや編集状態を管理し、UIの挙動に反映させる。
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