import logging
import re
from typing import Dict, List, Set, Tuple

import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError

from agents.states import MAX_DB_RETRIES, CodeGenerationState

logger = logging.getLogger(__name__)

_DIALECTS = {"mysql": "mysql", "postgresql": "postgres"}

# DDL로 인정하는 문장. SET은 MySQL의 SET FOREIGN_KEY_CHECKS 같은 세션 설정용
_ALLOWED_STATEMENTS = (exp.Create, exp.Alter, exp.Comment, exp.Set)

# sqlglot이 해석하지 못해 Command로 떨어져도 허용하는 구문
_ALLOWED_COMMAND_PREFIXES = ("CREATE EXTENSION",)

_POSTGRES_FORBIDDEN = [
    (re.compile(r"`"), "백틱(`) 식별자"),
    (re.compile(r"\bAUTO_INCREMENT\b", re.IGNORECASE), "AUTO_INCREMENT"),
    (re.compile(r"\bENGINE\s*=", re.IGNORECASE), "ENGINE="),
]


def _name(node) -> str:
    return node.name.lower() if node is not None else ""


def _reference_target(ref: exp.Reference) -> Tuple[str, List[str]]:
    target = ref.this
    if isinstance(target, exp.Schema):
        return _name(target.this), [_name(col) for col in target.expressions]
    if isinstance(target, exp.Table):
        return _name(target), []
    return "", []


def _parse_error_message(e: ParseError) -> str:
    if e.errors:
        first = e.errors[0]
        return f"{first.get('description')} (line {first.get('line')}, col {first.get('col')})"
    return str(e).splitlines()[0]


def collect_ddl_errors(sql: str, db_type: str) -> List[str]:
    """DDL SQL의 문법/구조 오류를 모두 모아 반환한다. 비어 있으면 통과."""
    errors: List[str] = []

    if db_type == "postgresql":
        for pattern, label in _POSTGRES_FORBIDDEN:
            if pattern.search(sql):
                errors.append(f"PostgreSQL에서 쓸 수 없는 MySQL 문법이 있습니다: {label}")

    try:
        statements = [s for s in sqlglot.parse(sql, read=_DIALECTS.get(db_type, "mysql")) if s is not None]
    except ParseError as e:
        errors.append(f"SQL 문법 오류: {_parse_error_message(e)}")
        return errors

    tables: Dict[str, Set[str]] = {}
    pk_tables: Set[str] = set()
    # (FK를 가진 테이블, 참조 테이블, 참조 컬럼, 해당 시점까지 생성된 테이블)
    fk_refs: List[Tuple[str, str, List[str], Set[str]]] = []

    for stmt in statements:
        if isinstance(stmt, exp.Command):
            text = stmt.sql().strip()
            if not text.upper().startswith(_ALLOWED_COMMAND_PREFIXES):
                errors.append(f"해석할 수 없는 구문입니다: {text[:80]}")
            continue

        if not isinstance(stmt, _ALLOWED_STATEMENTS):
            errors.append(f"DDL이 아닌 구문은 허용되지 않습니다: {stmt.sql()[:80]}")
            continue

        if isinstance(stmt, exp.Create) and stmt.args.get("kind") == "TABLE" and isinstance(stmt.this, exp.Schema):
            table = _name(stmt.this.this)
            if table in tables:
                errors.append(f"{table} 테이블이 중복 생성됩니다.")
            tables[table] = {_name(col) for col in stmt.this.expressions if isinstance(col, exp.ColumnDef)}

            if stmt.find(exp.PrimaryKey, exp.PrimaryKeyColumnConstraint):
                pk_tables.add(table)

            for ref in stmt.find_all(exp.Reference):
                target, cols = _reference_target(ref)
                fk_refs.append((table, target, cols, set(tables)))

        elif isinstance(stmt, exp.Alter):
            table = _name(stmt.this)
            if table not in tables:
                errors.append(f"ALTER TABLE 대상인 {table} 테이블이 앞에서 생성되지 않았습니다.")
                continue

            tables[table].update(_name(col) for col in stmt.find_all(exp.ColumnDef))

            if stmt.find(exp.PrimaryKey, exp.PrimaryKeyColumnConstraint):
                pk_tables.add(table)

            for ref in stmt.find_all(exp.Reference):
                target, cols = _reference_target(ref)
                fk_refs.append((table, target, cols, set(tables)))

    if not tables:
        errors.append("CREATE TABLE 문이 없습니다.")

    for table in tables:
        if table not in pk_tables:
            errors.append(f"{table} 테이블에 PRIMARY KEY가 없습니다.")

    for source, target, cols, created in fk_refs:
        if target not in tables:
            errors.append(f"{source} 테이블의 FK가 존재하지 않는 {target} 테이블을 참조합니다.")
            continue
        if target not in created:
            errors.append(
                f"{source} 테이블의 FK가 아직 생성되지 않은 {target} 테이블을 참조합니다. "
                f"{target} 테이블을 먼저 만들거나 FK를 맨 뒤의 ALTER TABLE로 추가하세요."
            )
        missing = [col for col in cols if col not in tables[target]]
        if missing:
            errors.append(f"{source} 테이블의 FK가 {target} 테이블에 없는 컬럼({', '.join(missing)})을 참조합니다.")

    return list(dict.fromkeys(errors))


def validate_db(state: CodeGenerationState) -> CodeGenerationState:
    """생성된 DDL을 파싱해 문법, PK, FK 참조, 생성 순서 등을 검사한다."""

    result = state.get("result")

    if not result:
        state["validation_error"] = state.get("validation_error") or "생성 결과가 없습니다."
    else:
        sql = result.get("sql")
        if not isinstance(sql, str) or not sql.strip():
            state["validation_error"] = "생성된 DDL SQL이 비어 있습니다."
        else:
            errors = collect_ddl_errors(sql, state.get("db_type") or "mysql")
            state["validation_error"] = "\n".join(f"- {e}" for e in errors) if errors else None

    # 실패할 때마다 증가시켜야 route의 재시도 상한이 동작한다
    if state["validation_error"]:
        state["retry_count"] += 1
        logger.warning(
            f"DB DDL 검증 실패 ({state['retry_count']}/{MAX_DB_RETRIES + 1}회차):\n"
            f"{state['validation_error']}"
        )

    return state
