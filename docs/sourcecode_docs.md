# AI File Managerコード仕様書

## ディレクトリ構造

```
public/
├── index.html
└── src/
    ├── style.css
    ├── api/
    │   ├── client.js
    │   └── message-processor.js
    ├── core/
    │   ├── app.js
    │   ├── config.js
    │   └── state.js
    ├── events/
    │   └── event-handlers.js
    ├── file-system/
    │   ├── diff-viewer.js
    │   └── file-manager.js
    ├── prompts/
    │   ├── prompt-manager.js
    │   └── prompt-ui.js
    ├── ui/
    │   ├── file-view.js
    │   ├── modals.js
    │   └── navigation.js
    └── utils/
        ├── dom-helpers.js
        ├── helpers.js
        └── markdown.js
server/
├── llm-providers.js
├── prompt-builder.js
├── response-utils.js
└── server.js
```

## コード仕様

### public/

#### public/index.html

#### public/src/style.css

#### public/src/api/client.js: API通信クライアント

##### 概要
LLMプロバイダーとのAPI通信を管理するクライアントクラス

##### 主要機能
- **クラス**: APIClient (静的メソッドのみ)
- **主要メソッド**:
  - `sendChatMessage(message, context)`: チャットメッセージを送信し、会話履歴を管理
  - `loadProviders()`: 利用可能なLLMプロバイダーを取得し、AppStateに設定
  - `checkHealth()`: APIのヘルスチェックを実行

##### 依存関係
- **インポート**:
  - `AppState` (from '../core/state.js'): LLMプロバイダーやモデルの状態管理 
   - 使用メソッド: setState, get llmProvider, llmModel
  - `ConversationHistory` (from '../core/state.js'): 会話履歴の管理
   - 使用メソッド: getHistory, addExchange
- **エクスポート**: APIClientクラス

##### 特記事項
- エラーハンドリング: fetch失敗時にコンソールエラー出力と例外スロー
- 状態同期: AppStateとConversationHistoryを自動更新
- 非同期処理: すべてのメソッドがPromiseベース

#### public/src/api/message-processor.js: メッセージ処理・コマンド実行

##### 概要
ユーザーメッセージの送信、AI応答の受信、コマンド実行、メッセージ表示を担当するクラス。

##### 主要機能
- **クラス**: MessageProcessor (静的メソッドのみ)
- **主要メソッド**:
  - `addMessage(type, content)`: UIにメッセージを表示。システムメッセージはフィルタリングされる場合あり。
  - `sendMessage()`: ユーザーメッセージを送信し、AI応答を取得、表示、コマンドを実行。
  - `getCustomPromptContext()`: カスタムプロンプトのコンテキストを取得。
  - `executeCommands(commands)`: AIから受け取ったコマンドを順次実行。
  - `validateCommand(command)`: コマンドのバリデーション（アクション、パスのセキュリティチェック）。
  - `executeCommand(command)`: 個別のコマンド（ファイル操作など）を実行。
  - `readFile(path)`: ファイルの内容を読み込む。
  - `editFile(path, content)`: ファイルの内容を編集し、差分表示を更新。
  - `listFiles(path)`: 指定されたパスのファイル一覧を取得。
  - `getCurrentFileList()`: 現在のディレクトリのファイルリストを取得。
  - `getCurrentFileContent()`: 現在編集中のファイルの内容を取得。
  - `setLoading(loading)`: ローディング状態を設定し、UIを更新。
  - `joinPath(basePath, ...segments)`: パスを結合するヘルパーメソッド。

##### 依存関係
- **インポート**:
  - `elements`, `mockFileSystem` (from '../core/config.js'): UI要素とモックファイルシステム。
  - `AppState`, `ConversationHistory`, `SystemPromptManager` (from '../core/state.js'): アプリケーションの状態、会話履歴、システムプロンプト管理。
  - `MarkdownUtils` (from '../utils/markdown.js'): Markdownのパース。
  - `APIClient` (from './client.js'): API通信クライアント。
  - `FileManagerController` (from '../file-system/file-manager.js'): ファイルシステム操作。
  - `DiffViewer` (from '../file-system/diff-viewer.js'): 差分表示。
- **エクスポート**: MessageProcessorクラス

##### 特記事項
- メッセージフィルタリング: システムメッセージはUI表示キーワードに基づいてフィルタリングされる。
- コマンド実行: AIからのコマンドを動的に実行し、ファイルシステム操作を行う。
- エラーハンドリング: コマンド実行時やAPI通信時のエラーを捕捉し、ユーザーに通知。
- 状態管理: AppStateと連携し、アプリケーションの状態（ローディング、ファイル情報など）を更新。
- セキュリティ: コマンド実行前にパスのセキュリティチェックを実施。
- 差分表示: ファイル編集時にDiffViewerと連携し、変更内容を視覚的に表示。

#### public/src/core/app.js: アプリケーション初期化

##### 概要
AI File Managerアプリケーションの初期化と起動を担当するクラス。各種コンポーネントの初期設定、イベントリスナーの登録、初期メッセージの表示を行う。

##### 主要機能
- **クラス**: App (静的メソッドのみ)
- **主要メソッド**:
  - `init()`: アプリケーションの初期化処理を実行。プロバイダーの読み込み、テーマ適用、イベントリスナー設定、ファイルリスト読み込み、ウェルカムメッセージ表示を行う。
  - `showWelcomeMessage()`: アプリケーション起動時のウェルカムメッセージをAI応答形式で表示。現在のAI設定や利用可能なコマンドの概要をユーザーに伝える。
  - `showErrorMessage(error)`: 初期化中に発生したエラーメッセージをUIに表示。

