# ChatGPT 구름툴 (ChatGPT Gurum Tool)

ChatGPT 사용량 모니터링, 대화 내보내기, 컨텍스트 추적 등을 지원하는 Chrome 확장 프로그램입니다.

## 주요 기능

1. 메시지 갯수 카운트 및 한도 관리
2. 딥리서치(Deep Research) 남은 횟수 표시
3. 대화 기록 내보내기

4. 컨텍스트 크기 계산

## 설치 방법



## TODO

- PDF 형식으로 대화 내보내기
- 특정 메시지 구간 선택하여 내보내기
- 사용 패턴 분석 및 시각화 그래프
- 모델별 응답 시간 통계


## 라이선스

ISC

## 릴리스 빌드(난독화/경량화)

- 명령어:
  - `npm run release`
    - 단계 1: `npm run build`로 tiktoken 번들(`dist/tiktoken.bundle.js`) 갱신
    - 단계 2: `webpack.release.js`로 소스 `*.js` 최소화/난독화 및 자원 복사
    - 산출물: `build/` 폴더(크롬에 바로 업로드 가능) + `build/release.zip`, `build/release_<version>.zip`

- 포함/제외 정책:
  - JS: `background.js`, `content.js`, `popup.js`, `fetch-hook.js`, `request-hook.js`, `token-calculator.js`
    - Terser 최소화 + MV3 안전 옵션으로 난독화(서비스 워커 `background.js`는 난독화 제외, 최소화만 수행)
  - HTML: `popup.html`은 압축(minify)
  - 정적: `manifest.json`, `icons/`, `dist/`, `thirdParty/`는 그대로 복사(외부 번들은 난독화 제외)

- 주의사항:
  - 난독화 옵션은 MV3 CSP를 고려해 `eval`류를 사용하지 않는 프로파일로 설정됨
  - 디버깅이 필요하면 `webpack.release.js`의 `WebpackObfuscator` 플러그인을 임시로 주석 처리하세요
