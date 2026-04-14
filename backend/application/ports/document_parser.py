# input: 上传文件 (UploadFile)
# output: DocumentParser Protocol
# owner: wanhua.gu
# pos: 应用层端口 - 文档解析抽象接口；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Application-owned document parser port."""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from domain.defense_prep.value_objects import DocumentSummary


@runtime_checkable
class DocumentParser(Protocol):
    async def parse(self, content: bytes, filename: str) -> DocumentSummary: ...
