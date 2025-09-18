/* =========================================
    ナビゲーション・ヘッダー・FAB制御
   ========================================= */

/*
## 概要
アプリケーションの主要なナビゲーション要素（ヘッダー、FAB、チャット、選択モード）の表示と動作を制御するモジュール。

## 責任
- テーマ、フォントサイズ、LLMプロバイダーなどの設定UIの生成と更新
- ファイル選択モードの有効/無効切り替えとアクションボタンの制御
- チャットオーバーレイの表示/非表示切り替え
- カスタムプロンプト切り替えボタンと保存ボタンの状態更新
- APIクライアントの接続状態と利用可能な機能の表示
*/

import { elements } from '../core/config.js';
import { AppState, ConversationHistory, SystemPromptManager } from '../core/state.js';
import { APIClient } from '../api/client.js';

export class NavigationController {
    // テーマ適用
    static applyTheme() {
        document.body.classList.toggle('theme-light', AppState.theme === 'light');
        document.body.classList.remove('font-small', 'font-large');
        if (AppState.fontSize !== 'medium') {
            document.body.classList.add(`font-${AppState.fontSize}`);
        }

        // 設定UIの更新
        this.updateSettingsUI();
        
        // プロンプト切り替えボタンの更新
        this.updatePromptToggleButton();
    }

    // プロンプト切り替えボタンの更新
    static updatePromptToggleButton() {
        const btn = elements.promptToggleBtn;
        if (!btn) return;

        btn.classList.remove('prompt-active', 'prompt-inactive');
        
        if (AppState.isCustomPromptEnabled && AppState.selectedPromptId) {
            btn.classList.add('prompt-active');
            btn.title = 'カスタムプロンプト有効';
            const selectedPrompt = SystemPromptManager.getSelectedPrompt();
            if (selectedPrompt) {
                btn.title += ` (${selectedPrompt.name})`;
            }
        } else {
            btn.classList.add('prompt-inactive');
            btn.title = 'カスタムプロンプト無効';
        }
    }