##### 依存関係
- **インポート**:
  - `AppState`, `ConversationHistory` (from './state.js'): アプリケーションの状態管理と会話履歴。
  - `APIClient` (from '../api/client.js'): API通信クライアント。
  - `NavigationController` (from '../ui/navigation.js'): UIナビゲーションとテーマ適用。
  - `FileManagerController` (from '../file-system/file-manager.js'): ファイルシステム操作。
  - `MessageProcessor` (from '../api/message-processor.js'): メッセージの表示と処理。
  - `EventHandlers` (from '../events/event-handlers.js'): イベントリスナーの登録。
- **エクスポート**: Appクラス

##### 特記事項
- DOMContentLoadedイベント: DOMの読み込み完了後に `App.init()` が自動的に実行される。
- エラーハンドリング: 初期化失敗時にエラーメッセージを表示し、コンソールにも出力。
- ユーザーガイダンス: ウェルカムメッセージを通じて、アプリケーションの機能と使い方をユーザーに提示。

#### public/src/core/config.js: 設定とグローバルデータ

##### 概要
アプリケーション全体で使用される設定、モックデータ、およびDOM要素への参照を一元的に管理するモジュール。

##### 主要機能
- **定数**: mockFileSystem (モックファイルシステムデータ)
- **定数**: elements (主要なDOM要素への参照を格納するオブジェクト)

##### 依存関係
- **インポート**: なし
- **エクスポート**: mockFileSystem, elements

##### 特記事項
- モックデータ: `mockFileSystem` はデモンストレーション用のファイルシステム構造と内容を提供する。
- DOM要素参照: `elements` オブジェクトは、アプリケーションのUIコンポーネントにアクセスするための便利な一元化された参照を提供する。
- グローバルアクセス: これらの定数は、アプリケーションの様々な部分から直接インポートして利用される。

#### public/src/core/state.js: 状態管理

##### 概要
アプリケーションの様々な状態（UI状態、ファイルシステム状態、設定、会話履歴など）を一元的に管理するモジュール。`AppState` オブジェクトと `ConversationHistory` クラスを提供する。

##### 主要機能
- **オブジェクト**: AppState (アプリケーションの現在の状態を保持し、更新・保存する)
- **クラス**: ConversationHistory (ユーザーとAI間の会話履歴を管理し、永続化する)
- **主要メソッド (AppState)**:
  - `setState(updates)`: AppStateのプロパティを更新し、設定をローカルストレージに保存する。
  - `saveSettings()`: 現在のAppStateの設定をローカルストレージに保存する。
- **主要メソッド (ConversationHistory)**:
  - `addExchange(userMessage, aiResponse)`: 会話のやり取りを履歴に追加し、履歴数を制限する。
  - `getHistory()`: 現在の会話履歴を返す。
  - `clearHistory()`: 会話履歴をクリアする。
  - `save()`: 会話履歴をローカルストレージに保存する。
  - `shouldWarnAboutHistory()`: 会話履歴が警告閾値を超えているか判定する。
  - `getHistoryStatus()`: 会話履歴の現在の状態（件数、最大数、警告フラグ）を返す。

##### 依存関係
- **インポート**: `SystemPromptManager` (from '../prompts/prompt-manager.js')
- **エクスポート**: AppState, ConversationHistory, SystemPromptManager

##### 特記事項
- 永続化: `AppState` の設定と `ConversationHistory` はローカルストレージに保存され、アプリケーションを再起動しても状態が維持される。
- 状態の一元管理: アプリケーションのほぼ全ての動的なデータがこのモジュールで管理される。
- 循環依存の回避: `MessageProcessor` との循環依存を避けるため、`MessageProcessor` は `window` オブジェクト経由で参照される場合がある。
- プロンプト管理: `SystemPromptManager` は別のモジュールに移動されたが、後方互換性のためここからもエクスポートされる。

#### public/src/events/event-handlers.js: イベント処理統合

##### 概要
アプリケーション内の様々なUI要素からのイベントを一元的に処理し、対応する機能（ナビゲーション、ファイル操作、モーダル表示など）を呼び出すクラス。

##### 主要機能
- **クラス**: EventHandlers (静的メソッドのみ)
- **主要メソッド**:
  - `init()`: アプリケーション起動時に全ての主要なイベントリスナーを設定する。ヘッダーボタン、チャット入力、FABメニュー、ファイル作成/リネーム/インポート、システムプロンプト関連、モーダル閉じる、ESCキー操作など、多岐にわたるイベントを網羅する。
  - `togglePromptDrawer()`: プロンプト管理ドロワーの表示/非表示を切り替える。
  - `handleSaveClick()`: ファイル編集内容の保存ボタンがクリックされた際の処理。変更がある場合は差分表示モードに切り替え、ユーザーに確認を促す。
  - `toggleEditMode()`: ファイル内容の編集モードとプレビューモードを切り替える。差分モードからの復帰もサポート。
  - `getOriginalFileContent()`: 現在編集中のファイルのオリジナルコンテンツを取得する。
  - `handleFileAction(action)`: ファイル操作（コピー、移動、リネーム、削除、一括操作）を実行する。
  - `handleCreateFile()`: ファイルまたはディレクトリの作成処理を実行する。
  - `handleRename()`: ファイルまたはディレクトリの名前変更処理を実行する。
  - `toggleFabMenu()`: FAB（Floating Action Button）メニューの表示/非表示を切り替える。
  - `handleFabMenuClick(e)`: FABメニュー内の項目がクリックされた際の処理。ファイル作成、インポート、システムプロンプトモーダルの表示など。
  - `handleImport()`: ファイルのインポート処理を実行する。
  - `handleSystemPrompt()`: システムプロンプトの登録または更新処理を実行する。

