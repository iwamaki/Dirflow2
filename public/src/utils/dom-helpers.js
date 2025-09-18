/* =========================================
    DOM操作ユーティリティ
   ========================================= */

/*
## 概要
DOM（Document Object Model）操作を簡素化し、再利用可能なヘルパー関数を提供するモジュール。HTMLエスケープ、要素の可視性チェック、スクロール調整、クラス・スタイル・属性の一括操作、要素の作成・削除、イベントリスナー設定など、多岐にわたる機能を提供する。

## 主要機能
- **クラス**: DOMHelpers (DOM操作に関するユーティリティメソッドを提供する)
- **主要メソッド**:
  - `escapeHtml(text)`: テキストをHTMLエスケープする。
  - `isElementVisible(element)`: 要素が現在表示されているかどうかをチェックする。
  - `scrollIntoView(element, options)`: 要素がビューポート内にスクロールされるように調整する。
  - `toggleClass(elements, className, force)`: 要素のクラスを切り替える（複数要素対応）。
  - `setStyles(element, styles)`: 要素のスタイルを複数同時に設定する。
  - `setAttributes(element, attributes)`: 要素の属性を複数同時に設定する。
  - `createElement(tagName, options)`: 新しいDOM要素を作成し、クラス、属性、スタイル、内容、子要素を一度に設定する。
  - `addEventListeners(element, events)`: 要素に複数のイベントリスナーを一括で設定する。
  - `getFormData(form)`: フォーム要素からデータをオブジェクトとして取得する。
  - `removeElement(element)`: 指定されたDOM要素を削除する。
  - `$(selector, context)`: `querySelector` のショートハンド。
  - `$(selector, context)`: `querySelectorAll` のショートハンドで、結果を配列として返す。
  - `isDescendant(child, parent)`: ある要素が別の要素の子孫であるかをチェックする。
  - `getElementPosition(element)`: 要素の画面上の位置とサイズを取得する。
  - `fadeIn(element, duration)`: 要素をフェードインさせるアニメーション。
  - `fadeOut(element, duration)`: 要素をフェードアウトさせるアニメーション。

## 依存関係
- **インポート**: なし
- **エクスポート**: DOMHelpersクラス

## 特記事項
- 汎用性: 特定のUIコンポーネントに依存せず、様々なDOM操作に利用できる汎用的なヘルパー関数を提供する。
- コードの簡素化: 複雑になりがちなDOM操作を簡潔なAPIで提供し、コードの可読性と保守性を向上させる。
- パフォーマンス: アニメーション機能など、ユーザー体験を向上させるための機能も含まれる。
*/

export class DOMHelpers {
    // HTMLエスケープ
    static escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 要素の可視性チェック
    static isElementVisible(element) {
        return element.offsetWidth > 0 && element.offsetHeight > 0;
    }

    // 要素のスクロール位置を調整
    static scrollIntoView(element, options = {}) {
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }

    // クラスの切り替え（複数要素対応）
    static toggleClass(elements, className, force = null) {
        const elementList = Array.isArray(elements) ? elements : [elements];
        
        elementList.forEach(element => {
            if (element && element.classList) {
                if (force !== null) {
                    element.classList.toggle(className, force);
                } else {
                    element.classList.toggle(className);
                }
            }
        });
    }

    // 要素のスタイル設定（複数プロパティ対応）
    static setStyles(element, styles) {
        if (!element || !styles) return;
        
        Object.entries(styles).forEach(([property, value]) => {
            element.style[property] = value;
        });
    }

    // 要素の属性設定（複数属性対応）
    static setAttributes(element, attributes) {
        if (!element || !attributes) return;
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                element.removeAttribute(key);
            } else {
                element.setAttribute(key, value);
            }
        });
    }

    // 要素の作成（属性・クラス・内容を一度に設定）
    static createElement(tagName, options = {}) {
        const element = document.createElement(tagName);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.attributes) {
            this.setAttributes(element, options.attributes);
        }
        
        if (options.styles) {
            this.setStyles(element, options.styles);
        }
        
        if (options.textContent) {
            element.textContent = options.textContent;
        }
        
        if (options.innerHTML) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.children) {
            options.children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }

    // イベントリスナーの一括設定
    static addEventListeners(element, events) {
        if (!element || !events) return;
        
        Object.entries(events).forEach(([eventType, handler]) => {
            element.addEventListener(eventType, handler);
        });
    }

    // フォームデータの取得
    static getFormData(form) {
        if (!form) return {};
        
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }

    // 要素の削除（存在チェック付き）
    static removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    // クエリセレクターの簡略化
    static $(selector, context = document) {
        return context.querySelector(selector);
    }

    static $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    }

    // 要素が特定の親要素の子かどうかチェック
    static isDescendant(child, parent) {
        if (!child || !parent) return false;
        
        let node = child.parentNode;
        while (node !== null) {
            if (node === parent) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    // 要素の位置情報取得
    static getElementPosition(element) {
        if (!element) return { top: 0, left: 0, width: 0, height: 0 };
        
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }

    // 要素のアニメーション（シンプルなfade）
    static fadeIn(element, duration = 300) {
        if (!element) return;
        
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            
            element.style.opacity = Math.min(progress / duration, 1);
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300) {
        if (!element) return;
        
        let start = null;
        const initialOpacity = parseFloat(window.getComputedStyle(element).opacity) || 1;
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            
            element.style.opacity = initialOpacity * (1 - Math.min(progress / duration, 1));
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }
}