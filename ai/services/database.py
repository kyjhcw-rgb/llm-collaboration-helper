import json
from fastapi import HTTPException
from google.genai import types

from core.config import MODEL_ID, client
from core.exceptions import handle_genai_error
from schemas.database import DatabaseDDLResponse, DatabaseGenerateRequest
from utils.diagram_helper import serialize_diagram


def _db_system_instruction(db_type: str, diagram_json: str) -> str:
    """선택한 DB 종류(MySQL/PostgreSQL)에 맞춘 DDL 생성 시스템 프롬프트"""
    target_db = "MySQL 8.0+" if db_type.lower() == "mysql" else "PostgreSQL 15+"

    return f"""
너는 데이터베이스 설계 및 DDL SQL 작성 전문가이다.
제공된 소프트웨어 다이어그램 구조(클래스, 메서드, 관계 엣지)를 분석하여 {target_db} 사양에 맞는 실행 가능한 DDL SQL 쿼리를 생성해야 한다.

[지침]
1. 다이어그램의 엔티티/클래스 구조와 관계를 해석하여 RDB 테이블, 컬럼, PK, FK, 인덱스 제약조건을 도출해라.
2. {target_db}의 키워드 및 식별자 규칙을 엄격히 준수해라.
   - MySQL: 백틱(`) 사용, AUTO_INCREMENT, ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 적용
   - PostgreSQL: 필요시 큰따옴표(") 사용, SERIAL / BIGSERIAL 사용, TIMESTAMP WITH TIME ZONE 지정
3. 응답은 반드시 지정된 JSON 형식으로만 반환해야 하며, 마크다운 코드 블록(```sql 등)을 제외한 순수 문자열 형태의 SQL을 작성해라.

[다이어그램 구조 JSON]
{diagram_json}
"""


async def generate_database_ddl(request: DatabaseGenerateRequest) -> DatabaseDDLResponse:
    """다이어그램 구조를 분석하여 선택한 DB(MySQL/PostgreSQL)의 DDL SQL을 생성"""
    db_type_normalized = request.dbType.lower()
    if db_type_normalized not in ["mysql", "postgresql"]:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 데이터베이스 종류입니다. 'mysql' 또는 'postgresql'을 선택하세요."
        )

    diagram_json = serialize_diagram(request.diagram)

    user_prompt = f"""
다음 다이어그램 구조를 바탕으로 {db_type_normalized.upper()} DDL SQL과 스키마 요약 설명을 생성해줘.

1. sql: 바로 실행 가능한 완벽한 DDL SQL 문 (CREATE TABLE, ALTER TABLE FOREIGN KEY 등 포함)
2. summary: 테이블 구성 및 관계에 대한 간단한 한글 설명
"""

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=_db_system_instruction(
                    db_type_normalized,
                    diagram_json
                ),
                response_mime_type="application/json",
                response_schema=DatabaseDDLResponse,
                temperature=0.1,
            ),
        )

        payload = json.loads(response.text)

        return DatabaseDDLResponse(
            dbType=db_type_normalized,
            sql=payload.get("sql", "").strip(),
            summary=payload.get("summary", "").strip()
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_genai_error(e, f"[{request.dbType}] 데이터베이스 DDL 생성")