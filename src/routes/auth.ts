import { Router } from "express";
import { timingSafeEqualStr } from "../crypto";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { password } = req.body ?? {};
  const appPassword = process.env.APP_PASSWORD ?? "";
  if (typeof password === "string" && appPassword && timingSafeEqualStr(password, appPassword)) {
    req.session!.authed = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "비밀번호가 올바르지 않습니다." });
});

authRouter.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

authRouter.get("/session", (req, res) => {
  res.json({ authed: !!req.session?.authed });
});

export function requireAuth(req: any, res: any, next: any) {
  if (req.session?.authed) return next();
  return res.status(401).json({ ok: false, error: "로그인이 필요합니다." });
}
