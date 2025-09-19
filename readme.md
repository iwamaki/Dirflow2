# AI File Manager (RDD Architecture)

## 概要

このプロジェクトは、自然言語処理（LLM）を活用してファイルシステムを操作できるAIアシスタントアプリケーションです。ユーザーはチャットインターフェースを通じて、ファイルやディレクトリの作成、編集、削除、移動、コピー、Web検索などの操作を直感的に実行できます。バックエンドは責任駆動設計（RDD）に基づいたモジュール化されたアーキテクチャを採用し、フロントエンドはモダンなJavaScript、HTML、CSSで構築されたシングルページアプリケーション（SPA）です。

## 主要機能

*   **自然言語によるファイル/ディレクトリ操作**:
    *   ファイルおよびディレクトリの作成、読み込み、編集、コピー、移動、削除。
    *   一括ファイル操作（コピー、移動、削除）。
*   **Web検索機能**:
    *   Tavily Search、Google Custom Search、DuckDuckGo Searchなどの複数の検索プロバイダーを統合。
    *   検索結果の要約と分析。
*   **マルチエージェントシステム**:
    *   ユーザーの意図に基づいて最適な専門エージェント（ファイル操作、コンテンツ分析、Web検索、汎用アシスタント）を自動選択。
*   **カスタムシステムプロンプト管理**:
    *   ユーザーが独自のシステムプロンプトを登録・選択・管理し、AIの振る舞いをカスタマイズ可能。
*   **データ永続化**:
    *   IndexedDBによるファイルシステムデータの永続化。
    *   IndexedDBが利用できない環境では、自動的にメモリモードにフォールバック。
*   **会話履歴管理**:
    *   ユーザーとAIの会話履歴を保存・最適化し、コンテキストとして活用。
*   **ファイル内容のプレビューと編集**:
    *   ファイル内容の表示、編集モード、変更内容の差分表示機能。
*   **UIカスタマイズ**:
    *   テーマ（ダーク/ライト）およびフォントサイズの設定。

## アーキテクチャ

### バックエンド (`server/`)

Node.js (Express) を使用したAPIサーバーで、責任駆動設計（RDD）に基づき、各モジュールが明確な責任を持つように設計されています。

*   **`server.js`**:
    *   Expressアプリケーションのメインエントリポイント。
    *   Expressサーバーの初期設定、ミドルウェア（CORS, JSONパーサー, 静的ファイル配信）の適用。
    *   APIエンドポイント（`/api/chat`, `/api/llm-providers`, `/api/health`, `/api/agents`, `/api/system/status`, `/api/search/history`, `/api/search/providers`）のルーティング定義。
    *   `ChatOrchestrator`を介したチャットリクエストの処理。
    *   LLMプロバイダー情報、ヘルスチェック、システムステータスなどの提供。
    *   エラーハンドリングとサーバー起動ログの出力。
*   **`chat-orchestrator.js`**:
    *   チャット処理の全体フローを管理し、各専門サービス（`AgentDispatcher`, `ConversationManager`, `ContextBuilder`, `CommandValidator`）を協調させる責任を持つ。
    *   入力バリデーション、会話コンテキストの準備、エージェント処理の実行、コマンドの検証、最終レスポンスの構築を行う。
*   **`agent-dispatcher.js`**:
    *   ユーザーの意図を分析し、最適な専門エージェント（`file_operations`, `content_analysis`, `web_search`, `general_assistant`）を選択し、タスクの実行を制御する。
    *   LLM (`llm-adapter.js`経由) を利用してルーティング決定を行う。
    *   Web検索エージェントの実行と結果の要約生成も担当。
*   **`llm-adapter.js`**:
    *   Anthropic (Claude), OpenAI (GPT), Google (Gemini), Local LLM (Ollama) など、複数のLLMプロバイダーの差異を吸収し、統一されたインターフェースを提供する。
    *   APIキーの管理とプロバイダー固有のAPI呼び出しを抽象化。
    *   プロンプト形式の最適化 (`prompt-builder.js`を使用)。
