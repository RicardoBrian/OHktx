import { Router } from "express";
import { db } from "../db";

export const eventsRouter = Router();

eventsRouter.get("/events", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = db.prepare(`SELECT * FROM events ORDER BY created_at DESC LIMIT ?`).all(limit);
  res.json(rows);
});
