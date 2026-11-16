# FOOD FINDER 0.6 수정본 — 배포 전 확인

이번 수정본은 로컬 구현과 자동 테스트 26개 통과까지 확인했습니다. 원격 저장소 푸시나 Render/Vercel 배포는 하지 않았습니다. 최신 변경 내용·API 검증·제한·도메인 검토는 [구현 보고서](docs/IMPLEMENTATION_REVIEW_KO.md)를 먼저 읽어 주세요.

0.6은 중계 서명에 시작 행이 추가되어 Render와 Vercel을 같은 버전으로 갱신해야 합니다. 프리뷰에서 함께 검증하거나 점검 구간을 잡아 전환하고, 롤백도 함께 수행하세요. `lib/` 폴더도 반드시 배포에 포함해야 합니다.

영양정보를 사용하려면 Render에 별도 `MFDS_NUTRITION_API_KEY`를 설정하세요. 공공데이터포털 식품영양성분DB의 **디코딩 인증키**입니다. 없으면 영양정보를 미제공으로 표시합니다. 공식 API의 실제 운영 인증키 조회·매칭은 이번 환경에서 미검증입니다.

로컬 실행: Node 20 이상에서 `npm test`, `npm start`. 외부 의존성은 없습니다.

아래는 기존 0.4 배포 안내이며 환경 구성 참고용입니다. 갱신 후 `/health` 버전은 **0.6**이어야 합니다. 도메인 연결은 실행하지 않았습니다.

---

# 기존 환경 구성 참고

## 1) GitHub 업데이트
이 압축파일 내부의 파일과 폴더를 GitHub `food-finder` 저장소에 업로드합니다. 기존 `server.js`, `index.html`, `static/app.js`, `static/style.css` 파일은 새 내용으로 덮어써야 합니다. `api/bridge.js`, `api/ping.js`, `vercel.json`은 새로 추가됩니다.

GitHub에서는 기존 파일의 내용 변경을 웹 편집기로 수행하거나 git을 사용하세요. GitHub 웹의 `Upload files`는 기존 경로를 덮어쓰는 경우 변경으로 처리될 수 있습니다. 업로드 후 파일 경로가 정확한지 확인하세요.

## 2) Vercel 서울 서버 배포
- https://vercel.com/new 접속 → GitHub `food-finder` 저장소 Import
- Framework Preset `Other`, Root Directory 비움
- Environment Variables에서 `FOODSAFETY_API_KEY`를 **Render와 동일한 값**으로 등록 (키를 GitHub 또는 채팅에 넣지 말기)
- Deploy 클릭. `vercel.json`에는 서울(`icn1`) 지역 설정이 있습니다.
- Vercel이 발급한 실제 주소의 `/api/ping`을 접속: `region`이 `icn1`인지, `http80.ok` 또는 `https443.ok`가 true인지 확인

## 3) Render에 서울 중계 URL 연결
- Render > food-finder > Environment > Add Environment Variable
- KEY: `FOOD_FINDER_BRIDGE_URL`
- VALUE: `https://본인-Vercel-프로젝트-주소/api/bridge` (반드시 **실제** 주소 입력)
- 기존 `FOODSAFETY_API_KEY`는 그대로 유지. `Save, deploy` 후 재배포 확인
- https://food-finder-xvee.onrender.com 에서 `식품안전나라 실시간` 검색으로 테스트

## 실패할 경우
- Vercel `/api/ping`: http80와 https443 둘 다 false라면 서울에서도 네트워크 제한 가능성. 여기서부터 원인을 추가 조사해야 합니다.
- Render 검색: '중계 인증 실패'는 Render/Vercel API 키 불일치, '서울 중계 연결 오류'는 URL/배포 실패 가능성.
- 인증키가 포함된 URL이나 스크린샷을 공유하지 마세요.

## 보안 및 운영
- 인증키는 각 서버 환경변수에만 저장하며, 웹 프런트에는 포함하지 않습니다.
- Render에서 Vercel로 전송하는 요청은 HMAC-SHA256으로 인증합니다.
- 공식 데이터 출처: 식품안전나라. 자동 이미지 매칭과 가격 수집은 아직 구현되지 않았습니다.
- 서울 서버에서도 식품안전나라 API 연결이 될지는 실제 배포 후 확인해야 합니다.
