import os
from typing import TypedDict, List, Dict, Any, Annotated
from operator import add

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv


load_dotenv()

# 1. 상태 정의 (State)
class DiagramState(TypedDict):
    project_description: str        # 주인이 입력한 프로젝트 설명 초안
    diagram_blocks: List[Dict]       # 생성된 블럭들 (기능, 클래스, 메서드)
    dependencies: List[Dict]        # 관계선 (의존성 및 호출 방향)
    mentor_feedback: str            # LLM 멘토의 조언
    foundation_code: Dict[str, str] # 파일 경로별 생성된 코드
    freedom_level: int              # 다이어그램 자유도 (1~10)

# 2. 노드 구현 (Nodes)
class OurDiagramNodes:
    def __init__(self, model_name="gemini-2.5-flash"):
        self.llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=os.getenv("GEMINI_API_KEY"))

    def generate_root_diagram(self, state: DiagramState):
        """프로젝트 초안을 바탕으로 루트 다이어그램(초기 구조) 생성"""
        prompt = f"""
        당신은 'Our Diagram'의 설계 에이전트입니다. 
        사용자의 설명: {state['project_description']}
        자유도: {state['freedom_level']}/10
        
        다음 규칙에 따라 다이어그램을 JSON 형태로 설계하세요:
        1. '기능 블럭'(디렉토리)을 최상위에 둡니다.
        2. 그 안에 '클래스/인터페이스 블럭'을 정의합니다.
        3. 클래스 내부에 '메서드 블럭'을 정의합니다.
        4. 블럭 간의 의존성(관계선)을 정의하세요.
        """
        # 실제 구현시에는 구조화된 출력(Structured Output)을 사용하는 것이 좋습니다.
        response = self.llm.invoke(prompt)
        
        # 가상의 파싱 로직 (실제로는 JSON 파서 필요)
        return {
            "diagram_blocks": [{"id": "b1", "type": "function", "name": "Auth"}],
            "dependencies": [{"from": "b1", "to": "db", "type": "dependency"}]
        }

    def architect_mentor(self, state: DiagramState):
        """아키텍처 설계 경험이 부족한 주니어를 위한 멘토링 노드"""
        blocks = state['diagram_blocks']
        deps = state['dependencies']
        
        prompt = f"현재 설계된 블럭 구조: {blocks}와 의존성: {deps}를 분석하여 의존성이 꼬이거나 객체지향 원칙에 어긋나는 부분을 지적하고 개선 방향을 제시하세요."
        response = self.llm.invoke(prompt)
        
        return {"mentor_feedback": response.content}

    def generate_foundation_code(self, state: DiagramState):
        """다이어그램을 기반으로 실제 Foundation Code(빈 껍데기) 작성"""
        blocks = state['diagram_blocks']
        feedback = state['mentor_feedback']
        
        prompt = f"""
        다음 다이어그램 구조와 멘토의 조언을 바탕으로 프로젝트의 Foundation Code를 작성하세요.
        구조: {blocks}
        멘토 조언: {feedback}
        
        출력 형식:
        - 각 파일은 자연어 주석이 포함된 클래스/메서드 시그니처만 포함합니다.
        - Annotation(@Service, @RestController 등)을 적절히 배치하세요.
        """
        response = self.llm.invoke(prompt)
        
        return {"foundation_code": {"src/main/java/Example.java": response.content}}

# 3. 그래프 구성 (Graph Construction)
def create_our_diagram_flow():
    nodes = OurDiagramNodes()
    workflow = StateGraph(DiagramState)

    # 노드 추가
    workflow.add_node("init_root", nodes.generate_root_diagram)
    workflow.add_node("mentor_review", nodes.architect_mentor)
    workflow.add_node("generate_code", nodes.generate_foundation_code)

    # 엣지 연결
    workflow.set_entry_point("init_root")
    workflow.add_edge("init_root", "mentor_review")
    workflow.add_edge("mentor_review", "generate_code")
    workflow.add_edge("generate_code", END)

    return workflow.compile()

# 4. 실행 예시
if __name__ == "__main__":
    app = create_our_diagram_flow()
    
    initial_input = {
        "project_description": "아워 다이어그램, oud. Spring Boot와 PostgreSQL 사용.",
        "freedom_level": 7,
        "diagram_blocks": [],
        "dependencies": [],
        "mentor_feedback": "",
        "foundation_code": {}
    }
    
    final_state = app.invoke(initial_input)
    
    print("### [1] Mentor Feedback ###")
    print(final_state['mentor_feedback'])
    print("\n### [2] Foundation Code Sample ###")
    for path, code in final_state['foundation_code'].items():
        print(f"File: {path}\n{code}")