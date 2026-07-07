import "dotenv/config";
import path from "path";
import express from "express";
import cookieSession from "cookie-session";
import { authRouter, requireAuth } from "./routes/auth";
import { settingsRouter } from "./routes/settings";
import { watchesRouter } from "./routes/watches";
import { eventsRouter } from "./routes/events";
import { startScheduler } from "./scheduler";

const app = express();

app.use(express.json());
app.use(
  cookieSession({
    name: "ohktx_session",
    secret: process.env.SESSION_SECRET ?? "",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
  })
);

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api", authRouter);
app.use("/api", requireAuth, settingsRouter);
app.use("/api", requireAuth, watchesRouter);
app.use("/api", requireAuth, eventsRouter);

const port = Number(process.env.PORT ?? 3000);

if (!process.env.SESSION_SECRET) {
  console.warn("⚠️  SESSION_SECRET이 설정되지 않았습니다. .env를 확인하세요.");
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.warn("⚠️  ENCRYPTION_KEY가 없거나 길이가 잘못되었습니다. 계정/카드 저장 시 오류가 납니다.");
}

app.listen(port, () => {
  console.log(`OHktx 서버가 http://localhost:${port} 에서 실행 중입니다.`);
  startScheduler();
});
