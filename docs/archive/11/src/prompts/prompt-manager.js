/* =========================================
    カスタムプロンプト管理
   ========================================= */

/*
## 概要
ユーザーが作成・管理するカスタムシステムプロンプトのライフサイクルを管理するモジュール。

## 責任
- カスタムプロンプトの保存、取得、更新、削除（CRUD操作）
- プロンプトの選択状態の管理
- ローカルストレージを利用したプロンプトデータの永続化
- AppStateとの連携によるプロンプトキャッシュの更新
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