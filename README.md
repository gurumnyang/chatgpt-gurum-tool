# ChatGPT 구름툴

<div align="center">

  <br/>

  <a href="https://chromewebstore.google.com/detail/ijlfohfpnjjbmmjmodggppclmllbkmnp">
    <img alt="Chrome Web Store rating" src="https://img.shields.io/chrome-web-store/stars/ijlfohfpnjjbmmjmodggppclmllbkmnp?label=Chrome%20rating&logo=googlechrome&logoColor=white" />
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/%EA%B5%AC%EB%A6%84%ED%88%B4-chatgpt-%EB%B3%B4%EC%A1%B0%EB%8F%84%EA%B5%AC/">
    <img alt="Firefox Add-ons rating" src="https://img.shields.io/amo/stars/구름툴-chatgpt-보조도구?label=Firefox%20rating&logo=firefoxbrowser&logoColor=white" />
  </a>
  <a href="https://github.com/gurumnyang/chatgpt-gurum-tool/stargazers">
    <img alt="GitHub Stars" src="https://img.shields.io/github/stars/gurumnyang/chatgpt-gurum-tool?style=social" />
  </a>

</div>

ChatGPT 사용량 모니터링, 대화 내보내기, 컨텍스트 추적을 돕는 브라우저 확장 프로그램(Chrome/Firefox 지원)입니다.

## 주요 기능

- 모델별 메시지/한도 사용량 표시
- 딥리서치(Deep Research) 남은 횟수 및 리셋 시간 안내
- 현재 대화 컨텍스트 크기 계산(베이스/추론 모드)
- 대화 기록 내보내기: Markdown, JSON, 텍스트, 클립보드
- 플랜/테마/언어 설정 지원
- 메시지 타임스탬프 표시 기능
- 모델 한도 원격 자동 동기화

# Notes to Reviewers

## Build Instructions (English)

- Install Node.js 18 LTS or newer (npm included).
- Install dependencies: `npm install`

> The bundles inside `dist/` are generated from `src/tiktoken-wrapper.js` via Webpack. Run the commands below in order to reproduce the submitted release artifacts.

### Common bundle (Chrome & Firefox shared)

```bash
npm install
npm run build
```

- Generates / updates `dist/tiktoken.bundle.js`.
- The resulting file is copied to `thirdParty/` and `build-firefox/` and must be up to date before packaging.

### Firefox release reproduction (`build-firefox`)

```bash
npm install
npm run build
npm run build:firefox
```

- `build:firefox` uses `webpack.release.firefox.js` to wipe `build-firefox/` and rebuild the Firefox-specific bundle.
- Outputs:
  - Minified `.js` files, optimized `popup.html`, and the Firefox manifest rewritten as `build-firefox/manifest.json`.
  - Two archives: `build-firefox/firefox_release.zip` and `build-firefox/firefox_release_<package.json version>.zip`. These match the packages uploaded to Mozilla Add-ons.
- Optional verification: inspect archive contents with `unzip -l build-firefox/firefox_release.zip` or compare checksums via `shasum -a 256 build-firefox/firefox_release.zip`.

> Chrome release packages are created with `npm run build:release` and also require `dist/` to be freshly built.

---

## 빌드 준비 (Korean)

- Node.js 18 LTS 이상 (npm 포함)
- 의존성 설치: `npm install`

> `dist/` 디렉터리의 번들 파일은 `src/tiktoken-wrapper.js`를 Webpack으로 빌드해 생성합니다. 릴리스 시점의 파일과 동일한 결과물을 얻으려면 아래 명령을 순서대로 실행하세요.

### 공통 번들 (Chrome/Firefox 공용)

```bash
npm install
npm run build
```

- 위 명령은 `dist/tiktoken.bundle.js`를 새로 생성하거나 갱신합니다.
- 생성된 파일은 `thirdParty/`와 `build-firefox/`로 복사되어 각 스토어 제출 번들에 포함됩니다.

### Firefox 패키지 재현 (build-firefox)

```bash
npm install
npm run build
npm run build:firefox
```

- `build:firefox`는 `webpack.release.firefox.js` 설정을 사용해 `build-firefox/` 폴더를 깨끗이 비운 뒤, Firefox용 확장 번들을 재생성합니다.
- 결과물:
  - `build-firefox/`에 최적화된 `.js`와 `popup.html`, 변환된 `manifest.json`이 생성됩니다.
  - 동일 폴더에 `firefox_release.zip`, `firefox_release_<package.json version>.zip` 두 개의 압축 파일이 만들어집니다. 이들은 Mozilla Add-ons에 제출한 빌드와 동일한 파일입니다.
- 필요 시 `unzip -l build-firefox/firefox_release.zip`과 같이 압축 내용을 확인하거나, 제출 전 체크섬 비교(`shasum -a 256 build-firefox/firefox_release.zip`)로 파일 동일성을 검증할 수 있습니다.

> Chrome 패키지는 `npm run build:release` 명령으로 생성할 수 있으며, Firefox와 동일하게 `dist/`가 최신 상태여야 합니다.

## 라이선스

ISC
