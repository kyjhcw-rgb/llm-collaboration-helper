package com.capstone.collaborationhelper.code2diagram.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 공개 GitHub 레포 URL → 임시 디렉터리로 git clone (--depth 1).
 * default_branch 사용, API size / clone timeout / 디스크 용량 제한 적용.
 */
@Component
public class GitHubRepoFetcher {

    private static final Pattern GITHUB_REPO_URL = Pattern.compile(
            "^https?://(?:www\\.)?github\\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\\.git)?/?$",
            Pattern.CASE_INSENSITIVE
    );

    /** GitHub API size(KB) 및 clone 후 디스크 상한 */
    static final long MAX_REPO_BYTES = 50L * 1024 * 1024; // 50MB
    private static final long CLONE_TIMEOUT_SECONDS = 60;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
    private static final String USER_AGENT = "OurDiagram-CodeToDiagram/1.0";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public GitHubRepoFetcher(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** 테스트용 */
    GitHubRepoFetcher(ObjectMapper objectMapper, HttpClient httpClient) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    /**
     * 레포를 임시 폴더에 clone 해 {@link FetchedRepo}로 반환한다.
     * 호출측에서 close()로 임시 폴더를 지워야 한다.
     */
    public FetchedRepo fetch(String repoUrl) throws IOException {
        RepoRef ref = parseRepoUrl(repoUrl);
        RepoMeta meta = fetchRepoMeta(ref);

        Path tempDir = Files.createTempDirectory("oud-github-");
        Path projectRoot = tempDir.resolve("repo");
        try {
            cloneRepo(ref, meta.defaultBranch(), projectRoot);

            long diskBytes = directorySizeBytes(projectRoot);
            if (diskBytes > MAX_REPO_BYTES) {
                throw new IOException(
                        "클론된 레포가 너무 큽니다. 최대 "
                                + (MAX_REPO_BYTES / (1024 * 1024)) + "MB까지 지원합니다.");
            }

            return new FetchedRepo(projectRoot, tempDir);
        } catch (IOException | RuntimeException e) {
            deleteRecursivelyQuietly(tempDir);
            if (e instanceof IOException io) {
                throw io;
            }
            throw new IOException(e.getMessage(), e);
        }
    }

    public static RepoRef parseRepoUrl(String repoUrl) {
        if (repoUrl == null || repoUrl.isBlank()) {
            throw new IllegalArgumentException("GitHub 레포 URL이 필요합니다.");
        }
        String trimmed = repoUrl.trim();
        Matcher matcher = GITHUB_REPO_URL.matcher(trimmed);
        if (!matcher.matches()) {
            throw new IllegalArgumentException(
                    "공개 GitHub 레포 URL만 지원합니다. 예: https://github.com/owner/repo");
        }
        return new RepoRef(matcher.group(1), matcher.group(2));
    }

    private RepoMeta fetchRepoMeta(RepoRef ref) throws IOException {
        URI uri = URI.create("https://api.github.com/repos/" + ref.owner() + "/" + ref.repo());
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", USER_AGENT)
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("GitHub API 요청이 중단되었습니다.", e);
        }

        if (response.statusCode() == 404) {
            throw new IOException("레포를 찾을 수 없습니다. 공개 레포인지 확인하세요: " + ref);
        }
        if (response.statusCode() == 403 || response.statusCode() == 429) {
            throw new IOException("GitHub API 요청이 제한되었습니다. 잠시 후 다시 시도하세요.");
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("GitHub API 오류 (HTTP " + response.statusCode() + ")");
        }

        JsonNode root = objectMapper.readTree(response.body());
        if (root.path("private").asBoolean(false)) {
            throw new IOException("비공개 레포는 지원하지 않습니다.");
        }
        String branch = root.path("default_branch").asText(null);
        if (branch == null || branch.isBlank()) {
            throw new IOException("default_branch를 확인할 수 없습니다.");
        }

        // GitHub API size는 KB 단위 (대략값)
        long sizeKb = root.path("size").asLong(-1);
        if (sizeKb > 0 && sizeKb * 1024L > MAX_REPO_BYTES) {
            throw new IOException(
                    "레포가 너무 큽니다. 최대 "
                            + (MAX_REPO_BYTES / (1024 * 1024)) + "MB까지 지원합니다.");
        }

        return new RepoMeta(branch, sizeKb);
    }

    private void cloneRepo(RepoRef ref, String branch, Path targetDir) throws IOException {
        // 검증된 owner/repo만 사용 — 임의 URL 주입 방지
        String cloneUrl = "https://github.com/" + ref.owner() + "/" + ref.repo() + ".git";

        ProcessBuilder pb = new ProcessBuilder(
                "git", "clone",
                "--depth", "1",
                "--branch", branch,
                "--single-branch",
                cloneUrl,
                targetDir.toAbsolutePath().toString()
        );
        pb.redirectErrorStream(true);

        Process process;
        try {
            process = pb.start();
        } catch (IOException e) {
            throw new IOException("git을 실행할 수 없습니다. PATH에 git이 있는지 확인하세요.", e);
        }

        String output;
        try (InputStream in = process.getInputStream()) {
            output = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }

        boolean finished;
        try {
            finished = process.waitFor(CLONE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new IOException("git clone이 중단되었습니다.", e);
        }

        if (!finished) {
            process.destroyForcibly();
            throw new IOException("git clone 시간 초과 (" + CLONE_TIMEOUT_SECONDS + "초).");
        }

        int exit = process.exitValue();
        if (exit != 0) {
            String detail = output == null ? "" : output.strip();
            if (detail.length() > 500) {
                detail = detail.substring(0, 500) + "...";
            }
            throw new IOException("git clone 실패 (exit " + exit + ")"
                    + (detail.isEmpty() ? "" : ": " + detail));
        }
    }

    static long directorySizeBytes(Path root) throws IOException {
        final long[] total = {0L};
        Files.walkFileTree(root, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                total[0] += attrs.size();
                return FileVisitResult.CONTINUE;
            }
        });
        return total[0];
    }

    static void deleteRecursivelyQuietly(Path root) {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException ignored) {
            // best-effort cleanup
        }
    }

    private record RepoMeta(String defaultBranch, long sizeKb) {
    }

    public record RepoRef(String owner, String repo) {
        @Override
        public String toString() {
            return owner + "/" + repo;
        }
    }

    /**
     * clone된 레포. close 시 임시 디렉터리를 삭제한다.
     */
    public static final class FetchedRepo implements AutoCloseable {
        private final Path projectRoot;
        private final Path tempDir;

        public FetchedRepo(Path projectRoot, Path tempDir) {
            this.projectRoot = Objects.requireNonNull(projectRoot);
            this.tempDir = Objects.requireNonNull(tempDir);
        }

        /** fromSources에 넘길 프로젝트 루트 */
        public Path projectRoot() {
            return projectRoot;
        }

        @Override
        public void close() {
            deleteRecursivelyQuietly(tempDir);
        }
    }
}
