/* =========================================
    モーダル制御
   ========================================= */

/*
## 概要
アプリケーション内で使用される各種モーダルウィンドウの表示と非表示を制御するモジュール。モーダル表示時に必要な初期化処理や、モーダル間の連携も管理する。

## 主要機能
- **クラス**: ModalController (モーダルウィンドウの表示・非表示を制御する)
- **主要メソッド**:
  - `showModal(modalId)`: 指定されたIDのモーダルを表示する。設定モーダルやシステムプロンプトモーダルなど、特定のモーダルに対しては追加の初期化処理を実行する。
  - `hideModal(modalId)`: 指定されたIDのモーダルを非表示にする。システムプロンプトモーダルの場合は、関連するドロワーも閉じる。
  - `hideAllModals()`: 現在表示されている全てのモーダルを非表示にする。関連するドロワーも閉じる。

## 依存関係
- **インポート**: `NavigationController` (from './navigation.js'): UIナビゲーション制御。
- **エクスポート**: ModalControllerクラス

## 特記事項
- 一元管理: アプリケーション内の全てのモーダル表示ロジックを一元的に管理する。
- 連携: `NavigationController` や `PromptUIController` と連携し、モーダル表示に伴うUIの状態変化や初期化を適切に処理する。
- 柔軟性: `modalId` を引数として受け取ることで、任意のモーダルを制御できる汎用性を持つ。
*/

import { NavigationController } from './navigation.js';

export class ModalController {
    static showModal(modalId) {
        if (modalId === 'settingsModal') {
            NavigationController.generateSettingsUI();
        } else if (modalId === 'systemPromptModal') {
            // システムプロンプトモーダル表示時の初期化（プロンプト管理側で処理）
            if (window.PromptUIController) {
                window.PromptUIController.initializeModal();
            }
        }
        document.getElementById(modalId).style.display = 'block';
    }

    static hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        
        // システムプロンプトモーダルを閉じるときはドロワーも閉じる
        if (modalId === 'systemPromptModal' && window.PromptUIController) {
            window.PromptUIController.toggleDrawer(false);
        }
    }

    static hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        // ドロワーも閉じる
        if (window.PromptUIController) {
            window.PromptUIController.toggleDrawer(false);
        }
    }
}