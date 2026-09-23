from utils.code_emitters.base import CodeEmitter
from utils.code_emitters.java_spring import JavaSpringEmitter

_EMITTERS: dict[str, CodeEmitter] = {
    "java": JavaSpringEmitter(),
    "spring": JavaSpringEmitter(),
    "springboot": JavaSpringEmitter(),
    "spring-boot": JavaSpringEmitter(),
}


def normalize_framework(target_framework: str) -> str:
    return (target_framework or "").strip().lower().replace(" ", "")


def get_emitter(target_framework: str) -> CodeEmitter:
    key = normalize_framework(target_framework)
    emitter = _EMITTERS.get(key)
    if emitter is None:
        # "Spring Boot", "Java/Spring" 같은 자유 입력 대응
        if "spring" in key or key == "java":
            return _EMITTERS["spring"]
        raise ValueError(
            f"지원하지 않는 프레임워크입니다: {target_framework}. "
            "현재 java/spring 만 지원합니다."
        )
    return emitter
