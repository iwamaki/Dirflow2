/* =========================================
    モーダル制御
   ========================================= */

/*
## 概要
アプリケーション内で使用される各種モーダルウィンドウの表示と非表示を制御するモジュール。

## 責任
- 指定されたIDのモーダルの表示と非表示
- 全てのモーダルの非表示
- モーダル表示時の初期化処理（設定モーダル、システムプロンプトモーダルなど）
- システムプロンプトモーダルと関連ドロワーの連携
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