##### 依存関係
- **インポート**:
  - `elements`, `mockFileSystem` (from '../core/config.js'): DOM要素参照とモックファイルシステムデータ。
  - `AppState`, `SystemPromptManager` (from '../core/state.js'): アプリケーションの状態管理とシステムプロンプト管理。
  - `Helpers` (from '../utils/helpers.js'): ユーティリティ関数。
  - `NavigationController` (from '../ui/navigation.js'): UIナビゲーション制御。
  - `ModalController` (from '../ui/modals.js'): モーダル表示制御。
  - `FileViewController` (from '../ui/file-view.js'): ファイル内容表示制御。
  - `FileManagerController` (from '../file-system/file-manager.js'): ファイルシステム操作。
  - `DiffViewer` (from '../file-system/diff-viewer.js'): 差分表示機能。
  - `MessageProcessor` (from '../api/message-processor.js'): メッセージ処理。
  - `PromptUIController` (from '../prompts/prompt-ui.js'): プロンプトUI制御。
- **エクスポート**: EventHandlersクラス

##### 特記事項
- イベントの一元管理: アプリケーションのほとんどのユーザーインタラクションがこのクラスで処理される。
- 状態との連携: `AppState` を利用してアプリケーションの状態を適切に更新し、UIの挙動を制御する。
- モーダルとドロワー: 各種モーダルやドロワーの表示/非表示、およびそれらの中での操作も管理する。
- ファイル操作の統合: 単一ファイル操作から一括操作まで、幅広いファイルシステム関連イベントを処理する。

#### public/src/file-system/diff-viewer.js: 差分表示・管理

##### 概要
ファイルの内容変更における差分を検出し、視覚的に表示・管理するためのモジュール。ユーザーが変更ブロックを選択的に適用できる機能を提供する。

##### 主要機能
- **クラス**: DiffManager (差分ブロックの選択状態を管理し、選択された変更のみを適用する)
- **クラス**: DiffViewer (差分表示モードの制御、差分生成、HTMLレンダリング、選択された変更の適用を行う)
- **主要メソッド (DiffManager)**:
  - `initializeDiff()`: 差分表示の初期化。デフォルトですべての変更ブロックを選択状態にする。
  - `toggleBlockSelection(blockId)`: 特定の変更ブロックの選択状態を切り替える。
  - `toggleAllSelection()`: 全ての変更ブロックの選択/解除を切り替える。
  - `updateAllCheckboxes()`: 全ての差分チェックボックスのUI状態を更新する。
  - `updateSelectionUI()`: 選択状態に応じたUI（ボタンのテキスト、適用ボタンの有効/無効）を更新する。
  - `generateSelectedContent()`: 選択された変更ブロックのみを適用して新しいファイル内容を生成する。
  - `reset()`: 選択状態をリセットする。
- **主要メソッド (DiffViewer)**:
  - `setDiffMode(enabled, originalContent, newContent)`: 差分表示モードの有効/無効を切り替える。有効化時には差分を生成し、UIを更新する。
  - `generateDiff(originalText, newText)`: 2つのテキスト間の行単位の差分を生成する（LCSアルゴリズムを使用）。
  - `computeLCS(arr1, arr2)`: 最長共通部分列（LCS）を計算する。
  - `renderDiffAsHtml(diffArray)`: 生成された差分データをHTML形式でレンダリングする。
  - `showDiffView()`: 差分ビューをUIに表示する。
  - `applySelectedChanges()`: ユーザーが選択した変更ブロックのみをファイルに適用し、保存する。

##### 依存関係
- **インポート**:
  - `elements`, `mockFileSystem` (from '../core/config.js'): DOM要素参照とモックファイルシステムデータ。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `DOMHelpers` (from '../utils/dom-helpers.js'): DOM操作ヘルパー。
  - `NavigationController` (from '../ui/navigation.js'): UIナビゲーション制御。
  - `FileViewController` (from '../ui/file-view.js'): ファイル内容表示制御。
  - `FileManagerController` (from './file-manager.js'): ファイル操作管理。
- **エクスポート**: DiffManager, DiffViewerクラス

##### 特記事項
- 選択的適用: ユーザーは差分表示された変更の中から、適用したい部分だけを選択してファイルに反映できる。
- LCSアルゴリズム: 差分検出には最長共通部分列（LCS）アルゴリズムが用いられている。
- UI統合: `AppState` と連携し、編集モードからの差分表示、差分からの編集モード復帰など、シームレスなUI体験を提供する。

#### public/src/file-system/file-manager.js: ファイル操作管理

##### 概要
アプリケーション内のファイルシステム（モックデータ）に対するCRUD操作（作成、読み込み、更新、削除）およびファイル表示を管理するモジュール。ファイルリストの表示、ファイルアイコンの取得、ファイル選択、ファイル内容の保存などの機能を提供する。

