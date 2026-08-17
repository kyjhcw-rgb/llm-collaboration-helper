package com.capstone.collaborationhelper.code2diagram.ingest;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * 소스 루트에서 다이어그램 대상 .java 파일만 수집한다.
 * test / target / build / generated 경로는 제외.
 */
@Component
public class SourceFileCollector {

    public List<Path> collect(Path root) throws IOException {
        if (root == null || !Files.isDirectory(root)) {
            throw new IllegalArgumentException("유효한 소스 루트 디렉터리가 필요합니다: " + root);
        }

        try (Stream<Path> walk = Files.walk(root)) {
            return walk
                    .filter(Files::isRegularFile)
                    .filter(this::isJavaFile)
                    .filter(this::isIncludedPath)
                    .sorted(Comparator.comparing(path -> path.toString().replace('\\', '/')))
                    .toList();
        }
    }

    private boolean isJavaFile(Path path) {
        String name = path.getFileName().toString();
        if (!name.endsWith(".java")) {
            return false;
        }
        return !"package-info.java".equals(name) && !"module-info.java".equals(name);
    }

    /**
     * src/main/java 아래를 우선 포함하고,
     * test·빌드·생성 경로는 무조건 제외한다.
     */
    private boolean isIncludedPath(Path path) {
        String normalized = path.toString().replace('\\', '/').toLowerCase();

        if (normalized.contains("/src/test/")
                || normalized.contains("/target/")
                || normalized.contains("/build/")
                || normalized.contains("/.git/")
                || normalized.contains("/generated/")
                || normalized.contains("/generated-sources/")) {
            return false;
        }

        // src/main/java가 있으면 그 안만, 없으면 루트 아래 .java(이미 제외 필터 통과분)
        if (normalized.contains("/src/main/java/")) {
            return true;
        }

        // 단일 모듈이 아니거나 평평한 폴더 fixture도 허용
        return !normalized.contains("/src/");
    }
}
