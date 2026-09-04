from typing import List, Optional

from schemas.chat import ChatHistoryTurn
from schemas.project import DiagramGenerationRequest


def freedom_level_hint(level: int) -> str:
    if level <= 1:
        return "folder와 class 위주로 설계하고, method는 핵심만 최소한으로 포함해."
    if level == 2:
        return "주요 class와 핵심 method를 포함하고, edges로 주요 의존 관계를 표현해."
    return "class와 method를 세분화하고, edges도 풍부하게 포함해."


def project_context_block(project_context: Optional[str]) -> str:
    if not project_context:
        return ""

    return (
        f"\n[프로젝트 초기 기획]\n"
        f"{project_context}\n"
    )


def history_to_contents(
    history: List[ChatHistoryTurn],
    user_message: str
) -> list:
    contents = []

    for turn in history:
        role = (
            "user"
            if turn.sender.upper() == "USER"
            else "model"
        )

        contents.append({
            "role": role,
            "parts": [{"text": turn.message}]
        })

    contents.append({
        "role": "user",
        "parts": [{"text": user_message}]
    })

    return contents


def chat_system_instruction(
    diagram_json: str,
    project_context: Optional[str]
) -> str:
    return (
        "당신은 소프트웨어 아키텍처를 설명하는 AI 어시스턴트입니다.\n"
        "아래 [프로젝트 다이어그램] JSON만 근거로 답하세요.\n"
        "다이어그램에 없는 내용은 추측하지 말고, "
        "모르면 '다이어그램에 해당 정보가 없습니다'라고 답하세요.\n"
        f"{project_context_block(project_context)}"
        f"[프로젝트 다이어그램]\n{diagram_json}"
    )


INITIAL_DIAGRAM_SYSTEM = (
    "너는 소프트웨어 아키텍처를 설계하는 시니어 개발자야.\n"
    "사용자 기획에 맞춰 초기 다이어그램을 JSON으로 설계해.\n"
    "구조 규칙:\n"
    "1. folders: 소스 폴더 단위 (id, name, description). name은 폴더명 (예: auth, member)\n"
    "2. 각 folder 안에 classes 배열\n"
    "3. 각 class 안에 methods 배열\n"
    "4. edges: 노드 간 관계. fromId, to는 반드시 위에서 만든 id와 일치\n"
    "5. edges.kind: CALL, INHERIT, IMPLEMENT\n"
    "6. 절대 부연 설명 없이 지정된 JSON 스키마로만 응답해."
)


def initial_diagram_user_message(request: DiagramGenerationRequest) -> str:
    return (
        f"프로젝트 제목: {request.title}\n"
        f"사용 프레임워크: {request.framework}\n"
        f"자유도 레벨: {request.freedomLevel} — "
        f"{freedom_level_hint(request.freedomLevel)}\n"
        f"기획 내용: {request.descriptionPrompt}"
    )


def modify_system_instruction(
    diagram_json: str,
    project_context: Optional[str]
) -> str:
    return (
        "당신은 소프트웨어 아키텍처 다이어그램을 수정하는 AI 에이전트입니다.\n"
        "사용자의 수정 요청을 반영한 전체 다이어그램과, "
        "무엇을 바꿨는지 설명하는 reply를 함께 반환하세요.\n"
        "\n"
        "[수정 규칙]\n"
        "1. ID 유지: 명시적 삭제/변경이 없는 기존 folder, "
        "class, method ID는 절대 유지\n"
        "2. 노드 추가: 기존 ID와 겹치지 않는 고유 ID 부여 "
        "(예: folder_xxx, cls_xxx, method_xxx)\n"
        "3. edges 동기화: 노드 추가/삭제에 맞춰 edges를 갱신. "
        "fromId/to는 실제 존재하는 id만\n"
        "4. edges.kind: CALL, INHERIT, IMPLEMENT 중 하나\n"
        "5. 요청과 무관한 부분은 임의로 바꾸지 말 것\n"
        "6. 다이어그램에 없는 가정을 크게 늘리지 말 것 "
        "(필요하면 reply에 가정을 짧게 명시)\n"
        "\n"
        "[응답]\n"
        "- reply: 한국어로 변경 요약 "
        "(무엇을 추가/수정/삭제했는지 2~5문장)\n"
        "- diagram: 수정이 반영된 전체 다이어그램 JSON "
        "(부분 패치가 아님)\n"
        f"{project_context_block(project_context)}"
        f"[현재 프로젝트 다이어그램]\n{diagram_json}"
    )


