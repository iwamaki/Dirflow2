/* =========================================
    カスタムプロンプト管理
   ========================================= */

/*
## 概要
ユーザーが作成・管理するカスタムシステムプロンプトの保存、取得、更新、削除といったライフサイクルを管理するモジュール。ローカルストレージを利用してプロンプトデータを永続化する。

## 主要機能
- **クラス**: SystemPromptManager (カスタムプロンプトのCRUD操作と選択状態を管理する)
- **主要メソッド**:
  - `getAllPrompts()`: ローカルストレージから全てのカスタムプロンプトを取得する。
  - `savePrompt(promptData)`: 新しいカスタムプロンプトを生成し、ローカルストレージに保存する。
  - `updatePrompt(id, updates)`: 指定されたIDのカスタムプロンプトを更新する。
  - `deletePrompt(id)`: 指定されたIDのカスタムプロンプトを削除する。
  - `getPromptById(id)`: 指定されたIDのカスタムプロンプトを返す。
  - `getSelectedPrompt()`: 現在選択されているカスタムプロンプトを返す。
  - `selectPrompt(id)`: 指定されたIDのプロンプトを選択状態にする。
  - `deselectPrompt()`: 現在のプロンプト選択を解除する。
  - `toggleCustomPrompt()`: カスタムプロンプトの使用を有効/無効を切り替える。
  - `refreshCache()`: `AppState` 内のカスタムプロンプトキャッシュを最新の状態に更新する。

## 依存関係
- **インポート**: `AppState` (from '../core/state.js'): アプリケーションの状態管理。
- **エクスポート**: SystemPromptManagerクラス

## 特記事項
- 永続化: 全てのプロンプトデータはブラウザのローカルストレージにJSON形式で保存される。
- 状態管理との連携: `AppState` と密接に連携し、プロンプトの選択状態やキャッシュをリアルタイムで更新する。
- ID管理: 各プロンプトには一意のタイムスタンプベースのIDが割り当てられる。
*/

import { AppState } from '../core/state.js';

// カスタムプロンプト管理クラス
export class SystemPromptManager {
    static STORAGE_KEY = 'ai-file-manager-system-prompts';

    // 全プロンプトを取得
    static getAllPrompts() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load prompts:', error);
            return [];
        }
    }

    // プロンプトを保存
    static savePrompt(promptData) {
        try {
            const prompts = this.getAllPrompts();
            const newPrompt = {
                id: Date.now().toString(),
                name: promptData.name,
                content: promptData.content,
                description: promptData.description || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            prompts.push(newPrompt);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prompts));
            
            // キャッシュ更新
            AppState.setState({ customPrompts: prompts });
            
            return newPrompt;
        } catch (error) {
            console.error('Failed to save prompt:', error);
            throw error;
        }
    }

    // プロンプトを更新
    static updatePrompt(id, updates) {
        try {
            const prompts = this.getAllPrompts();
            const index = prompts.findIndex(p => p.id === id);
            if (index === -1) {
                throw new Error('プロンプトが見つかりません');
            }
            
            prompts[index] = {
                ...prompts[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prompts));
            AppState.setState({ customPrompts: prompts });
            
            return prompts[index];
        } catch (error) {
            console.error('Failed to update prompt:', error);
            throw error;
        }
    }

    // プロンプトを削除
    static deletePrompt(id) {
        try {
            const prompts = this.getAllPrompts();
            const filtered = prompts.filter(p => p.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            
            // 選択されているプロンプトが削除された場合はリセット
            if (AppState.selectedPromptId === id) {
                AppState.setState({ 
                    selectedPromptId: null,
                    isCustomPromptEnabled: false
                });
            }
            
            AppState.setState({ customPrompts: filtered });
            return true;
        } catch (error) {
            console.error('Failed to delete prompt:', error);
            throw error;
        }
    }

    // IDでプロンプトを取得
    static getPromptById(id) {
        const prompts = this.getAllPrompts();
        return prompts.find(p => p.id === id) || null;
    }

    // 選択されたプロンプトを取得
    static getSelectedPrompt() {
        if (!AppState.selectedPromptId) return null;
        return this.getPromptById(AppState.selectedPromptId);
    }

    // プロンプト選択
    static selectPrompt(id) {
        const prompt = this.getPromptById(id);
        if (prompt) {
            AppState.setState({ 
                selectedPromptId: id,
                isCustomPromptEnabled: true 
            });
            return prompt;
        }
        return null;
    }

    // プロンプト選択解除
    static deselectPrompt() {
        AppState.setState({ 
            selectedPromptId: null,
            isCustomPromptEnabled: false 
        });
    }

    // カスタムプロンプトの有効/無効切り替え
    static toggleCustomPrompt() {
        const newEnabled = !AppState.isCustomPromptEnabled;
        AppState.setState({ isCustomPromptEnabled: newEnabled });
        
        // 有効になったが選択されたプロンプトがない場合は警告
        if (newEnabled && !AppState.selectedPromptId) {
            console.warn('カスタムプロンプトが有効になりましたが、プロンプトが選択されていません');
            return false;
        }
        
        return newEnabled;
    }

    // プロンプトキャッシュを更新
    static refreshCache() {
        const prompts = this.getAllPrompts();
        AppState.setState({ customPrompts: prompts });
        return prompts;
    }
}