##### 主要機能
- **クラス**: FileManagerController (ファイルシステム操作と表示を制御する)
- **主要メソッド**:
  - `loadFileList()`: 現在のパスに基づいてファイルリストを読み込み、UIに表示する。
  - `displayFiles(files)`: 指定されたファイルリストをUIにレンダリングする。
  - `createFileItem(file)`: 個々のファイルまたはディレクトリのDOM要素を作成する。
  - `selectFile(file, itemElement)`: ファイルを選択状態にする（単一選択・複数選択対応）。
  - `handleFileClick(file, event)`: ファイルまたはディレクトリがクリックされた際の処理。ディレクトリの場合は移動、ファイルの場合は開く。
  - `openFile(filename)`: 指定されたファイルの内容を読み込み、ファイルビューに表示する。
  - `getFileIcon(file)`: ファイルの拡張子に基づいて適切なアイコン（絵文字）を返す。
  - `createFile(filePath, content)`: 指定されたパスに新しいファイルを作成する。中間ディレクトリも自動作成。
  - `createDirectory(dirPath)`: 指定されたパスに新しいディレクトリを作成する。中間ディレクトリも自動作成。
  - `copyFile(sourcePath, destPath)`: ファイルまたはディレクトリをコピーする。
  - `moveFile(sourcePath, destPath)`: ファイルまたはディレクトリを移動する（コピー後に元を削除）。
  - `deleteFile(filePath)`: 指定されたファイルまたはディレクトリを削除する。
  - `formatFileSize(bytes)`: バイト数を読みやすい形式（KB, MBなど）にフォーマットする。
  - `saveFile()`: 現在編集中のファイルの内容を保存する。

##### 依存関係
- **インポート**:
  - `elements`, `mockFileSystem` (from '../core/config.js'): DOM要素参照とモックファイルシステムデータ。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `Helpers` (from '../utils/helpers.js'): ユーティリティ関数。
  - `FileViewController` (from '../ui/file-view.js'): ファイル内容表示制御。
  - `NavigationController` (from '../ui/navigation.js'): UIナビゲーション制御。
- **エクスポート**: FileManagerControllerクラス

##### 特記事項
- モックファイルシステム: 実際のファイルシステムではなく、`mockFileSystem` オブジェクト（`config.js`で定義）を操作する。
- UIとの連携: `FileViewController` や `NavigationController` と密接に連携し、ファイル操作の結果をUIに反映させる。
- 複数選択と長押し: ユーザーがファイルを複数選択したり、長押しで操作メニューを表示したりする機能に対応。
- パス解決: 相対パスと絶対パスの両方に対応し、適切なファイルパスを解決する。

#### public/src/prompts/prompt-manager.js: カスタムプロンプト管理

##### 概要
ユーザーが作成・管理するカスタムシステムプロンプトの保存、取得、更新、削除といったライフサイクルを管理するモジュール。ローカルストレージを利用してプロンプトデータを永続化する。

##### 主要機能
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

##### 依存関係
- **インポート**: `AppState` (from '../core/state.js'): アプリケーションの状態管理。
- **エクスポート**: SystemPromptManagerクラス

##### 特記事項
- 永続化: 全てのプロンプトデータはブラウザのローカルストレージにJSON形式で保存される。
- 状態管理との連携: `AppState` と密接に連携し、プロンプトの選択状態やキャッシュをリアルタイムで更新する。
- ID管理: 各プロンプトには一意のタイムスタンプベースのIDが割り当てられる。

#### public/src/prompts/prompt-ui.js: プロンプトUI制御

##### 概要
カスタムプロンプト管理に関連するUI要素（ドロワー、プロンプト一覧、モーダルなど）の表示と操作を制御するモジュール。`SystemPromptManager` と連携し、ユーザーがプロンプトを視覚的に管理できるようにする。

##### 主要機能
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

##### 依存関係
- **インポート**:
  - `elements` (from '../core/config.js'): DOM要素参照。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `SystemPromptManager` (from './prompt-manager.js'): カスタムプロンプトの管理ロジック。
  - `DOMHelpers` (from '../utils/dom-helpers.js'): DOM操作ヘルパー。
- **エクスポート**: PromptUIControllerクラス

##### 特記事項
- UIとロジックの分離: プロンプトデータの管理は `SystemPromptManager` が行い、このモジュールはUIの表示とユーザーインタラクションに特化している。
- 動的なUI更新: プロンプトの追加、更新、削除、選択に応じて、プロンプト一覧やステータス表示がリアルタイムで更新される。
- 編集モード: 既存プロンプトの編集時には、新規作成セクションを再利用し、ボタンのテキストやデータ属性を切り替えることで編集モードを表現する。

#### public/src/ui/file-view.js: ファイル表示・編集制御

##### 概要
ファイルの内容表示と編集モードの切り替え、および関連するUI要素の制御を行うモジュール。ファイルビューモードの有効化/無効化、ファイル内容の表示（Markdownレンダリング、プレーンテキスト、編集用テキストエリア）、差分表示モードとの連携などを担当する。

##### 主要機能
- **クラス**: FileViewController (ファイルビューの表示と編集を制御する)
- **主要メソッド**:
  - `setFileViewMode(enabled)`: ファイルビューモードの有効/無効を切り替える。ファイルリストとファイルビューの表示を切り替え、ヘッダーボタンの表示状態を調整する。
  - `showFileContent(content, filename)`: 指定されたファイルの内容をUIに表示する。ファイルの種類（Markdown、プレーンテキスト）に応じてレンダリング方法を切り替え、編集モードの場合はテキストエリアを表示する。

