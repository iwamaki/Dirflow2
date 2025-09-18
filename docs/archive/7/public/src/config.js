/* =========================================
   AI File Manager - 設定とグローバルデータ (ES6 Module)
   ========================================= */

// モックデータ（デモ用）- ディレクトリ構造
export const mockFileSystem = {
    '/workspace': [
        {
            name: 'README.md',
            type: 'file',
            size: '1.2 KB',
            content: '# AIファイルマネージャー - 拡張版\n\n## 新機能\n* Claude API統合\n* 会話履歴管理\n* ファイルコピー・移動\n* ディレクトリ作成\n* 一括操作\n* 複数選択\n* JSON形式レスポンス対応\n* セキュリティ強化\n\n## 使い方\n\n### 基本コマンド\n* **ファイル作成**: "新しいファイルを作って"、"sample.txt を作成して"\n* **ディレクトリ作成**: "docs フォルダを作って"、"新しいフォルダを作成"\n* **ファイル読み込み**: "README.md を読んで"、"ファイルの内容を表示して"\n* **ファイル編集**: "README.md を編集して"、"内容を変更して"\n* **ファイルコピー**: "ファイルをコピーして"、"backup フォルダにコピー"\n* **ファイル移動**: "ファイルを移動して"、"別のフォルダに移動"\n* **ファイル削除**: "sample.txt を削除して"、"不要なファイルを消して"\n* **ファイル一覧**: "ファイル一覧を表示して"、"何があるか教えて"\n\n### 一括操作\n* **一括削除**: "全ての .txt ファイルを削除して"\n* **一括コピー**: "画像ファイル全部を images フォルダにコピー"\n* **一括移動**: "古いファイルを全部 archive に移動"\n\n### 自然な会話例\n* "プロジェクト用の docs フォルダを作って、README.md も作成して"\n* "設定ファイルconfig.jsonを作って、デフォルト値を入れて"\n* "このディレクトリにあるファイルを教えて"\n* "画像ファイルを全部 images フォルダに整理して"\n\n**help** と入力すると詳細なコマンド一覧を確認できます。'
        },
        {
            name: 'docs',
            type: 'directory',
            size: ''
        },
        {
            name: 'images',
            type: 'directory',
            size: ''
        }
    ],
    '/workspace/docs': [
        {
            name: 'guide.md',
            type: 'file',
            size: '0.8 KB',
            content: '# ユーザーガイド\n\nAI File Manager の使い方について説明します。'
        }
    ],
    '/workspace/images': []
};

// DOM要素参照
export const elements = {
    // ヘッダー
    backBtn: document.getElementById('backBtn'),
    saveBtn: document.getElementById('saveBtn'),
    editBtn: document.getElementById('editBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    currentPath: document.getElementById('currentPath'),
    selectionInfo: document.getElementById('selectionInfo'),

    // メインコンテンツ
    fileListContainer: document.getElementById('fileListContainer'),
    fileList: document.getElementById('fileList'),
    fileView: document.getElementById('fileView'),
    fileContent: document.getElementById('fileContent'),

    // ボトムナビ
    chatContainer: document.getElementById('chatContainer'),
    actionContainer: document.getElementById('actionContainer'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    cancelBtn: document.getElementById('cancelBtn'),

    // FAB・チャット
    fabBtn: document.getElementById('fabBtn'),
    fabMenuOverlay: document.getElementById('fabMenuOverlay'),
    fabMenu: document.getElementById('fabMenu'),
    chatOverlay: document.getElementById('chatOverlay'),
    chatMessages: document.getElementById('chatMessages'),
    chatCloseBtn: document.getElementById('chatCloseBtn'),

    // モーダル
    settingsModal: document.getElementById('settingsModal'),
    createModal: document.getElementById('createModal'),
    renameModal: document.getElementById('renameModal'),
    importModal: document.getElementById('importModal'),
    systemPromptModal: document.getElementById('systemPromptModal'),
    filePathInput: document.getElementById('filePathInput'),
    fileContentInput: document.getElementById('fileContentInput'),
    renameInput: document.getElementById('renameInput'),
    createFileBtn: document.getElementById('createFileBtn'),
    renameFileBtn: document.getElementById('renameFileBtn'),
    
    // インポート関連
    fileImportInput: document.getElementById('fileImportInput'),
    importPathInput: document.getElementById('importPathInput'),
    confirmImport: document.getElementById('confirmImport'),
    
    // システムプロンプト関連
    promptNameInput: document.getElementById('promptNameInput'),
    promptContentInput: document.getElementById('promptContentInput'),
    promptDescriptionInput: document.getElementById('promptDescriptionInput'),
    confirmSystemPrompt: document.getElementById('confirmSystemPrompt')
};