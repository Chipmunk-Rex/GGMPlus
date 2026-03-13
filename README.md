# GGMPlus

GGM(ggm.gondr.net) 사이트를 위한 확장 프로그램입니다.

## 기능

- 자동 출석 체크
- 토큰 자동 감지 및 저장
- 출석 로그 확인
- 수동 출석 체크

## 설치 방법

### Chrome

1. `chrome://extensions/`로 이동합니다.
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 클릭합니다.
4. 이 저장소의 `chrome/` 폴더를 선택합니다.

### Firefox

1. `about:debugging#/runtime/this-firefox`로 이동합니다.
2. `Load Temporary Add-on...`을 클릭합니다.
3. 이 저장소의 `firefox/manifest.json`을 선택합니다.

## 사용 방법

1. `https://ggm.gondr.net`에 로그인합니다.
2. 확장 프로그램이 로그인 토큰을 자동으로 감지합니다.
3. 팝업에서 출석 상태를 확인하거나 수동 출석 체크를 실행할 수 있습니다.

## 프로젝트 구조

```text
GGMPlus/
|-- chrome/      # Chrome용 확장 프로그램
|-- firefox/     # Firefox용 확장 프로그램
|-- icons/       # 공용 아이콘 원본
|-- README.md
```

## 참고

- Chrome 패키지는 Manifest V3 service worker를 사용합니다.
- Firefox 패키지는 `background.scripts`와 Gecko 메타데이터를 사용합니다.
- Firefox 확장 ID: `ggmplus@chipmunk-rex`

## 제작자

- 신희섭 (겜마고 5기): 크롬 버전 제작
- 최찬호 (겜마고 5기): 파이어폭스 포팅
