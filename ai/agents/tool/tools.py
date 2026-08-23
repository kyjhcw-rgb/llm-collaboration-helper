from typing import List, Type

from google.genai import types
from pydantic import BaseModel

from agents.tool.models import (
    AddClassArgs,
    AddEdgeArgs,
    AddFeatureArgs,
    AddMethodArgs,
    MoveArgs,
    RemoveArgs,
    RemoveEdgeArgs,
    UpdateArgs,
)


def _declaration(
    name: str,
    description: str,
    model: Type[BaseModel],
) -> types.FunctionDeclaration:
    schema = model.model_json_schema()
    return types.FunctionDeclaration(
        name=name,
        description=description,
        parameters_json_schema={
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", []),
        },
    )


DIAGRAM_FUNCTION_DECLARATIONS: List[types.FunctionDeclaration] = [
    _declaration(
        "add_feature",
        "루트에 feature를 하나 추가한다. 자식 class는 넣지 말고 add_class로 이어라.",
        AddFeatureArgs,
    ),
    _declaration(
        "add_class",
        "있는 feature(parentId) 아래에 class를 하나 추가한다. 자식 method는 add_method로 이어라.",
        AddClassArgs,
    ),
    _declaration(
        "add_method",
        "있는 class(parentId) 아래에 method를 하나 추가한다.",
        AddMethodArgs,
    ),
    _declaration(
        "remove",
        "feature / class / method를 id로 삭제한다. 자식도 함께 사라진다.",
        RemoveArgs,
    ),
    _declaration(
        "update",
        "있는 노드의 필드만 바꾼다. 넘긴 필드만 갱신한다.",
        UpdateArgs,
    ),
    _declaration(
        "move",
        "class 또는 method를 다른 부모 아래로 옮긴다.",
        MoveArgs,
    ),
    _declaration(
        "add_edge",
        "노드 사이 관계 선을 하나 추가한다. kind는 CALL, INHERIT, IMPLEMENT.",
        AddEdgeArgs,
    ),
    _declaration(
        "remove_edge",
        "관계 선을 id로 삭제한다.",
        RemoveEdgeArgs,
    ),
]

DIAGRAM_TOOLS = [
    types.Tool(function_declarations=DIAGRAM_FUNCTION_DECLARATIONS),
]
