/* =========================================
    Markdown処理ユーティリティ
   ========================================= */

/*
## 概要
Markdown形式のテキストを処理するためのユーティリティ関数を提供するモジュール。

## 責任
- MarkdownからHTMLへの変換
- Markdownからプレーンテキストの抽出
- HTMLからMarkdownへの変換
- Markdownコンテンツの分析（目次生成、URL抽出、単語数カウント、読了時間推定）
*/

export class MarkdownUtils {
    // Markdown簡易パーサー
    static parse(text) {
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
    }

    // Markdownから平文テキストを抽出
    static toPlainText(markdown) {
        if (!markdown) return '';
        
        return markdown
            // コードブロック削除
            .replace(/```[\s\S]*?```/gim, '')
            // インラインコード削除
            .replace(/`[^`]+`/gim, '')
            // リンクをテキストのみに
            .replace(/\[([^\]]+)\]\([^)]+\)/gim, '$1')
            // マークアップ記号削除
            .replace(/[*_~`#\[\]()]/g, '')
            // 複数の空白・改行を単一スペースに
            .replace(/\s+/g, ' ')
            .trim();
    }

    // HTML to Markdown（基本的な変換）
    static fromHtml(html) {
        if (!html) return '';
        
        // テンポラリDIVでHTMLをパース
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        return this.processNode(tempDiv);
    }

    static processNode(node) {
        let result = '';
        
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                result += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                const childContent = this.processNode(child);
                
                switch (tagName) {
                    case 'h1':
                        result += `# ${childContent}\n\n`;
                        break;
                    case 'h2':
                        result += `## ${childContent}\n\n`;
                        break;
                    case 'h3':
                        result += `### ${childContent}\n\n`;
                        break;
                    case 'h4':
                        result += `#### ${childContent}\n\n`;
                        break;
                    case 'strong':
                    case 'b':
                        result += `**${childContent}**`;
                        break;
                    case 'em':
                    case 'i':
                        result += `*${childContent}*`;
                        break;
                    case 'code':
                        result += `\`${childContent}\``;
                        break;
                    case 'pre':
                        result += `\n\`\`\`\n${childContent}\n\`\`\`\n\n`;
                        break;
                    case 'a':
                        const href = child.getAttribute('href');
                        result += href ? `[${childContent}](${href})` : childContent;
                        break;
                    case 'p':
                        result += `${childContent}\n\n`;
                        break;
                    case 'br':
                        result += '\n';
                        break;
                    case 'ul':
                    case 'ol':
                        result += `${childContent}\n`;
                        break;
                    case 'li':
                        const isOrdered = child.closest('ol') !== null;
                        const prefix = isOrdered ? '1. ' : '- ';
                        result += `${prefix}${childContent}\n`;
                        break;
                    default:
                        result += childContent;
                        break;
                }
            }
        }
        
        return result;
    }

    // Markdownの目次生成
    static generateToc(markdown) {
        if (!markdown) return [];
        
        const headings = [];
        const lines = markdown.split('\n');
        
        lines.forEach((line, index) => {
            const match = line.match(/^(#+)\s(.+)$/);
            if (match) {
                const level = match[1].length;
                const text = match[2].trim();
                const id = this.generateId(text);
                
                headings.push({
                    level,
                    text,
                    id,
                    line: index + 1
                });
            }
        });
        
        return headings;
    }

    // ID生成（見出しから）
    static generateId(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // 英数字、空白、ハイフン以外を削除
            .replace(/\s+/g, '-') // 空白をハイフンに
            .replace(/--+/g, '-') // 連続ハイフンを単一に
            .replace(/^-+|-+$/g, ''); // 先頭・末尾のハイフン削除
    }

    // Markdown内の画像URL抽出
    static extractImageUrls(markdown) {
        if (!markdown) return [];
        
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const images = [];
        let match;
        
        while ((match = imageRegex.exec(markdown)) !== null) {
            images.push({
                alt: match[1] || '',
                url: match[2],
                fullMatch: match[0]
            });
        }
        
        return images;
    }

    // Markdown内のリンクURL抽出
    static extractLinkUrls(markdown) {
        if (!markdown) return [];
        
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const links = [];
        let match;
        
        while ((match = linkRegex.exec(markdown)) !== null) {
            links.push({
                text: match[1],
                url: match[2],
                fullMatch: match[0]
            });
        }
        
        return links;
    }

    // 文字数カウント（Markdown記号除外）
    static countWords(markdown) {
        const plainText = this.toPlainText(markdown);
        return plainText.split(/\s+/).filter(word => word.length > 0).length;
    }

    // 読了時間推定（平均200WPM）
    static estimateReadingTime(markdown, wordsPerMinute = 200) {
        const wordCount = this.countWords(markdown);
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        return minutes;
    }
}