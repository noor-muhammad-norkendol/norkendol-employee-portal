"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

/* ── types ─────────────────────────────────────────────── */

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  level: "beginner" | "intermediate" | "advanced";
  passing_score: number;
  thumbnail_url: string | null;
  instructor_name: string | null;
  is_published: boolean;
}

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lesson_type: "video" | "document" | "quiz";
  video_url: string | null;
  file_url: string | null;
  file_name: string | null;
  duration_seconds: number | null;
}

interface QuizQuestion {
  id: string;
  lesson_id: string;
  question_text: string;
  sort_order: number;
  options: { label: string; is_correct: boolean }[];
}

interface Assignment {
  id: string;
  course_id: string;
  status: "assigned" | "in_progress" | "completed" | "failed";
  due_date: string | null;
  assigned_by_name: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Progress {
  id: string;
  course_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percentage: number;
  completed_lessons: string[];
  quiz_scores: Record<string, { score: number; passed: boolean; attempts: number }>;
  started_at: string | null;
  completed_at: string | null;
}

/* ── constants ─────────────────────────────────────────── */

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "#1a3a2a", text: "#4ade80" },
  intermediate: { bg: "#3a3520", text: "#facc15" },
  advanced: { bg: "#3a1a1a", text: "#f87171" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  assigned: { bg: "#3a3520", text: "#facc15" },
  in_progress: { bg: "#1e3a5f", text: "#60a5fa" },
  completed: { bg: "#1a3a2a", text: "#4ade80" },
  failed: { bg: "#4a1a1a", text: "#ef4444" },
  not_started: { bg: "#2a2a2a", text: "#888888" },
};

const LESSON_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  video: { bg: "#1e3a5f", text: "#60a5fa" },
  document: { bg: "#2d1b4e", text: "#a78bfa" },
  quiz: { bg: "#3a3520", text: "#facc15" },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: colors.bg, color: colors.text }}>
      {label.replace("_", " ")}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

/* ── Standard letter grading scale ───────────────────── */

function getLetterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "#4ade80", A: "#4ade80", "A-": "#4ade80",
  "B+": "#60a5fa", B: "#60a5fa", "B-": "#60a5fa",
  "C+": "#facc15", C: "#facc15", "C-": "#facc15",
  "D+": "#fb923c", D: "#fb923c", "D-": "#fb923c",
  F: "#ef4444",
};

/* ── YouTube embed helper ──────────────────────────────── */

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

/* ── main page ─────────────────────────────────────────── */

