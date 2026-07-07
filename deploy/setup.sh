#!/usr/bin/env bash
# OHktx 배포 스크립트 (Ubuntu 22.04/24.04 대상, Oracle Cloud Always Free VM 기준)
#
# 사용법:
#   sudo ./setup.sh [도메인] [인증서용 이메일] [git 브랜치(기본: main)]
#
# 예:
#   sudo ./setup.sh myname.duckdns.org me@example.com
#
# 도메인/이메일을 생략하면 nginx+HTTPS 설정은 건너뛰고 http://VM공인IP:3000 으로만 접속 가능합니다.
set -euo pipefail

DOMAIN="${1:-}"
CERT_EMAIL="${2:-}"
BRANCH="${3:-main}"
REPO_URL="https://github.com/RicardoBrian/OHktx.git"
APP_DIR="/opt/ohktx"
APP_USER="ohktx"

if [[ $EUID -ne 0 ]]; then
  echo "root 권한으로 실행하세요: sudo $0 ${DOMAIN} ${CERT_EMAIL}" >&2
  exit 1
fi

echo "==> 시스템 패키지 업데이트"
apt-get update -y
apt-get install -y curl git ufw

echo "==> Node.js 22 설치"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> 전용 시스템 계정(${APP_USER}) 생성"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

echo "==> 애플리케이션 코드 배치 (${APP_DIR})"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "==> npm 의존성 설치 및 빌드"
cd "$APP_DIR"
npm ci
npm run build

echo "==> Playwright 크로미움 + 시스템 의존성 설치"
npx playwright install --with-deps chromium

echo "==> .env 준비"
if [[ ! -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  SESSION_SECRET="$(openssl rand -hex 32)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" "$APP_DIR/.env"
  sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/" "$APP_DIR/.env"
  echo ""
  echo "  ⚠️  ${APP_DIR}/.env 파일이 새로 생성되었습니다."
  echo "     APP_PASSWORD=change-me 를 반드시 원하는 비밀번호로 바꾸세요:"
  echo "     sudo nano ${APP_DIR}/.env"
  echo "     그 다음: sudo systemctl restart ohktx"
  echo ""
else
  echo "  기존 .env 파일을 유지합니다."
fi

echo "==> 데이터 디렉터리 권한 설정"
mkdir -p "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> systemd 서비스 등록"
cp "$APP_DIR/deploy/ohktx.service" /etc/systemd/system/ohktx.service
systemctl daemon-reload
systemctl enable ohktx
systemctl restart ohktx

echo "==> 방화벽(ufw) 설정"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [[ -n "$DOMAIN" ]]; then
  echo "==> nginx + HTTPS 설정 (도메인: ${DOMAIN})"
  apt-get install -y nginx python3-certbot-nginx
  sed "s/__DOMAIN__/${DOMAIN}/g" "$APP_DIR/deploy/nginx.conf.template" > "/etc/nginx/sites-available/ohktx"
  ln -sf /etc/nginx/sites-available/ohktx /etc/nginx/sites-enabled/ohktx
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx

  if [[ -n "$CERT_EMAIL" ]]; then
    certbot --nginx -d "$DOMAIN" -m "$CERT_EMAIL" --agree-tos --non-interactive --redirect
    echo "==> HTTPS 준비 완료: https://${DOMAIN}"
  else
    echo "  인증서 이메일이 없어 certbot은 건너뜁니다. 수동 실행: sudo certbot --nginx -d ${DOMAIN}"
  fi
else
  PUBLIC_IP="$(curl -s ifconfig.me || echo "<VM공인IP>")"
  echo "  도메인이 지정되지 않아 HTTP로만 접속 가능합니다: http://${PUBLIC_IP}:3000"
  echo "  (Oracle Cloud 콘솔의 보안 목록에서 3000번 포트 인그레스도 열어야 합니다)"
fi

echo ""
echo "==> 완료! 서비스 상태 확인: sudo systemctl status ohktx"
echo "==> 로그 확인: sudo journalctl -u ohktx -f"