    // 選択モード設定（複数選択対応）
    static setSelectionMode(enabled, multiSelect = false) {
        AppState.setState({
            isSelectionMode: enabled,
            isMultiSelectMode: multiSelect && enabled
        });

        if (enabled) {
            elements.chatContainer.style.display = 'none';
            elements.actionContainer.style.display = 'flex';
            elements.selectionInfo.style.display = 'block';
            
            const count = AppState.selectedFiles.length;
            const fileNames = AppState.selectedFiles.map(f => f.name).join(', ');
            elements.selectionInfo.textContent = `${count}件選択中: ${fileNames}`;
            
            elements.fabBtn.classList.add('hidden');
            
            // アクションボタンの表示制御
            this.updateActionButtons(count);
        } else {
            elements.chatContainer.style.display = 'flex';
            elements.actionContainer.style.display = 'none';
            elements.selectionInfo.style.display = 'none';
            if (!AppState.isFileViewMode) {
                elements.fabBtn.classList.remove('hidden');
            }

            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected');
            });
            AppState.setState({ selectedFiles: [] });
        }
    }

    // アクションボタン表示更新
    static updateActionButtons(count) {
        const actionContainer = elements.actionContainer;
        if (count === 0) {
            actionContainer.innerHTML = `<button class="btn secondary" id="cancelBtn">キャンセル</button>`;
        } else if (count === 1) {
            actionContainer.innerHTML = `
                <button class="action-btn" data-action="copy">📋 コピー</button>
                <button class="action-btn" data-action="move">🔄 移動</button>
                <button class="action-btn" data-action="rename">✏️ 名前変更</button>
                <button class="action-btn danger" data-action="delete">🗑️ 削除</button>
                <button class="btn secondary" id="cancelBtn">キャンセル</button>
            `;
        } else {
            actionContainer.innerHTML = `
                <button class="action-btn" data-action="batch_copy">📋 一括コピー</button>
                <button class="action-btn" data-action="batch_move">🔄 一括移動</button>
                <button class="action-btn danger" data-action="batch_delete">🗑️ 一括削除</button>
                <button class="btn secondary" id="cancelBtn">キャンセル</button>
            `;
        }

        // イベントリスナー再設定
        this.setupActionEventListeners();
    }

    // アクションイベントリスナー設定
    static setupActionEventListeners() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // EventHandlerは循環依存を避けるためグローバル参照
                if (window.EventHandlers) {
                    window.EventHandlers.handleFileAction(e.target.dataset.action);
                }
            });
        });
        
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.setSelectionMode(false));
        }
    }

    static toggleChat() {
        const newState = !AppState.isChatOpen;
        AppState.setState({ isChatOpen: newState });
        elements.chatOverlay.classList.toggle('show', newState);
    }

    // 設定UI更新
    static updateSettingsUI() {
        // テーマボタン
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.className = btn.dataset.theme === AppState.theme ? 'btn' : 'btn secondary';
        });
        
        // フォントサイズボタン
        document.querySelectorAll('[data-font]').forEach(btn => {
            btn.className = btn.dataset.font === AppState.fontSize ? 'btn' : 'btn secondary';
        });

        // LLMプロバイダーボタン
        document.querySelectorAll('[data-provider]').forEach(btn => {
            btn.className = btn.dataset.provider === AppState.llmProvider ? 'btn' : 'btn secondary';
        });

        // モデル選択ドロップダウン
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect && AppState.availableProviders[AppState.llmProvider]) {
            const models = AppState.availableProviders[AppState.llmProvider].models;
            modelSelect.innerHTML = models.map(model => 
                `<option value="${model}" ${model === AppState.llmModel ? 'selected' : ''}>${model}</option>`
            ).join('');
        }
    }

    // 設定UI生成
    static generateSettingsUI() {
        const settingsBody = document.querySelector('#settingsModal .modal-body');
        if (!settingsBody) return;

        const historyStatus = ConversationHistory.getHistoryStatus();

        const providerButtonsHTML = Object.keys(AppState.availableProviders).map(providerKey => {
            const provider = AppState.availableProviders[providerKey];
            return `<button class="btn" data-provider="${providerKey}">${provider.name}</button>`;
        }).join('');

        settingsBody.innerHTML = `
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🎨 テーマ</label>
                <div style="display: flex; gap: 10px;">
                    <button class="btn" data-theme="dark">ダーク</button>
                    <button class="btn secondary" data-theme="light">ライト</button>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">📝 フォントサイズ</label>
                <div style="display: flex; gap: 10px;">
                    <button class="btn secondary" data-font="small">小</button>
                    <button class="btn" data-font="medium">中</button>
                    <button class="btn secondary" data-font="large">大</button>
                </div>
            </div>

            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🤖 AI プロバイダー</label>
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;" id="providerButtons">
                    ${providerButtonsHTML}
                </div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">モデル</label>
                <select class="input" id="modelSelect" style="width: 100%;">
                    <option>読み込み中...</option>
                </select>
            </div>

            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">💬 会話履歴管理</label>
                <div style="padding: 12px; border-radius: 8px; background: var(--hover-bg); margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span>履歴数: ${historyStatus.count} / ${historyStatus.max}</span>
                        ${historyStatus.shouldWarn ? '<span style="color: #ff9800;">⚠️ 多め</span>' : '<span style="color: #4caf50;">✅ 良好</span>'}
                    </div>
                    <div style="background: var(--bg-primary); border-radius: 4px; height: 6px; overflow: hidden;">
                        <div style="background: ${historyStatus.shouldWarn ? '#ff9800' : '#4caf50'}; height: 100%; width: ${(historyStatus.count / historyStatus.max) * 100}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                <button class="btn secondary" id="clearHistoryBtn" style="width: 100%;">🗑️ 会話履歴をクリア</button>
            </div>

            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">🔌 接続状態</label>
                <div id="connectionStatus" style="padding: 12px; border-radius: 8px; background: var(--hover-bg); font-size: 13px;">
                    確認中...
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">⚡ 利用可能な機能</label>
                <div style="padding: 12px; border-radius: 8px; background: var(--hover-bg); font-size: 13px;">
                    📝 create_file - ファイル作成<br>
                    📁 create_directory - ディレクトリ作成<br>
                    📖 read_file - ファイル読み込み<br>
                    ✏️ edit_file - ファイル編集<br>
                    📋 copy_file - ファイルコピー<br>
                    🔄 move_file - ファイル移動<br>
                    🗑️ delete_file - ファイル削除<br>
                    📋 list_files - ファイル一覧<br>
                    🔄 一括操作 - batch_delete/copy/move<br>
                    💬 会話履歴管理 - conversation_history<br>
                    🧠 カスタムプロンプト - システムプロンプト管理<br>
                </div>
            </div>
        `;

        // イベントリスナーを再設定
        this.setupSettingsEventListeners();
        this.updateSettingsUI();
        this.updateConnectionStatus();
    }

    // 設定イベントリスナー設定
    static setupSettingsEventListeners() {
        // テーマ変更
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                AppState.setState({ theme: e.target.dataset.theme });
                this.applyTheme();
            });
        });

        // フォントサイズ変更
        document.querySelectorAll('[data-font]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                AppState.setState({ fontSize: e.target.dataset.font });
                this.applyTheme();
            });
        });

        // プロバイダー変更
        document.querySelectorAll('[data-provider]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.target.dataset.provider;
                const defaultModel = AppState.availableProviders[provider]?.defaultModel || '';
                AppState.setState({
                    llmProvider: provider,
                    llmModel: defaultModel
                });
                this.updateSettingsUI();
            });
        });

        // モデル変更
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                AppState.setState({ llmModel: e.target.value });
            });
        }

        // 会話履歴クリア
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (confirm('会話履歴をすべてクリアしますか？')) {
                    ConversationHistory.clearHistory();
                    this.generateSettingsUI(); // UI再生成
                }
            });
        }
    }

    // 接続状態更新
    static async updateConnectionStatus() {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) return;

        try {
            const health = await APIClient.checkHealth();
            let statusHtml = `<strong>サーバー:</strong> ${health.status}<br>`;
            
            if (health.features) {
                statusHtml += `<strong>基本機能:</strong> ${health.features.basic_commands ? '✅' : '❌'}<br>`;
                statusHtml += `<strong>会話履歴:</strong> ${health.features.conversation_history ? '✅' : '❌'}<br>`;
                statusHtml += `<strong>一括操作:</strong> ${health.features.batch_operations ? '✅' : '❌'}<br>`;
                statusHtml += `<strong>コピー・移動:</strong> ${health.features.file_copy_move ? '✅' : '❌'}<br>`;
            }
            
            Object.entries(health.providers || {}).forEach(([provider, available]) => {
                const providerName = AppState.availableProviders[provider]?.name || provider;
                statusHtml += `<strong>${providerName}:</strong> ${available ? '✅ 利用可能' : '❌ APIキー未設定'}<br>`;
            });

            statusDiv.innerHTML = statusHtml;
        } catch (error) {
            statusDiv.innerHTML = `<strong>サーバー:</strong> ❌ 接続エラー<br>サーバーが起動していることを確認してください。`;
        }
    }
}