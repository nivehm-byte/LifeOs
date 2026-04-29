// Typed structure for fitness_plans.structured_data JSONB column.
// Also used as the interchange format between the AI parser/adjuster
// and the fitness_sessions table sync.

export interface PlanExercise {
  name: string;
  category: "strength" | "cardio" | "mobility";
  sets?: number;
  reps?: string;          // "8-12" or "10"
  weight_kg?: number;
  distance_km?: number;
  duration_min?: number;
  rest_seconds?: number;
  notes?: string;
}

export interface PlanSession {
  day_of_week: number;    // 0 = Sunday … 6 = Saturday
  day_label?: string;     // "Monday" — for human readability
  session_type: "gym" | "run";
  title?: string;         // "Push Day A", "Tempo Run"
  exercises: PlanExercise[];
  notes?: string;
}

export interface PlanWeek {
  week_number: number;
  theme?: string;         // "Volume", "Deload", "Peak"
  sessions: PlanSession[];
}

export interface FitnessPlanData {
  meta: {
    title: string;
    total_weeks: number;
    sessions_per_week: number;
    goal?: string;
    notes?: string;
  };
  weeks: PlanWeek[];
}

export interface AdjustmentResult {
  plan: FitnessPlanData;
  summary: string;
  new_start_date: string | null; // YYYY-MM-DD if start date should change
}
