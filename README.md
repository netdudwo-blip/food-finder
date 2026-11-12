# FOOD FINDER WEB · MVP 0.1

**실제로 실행 가능한 웹앱**입니다. 브라우저 화면, 제품 검색, 상세 조회, 외부 이미지/쇼핑 검색 링크가 있습니다. Node.js 20+ 기본 기능만 사용해 별도 npm 패키지 설치가 필요 없습니다.

## 완료된 기능
- 체험 모드: 공식 식품안전나라 API 문서의 **샘플을 참고한 예시** 제품 4개 검색 및 상세 조회. 별도 API 키 없이 실행됩니다.
- 실시간 모드: 서버의 API 키를 설정하면 식품안전나라 `I1250` 품목제조보고 API에서 제품명 검색/보고번호 상세 조회, `C002`에서 원재료 조회를 시도합니다. **유효한 키로의 통합테스트는 아직 진행되지 않았습니다.**
- 검색 결과에서 제조사 및 품목제조보고번호로 제품 구별.
- 제품 상세에서 구글/네이버 제품 이미지, 표시사항, 네이버쇼핑/구글쇼핑 검색 페이지 열기.

## 아직 미구현
- 이미지 자동 수집/매칭/검증, 쇼핑몰 판매가격 자동 비교, 대체품 추천, 로그인/권한 관리.
- 실시간 API 연결에 대한 발급 키 기반 통합 검증.

## 인터넷 웹사이트 배포 (Render)
1. GitHub에서 새 **비공개 저장소**를 생성해 ZIP 압축파일의 내용물을 저장소 최상위에 업로드합니다.
2. [Render](https://render.com)에 가입하고 GitHub 저장소를 연결합니다.
3. Render → **New → Web Service** 에서 해당 저장소를 선택합니다.
4. Runtime `Node`, Build Command `npm install`, Start Command `npm start` 를 설정합니다. `render.yaml`도 포함되어 있습니다.
5. 실시간 검색이 필요하면 Render의 **Environment** 화면에서 `FOODSAFETY_API_KEY`에 식품안전나라에서 발급한 인증키를 입력하세요. 키는 GitHub 소스나 브라우저에 올리지 마세요.
6. 배포 성공 시 Render가 실제 `https://...onrender.com` 접속 주소를 발급합니다. **현재 ZIP 자체에는 실제 운영 URL이 없습니다.**

호스팅 상품의 무료 사용 가능 여부/한도는 변경될 수 있습니다.

## 개발용 로컬 테스트 (최종 웹 사용자는 설치 불필요)

```sh
node server.js
```

브라우저에서 `http://localhost:3000`. 자동 테스트는 `node --test test-server.js`.

## 데이터 문서
- [I1250 품목제조보고](https://www.foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=I1250)
- [C002 원재료](https://www.foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=C002)

샘플 데이터는 공식 API 샘플에서 제품/제조사/제조보고번호를 참고했으나 실제 공공 API 실시간 응답을 뜻하지 않습니다. 원재료/이미지 검색 결과는 동일한 판매 제품으로 검증되지 않았습니다.