export default function UniversityPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Course viewer
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);
  const [courseQuestions, setCourseQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [courseProgress, setCourseProgress] = useState<Progress | null>(null);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; passed: boolean; grade: string } | null>(null);

  // Certificates
  const [certificates, setCertificates] = useState<Record<string, { certificate_number: string; issued_at: string; final_score: number | null; final_grade: string | null }>>({});

  /* ── data loading ────────────────────────────────────── */

  const fetchAll = useCallback(async (uid: string) => {
    setLoading(true);
    const [catRes, courseRes, assignRes, progRes] = await Promise.all([
      supabase.from("training_categories").select("id, name, is_active").eq("org_id", ORG_ID).eq("is_active", true).order("sort_order"),
      supabase.from("training_courses").select("*").eq("org_id", ORG_ID).eq("is_published", true).order("title"),
      supabase.from("training_assignments").select("*").eq("org_id", ORG_ID).eq("assigned_to", uid).order("created_at", { ascending: false }),
      supabase.from("training_progress").select("*").eq("org_id", ORG_ID).eq("user_id", uid),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (courseRes.data) setCourses(courseRes.data as Course[]);
    if (assignRes.data) setAssignments(assignRes.data as Assignment[]);
    if (progRes.data) {
      const map: Record<string, Progress> = {};
      for (const p of progRes.data as Progress[]) map[p.course_id] = p;
      setProgressMap(map);
    }
    setLoading(false);
  }, []);

  const fetchCertificates = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/training/certificate", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const { certificates: certs } = await res.json();
      const map: Record<string, { certificate_number: string; issued_at: string; final_score: number | null; final_grade: string | null }> = {};
      for (const c of certs) map[c.course_id] = c;
      setCertificates(map);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchAll(user.id);
        fetchCertificates();
      }
    });
  }, [fetchAll, fetchCertificates]);

  /* ── course viewer ───────────────────────────────────── */

  const openCourseViewer = async (course: Course) => {
    setViewingCourse(course);
    setCurrentLessonIdx(0);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);

    // Load lessons
    const { data: lessonData } = await supabase.from("training_lessons").select("*").eq("course_id", course.id).order("sort_order");
    const lessonList = (lessonData ?? []) as Lesson[];
    setCourseLessons(lessonList);

    // Load quiz questions
    const quizLessons = lessonList.filter((l) => l.lesson_type === "quiz");
    const qMap: Record<string, QuizQuestion[]> = {};
    for (const ql of quizLessons) {
      const { data: qData } = await supabase.from("training_quiz_questions").select("*").eq("lesson_id", ql.id).order("sort_order");
      qMap[ql.id] = (qData ?? []) as QuizQuestion[];
    }
    setCourseQuestions(qMap);

    // Load or create progress
    const existing = progressMap[course.id];
    if (existing) {
      setCourseProgress(existing);
    } else {
      // Create progress record (self-enroll)
      const { data: newProg } = await supabase.from("training_progress").insert({
        org_id: ORG_ID, user_id: userId, course_id: course.id, status: "not_started", progress_percentage: 0, completed_lessons: [], quiz_scores: {},
      }).select().single();
      if (newProg) {
        const p = newProg as Progress;
        setCourseProgress(p);
        setProgressMap((prev) => ({ ...prev, [course.id]: p }));
      }
    }
  };

  const closeCourseViewer = () => {
    setViewingCourse(null);
    setCourseLessons([]);
    setCourseQuestions({});
    setCourseProgress(null);
    // Refresh data
    if (userId) fetchAll(userId);
  };

  const currentLesson = courseLessons[currentLessonIdx] ?? null;
  const isLessonCompleted = (lessonId: string) => (courseProgress?.completed_lessons ?? []).includes(lessonId);

  const markLessonComplete = async (lessonId: string) => {
    if (!courseProgress || !viewingCourse) return;
    const completed = [...(courseProgress.completed_lessons ?? [])];
    if (!completed.includes(lessonId)) completed.push(lessonId);
    const totalLessons = courseLessons.length;
    const pct = totalLessons > 0 ? Math.round((completed.length / totalLessons) * 100) : 0;
    const allDone = completed.length === totalLessons;

    // Check all quizzes passed
    const quizLessons = courseLessons.filter((l) => l.lesson_type === "quiz");
    const allQuizzesPassed = quizLessons.every((ql) => courseProgress.quiz_scores[ql.id]?.passed);
    const courseComplete = allDone && allQuizzesPassed;

    const status = courseComplete ? "completed" : "in_progress";
    const update: Record<string, unknown> = {
      completed_lessons: completed,
      progress_percentage: pct,
      status,
    };
    if (status === "in_progress" && !courseProgress.started_at) update.started_at = new Date().toISOString();
    if (courseComplete) update.completed_at = new Date().toISOString();

    await supabase.from("training_progress").update(update).eq("id", courseProgress.id);

    // Update assignment if exists
    if (courseComplete) {
      await supabase.from("training_assignments").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("course_id", viewingCourse.id).eq("assigned_to", userId);
      // Auto-complete action item
      await supabase.from("action_items").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("item_type", "training").eq("assigned_to", userId).like("title", `%${viewingCourse.title}%`);

      // Issue certificate
      const quizLessons = courseLessons.filter((l) => l.lesson_type === "quiz");
      const allScores = quizLessons.map((ql) => courseProgress.quiz_scores[ql.id]?.score ?? 0);
      const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 100;
      const avgGrade = getLetterGrade(avgScore);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        fetch("/api/training/certificate", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: viewingCourse.id, final_score: avgScore, final_grade: avgGrade }),
        }).then((res) => res.json()).then((data) => {
          if (data.certificate) {
            setCertificates((prev) => ({ ...prev, [viewingCourse.id]: data.certificate }));
          }
        }).catch(() => {});
      });
    } else {
      await supabase.from("training_assignments").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("course_id", viewingCourse.id).eq("assigned_to", userId).neq("status", "completed");
    }

    setCourseProgress((prev) => prev ? { ...prev, completed_lessons: completed, progress_percentage: pct, status } : prev);

    // Auto-advance to next lesson
    if (currentLessonIdx < courseLessons.length - 1) {
      setCurrentLessonIdx(currentLessonIdx + 1);
      setQuizAnswers({});
      setQuizSubmitted(false);
      setQuizScore(null);
    }
  };

  /* ── quiz submission ─────────────────────────────────── */

  const submitQuiz = async () => {
    if (!currentLesson || !courseProgress || !viewingCourse) return;
    const questions = courseQuestions[currentLesson.id] ?? [];
    if (questions.length === 0) return;

    let correct = 0;
    for (const q of questions) {
      const selected = quizAnswers[q.id];
      const correctOpt = q.options.find((o) => o.is_correct);
      if (selected && correctOpt && selected === correctOpt.label) correct++;
    }

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= viewingCourse.passing_score;
    const attempts = (courseProgress.quiz_scores[currentLesson.id]?.attempts ?? 0) + 1;
    const grade = getLetterGrade(score);

    const newScores = { ...courseProgress.quiz_scores, [currentLesson.id]: { score, passed, attempts, grade } };
    await supabase.from("training_progress").update({ quiz_scores: newScores }).eq("id", courseProgress.id);
    setCourseProgress((prev) => prev ? { ...prev, quiz_scores: newScores } : prev);

    setQuizScore({ score, passed, grade });
    setQuizSubmitted(true);

    // If passed, mark lesson complete
    if (passed) {
      await markLessonComplete(currentLesson.id);
    }
  };

  const retryQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    // Shuffle question order and option order on retry
    if (currentLesson) {
      const questions = courseQuestions[currentLesson.id];
      if (questions) {
        const shuffled = [...questions]
          .sort(() => Math.random() - 0.5)
          .map((q) => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) }));
        setCourseQuestions((prev) => ({ ...prev, [currentLesson.id]: shuffled }));
      }
    }
  };

  /* ── derived data ────────────────────────────────────── */

  const myAssignedCourseIds = assignments.map((a) => a.course_id);
  const activeAssignments = assignments.filter((a) => a.status !== "completed");
  const completedAssignments = assignments.filter((a) => a.status === "completed");

  const browseCourses = courses.filter((c) => {
    if (selectedCategory !== "all" && c.category_id !== selectedCategory) return false;
    return true;
  });

  const getCatName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "General";

  /* ── course viewer UI ────────────────────────────────── */

  if (viewingCourse) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={closeCourseViewer} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{viewingCourse.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge label={viewingCourse.level} colors={LEVEL_COLORS[viewingCourse.level]} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{getCatName(viewingCourse.category_id)}</span>
              {viewingCourse.instructor_name && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>by {viewingCourse.instructor_name}</span>}
            </div>
          </div>
          {courseProgress && (
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: courseProgress.status === "completed" ? "#4ade80" : "var(--accent)" }}>{courseProgress.progress_percentage}%</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{courseProgress.completed_lessons.length}/{courseLessons.length} lessons</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full mb-6" style={{ background: "var(--bg-hover)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${courseProgress?.progress_percentage ?? 0}%`, background: courseProgress?.status === "completed" ? "#4ade80" : "var(--accent)" }} />
        </div>

        {courseLessons.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <p style={{ color: "var(--text-secondary)" }}>This course has no lessons yet.</p>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Content area */}
            <div className="flex-1 min-w-0">
              {currentLesson && (
                <div className="rounded-xl p-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge label={currentLesson.lesson_type} colors={LESSON_TYPE_COLORS[currentLesson.lesson_type]} />
                    <h2 className="text-lg font-semibold">{currentLesson.title}</h2>
                    {isLessonCompleted(currentLesson.id) && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#1a3a2a", color: "#4ade80" }}>Completed</span>
                    )}
                  </div>
                  {currentLesson.description && <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{currentLesson.description}</p>}

                  {/* Video content */}
                  {currentLesson.lesson_type === "video" && currentLesson.video_url && (
                    <div className="mb-4">
                      {getYouTubeId(currentLesson.video_url) ? (
                        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                          <iframe
                            className="absolute inset-0 w-full h-full rounded-lg"
                            src={`https://www.youtube.com/embed/${getYouTubeId(currentLesson.video_url)}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <video controls className="w-full rounded-lg" src={currentLesson.video_url} />
                      )}
                    </div>
                  )}

                  {/* Document content */}
                  {currentLesson.lesson_type === "document" && (
                    <div className="rounded-lg p-6 text-center mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                      <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                      <p className="text-sm font-medium mb-2">{currentLesson.file_name ?? "Document"}</p>
                      {currentLesson.file_url && (
                        <a href={currentLesson.file_url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: "var(--accent)", color: "#000" }}>
                          Open Document
                        </a>
                      )}
                    </div>
                  )}

                  {/* Quiz content */}
                  {currentLesson.lesson_type === "quiz" && (
                    <div>
                      {quizSubmitted && quizScore ? (
                        <div className="rounded-lg p-6 text-center mb-4" style={{ background: quizScore.passed ? "#0a2a1a" : "#2a1010", border: `1px solid ${quizScore.passed ? "#1a5a3a" : "#5a1a1a"}` }}>
                          <p className="text-5xl font-bold mb-1" style={{ color: GRADE_COLORS[quizScore.grade] || "#888" }}>{quizScore.grade}</p>
                          <p className="text-xl font-bold mb-2" style={{ color: quizScore.passed ? "#4ade80" : "#ef4444" }}>{quizScore.score}%</p>
                          <p className="text-sm font-medium mb-1" style={{ color: quizScore.passed ? "#4ade80" : "#ef4444" }}>
                            {quizScore.passed ? "Passed!" : "Not Passed — You must score {viewingCourse.passing_score}% or higher"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Passing score: {viewingCourse.passing_score}% | Attempt #{courseProgress?.quiz_scores[currentLesson.id]?.attempts ?? 1}</p>
                          {!quizScore.passed && (
                            <button onClick={retryQuiz} className="mt-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: "var(--accent)", color: "#000" }}>
                              Retake Quiz
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(courseQuestions[currentLesson.id] ?? []).map((q, qi) => (
                            <div key={q.id} className="rounded-lg p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                              <p className="text-sm font-medium mb-3">
                                <span style={{ color: "var(--text-muted)" }}>Q{qi + 1}.</span> {q.question_text}
                              </p>
                              <div className="space-y-2">
                                {q.options.map((opt, oi) => (
                                  <label key={oi} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors" style={{ background: quizAnswers[q.id] === opt.label ? "var(--bg-hover)" : "transparent", border: `1px solid ${quizAnswers[q.id] === opt.label ? "var(--accent)" : "var(--border-color)"}` }}>
                                    <input type="radio" name={`q-${q.id}`} checked={quizAnswers[q.id] === opt.label} onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt.label })} className="cursor-pointer" />
                                    <span className="text-sm">{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button onClick={submitQuiz} disabled={(courseQuestions[currentLesson.id] ?? []).some((q) => !quizAnswers[q.id])} className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                            Submit Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mark complete button (for video/document) */}
                  {currentLesson.lesson_type !== "quiz" && !isLessonCompleted(currentLesson.id) && (
                    <button onClick={() => markLessonComplete(currentLesson.id)} className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors mt-4" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                      Mark as Complete
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Lesson playlist sidebar */}
            <div className="w-72 shrink-0">
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <h3 className="text-sm font-semibold">Lessons</h3>
                </div>
                {courseLessons.map((l, idx) => (
                  <button key={l.id} onClick={() => { setCurrentLessonIdx(idx); setQuizAnswers({}); setQuizSubmitted(false); setQuizScore(null); }} className="w-full text-left px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors" style={{ background: idx === currentLessonIdx ? "var(--bg-hover)" : "transparent", borderBottom: "1px solid var(--border-color)" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ background: isLessonCompleted(l.id) ? "#1a3a2a" : "var(--bg-surface)", color: isLessonCompleted(l.id) ? "#4ade80" : "var(--text-muted)", border: `1px solid ${isLessonCompleted(l.id) ? "#4ade80" : "var(--border-color)"}` }}>
                      {isLessonCompleted(l.id) ? "✓" : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{l.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge label={l.lesson_type} colors={LESSON_TYPE_COLORS[l.lesson_type]} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Course complete celebration */}
        {courseProgress?.status === "completed" && (
          <div className="rounded-xl p-8 text-center mt-6" style={{ background: "#0a2a1a", border: "1px solid #1a5a3a" }}>
            <p className="text-3xl mb-2">🎓</p>
            <h3 className="text-lg font-bold mb-1" style={{ color: "#4ade80" }}>Course Complete!</h3>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>You&apos;ve finished all lessons in {viewingCourse.title}.</p>
            {certificates[viewingCourse.id] && (
              <div className="inline-block rounded-lg px-4 py-2 mt-1" style={{ background: "rgba(74, 222, 128, 0.1)", border: "1px solid rgba(74, 222, 128, 0.3)" }}>
                <p className="text-xs font-medium" style={{ color: "#4ade80" }}>Certificate Issued</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  #{certificates[viewingCourse.id].certificate_number}
                  {certificates[viewingCourse.id].final_grade && (
                    <span className="ml-2" style={{ color: GRADE_COLORS[certificates[viewingCourse.id].final_grade!] ?? "var(--text-secondary)" }}>
                      Grade: {certificates[viewingCourse.id].final_grade} ({certificates[viewingCourse.id].final_score}%)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── main university view ────────────────────────────── */

  if (loading) return <p style={{ color: "var(--text-secondary)" }}>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">University</h1>

      {/* ── My Assignments ─────────────────────────────── */}
      {activeAssignments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>MY ASSIGNMENTS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAssignments.map((a) => {
              const course = courses.find((c) => c.id === a.course_id);
              if (!course) return null;
              const progress = progressMap[a.course_id];
              return (
                <div key={a.id} onClick={() => openCourseViewer(course)} className="rounded-xl overflow-hidden cursor-pointer transition-all hover:translate-y-[-2px]" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  {/* Cover image */}
                  {course.thumbnail_url ? (
                    <div className="relative w-full h-44">
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-contain" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge label={a.status} colors={STATUS_COLORS[a.status]} />
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-44 flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-hover) 100%)" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" opacity="0.3"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge label={a.status} colors={STATUS_COLORS[a.status]} />
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge label={course.level} colors={LEVEL_COLORS[course.level]} />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{course.title}</h3>
                    <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>{getCatName(course.category_id)}</p>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full mb-2" style={{ background: "var(--bg-hover)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress?.progress_percentage ?? 0}%`, background: "var(--accent)" }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span>{progress?.progress_percentage ?? 0}% complete</span>
                      {a.due_date && (
                        <span style={{ color: new Date(a.due_date) < new Date() ? "#ef4444" : "var(--text-muted)" }}>
                          Due {formatDate(a.due_date)}{new Date(a.due_date) < new Date() && " (Overdue)"}
                        </span>
                      )}
                    </div>
                    {a.assigned_by_name && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Assigned by {a.assigned_by_name}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Browse Courses ─────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>BROWSE COURSES</h2>

        {/* Category filter */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          <button onClick={() => setSelectedCategory("all")} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: selectedCategory === "all" ? "var(--bg-hover)" : "transparent", color: selectedCategory === "all" ? "var(--text-primary)" : "var(--text-muted)" }}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: selectedCategory === cat.id ? "var(--bg-hover)" : "transparent", color: selectedCategory === cat.id ? "var(--text-primary)" : "var(--text-muted)" }}>
              {cat.name}
            </button>
          ))}
        </div>

        {browseCourses.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <p style={{ color: "var(--text-secondary)" }}>No courses available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {browseCourses.map((c) => {
              const progress = progressMap[c.id];
              const isAssigned = myAssignedCourseIds.includes(c.id);
              return (
                <div key={c.id} onClick={() => openCourseViewer(c)} className="rounded-xl overflow-hidden cursor-pointer transition-all hover:translate-y-[-2px]" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  {/* Cover image */}
                  {c.thumbnail_url ? (
                    <div className="relative w-full h-52">
                      <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-contain" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        {isAssigned && <span className="text-[11px] px-2 py-0.5 rounded-full backdrop-blur-sm" style={{ background: "rgba(58, 53, 32, 0.9)", color: "#facc15" }}>Assigned</span>}
                        {progress?.status === "completed" && <span className="text-[11px] px-2 py-0.5 rounded-full backdrop-blur-sm" style={{ background: "rgba(26, 58, 42, 0.9)", color: "#4ade80" }}>Completed</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-40 flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-hover) 100%)" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" opacity="0.3"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                      <div className="absolute top-2 right-2 flex gap-1">
                        {isAssigned && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#3a3520", color: "#facc15" }}>Assigned</span>}
                        {progress?.status === "completed" && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#1a3a2a", color: "#4ade80" }}>Completed</span>}
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge label={c.level} colors={LEVEL_COLORS[c.level]} />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{c.title}</h3>
                    {c.description && <p className="text-[11px] mb-2 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{c.description}</p>}
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span>{getCatName(c.category_id)}</span>
                      {c.instructor_name && <span>{c.instructor_name}</span>}
                    </div>
                    {progress && progress.progress_percentage > 0 && progress.status !== "completed" && (
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full" style={{ background: "var(--bg-hover)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress.progress_percentage}%`, background: "var(--accent)" }} />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{progress.progress_percentage}% complete</p>
                      </div>
                    )}
                    {certificates[c.id] && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px]" style={{ color: "#4ade80" }}>
                        <span>🎓</span>
                        <span>Certified</span>
                        {certificates[c.id].final_grade && <span style={{ color: GRADE_COLORS[certificates[c.id].final_grade!] ?? "#4ade80" }}>({certificates[c.id].final_grade})</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Completed ──────────────────────────────────── */}
      {completedAssignments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>COMPLETED</h2>
          <div className="space-y-2">
            {completedAssignments.map((a) => {
              const course = courses.find((c) => c.id === a.course_id);
              if (!course) return null;
              return (
                <div key={a.id} onClick={() => openCourseViewer(course)} className="rounded-xl p-3 flex items-center gap-4 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", opacity: 0.7 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1a3a2a" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">{course.title}</h3>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{getCatName(course.category_id)}</span>
                  </div>
                  {a.completed_at && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Completed {formatDate(a.completed_at)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