##### 依存関係
- **インポート**:
  - `elements` (from '../core/config.js'): DOM要素参照。
  - `AppState` (from '../core/state.js'): アプリケーションの状態管理。
  - `MarkdownUtils` (from '../utils/markdown.js'): Markdownコンテンツのパースユーティリティ。
  - `DOMHelpers` (from '../utils/dom-helpers.js'): DOM操作ヘルパー。
  - `NavigationController` (from './navigation.js'): UIナビゲーション制御。
- **エクスポート**: FileViewControllerクラス

##### 特記事項
- モード切り替え: ファイルビューモード、編集モード、差分表示モードの間でUIが適切に切り替わるように制御する。
- コンテンツ表示: Markdownファイルはレンダリングされ、その他のファイルはプレーンテキストとして表示される。編集モードではテキストエリアが提供される。
- 状態管理との連携: `AppState` を利用して現在のモードや編集状態を管理し、UIの挙動に反映させる。

#### public/src/ui/modals.js: モーダル制御

##### 概要
アプリケーション内で使用される各種モーダルウィンドウの表示と非表示を制御するモジュール。モーダル表示時に必要な初期化処理や、モーダル間の連携も管理する。

##### 主要機能
- **クラス**: ModalController (モーダルウィンドウの表示・非表示を制御する)
- **主要メソッド**:
  - `showModal(modalId)`: 指定されたIDのモーダルを表示する。設定モーダルやシステムプロンプトモーダルなど、特定のモーダルに対しては追加の初期化処理を実行する。
  - `hideModal(modalId)`: 指定されたIDのモーダルを非表示にする。システムプロンプトモーダルの場合は、関連するドロワーも閉じる。
  - `hideAllModals()`: 現在表示されている全てのモーダルを非表示にする。関連するドロワーも閉じる。

##### 依存関係
- **インポート**: `NavigationController` (from './navigation.js'): UIナビゲーション制御。
- **エクスポート**: ModalControllerクラス

##### 特記事項
- 一元管理: アプリケーション内の全てのモーダル表示ロジックを一元的に管理する。
- 連携: `NavigationController` や `PromptUIController` と連携し、モーダル表示に伴うUIの状態変化や初期化を適切に処理する。
- 柔軟性: `modalId` を引数として受け取ることで、任意のモーダルを制御できる汎用性を持つ。

#### public/src/ui/navigation.js: ナビゲーション・ヘッダー・FAB制御

##### 概要
アプリケーションの主要なナビゲーション要素（ヘッダー、FAB、チャット、選択モード）の表示と動作を制御するモジュール。テーマやフォントサイズ、LLMプロバイダーなどの設定UIの生成と更新も担当する。

##### 主要機能
- **クラス**: NavigationController (ナビゲーションと主要UI要素の表示を制御する)
- **主要メソッド**:
  - `applyTheme()`: 現在のテーマとフォントサイズをDOMに適用し、設定UIを更新する。
  - `updatePromptToggleButton()`: カスタムプロンプトの有効/無効状態に応じてプロンプト切り替えボタンの表示を更新する。
  - `updateSaveButtonState()`: ファイルの変更状態に応じて保存ボタンの表示を更新する。
  - `setSelectionMode(enabled, multiSelect)`: ファイル選択モードの有効/無効を切り替える。複数選択にも対応し、アクションボタンの表示を制御する。
  - `updateActionButtons(count)`: 選択されたファイルの数に応じて、アクションボタンに表示するボタンを更新する。
  - `setupActionEventListeners()`: アクションボタンに対するイベントリスナーを設定する。
  - `toggleChat()`: チャットオーバーレイの表示/非表示を切り替える。
  - `updateSettingsUI()`: 設定モーダル内のUI要素（テーマ、フォントサイズ、LLMプロバイダー、モデル選択）の状態を更新する。
  - `generateSettingsUI()`: 設定モーダル内のコンテンツを動的に生成し、イベントリスナーを設定する。
  - `setupSettingsEventListeners()`: 設定モーダル内のUI要素に対するイベントリスナーを設定する。
  - `updateConnectionStatus()`: APIクライアントの接続状態と利用可能な機能をチェックし、設定モーダルに表示する。

##### 依存関係
- **インポート**:
  - `elements` (from '../core/config.js'): DOM要素参照。
  - `AppState`, `ConversationHistory`, `SystemPromptManager` (from '../core/state.js'): アプリケーションの状態管理、会話履歴、システムプロンプト管理。
  - `APIClient` (from '../api/client.js'): API通信クライアント。
- **エクスポート**: NavigationControllerクラス

##### 特記事項
- UIの一元制御: ヘッダー、FAB、チャット、設定モーダルなど、アプリケーションの主要なUI要素の表示と動作をこのモジュールで一元的に管理する。
- 状態との連携: `AppState` を利用してUIの状態を管理し、ユーザーの操作やアプリケーションの状態変化に応じてUIを動的に更新する。
- 設定管理: テーマ、フォントサイズ、LLMプロバイダーなどのユーザー設定をUIに反映させ、変更を処理する。
- 接続状態表示: バックエンドAPIとの接続状態や利用可能な機能に関する情報をユーザーに提供する。

#### public/src/utils/dom-helpers.js: DOM操作ユーティリティ

