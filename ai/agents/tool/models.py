from typing import Literal, Optional

from pydantic import BaseModel, Field


class AddFeatureArgs(BaseModel):
    id: Optional[str] = Field(default=None, description="예: feat_auth. 생략 가능")
    name: str = Field(description="기능 이름")
    description: str = Field(default="", description="기능 설명")


class AddClassArgs(BaseModel):
    parentId: str = Field(description="넣을 feature id")
    id: Optional[str] = Field(default=None, description="예: cls_auth_service. 생략 가능")
    name: str = Field(description="클래스·인터페이스 이름")
    description: str = Field(default="", description="클래스 역할 설명")
    annotations: Optional[str] = Field(
        default=None,
        description="어노테이션 (예: @RestController)"
    )


class AddMethodArgs(BaseModel):
    parentId: str = Field(description="넣을 class id")
    id: Optional[str] = Field(default=None, description="예: method_logout. 생략 가능")
    name: str = Field(description="메서드 이름")
    description: str = Field(default="", description="메서드 역할 설명")
    parameters: Optional[str] = Field(
        default=None,
        description="파라미터 (예: String email, String pwd)"
    )
    returnType: Optional[str] = Field(
        default=None,
        description="리턴 타입 (예: ResponseEntity)"
    )


class RemoveArgs(BaseModel):
    id: str = Field(description="지울 feature / class / method id")


class UpdateArgs(BaseModel):
    id: str = Field(description="바꿀 노드 id")
    name: Optional[str] = None
    description: Optional[str] = None
    annotations: Optional[str] = Field(
        default=None,
        description="class만 해당"
    )
    parameters: Optional[str] = Field(
        default=None,
        description="method만 해당"
    )
    returnType: Optional[str] = Field(
        default=None,
        description="method만 해당"
    )


class MoveArgs(BaseModel):
    id: str = Field(description="옮길 class 또는 method id")
    parentId: str = Field(description="새 부모 feature 또는 class id")


class AddEdgeArgs(BaseModel):
    id: Optional[str] = Field(default=None, description="예: edge_1. 생략 가능")
    fromId: str = Field(description="출발 노드 id (class 또는 method)")
    to: str = Field(description="도착 노드 id")
    kind: Literal["CALL", "INHERIT", "IMPLEMENT"]


class RemoveEdgeArgs(BaseModel):
    id: str = Field(description="지울 edge id")
