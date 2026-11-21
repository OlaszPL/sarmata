
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "employees": {
                  Row: {
                    "appointment_year": number | null,"created_at": string,"email": string | null,"employment_basis": Database["public"]['Enums']["employment_basis"],"employment_ended_on": string | null,"employment_start": string | null,"first_name": string,"grade": number | null,"grade_granted_on": string | null,"id": string,"last_name": string,"office_id": string,"org_unit": string | null,"position_kind": Database["public"]['Enums']["position_kind"],"position_title": string | null,"service_status": Database["public"]['Enums']["service_status"],"supervisor_employee_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_year"?: number | null,"created_at"?: string,"email"?: string | null,"employment_basis"?: Database["public"]['Enums']["employment_basis"],"employment_ended_on"?: string | null,"employment_start"?: string | null,"first_name": string,"grade"?: number | null,"grade_granted_on"?: string | null,"id"?: string,"last_name": string,"office_id": string,"org_unit"?: string | null,"position_kind"?: Database["public"]['Enums']["position_kind"],"position_title"?: string | null,"service_status"?: Database["public"]['Enums']["service_status"],"supervisor_employee_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "appointment_year"?: number | null,"created_at"?: string,"email"?: string | null,"employment_basis"?: Database["public"]['Enums']["employment_basis"],"employment_ended_on"?: string | null,"employment_start"?: string | null,"first_name"?: string,"grade"?: number | null,"grade_granted_on"?: string | null,"id"?: string,"last_name"?: string,"office_id"?: string,"org_unit"?: string | null,"position_kind"?: Database["public"]['Enums']["position_kind"],"position_title"?: string | null,"service_status"?: Database["public"]['Enums']["service_status"],"supervisor_employee_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employees_supervisor_fkey"
      columns: ["supervisor_employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "employees_user_id_office_id_fkey"
      columns: ["user_id","office_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["user_id","office_id"]
    }
                  ]
                },"evaluation_deadlines": {
                  Row: {
                    "computed_at": string,"due_on": string | null,"evaluation_id": string,"office_id": string,"slot": string,"suspended_since": string | null,"window_start": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"due_on"?: string | null,"evaluation_id": string,"office_id": string,"slot": string,"suspended_since"?: string | null,"window_start"?: string | null
                  }
                  Update: {
                    "computed_at"?: string,"due_on"?: string | null,"evaluation_id"?: string,"office_id"?: string,"slot"?: string,"suspended_since"?: string | null,"window_start"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_deadlines_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    }
                  ]
                },"evaluation_events": {
                  Row: {
                    "evaluation_id": string,"id": string,"kind": Database["public"]['Enums']["evaluation_event_kind"],"occurred_on": string,"office_id": string,"payload": NonNullable<Json>,"recorded_at": string,"recorded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evaluation_id": string,"id"?: string,"kind": Database["public"]['Enums']["evaluation_event_kind"],"occurred_on": string,"office_id": string,"payload"?: NonNullable<Json>,"recorded_at"?: string,"recorded_by"?: string
                  }
                  Update: {
                    "evaluation_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["evaluation_event_kind"],"occurred_on"?: string,"office_id"?: string,"payload"?: NonNullable<Json>,"recorded_at"?: string,"recorded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_events_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    }
                  ]
                },"evaluation_sheets": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"created_by": string,"evaluation_id": string,"id": string,"office_id": string,"reason": string | null,"state": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"created_by"?: string,"evaluation_id": string,"id"?: string,"office_id": string,"reason"?: string | null,"state": string,"version": number
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"evaluation_id"?: string,"id"?: string,"office_id"?: string,"reason"?: string | null,"state"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_sheets_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    }
                  ]
                },"evaluations": {
                  Row: {
                    "after_negative": boolean,"created_at": string,"created_by": string,"cycle_start": string,"employee_id": string,"evaluator_account_id": string,"id": string,"office_id": string,"previous_evaluation_id": string | null,"regulation_version_id": string,"sheet_id": string,"snapshot": NonNullable<Json>,"status": Database["public"]['Enums']["evaluation_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "after_negative"?: boolean,"created_at"?: string,"created_by"?: string,"cycle_start": string,"employee_id": string,"evaluator_account_id": string,"id"?: string,"office_id": string,"previous_evaluation_id"?: string | null,"regulation_version_id": string,"sheet_id": string,"snapshot": NonNullable<Json>,"status"?: Database["public"]['Enums']["evaluation_status"]
                  }
                  Update: {
                    "after_negative"?: boolean,"created_at"?: string,"created_by"?: string,"cycle_start"?: string,"employee_id"?: string,"evaluator_account_id"?: string,"id"?: string,"office_id"?: string,"previous_evaluation_id"?: string | null,"regulation_version_id"?: string,"sheet_id"?: string,"snapshot"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["evaluation_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluations_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "evaluations_evaluator_fkey"
      columns: ["evaluator_account_id","office_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["user_id","office_id"]
    },{
      foreignKeyName: "evaluations_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluations_previous_fkey"
      columns: ["previous_evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "evaluations_regulation_version_id_fkey"
      columns: ["regulation_version_id"]
isOneToOne: false
      referencedRelation: "regulation_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"office_id": string,"role": Database["public"]['Enums']["office_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"office_id": string,"role": Database["public"]['Enums']["office_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"office_id"?: string,"role"?: Database["public"]['Enums']["office_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"offices": {
                  Row: {
                    "created_at": string,"evaluation_visibility": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evaluation_visibility"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"evaluation_visibility"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regulation_versions": {
                  Row: {
                    "based_on": string | null,"code": string,"created_at": string,"document": NonNullable<Json>,"effective_from": string,"id": string,"is_official": boolean,"office_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "based_on"?: string | null,"code": string,"created_at"?: string,"document": NonNullable<Json>,"effective_from": string,"id"?: string,"is_official": boolean,"office_id"?: string | null
                  }
                  Update: {
                    "based_on"?: string | null,"code"?: string,"created_at"?: string,"document"?: NonNullable<Json>,"effective_from"?: string,"id"?: string,"is_official"?: boolean,"office_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "regulation_versions_based_on_fkey"
      columns: ["based_on"]
isOneToOne: false
      referencedRelation: "regulation_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "regulation_versions_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_evaluation_transition":
{ Args: { "p_evaluation_id": string,"p_event_kind": Database["public"]['Enums']["evaluation_event_kind"],"p_expected_status": Database["public"]['Enums']["evaluation_status"],"p_lock_sheet": boolean,"p_next_status": Database["public"]['Enums']["evaluation_status"],"p_occurred_on": string,"p_payload": Json }; Returns: string
                           },
"evaluation_transitions":
{ Args: Record<PropertyKey, never>; Returns: {
              "event_kind": Database["public"]['Enums']["evaluation_event_kind"],"from_status": Database["public"]['Enums']["evaluation_status"],"lock_sheet": boolean,"to_status": Database["public"]['Enums']["evaluation_status"]
            }[]
                           },
"find_similar_employees":
{ Args: { "max_results"?: number,"search": string }; Returns: {
              "first_name": string,"id": string,"last_name": string,"org_unit": string,"position_title": string,"score": number
            }[]
                           },
"job_queue_archive":
{ Args: { "message_id": number }; Returns: boolean
                           },
"job_queue_read":
{ Args: { "batch_size": number,"visibility_timeout_seconds": number }; Returns: {
              "enqueued_at": string,"message": Json,"message_id": number,"read_count": number
            }[]
                           },
"job_queue_send":
{ Args: { "delay_seconds"?: number,"message": Json }; Returns: number
                           },
"start_evaluation":
{ Args: { "p_after_negative": boolean,"p_content": Json,"p_cycle_start": string,"p_employee_id": string,"p_evaluator_account_id": string,"p_previous_acquainted_on": string,"p_previous_evaluation_id": string,"p_regulation_version_id": string,"p_sheet_id": string,"p_snapshot": Json }; Returns: string
                           }
          }
          Enums: {
            "employment_basis": "indefinite"|"appointment"|"fixed_term","evaluation_event_kind": "created"|"part_one_approved"|"part_one_signed"|"evaluation_interview_held"|"sheet_approved"|"acquainted"|"signature_refused"|"closed"|"objection_filed"|"objection_outcome"|"absence"|"term_changed"|"evaluator_changed"|"position_changed"|"correction"|"interrupted","evaluation_status": "criteria"|"criteria_awaiting_signature"|"period"|"interview"|"drafted"|"delivered"|"closed"|"objection"|"interrupted","office_role": "admin"|"hr"|"evaluator","position_kind": "office_head"|"manages_people"|"other","service_status": "civil_servant"|"employee"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "employment_basis": ["indefinite", "appointment", "fixed_term"],"evaluation_event_kind": ["created", "part_one_approved", "part_one_signed", "evaluation_interview_held", "sheet_approved", "acquainted", "signature_refused", "closed", "objection_filed", "objection_outcome", "absence", "term_changed", "evaluator_changed", "position_changed", "correction", "interrupted"],"evaluation_status": ["criteria", "criteria_awaiting_signature", "period", "interview", "drafted", "delivered", "closed", "objection", "interrupted"],"office_role": ["admin", "hr", "evaluator"],"position_kind": ["office_head", "manages_people", "other"],"service_status": ["civil_servant", "employee"]
          }
        }
} as const
