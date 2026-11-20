# set-list

공연 때 관객이 휴대폰으로 열어보는 손글씨 셋리스트 페이지를 만드는 프로젝트예요.
오선지 노트에 손으로 쓴 글씨를 그대로 따서 쓰고, 곡 제목을 누르면 가사가 열려요.
아이패드에 띄워두는 무대용 화면과 접속용 QR 코드도 함께 들어 있어요.

- 공연 목록: `https://iamdoned.github.io/set-list/`
- 공연 페이지: `https://iamdoned.github.io/set-list/shows/<공연 폴더>/`
- 아이패드 무대 화면: 공연 페이지 주소 끝에 `#stage`

## 폴더 구조

```
engine/            모든 공연이 같이 쓰는 화면 코드 (setlist.js, setlist.css)
  vendor/qrcode.js QR 생성기 (MIT, 인터넷 없이 동작)
themes/            색과 글씨체 묶음 (paper, midnight, cyanotype, blush)
shows/
  index.json       공연 목록 (첫 화면에 나옴)
  2026-11-21-openmic/
    index.html     거의 비어 있는 껍데기, 손댈 필요 없음
    show.json      이 공연의 내용 전부 (제목, 테마, 인스타, 곡, 가사)
    ink/           손글씨 이미지 (투명 PNG)
    source/        손글씨를 딴 원본 사진
templates/new-show/ 새 공연을 시작할 때 복사되는 틀
tools/             사진에서 손글씨를 따는 도구들
```

## 새 공연 추가하기

1. **틀 만들기**

   ```
   python3 tools/new_show.py 2026-12-24-xmas "크리스마스" --event 오픈마이크 --theme midnight
   ```

   `shows/2026-12-24-xmas/`가 생기고 공연 목록에도 추가돼요.

2. **손글씨 쓰고 찍기**: 셋리스트 제목, 주제 문장, 곡 제목을 오선지에 쓰고 위에서 정면으로, 그림자 없이 찍어요.
   - 줄과 줄 사이에 쓰고, 줄 간격은 넉넉하게 두기
   - 잘못 쓴 건 지우지 말고 옆에 다시 쓰기 (필요한 것만 골라서 따면 돼요)

3. **글씨 따기**

   ```
   python3 tools/heic2jpg.py IMG_1234.HEIC source/IMG_1234.jpg      # 아이폰 사진이면 먼저 변환
   python3 tools/extract_ink.py source/IMG_1234.jpg boxes.json shows/2026-12-24-xmas/ink --sheet check.jpg
   ```

   `boxes.json`에는 따낼 글씨의 위치(사진 픽셀 기준 왼쪽, 위, 오른쪽, 아래)를 적어요. 주제처럼 줄바꿈이 필요한 문장에는 `"words": true`를 붙이면 단어별로 나눠서 저장돼요.

   ```json
   [
     {"name": "title",  "box": [1224, 1094, 1886, 1253]},
     {"name": "song-1", "box": [749, 1426, 2189, 1584]},
     {"name": "theme",  "box": [187, 2828, 2779, 3053], "words": true}
   ]
   ```

   `check.jpg`에서 결과를 한눈에 확인할 수 있어요.

4. **`show.json` 채우기**: 곡 순서, 제목(화면 읽기용 텍스트), 손글씨 이미지 경로, 가사를 적어요. 가사는 줄마다 `\n`, 절 사이는 빈 줄(`\n\n`)로 나눠요.

5. **올리기**: 사이트는 `gh-pages` 브랜치에서 배포돼요. `main`에 커밋한 다음 같은 내용을 `gh-pages`에도 올리면 1분쯤 뒤에 반영돼요.

   ```
   git push origin main
   git push origin main:gh-pages
   ```

## show.json 항목

| 항목 | 설명 |
| --- | --- |
| `title`, `date`, `event` | 공연 이름, 날짜, 종류. 목록과 브라우저 탭에 쓰여요 |
| `theme` | `themes/` 안의 파일 이름 |
| `instagram` | 아이디 (`@` 없이). 비우면 표시 안 함 |
| `instagramUrl` | (선택) 아이디를 눌렀을 때 열 주소. 비우면 `instagram.com/아이디` |
| `lyricsFont` | 가사 글씨체(Google Fonts 이름). 비우면 테마 기본값 |
| `heading` | 셋리스트 제목 손글씨 `{src, alt}` |
| `subject` | 주제 문장 단어 이미지들 `{alt, words: [...]}` |
| `staff.idle`, `staff.levels` | 목록 화면과 곡마다 오선이 흔들리는 정도 (0.2 잔잔 ~ 0.5 꽤 출렁) |
| `songs` | `{title, src, w, h, lyrics}` 목록. `w`, `h`는 이미지 크기(픽셀). `extract_ink.py`가 출력해줘요 |
| `url` | (선택) QR에 넣을 주소를 고정하고 싶을 때. 비우면 현재 페이지 주소 |

## 테마

| 이름 | 느낌 |
| --- | --- |
| `paper` | 따뜻한 오선지 종이, 연필 글씨, 자주색 오선. 기기 다크 모드를 따라감 |
| `midnight` | 어두운 무대, 분필처럼 하얀 글씨, 장밋빛 오선 |
| `cyanotype` | 청사진 같은 파란 종이에 흰 글씨 |
| `blush` | 옅은 분홍 종이, 와인색 글씨, 나눔 펜글씨 |

`show.json`을 고치지 않고 주소 뒤에 `?theme=midnight`을 붙이면 다른 테마로 미리 볼 수 있어요.
새 테마는 `themes/paper.css`를 복사해서 색만 바꾸면 돼요.

## 동작

- 제목을 누르면 연필로 타원을 그린 뒤 그 곡 가사로 넘어가요.
- 오선지는 WebGL로 그리고, 뒤 곡으로 갈수록 조금씩 더 흔들려요.
- 가사는 고른 손글씨 폰트에 글자마다 미세한 기울기와 높이 차이를 주고, 연필 질감 필터를 입혀서 보여줘요.
- `#stage`: 보면대에 인쇄한 종이를 올려둔 것처럼 제목, 주제, 셋리스트, 손으로 그린 듯한 QR이 한 장에 고정돼서 보여요. 테마와 상관없이 종이색이고, 가로/세로 회전에 맞춰 배치가 바뀌고, 화면이 꺼지지 않게 유지해요.

## 화면 코드를 고쳤을 때

`engine/`이나 `themes/`를 고치면 `engine/version.json`의 `v` 값을 아무 새 값으로 바꿔주세요.
휴대폰이 예전 화면 코드를 캐시에 들고 있다가 새 공연 데이터와 섞이는 걸 막아줘요.

## 로컬에서 보기

```
python3 -m http.server
```

그다음 `http://localhost:8000/shows/2026-11-21-openmic/`를 열어요.