##### 概要
DOM（Document Object Model）操作を簡素化し、再利用可能なヘルパー関数を提供するモジュール。HTMLエスケープ、要素の可視性チェック、スクロール調整、クラス・スタイル・属性の一括操作、要素の作成・削除、イベントリスナー設定など、多岐にわたる機能を提供する。

##### 主要機能
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

##### 依存関係
- **インポート**: なし
- **エクスポート**: DOMHelpersクラス

##### 特記事項
- 汎用性: 特定のUIコンポーネントに依存せず、様々なDOM操作に利用できる汎用的なヘルパー関数を提供する。
- コードの簡素化: 複雑になりがちなDOM操作を簡潔なAPIで提供し、コードの可読性と保守性を向上させる。
- パフォーマンス: アニメーション機能など、ユーザー体験を向上させるための機能も含まれる。

#### public/src/utils/helpers.js: 汎用ヘルパーユーティリティ

##### 概要
アプリケーション全体で利用される汎用的なヘルパー関数を提供するモジュール。非同期処理、文字列操作、データ構造操作、ローカルストレージ管理、パフォーマンス測定など、多岐にわたる機能を含む。

##### 主要機能
- **クラス**: Helpers (汎用的なユーティリティメソッドを提供する)
- **主要メソッド**:
  - `delay(ms)`: 指定されたミリ秒数だけ処理を遅延させる非同期関数。
  - `joinPath(basePath, ...segments)`: パスセグメントを結合して正規化されたパス文字列を生成する。
  - `debounce(func, wait, immediate)`: デバウンス関数。連続して呼び出された場合、最後の呼び出しから一定時間後に一度だけ実行する。
  - `throttle(func, limit)`: スロットル関数。一定時間内に一度だけ関数が実行されるように制限する。
  - `deepClone(obj)`: オブジェクトをディープコピーする（シンプルな実装）。
  - `shallowEqual(obj1, obj2)`: 2つのオブジェクトがシャロー比較で等しいかチェックする。
  - `generateId(length)`: 指定された長さのランダムな文字列IDを生成する。
  - `generateUUID()`: UUID (Universally Unique Identifier) v4を生成する。
  - `truncate(str, length, suffix)`: 文字列を指定された長さに切り詰める。
  - `toKebabCase(str)`: 文字列をケバブケースに変換する。
  - `toCamelCase(str)`: 文字列をキャメルケースに変換する。
  - `toPascalCase(str)`: 文字列をパスカルケースに変換する。
  - `formatNumber(num)`: 数値をロケールに応じたカンマ区切りでフォーマットする。
  - `formatBytes(bytes, decimals)`: バイト数を人間が読みやすい形式（KB, MBなど）に変換する。
  - `formatDate(date, format)`: 日付を指定されたフォーマット文字列で整形する。
  - `timeAgo(date)`: 指定された日付から現在までの相対時間（例: 「5分前」）を計算する。
  - `shuffleArray(array)`: 配列をシャッフルする。
  - `uniqueArray(array)`: 配列から重複する要素を削除する。
  - `uniqueArrayByKey(array, key)`: オブジェクトの配列から指定されたキーに基づいて重複を削除する。
  - `groupBy(array, keyFn)`: 配列の要素を指定されたキーまたは関数に基づいてグループ化する。
  - `parseQueryString(query)`: クエリ文字列をパースしてオブジェクトに変換する。
  - `buildQueryString(params)`: オブジェクトからクエリ文字列を構築する。
  - `storage`: ローカルストレージを安全に操作するためのユーティリティオブジェクト（get, set, remove, clear）。
  - `isEmail(email)`: 文字列が有効なメールアドレス形式か検証する。
  - `isUrl(url)`: 文字列が有効なURL形式か検証する。
  - `isValidJson(str)`: 文字列が有効なJSON形式か検証する。
  - `measurePerformance(name, fn)`: 関数の実行パフォーマンスを測定する。

##### 依存関係
- **インポート**: なし
- **エクスポート**: Helpersクラス

##### 特記事項
- 汎用性: UI、データ処理、ストレージなど、アプリケーションの様々な層で利用される基本的なユーティリティを提供する。
- コードの再利用性: 頻繁に必要となる処理を関数として提供することで、コードの重複を避け、保守性を高める。
- 安全な操作: ローカルストレージ操作にはエラーハンドリングが含まれており、堅牢性を向上させている。

#### public/src/utils/markdown.js: Markdown処理ユーティリティ

##### 概要
Markdown形式のテキストを処理するためのユーティリティ関数を提供するモジュール。MarkdownからHTMLへの変換、プレーンテキストの抽出、HTMLからMarkdownへの変換、目次生成、画像・リンクURLの抽出、文字数カウント、読了時間推定など、多岐にわたる機能を含む。

##### 主要機能
- **クラス**: MarkdownUtils (Markdown処理に関するユーティリティメソッドを提供する)
- **主要メソッド**:
  - `parse(text)`: Markdown形式のテキストを簡易的にHTMLに変換する。
  - `toPlainText(markdown)`: Markdownから書式設定を除去したプレーンテキストを抽出する。
  - `fromHtml(html)`: HTMLを基本的なMarkdown形式に変換する。
  - `processNode(node)`: `fromHtml` で使用される再帰的なノード処理関数。
  - `generateToc(markdown)`: Markdownの見出しから目次データを生成する。
  - `generateId(text)`: 見出しテキストからURLフレンドリーなIDを生成する。
  - `extractImageUrls(markdown)`: Markdown内の画像URLを抽出する。
  - `extractLinkUrls(markdown)`: Markdown内のリンクURLを抽出する。
  - `countWords(markdown)`: Markdownから抽出したプレーンテキストの単語数をカウントする。
  - `estimateReadingTime(markdown, wordsPerMinute)`: Markdownの読了時間を推定する。

