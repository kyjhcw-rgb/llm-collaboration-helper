from typing import List, Optional

from pydantic import BaseModel, Field


class MethodNode(BaseModel):
    id: str = Field(description="고유 ID (예: method_login)")
    name: str = Field(description="메서드 이름 (예: login)")
    description: str = Field(default="", description="메서드 역할 설명")
    parameters: Optional[str] = Field(
        default=None,
        description="파라미터 (예: String email, String pwd)"
    )
    returnType: Optional[str] = Field(
        default=None,
        description="리턴 타입 (예: ResponseEntity)"
    )


class ClassNode(BaseModel):
    id: str = Field(description="고유 ID (예: cls_auth_controller)")
    name: str = Field(description="클래스·인터페이스 이름")
    description: str = Field(default="", description="클래스 역할 설명")
    annotations: Optional[str] = Field(
        default=None,
        description="어노테이션 (예: @RestController)"
    )
    methods: List[MethodNode] = Field(default_factory=list)


class FolderNode(BaseModel):
    id: str = Field(description="고유 ID (예: folder_auth)")
    name: str = Field(description="소스 폴더명 (예: auth, member)")
    description: str = Field(default="", description="이 폴더의 역할")
    classes: List[ClassNode] = Field(default_factory=list)


class RelationEdge(BaseModel):
    id: str = Field(description="엣지 고유 ID (예: edge_1)")
    fromId: str = Field(description="출발 노드 id (class 또는 method)")
    to: str = Field(description="도착 노드 id")
    kind: str = Field(description="CALL, INHERIT, IMPLEMENT 중 하나")


class DiagramRes(BaseModel):
    folders: List[FolderNode]
    edges: List[RelationEdge] = Field(default_factory=list)
