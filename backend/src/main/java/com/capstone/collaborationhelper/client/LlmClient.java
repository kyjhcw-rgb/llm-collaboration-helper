package com.capstone.collaborationhelper.client;

import com.capstone.collaborationhelper.dto.ProjectDtos.CreateReq;
import com.capstone.collaborationhelper.dto.TranslationDtos.DiagramRes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Component
@RequiredArgsConstructor
public class LlmClient {

    private final Environment environment;
    private final RestTemplate restTemplate;

    public DiagramRes requestInitialDiagram(CreateReq req) {
        String url = environment.getProperty("app.ai-server.url").replaceAll("/$", "")
                + "/projects/initial-diagram";
        log.info("▶ [LlmClient] FastAPI AI 서버로 다이어그램 생성 요청. url={}, title={}", url, req.getTitle());

        try {
            DiagramRes response = restTemplate.postForObject(url, req, DiagramRes.class);

            if (response != null) {
                log.info("✔ [LlmClient] AI 서버로부터 다이어그램 구조 수신 완료! (Features: {}개, Edges: {}개)",
                        response.getFeatures() != null ? response.getFeatures().size() : 0,
                        response.getEdges() != null ? response.getEdges().size() : 0);
            }

            return response;

        } catch (Exception e) {
            log.error("❌ [LlmClient] FastAPI 서버와 통신 중 에러가 발생했습니다: ", e);
            throw new RuntimeException("AI 다이어그램 생성 서버와의 통신에 실패했습니다.", e);
        }
    }
}