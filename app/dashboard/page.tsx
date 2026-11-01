"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Task = {
  id: string;
  title: string;
  description: string;
  subject: string;
  xp: number;
  coins: number;
  completed: boolean;
  createdAt: string;
};

type Hero = {
  name: string;
  emoji: string;
  description: string;
  cost: number;
};

type DbTask = {
  id: string;
  title: string;
  description: string;
  subject: string;
  xp: number;
  coins: number;
  completed: boolean;
  created_at: string;
};

function toTask(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    xp: row.xp,
    coins: row.coins,
    completed: row.completed,
    createdAt: row.created_at,
  };
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

const STARTER_TASKS: Task[] = [
  {
    id: "starter-1",
    title: "Finish maths homework",
    description: "Complete today's maths questions.",
    subject: "Maths",
    xp: 30,
    coins: 15,
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "starter-2",
    title: "Read for 20 minutes",
    description: "Read a book and write down one interesting fact.",
    subject: "English",
    xp: 20,
    coins: 10,
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "starter-3",
    title: "Revise science notes",
    description: "Review your notes before the next lesson.",
    subject: "Science",
    xp: 25,
    coins: 12,
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

const HEROES: Hero[] = [
  {
    name: "Knight",
    emoji: "🛡️",
    description: "Brave and ready for any challenge.",
    cost: 0,
  },
  {
    name: "Wizard",
    emoji: "🧙",
    description: "Master of knowledge and magic.",
    cost: 100,
  },
  {
    name: "Ninja",
    emoji: "🥷",
    description: "Fast, focused, and unstoppable.",
    cost: 200,
  },
  {
    name: "Dragon",
    emoji: "🐉",
    description: "A legendary study companion.",
    cost: 350,
  },
  {
    name: "Astronaut",
    emoji: "👨‍🚀",
    description: "Explore the universe of learning.",
    cost: 500,
  },
];

const SUBJECTS = [
  "Maths",
  "English",
  "Science",
  "History",
  "Geography",
  "Language",
  "Art",
  "Other",
];

const emptyForm = {
  title: "",
  description: "",
  subject: "Maths",
  xp: 25,
};

function getLevel(xp: number) {
  return Math.floor(xp / 100) + 1;
}

function getRank(level: number) {
  if (level >= 15) return "Legendary Scholar";
  if (level >= 10) return "Master Adventurer";
  if (level >= 6) return "Knowledge Knight";
  if (level >= 3) return "Rising Hero";
  return "Novice Adventurer";
}

export default function StudyQuest() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>(STARTER_TASKS);
  const [totalXp, setTotalXp] = useState(0);
  const [coins, setCoins] = useState(50);
  const [streak, setStreak] = useState(0);
  const [unlockedHeroes, setUnlockedHeroes] = useState<string[]>(["Knight"]);
  const [selectedHero, setSelectedHero] = useState("Knight");

  const [activeTab, setActiveTab] = useState("Home");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState("");
  const loadStartedFor = useRef<string | null>(null);

  // Check that someone is signed in. If not, send them to the login page.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  // Load this user's tasks and progress from Supabase.
  useEffect(() => {
    if (!userId || loadStartedFor.current === userId) return;
    loadStartedFor.current = userId;
    const uid = userId;

    async function load() {
      try {
        const { data: progress, error: progressError } = await supabase
          .from("game_progress")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        if (progressError) throw progressError;

        if (progress) {
          setTotalXp(progress.total_xp);
          setCoins(progress.coins);
          setStreak(progress.streak);
          setUnlockedHeroes(progress.unlocked_heroes);
          setSelectedHero(progress.selected_hero);

          const { data: rows, error: tasksError } = await supabase
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false });

          if (tasksError) throw tasksError;
          setTasks((rows ?? []).map(toTask));
        } else {
          // First sign-in: create the progress row and the starter tasks.
          const { error: createError } = await supabase
            .from("game_progress")
            .insert({ user_id: uid });

          if (createError) throw createError;

          const { data: seeded, error: seedError } = await supabase
            .from("tasks")
            .insert(
              STARTER_TASKS.map(({ title, description, subject, xp, coins }) => ({
                title,
                description,
                subject,
                xp,
                coins,
              }))
            )
            .select();

          if (seedError) throw seedError;
          setTasks((seeded ?? []).map(toTask));
        }
      } catch (error) {
        console.error("Could not load from Supabase:", error);
        setSyncError(getErrorMessage(error));
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, [userId, supabase]);

  // Save XP, coins, streak and heroes to Supabase whenever they change.
  useEffect(() => {
    if (!loaded || !userId) return;

    const timer = setTimeout(async () => {
      const { error } = await supabase.from("game_progress").upsert({
        user_id: userId,
        total_xp: totalXp,
        coins,
        streak,
        unlocked_heroes: unlockedHeroes,
        selected_hero: selectedHero,
      });

      if (error) {
        console.error("Could not save progress:", error);
        setSyncError(error.message);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    loaded,
    userId,
    supabase,
    totalXp,
    coins,
    streak,
    unlockedHeroes,
    selectedHero,
  ]);

  const level = getLevel(totalXp);
  const xpIntoLevel = totalXp % 100;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed).length;

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.subject.toLowerCase().includes(search.toLowerCase()) ||
      task.description.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "All" ||
      (filter === "To do" && !task.completed) ||
      (filter === "Completed" && task.completed);

    return matchesSearch && matchesFilter;
  });

  // Home shows up to 3 open quests, then the 2 most recent completed ones.
  const homeTasks = [
    ...tasks.filter((task) => !task.completed).slice(0, 3),
    ...tasks.filter((task) => task.completed).slice(0, 2),
  ];

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function openCreateForm() {
    setEditingTaskId(null);
    setForm(emptyForm);
    setFormError("");
    setShowTaskForm(true);
  }

  function openEditForm(task: Task) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      subject: task.subject,
      xp: task.xp,
    });
    setFormError("");
    setShowTaskForm(true);
  }

  function closeTaskForm() {
    setShowTaskForm(false);
    setEditingTaskId(null);
    setForm(emptyForm);
    setFormError("");
  }

  // This is the form's actual submit handler.
  async function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();

    if (!title) {
      setFormError("Please enter a task title.");
      return;
    }

    const xp = Math.min(100, Math.max(5, Number(form.xp) || 25));
    const values = {
      title,
      description: form.description.trim(),
      subject: form.subject,
      xp,
      coins: Math.round(xp / 2),
    };

    setSaving(true);
    setSyncError("");

    if (editingTaskId) {
      const { error } = await supabase
        .from("tasks")
        .update(values)
        .eq("id", editingTaskId);

      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === editingTaskId ? { ...task, ...values } : task
        )
      );
    } else {
      const { data, error } = await supabase
        .from("tasks")
        .insert(values)
        .select()
        .single();

      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }

      setTasks((currentTasks) => [toTask(data), ...currentTasks]);
    }

    setSaving(false);
    closeTaskForm();
    setActiveTab("Homework");
  }

  async function completeTask(task: Task) {
    if (task.completed) return;

    setSyncError("");

    // Only matches while the task is still open, so a double click
    // can't award XP twice.
    const { data, error } = await supabase
      .from("tasks")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("completed", false)
      .select("id");

    if (error) {
      setSyncError(error.message);
      return;
    }

    if (!data || data.length === 0) return;

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === task.id ? { ...item, completed: true } : item
      )
    );

    setTotalXp((current) => current + task.xp);
    setCoins((current) => current + task.coins);
    setStreak((current) => current + 1);
  }

  async function deleteTask(taskId: string) {
    const confirmed = window.confirm("Delete this task?");

    if (!confirmed) return;

    setSyncError("");

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      setSyncError(error.message);
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId)
    );
  }

  function buyOrSelectHero(hero: Hero) {
    if (unlockedHeroes.includes(hero.name)) {
      setSelectedHero(hero.name);
      return;
    }

    if (coins < hero.cost) {
      window.alert(
        `You need ${hero.cost - coins} more coins to unlock this hero!`
      );
      return;
    }

    setCoins((current) => current - hero.cost);
    setUnlockedHeroes((current) => [...current, hero.name]);
    setSelectedHero(hero.name);
  }

  async function resetProgress() {
    const confirmed = window.confirm(
      "Reset all your progress? This cannot be undone."
    );

    if (!confirmed || !userId) return;

    setSyncError("");

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", userId);

    if (error) {
      setSyncError(error.message);
      return;
    }

    setTasks([]);
    setTotalXp(0);
    setCoins(50);
    setStreak(0);
    setUnlockedHeroes(["Knight"]);
    setSelectedHero("Knight");
  }

  // Wait until we know who is signed in and their progress has loaded.
  if (!loaded) return null;

  return (
    <main className="app-shell">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap");

        :root {
          color-scheme: dark;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #0b1020;
          color: #f4f5ff;
          font-family: "DM Sans", sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible {
          outline: 2px solid #a78bfa;
          outline-offset: 3px;
        }

        .app-shell {
          min-height: 100vh;
          background:
            radial-gradient(
              ellipse at 10% 0%,
              rgba(99, 102, 241, 0.18),
              transparent 38%
            ),
            radial-gradient(
              ellipse at 95% 20%,
              rgba(168, 85, 247, 0.12),
              transparent 30%
            ),
            #0b1020;
        }

        .layout {
          width: min(1180px, 100%);
          margin: auto;
          padding: 28px 24px 60px;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 32px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          font-size: 25px;
          box-shadow: 0 8px 30px #8b5cf633;
        }

        .brand h1 {
          margin: 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 23px;
          letter-spacing: -1px;
        }

        .brand p {
          margin: 3px 0 0;
          color: #939bb8;
          font-size: 12px;
        }

        .top-stats {
          display: flex;
          gap: 10px;
        }

        .pill {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px;
          border: 1px solid #ffffff13;
          border-radius: 14px;
          background: #151b30;
          font-size: 13px;
          font-weight: 700;
        }

        .signout-button {
          color: #c4b5fd;
        }

        .signout-button:hover {
          background: #202840;
        }

        .navigation {
          display: flex;
          gap: 8px;
          padding: 7px;
          margin-bottom: 26px;
          border: 1px solid #ffffff0e;
          border-radius: 17px;
          background: #11172a;
          overflow-x: auto;
        }

        .nav-button {
          flex: 1;
          min-width: 95px;
          padding: 12px 16px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          color: #9ca5c2;
          font-weight: 700;
          white-space: nowrap;
        }

        .nav-button.active {
          background: #272346;
          color: #c4b5fd;
        }

        .hero-banner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 34px;
          margin-bottom: 24px;
          overflow: hidden;
          border: 1px solid #a78bfa30;
          border-radius: 25px;
          background: linear-gradient(115deg, #28204c, #171d3a 65%, #152b45);
        }

        .hero-banner::after {
          position: absolute;
          right: 17%;
          bottom: -100px;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: #8b5cf61a;
          content: "";
          pointer-events: none;
        }

        .eyebrow {
          color: #a5b4fc;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .hero-banner h2 {
          margin: 10px 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: clamp(28px, 4vw, 42px);
          letter-spacing: -1.5px;
        }

        .hero-banner p {
          max-width: 510px;
          margin: 0;
          color: #b5bdd6;
          line-height: 1.7;
        }

        .hero-avatar {
          z-index: 1;
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 125px;
          height: 125px;
          border: 1px solid #ffffff20;
          border-radius: 35px;
          background: #ffffff0b;
          font-size: 72px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .stat-card,
        .panel,
        .task-card,
        .hero-card {
          border: 1px solid #ffffff12;
          border-radius: 19px;
          background: #131a2d;
        }

        .stat-card {
          padding: 20px;
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #a1a9c3;
          font-size: 12px;
          font-weight: 600;
        }

        .stat-icon {
          font-size: 21px;
        }

        .stat-value {
          margin: 13px 0 5px;
          font-family: "Space Grotesk", sans-serif;
          font-size: 30px;
          font-weight: 700;
        }

        .stat-note {
          color: #7f89a7;
          font-size: 11px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin: 30px 0 16px;
        }

        .section-heading h2 {
          margin: 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 22px;
          letter-spacing: -0.5px;
        }

        .section-heading p {
          margin: 5px 0 0;
          color: #8993b0;
          font-size: 13px;
        }

        .primary-button,
        .secondary-button,
        .danger-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 43px;
          padding: 11px 17px;
          border: 1px solid transparent;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          transition:
            transform 0.15s,
            filter 0.15s;
        }

        .primary-button {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          box-shadow: 0 5px 18px #6366f126;
        }

        .secondary-button {
          border-color: #ffffff18;
          background: #202840;
          color: #e1e5f7;
        }

        .danger-button {
          border-color: #ef444433;
          background: #ef444414;
          color: #fca5a5;
        }

        .primary-button:hover,
        .secondary-button:hover,
        .danger-button:hover {
          filter: brightness(1.12);
          transform: translateY(-1px);
        }

        .task-list {
          display: grid;
          gap: 12px;
        }

        .task-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 18px;
        }

        /* Completed tasks: green tint, thick strike-through, check icon. */
        .task-card.done {
          border-color: #34d39966;
          background: linear-gradient(115deg, #10241f, #131a2d);
        }

        .task-card.done .task-title {
          color: #7f89a7;
          text-decoration: line-through;
          text-decoration-thickness: 2px;
          text-decoration-color: #34d399;
        }

        .task-card.done .task-description {
          text-decoration: line-through;
          opacity: 0.6;
        }

        .task-card.done .task-subject-icon {
          background: #34d39922;
        }

        .task-subject-icon {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 49px;
          height: 49px;
          border-radius: 15px;
          background: #8b5cf61c;
          font-size: 24px;
        }

        .task-content {
          flex: 1;
          min-width: 0;
        }

        .task-title {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .task-description {
          margin: 5px 0 9px;
          color: #8993b0;
          font-size: 12px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .task-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 7px;
          background: #ffffff0a;
          color: #aeb7d1;
          font-size: 10px;
          font-weight: 700;
        }

        .tag.xp {
          background: #a78bfa1c;
          color: #c4b5fd;
        }

        .tag.coins {
          background: #fbbf2417;
          color: #fcd34d;
        }

        .tag.done {
          background: #34d39922;
          color: #6ee7b7;
        }

        .task-actions {
          display: flex;
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: 7px;
          justify-content: flex-end;
        }

        .icon-button {
          display: grid;
          place-items: center;
          width: 37px;
          height: 37px;
          border: 1px solid #ffffff14;
          border-radius: 10px;
          background: #202840;
          color: #d8def3;
          font-size: 15px;
        }

        .icon-button:hover {
          background: #343d59;
        }

        .small-button {
          min-height: 37px;
          padding: 9px 12px;
          font-size: 11px;
        }

        .empty-state {
          padding: 45px 20px;
          border: 1px dashed #ffffff22;
          border-radius: 18px;
          color: #9ca5c2;
          text-align: center;
        }

        .empty-state .empty-emoji {
          margin-bottom: 12px;
          font-size: 42px;
        }

        .empty-state h3 {
          margin: 0 0 8px;
          color: #f4f5ff;
        }

        .empty-state p {
          margin: 0 0 20px;
          font-size: 13px;
          line-height: 1.6;
        }

        .panel {
          padding: 24px;
          margin-bottom: 20px;
        }

        .progress-bar {
          height: 9px;
          overflow: hidden;
          border-radius: 99px;
          background: #252c43;
        }

        .progress-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #a78bfa, #6366f1);
          transition: width 0.3s;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin: 9px 0 0;
          color: #929bb7;
          font-size: 11px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
        }

        .hero-card {
          padding: 23px 17px;
          text-align: center;
        }

        .hero-card.selected {
          border-color: #a78bfa99;
          background: #272346;
        }

        .hero-emoji {
          margin-bottom: 13px;
          font-size: 48px;
        }

        .hero-card h3 {
          margin: 0 0 8px;
        }

        .hero-card p {
          min-height: 36px;
          margin: 0 0 17px;
          color: #9ca5c2;
          font-size: 12px;
          line-height: 1.5;
        }

        .hero-cost {
          margin-bottom: 14px;
          color: #fcd34d;
          font-size: 12px;
          font-weight: 800;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }

        .field,
        .select-field,
        .textarea-field {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #ffffff1a;
          border-radius: 11px;
          background: #0e1425;
          color: #f4f5ff;
          font-size: 13px;
        }

        .field::placeholder,
        .textarea-field::placeholder {
          color: #69738f;
        }

        .search-field {
          flex: 1;
          min-width: 180px;
        }

        .select-field {
          width: auto;
          min-width: 135px;
        }

        .modal-backdrop {
          position: fixed;
          z-index: 50;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 18px;
          overflow-y: auto;
          background: #050816d9;
          backdrop-filter: blur(7px);
        }

        .modal {
          width: min(500px, 100%);
          max-height: calc(100vh - 36px);
          overflow-y: auto;
          padding: 26px;
          border: 1px solid #ffffff20;
          border-radius: 22px;
          background: #171e32;
          box-shadow: 0 25px 100px #0008;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 23px;
        }

        .modal-header h2 {
          margin: 0;
          font-family: "Space Grotesk", sans-serif;
          font-size: 24px;
        }

        .modal-header p {
          margin: 6px 0 0;
          color: #9ca5c2;
          font-size: 12px;
          line-height: 1.6;
        }

        .close-button {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 35px;
          height: 35px;
          border: 1px solid #ffffff18;
          border-radius: 10px;
          background: #252d44;
          color: white;
          font-size: 19px;
        }

        .form-field {
          display: grid;
          gap: 8px;
          margin-bottom: 17px;
        }

        .form-field label {
          color: #d8def3;
          font-size: 12px;
          font-weight: 800;
        }

        .textarea-field {
          min-height: 88px;
          resize: vertical;
          line-height: 1.5;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        .form-error {
          padding: 11px 13px;
          margin-bottom: 16px;
          border: 1px solid #ef444444;
          border-radius: 10px;
          background: #ef444414;
          color: #fca5a5;
          font-size: 12px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 23px;
        }

        .footer-note {
          padding-top: 30px;
          color: #66708d;
          font-size: 11px;
          text-align: center;
        }

        .mobile-only {
          display: none;
        }

        @media (max-width: 760px) {
          .layout {
            padding: 19px 14px 40px;
          }

          .topbar {
            align-items: flex-start;
          }

          .top-stats {
            flex-direction: column;
            gap: 6px;
          }

          .pill {
            padding: 8px 10px;
            font-size: 11px;
          }

          .brand h1 {
            font-size: 19px;
          }

          .hero-banner {
            padding: 25px 20px;
          }

          .hero-avatar {
            width: 80px;
            height: 80px;
            border-radius: 24px;
            font-size: 45px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .stat-card {
            padding: 16px;
          }

          .stat-value {
            font-size: 25px;
          }

          .task-card {
            flex-wrap: wrap;
            padding: 14px;
          }

          .task-content {
            width: calc(100% - 65px);
            flex: initial;
          }

          .task-actions {
            width: 100%;
            justify-content: flex-start;
            padding-left: 64px;
          }

          .hero-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .section-heading h2 {
            font-size: 19px;
          }

          .section-heading .primary-button {
            padding: 10px 12px;
            font-size: 11px;
          }

          .panel {
            padding: 18px;
          }
        }

        @media (max-width: 420px) {
          .brand-icon {
            width: 40px;
            height: 40px;
          }

          .brand p {
            font-size: 10px;
          }

          .hero-avatar {
            width: 62px;
            height: 62px;
            font-size: 35px;
          }

          .hero-banner h2 {
            font-size: 27px;
          }

          .hero-banner p {
            font-size: 12px;
          }

          .hero-grid {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }
      `}</style>

      <div className="layout">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">⚔️</div>
            <div>
              <h1>Study Quest</h1>
              <p>Turn homework into an adventure</p>
            </div>
          </div>

          <div className="top-stats">
            <div className="pill">🪙 {coins} coins</div>
            <div className="pill">⭐ Level {level}</div>
            <button
              type="button"
              className="pill signout-button"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        </header>

        {syncError && (
          <div className="form-error" role="alert">
            ⚠️ Couldn't sync with Supabase: {syncError}
          </div>
        )}

        <nav className="navigation" aria-label="Main navigation">
          {[
            { name: "Home", icon: "🏠" },
            { name: "Homework", icon: "📚" },
            { name: "Heroes", icon: "🦸" },
            { name: "Stats", icon: "📊" },
          ].map((item) => (
            <button
              key={item.name}
              type="button"
              className={`nav-button ${
                activeTab === item.name ? "active" : ""
              }`}
              onClick={() => setActiveTab(item.name)}
            >
              {item.icon} {item.name}
            </button>
          ))}
        </nav>

        {activeTab === "Home" && (
          <>
            <section className="hero-banner">
              <div>
                <div className="eyebrow">Your adventure continues</div>
                <h2>Ready to level up?</h2>
                <p>
                  Every assignment is a quest. Finish your homework, earn
                  rewards, unlock heroes, and become a legendary scholar.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={openCreateForm}
                  >
                    ＋ Create Task
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setActiveTab("Homework")}
                  >
                    View quests →
                  </button>
                </div>
              </div>
              <div className="hero-avatar">
                {HEROES.find((hero) => hero.name === selectedHero)?.emoji ??
                  "🛡️"}
              </div>
            </section>

            <div className="stats-grid">
              <Stat
                icon="⭐"
                label="Total XP"
                value={totalXp}
                note={`${xpIntoLevel}/100 XP to next level`}
              />
              <Stat
                icon="📜"
                label="Quests left"
                value={pendingTasks}
                note="One step at a time"
              />
              <Stat
                icon="🔥"
                label="Quest streak"
                value={streak}
                note="Tasks completed"
              />
              <Stat
                icon="🏆"
                label="Completed"
                value={completedTasks}
                note="Achievements unlocked"
              />
            </div>

            <section className="panel">
              <div className="section-heading" style={{ marginTop: 0 }}>
                <div>
                  <h2>Level {level} · {getRank(level)}</h2>
                  <p>Keep earning XP to reach your next level.</p>
                </div>
                <span style={{ fontSize: 28 }}>✨</span>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${xpIntoLevel}%` }}
                />
              </div>
              <div className="progress-labels">
                <span>{xpIntoLevel} XP earned this level</span>
                <span>{100 - xpIntoLevel} XP to go</span>
              </div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Today's Quests</h2>
                <p>Your next steps toward becoming a study legend.</p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={openCreateForm}
              >
                ＋ Create Task
              </button>
            </div>

            <div className="task-list">
              {pendingTasks === 0 && (
                <EmptyState
                  emoji="🎉"
                  title="All quests complete!"
                  description="Amazing work! Create another task when you're ready for your next adventure."
                  buttonLabel="Create a task"
                  onButtonClick={openCreateForm}
                />
              )}

              {homeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => completeTask(task)}
                  onEdit={() => openEditForm(task)}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </div>
          </>
        )}

        {activeTab === "Homework" && (
          <>
            <div className="section-heading" style={{ marginTop: 0 }}>
              <div>
                <h2>Your Homework</h2>
                <p>Create quests, track progress, and collect rewards.</p>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={openCreateForm}
              >
                ＋ Create Task
              </button>
            </div>

            <div className="toolbar">
              <input
                className="field search-field"
                type="search"
                placeholder="🔎 Search your tasks..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="select-field"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter tasks"
              >
                <option>All</option>
                <option>To do</option>
                <option>Completed</option>
              </select>
            </div>

            <div className="task-list">
              {filteredTasks.length === 0 ? (
                <EmptyState
                  emoji={search || filter !== "All" ? "🔎" : "📜"}
                  title={
                    search || filter !== "All"
                      ? "No matching tasks"
                      : "Your quest board is empty"
                  }
                  description={
                    search || filter !== "All"
                      ? "Try a different search or filter."
                      : "Create your first homework quest and start earning XP."
                  }
                  buttonLabel="＋ Create Task"
                  onButtonClick={openCreateForm}
                />
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={() => completeTask(task)}
                    onEdit={() => openEditForm(task)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "Heroes" && (
          <>
            <div className="section-heading" style={{ marginTop: 0 }}>
              <div>
                <h2>Hero Collection</h2>
                <p>Spend your hard-earned coins to unlock new heroes.</p>
              </div>
              <div className="pill">🪙 {coins} coins</div>
            </div>

            <div className="hero-grid">
              {HEROES.map((hero) => {
                const unlocked = unlockedHeroes.includes(hero.name);
                const selected = selectedHero === hero.name;

                return (
                  <div
                    key={hero.name}
                    className={`hero-card ${selected ? "selected" : ""}`}
                  >
                    <div className="hero-emoji">{hero.emoji}</div>
                    <h3>{hero.name}</h3>
                    <p>{hero.description}</p>
                    <div className="hero-cost">
                      {unlocked ? "✓ Unlocked" : `🪙 ${hero.cost} coins`}
                    </div>
                    <button
                      type="button"
                      className={
                        selected ? "secondary-button" : "primary-button"
                      }
                      style={{ width: "100%" }}
                      disabled={selected}
                      onClick={() => buyOrSelectHero(hero)}
                    >
                      {selected
                        ? "Selected ✓"
                        : unlocked
                          ? "Choose hero"
                          : "Unlock hero"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "Stats" && (
          <>
            <div className="section-heading" style={{ marginTop: 0 }}>
              <div>
                <h2>Your Progress</h2>
                <p>Look how far your study adventure has taken you!</p>
              </div>
              <span style={{ fontSize: 30 }}>📊</span>
            </div>

            <section className="panel">
              <div className="eyebrow">Current rank</div>
              <h2 style={{ margin: "9px 0", fontSize: 28 }}>
                {getRank(level)}
              </h2>
              <p style={{ color: "#9ca5c2", fontSize: 13 }}>
                Level {level} · {totalXp} total XP
              </p>
              <div className="progress-bar" style={{ marginTop: 20 }}>
                <div
                  className="progress-fill"
                  style={{ width: `${xpIntoLevel}%` }}
                />
              </div>
              <div className="progress-labels">
                <span>Level {level}</span>
                <span>Level {level + 1}</span>
              </div>
            </section>

            <div className="stats-grid">
              <Stat
                icon="⭐"
                label="Total XP"
                value={totalXp}
                note="Experience earned"
              />
              <Stat
                icon="🪙"
                label="Coins"
                value={coins}
                note="Available to spend"
              />
              <Stat
                icon="✅"
                label="Completed tasks"
                value={completedTasks}
                note="Quests conquered"
              />
              <Stat
                icon="🦸"
                label="Heroes unlocked"
                value={unlockedHeroes.length}
                note={`Out of ${HEROES.length} heroes`}
              />
            </div>

            <section className="panel">
              <h3 style={{ marginTop: 0 }}>🏅 Your achievements</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                  marginTop: 18,
                }}
              >
                {[
                  {
                    emoji: "🌱",
                    name: "First Steps",
                    description: "Reach level 2",
                    earned: level >= 2,
                  },
                  {
                    emoji: "📚",
                    name: "Bookworm",
                    description: "Complete 5 tasks",
                    earned: completedTasks >= 5,
                  },
                  {
                    emoji: "🔥",
                    name: "On a Roll",
                    description: "Complete 10 tasks",
                    earned: completedTasks >= 10,
                  },
                  {
                    emoji: "👑",
                    name: "Legend",
                    description: "Reach level 10",
                    earned: level >= 10,
                  },
                ].map((achievement) => (
                  <div
                    key={achievement.name}
                    style={{
                      padding: 15,
                      borderRadius: 13,
                      background: achievement.earned ? "#a78bfa1c" : "#ffffff06",
                      border: `1px solid ${
                        achievement.earned ? "#a78bfa55" : "#ffffff10"
                      }`,
                      opacity: achievement.earned ? 1 : 0.55,
                    }}
                  >
                    <div style={{ fontSize: 27 }}>{achievement.emoji}</div>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 9,
                        fontSize: 13,
                      }}
                    >
                      {achievement.name}
                    </strong>
                    <p
                      style={{
                        color: "#9ca5c2",
                        fontSize: 11,
                        marginBottom: 0,
                      }}
                    >
                      {achievement.earned
                        ? "Unlocked!"
                        : achievement.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3 style={{ marginTop: 0 }}>⚙️ Game settings</h3>
              <p style={{ color: "#9ca5c2", fontSize: 13, lineHeight: 1.7 }}>
                Reset your tasks, XP, coins, and heroes to start a brand-new
                adventure. This action cannot be undone.
              </p>
              <button
                type="button"
                className="danger-button"
                onClick={resetProgress}
              >
                Reset all progress
              </button>
            </section>
          </>
        )}

        <footer className="footer-note">
          Study Quest RPG · Small steps. Big adventures. ✨
        </footer>
      </div>

      {showTaskForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTaskForm();
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-form-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="task-form-title">
                  {editingTaskId ? "Edit Quest ✏️" : "Create a Quest ✨"}
                </h2>
                <p>
                  {editingTaskId
                    ? "Update the details of your homework."
                    : "Add your homework and choose your reward."}
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Close form"
                onClick={closeTaskForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleTaskSubmit}>
              <div className="form-field">
                <label htmlFor="task-title">Task title *</label>
                <input
                  id="task-title"
                  className="field"
                  type="text"
                  placeholder="e.g. Finish maths worksheet"
                  value={form.title}
                  onChange={(event) => {
                    setForm({ ...form, title: event.target.value });
                    setFormError("");
                  }}
                  maxLength={100}
                  autoFocus
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="task-description">
                  Description (optional)
                </label>
                <textarea
                  id="task-description"
                  className="textarea-field"
                  placeholder="What do you need to do?"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="task-subject">Subject</label>
                  <select
                    id="task-subject"
                    className="select-field"
                    style={{ width: "100%" }}
                    value={form.subject}
                    onChange={(event) =>
                      setForm({ ...form, subject: event.target.value })
                    }
                  >
                    {SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="task-xp">XP reward</label>
                  <input
                    id="task-xp"
                    className="field"
                    type="number"
                    min={5}
                    max={100}
                    step={5}
                    value={form.xp}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        xp: Number(event.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 13,
                  borderRadius: 11,
                  background: "#a78bfa12",
                  color: "#c4b5fd",
                  fontSize: 12,
                }}
              >
                🎁 Completing this quest earns{" "}
                <strong>{Math.round((Number(form.xp) || 0) / 2)} coins</strong>{" "}
                and up to <strong>{Number(form.xp) || 0} XP</strong>.
              </div>

              {formError && (
                <div className="form-error" role="alert">
                  {formError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeTaskForm}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {editingTaskId ? "Save Changes" : "＋ Create Task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
}: {
  icon: string;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const subjectEmojis: Record<string, string> = {
    Maths: "🔢",
    English: "📖",
    Science: "🧪",
    History: "🏛️",
    Geography: "🌍",
    Language: "💬",
    Art: "🎨",
    Other: "📝",
  };

  return (
    <article className={`task-card ${task.completed ? "done" : ""}`}>
      <div className="task-subject-icon">
        {task.completed ? "✅" : (subjectEmojis[task.subject] ?? "📝")}
      </div>

      <div className="task-content">
        <h3 className="task-title">{task.title}</h3>
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}
        <div className="task-meta">
          <span className="tag">{task.subject}</span>
          <span className="tag xp">⭐ {task.xp} XP</span>
          <span className="tag coins">🪙 {task.coins} coins</span>
          {task.completed && <span className="tag done">✓ Completed</span>}
        </div>
      </div>

      <div className="task-actions">
        {!task.completed && (
          <button
            type="button"
            className="primary-button small-button"
            onClick={onComplete}
          >
            ✓ Complete
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={onEdit}
          aria-label={`Edit ${task.title}`}
          title="Edit task"
        >
          ✏️
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onDelete}
          aria-label={`Delete ${task.title}`}
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </article>
  );
}

function EmptyState({
  emoji,
  title,
  description,
  buttonLabel,
  onButtonClick,
}: {
  emoji: string;
  title: string;
  description: string;
  buttonLabel: string;
  onButtonClick: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <button
        type="button"
        className="primary-button"
        onClick={onButtonClick}
      >
        {buttonLabel}
      </button>
    </div>
  );
}