*   **`prompt-builder.js`**:
    *   LLMリクエスト用のプロンプトを動的に構築する。
    *   システムプロンプト、カスタムプロンプト、会話履歴、コンテキスト情報（現在のパス、開いているファイルなど）を統合し、各LLMプロバイダーのAPI形式に合わせたプロンプトを生成。
*   **`command-validator.js`**:
    *   AIから提案されたコマンド（ファイル操作、Web検索など）の妥当性とセキュリティを検証する。
    *   許可されたアクションのチェック、パスのセキュリティチェック（ディレクトリトラバーサル防止など）、必須フィールドの検証、危険な操作（削除など）の検出と警告を行う。
*   **`conversation-manager.js`**:
    *   ユーザーとAI間の会話履歴を管理し、コンテキスト情報を整理する。
    *   履歴の最適化（最大履歴数、文字数制限）、コンテキストスイッチの検出、新しいチャット提案の判定を行う。
*   **`context-builder.js`**:
    *   APIレスポンスの構築、エラーハンドリング、フォールバック処理を行う。
    *   成功レスポンス、エラーレスポンス、フォールバックレスポンスを統一された形式で整形し、メタデータや警告メッセージを追加する。
*   **`response-utils.js`**:
    *   AI応答の構造化パーシング（JSON形式対応）、デモモード用のモック応答の提供、サーバーのヘルスステータス生成、チャット入力の基本バリデーション、サーバー起動ログの出力を行うユーティリティモジュール。
*   **`web-search-service.js`**:
    *   LangChainライブラリ（`@langchain/community/tools/tavily_search`, `duckduckgo_search`, `google_custom_search`）を使用したWeb検索機能を提供する。
    *   複数の検索プロバイダーを統合し、検索結果の整形、フィルタリング、検索履歴の保持を行う。

### フロントエンド (`public/`)

HTML、CSS、JavaScriptで構築されたシングルページアプリケーション（SPA）です。

*   **`index.html`**:
    *   アプリケーションのメインHTML構造。
    *   ヘッダー、ファイルリスト、ファイルビュー、チャット入力、FAB（Floating Action Button）メニュー、各種モーダル（設定、ファイル作成、名前変更、インポート、システムプロンプト管理）などのUI要素を定義。
    *   `src/core/app.js`をエントリポイントとして読み込む。
*   **`src/style.css`**:
    *   アプリケーション全体のスタイリングを定義。
    *   カラーパレット、ベーススタイル、レイアウト、共通コンポーネント（ボタン、入力フィールド、モーダル）、チャット、FABメニュー、差分表示、システムプロンプト管理UIなどのスタイルを含む。
    *   ダーク/ライトテーマ、フォントサイズ切り替えに対応。
*   **`src/core/app.js`**:
    *   アプリケーションの初期化と起動を担当。
    *   ストレージマネージャーの初期化、LLMプロバイダー情報の読み込み、テーマ・フォント設定の適用、イベントリスナーの登録、ファイルリストの読み込み、ウェルカムメッセージの表示を行う。
*   **`src/core/config.js`**:
    *   アプリケーション全体で使用される設定（IndexedDBの利用有無など）、ストレージマネージャーのシングルトンインスタンス、主要なDOM要素への参照（`elements`オブジェクト）を一元的に管理。
    *   `mockFileSystem`（移行用・フォールバック用）も定義。
*   **`src/core/state.js`**:
    *   アプリケーションの様々な状態（UI状態、ファイルシステム状態、設定、会話履歴など）を一元的に管理する。
    *   `AppState`オブジェクトで現在のパス、選択ファイル、UIモード、LLM設定などを保持。
    *   `ConversationHistory`クラスで会話履歴の追加、取得、クリア、永続化を行う。
