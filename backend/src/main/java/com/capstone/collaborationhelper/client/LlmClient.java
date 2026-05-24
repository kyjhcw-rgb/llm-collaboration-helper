package com.capstone.collaborationhelper.client;
import com.capstone.collaborationhelper.dto.ProjectDtos.CreateReq;
import com.capstone.collaborationhelper.dto.ProjectDtos.LlmDiagramRes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmClient {

    // 1. 스프링이 제공하는 HTTP 통신 도구 객체 생성
    private final RestTemplate restTemplate = new RestTemplate();

    // 로컬에서 실행 중인 FastAPI 서버 주소 (1단계에서 설정한 주소)
    private final String FASTAPI_URL = "http://localhost:1234/projects/initial-diagram";

    /**
     * 파이썬 서버에게 다이어그램 생성을 요청하는 메서드
     * @param req 스프링 부트 컨트롤러가 받은 프로젝트 생성 요청 데이터 (제목, 프레임워크, 자유도, 기획글)
     * @return 파이썬 서버가 뱉어낸 blocks와 edges가 이쁘게 담긴 2단계 그릇
     */
    public LlmDiagramRes requestInitialDiagram(CreateReq req) {
        log.info("▶ [LlmClient] FastAPI AI 서버로 다이어그램 생성 요청을 보냅니다. 프로젝트 제목: {}", req.getTitle());

        try {
            // 2. restTemplate.postForObject(주소, 보낼 데이터, 받아올 그릇 클래스)
            // 이 한 줄로 스프링 부트가 파이썬에게 JSON을 쏘고, 파이썬의 응답 JSON을 자바 객체로 쏙 변환해 줍니다.
            LlmDiagramRes response = restTemplate.postForObject(FASTAPI_URL, req, LlmDiagramRes.class);

            if (response != null) {
                log.info("✔ [LlmClient] AI 서버로부터 다이어그램 구조 수신 완료! (Blocks: {}개, Edges: {}개)",
                        response.getBlocks() != null ? response.getBlocks().size() : 0,
                        response.getEdges() != null ? response.getEdges() : 0);
            }

            return response;

        } catch (Exception e) {
            log.error("❌ [LlmClient] FastAPI 서버와 통신 중 에러가 발생했습니다: ", e);
            // 에러가 발생하면 런타임 예외를 던져 트랜잭션이 안전하게 롤백되도록 합니다.
            throw new RuntimeException("AI 다이어그램 생성 서버와의 통신에 실패했습니다.", e);
        }
    }
}
