import { FRUITS, QUESTIONS, type FruitId } from "./content";
import type { Mode } from "../core/Simulation";
export interface Score {
  name: string;
  score: number;
  mode: Mode | "legacy";
  date: string;
}
interface Save {
  version: 2;
  scores: Score[];
  unlocked: FruitId[];
  mistakes: string[];
  muted: boolean;
  reducedMotion: boolean;
  player: string;
}
export function validName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 3 && name.length <= 24 ? name : null;
}
const initial = (): Save => ({
  version: 2,
  scores: [],
  unlocked: [],
  mistakes: [],
  muted: false,
  reducedMotion: false,
  player: "",
});
export class Store {
  data: Save = initial();
  available = true;
  constructor(private storage: Pick<Storage, "getItem" | "setItem"> | null) {
    try {
      const raw = storage?.getItem("chaua-educa-v2");
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.version !== 2) throw new Error("Unsupported save");
        this.data.scores = Array.isArray(d.scores)
          ? d.scores.filter(
              (s: Score) =>
                s &&
                typeof s.name === "string" &&
                (s.mode === "legacy"
                  ? s.name.trim().length > 0
                  : validName(s.name)) &&
                Number.isFinite(s.score) &&
                s.score >= 0 &&
                (s.mode === "legacy" ||
                  (Number.isInteger(s.score) && s.score <= 205)) &&
                ["learn", "challenge", "legacy"].includes(s.mode) &&
                typeof s.date === "string",
            )
          : [];
        this.data.unlocked = Array.isArray(d.unlocked)
          ? [
              ...new Set<FruitId>(
                d.unlocked.filter((id: FruitId) =>
                  FRUITS.some((f) => f.id === id),
                ),
              ),
            ]
          : [];
        this.data.mistakes = Array.isArray(d.mistakes)
          ? [
              ...new Set<string>(
                d.mistakes.filter((id: string) =>
                  QUESTIONS.some((q) => q.id === id),
                ),
              ),
            ]
          : [];
        this.data.muted = d.muted === true;
        this.data.reducedMotion = d.reducedMotion === true;
        this.data.player =
          typeof d.player === "string" ? (validName(d.player) ?? "") : "";
      } else {
        const legacy = JSON.parse(storage?.getItem("db-chaua") ?? "[]");
        if (Array.isArray(legacy))
          this.data.scores = legacy
            .filter(
              (s) =>
                s &&
                typeof s.playerName === "string" &&
                s.playerName.trim().length > 0 &&
                Number.isFinite(s.score_val) &&
                s.score_val >= 0,
            )
            .map((s) => ({
              name: s.playerName.trim(),
              score: s.score_val,
              mode: "legacy",
              date: "",
            }));
      }
    } catch {
      this.available = false;
    }
    if (!storage) this.available = false;
  }
  save() {
    try {
      if (!this.storage) throw new Error();
      this.storage.setItem("chaua-educa-v2", JSON.stringify(this.data));
    } catch {
      this.available = false;
    }
  }
  score(name: string, score: number, mode: Mode) {
    const existing = this.data.scores.find(
      (s) =>
        s.name.toLocaleUpperCase("pt-BR") === name.toLocaleUpperCase("pt-BR") &&
        s.mode === mode,
    );
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.date = new Date().toISOString();
      }
    } else
      this.data.scores.push({
        name,
        score,
        mode,
        date: new Date().toISOString(),
      });
    this.data.scores.sort((a, b) => b.score - a.score);
    this.save();
  }
  unlock(kind: FruitId) {
    if (!this.data.unlocked.includes(kind)) {
      this.data.unlocked.push(kind);
      this.save();
    }
  }
  answer(id: string, correct: boolean) {
    this.data.mistakes = this.data.mistakes.filter((q) => q !== id);
    if (!correct) this.data.mistakes.push(id);
    this.save();
  }
}