##### 依存関係
- **インポート**: なし
- **エクスポート**: MarkdownUtilsクラス

##### 特記事項
- 簡易パーサー: 完全なMarkdownパーサーではないが、一般的なMarkdown記法に対応し、HTMLへの変換やテキスト抽出を効率的に行う。
- 双方向変換: MarkdownとHTML間の基本的な変換機能を提供し、コンテンツの柔軟な扱いを可能にする。
- コンテンツ分析: 目次生成、画像・リンク抽出、単語数カウント、読了時間推定など、Markdownコンテンツの分析に役立つ機能を提供する。

### server/

#### server/llm-providers.js: LLMプロバイダー設定・API呼び出し処理

##### 概要
大規模言語モデル（LLM）プロバイダー（Claude, OpenAI, Gemini, Local LLM）の設定、API呼び出し、および応答の解析を一元的に管理するモジュール。

##### 主要機能
- **定数**: LLM_PROVIDERS: 各LLMプロバイダーのAPI情報、利用可能なモデル、デフォルトモデルを定義。
- **関数**: callClaudeAPI(message, model, context): Claude APIを呼び出し、応答を処理。
- **関数**: callOpenAIAPI(message, model, context): OpenAI APIを呼び出し、応答を処理。
- **関数**: callGeminiAPI(message, model, context): Gemini APIを呼び出し、応答を処理。
- **関数**: callLocalLLMAPI(message, model, context): ローカルLLM APIを呼び出し、応答を処理。
- **関数**: parseStructuredResponse(response): LLMからの構造化された応答（JSON形式）を解析し、メッセージとコマンドを抽出。
- **関数**: handleChatRequest(message, provider, model, context): メインのチャット処理関数。選択されたLLMプロバイダーのAPIを呼び出し、応答を解析して返却。

##### 依存関係
- **インポート**:
  - `createPromptBuilder`, `logPromptDebugInfo` (from './prompt-builder.js'): プロンプト構築とデバッグ情報ロギングに使用。
- **エクスポート**: LLM_PROVIDERS, callClaudeAPI, callOpenAIAPI, callGeminiAPI, callLocalLLMAPI, parseStructuredResponse, handleChatRequest

##### 特記事項
- 複数のLLMプロバイダーに対応し、柔軟な切り替えが可能。
- 環境変数からAPIキーを読み込むことでセキュリティを確保。
- プロンプト構築ロジックを`prompt-builder.js`に分離し、再利用性を高めている。
- LLMからの応答にJSON形式のコマンドが含まれる場合、それを解析して実行可能なコマンドとして抽出。
- 会話履歴が長くなった場合に新しいチャットを提案する機能。
- カスタムプロンプトの使用状況をログ出力するデバッグ機能。
- 各API呼び出しにおけるエラーハンドリングと、構造化応答のパースエラー処理。

#### server/prompt-builder.js

##### 概要
大規模言語モデル（LLM）へのリクエストに使用するプロンプトを、システムプロンプト、カスタムプロンプト、会話履歴、現在のコンテキスト情報に基づいて動的に構築するモジュール。

##### 主要機能
- **定数**: SYSTEM_PROMPTS: ファイルマネージャーの基本指示、コンテキストテンプレート、カスタムプロンプト統合指示を定義。
- **定数**: CONTEXT_TEMPLATES: 基本、カスタムプロンプトあり、ファイルオープン時のコンテキスト情報テンプレートを定義。
- **クラス**: PromptBuilder: プロンプト構築のロジックをカプセル化。
    - `setSystemPrompt(promptKey)`: ベースとなるシステムプロンプトを設定。
    - `setCustomPrompt(customPrompt)`: ユーザー定義のカスタムプロンプトを設定。
    - `setContext(context)`: 現在のアプリケーションコンテキスト（ディレクトリ、ファイル情報など）を設定。
    - `setConversationHistory(history)`: 過去の会話履歴を設定。
    - `setMaxHistoryItems(max)`: 会話履歴の最大数を設定。
    - `setUserMessage(message)`: ユーザーからの現在のメッセージを設定。
    - `_replaceTemplateVars(text, context)`: テンプレート内の変数を実際の値に置換。
    - `buildSystemPrompt()`: ベースプロンプトとカスタムプロンプトを統合した最終的なシステムプロンプトを構築。
    - `buildContextInfo()`: 現在のコンテキスト情報（ディレクトリ、ファイルなど）を構築。
    - `buildConversationHistory(provider)`: LLMプロバイダーの形式に合わせて会話履歴を構築。
    - `buildFinalUserMessage()`: 最終的なユーザーメッセージとコンテキスト情報を結合。
    - `buildForProvider(provider)`: 指定されたLLMプロバイダー向けの完全なプロンプト構造を構築。
- **関数**: createPromptBuilder(): `PromptBuilder`のインスタンスを生成するファクトリー関数。
- **関数**: logPromptDebugInfo(promptData, provider): デバッグ用に構築されたプロンプトデータをコンソールに出力。

