import { createServiceClient } from "@/lib/supabase/server";
import { todayInSAST, addDays } from "@/lib/utils/date";
import { adjustFitnessPlan } from "@/lib/ai/router";
import { syncSessionsFromPlan, renderPlanMarkdown } from "@/lib/fitness/sessions";
import type { FitnessPlanData } from "@/lib/fitness/types";
import type { ParsedIntent, DomainRow } from "./types";
import type { Priority, TaskStatus, Database } from "@/types/database";

type TaskRow    = Database["public"]["Tables"]["tasks"]["Row"];
type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

const DOMAIN_EMOJI: Record<string, string> = {
  fitness: "🏋️",
  personal: "👤",
  consulting: "💼",
  corporate: "🏢",
};

const STATUS_EMOJI: Record<string, string> = {
  todo: "📋",
  "in-progress": "🔄",
  completed: "✅",
  cancelled: "❌",
};

function domainName(domainId: string, domains: DomainRow[]): string {
  return domains.find((d) => d.id === domainId)?.name ?? "?";
}

function calcPlanEndDate(startDate: string, totalWeeks: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + totalWeeks * 7 - 1);
  return d.toISOString().split("T")[0];
}

export async function executeIntent(
  parsed: ParsedIntent,
  userId: string,
  domains: DomainRow[]
): Promise<string> {
  const supabase = createServiceClient();

  switch (parsed.intent) {
    // ── CREATE TASK ─────────────────────────────────────────────────
    case "create-task": {
      const d = parsed.data as {
        title: string;
        domain_id?: string;
        priority?: Priority;
        due_date?: string | null;
        due_time?: string | null;
        description?: string | null;
      };

      const domain =
        domains.find((x) => x.id === d.domain_id) ||
        domains.find((x) => x.name === "personal") ||
        domains[0];

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: d.title,
          domain_id: domain.id,
          priority: d.priority ?? "medium",
          due_date: d.due_date ?? null,
          due_time: d.due_time ?? null,
          description: d.description ?? null,
          status: "todo",
          created_via: "telegram",
        })
        .select()
        .single();

      if (error) throw new Error(`create-task: ${error.message}`);
      const t = task as TaskRow;

      const emoji = DOMAIN_EMOJI[domain.name] ?? "📋";
      const dueStr = t.due_date ? ` · due ${t.due_date}` : "";
      return `✅ Task created\n*${t.title}*\n${emoji} ${domain.name}${dueStr} · ${t.priority}`;
    }

    // ── QUERY ────────────────────────────────────────────────────────
    case "query": {
      const d = parsed.data as { type?: string };
      const today = todayInSAST();

      if (!d.type || d.type === "today") {
        const { data: tasks } = await supabase
          .from("tasks")
          .select()
          .lte("due_date", today)
          .not("status", "in", '("completed","cancelled")')
          .order("escalation_count", { ascending: false })
          .order("due_date", { ascending: true })
          .limit(15);

        if (!tasks?.length) return "📭 No tasks for today. Clear day!";

        const lines = (tasks as TaskRow[]).map((t) => {
          const dn = domainName(t.domain_id, domains);
          const flag =
            (t.escalation_count ?? 0) >= 3
              ? " 🔴"
              : (t.escalation_count ?? 0) >= 1
              ? " 🟡"
              : "";
          return `• ${t.title} [${dn}]${flag}`;
        });
        return `📋 *Today (${tasks.length})*\n${lines.join("\n")}`;
      }

      if (d.type === "upcoming") {
        const in7 = addDays(today, 7);
        const { data: tasks } = await supabase
          .from("tasks")
          .select()
          .gt("due_date", today)
          .lte("due_date", in7)
          .not("status", "in", '("completed","cancelled")')
          .order("due_date", { ascending: true })
          .limit(15);

        if (!tasks?.length) return "📭 Nothing due in the next 7 days.";
        const lines = (tasks as TaskRow[]).map(
          (t) => `• ${t.due_date} — ${t.title}`
        );
        return `📅 *Upcoming — next 7 days (${tasks.length})*\n${lines.join("\n")}`;
      }

      if (d.type === "overdue") {
        const { data: tasks } = await supabase
          .from("tasks")
          .select()
          .lt("due_date", today)
          .not("status", "in", '("completed","cancelled")')
          .order("due_date", { ascending: true })
          .limit(15);

        if (!tasks?.length) return "🎉 No overdue tasks!";
        const lines = (tasks as TaskRow[]).map(
          (t) => `• ${t.due_date} — ${t.title} (×${t.escalation_count ?? 0})`
        );
        return `⚠️ *Overdue (${tasks.length})*\n${lines.join("\n")}`;
      }

      if (d.type === "projects") {
        const { data: projects } = await supabase
          .from("projects")
          .select()
          .in("status", ["active", "paused"])
          .order("updated_at", { ascending: false })
          .limit(10);

        if (!projects?.length) return "📭 No active projects.";
        const lines = (projects as ProjectRow[]).map((p) => {
          const dn = domainName(p.domain_id, domains);
          const emoji = DOMAIN_EMOJI[dn] ?? "🗂";
          return `• ${emoji} *${p.title}* [${p.status}]`;
        });
        return `🗂 *Active projects (${projects.length})*\n${lines.join("\n")}`;
      }

      return "What would you like to query? Try 'today', 'upcoming', 'overdue', or 'projects'.";
    }

    // ── STATUS UPDATE ────────────────────────────────────────────────
    case "status-update": {
      const d = parsed.data as { task_search: string; new_status: TaskStatus };

      const { data: tasks } = await supabase
        .from("tasks")
        .select()
        .ilike("title", `%${d.task_search}%`)
        .not("status", "in", '("completed","cancelled")')
        .order("created_at", { ascending: false })
        .limit(1);

      if (!tasks?.length) {
        return `Couldn't find a task matching "${d.task_search}". Try listing today's tasks first.`;
      }

      const task = tasks[0] as TaskRow;
      const updates = {
        status: d.new_status,
        ...(d.new_status === "completed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      };

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) throw new Error(`status-update: ${error.message}`);

      const emoji = STATUS_EMOJI[d.new_status] ?? "📋";
      return `${emoji} Marked *${task.title}* as ${d.new_status}.`;
    }

    // ── UPDATE TASK ──────────────────────────────────────────────────
    case "update-task": {
      const d = parsed.data as {
        task_search: string;
        changes: Record<string, unknown>;
      };

      const { data: tasks } = await supabase
        .from("tasks")
        .select()
        .ilike("title", `%${d.task_search}%`)
        .not("status", "in", '("completed","cancelled")')
        .order("created_at", { ascending: false })
        .limit(1);

      if (!tasks?.length) {
        return `Couldn't find a task matching "${d.task_search}".`;
      }

      const task = tasks[0] as TaskRow;
      const { error } = await supabase
        .from("tasks")
        .update(d.changes as TaskUpdate)
        .eq("id", task.id);

      if (error) throw new Error(`update-task: ${error.message}`);

      const changeStr = Object.entries(d.changes)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `✏️ Updated *${task.title}*\n${changeStr}`;
    }

    // ── ADJUST PLAN (project) ────────────────────────────────────────
    case "adjust-plan": {
      const d = parsed.data as {
        project_search: string;
        changes: Record<string, unknown>;
      };

      const { data: projects } = await supabase
        .from("projects")
        .select()
        .ilike("title", `%${d.project_search}%`)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!projects?.length) {
        return `Couldn't find a project matching "${d.project_search}".`;
      }

      const project = projects[0] as ProjectRow;
      const { error } = await supabase
        .from("projects")
        .update(d.changes as ProjectUpdate)
        .eq("id", project.id);

      if (error) throw new Error(`adjust-plan: ${error.message}`);

      const changeStr = Object.entries(d.changes)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `✏️ Updated *${project.title}*\n${changeStr}`;
    }

    // ── ADJUST FITNESS PLAN ──────────────────────────────────────────
    case "adjust-fitness-plan": {
      const d = parsed.data as { instruction: string };

      // Find the active fitness plan
      const { data: plan, error: planErr } = await supabase
        .from("fitness_plans")
        .select()
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (planErr) throw new Error(`adjust-fitness-plan fetch: ${planErr.message}`);
      if (!plan) return "No active fitness plan found. Upload a training plan first.";

      const currentPlanData = plan.structured_data as unknown as FitnessPlanData;

      // Let Claude Sonnet apply the adjustment
      const result = await adjustFitnessPlan(
        currentPlanData,
        d.instruction,
        plan.start_date
      );

      const newStartDate = result.new_start_date ?? plan.start_date;

      // Persist updated plan
      const { error: updateErr } = await supabase
        .from("fitness_plans")
        .update({
          structured_data: result.plan as unknown as Record<string, unknown>,
          start_date: newStartDate,
          end_date: calcPlanEndDate(newStartDate, result.plan.meta.total_weeks),
        })
        .eq("id", plan.id);

      if (updateErr) throw new Error(`adjust-fitness-plan update: ${updateErr.message}`);

      // Re-sync all upcoming sessions
      await syncSessionsFromPlan(plan.id, newStartDate, result.plan);

      const markdown = renderPlanMarkdown(result.plan, newStartDate);
      return `🏋️ *Plan adjusted*\n${result.summary}\n\n${markdown}`;
    }

    // ── GENERAL ──────────────────────────────────────────────────────
    case "general":
    default:
      return (
        parsed.reply ??
        "Got it! You can ask me to add tasks, check what's due today, or mark things as done."
      );
  }
}
