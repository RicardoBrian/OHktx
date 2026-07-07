import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as sel from "./selectors";
import { AttemptOutcome, AvailableTrain, KorailCredentials, PaymentInfo, SearchCriteria } from "./types";

export class KorailClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(private headless: boolean) {}

  async init(): Promise<void> {
    // 이 프로젝트가 설치한 playwright 버전과 실행 환경에 미리 설치된 크로미움 리비전이 다를 수 있어
    // PLAYWRIGHT_CHROMIUM_PATH가 있으면 그 경로를 우선 사용한다 (없으면 playwright가 알아서 찾음).
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
    // 일부 VM/컨테이너 환경(특히 root로 실행 시)은 크로미움 샌드박스가 거부됨.
    // 그런 경우에만 CHROMIUM_NO_SANDBOX=true로 우회한다 (일반 사용자로 실행하면 불필요).
    const noSandbox = process.env.CHROMIUM_NO_SANDBOX === "true";
    this.browser = await chromium.launch({
      headless: this.headless,
      executablePath,
      args: noSandbox ? ["--no-sandbox"] : [],
    });
    this.context = await this.browser.newContext({ locale: "ko-KR" });
    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  private get p(): Page {
    if (!this.page) throw new Error("KorailClient.init()을 먼저 호출해야 합니다.");
    return this.page;
  }

  /** 페이지에 캡차/보안문자 입력이 떴는지 휴리스틱하게 판단한다. */
  async hasCaptcha(): Promise<boolean> {
    const page = this.p;
    const imgVisible = await page
      .locator(sel.captcha.imageSelector)
      .first()
      .isVisible()
      .catch(() => false);
    const inputVisible = await page
      .locator(sel.captcha.inputSelector)
      .first()
      .isVisible()
      .catch(() => false);
    if (imgVisible || inputVisible) return true;

    const bodyText = await page.textContent("body").catch(() => "");
    if (!bodyText) return false;
    return sel.captcha.keywords.some((kw) => bodyText.includes(kw));
  }

  async login(creds: KorailCredentials): Promise<void> {
    const page = this.p;
    await page.goto(sel.urls.login, { waitUntil: "domcontentloaded" });

    if (await this.hasCaptcha()) {
      throw new CaptchaBlockedError("로그인 단계에서 캡차가 감지되어 자동화를 중단합니다.");
    }

    await page.fill(sel.login.idInput, creds.id);
    await page.fill(sel.login.pwInput, creds.password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.click(sel.login.submitBtn),
    ]);

    const loggedIn = await page
      .locator(sel.login.loggedInIndicator)
      .first()
      .isVisible()
      .catch(() => false);
    if (!loggedIn) {
      throw new Error("로그인 실패: 아이디/비밀번호를 확인하거나 selectors.ts의 login 셀렉터를 점검하세요.");
    }
  }

  async searchTrains(criteria: SearchCriteria): Promise<AvailableTrain[]> {
    const page = this.p;
    await page.goto(sel.urls.main, { waitUntil: "domcontentloaded" });

    await page.fill(sel.search.depStationInput, criteria.depStation);
    await page.fill(sel.search.arrStationInput, criteria.arrStation);
    // 날짜/시간 select는 실제 옵션 value 포맷 확인 후 selectOption 인자를 맞춰야 함
    await page.selectOption(sel.search.dateSelect, criteria.travelDate).catch(() => {});
    await page.selectOption(sel.search.timeSelect, criteria.timeFrom).catch(() => {});
    await page.selectOption(sel.search.passengerAdultSelect, String(criteria.passengerCount)).catch(() => {});

    await Promise.all([page.waitForLoadState("domcontentloaded"), page.click(sel.search.submitBtn)]);

    const rows = page.locator(sel.results.rows);
    const count = await rows.count();
    const available: AvailableTrain[] = [];

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const rowText = (await row.textContent()) ?? "";
      if (rowText.includes(sel.results.soldOutText)) continue;

      const depTime = ((await row.locator(sel.results.depTimeCell).textContent()) ?? "").trim();
      const arrTime = ((await row.locator(sel.results.arrTimeCell).textContent()) ?? "").trim();
      const trainNo = ((await row.locator(sel.results.trainNoCell).textContent()) ?? "").trim();

      if (depTime && depTime < criteria.timeFrom.slice(0, 4)) continue;
      if (depTime && depTime > criteria.timeTo.slice(0, 4)) continue;

      const hasReserveBtn = await row
        .locator(sel.results.reserveBtnInRow)
        .first()
        .isVisible()
        .catch(() => false);
      if (!hasReserveBtn) continue;

      available.push({ trainNo, depTime, arrTime, rowIndex: i });
    }

    return available;
  }

  /**
   * 좌석을 찾으면 예약을 시도하고, autoPay가 true이면서 캡차가 없으면 결제까지 진행한다.
   * 캡차가 감지되면 그 시점에서 즉시 멈추고 captcha_blocked를 반환한다(좌석 확정/결제 시도 안 함).
   */
  async reserveAndMaybePay(
    train: AvailableTrain,
    opts: { autoPay: boolean; payment: PaymentInfo | null }
  ): Promise<AttemptOutcome> {
    const page = this.p;
    try {
      const row = page.locator(sel.results.rows).nth(train.rowIndex);
      await Promise.all([
        page.waitForLoadState("domcontentloaded"),
        row.locator(sel.results.reserveBtnInRow).first().click(),
      ]);

      if (await this.hasCaptcha()) {
        return { kind: "captcha_blocked", trainNo: train.trainNo };
      }

      if (!opts.autoPay || !opts.payment) {
        return { kind: "reserved_only", trainNo: train.trainNo, reason: "auto_pay 비활성화" };
      }

      return await this.pay(opts.payment, train.trainNo);
    } catch (err) {
      return { kind: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async pay(payment: PaymentInfo, trainNo: string): Promise<AttemptOutcome> {
    const page = this.p;

    await page.click(sel.payment.cardOptionRadio).catch(() => {});

    if (await this.hasCaptcha()) {
      return { kind: "captcha_blocked", trainNo };
    }

    const cardInputs = page.locator(sel.payment.cardNumberInputs);
    const cardParts = payment.cardNumber.match(/.{1,4}/g) ?? [payment.cardNumber];
    const cardInputCount = await cardInputs.count();
    for (let i = 0; i < Math.min(cardInputCount, cardParts.length); i++) {
      await cardInputs.nth(i).fill(cardParts[i]);
    }

    await page.fill(sel.payment.expiryInput, payment.expiry);
    await page.fill(sel.payment.birthOrBizInput, payment.birthOrBizNo);
    await page.fill(sel.payment.cardPasswordInput, payment.cardPassword);

    if (await this.hasCaptcha()) {
      return { kind: "captcha_blocked", trainNo };
    }

    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.click(sel.payment.payConfirmBtn),
    ]);

    const success = await page
      .locator(sel.payment.paySuccessIndicator)
      .first()
      .isVisible()
      .catch(() => false);

    if (!success) {
      return { kind: "error", message: "결제 완료 문구를 확인하지 못했습니다. 수동 확인이 필요합니다." };
    }
    return { kind: "paid", trainNo };
  }
}

export class CaptchaBlockedError extends Error {}
