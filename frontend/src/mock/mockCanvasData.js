// mockCanvasData.js
//
// 목적: 백엔드 없이 프론트엔드 레이아웃 버그(1~4)를 재현/검증하기 위한 더미 데이터.
// GET /api/projects/{projectId}/canvas 의 응답 형식({ blocks: [...], edges: [...] })과 100% 동일한 shape.
//
// 구조: feature 5개 x class 3개씩 x method 3개씩 = feature 5 + class 15 + method 45
//
// 일부러 심어둔 "버그 유발 요소"들 (실전 LLM 생성 데이터를 흉내냄):
//
// 1) 배열 순서가 부모보다 자식이 먼저 나옴 (method -> class -> feature 순으로 뒤섞임)
//    -> sortNodesParentFirst 로직이 순서와 무관하게 정상 렌더링되어야 함.
//
// 2) 같은 부모 안의 자식들이 전부 같은 posY(=40)에 겹쳐 있음
//    -> fixOverlapsAndRecalculate의 겹침 감지 후 세로 재배치 로직이 동작해야 함.
//
// 3) feature 5개는 미리 가로로 배치 (posX: 0 / 700 / 1400 / 2100 / 2800)
//
// 4) 크로스 엣지: A→B, B→C, C→D, D→E

export const mockCanvasResponse = {
  blocks: [
    // ⚠️ 의도적으로 자식이 부모보다 먼저 오도록 섞음

    // --- 기능A 메소드 ---
    { frontendId: 'methodA1a', parentFrontendId: 'classA1', type: 'method', name: 'methodA1a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA1b', parentFrontendId: 'classA1', type: 'method', name: 'methodA1b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA1c', parentFrontendId: 'classA1', type: 'method', name: 'methodA1c', description: '', parameters: '', returnType: 'String', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA2a', parentFrontendId: 'classA2', type: 'method', name: 'methodA2a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA2b', parentFrontendId: 'classA2', type: 'method', name: 'methodA2b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA2c', parentFrontendId: 'classA2', type: 'method', name: 'methodA2c', description: '', parameters: '', returnType: 'List', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA3a', parentFrontendId: 'classA3', type: 'method', name: 'methodA3a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA3b', parentFrontendId: 'classA3', type: 'method', name: 'methodA3b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodA3c', parentFrontendId: 'classA3', type: 'method', name: 'methodA3c', description: '', parameters: '', returnType: 'boolean', annotations: null, posX: 16, posY: 40, width: null, height: null },

    // --- 기능A 클래스 ---
    { frontendId: 'classA1', parentFrontendId: 'featureA', type: 'class', name: 'ClassA1', description: '', parameters: null, returnType: null, annotations: '@RestController', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classA2', parentFrontendId: 'featureA', type: 'class', name: 'ClassA2', description: '', parameters: null, returnType: null, annotations: '@Service', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classA3', parentFrontendId: 'featureA', type: 'class', name: 'ClassA3', description: '', parameters: null, returnType: null, annotations: '@Repository', posX: 24, posY: 40, width: null, height: null },

    // --- 기능B 메소드 ---
    { frontendId: 'methodB1a', parentFrontendId: 'classB1', type: 'method', name: 'methodB1a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB1b', parentFrontendId: 'classB1', type: 'method', name: 'methodB1b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB1c', parentFrontendId: 'classB1', type: 'method', name: 'methodB1c', description: '', parameters: '', returnType: 'int', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB2a', parentFrontendId: 'classB2', type: 'method', name: 'methodB2a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB2b', parentFrontendId: 'classB2', type: 'method', name: 'methodB2b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB2c', parentFrontendId: 'classB2', type: 'method', name: 'methodB2c', description: '', parameters: '', returnType: 'String', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB3a', parentFrontendId: 'classB3', type: 'method', name: 'methodB3a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB3b', parentFrontendId: 'classB3', type: 'method', name: 'methodB3b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodB3c', parentFrontendId: 'classB3', type: 'method', name: 'methodB3c', description: '', parameters: '', returnType: 'List', annotations: null, posX: 16, posY: 40, width: null, height: null },

    // --- 기능B 클래스 ---
    { frontendId: 'classB1', parentFrontendId: 'featureB', type: 'class', name: 'ClassB1', description: '', parameters: null, returnType: null, annotations: '@RestController', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classB2', parentFrontendId: 'featureB', type: 'class', name: 'ClassB2', description: '', parameters: null, returnType: null, annotations: '@Service', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classB3', parentFrontendId: 'featureB', type: 'class', name: 'ClassB3', description: '', parameters: null, returnType: null, annotations: '@Repository', posX: 24, posY: 40, width: null, height: null },

    // --- 기능C 메소드 ---
    { frontendId: 'methodC1a', parentFrontendId: 'classC1', type: 'method', name: 'methodC1a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC1b', parentFrontendId: 'classC1', type: 'method', name: 'methodC1b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC1c', parentFrontendId: 'classC1', type: 'method', name: 'methodC1c', description: '', parameters: '', returnType: 'boolean', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC2a', parentFrontendId: 'classC2', type: 'method', name: 'methodC2a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC2b', parentFrontendId: 'classC2', type: 'method', name: 'methodC2b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC2c', parentFrontendId: 'classC2', type: 'method', name: 'methodC2c', description: '', parameters: '', returnType: 'String', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC3a', parentFrontendId: 'classC3', type: 'method', name: 'methodC3a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC3b', parentFrontendId: 'classC3', type: 'method', name: 'methodC3b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodC3c', parentFrontendId: 'classC3', type: 'method', name: 'methodC3c', description: '', parameters: '', returnType: 'int', annotations: null, posX: 16, posY: 40, width: null, height: null },

    // --- 기능C 클래스 ---
    { frontendId: 'classC1', parentFrontendId: 'featureC', type: 'class', name: 'ClassC1', description: '', parameters: null, returnType: null, annotations: '@Service', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classC2', parentFrontendId: 'featureC', type: 'class', name: 'ClassC2', description: '', parameters: null, returnType: null, annotations: '@Service', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classC3', parentFrontendId: 'featureC', type: 'class', name: 'ClassC3', description: '', parameters: null, returnType: null, annotations: '@Repository', posX: 24, posY: 40, width: null, height: null },

    // --- 기능D 메소드 ---
    { frontendId: 'methodD1a', parentFrontendId: 'classD1', type: 'method', name: 'methodD1a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD1b', parentFrontendId: 'classD1', type: 'method', name: 'methodD1b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD1c', parentFrontendId: 'classD1', type: 'method', name: 'methodD1c', description: '', parameters: '', returnType: 'String', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD2a', parentFrontendId: 'classD2', type: 'method', name: 'methodD2a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD2b', parentFrontendId: 'classD2', type: 'method', name: 'methodD2b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD2c', parentFrontendId: 'classD2', type: 'method', name: 'methodD2c', description: '', parameters: '', returnType: 'List', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD3a', parentFrontendId: 'classD3', type: 'method', name: 'methodD3a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD3b', parentFrontendId: 'classD3', type: 'method', name: 'methodD3b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodD3c', parentFrontendId: 'classD3', type: 'method', name: 'methodD3c', description: '', parameters: '', returnType: 'boolean', annotations: null, posX: 16, posY: 40, width: null, height: null },

    // --- 기능D 클래스 ---
    { frontendId: 'classD1', parentFrontendId: 'featureD', type: 'class', name: 'ClassD1', description: '', parameters: null, returnType: null, annotations: '@Service', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classD2', parentFrontendId: 'featureD', type: 'class', name: 'ClassD2', description: '', parameters: null, returnType: null, annotations: '@Repository', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classD3', parentFrontendId: 'featureD', type: 'class', name: 'ClassD3', description: '', parameters: null, returnType: null, annotations: '@Component', posX: 24, posY: 40, width: null, height: null },

    // --- 기능E 메소드 ---
    { frontendId: 'methodE1a', parentFrontendId: 'classE1', type: 'method', name: 'methodE1a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE1b', parentFrontendId: 'classE1', type: 'method', name: 'methodE1b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE1c', parentFrontendId: 'classE1', type: 'method', name: 'methodE1c', description: '', parameters: '', returnType: 'int', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE2a', parentFrontendId: 'classE2', type: 'method', name: 'methodE2a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE2b', parentFrontendId: 'classE2', type: 'method', name: 'methodE2b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE2c', parentFrontendId: 'classE2', type: 'method', name: 'methodE2c', description: '', parameters: '', returnType: 'String', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE3a', parentFrontendId: 'classE3', type: 'method', name: 'methodE3a', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE3b', parentFrontendId: 'classE3', type: 'method', name: 'methodE3b', description: '', parameters: '', returnType: 'void', annotations: null, posX: 16, posY: 40, width: null, height: null },
    { frontendId: 'methodE3c', parentFrontendId: 'classE3', type: 'method', name: 'methodE3c', description: '', parameters: '', returnType: 'List', annotations: null, posX: 16, posY: 40, width: null, height: null },

    // --- 기능E 클래스 ---
    { frontendId: 'classE1', parentFrontendId: 'featureE', type: 'class', name: 'ClassE1', description: '', parameters: null, returnType: null, annotations: '@RestController', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classE2', parentFrontendId: 'featureE', type: 'class', name: 'ClassE2', description: '', parameters: null, returnType: null, annotations: '@Service', posX: 24, posY: 40, width: null, height: null },
    { frontendId: 'classE3', parentFrontendId: 'featureE', type: 'class', name: 'ClassE3', description: '', parameters: null, returnType: null, annotations: '@Repository', posX: 24, posY: 40, width: null, height: null },

    // --- 최상위 feature 5개 (배열 맨 뒤 → 버그 재현 핵심) ---
    { frontendId: 'featureA', parentFrontendId: null, type: 'feature', name: '기능A', description: '기능 A에 대한 설명', parameters: null, returnType: null, annotations: null, posX: 0,    posY: 0, width: null, height: null },
    { frontendId: 'featureB', parentFrontendId: null, type: 'feature', name: '기능B', description: '기능 B에 대한 설명', parameters: null, returnType: null, annotations: null, posX: 550,  posY: 0, width: null, height: null },
    { frontendId: 'featureC', parentFrontendId: null, type: 'feature', name: '기능C', description: '기능 C에 대한 설명', parameters: null, returnType: null, annotations: null, posX: 1100, posY: 0, width: null, height: null },
    { frontendId: 'featureD', parentFrontendId: null, type: 'feature', name: '기능D', description: '기능 D에 대한 설명', parameters: null, returnType: null, annotations: null, posX: 1650, posY: 0, width: null, height: null },
    { frontendId: 'featureE', parentFrontendId: null, type: 'feature', name: '기능E', description: '기능 E에 대한 설명', parameters: null, returnType: null, annotations: null, posX: 2200, posY: 0, width: null, height: null },
  ],

  edges: [
    { frontendId: 'edge_1', sourceFrontendId: 'methodA1a', targetFrontendId: 'methodB1a', sourceHandle: 'right', targetHandle: 'left', type: 'call', badgeCount: 1 },
    { frontendId: 'edge_2', sourceFrontendId: 'methodB2b', targetFrontendId: 'methodC2a', sourceHandle: 'right', targetHandle: 'left', type: 'call', badgeCount: 1 },
    { frontendId: 'edge_3', sourceFrontendId: 'methodC3a', targetFrontendId: 'methodD1b', sourceHandle: 'right', targetHandle: 'left', type: 'call', badgeCount: 1 },
    { frontendId: 'edge_4', sourceFrontendId: 'methodD2a', targetFrontendId: 'methodE3a', sourceHandle: 'right', targetHandle: 'left', type: 'call', badgeCount: 1 },
  ],
};
