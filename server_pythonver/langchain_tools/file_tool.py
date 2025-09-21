import os
import shutil
from typing import Dict, Any, Optional
from langchain.tools import BaseTool
from pydantic import Field


class FileOperationTool(BaseTool):
    name: str = "file_operation"
    description: str = """
    ファイルやディレクトリの操作を行います。
    以下の操作をJSONで指定してください:

    - ファイル作成: {"action": "create_file", "path": "パス", "content": "内容"}
    - ディレクトリ作成: {"action": "create_directory", "path": "パス"}
    - ファイル読み込み: {"action": "read_file", "path": "パス"}
    - ファイル削除: {"action": "delete_file", "path": "パス"}
    - ファイル一覧: {"action": "list_files", "path": "パス"}
    - ファイルコピー: {"action": "copy_file", "source": "元パス", "destination": "先パス"}
    - ファイル移動: {"action": "move_file", "source": "元パス", "destination": "先パス"}

    引数: operation (JSON文字列で操作を指定)
    """

    base_path: str = Field(default="/workspace")

    def _run(self, operation: str) -> str:
        """ファイル操作を実行"""
        try:
            import json
            op = json.loads(operation)
            action = op.get("action")

            if action == "create_file":
                return self._create_file(op.get("path"), op.get("content", ""))
            elif action == "create_directory":
                return self._create_directory(op.get("path"))
            elif action == "read_file":
                return self._read_file(op.get("path"))
            elif action == "delete_file":
                return self._delete_file(op.get("path"))
            elif action == "list_files":
                return self._list_files(op.get("path", "."))
            elif action == "copy_file":
                return self._copy_file(op.get("source"), op.get("destination"))
            elif action == "move_file":
                return self._move_file(op.get("source"), op.get("destination"))
            else:
                return f"サポートされていない操作です: {action}"

        except json.JSONDecodeError:
            return "操作の指定が正しいJSON形式ではありません"
        except Exception as e:
            return f"ファイル操作中にエラーが発生しました: {str(e)}"

    def _create_file(self, path: str, content: str) -> str:
        """ファイルを作成"""
        try:
            full_path = self._get_full_path(path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"ファイルが作成されました: {path}"
        except Exception as e:
            return f"ファイル作成エラー: {str(e)}"

    def _create_directory(self, path: str) -> str:
        """ディレクトリを作成"""
        try:
            full_path = self._get_full_path(path)
            os.makedirs(full_path, exist_ok=True)
            return f"ディレクトリが作成されました: {path}"
        except Exception as e:
            return f"ディレクトリ作成エラー: {str(e)}"

    def _read_file(self, path: str) -> str:
        """ファイルを読み込み"""
        try:
            full_path = self._get_full_path(path)
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return f"ファイル内容:\n```\n{content}\n```"
        except Exception as e:
            return f"ファイル読み込みエラー: {str(e)}"

    def _delete_file(self, path: str) -> str:
        """ファイルを削除"""
        try:
            full_path = self._get_full_path(path)
            if os.path.isfile(full_path):
                os.remove(full_path)
                return f"ファイルが削除されました: {path}"
            elif os.path.isdir(full_path):
                shutil.rmtree(full_path)
                return f"ディレクトリが削除されました: {path}"
            else:
                return f"ファイルまたはディレクトリが見つかりません: {path}"
        except Exception as e:
            return f"削除エラー: {str(e)}"

    def _list_files(self, path: str) -> str:
        """ファイル一覧を取得"""
        try:
            full_path = self._get_full_path(path)
            if not os.path.exists(full_path):
                return f"パスが存在しません: {path}"

            items = []
            for item in sorted(os.listdir(full_path)):
                item_path = os.path.join(full_path, item)
                if os.path.isdir(item_path):
                    items.append(f"📁 {item}/")
                else:
                    size = os.path.getsize(item_path)
                    items.append(f"📄 {item} ({size} bytes)")

            return f"ディレクトリ内容: {path}\n" + "\n".join(items)
        except Exception as e:
            return f"ファイル一覧取得エラー: {str(e)}"

    def _copy_file(self, source: str, destination: str) -> str:
        """ファイルをコピー"""
        try:
            source_path = self._get_full_path(source)
            dest_path = self._get_full_path(destination)

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(source_path, dest_path)
            return f"ファイルがコピーされました: {source} → {destination}"
        except Exception as e:
            return f"ファイルコピーエラー: {str(e)}"

    def _move_file(self, source: str, destination: str) -> str:
        """ファイルを移動"""
        try:
            source_path = self._get_full_path(source)
            dest_path = self._get_full_path(destination)

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.move(source_path, dest_path)
            return f"ファイルが移動されました: {source} → {destination}"
        except Exception as e:
            return f"ファイル移動エラー: {str(e)}"

    def _get_full_path(self, path: str) -> str:
        """相対パスを絶対パスに変換"""
        if os.path.isabs(path):
            return path
        return os.path.join(self.base_path, path)

    async def _arun(self, operation: str) -> str:
        """非同期実行（同期メソッドをラップ）"""
        return self._run(operation)