*   **`src/api/client.js`**:
    *   バックエンドAPI (`/api/chat`, `/api/llm-providers`, `/api/health`) との通信を管理するクライアント。
    *   チャットメッセージの送信、利用可能なLLMプロバイダーの取得、APIのヘルスチェックを行う。
*   **`src/api/message-processor.js`**:
    *   ユーザーメッセージの送信、AI応答の受信、コマンド実行、メッセージ表示を担当。
    *   UIへのメッセージ表示（Markdownパース含む）、AIから受け取ったコマンドの実行とバリデーション、ローディング状態管理を行う。
    *   ファイルシステム操作（読み込み、編集、一覧表示など）を`FileManagerController`に委譲。
*   **`src/events/event-handlers.js`**:
    *   アプリケーション内の様々なUI要素からのイベント（クリック、キーボード入力など）を一元的に処理し、対応する機能を呼び出す。
    *   ファイル操作、FABメニュー、モーダル、プロンプト管理ドロワーの表示/非表示制御など。
*   **`src/file-system/file-manager.js`**:
    *   アプリケーション内のファイルシステムに対するCRUD操作およびファイル表示を管理。
    *   ファイルリストの読み込みとUI表示、ファイル/ディレクトリの作成、コピー、移動、削除、ファイル内容の読み込みと保存、ファイル選択、ファイルアイコンの取得、ファイルサイズのフォーマットを行う。
    *   `storageManager`を介して実際のストレージ操作を行う。
*   **`src/file-system/file-editor.js`**:
    *   ファイルの表示（ビューア）、編集、差分管理を統合したモジュール。
    *   拡張子に応じたファイル内容のレンダリング、編集モードとプレビューモードの切り替え、変更内容の差分検出・表示・適用、ファイル保存処理を行う。
*   **`src/prompts/prompt-manager.js`**:
    *   ユーザーが作成・管理するカスタムシステムプロンプトのライフサイクル（保存、取得、更新、削除）を管理。
    *   プロンプトの選択状態を管理し、ローカルストレージにデータを永続化。
*   **`src/prompts/prompt-ui.js`**:
    *   カスタムプロンプト管理に関連するUI要素の表示と操作を制御。
    *   システムプロンプト管理ドロワーの開閉、ドロワー内のセクション切り替え、カスタムプロンプト一覧の表示と更新、プロンプトの選択・編集・削除といったUIアクションのハンドリングを行う。
*   **`src/storage/storage-adapter.js`**:
    *   IndexedDBを使用したファイルシステムデータの永続化アダプター。
    *   IndexedDBの初期化と管理、ファイル/ディレクトリのCRUD操作、`mockFileSystem`からのデータ移行、ファイル/ディレクトリの移動とコピー、ストレージ統計情報の提供を行う。
*   **`src/ui/modals.js`**:
    *   アプリケーション内で使用される各種モーダルウィンドウの表示と非表示を制御。
    *   モーダル表示時の初期化処理（設定モーダル、システムプロンプトモーダルなど）も担当。
*   **`src/ui/navigation.js`**:
    *   アプリケーションの主要なナビゲーション要素（ヘッダー、FAB、チャット、選択モード）の表示と動作を制御。
    *   テーマ、フォントサイズ、LLMプロバイダーなどの設定UIの生成と更新、ファイル選択モードの制御、チャットオーバーレイの表示/非表示切り替えを行う。
*   **`src/utils/dom-helpers.js`**:
    *   DOM操作を簡素化し、再利用可能なヘルパー関数を提供する。
    *   HTMLエスケープ、要素の可視性チェック、スクロール調整、クラス/スタイル/属性の一括操作、要素の作成/削除、イベントリスナー設定など。
*   **`src/utils/helpers.js`**:
    *   アプリケーション全体で利用される汎用的なユーティリティ関数を提供する。
    *   パス結合、処理の遅延、オブジェクトのディープコピー、ユニークID生成、デバウンス/スロットル処理、文字列操作、日付フォーマットなど。
