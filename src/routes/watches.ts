import { Router } from "express";
import { db } from "../db";

export const watchesRouter = Router();

watchesRouter.get("/watches", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM watches ORDER BY created_at DESC`).all();
  res.json(rows);
});

watchesRouter.post("/watches", (req, res) => {
  const {
    depStation,
    arrStation,
    travelDate,
    timeFrom,
    timeTo,
    trainType,
    seatType,
    passengerCount,
    autoPay,
  } = req.body ?? {};

  if (!depStation || !arrStation || !travelDate) {
    return res.status(400).json({ ok: false, error: "출발역/도착역/날짜는 필수입니다." });
  }

  const info = db
    .prepare(
      `INSERT INTO watches (dep_station, arr_station, travel_date, time_from, time_to, train_type, seat_type, passenger_count, auto_pay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      depStation,
      arrStation,
      travelDate,
      timeFrom || "000000",
      timeTo || "235959",
      trainType || "ktx",
      seatType || "any",
      Number(passengerCount) || 1,
      autoPay ? 1 : 0
    );

  res.json({ ok: true, id: info.lastInsertRowid });
});

watchesRouter.patch("/watches/:id", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!["active", "paused", "completed"].includes(status)) {
    return res.status(400).json({ ok: false, error: "status는 active/paused/completed 중 하나여야 합니다." });
  }
  db.prepare(`UPDATE watches SET status = ? WHERE id = ?`).run(status, id);
  res.json({ ok: true });
});

watchesRouter.delete("/watches/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM watches WHERE id = ?`).run(id);
  res.json({ ok: true });
});
