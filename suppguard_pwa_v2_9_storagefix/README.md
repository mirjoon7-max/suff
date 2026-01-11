# SuppGuard (MVP)

영양제 라벨(텍스트/사진 OCR)을 입력하면:
- 성분(일부 비타민/미네랄) 자동 추출
- 성분 중복/과용(UL 기준) 경고
- 약물 상황(갑상선약/와파린/항생제 등) 기반의 '복용 타이밍 가이드'
- 나이대별 '검토해볼 만한' 영양제 후보 리스트

> ⚠️ 의료행위가 아닌 참고용 앱입니다. 특히 약 복용/임신/질환이 있으면 의사/약사와 상의하세요.

## 실행 방법
1) Node.js 18+ 설치
2) 의존성 설치
   ```bash
   npm install
   ```
3) 개발 서버 실행
   ```bash
   npm run dev
   ```
4) 브라우저에서 http://localhost:5173 접속

### Windows에서 `npm : ... npm.ps1 ...` 에러가 날 때
PowerShell에서 스크립트 실행이 막혀 생기는 경우가 많습니다.

✅ 가장 쉬운 방법: **CMD(명령 프롬프트)** 또는 **Git Bash**에서 실행
```bat
cd C:\\Users\\<사용자>\\Downloads\\suppguard_pwa
npm install
npm run dev
```

또는 PowerShell에서 (현재 사용자만) 실행 허용:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## 배포
- Vercel/Netlify 등에 Vite 정적 배포로 올릴 수 있습니다.
- OCR은 브라우저에서 돌아가므로 별도 서버 없이 동작합니다(사진은 로컬 처리).

### ✅ 이메일/비밀번호 로그인(Supabase)
로그인이 필요하다면 Supabase 프로젝트를 만든 뒤 환경변수를 설정하세요.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

설정하면 앱이 자동으로 로그인 화면을 띄웁니다. (설정이 없으면 “데모로 보기” 가능)

### 🛒 쿠팡 파트너스 링크 자동 생성 (Netlify Functions)
이 프로젝트에는 Netlify Functions가 포함되어 있어, 쿠팡 파트너스 API 키를 서버 함수에 저장하고
프론트에서는 안전하게 호출하는 구조입니다.

Netlify 환경변수에 아래를 추가하세요.

- `COUPANG_ACCESS_KEY`
- `COUPANG_SECRET_KEY`
- (선택) `COUPANG_SUB_ID` : 트래킹용 서브 아이디

프론트에서는 `/.netlify/functions/coupangSearch` 와 `/.netlify/functions/coupangDeeplink` 를 호출합니다.

## 한계(현재 MVP)
- 라벨 파싱은 단순 정규식 기반이라 제품마다 인식률이 다릅니다(수동 수정/추가 제공).
- UL은 성인 기준의 보수적 기본값이며, 개인 상태에 따라 달라질 수 있습니다.
- 약물 상호작용은 대표적인 “주의 플래그”만 포함되어 있으며, 모든 약/성분을 커버하지 않습니다.

## 📱 핸드폰에서 “앱처럼” 쓰기 (PWA)
이 프로젝트는 PWA로 설치할 수 있습니다.

### Android (Chrome)
1) 배포된 주소(HTTPS)로 접속
2) 브라우저 메뉴 → **앱 설치/홈 화면에 추가**
3) 홈 화면 아이콘으로 실행 (주소창 없이 실행됨)

### iPhone/iPad (Safari)
1) 배포된 주소(HTTPS)로 접속
2) **공유 버튼(⬆️)** → **홈 화면에 추가**
3) 홈 화면 아이콘으로 실행

> 카메라/설치 기능은 HTTPS에서 안정적입니다. 로컬(localhost)은 개발용으로만 사용하세요.

## 배포(추천)
- Vercel/Netlify/Cloudflare Pages 중 아무 곳이나 가능 (Vite 정적 사이트)
- Build command: `npm run build`
- Output directory: `dist`

### Netlify 권장 설정
이 프로젝트는 `netlify.toml`이 포함되어 있어 그대로 배포하면 됩니다.