*   **`src/utils/markdown.js`**:
    *   Markdown形式のテキストを処理するためのユーティリティ関数を提供する。
    *   MarkdownからHTMLへの変換、プレーンテキストの抽出、目次生成、URL抽出、単語数カウント、読了時間推定など。

## データフローの例: ユーザーが「新しいファイルを作って」と指示した場合

1.  **フロントエンド (`public/index.html`, `public/src/api/message-processor.js`)**:
    *   ユーザーがチャット入力欄に「新しいファイルを作って」と入力し、送信ボタンをクリック。
    *   `MessageProcessor.sendMessage()`が呼び出され、ユーザーメッセージがUIに表示される。
2.  **APIクライアント (`public/src/api/client.js`)**:
    *   `APIClient.sendChatMessage()`がユーザーメッセージと現在のコンテキスト（現在のパス、開いているファイル情報、会話履歴、カスタムプロンプトなど）を収集し、バックエンドの`/api/chat`エンドポイントにPOSTリクエストを送信。
3.  **バックエンド (`server/server.js`)**:
    *   Expressサーバーが`/api/chat`リクエストを受信し、`ChatOrchestrator.processChat()`に処理を委譲。
4.  **チャットオーケストレーター (`server/chat-orchestrator.js`)**:
    *   入力バリデーションを行い、`ConversationManager` (`server/conversation-manager.js`) を使って会話コンテキストを準備。
    *   `AgentDispatcher.dispatch()`を呼び出し、ユーザーの意図分析とエージェント選択を依頼。
5.  **エージェントディスパッチャー (`server/agent-dispatcher.js`)**:
    *   ユーザーメッセージとコンテキストを基に、`LLMAdapter` (`server/llm-adapter.js`) を介してLLMに問い合わせる。
    *   LLMは「新しいファイルを作って」という意図を分析し、`file_operations`エージェントを選択し、`create_file`コマンドを提案するJSON応答を生成する。
    *   `PromptBuilder` (`server/prompt-builder.js`) がLLMへのプロンプトを構築する際に、カスタムプロンプトや会話履歴、ファイルシステムコンテキストを統合する。
6.  **チャットオーケストレーター (`server/chat-orchestrator.js`)**:
    *   LLMから返されたコマンド（例: `{"action": "create_file", "path": "new_file.txt", "content": ""}`）を`CommandValidator` (`server/command-validator.js`) で検証。セキュリティ上の問題がないか、必須フィールドが揃っているかなどをチェック。
    *   検証済みのコマンドとAIの応答メッセージを`ContextBuilder` (`server/context-builder.js`) で整形し、フロントエンドに返却。
7.  **フロントエンド (`public/src/api/message-processor.js`)**:
    *   `MessageProcessor`がバックエンドからのAI応答メッセージをUIに表示。
    *   受け取ったコマンド（`create_file`）を`MessageProcessor.executeCommands()`で実行。
8.  **ファイルマネージャーコントローラー (`public/src/file-system/file-manager.js`)**:
    *   `FileManagerController.createFile()`が呼び出される。
    *   `storageManager` (`public/src/core/config.js`) を介して、実際のストレージ操作を行う`StorageAdapter` (`public/src/storage/storage-adapter.js`) を呼び出す。
9.  **ストレージアダプター (`public/src/storage/storage-adapter.js`)**:
    *   IndexedDBに新しいファイルエントリを作成し、内容を保存。
10. **ファイルマネージャーコントローラー (`public/src/file-system/file-manager.js`)**:
    *   ファイルリストを再読み込みし、UI (`public/index.html`の`fileList`部分) を更新して、新しく作成されたファイルを表示する。

## 開発ガイドライン (LLM向け)

このアプリケーションのコードベースを修正する際、以下のガイドラインを厳守してください。これにより、コードの一貫性、保守性、および機能の安定性が保たれます。