def plan_system_instruction(
    diagram_json: str,
    project_context: Optional[str]
) -> str:
    return (
        "당신은 소프트웨어 아키텍처 다이어그램 수정의 계획을 세운다.\n"
        "툴은 호출하지 말고, 실행 순서만 steps로 반환한다.\n"
        "\n"
        "[가능한 작업]\n"
        "add_folder, add_class, add_method, "
        "remove, update, move, add_edge, remove_edge\n"
        "\n"
        "[규칙]\n"
        "1. 사용자 요청에 있는 변경만 넣는다. 없는 노드를 만들지 않는다.\n"
        "2. 한 스텝은 툴 하나 분량이다. "
        "새 class와 그 method는 스텝을 나눈다.\n"
        "3. 기존 노드는 다이어그램에 있는 id를 스텝에 적는다.\n"
        "4. 변경이 없으면 steps는 빈 배열이다.\n"
        f"{project_context_block(project_context)}"
        f"[현재 프로젝트 다이어그램]\n{diagram_json}"
    )


def act_system_instruction(
    diagram_json: str,
    project_context: Optional[str]
) -> str:
    return (
        "당신은 다이어그램 수정 실행기다. 지금 스텝만 툴로 처리한다.\n"
        "요청에 없는 노드를 만들거나 바꾸지 마라.\n"
        "id가 비면 우리가 부여하니 생략해도 된다.\n"
        "스텝이 끝나면 툴 없이 한 줄로 무엇을 했는지 적어라.\n"
        f"{project_context_block(project_context)}"
        f"[현재 프로젝트 다이어그램]\n{diagram_json}"
    )


def file_tree_system_instruction(target_framework: str) -> str:
    return (
        f"너는 다이어그램(JSON)을 보고 "
        f"소프트웨어 패키지 구조를 설계하는 아키텍트야.\n"
        f"제공된 구조를 바탕으로 "
        f"[{target_framework}] 프로젝트에 필요한 "
        "파일 경로 목록을 작성해.\n"
        "실제 코드는 작성하지 말고, "
        "오직 파일 경로와 해당 파일의 간단한 역할만 JSON으로 응답해."
    )


def file_tree_user_message(diagram_json: str) -> str:
    return (
        "[설계된 다이어그램 구조]\n"
        f"{diagram_json}\n\n"
        "위 구조를 바탕으로 생성해야 할 파일 트리를 "
        "스키마에 맞춰 뽑아줘."
    )


def single_code_system_instruction(target_file_path: str) -> str:
    return (
        "너는 다이어그램(JSON)을 실제 소스 코드로 변환하는 "
        "천재 개발자야.\n"
        f"전체 다이어그램 구조를 바탕으로, "
        f"요청받은 딱 하나의 파일 "
        f"[{target_file_path}]의 소스 코드만 "
        "완성도 있게 작성해줘.\n"
        "다른 파일의 코드는 절대 포함하지 말고, "
        "지정된 스키마에 맞춰 이 파일의 순수 코드만 응답해."
    )


def single_code_user_message(
    diagram_json: str,
    target_file_path: str,
    target_framework: str
) -> str:
    return (
        "[전체 다이어그램 구조]\n"
        f"{diagram_json}\n\n"
        "[생성할 대상 파일 경로]\n"
        f"{target_file_path}\n\n"
        f"위 파일 경로에 들어갈 "
        f"[{target_framework}] 보일러플레이트 코드를 짜줘."
    )
