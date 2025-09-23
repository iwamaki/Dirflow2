/* =========================================
    汎用ヘルパー関数
   ========================================= */

/*
## 概要
アプリケーション全体で利用される汎用的なユーティリティ関数を提供するモジュール。

## 責任
- パスセグメントの結合と正規化
- 処理の遅延
- オブジェクトのディープコピー
- ユニークIDの生成
- デバウンスおよびスロットル処理
*/

export class Helpers {
    // 遅延実行
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // パス結合
    static joinPath(basePath, ...segments) {
        let result = basePath.replace(/\/+$/, ''); // 末尾のスラッシュ削除
        for (const segment of segments) {
            if (segment) {
                result += '/' + segment.replace(/^\/+/, ''); // 先頭のスラッシュ削除
            }
        }
        return result || '/';
    }

    // デバウンス関数
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    // スロットル関数
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ディープコピー（シンプル版）
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            Object.keys(obj).forEach(key => {
                clonedObj[key] = this.deepClone(obj[key]);
            });
            return clonedObj;
        }
        return obj;
    }

    // オブジェクトの比較（shallow）
    static shallowEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        if (!obj1 || !obj2) return false;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        for (let key of keys1) {
            if (obj1[key] !== obj2[key]) return false;
        }
        
        return true;
    }

    // ランダムID生成
    static generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // UUID生成（v4）
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 文字列の切り詰め
    static truncate(str, length, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length - suffix.length) + suffix;
    }

    // 文字列のケバブケース変換
    static toKebabCase(str) {
        if (!str) return '';
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[_\s]+/g, '-')
            .toLowerCase();
    }

    // 文字列のキャメルケース変換
    static toCamelCase(str) {
        if (!str) return '';
        return str
            .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    }

    // 文字列のパスカルケース変換
    static toPascalCase(str) {
        const camel = this.toCamelCase(str);
        return camel.charAt(0).toUpperCase() + camel.slice(1);
    }

    // 数値のフォーマット（カンマ区切り）
    static formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return num.toLocaleString();
    }

    // バイト数の人間が読みやすい形式への変換
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // 日付のフォーマット
    static formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        const d = new Date(date);
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    // 相対時間の表示
    static timeAgo(date) {
        if (!date) return '';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) return '今';
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffHours < 24) return `${diffHours}時間前`;
        if (diffDays < 30) return `${diffDays}日前`;
        
        return this.formatDate(date, 'YYYY/MM/DD');
    }

    // 配列のシャッフル
    static shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // 配列の重複削除
    static uniqueArray(array) {
        return [...new Set(array)];
    }

    // オブジェクト配列の重複削除（キー指定）
    static uniqueArrayByKey(array, key) {
        const seen = new Set();
        return array.filter(item => {
            const keyValue = item[key];
            if (seen.has(keyValue)) return false;
            seen.add(keyValue);
            return true;
        });
    }

    // 配列のグループ化
    static groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
        }, {});
    }

    // クエリパラメータの解析
    static parseQueryString(query) {
        if (!query) return {};
        
        const params = {};
        const pairs = query.replace(/^\?/, '').split('&');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        
        return params;
    }

    // クエリパラメータの構築
    static buildQueryString(params) {
        if (!params || Object.keys(params).length === 0) return '';
        
        const pairs = Object.entries(params)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        
        return pairs.length ? `?${pairs.join('&')}` : '';
    }

    // ローカルストレージの安全な操作
    static storage = {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('LocalStorage get error:', error);
                return defaultValue;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.warn('LocalStorage set error:', error);
                return false;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('LocalStorage remove error:', error);
                return false;
            }
        },
        
        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.warn('LocalStorage clear error:', error);
                return false;
            }
        }
    };

    // 値の検証
    static isEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static isUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    // パフォーマンス測定
    static measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
}