1.  **既存のコードスタイルと命名規則に従う**:
    *   キャメルケース（`someVariable`, `someFunction`）、パスカルケース（`SomeClass`）など、既存の命名規則を尊重してください。
    *   インデント、スペース、改行などのフォーマットは、既存のファイルに合わせてください。
    *   コメントのスタイル（JSDoc形式のブロックコメント、行コメント）も既存のパターンに従ってください。
2.  **責任駆動設計（RDD）の原則を尊重する**:
    *   各モジュール（ファイル）は明確な単一の責任を持つように設計されています。新しい機能を追加する際や既存の機能を変更する際は、その責任範囲を逸脱しないように注意してください。
    *   モジュール間の依存関係は最小限に保ち、明確なインターフェースを通じて通信するようにしてください。
3.  **フロントエンドとバックエンドの連携を理解する**:
    *   フロントエンドのUI操作がバックエンドのどのAPIエンドポイントを呼び出し、どのバックエンドモジュールが処理を行うかを常に意識してください。
    *   APIリクエスト/レスポンスの形式は、`client.js`と`context-builder.js`、`response-utils.js`で定義されているものに準拠してください。
4.  **状態管理 (`AppState`, `ConversationHistory`) の適切な利用**:
    *   アプリケーションのグローバルな状態は`public/src/core/state.js`の`AppState`および`ConversationHistory`で管理されています。これらのオブジェクトを直接変更する際は、副作用を最小限に抑え、`AppState.setState()`のような提供されたメソッドを使用してください。
    *   状態変更がUIにどのように反映されるかを考慮してください。
5.  **ファイルシステム操作 (`FileManagerController`, `StorageAdapter`) の安全性**:
    *   ファイルシステムに対する操作は、`FileManagerController`を介して行われ、最終的には`StorageAdapter`がIndexedDBまたはメモリ上で実行します。これらの操作はユーザーデータに直接影響するため、特に慎重に扱ってください。
    *   `CommandValidator` (`server/command-validator.js`) によるセキュリティチェックの重要性を理解し、迂回するような変更は行わないでください。
6.  **マルチエージェントシステムへの統合**:
    *   新しいAI機能を追加する場合、`server/agent-dispatcher.js`の`SPECIALIST_AGENTS`に新しいエージェントを定義し、`ROUTER_SYSTEM_PROMPT`を更新して、そのエージェントが適切にルーティングされるようにしてください。
    *   エージェントは、`llm-adapter.js`を介してLLMと通信し、JSON形式でコマンドとメッセージを返すように設計してください。
7.  **UIコンポーネントの再利用と一貫性**:
    *   UIを変更する際は、`public/src/style.css`で定義されている既存のスタイルクラスや変数（`--bg-primary`など）を積極的に利用してください。
    *   `public/src/ui/modals.js`や`public/src/ui/navigation.js`などのUI関連モジュールで提供されているヘルパー関数やパターンに従ってください。
8.  **ユーティリティ関数の活用**:
    *   `public/src/utils/dom-helpers.js`や`public/src/utils/helpers.js`、`public/src/utils/markdown.js`には、汎用的なヘルパー関数が多数用意されています。車輪の再発明を避け、これらのユーティリティを積極的に活用してください。
9.  **エラーハンドリングとロギング**:
    *   エラーが発生した場合は、適切にキャッチし、ユーザーに分かりやすいメッセージを`MessageProcessor.addMessage('system', ...)`で表示してください。
    *   デバッグ情報や重要な処理のログは`console.log`や`console.error`を使用して出力し、問題の特定に役立ててください。
10. **テストの重要性**:
    *   現状、明示的なテストファイルは確認できませんでしたが、将来的にテストが導入されることを想定し、変更はテスト容易性を考慮して行ってください。可能であれば、変更内容を検証するためのテストコードを追加することを検討してください。

---
**このREADME.mdは、AI File Managerプロジェクトの全体像を理解し、効果的にコードを修正するための包括的なガイドとして機能します。**