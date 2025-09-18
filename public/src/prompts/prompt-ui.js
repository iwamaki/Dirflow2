/* =========================================
    プロンプトUI制御
   ========================================= */

/*
## 概要
カスタムプロンプト管理に関連するUI要素（ドロワー、プロンプト一覧、モーダルなど）の表示と操作を制御するモジュール。`SystemPromptManager` と連携し、ユーザーがプロンプトを視覚的に管理できるようにする。

## 主要機能
- **クラス**: PromptUIController (プロンプト関連UIの表示・操作を制御する)
- **主要メソッド**:
  - `toggleDrawer(forceOpen)`: システムプロンプト管理ドロワーの開閉を制御する。
  - `switchSection(section)`: ドロワー内のセクション（新規作成、管理、ワークフロー）を切り替える。
  - `refreshPromptList()`: カスタムプロンプトの一覧を再取得し、UIを更新する。
  - `createPromptCardHTML(prompt)`: 個々のプロンプトカードのHTMLを生成する。
  - `setupPromptCardEvents()`: プロンプトカードに対するイベントリスナーを設定する。
  - `selectPrompt(promptId)`: プロンプトを選択または選択解除し、UIと状態を更新する。
  - `handlePromptAction(action, promptId)`: プロンプトカード内のアクションボタン（選択、編集、削除）のクリックを処理する。
  - `editPrompt(promptId)`: 指定されたプロンプトの情報を編集モーダルにロードし、編集モードにする。
  - `deletePrompt(promptId)`: 指定されたプロンプトを削除する。
  - `updateCurrentPromptStatus()`: 現在選択されているカスタムプロンプトの状態をUIに表示する。
  - `initializeModal()`: プロンプト関連モーダルを初期状態にリセットする。

## 依存関係
- **インポート**:
  - `elements` (from '../core/config.js'): DOM要素参照。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `SystemPromptManager` (from './prompt-manager.js'): カスタムプロンプトの管理ロジック。
  - `DOMHelpers` (from '../utils/dom-helpers.js'): DOM操作ヘルパー。
- **エクスポート**: PromptUIControllerクラス

## 特記事項
- UIとロジックの分離: プロンプトデータの管理は `SystemPromptManager` が行い、このモジュールはUIの表示とユーザーインタラクションに特化している。
- 動的なUI更新: プロンプトの追加、更新、削除、選択に応じて、プロンプト一覧やステータス表示がリアルタイムで更新される。
- 編集モード: 既存プロンプトの編集時には、新規作成セクションを再利用し、ボタンのテキストやデータ属性を切り替えることで編集モードを表現する。
*/

import { elements } from '../core/config.js';
import { AppState } from '../core/state.js';
import { SystemPromptManager } from './prompt-manager.js';
import { DOMHelpers } from '../utils/dom-helpers.js';

export class PromptUIController {
    // システムプロンプトドロワーの開閉制御
    static toggleDrawer(forceOpen = null) {
        const isOpen = forceOpen !== null ? forceOpen : !AppState.isPromptDrawerOpen;
        AppState.setState({ isPromptDrawerOpen: isOpen });

        const drawer = elements.promptDrawer;
        const overlay = elements.drawerOverlay;
        const hamburgerBtn = elements.promptMenuBtn;

        if (isOpen) {
            // ドロワーの幅を画面の1/3に設定
            const drawerWidth = Math.max(240, Math.min(window.innerWidth / 3, 320));
            drawer.style.width = `${drawerWidth}px`;
            
            drawer.classList.add('open');
            overlay.classList.add('show');
            hamburgerBtn.classList.add('active');
        } else {
            drawer.classList.remove('open');
            overlay.classList.remove('show');
            hamburgerBtn.classList.remove('active');
            
            // スタイルをリセット
            drawer.style.width = '';
        }
    }