##### 依存関係
- **インポート**: なし
- **エクスポート**: SYSTEM_PROMPTS, CONTEXT_TEMPLATES, PromptBuilder, createPromptBuilder, logPromptDebugInfo

##### 特記事項
- 複数のLLMプロバイダー（Claude, OpenAI, Gemini, Local LLM）の異なるプロンプト形式に対応。
- ユーザーのカスタムプロンプトとファイル操作指示を柔軟に統合。
- 現在のファイルシステムの状態や開いているファイルの情報などをプロンプトに含めることで、LLMがより適切な応答を生成できるように支援。
- 会話履歴を管理し、プロンプトの長さを最適化。
- デバッグフラグに応じて、構築されたプロンプトの詳細をログ出力する機能。

#### server/response-utils.js: レスポンス処理・バリデーション・ユーティリティ

##### 概要
AIからの応答の解析、コマンドのバリデーション、ヘルスチェックステータスの生成、エラー処理、サーバー起動ログ出力など、サーバーサイドの応答処理とユーティリティ機能を提供するモジュール。

##### 主要機能
- **関数**: parseStructuredResponse(response): AIからの応答文字列を解析し、JSON形式の構造化データ（メッセージとコマンド）を抽出。JSON形式でない場合はメッセージとして扱う。
- **関数**: validateCommand(command): AIから提案されたコマンドの妥当性を検証。アクションのホワイトリストチェック、パスのセキュリティチェック、必須フィールドの有無などを確認。
- **関数**: getMockResponse(message, context): API接続エラー時やデモモード時に使用されるフォールバック用のモック応答を生成。
- **関数**: generateHealthStatus(): サーバーのヘルスチェックステータスを生成。LLMプロバイダーのAPIキー設定状況や利用可能な機能を示す。
- **関数**: validateChatInput(message, provider, model, context): チャットリクエストの入力パラメータ（メッセージ、プロバイダー、モデル、コンテキスト）をバリデーション。
- **関数**: formatApiError(error, provider, message, context): API呼び出し中に発生したエラーを整形し、ユーザーに返すエラー応答を生成。モック応答をフォールバックとして利用。
- **関数**: logServerStart(port, providers): サーバー起動時に、ポート番号、利用可能なLLMプロバイダー、APIキー設定状況、利用可能な機能などをコンソールにログ出力。

##### 依存関係
- **インポート**: なし
- **エクスポート**: parseStructuredResponse, validateCommand, getMockResponse, generateHealthStatus, validateChatInput, formatApiError, logServerStart

##### 特記事項
- AIからの応答がJSON形式であるかどうかにかかわらず、柔軟に処理できるパーサーを提供。
- コマンド実行におけるセキュリティを確保するため、厳格なバリデーションルールを適用。
- 開発時やAPIキー未設定時でも基本的な動作を確認できるよう、モック応答機能を提供。
- サーバーの状態を外部から確認できるヘルスチェック機能。
- サーバー起動時の詳細なログ出力により、設定状況や機能の可用性を一目で確認可能。

#### server/server.js: Express設定・ルーティング・メイン処理

##### 概要
Expressフレームワークを使用してAI File Managerのバックエンドサーバーを構築するモジュール。APIエンドポイントの定義、ミドルウェアの設定、チャットリクエストの処理、ヘルスチェック、エラーハンドリング、サーバー起動ロジックを含む。

##### 主要機能
- **Expressアプリケーション**: `app`: Expressアプリケーションインスタンス。
- **ミドルウェア設定**: CORS、JSONボディパーシング、静的ファイルの提供。
- **APIエンドポイント**:
    - `GET /api/llm-providers`: 利用可能なLLMプロバイダーとモデルのリストを返却。
    - `POST /api/chat`: ユーザーからのチャットリクエストを受け付け、LLMプロバイダーに処理を委譲し、応答を返却。
    - `GET /api/health`: サーバーのヘルスチェックステータスを返却。
- **エラーハンドリング**: グローバルなエラーハンドリングミドルウェアを設定し、サーバーエラーを捕捉して適切な応答を返す。
- **サーバー起動**: 指定されたポートでサーバーをリッスンし、起動ログを出力。

##### 依存関係
- **インポート**:
    - `express` (from 'express'): Webアプリケーションフレームワーク。
    - `cors` (from 'cors'): クロスオリジンリソース共有を有効にするミドルウェア。
    - `path` (from 'path'): パス操作ユーティリティ。
    - `fileURLToPath` (from 'url'): `import.meta.url`からファイルパスを取得。
    - `dotenv` (from 'dotenv'): `.env`ファイルから環境変数をロード。
    - `LLM_PROVIDERS`, `handleChatRequest` (from './llm-providers.js'): LLMプロバイダーの設定とチャットリクエスト処理。
    - `validateChatInput`, `generateHealthStatus`, `formatApiError`, `logServerStart` (from './response-utils.js'): 応答処理、バリデーション、ヘルスチェック、エラー整形、ログ出力ユーティリティ。
- **エクスポート**: `app` (Expressアプリケーションインスタンス)

##### 特記事項
- ES6モジュール形式で`__dirname`を安全に取得。
- 環境変数（`.env`ファイル）から設定を読み込み、APIキーなどを管理。
- `llm-providers.js`と`response-utils.js`に処理を委譲することで、関心の分離とコードのモジュール化を実現。
- API呼び出し中のエラーを捕捉し、ユーザーフレンドリーなフォールバック応答を提供する。
- 開発環境と本番環境で異なるエラーメッセージを表示する設定。