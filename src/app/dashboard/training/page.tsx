"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

/* ── types ─────────────────────────────────────────────── */

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  level: "beginner" | "intermediate" | "advanced";
  passing_score: number;
  instructor_name: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
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
  assigned_to: string;
  assigned_to_name: string | null;
  assigned_by_name: string | null;
  status: "assigned" | "in_progress" | "completed" | "failed";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface UserOption {
  id: string;
  full_name: string;
  department: string | null;
  user_type: string;
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
};

const LESSON_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  video: { bg: "#1e3a5f", text: "#60a5fa" },
  document: { bg: "#2d1b4e", text: "#a78bfa" },
  quiz: { bg: "#3a3520", text: "#facc15" },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label.replace("_", " ")}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

/* ── main page ─────────────────────────────────────────── */

export default function TrainingPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"courses" | "categories" | "assignments" | "analytics">("courses");

  // Shared data
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false); // edit only
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showLessonBuilder, setShowLessonBuilder] = useState(false);

  // Course creation wizard (video-first)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardVideo, setWizardVideo] = useState({ url: "", title: "" });
  const [wizardCourse, setWizardCourse] = useState({ title: "", description: "", category_id: "", level: "beginner" as string, passing_score: 70, instructor_name: "" });
  const [wizardQuestions, setWizardQuestions] = useState<{ question_text: string; options: { label: string; is_correct: boolean }[] }[]>([]);
  const [wizardPublish, setWizardPublish] = useState(false);

  // Course form (for edit only)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category_id: "", level: "beginner" as string, passing_score: 70, instructor_name: "" });

  // Category form
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "" });

  // Lessons state (for course builder)
  const [builderCourseId, setBuilderCourseId] = useState<string | null>(null);
  const [builderCourseName, setBuilderCourseName] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<Record<string, QuizQuestion[]>>({});
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", lesson_type: "video" as string, video_url: "", file_url: "", file_name: "" });

  // Quiz question form
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState({ question_text: "", options: [{ label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }] });

  // Assign form
  const [assignForm, setAssignForm] = useState({ course_id: "", assign_mode: "individual" as string, selected_users: [] as string[], department: "", due_date: "", priority: "medium" as string });
  const [userSearch, setUserSearch] = useState("");

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cover image
  const [wizardCoverUrl, setWizardCoverUrl] = useState("");

  // AI generation
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [quizCount, setQuizCount] = useState(5);

  /* ── file upload ──────────────────────────────────────── */

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${folder}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from("training-content").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("training-content").getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  };

  /* ── data fetching ───────────────────────────────────── */

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [catRes, courseRes, assignRes, userRes] = await Promise.all([
      supabase.from("training_categories").select("*").eq("org_id", ORG_ID).order("sort_order"),
      supabase.from("training_courses").select("*").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
      supabase.from("training_assignments").select("*").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
      supabase.from("users").select("id, full_name, department, user_type").eq("org_id", ORG_ID).eq("status", "active").order("full_name"),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (courseRes.data) setCourses(courseRes.data as Course[]);
    if (assignRes.data) setAssignments(assignRes.data as Assignment[]);
    if (userRes.data) setUsers(userRes.data as UserOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserName(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "");
      }
    });
  }, []);

  /* ── course CRUD ─────────────────────────────────────── */

  const openCreateCourse = () => {
    setWizardStep(1);
    setWizardVideo({ url: "", title: "" });
    setWizardCourse({ title: "", description: "", category_id: "", level: "beginner", passing_score: 70, instructor_name: "" });
    setWizardQuestions([]);
    setWizardPublish(false);
    setWizardCoverUrl("");
    setShowWizard(true);
  };

  const saveWizard = async () => {
    if (!wizardCourse.title.trim()) return;
    setSaving(true);

    // 1. Create the course
    const { data: courseData } = await supabase.from("training_courses").insert({
      org_id: ORG_ID,
      title: wizardCourse.title.trim(),
      description: wizardCourse.description.trim() || null,
      category_id: wizardCourse.category_id || null,
      level: wizardCourse.level,
      passing_score: wizardCourse.passing_score,
      instructor_name: wizardCourse.instructor_name.trim() || null,
      thumbnail_url: wizardCoverUrl || null,
      is_published: wizardPublish,
      created_by: userId,
    }).select("id").single();

    if (!courseData) { setSaving(false); return; }
    const courseId = courseData.id;
    let sortOrder = 0;

    // 2. Create the video lesson (if video was provided)
    if (wizardVideo.url.trim()) {
      await supabase.from("training_lessons").insert({
        course_id: courseId,
        org_id: ORG_ID,
        title: wizardVideo.title.trim() || wizardCourse.title.trim(),
        lesson_type: "video",
        video_url: wizardVideo.url.trim(),
        sort_order: sortOrder++,
      });
    }

    // 3. Create quiz lesson + questions (if any questions were added)
    if (wizardQuestions.length > 0) {
      const validQs = wizardQuestions.filter((q) => q.question_text.trim() && q.options.filter((o) => o.label.trim()).length >= 2);
      if (validQs.length > 0) {
        const { data: quizLesson } = await supabase.from("training_lessons").insert({
          course_id: courseId,
          org_id: ORG_ID,
          title: "Quiz",
          lesson_type: "quiz",
          sort_order: sortOrder++,
        }).select("id").single();

        if (quizLesson) {
          for (let i = 0; i < validQs.length; i++) {
            const q = validQs[i];
            await supabase.from("training_quiz_questions").insert({
              lesson_id: quizLesson.id,
              org_id: ORG_ID,
              question_text: q.question_text.trim(),
              options: q.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), is_correct: o.is_correct })),
              sort_order: i,
            });
          }
        }
      }
    }

    setSaving(false);
    setShowWizard(false);
    fetchAll();
  };

  const openEditCourse = (c: Course) => {
    setEditingCourseId(c.id);
    setCourseForm({
      title: c.title,
      description: c.description ?? "",
      category_id: c.category_id ?? "",
      level: c.level,
      passing_score: c.passing_score,
      instructor_name: c.instructor_name ?? "",
    });
    setShowCourseModal(true);
  };

  const saveCourse = async () => {
    if (!courseForm.title.trim()) return;
    setSaving(true);
    const payload = {
      title: courseForm.title.trim(),
      description: courseForm.description.trim() || null,
      category_id: courseForm.category_id || null,
      level: courseForm.level,
      passing_score: courseForm.passing_score,
      instructor_name: courseForm.instructor_name.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editingCourseId) {
      await supabase.from("training_courses").update(payload).eq("id", editingCourseId);
    } else {
      await supabase.from("training_courses").insert({ ...payload, org_id: ORG_ID, created_by: userId });
    }
    setSaving(false);
    setShowCourseModal(false);
    fetchAll();
  };

  const togglePublish = async (c: Course) => {
    await supabase.from("training_courses").update({ is_published: !c.is_published, updated_at: new Date().toISOString() }).eq("id", c.id);
    fetchAll();
  };

  const deleteCourse = async (id: string) => {
    await supabase.from("training_courses").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchAll();
  };

  /* ── category CRUD ───────────────────────────────────── */

  const openCreateCat = () => {
    setEditingCatId(null);
    setCatForm({ name: "", description: "" });
    setShowCategoryModal(true);
  };

  const openEditCat = (c: Category) => {
    setEditingCatId(c.id);
    setCatForm({ name: c.name, description: c.description ?? "" });
    setShowCategoryModal(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return;
    setSaving(true);
    const payload = { name: catForm.name.trim(), description: catForm.description.trim() || null };
    if (editingCatId) {
      await supabase.from("training_categories").update(payload).eq("id", editingCatId);
    } else {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
      await supabase.from("training_categories").insert({ ...payload, org_id: ORG_ID, sort_order: maxOrder });
    }
    setSaving(false);
    setShowCategoryModal(false);
    fetchAll();
  };

  const toggleCatActive = async (c: Category) => {
    await supabase.from("training_categories").update({ is_active: !c.is_active }).eq("id", c.id);
    fetchAll();
  };

  const deleteCat = async (id: string) => {
    await supabase.from("training_categories").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchAll();
  };

  /* ── lesson builder ──────────────────────────────────── */

  const openLessonBuilder = async (course: Course) => {
    setBuilderCourseId(course.id);
    setBuilderCourseName(course.title);
    const { data: lessonData } = await supabase.from("training_lessons").select("*").eq("course_id", course.id).order("sort_order");
    const lessonList = (lessonData ?? []) as Lesson[];
    setLessons(lessonList);

    // Load quiz questions for quiz-type lessons
    const quizLessons = lessonList.filter((l) => l.lesson_type === "quiz");
    const qMap: Record<string, QuizQuestion[]> = {};
    for (const ql of quizLessons) {
      const { data: qData } = await supabase.from("training_quiz_questions").select("*").eq("lesson_id", ql.id).order("sort_order");
      qMap[ql.id] = (qData ?? []) as QuizQuestion[];
    }
    setQuizQuestions(qMap);
    setShowLessonBuilder(true);
  };

  const openCreateLesson = () => {
    setEditingLessonId(null);
    setLessonForm({ title: "", description: "", lesson_type: "video", video_url: "", file_url: "", file_name: "" });
    setShowLessonModal(true);
  };

  const openEditLesson = (l: Lesson) => {
    setEditingLessonId(l.id);
    setLessonForm({
      title: l.title,
      description: l.description ?? "",
      lesson_type: l.lesson_type,
      video_url: l.video_url ?? "",
      file_url: l.file_url ?? "",
      file_name: l.file_name ?? "",
    });
    setShowLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim() || !builderCourseId) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: lessonForm.title.trim(),
      description: lessonForm.description.trim() || null,
      lesson_type: lessonForm.lesson_type,
      video_url: lessonForm.lesson_type === "video" ? lessonForm.video_url.trim() || null : null,
      file_url: lessonForm.lesson_type === "document" ? lessonForm.file_url.trim() || null : null,
      file_name: lessonForm.lesson_type === "document" ? lessonForm.file_name.trim() || null : null,
      duration_seconds: null,
    };
    if (editingLessonId) {
      await supabase.from("training_lessons").update(payload).eq("id", editingLessonId);
    } else {
      const maxOrder = lessons.length > 0 ? Math.max(...lessons.map((l) => l.sort_order)) + 1 : 0;
      await supabase.from("training_lessons").insert({ ...payload, course_id: builderCourseId, org_id: ORG_ID, sort_order: maxOrder });
    }
    // Refresh lessons
    const { data } = await supabase.from("training_lessons").select("*").eq("course_id", builderCourseId).order("sort_order");
    setLessons((data ?? []) as Lesson[]);
    setSaving(false);
    setShowLessonModal(false);
  };

  const deleteLesson = async (id: string) => {
    if (!builderCourseId) return;
    await supabase.from("training_lessons").delete().eq("id", id);
    const { data } = await supabase.from("training_lessons").select("*").eq("course_id", builderCourseId).order("sort_order");
    setLessons((data ?? []) as Lesson[]);
    setDeleteConfirm(null);
  };

  const moveLessonUp = async (index: number) => {
    if (index === 0 || !builderCourseId) return;
    const updated = [...lessons];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    for (let i = 0; i < updated.length; i++) {
      await supabase.from("training_lessons").update({ sort_order: i }).eq("id", updated[i].id);
    }
    setLessons(updated.map((l, i) => ({ ...l, sort_order: i })));
  };

  const moveLessonDown = async (index: number) => {
    if (index >= lessons.length - 1 || !builderCourseId) return;
    const updated = [...lessons];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    for (let i = 0; i < updated.length; i++) {
      await supabase.from("training_lessons").update({ sort_order: i }).eq("id", updated[i].id);
    }
    setLessons(updated.map((l, i) => ({ ...l, sort_order: i })));
  };

  /* ── quiz question CRUD ──────────────────────────────── */

  const openQuizQuestions = (lessonId: string) => {
    setQuizLessonId(lessonId);
    setEditingQuestionId(null);
    setQuestionForm({ question_text: "", options: [{ label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }] });
    setShowQuizModal(true);
  };

  const openEditQuestion = (q: QuizQuestion) => {
    setQuizLessonId(q.lesson_id);
    setEditingQuestionId(q.id);
    const opts = [...q.options];
    while (opts.length < 4) opts.push({ label: "", is_correct: false });
    setQuestionForm({ question_text: q.question_text, options: opts.slice(0, 4) });
    setShowQuizModal(true);
  };

  const saveQuestion = async () => {
    if (!questionForm.question_text.trim() || !quizLessonId) return;
    setSaving(true);
    const validOptions = questionForm.options.filter((o) => o.label.trim());
    if (validOptions.length < 2) { setSaving(false); return; }
    const payload = {
      question_text: questionForm.question_text.trim(),
      options: validOptions.map((o) => ({ label: o.label.trim(), is_correct: o.is_correct })),
    };
    if (editingQuestionId) {
      await supabase.from("training_quiz_questions").update(payload).eq("id", editingQuestionId);
    } else {
      const existing = quizQuestions[quizLessonId] ?? [];
      const maxOrder = existing.length > 0 ? Math.max(...existing.map((q) => q.sort_order)) + 1 : 0;
      await supabase.from("training_quiz_questions").insert({ ...payload, lesson_id: quizLessonId, org_id: ORG_ID, sort_order: maxOrder });
    }
    // Refresh
    const { data } = await supabase.from("training_quiz_questions").select("*").eq("lesson_id", quizLessonId).order("sort_order");
    setQuizQuestions((prev) => ({ ...prev, [quizLessonId!]: (data ?? []) as QuizQuestion[] }));
    setSaving(false);
    setEditingQuestionId(null);
    setQuestionForm({ question_text: "", options: [{ label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }] });
  };

  const deleteQuestion = async (qId: string, lessonId: string) => {
    await supabase.from("training_quiz_questions").delete().eq("id", qId);
    const { data } = await supabase.from("training_quiz_questions").select("*").eq("lesson_id", lessonId).order("sort_order");
    setQuizQuestions((prev) => ({ ...prev, [lessonId]: (data ?? []) as QuizQuestion[] }));
  };

  /* ── assignment CRUD ─────────────────────────────────── */

  const openAssign = () => {
    setAssignForm({ course_id: "", assign_mode: "individual", selected_users: [], department: "", due_date: "", priority: "medium" });
    setUserSearch("");
    setShowAssignModal(true);
  };

  const toggleUserSelection = (uid: string) => {
    setAssignForm((prev) => ({
      ...prev,
      selected_users: prev.selected_users.includes(uid) ? prev.selected_users.filter((u) => u !== uid) : [...prev.selected_users, uid],
    }));
  };

  const saveAssignment = async () => {
    if (!assignForm.course_id) return;
    setSaving(true);

    // Determine target users
    let targetUsers: UserOption[] = [];
    if (assignForm.assign_mode === "individual") {
      targetUsers = users.filter((u) => assignForm.selected_users.includes(u.id));
    } else if (assignForm.assign_mode === "department") {
      targetUsers = users.filter((u) => u.department === assignForm.department);
    } else if (assignForm.assign_mode === "all_internal") {
      targetUsers = users.filter((u) => u.user_type === "internal");
    } else if (assignForm.assign_mode === "all_external") {
      targetUsers = users.filter((u) => u.user_type === "external");
    } else if (assignForm.assign_mode === "everyone") {
      targetUsers = [...users];
    }

    const course = courses.find((c) => c.id === assignForm.course_id);
    const courseName = course?.title ?? "Training";

    // Create assignments + action items for each user
    for (const u of targetUsers) {
      // Check if already assigned
      const existing = assignments.find((a) => a.course_id === assignForm.course_id && a.assigned_to === u.id);
      if (existing) continue;

      await supabase.from("training_assignments").insert({
        org_id: ORG_ID,
        course_id: assignForm.course_id,
        assigned_to: u.id,
        assigned_by: userId,
        assigned_to_name: u.full_name,
        assigned_by_name: userName,
        status: "assigned",
        due_date: assignForm.due_date || null,
      });

      // Create action item
      await supabase.from("action_items").insert({
        org_id: ORG_ID,
        title: `Complete: ${courseName}`,
        description: `Training assignment — ${courseName}`,
        item_type: "training",
        assigned_to: u.id,
        assigned_by: userId,
        assigned_to_name: u.full_name,
        assigned_by_name: userName,
        status: "pending",
        priority: assignForm.priority,
        due_date: assignForm.due_date || null,
      });
    }

    setSaving(false);
    setShowAssignModal(false);
    fetchAll();
  };

  /* ── derived data ────────────────────────────────────── */

  const getCatName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  const getCourseName = (id: string) => courses.find((c) => c.id === id)?.title ?? "Unknown";
  const publishedCourses = courses.filter((c) => c.is_published);
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))] as string[];

  // Analytics
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === "completed").length;
  const overdueAssignments = assignments.filter((a) => a.due_date && new Date(a.due_date) < new Date() && a.status !== "completed").length;
  const completionRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  /* ── tab content ─────────────────────────────────────── */

  const tabs = [
    { key: "courses", label: "Courses", count: courses.length },
    { key: "categories", label: "Categories", count: categories.length },
    { key: "assignments", label: "Assignments", count: assignments.length },
    { key: "analytics", label: "Analytics" },
  ] as const;

  if (loading) return <p style={{ color: "var(--text-secondary)" }}>Loading...</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Training Management</h1>
        {tab === "courses" && (
          <button onClick={openCreateCourse} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
            <span className="text-lg">+</span> Create Course
          </button>
        )}
        {tab === "categories" && (
          <button onClick={openCreateCat} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
            <span className="text-lg">+</span> Add Category
          </button>
        )}
        {tab === "assignments" && (
          <button onClick={openAssign} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
            <span className="text-lg">+</span> Assign Course
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6" style={{ borderBottom: "1px solid var(--border-color)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors relative"
            style={{ color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)", borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: "-1px" }}
          >
            {t.label}
            {"count" in t && t.count !== undefined && (
              <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── COURSES TAB ────────────────────────────────── */}
      {tab === "courses" && (
        <div className="space-y-2">
          {courses.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ color: "var(--text-secondary)" }}>No courses yet. Create your first one!</p>
            </div>
          ) : (
            courses.map((c) => (
              <div key={c.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", opacity: c.is_published ? 1 : 0.6 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-semibold">{c.title}</h3>
                    <Badge label={c.level} colors={LEVEL_COLORS[c.level]} />
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: c.is_published ? "#1a3a2a" : "#2a2a2a", color: c.is_published ? "#4ade80" : "#888" }}>
                      {c.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  {c.description && <p className="text-sm mb-1 truncate" style={{ color: "var(--text-secondary)" }}>{c.description}</p>}
                  <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span>{getCatName(c.category_id)}</span>
                    {c.instructor_name && <span>Instructor: {c.instructor_name}</span>}
                    <span>Pass: {c.passing_score}%</span>
                    <span>Created {formatDate(c.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Lessons */}
                  <button onClick={() => openLessonBuilder(c)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Manage Lessons">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                  </button>
                  {/* Publish toggle */}
                  <button onClick={() => togglePublish(c)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title={c.is_published ? "Unpublish" : "Publish"}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.is_published ? "#4ade80" : "var(--text-muted)"} strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                  {/* Edit */}
                  <button onClick={() => openEditCourse(c)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  {/* Delete */}
                  {deleteConfirm === c.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteCourse(c.id)} className="px-2 py-1 rounded text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>Delete</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(c.id)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CATEGORIES TAB ─────────────────────────────── */}
      {tab === "categories" && (
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ color: "var(--text-secondary)" }}>No categories yet. Add your first one!</p>
            </div>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", opacity: c.is_active ? 1 : 0.5 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: c.is_active ? "#1a3a2a" : "#2a2a2a", color: c.is_active ? "#4ade80" : "#888" }}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {courses.filter((co) => co.category_id === c.id).length} courses
                    </span>
                  </div>
                  {c.description && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleCatActive(c)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title={c.is_active ? "Deactivate" : "Activate"}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.is_active ? "#4ade80" : "var(--text-muted)"} strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                  <button onClick={() => openEditCat(c)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  {deleteConfirm === `cat-${c.id}` ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteCat(c.id)} className="px-2 py-1 rounded text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>Delete</button>
                      <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(`cat-${c.id}`)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ASSIGNMENTS TAB ────────────────────────────── */}
      {tab === "assignments" && (
        <div className="space-y-2">
          {assignments.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ color: "var(--text-secondary)" }}>No assignments yet. Assign a course to get started!</p>
            </div>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", opacity: a.status === "completed" ? 0.5 : 1 }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-semibold">{getCourseName(a.course_id)}</h3>
                    <Badge label={a.status} colors={STATUS_COLORS[a.status]} />
                  </div>
                  <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span>Assigned to: {a.assigned_to_name ?? "Unknown"}</span>
                    {a.assigned_by_name && <span>By: {a.assigned_by_name}</span>}
                    {a.due_date && (
                      <span style={{ color: new Date(a.due_date) < new Date() && a.status !== "completed" ? "#ef4444" : "var(--text-muted)" }}>
                        Due: {formatDate(a.due_date)}{new Date(a.due_date) < new Date() && a.status !== "completed" && " (Overdue)"}
                      </span>
                    )}
                    <span>Assigned {formatDate(a.created_at)}</span>
                    {a.completed_at && <span>Completed {formatDate(a.completed_at)}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ──────────────────────────────── */}
      {tab === "analytics" && (
        <div>
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Courses", value: courses.length, color: "#60a5fa" },
              { label: "Published", value: publishedCourses.length, color: "#4ade80" },
              { label: "Total Assignments", value: totalAssignments, color: "#a78bfa" },
              { label: "Completion Rate", value: `${completionRate}%`, color: "#facc15" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                <p className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3">Assignment Status</h3>
              {["assigned", "in_progress", "completed", "failed"].map((s) => {
                const count = assignments.filter((a) => a.status === s).length;
                const pct = totalAssignments > 0 ? Math.round((count / totalAssignments) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-3 mb-2">
                    <span className="text-xs capitalize w-24" style={{ color: STATUS_COLORS[s].text }}>{s.replace("_", " ")}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: "var(--bg-hover)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: STATUS_COLORS[s].text }} />
                    </div>
                    <span className="text-xs w-8 text-right" style={{ color: "var(--text-muted)" }}>{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3">Courses by Category</h3>
              {categories.filter((c) => c.is_active).map((cat) => {
                const count = courses.filter((c) => c.category_id === cat.id).length;
                return (
                  <div key={cat.id} className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{cat.name}</span>
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{count}</span>
                  </div>
                );
              })}
              {courses.filter((c) => !c.category_id).length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Uncategorized</span>
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{courses.filter((c) => !c.category_id).length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Overdue */}
          {overdueAssignments > 0 && (
            <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "#ef4444" }}>Overdue Assignments ({overdueAssignments})</h3>
              {assignments.filter((a) => a.due_date && new Date(a.due_date) < new Date() && a.status !== "completed").map((a) => (
                <div key={a.id} className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-medium">{getCourseName(a.course_id)}</span>
                    <span className="text-[11px] ml-2" style={{ color: "var(--text-muted)" }}>{a.assigned_to_name}</span>
                  </div>
                  <span className="text-[11px]" style={{ color: "#ef4444" }}>Due {formatDate(a.due_date!)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ── MODALS ────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════ */}

      {/* ── Course Creation Wizard (Video-First) ──────── */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowWizard(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Create Course</h2>
              <button onClick={() => setShowWizard(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-6">
              {[
                { step: 1, label: "Content" },
                { step: 2, label: "Details" },
                { step: 3, label: "Quiz (Optional)" },
              ].map((s) => (
                <button key={s.step} onClick={() => { if (s.step === 1 || (s.step === 2 && wizardVideo.url) || (s.step === 3 && wizardCourse.title)) setWizardStep(s.step as 1 | 2 | 3); }} className="flex items-center gap-2 cursor-pointer">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: wizardStep >= s.step ? "var(--accent)" : "var(--bg-surface)", color: wizardStep >= s.step ? "#000" : "var(--text-muted)", border: `1px solid ${wizardStep >= s.step ? "var(--accent)" : "var(--border-color)"}` }}>
                    {wizardStep > s.step ? "✓" : s.step}
                  </div>
                  <span className="text-xs font-medium" style={{ color: wizardStep === s.step ? "var(--text-primary)" : "var(--text-muted)" }}>{s.label}</span>
                  {s.step < 3 && <div className="w-8 h-px" style={{ background: "var(--border-color)" }} />}
                </button>
              ))}
            </div>

            {/* Step 1: Upload video or paste URL */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Start by adding your video — upload a file or paste a URL.</p>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Video URL</label>
                  <input type="text" value={wizardVideo.url} onChange={(e) => setWizardVideo({ ...wizardVideo, url: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Paste a YouTube link or video URL" />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
                </div>

                <label className="flex items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer transition-colors" style={{ background: "var(--bg-surface)", border: "2px dashed var(--border-color)", color: "var(--text-secondary)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span className="text-sm font-medium">{uploading ? "Uploading..." : "Upload Video File"}</span>
                  <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFile(file, "videos");
                    if (url) setWizardVideo({ url, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ") });
                    e.target.value = "";
                  }} />
                </label>

                {wizardVideo.url && (
                  <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "#0a2a1a", border: "1px solid #1a5a3a" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-sm truncate flex-1" style={{ color: "#4ade80" }}>Video ready</span>
                    <span className="text-[11px] truncate max-w-[300px]" style={{ color: "var(--text-muted)" }}>{wizardVideo.url}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => { setWizardStep(2); if (!wizardCourse.title && wizardVideo.title) setWizardCourse((prev) => ({ ...prev, title: wizardVideo.title })); }} className="text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>Skip — no video</button>
                  <button onClick={() => { setWizardStep(2); if (!wizardCourse.title && wizardVideo.title) setWizardCourse((prev) => ({ ...prev, title: wizardVideo.title })); }} disabled={!wizardVideo.url} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Course details */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                {/* AI Generate button */}
                <button
                  onClick={() => { setShowTranscriptModal(true); setTranscript(""); setGenerateError(""); setQuizCount(5); }}
                  className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 100%)", border: "1px solid #3b5998", color: "#a78bfa" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" /></svg>
                  Generate with AI — Paste a Transcript
                </button>

                {/* Cover image (optional) */}
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Cover Image <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                  {wizardCoverUrl ? (
                    <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)", maxHeight: "160px" }}>
                      <img src={wizardCoverUrl} alt="Cover" className="w-full h-40 object-cover" />
                      <button onClick={() => setWizardCoverUrl("")} className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs cursor-pointer" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>✕</button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-lg cursor-pointer transition-colors" style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-color)", color: "var(--text-muted)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                      <span className="text-xs font-medium">{uploading ? "Uploading..." : "Upload cover image"}</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadFile(file, "covers");
                        if (url) setWizardCoverUrl(url);
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Title</label>
                  <input type="text" value={wizardCourse.title} onChange={(e) => setWizardCourse({ ...wizardCourse, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Course title..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                  <textarea value={wizardCourse.description} onChange={(e) => setWizardCourse({ ...wizardCourse, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="What is this course about?" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
                    <select value={wizardCourse.category_id} onChange={(e) => setWizardCourse({ ...wizardCourse, category_id: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <option value="">No category</option>
                      {categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Level</label>
                    <select value={wizardCourse.level} onChange={(e) => setWizardCourse({ ...wizardCourse, level: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Passing Score (%)</label>
                    <input type="number" min={0} max={100} value={wizardCourse.passing_score} onChange={(e) => setWizardCourse({ ...wizardCourse, passing_score: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Instructor Name</label>
                    <input type="text" value={wizardCourse.instructor_name} onChange={(e) => setWizardCourse({ ...wizardCourse, instructor_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Optional" />
                  </div>
                </div>

                {/* Publish toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={wizardPublish} onChange={(e) => setWizardPublish(e.target.checked)} className="cursor-pointer" />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Publish immediately</span>
                </label>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Back</button>
                  <div className="flex items-center gap-2">
                    <button onClick={saveWizard} disabled={saving || !wizardCourse.title.trim()} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50" style={{ color: "var(--text-secondary)" }}>
                      {saving ? "Saving..." : "Save Without Quiz"}
                    </button>
                    <button onClick={() => setWizardStep(3)} disabled={!wizardCourse.title.trim()} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                      Add Quiz
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Quiz questions (optional) */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Add quiz questions. Users must pass with {wizardCourse.passing_score}% to complete the course.</p>

                {wizardQuestions.map((q, qi) => (
                  <div key={qi} className="rounded-lg p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Question {qi + 1}</span>
                      <button onClick={() => setWizardQuestions((prev) => prev.filter((_, i) => i !== qi))} className="text-xs cursor-pointer" style={{ color: "#ef4444" }}>Remove</button>
                    </div>
                    <textarea value={q.question_text} onChange={(e) => { const updated = [...wizardQuestions]; updated[qi] = { ...updated[qi], question_text: e.target.value }; setWizardQuestions(updated); }} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y mb-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Enter your question..." />
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2 mb-1.5">
                        <input type="checkbox" checked={opt.is_correct} onChange={() => { const updated = [...wizardQuestions]; const newOpts = [...updated[qi].options]; newOpts[oi] = { ...newOpts[oi], is_correct: !newOpts[oi].is_correct }; updated[qi] = { ...updated[qi], options: newOpts }; setWizardQuestions(updated); }} className="cursor-pointer" />
                        <input type="text" value={opt.label} onChange={(e) => { const updated = [...wizardQuestions]; const newOpts = [...updated[qi].options]; newOpts[oi] = { ...newOpts[oi], label: e.target.value }; updated[qi] = { ...updated[qi], options: newOpts }; setWizardQuestions(updated); }} className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                      </div>
                    ))}
                  </div>
                ))}

                <button onClick={() => setWizardQuestions((prev) => [...prev, { question_text: "", options: [{ label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }] }])} className="w-full py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "var(--bg-surface)", border: "1px dashed var(--border-color)", color: "var(--text-secondary)" }}>
                  + Add Question
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setWizardStep(2)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Back</button>
                  <button onClick={saveWizard} disabled={saving || !wizardCourse.title.trim()} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                    {saving ? "Creating Course..." : `Create Course${wizardQuestions.length > 0 ? ` with ${wizardQuestions.length} Questions` : ""}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI Transcript Modal ──────────────────────────── */}
      {showTranscriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowTranscriptModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Generate Course from Transcript</h2>
              <button onClick={() => setShowTranscriptModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              Paste a training transcript below. AI will generate a course title, description, category, difficulty level, and quiz questions.
            </p>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y flex-1 mb-2"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)", minHeight: "200px" }}
              placeholder="Paste your training transcript here..."
              disabled={generating}
            />
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Quiz Questions:</label>
                <input type="number" min={2} max={15} value={quizCount} onChange={(e) => setQuizCount(Math.min(15, Math.max(2, parseInt(e.target.value) || 5)))} className="w-16 px-2 py-1 rounded-md text-sm text-center outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>2–15 questions</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: transcript.length > 50000 ? "#ef4444" : "var(--text-muted)" }}>
                {transcript.length.toLocaleString()} / 50,000 characters
              </span>
              <div className="flex items-center gap-2">
                {generateError && <span className="text-xs" style={{ color: "#ef4444" }}>{generateError}</span>}
                <button onClick={() => setShowTranscriptModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button
                  onClick={async () => {
                    if (!transcript.trim() || transcript.length > 50000) return;
                    setGenerating(true);
                    setGenerateError("");
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) { setGenerateError("Not authenticated"); setGenerating(false); return; }
                      const res = await fetch("/api/training/generate-from-transcript", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ transcript, quiz_count: quizCount }),
                      });
                      const data = await res.json();
                      if (!data.success) { setGenerateError(data.error || "Generation failed"); setGenerating(false); return; }
                      // Auto-populate wizard
                      const course = data.course;
                      const matchedCat = categories.find((c) => c.name.toLowerCase() === (course.suggested_category || "").toLowerCase());
                      setWizardCourse({
                        title: course.title || wizardCourse.title,
                        description: course.description || wizardCourse.description,
                        category_id: matchedCat?.id || wizardCourse.category_id,
                        level: course.level || wizardCourse.level,
                        passing_score: wizardCourse.passing_score,
                        instructor_name: wizardCourse.instructor_name,
                      });
                      // Update video lesson title to match AI-generated title instead of ugly storage filename
                      if (course.title && wizardVideo.url) {
                        setWizardVideo((prev) => ({ ...prev, title: course.title }));
                      }
                      if (course.quiz_questions?.length) {
                        setWizardQuestions(course.quiz_questions.map((q: { question_text: string; options: { label: string; is_correct: boolean }[] }) => ({
                          question_text: q.question_text,
                          options: q.options,
                        })));
                      }
                      setShowTranscriptModal(false);
                    } catch {
                      setGenerateError("Network error — please try again");
                    }
                    setGenerating(false);
                  }}
                  disabled={generating || !transcript.trim() || transcript.length > 50000}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-2"
                  style={{ background: generating ? "#1e3a5f" : "linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)", color: "#fff" }}
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                      Generating...
                    </>
                  ) : "Generate Course"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Course Edit Modal ─────────────────────────────── */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowCourseModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Edit Course</h2>
              <button onClick={() => setShowCourseModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Title</label>
                <input type="text" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Course title..." />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="What is this course about?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
                  <select value={courseForm.category_id} onChange={(e) => setCourseForm({ ...courseForm, category_id: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    <option value="">No category</option>
                    {categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Level</label>
                  <select value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Passing Score (%)</label>
                  <input type="number" min={0} max={100} value={courseForm.passing_score} onChange={(e) => setCourseForm({ ...courseForm, passing_score: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Instructor Name</label>
                  <input type="text" value={courseForm.instructor_name} onChange={(e) => setCourseForm({ ...courseForm, instructor_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Optional" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowCourseModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={saveCourse} disabled={saving || !courseForm.title.trim()} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Create/Edit Modal ────────────────── */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowCategoryModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editingCatId ? "Edit Category" : "Add Category"}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Name</label>
                <input type="text" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. Onboarding, Technical, Safety..." />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description (Optional)</label>
                <textarea value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="What this category covers..." />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={saveCat} disabled={saving || !catForm.name.trim()} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                  {saving ? "Saving..." : editingCatId ? "Save Changes" : "Add Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Course Modal ───────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowAssignModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Assign Course</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              {/* Course picker */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Course</label>
                <select value={assignForm.course_id} onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <option value="">Select a course...</option>
                  {publishedCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              {/* Assign mode */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Assign To</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: "individual", label: "Individual" },
                    { key: "department", label: "Department" },
                    { key: "all_internal", label: "All Internal" },
                    { key: "all_external", label: "All External" },
                    { key: "everyone", label: "Everyone" },
                  ].map((m) => (
                    <button key={m.key} onClick={() => setAssignForm({ ...assignForm, assign_mode: m.key, selected_users: [], department: "" })} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: assignForm.assign_mode === m.key ? "var(--accent)" : "var(--bg-surface)", color: assignForm.assign_mode === m.key ? "#000" : "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual user picker */}
              {assignForm.assign_mode === "individual" && (
                <div>
                  <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name..." className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                  <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border-color)" }}>
                    {users.filter((u) => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <input type="checkbox" checked={assignForm.selected_users.includes(u.id)} onChange={() => toggleUserSelection(u.id)} className="cursor-pointer" />
                        <span className="text-sm">{u.full_name}</span>
                        <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>{u.department ?? u.user_type}</span>
                      </label>
                    ))}
                  </div>
                  {assignForm.selected_users.length > 0 && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{assignForm.selected_users.length} selected</p>
                  )}
                </div>
              )}

              {/* Department picker */}
              {assignForm.assign_mode === "department" && (
                <div>
                  <select value={assignForm.department} onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    <option value="">Select department...</option>
                    {departments.map((d) => <option key={d} value={d}>{d} ({users.filter((u) => u.department === d).length} people)</option>)}
                  </select>
                </div>
              )}

              {/* Due date + priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Due Date (Optional)</label>
                  <input type="date" value={assignForm.due_date} onChange={(e) => setAssignForm({ ...assignForm, due_date: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
                  <select value={assignForm.priority} onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={saveAssignment} disabled={saving || !assignForm.course_id} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                  {saving ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lesson Builder Modal ──────────────────────── */}
      {showLessonBuilder && builderCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowLessonBuilder(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold">Lesson Builder</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{builderCourseName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openCreateLesson} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: "var(--accent)", color: "#000" }}>
                  <span>+</span> Add Lesson
                </button>
                <button onClick={() => setShowLessonBuilder(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
              </div>
            </div>

            {lessons.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                <p style={{ color: "var(--text-secondary)" }}>No lessons yet. Add videos, documents, or quizzes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map((l, idx) => (
                  <div key={l.id} className="rounded-lg p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold w-6 text-center" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                      <Badge label={l.lesson_type} colors={LESSON_TYPE_COLORS[l.lesson_type]} />
                      <span className="text-sm font-medium flex-1">{l.title}</span>
                      {l.lesson_type === "quiz" && (
                        <button onClick={() => openQuizQuestions(l.id)} className="text-[11px] px-2 py-0.5 rounded cursor-pointer" style={{ background: "#3a3520", color: "#facc15" }}>
                          {(quizQuestions[l.id] ?? []).length} questions
                        </button>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => moveLessonUp(idx)} disabled={idx === 0} className="p-1 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30" title="Move up">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
                        </button>
                        <button onClick={() => moveLessonDown(idx)} disabled={idx >= lessons.length - 1} className="p-1 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30" title="Move down">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                        <button onClick={() => openEditLesson(l)} className="p-1 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        {deleteConfirm === `lesson-${l.id}` ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deleteLesson(l.id)} className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>Yes</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer" style={{ color: "var(--text-muted)" }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(`lesson-${l.id}`)} className="p-1 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lesson Add/Edit Modal ─────────────────────── */}
      {showLessonModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowLessonModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editingLessonId ? "Edit Lesson" : "Add Lesson"}</h2>
              <button onClick={() => setShowLessonModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
                <div className="flex items-center gap-2">
                  {["video", "document", "quiz"].map((t) => (
                    <button key={t} onClick={() => setLessonForm({ ...lessonForm, lesson_type: t })} className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors" style={{ background: lessonForm.lesson_type === t ? LESSON_TYPE_COLORS[t].bg : "var(--bg-surface)", color: lessonForm.lesson_type === t ? LESSON_TYPE_COLORS[t].text : "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Title</label>
                <input type="text" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Lesson title..." />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description (Optional)</label>
                <textarea value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              {lessonForm.lesson_type === "video" && (
                <>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Video</label>
                    <input type="text" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Paste a YouTube or video URL, or upload below" />
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      {uploading ? "Uploading..." : "Upload Video File"}
                      <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadFile(file, "videos");
                        if (url) setLessonForm((prev) => ({ ...prev, video_url: url }));
                        e.target.value = "";
                      }} />
                    </label>
                    {lessonForm.video_url && <p className="text-[11px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{lessonForm.video_url}</p>}
                  </div>
                </>
              )}
              {lessonForm.lesson_type === "document" && (
                <>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Document</label>
                    <input type="text" value={lessonForm.file_url} onChange={(e) => setLessonForm({ ...lessonForm, file_url: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Paste a URL, or upload below" />
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      {uploading ? "Uploading..." : "Upload File"}
                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp" className="hidden" disabled={uploading} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadFile(file, "documents");
                        if (url) setLessonForm((prev) => ({ ...prev, file_url: url, file_name: prev.file_name || file.name }));
                        e.target.value = "";
                      }} />
                    </label>
                    {lessonForm.file_url && <p className="text-[11px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{lessonForm.file_url}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Display Name</label>
                    <input type="text" value={lessonForm.file_name} onChange={(e) => setLessonForm({ ...lessonForm, file_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. Safety Handbook.pdf" />
                  </div>
                </>
              )}
              {lessonForm.lesson_type === "quiz" && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Save the lesson first, then add questions via the quiz editor.</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowLessonModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={saveLesson} disabled={saving || !lessonForm.title.trim()} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                  {saving ? "Saving..." : editingLessonId ? "Save Changes" : "Add Lesson"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quiz Question Modal ───────────────────────── */}
      {showQuizModal && quizLessonId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowQuizModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Quiz Questions</h2>
              <button onClick={() => setShowQuizModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Existing questions */}
            {(quizQuestions[quizLessonId] ?? []).length > 0 && (
              <div className="space-y-2 mb-4">
                {(quizQuestions[quizLessonId] ?? []).map((q, qi) => (
                  <div key={q.id} className="rounded-lg p-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>Q{qi + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">{q.question_text}</p>
                        <div className="flex flex-wrap gap-1">
                          {q.options.map((o, oi) => (
                            <span key={oi} className="text-[11px] px-2 py-0.5 rounded" style={{ background: o.is_correct ? "#1a3a2a" : "var(--bg-hover)", color: o.is_correct ? "#4ade80" : "var(--text-muted)" }}>
                              {o.label} {o.is_correct && "✓"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditQuestion(q)} className="p-1 rounded cursor-pointer hover:bg-[var(--bg-hover)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button onClick={() => deleteQuestion(q.id, quizLessonId!)} className="p-1 rounded cursor-pointer hover:bg-[var(--bg-hover)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit question form */}
            <div className="rounded-lg p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3">{editingQuestionId ? "Edit Question" : "Add Question"}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Question</label>
                  <textarea value={questionForm.question_text} onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Enter your question..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Options (check the correct answer)</label>
                  {questionForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={opt.is_correct} onChange={() => {
                        const newOpts = [...questionForm.options];
                        newOpts[i] = { ...newOpts[i], is_correct: !newOpts[i].is_correct };
                        setQuestionForm({ ...questionForm, options: newOpts });
                      }} className="cursor-pointer" />
                      <input type="text" value={opt.label} onChange={(e) => {
                        const newOpts = [...questionForm.options];
                        newOpts[i] = { ...newOpts[i], label: e.target.value };
                        setQuestionForm({ ...questionForm, options: newOpts });
                      }} className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {editingQuestionId && (
                    <button onClick={() => { setEditingQuestionId(null); setQuestionForm({ question_text: "", options: [{ label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }] }); }} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel Edit</button>
                  )}
                  <button onClick={saveQuestion} disabled={saving || !questionForm.question_text.trim()} className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                    {saving ? "Saving..." : editingQuestionId ? "Update Question" : "Add Question"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