    // プロンプトセクション切り替え
    static switchSection(section) {
        AppState.setState({ currentPromptSection: section });

        // セクション表示切り替え
        document.querySelectorAll('.prompt-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.drawer-item').forEach(item => item.classList.remove('active'));

        const targetSection = document.getElementById(`${section}Section`);
        const targetItem = document.querySelector(`[data-section="${section}"]`);

        if (targetSection) targetSection.classList.add('active');
        if (targetItem) {
            targetItem.classList.add('active');
            
            // モーダルのタイトルを更新 (要素を直接取得)
            const systemPromptModal = document.getElementById('systemPromptModal');
            if (systemPromptModal) {
                const modalTitle = systemPromptModal.querySelector('.modal-title');
                const drawerItemText = targetItem.querySelector('span:not(.drawer-icon)').textContent;
                const drawerItemIcon = targetItem.querySelector('.drawer-icon').textContent;
                if (modalTitle && drawerItemText) {
                    modalTitle.innerHTML = `${drawerItemIcon} ${drawerItemText}`;
                }
            }
        }

        // セクション固有の初期化
        if (section === 'manage') {
            this.refreshPromptList();
        }

        // ドロワーを閉じる
        this.toggleDrawer(false);
    }

    // プロンプト一覧の更新
    static refreshPromptList() {
        const prompts = SystemPromptManager.refreshCache();
        const listContainer = elements.promptList;
        
        if (!listContainer) return;

        if (prompts.length === 0) {
            listContainer.innerHTML = `
                <div class="prompt-list-empty">
                    <h4>📝 プロンプトが登録されていません</h4>
                    <p>「新規作成」からカスタムプロンプトを作成してください。</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = prompts.map(prompt => this.createPromptCardHTML(prompt)).join('');
        
        // プロンプト選択状態の更新
        this.updateCurrentPromptStatus();
        this.setupPromptCardEvents();
    }

    // プロンプトカードHTML生成
    static createPromptCardHTML(prompt) {
        const isSelected = AppState.selectedPromptId === prompt.id;
        const createdDate = new Date(prompt.createdAt).toLocaleDateString('ja-JP');
        const previewContent = prompt.content.slice(0, 100) + (prompt.content.length > 100 ? '...' : '');

        return `
            <div class="prompt-card ${isSelected ? 'selected' : ''}" data-prompt-id="${prompt.id}">
                <div class="prompt-card-header">
                    <div class="prompt-name">${DOMHelpers.escapeHtml(prompt.name)}</div>
                    <div class="prompt-date">${createdDate}</div>
                </div>
                ${prompt.description ? `<div class="prompt-description">${DOMHelpers.escapeHtml(prompt.description)}</div>` : ''}
                <div class="prompt-preview">${DOMHelpers.escapeHtml(previewContent)}</div>
                <div class="prompt-actions">
                    <button class="prompt-action-btn" data-action="select" data-prompt-id="${prompt.id}">
                        ${isSelected ? '✅ 選択中' : '📌 選択'}
                    </button>
                    <button class="prompt-action-btn" data-action="edit" data-prompt-id="${prompt.id}">✏️ 編集</button>
                    <button class="prompt-action-btn danger" data-action="delete" data-prompt-id="${prompt.id}">🗑️ 削除</button>
                </div>
            </div>
        `;
    }

    // プロンプトカードイベント設定
    static setupPromptCardEvents() {
        document.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('prompt-action-btn')) {
                    const promptId = card.dataset.promptId;
                    this.selectPrompt(promptId);
                }
            });
        });

        document.querySelectorAll('.prompt-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const promptId = btn.dataset.promptId;
                this.handlePromptAction(action, promptId);
            });
        });
    }

    // プロンプト選択処理
    static selectPrompt(promptId) {
        // すでに選択されているプロンプトを再度クリックした場合は選択解除
        if (AppState.selectedPromptId === promptId) {
            const prompt = SystemPromptManager.getPromptById(promptId);
            SystemPromptManager.deselectPrompt();
            if (window.MessageProcessor && prompt) {
                window.MessageProcessor.addMessage('system', `🧠 プロンプト "${prompt.name}" の選択を解除しました`);
            }
        } else {
            const selectedPrompt = SystemPromptManager.selectPrompt(promptId);
            if (selectedPrompt && window.MessageProcessor) {
                window.MessageProcessor.addMessage('system', `🧠 プロンプト "${selectedPrompt.name}" を選択しました`);
            }
        }

        this.refreshPromptList();
        this.updateCurrentPromptStatus();
        
        // NavigationControllerの更新
        if (window.NavigationController) {
            window.NavigationController.updatePromptToggleButton();
        }
    }

    // プロンプトアクション処理
    static handlePromptAction(action, promptId) {
        switch (action) {
            case 'select':
                this.selectPrompt(promptId);
                break;
            case 'edit':
                this.editPrompt(promptId);
                break;
            case 'delete':
                this.deletePrompt(promptId);
                break;
        }
    }

    // プロンプト編集
    static editPrompt(promptId) {
        const prompt = SystemPromptManager.getPromptById(promptId);
        if (!prompt) return;

        // 編集フォームに値をセット
        elements.promptNameInput.value = prompt.name;
        elements.promptContentInput.value = prompt.content;
        elements.promptDescriptionInput.value = prompt.description || '';

        // 新規作成セクションに移動（編集モードとして使用）
        this.switchSection('create');
        
        // 編集モードであることを示すため、ボタンテキストを変更
        const submitBtn = elements.confirmSystemPrompt;
        submitBtn.textContent = '更新';
        submitBtn.dataset.editId = promptId;

        if (window.MessageProcessor) {
            window.MessageProcessor.addMessage('system', `✏️ "${prompt.name}" を編集モードで開きました`);
        }
    }

    // プロンプト削除
    static deletePrompt(promptId) {
        const prompt = SystemPromptManager.getPromptById(promptId);
        if (!prompt) return;

        if (confirm(`プロンプト "${prompt.name}" を削除しますか？`)) {
            try {
                SystemPromptManager.deletePrompt(promptId);
                this.refreshPromptList();
                this.updateCurrentPromptStatus();
                
                // NavigationControllerの更新
                if (window.NavigationController) {
                    window.NavigationController.updatePromptToggleButton();
                }
                
                if (window.MessageProcessor) {
                    window.MessageProcessor.addMessage('system', `🗑️ プロンプト "${prompt.name}" を削除しました`);
                }
            } catch (error) {
                if (window.MessageProcessor) {
                    window.MessageProcessor.addMessage('system', `❌ 削除に失敗: ${error.message}`);
                }
            }
        }
    }

    // 現在選択中のカスタムプロンプト状態表示更新
    static updateCurrentPromptStatus() {
        const statusElement = elements.currentPromptStatus;
        if (!statusElement) return;

        statusElement.classList.remove('active');
        const statusText = statusElement.querySelector('.status-text');

        if (AppState.isCustomPromptEnabled && AppState.selectedPromptId) {
            const selectedPrompt = SystemPromptManager.getSelectedPrompt();
            if (selectedPrompt) {
                statusText.textContent = `現在のプロンプト: ${selectedPrompt.name}`;
                statusElement.classList.add('active');
            } else {
                statusText.textContent = '現在のプロンプト: エラー（選択されたプロンプトが見つかりません）';
            }
        } else {
            statusText.textContent = '現在のプロンプト: 未選択';
        }
    }

    // モーダル初期化
    static initializeModal() {
        this.switchSection('create');
        this.updateCurrentPromptStatus();
        
        // NavigationControllerの更新
        if (window.NavigationController) {
            window.NavigationController.updatePromptToggleButton();
        }
        
        // 編集モードのクリア
        const submitBtn = elements.confirmSystemPrompt;
        submitBtn.textContent = '登録';
        delete submitBtn.dataset.editId;
    }
}

