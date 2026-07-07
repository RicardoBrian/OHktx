# 무료 배포 가이드 (오라클 클라우드 Always Free)

이 앱은 상시 폴링(15초 간격) + 헤드리스 브라우저 자동화 + 로컬 DB로 동작하기 때문에
Vercel 같은 서버리스 플랫폼과는 맞지 않습니다. 대신 **오라클 클라우드 Always Free VM**을
쓰면 코드 수정 없이, 평생 무료로 24시간 상시 구동할 수 있습니다.

아래 1~3번은 웹 콘솔/DNS 설정이라 직접 클릭해야 하는 부분이고, 4번부터는 스크립트 한 번으로 끝납니다.

---

## 1. 오라클 클라우드 계정 생성

1. https://www.oracle.com/cloud/free/ 접속 → **Start for free**
2. 이메일 인증, 개인정보 입력, **신용/체크카드 등록** (본인확인용, Always Free 한도 내에서는 과금되지 않습니다)
3. 홈 리전(Home Region)은 나중에 못 바꾸니 한국에서 지연시간이 낮은 리전(예: Japan Central/East, 또는 Korea Central이 뜨면 그걸로) 선택

## 2. Always Free VM 인스턴스 생성

콘솔 로그인 후:

1. 왼쪽 메뉴 → **Compute → Instances → Create Instance**
2. **Image**: Ubuntu 22.04 (또는 24.04) 선택
3. **Shape**: `Change shape` 클릭 →
   - 여유롭게 하려면 **Ampere (ARM), VM.Standard.A1.Flex**, 1 OCPU / 6GB 정도로 설정 (Always Free 한도 내 4 OCPU/24GB까지 무료)
   - ARM 재고가 없다는 오류가 뜨면 **VM.Standard.E2.1.Micro** (AMD, 1GB RAM) 선택 — 이것도 Always Free
4. **SSH 키 추가**: "Generate a key pair for me" 선택 후 **Private Key를 반드시 다운로드**해서 로컬에 보관 (다시 못 받음)
5. **Create** 클릭, 몇 분 뒤 인스턴스가 "Running" 상태가 되면 **Public IP** 주소를 기록

### 공인 IP 고정 (권장)

인스턴스 상세 페이지 → 연결된 VNIC → **Public IP** → `Edit` → **Ephemeral → Reserved** 로 변경.
이렇게 하면 VM을 재시작해도 IP가 안 바뀌어서, 아래 DuckDNS 설정을 한 번만 하면 됩니다.

### 방화벽 포트 열기 (VCN 보안 목록)

1. 인스턴스 상세 페이지 → **Subnet** 클릭 → **Security Lists** → 기본 보안 목록 클릭
2. **Add Ingress Rules** 로 아래 두 개 추가 (Source CIDR: `0.0.0.0/0`)
   - Destination Port: `80` (HTTP)
   - Destination Port: `443` (HTTPS)

## 3. 무료 도메인 연결 (DuckDNS)

Let's Encrypt로 HTTPS 인증서를 받으려면 도메인이 필요합니다. 무료로 충분합니다.

1. https://www.duckdns.org 접속 → 소셜 로그인
2. 원하는 서브도메인 입력 (예: `myohktx`) → `add domain`
3. 방금 기록한 오라클 VM의 **Public IP**를 입력하고 `update ip`
4. 최종 주소는 `myohktx.duckdns.org` 형태가 됩니다 (공인 IP를 고정했다면 이후 갱신 불필요)

---

## 4. 서버 접속 및 배포 스크립트 실행

로컬 터미널(Mac/Linux) 또는 WSL/PowerShell에서:

```bash
chmod 600 ~/Downloads/ssh-key-*.key   # 오라클에서 받은 private key 권한 설정
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<VM_공인IP>
```

접속 후 저장소를 내려받아 배포 스크립트를 실행합니다 (한 번이면 끝):

```bash
git clone https://github.com/RicardoBrian/OHktx.git
cd OHktx
sudo ./deploy/setup.sh myohktx.duckdns.org your-email@example.com
```

- 도메인/이메일 없이 `sudo ./deploy/setup.sh` 만 실행하면 HTTP로 `http://<VM_공인IP>:3000` 접속만 가능합니다 (이 경우 3000번 포트도 위 2번 방화벽 단계에서 추가로 열어야 함). 도메인이 있다면 위처럼 지정하는 걸 권장합니다(HTTPS 자동 적용).
- 스크립트가 Node.js, Playwright(크로미움), nginx, certbot 설치와 systemd 서비스 등록까지 전부 처리합니다.

## 5. 비밀번호/계정 설정

스크립트 실행 후 `/opt/ohktx/.env`가 자동 생성됩니다. 접속 비밀번호만 바꿔주면 됩니다:

```bash
sudo nano /opt/ohktx/.env
# APP_PASSWORD=change-me  →  원하는 비밀번호로 수정
sudo systemctl restart ohktx
```

이제 `https://myohktx.duckdns.org` (또는 http://VM공인IP:3000) 로 접속해서 로그인하고,
설정 화면에서 코레일 계정/카드정보를 등록하면 됩니다.

---

## 운영 명령어

```bash
sudo systemctl status ohktx      # 실행 상태 확인
sudo systemctl restart ohktx     # 재시작 (.env 수정 후 필요)
sudo journalctl -u ohktx -f      # 실시간 로그 보기
```

## 업데이트 배포 (코드가 바뀐 뒤)

```bash
cd /opt/ohktx
sudo git pull
sudo npm ci && sudo npm run build
sudo systemctl restart ohktx
```

또는 그냥 `sudo /opt/ohktx/deploy/setup.sh myohktx.duckdns.org your-email@example.com` 를
다시 실행해도 안전합니다 (기존 `.env`는 보존됩니다).

## 셀렉터 검증은 그대로 필요합니다

로컬 개발 환경(이 프로젝트를 만든 샌드박스)에서는 코레일 접속이 막혀 있어 실제 사이트 구조를
검증하지 못했습니다. 이 VM은 인터넷이 열려 있으니, `.env`에서 `BROWSER_HEADLESS=false`로 바꾸고
(SSH에 X11 포워딩을 쓰거나, 그냥 headless 상태에서 `journalctl -u ohktx -f` 로그와 에러 메시지를
보며) `src/korail/selectors.ts`를 실제 구조에 맞게 고쳐야 합니다. 자세한 절차는 `README.md`의
"셀렉터 검증" 섹션을 참고하세요.
