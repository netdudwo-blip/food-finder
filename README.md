# FOOD FINDER 서버 수정 v0.3

현재 GitHub의 `server.js`를 새 파일로 교체하면 되는 최소 수정본입니다.
다른 파일은 교체할 필요 없습니다.

## 고친 내용

- 식품안전나라 API 요청을 IPv4로 고정해 IPv6 연결 문제 가능성을 제거합니다.
- Node.js 내장 HTTP/HTTPS 클라이언트를 이용하며 HTTPS 우선, 공식 HTTP 주소를 대체 경로로 사용합니다.
- 요청 대기시간을 프로토콜별 14초로 늘리고 타임아웃 단계를 구분합니다.
- DNS, TCP 80, TLS 443, 실시간 I1250 기본 조회를 별도로 진단하는 `/diagnostics` 페이지를 추가했습니다.
- 인증키를 진단 화면·응답에 출력하지 않습니다.

## GitHub에 업데이트
1. https://github.com/netdudwo-blip/food-finder/blob/main/server.js 방문
2. 연필 모양(Edit) 클릭
3. 현재 코드를 지우고, 이 ZIP의 `server.js` 내용을 전부 붙여넣기
4. Commit changes 클릭
5. Render 자동 배포가 Live가 되면 https://food-finder-xvee.onrender.com/health 에서 `version: 0.3` 확인
6. https://food-finder-xvee.onrender.com/diagnostics 방문, 진단 결과 확인

**중요**: 현 시점에서는 사용자의 Render 호스팅 환경에서 직접 진단을 실행하지 못했습니다.
IPv4/대기시간 변경이 직접 해결할 수 있지만, Render에서 API 서버 접근 자체가 차단되었다면 별도 중계 서버나 다른 리전/호스팅이 필요합니다.

**안전**: `/diagnostics`에 API 인증키가 노출되지는 않지만, 공개 진단 페이지이므로 문제 해결 후에는 진단 기능을 비활성화하는 업데이트가 권장됩니다. GitHub에 인증키를 붙여넣지 마세요.

## 로컬 테스트
Node.js 20 이상에서 `npm test`. 기본 기능 테스트 7개와 모의 네트워크 테스트 4개를 포함합니다. 실시간 식품안전나라 및 Render 서버를 직접 연동한 테스트는 아닙니다.
