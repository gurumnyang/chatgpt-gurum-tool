# ChatGPT 구름툴 (ChatGPT Gurum Tool)

ChatGPT 사용량 모니터링, 대화 내보내기, 컨텍스트 추적 등을 지원하는 Chrome 확장 프로그램입니다.

## 주요 기능

1. 메시지 갯수 카운트 및 한도 관리
2. 딥리서치(Deep Research) 남은 횟수 표시
3. 대화 기록 내보내기

4. 컨텍스트 크기 계산

## 설치 방법



## 모델 한도 동기화

- 원격 플랜 한도 파일을 주기적으로 자동 동기화합니다.
- 소스: `https://raw.githubusercontent.com/gurumnyang/chatgpt-gurum-tool/main/config/plan-limits.json`
- 동작:
  - 확장 설치/브라우저 시작 시 즉시 동기화 시도
  - 이후 6시간마다 자동 동기화 (네트워크 오류 시 폴백: 내장 기본 한도 사용)
  - 팝업 > 설정 탭에서 마지막 동기화 시점 확인 및 “지금 동기화” 수동 실행 가능

## TODO

- PDF 형식으로 대화 내보내기
- 특정 메시지 구간 선택하여 내보내기
- 사용 패턴 분석 및 시각화 그래프
- 모델별 응답 시간 통계


## 라이선스

ISC
