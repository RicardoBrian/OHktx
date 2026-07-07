/**
 * ⚠️ 검증 필요 (UNVERIFIED)
 *
 * 이 세션의 샌드박스는 코레일(korail.com) 접속이 네트워크 정책으로 차단되어 있어
 * 실제 페이지 DOM을 열어보고 셀렉터를 확인하지 못한 상태로 작성했습니다.
 * 아래 값들은 공개적으로 알려진 코레일 예매 사이트 구조를 바탕으로 한 최선의 추정치이며,
 * 코레일이 마크업을 바꾸면 즉시 깨질 수 있습니다.
 *
 * 로컬(네트워크가 열린 환경)에서 최초 실행 시 BROWSER_HEADLESS=false 로 띄워서
 * 브라우저 개발자도구로 실제 셀렉터를 확인하고 이 파일만 고치면 됩니다.
 * client.ts의 로직은 건드릴 필요 없습니다.
 */
export const urls = {
  main: "https://www.korail.com/ticket/main",
  login: "https://www.korail.com/login/loginForm",
};

export const login = {
  idInput: "#txtMember01, input[name='txtInputFlag'], input#loginId",
  pwInput: "#txtPwd, input[type='password']",
  submitBtn: "button.login, button[type='submit'].btn_login",
  loggedInIndicator: ".login_area .btn_logout, a[href*='logout']",
};

export const search = {
  depStationInput: "#dep_station_name, input[name='dptRsStnCdNm']",
  arrStationInput: "#arr_station_name, input[name='arvRsStnCdNm']",
  dateSelect: "#dptDt, select[name='dptDt']",
  timeSelect: "#dptTm, select[name='dptTm']",
  passengerAdultSelect: "select[name='psgInfoPerPrnb1']",
  submitBtn: "input.btn_ticket_search, button.btn-search",
};

export const results = {
  rows: "table.tbl_ticketResult tbody tr, table.result-table tbody tr",
  trainNoCell: "td.train_no, td:nth-child(2)",
  depTimeCell: "td.dep_time, td:nth-child(4)",
  arrTimeCell: "td.arr_time, td:nth-child(5)",
  generalSeatCell: "td.seat_general, td:nth-child(6)",
  reserveBtnInRow: "button.btn_reserve, a.btn-reservation, button:has-text('예약하기')",
  soldOutText: "매진",
  waitlistBtnInRow: "button:has-text('예약대기'), a:has-text('예약대기')",
};

export const captcha = {
  // 캡차/보안문자가 뜨었는지 판단하는 일반적인 신호들. 페이지 텍스트/DOM에
  // 아래 키워드 중 하나라도 보이면 캡차로 간주하고 자동화를 중단한다.
  keywords: ["보안문자", "자동입력 방지", "캡차", "captcha", "자동입력방지"],
  imageSelector: "img[alt*='보안문자'], img[src*='captcha']",
  inputSelector: "input[name*='captcha'], input[id*='captcha']",
};

export const payment = {
  cardOptionRadio: "input[value='card'], label:has-text('신용카드')",
  cardNumberInputs: "input[name^='cardNo']",
  expiryInput: "input[name='cardValidTerm']",
  birthOrBizInput: "input[name='cardPwd2'], input[name='ynPwd']",
  cardPasswordInput: "input[name='cardPwd']",
  payConfirmBtn: "button:has-text('결제하기'), button.btn_pay_confirm",
  paySuccessIndicator: "text=결제가 완료되었습니다",
};
