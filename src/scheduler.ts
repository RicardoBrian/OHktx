import { Watch, listActiveWatches, setWatchStatus, shouldNotifyNow, touchWatchChecked, touchWatchNotified } from "./db";
import { KorailClient } from "./korail/client";
import { SearchCriteria } from "./korail/types";
import { notify } from "./notify";
import { getDecryptedCredentials, getDecryptedPayment } from "./settingsService";

const CAPTCHA_NOTIFY_COOLDOWN_MS = 5 * 60 * 1000; // 같은 watch에 대해 캡차 알림은 5분에 한 번만

function watchToCriteria(w: Watch): SearchCriteria {
  return {
    depStation: w.dep_station,
    arrStation: w.arr_station,
    travelDate: w.travel_date,
    timeFrom: w.time_from,
    timeTo: w.time_to,
    trainType: w.train_type === "all" ? "all" : "ktx",
    passengerCount: w.passenger_count,
    seatType: w.seat_type === "first" || w.seat_type === "general" ? w.seat_type : "any",
  };
}

let running = false;

export async function runPollCycle(): Promise<void> {
  if (running) return; // 이전 사이클이 아직 실행 중이면 겹치지 않게 스킵
  running = true;
  try {
    const watches = listActiveWatches();
    if (watches.length === 0) return;

    const creds = getDecryptedCredentials();
    if (!creds) {
      await notify("warn", "코레일 계정이 설정되지 않아 감시를 건너뜁니다. 설정 화면에서 계정을 등록하세요.");
      return;
    }

    for (const watch of watches) {
      await processWatch(watch, creds);
    }
  } finally {
    running = false;
  }
}

async function processWatch(watch: Watch, creds: { id: string; password: string }): Promise<void> {
  const headless = process.env.BROWSER_HEADLESS !== "false";
  const client = new KorailClient(headless);
  try {
    await client.init();
    await client.login(creds);

    const criteria = watchToCriteria(watch);
    const trains = await client.searchTrains(criteria);
    touchWatchChecked(watch.id);

    if (trains.length === 0) return;

    const payment = watch.auto_pay ? getDecryptedPayment() : null;
    const outcome = await client.reserveAndMaybePay(trains[0], {
      autoPay: !!watch.auto_pay,
      payment,
    });

    switch (outcome.kind) {
      case "no_seat":
        break;
      case "captcha_blocked":
        if (shouldNotifyNow(watch, CAPTCHA_NOTIFY_COOLDOWN_MS)) {
          await notify(
            "warn",
            `[${watch.dep_station}→${watch.arr_station} ${watch.travel_date}] 좌석 발견했지만 캡차가 떠서 자동 진행을 멈췄습니다. 직접 접속해서 예약하세요! (열차 ${outcome.trainNo})`,
            watch.id
          );
          touchWatchNotified(watch.id);
        }
        break;
      case "reserved_only":
        await notify(
          "success",
          `[${watch.dep_station}→${watch.arr_station} ${watch.travel_date}] 좌석 예약(결제 전) 완료. 코레일 앱/사이트에서 결제를 마무리하세요. (열차 ${outcome.trainNo})`,
          watch.id
        );
        touchWatchNotified(watch.id);
        setWatchStatus(watch.id, "completed");
        break;
      case "paid":
        await notify(
          "success",
          `[${watch.dep_station}→${watch.arr_station} ${watch.travel_date}] 예약 및 결제까지 완료했습니다! (열차 ${outcome.trainNo})`,
          watch.id
        );
        touchWatchNotified(watch.id);
        setWatchStatus(watch.id, "completed");
        break;
      case "error":
        await notify("error", `[watch #${watch.id}] 처리 중 오류: ${outcome.message}`, watch.id);
        break;
    }
  } catch (err) {
    await notify("error", `[watch #${watch.id}] 감시 중 예외 발생: ${err instanceof Error ? err.message : String(err)}`, watch.id);
  } finally {
    await client.close();
  }
}

export function startScheduler(): void {
  const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 15000);
  setInterval(() => {
    runPollCycle().catch((err) => console.error("폴링 사이클 오류:", err));
  }, intervalMs);
  console.log(`스케줄러 시작: ${intervalMs}ms 간격으로 watch를 확인합니다.`);
}
