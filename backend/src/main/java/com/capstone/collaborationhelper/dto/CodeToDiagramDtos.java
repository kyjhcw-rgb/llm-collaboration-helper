package com.capstone.collaborationhelper.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

public class CodeToDiagramDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    public static class FromCodeReq {
        /** 공개 GitHub 레포 URL. 예: https://github.com/owner/repo */
        @NotBlank
        private String repoUrl;
    }
}
