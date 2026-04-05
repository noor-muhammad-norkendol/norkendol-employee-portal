/* ── AI Response Types & Validators ──────────────────── */

export interface GeneratedCourse {
  title: string;
  description: string;
  suggested_category: string;
  level: "beginner" | "intermediate" | "advanced";
  quiz_questions: {
    question_text: string;
    options: { label: string; is_correct: boolean }[];
  }[];
}

export function validateGeneratedCourse(data: unknown): data is GeneratedCourse {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.title !== "string" || !d.title) return false;
  if (typeof d.description !== "string") return false;
  if (!["beginner", "intermediate", "advanced"].includes(d.level as string))
    return false;
  if (!Array.isArray(d.quiz_questions)) return false;
  for (const q of d.quiz_questions as Record<string, unknown>[]) {
    if (typeof q.question_text !== "string") return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    const correctCount = (
      q.options as { is_correct: boolean }[]
    ).filter((o) => o.is_correct).length;
    if (correctCount !== 1) return false;
  }
  return true;
}
