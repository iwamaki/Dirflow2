/* =========================================
   AI File Manager - ユーティリティとAPI通信
   ========================================= */

// ユーティリティ関数
const Utils = {
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

    // Markdown簡易パーサー（拡張版）
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
    }
};

// API通信クラス
class APIClient {
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