# 🚀 회사 서버 배포 가이드

이 `deploy/` 폴더의 파일들은 회사 서버에서 바로 사용할 수 있도록
상대 import를 절대 import로 변환한 버전입니다.

---

## 📋 배포 순서

### 1단계: React 프론트엔드 빌드 (로컬 또는 회사 PC)

```bash
cd client
pnpm install
pnpm run build
```

빌드 결과물은 `client/dist/` 에 생성됩니다.

### 2단계: 회사 서버에 파일 배치

```
회사 웹앱 폴더/
├── static/                    ← client/dist/ 안의 모든 파일 복사
│   ├── index.html
│   └── assets/
│       ├── index-xxx.js
│       └── index-xxx.css
├── web_main.py                ← deploy/web_main.py 복사 (★)
├── database.py                ← deploy/database.py 복사
├── search_engine.py           ← deploy/search_engine.py 복사
├── routes/                    ← deploy/routes/ 폴더 통째로 복사
│   ├── __init__.py
│   ├── projects.py
│   ├── experiments.py
│   ├── splits.py
│   ├── search.py
│   ├── upload.py
│   ├── llm_search.py
│   ├── line_lots.py
│   └── analysis.py
├── requirements.txt           ← deploy/requirements.txt 복사
├── uploads/                   ← 직접 생성 (mkdir uploads)
├── wsgi.ini                   ← 기존 유지
├── web_daemon.sh              ← 기존 유지
└── ...기타 기존 파일들
```

### 3단계: 패키지 설치

```bash
pip install -r requirements.txt
```

### 4단계: 서버 실행

```bash
# 개발 테스트
python web_main.py

# 운영 (데몬)
./web_daemon.sh start
```

---

## ⚠️ 주의사항

1. `client/dist/` 전체를 `static/` 폴더에 넣으세요 (index.html 포함)
2. `uploads/` 폴더가 없으면 직접 생성하세요
3. `database.py`의 `DB_PATH`가 lab.db를 자동으로 같은 폴더에 생성합니다
4. 기존 회사 설정(NLS_LANG, SECRET_KEY 등)은 `web_main.py`에 이미 포함되어 있습니다
