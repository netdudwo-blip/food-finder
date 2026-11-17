# FOOD FINDER 0.6 수정본 — 배포 전 확인

## 구매 비교 B안

- `/`의 **동일·유사제품 비교** 메뉴에서 홈과 같은 품목 통합검색으로 기준품을 선택합니다. 비교표는 최대 세 견적, 판매처 목록은 10건씩 표시합니다. 홈에서 상세정보를 연 뒤 견적 비교로 바로 이동해도 같은 품목번호를 사용합니다.
- 일치 여부는 같은 포장 규격과 확인한 품목번호·바코드 또는 라벨의 제품명과 제조사로 판단합니다. 판매 단위가 다르거나 동일성을 확인하지 못한 견적은 따로 보관합니다. 동일 견적이 없으면 직접 등록한 유사품 후보를 표시합니다. 배송비를 빈칸으로 둔 견적은 합계와 배송비 포함 단가를 표시하지 않습니다.
- 기본 제공은 쿠팡, 네이버쇼핑, Google, 기타몰 검색 링크와 **확인한 견적 직접 저장**입니다. 저장은 현재 브라우저에만 적용됩니다. 이전 브라우저 견적은 그대로 보존하고 새 기준품과 확인한 규격을 연결해 복사 등록할 수 있습니다. 체험 모드는 가상의 가격만 표시합니다.
- 쿠팡은 키가 필요 없는 일반 검색 링크만 제공하며, 가격·배송비는 판매 페이지에서 확인해 견적으로 입력합니다. 선택 사항인 `BRAVE_SEARCH_API_KEY`는 [일반 웹 판매처 후보](https://api-dashboard.search.brave.com/app/documentation/web-search/query)에만 사용합니다. 키 없이도 검색 링크와 견적 기능을 사용할 수 있습니다. 웹 후보 검색은 서버 프로세스에서 시간당 10회 이내로 제한하며, 검색 결과 제목이나 요약에서 가격을 가져오지 않습니다.
- [네이버 공개 쇼핑 검색 API](https://developers.naver.com/notice/article/32564)는 종료되어 검색 페이지 링크로 제공합니다. [Google Custom Search JSON API](https://developers.google.com/custom-search/v1/overview)는 신규 고객에게 제공되지 않으므로 Google 검색도 링크로 제공합니다. API 키를 공개 파일이나 브라우저 코드에 넣지 마세요.
- 검증은 `npm test`로 실행합니다. 웹 검색 서비스는 실제 키를 설정한 후 별도로 검증해야 합니다. 로컬 확인은 `npm start` 후 `http://localhost:3000/#compare`에서 체험 데이터로 전환하고 ‘진간장’을 검색하세요.

## 기존 0.6 배포 참고

구매 비교 도입 전 0.6의 검색·영양 연동과 제한은 [기존 구현 보고서](docs/IMPLEMENTATION_REVIEW_KO.md)를 참고하세요.

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
## 기업 검색

기업명·공시회사명 또는 등록번호로 검색합니다. 목록과 상세 장표에는 법인등록번호를 식별자로 사용합니다.

- 기본 명부는 [금감원 기업개황 엑셀](https://dart.fss.or.kr/dsae001/downloadExcel.do)의 2026-11-16 확인본입니다. 주요제품은 [KIND 상장법인목록](https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage)의 종목코드를 대조했습니다.
- [공정위 기업집단포털](https://egroup.go.kr/egps/wi/stat/kap/psitnCmpnySumryList.do)의 2026-05 지정자료에서 그룹·직원수·결산일·매출(백만원)을 연결합니다. 규모는 사업보고서의 중소·중견기업 해당 여부를 우선 표시합니다.
- 최근 연간 매출은 당해 연도부터 이전 3개 연도의 DART 사업보고서를 확인합니다. 한 사업연도에 개별·별도 자료를 먼저 확인하고 연결 자료도 확인합니다. 12개 식품사의 검증된 공시를 함께 제공합니다. 신규 조회 시 확인한 금액에는 원문 링크, 금액 단위와 결산일을 표시합니다.
- Render 서버에 NTS_BUSINESS_API_KEY를 설정하면 [국세청 사업자등록 상태](https://www.data.go.kr/data/15081808/openapi.do)를, HACCP_COMPANY_API_KEY를 설정하면 [HACCP 인증업체정보](https://www.data.go.kr/data/15033311/openapi.do)를 조회합니다. 각 서비스 활용 승인을 받은 일반 인증키(Decoding)를 사용합니다. HACCP은 검색 응답에서 사업자번호가 일치하는 사업장·품목의 인증번호와 종료일을 표시합니다.
- 국세청 업종코드는 현재 수록 자료에서 확인할 수 없어 미제공으로 표시합니다.
## 식품 동향 화면 · 2026-11-17 확인본

- 6개 카드에서 각기 연간·월간을 선택합니다. 데이터는 static/market-data.json 확인본이며 자동 갱신은 아직 연결 전입니다.
- 물가 월간 총지수는 국가데이터처 2026년 10월 소비자물가 발표의 전년동월비입니다. 연간은 세계은행 FP.CPI.TOTL.ZG(KOR, IMF International Financial Statistics) 확인본입니다.
- 원/달러는 Federal Reserve H.10 / FRED DEXKOUS 일별 관측치에서 완료 월 평균을 계산합니다. 연간은 12개월 월평균의 평균입니다.
- 브렌트·WTI·미국 소맥 SRW/HRW는 World Bank Commodity Price Data (Pink Sheet) 월평균이며 연간은 12개월이 확보된 해의 평균입니다. https://www.worldbank.org/en/research/commodity-markets
- 임금은 최저임금위원회 연도별 결정현황입니다. 월간 그래프에는 해당 월 적용 시급을 표시합니다.
- 소비자물가 세부 항목은 KOSIS/ECOS 12년 원본을 확보해야 합니다. 에틸렌·나프타는 원본의 공표 단위·월평균 여부를 확인해야 합니다. KAMIS 추가 시 requester ID와 키, 지역·품목·등급·단위 결정이 필요합니다.
- 사진은 Unsplash 일반 라이선스(상업 이용 허용)의 실제 식품 사진입니다. https://unsplash.com/license
  - https://images.unsplash.com/photo-1542838132-92c53300491e (채소 진열)
  - https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38 (식재료 접시)

## 포장재 이미지 백과 및 차트 상세값
- 포장재 카드는 가격을 제공하지 않습니다. 사진, 형태 구별, 예시 용도, 일반 생산 공정과 주문 시 확인사항을 제공합니다.
- 분류 참고 자료는 사용자가 지정한 블로그 https://m.blog.naver.com/utimegps/221569542967 이며, 전체 본문을 전재하지 않고 포장재 재질·형태 구분에 참고했습니다.
- 대표사진·제품규격은 새로피엔엘과 두레의 공개 제품 자료를 2026-11-17 확인했습니다. 각 카드에 사진의 업체·모델과 원문 링크를 제공합니다.
- 공정 설명은 개별 SKU의 확정 공정이 아닌 해당 형태의 일반 생산 설명입니다. 카드별 생산 관련 공식 출처 링크를 제공합니다.
- 기성품 판매 묶음 및 박스 입수량은 맞춤 제작 MOQ로 취급하지 않습니다. 제조사가 공개하지 않은 MOQ는 미공개로 표시합니다. 새 금형, 인쇄, 수지·코팅, 샘플 승인, 납기는 개별 협의가 필요합니다.
- 차트 위에서 마우스를 움직이거나 차트에 포커스를 둔 뒤 좌우/Home/End 키를 누르면 해당 날짜의 종목별 값을 표시합니다. Escape 또는 포커스·포인터가 벗어나면 숨깁니다.
