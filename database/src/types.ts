
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "account_invitations": {
                  Row: {
                    "account_id": string | null,"email": string,"employee_id": string | null,"error": string | null,"error_code": string | null,"finished_at": string | null,"first_name": string,"id": string,"last_name": string,"mode": Database["public"]['Enums']["account_invitation_mode"] | null,"office_id": string,"requested_at": string,"requested_by": string,"role": Database["public"]['Enums']["office_role"],"status": Database["public"]['Enums']["account_invitation_status"],"temporary_password": string | null,"temporary_password_set": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"email": string,"employee_id"?: string | null,"error"?: string | null,"error_code"?: string | null,"finished_at"?: string | null,"first_name": string,"id"?: string,"last_name": string,"mode"?: Database["public"]['Enums']["account_invitation_mode"] | null,"office_id"?: string,"requested_at"?: string,"requested_by"?: string,"role": Database["public"]['Enums']["office_role"],"status"?: Database["public"]['Enums']["account_invitation_status"],"temporary_password"?: string | null,"temporary_password_set"?: boolean
                  }
                  Update: {
                    "account_id"?: string | null,"email"?: string,"employee_id"?: string | null,"error"?: string | null,"error_code"?: string | null,"finished_at"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"mode"?: Database["public"]['Enums']["account_invitation_mode"] | null,"office_id"?: string,"requested_at"?: string,"requested_by"?: string,"role"?: Database["public"]['Enums']["office_role"],"status"?: Database["public"]['Enums']["account_invitation_status"],"temporary_password"?: string | null,"temporary_password_set"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_invitations_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_fragment_decisions": {
                  Row: {
                    "content_deleted_at": string | null,"decided_at": string,"decided_by": string,"decision": string,"final_text": string | null,"fragment": string,"id": string,"office_id": string,"run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content_deleted_at"?: string | null,"decided_at"?: string,"decided_by"?: string,"decision": string,"final_text"?: string | null,"fragment": string,"id"?: string,"office_id"?: string,"run_id": string
                  }
                  Update: {
                    "content_deleted_at"?: string | null,"decided_at"?: string,"decided_by"?: string,"decision"?: string,"final_text"?: string | null,"fragment"?: string,"id"?: string,"office_id"?: string,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_fragment_decisions_run_fkey"
      columns: ["run_id","office_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id","office_id"]
    }
                  ]
                },"ai_runs": {
                  Row: {
                    "content_deleted_at": string | null,"employee_id": string | null,"evaluation_id": string | null,"failure_message": string | null,"failure_reason": string | null,"finished_at": string | null,"id": string,"input": Json | null,"input_refs": NonNullable<Json>,"kind": Database["public"]['Enums']["ai_run_kind"],"model": string | null,"office_id": string,"output": Json | null,"output_tokens": number | null,"partial_output": Json | null,"partial_text": string | null,"progress_updated_at": string | null,"prompt_version": string | null,"requested_at": string,"requested_by": string,"started_at": string | null,"status": Database["public"]['Enums']["ai_run_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "content_deleted_at"?: string | null,"employee_id"?: string | null,"evaluation_id"?: string | null,"failure_message"?: string | null,"failure_reason"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: Json | null,"input_refs"?: NonNullable<Json>,"kind": Database["public"]['Enums']["ai_run_kind"],"model"?: string | null,"office_id"?: string,"output"?: Json | null,"output_tokens"?: number | null,"partial_output"?: Json | null,"partial_text"?: string | null,"progress_updated_at"?: string | null,"prompt_version"?: string | null,"requested_at"?: string,"requested_by"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["ai_run_status"]
                  }
                  Update: {
                    "content_deleted_at"?: string | null,"employee_id"?: string | null,"evaluation_id"?: string | null,"failure_message"?: string | null,"failure_reason"?: string | null,"finished_at"?: string | null,"id"?: string,"input"?: Json | null,"input_refs"?: NonNullable<Json>,"kind"?: Database["public"]['Enums']["ai_run_kind"],"model"?: string | null,"office_id"?: string,"output"?: Json | null,"output_tokens"?: number | null,"partial_output"?: Json | null,"partial_text"?: string | null,"progress_updated_at"?: string | null,"prompt_version"?: string | null,"requested_at"?: string,"requested_by"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["ai_run_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_runs_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "ai_runs_evaluation_id_fkey"
      columns: ["evaluation_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_runs_evaluation_id_fkey"
      columns: ["evaluation_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id"]
    },{
      foreignKeyName: "ai_runs_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"archived_evaluations": {
                  Row: {
                    "acquainted_on": string | null,"created_at": string,"created_by": string,"drafted_on": string,"employee_id": string,"id": string,"level_code": string | null,"office_id": string,"outcome": string | null,"ratings": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acquainted_on"?: string | null,"created_at"?: string,"created_by"?: string,"drafted_on": string,"employee_id": string,"id"?: string,"level_code"?: string | null,"office_id": string,"outcome"?: string | null,"ratings"?: Json | null
                  }
                  Update: {
                    "acquainted_on"?: string | null,"created_at"?: string,"created_by"?: string,"drafted_on"?: string,"employee_id"?: string,"id"?: string,"level_code"?: string | null,"office_id"?: string,"outcome"?: string | null,"ratings"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "archived_evaluations_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "archived_evaluations_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"employee_retention": {
                  Row: {
                    "archive_exported_at": string | null,"archive_exported_by": string | null,"created_at": string,"employee_id": string,"office_id": string,"retained_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archive_exported_at"?: string | null,"archive_exported_by"?: string | null,"created_at"?: string,"employee_id": string,"office_id": string,"retained_until": string
                  }
                  Update: {
                    "archive_exported_at"?: string | null,"archive_exported_by"?: string | null,"created_at"?: string,"employee_id"?: string,"office_id"?: string,"retained_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_retention_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "anonymized_at": string | null,"appointment_year": number | null,"created_at": string,"email": string | null,"employment_basis": Database["public"]['Enums']["employment_basis"],"employment_ended_on": string | null,"employment_start": string | null,"first_name": string,"grade": number | null,"grade_granted_on": string | null,"id": string,"last_name": string,"office_id": string,"org_unit": string | null,"position_kind": Database["public"]['Enums']["position_kind"],"position_title": string | null,"service_status": Database["public"]['Enums']["service_status"],"supervisor_employee_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymized_at"?: string | null,"appointment_year"?: number | null,"created_at"?: string,"email"?: string | null,"employment_basis"?: Database["public"]['Enums']["employment_basis"],"employment_ended_on"?: string | null,"employment_start"?: string | null,"first_name": string,"grade"?: number | null,"grade_granted_on"?: string | null,"id"?: string,"last_name": string,"office_id": string,"org_unit"?: string | null,"position_kind"?: Database["public"]['Enums']["position_kind"],"position_title"?: string | null,"service_status"?: Database["public"]['Enums']["service_status"],"supervisor_employee_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "anonymized_at"?: string | null,"appointment_year"?: number | null,"created_at"?: string,"email"?: string | null,"employment_basis"?: Database["public"]['Enums']["employment_basis"],"employment_ended_on"?: string | null,"employment_start"?: string | null,"first_name"?: string,"grade"?: number | null,"grade_granted_on"?: string | null,"id"?: string,"last_name"?: string,"office_id"?: string,"org_unit"?: string | null,"position_kind"?: Database["public"]['Enums']["position_kind"],"position_title"?: string | null,"service_status"?: Database["public"]['Enums']["service_status"],"supervisor_employee_id"?: string | null,"user_id"?: string | null
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
    },{
      foreignKeyName: "evaluation_deadlines_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
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
    },{
      foreignKeyName: "evaluation_events_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
    }
                  ]
                },"evaluation_results": {
                  Row: {
                    "computed_at": string,"evaluation_id": string,"grade_by_law_due_on": string | null,"level_code": string | null,"mean": number | null,"office_id": string,"outcome": string | null,"second_consecutive_negative": boolean,"sheet_version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"evaluation_id": string,"grade_by_law_due_on"?: string | null,"level_code"?: string | null,"mean"?: number | null,"office_id": string,"outcome"?: string | null,"second_consecutive_negative": boolean,"sheet_version": number
                  }
                  Update: {
                    "computed_at"?: string,"evaluation_id"?: string,"grade_by_law_due_on"?: string | null,"level_code"?: string | null,"mean"?: number | null,"office_id"?: string,"outcome"?: string | null,"second_consecutive_negative"?: boolean,"sheet_version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_results_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "evaluation_results_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
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
    },{
      foreignKeyName: "evaluation_sheets_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
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
      foreignKeyName: "evaluations_previous_fkey"
      columns: ["previous_evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
    },{
      foreignKeyName: "evaluations_regulation_version_id_fkey"
      columns: ["regulation_version_id"]
isOneToOne: false
      referencedRelation: "regulation_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"grade_grants": {
                  Row: {
                    "basis": string,"employee_id": string,"evaluation_id": string | null,"granted_on": string,"id": string,"new_grade": number,"office_id": string,"previous_grade": number | null,"recorded_at": string,"recorded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "basis": string,"employee_id": string,"evaluation_id"?: string | null,"granted_on": string,"id"?: string,"new_grade": number,"office_id": string,"previous_grade"?: number | null,"recorded_at"?: string,"recorded_by"?: string
                  }
                  Update: {
                    "basis"?: string,"employee_id"?: string,"evaluation_id"?: string | null,"granted_on"?: string,"id"?: string,"new_grade"?: number,"office_id"?: string,"previous_grade"?: number | null,"recorded_at"?: string,"recorded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grade_grants_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "grade_grants_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "grade_grants_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
    },{
      foreignKeyName: "grade_grants_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"ended_on": string | null,"office_id": string,"role": Database["public"]['Enums']["office_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_on"?: string | null,"office_id": string,"role": Database["public"]['Enums']["office_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ended_on"?: string | null,"office_id"?: string,"role"?: Database["public"]['Enums']["office_role"],"user_id"?: string
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
                },"note_versions": {
                  Row: {
                    "body": string,"communicated": boolean,"criterion_id": string | null,"kind": Database["public"]['Enums']["note_kind"],"note_id": string,"occurred_on": string,"office_id": string,"sign": string | null,"valid_from": string,"valid_to": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"communicated": boolean,"criterion_id"?: string | null,"kind": Database["public"]['Enums']["note_kind"],"note_id": string,"occurred_on": string,"office_id": string,"sign"?: string | null,"valid_from": string,"valid_to": string,"version": number
                  }
                  Update: {
                    "body"?: string,"communicated"?: boolean,"criterion_id"?: string | null,"kind"?: Database["public"]['Enums']["note_kind"],"note_id"?: string,"occurred_on"?: string,"office_id"?: string,"sign"?: string | null,"valid_from"?: string,"valid_to"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "note_versions_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "author_account_id": string,"body": string,"communicated": boolean,"created_at": string,"criterion_id": string | null,"employee_id": string,"id": string,"kind": Database["public"]['Enums']["note_kind"],"occurred_on": string,"office_id": string,"sign": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_account_id"?: string,"body": string,"communicated"?: boolean,"created_at"?: string,"criterion_id"?: string | null,"employee_id": string,"id"?: string,"kind": Database["public"]['Enums']["note_kind"],"occurred_on": string,"office_id"?: string,"sign"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "author_account_id"?: string,"body"?: string,"communicated"?: boolean,"created_at"?: string,"criterion_id"?: string | null,"employee_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["note_kind"],"occurred_on"?: string,"office_id"?: string,"sign"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "notes_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_digests": {
                  Row: {
                    "account_id": string,"attempts": number,"created_at": string,"day": string,"last_error": string | null,"office_id": string,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"attempts"?: number,"created_at"?: string,"day": string,"last_error"?: string | null,"office_id": string,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "account_id"?: string,"attempts"?: number,"created_at"?: string,"day"?: string,"last_error"?: string | null,"office_id"?: string,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_digests_account_fkey"
      columns: ["account_id","office_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["user_id","office_id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "account_id": string,"created_at": string,"created_on": string,"due_on": string,"evaluation_id": string,"id": string,"kind": Database["public"]['Enums']["notification_kind"],"lead_days": number | null,"office_id": string,"read_at": string | null,"resolved_at": string | null,"slot": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"created_on": string,"due_on": string,"evaluation_id": string,"id"?: string,"kind": Database["public"]['Enums']["notification_kind"],"lead_days"?: number | null,"office_id": string,"read_at"?: string | null,"resolved_at"?: string | null,"slot": string,"status"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"created_on"?: string,"due_on"?: string,"evaluation_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["notification_kind"],"lead_days"?: number | null,"office_id"?: string,"read_at"?: string | null,"resolved_at"?: string | null,"slot"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_account_fkey"
      columns: ["account_id","office_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["user_id","office_id"]
    },{
      foreignKeyName: "notifications_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "notifications_evaluation_fkey"
      columns: ["evaluation_id","office_id"]
isOneToOne: false
      referencedRelation: "statistics_evaluation_facts"
      referencedColumns: ["evaluation_id","office_id"]
    },{
      foreignKeyName: "notifications_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"office_settings": {
                  Row: {
                    "accessibility_architecture": string | null,"accessibility_contact_email": string | null,"accessibility_contact_name": string | null,"accessibility_contact_phone": string | null,"accessibility_office_address": string | null,"accessibility_sign_language": string | null,"ai_enabled": boolean,"appreciation_gap_days": number,"default_place": string | null,"evaluator_flag_central_share": number,"evaluator_flag_leniency_points": number,"evaluator_flag_min_evaluations": number,"notes_retention_months": number,"objection_addressee_sheet_a": string | null,"office_id": string,"reminder_lead_days": (number)[],"smtp_from": string | null,"smtp_host": string | null,"smtp_password_secret_id": string | null,"smtp_password_set": boolean | null,"smtp_port": number | null,"smtp_user": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accessibility_architecture"?: string | null,"accessibility_contact_email"?: string | null,"accessibility_contact_name"?: string | null,"accessibility_contact_phone"?: string | null,"accessibility_office_address"?: string | null,"accessibility_sign_language"?: string | null,"ai_enabled"?: boolean,"appreciation_gap_days"?: number,"default_place"?: string | null,"evaluator_flag_central_share"?: number,"evaluator_flag_leniency_points"?: number,"evaluator_flag_min_evaluations"?: number,"notes_retention_months"?: number,"objection_addressee_sheet_a"?: string | null,"office_id": string,"reminder_lead_days"?: (number)[],"smtp_from"?: string | null,"smtp_host"?: string | null,"smtp_password_secret_id"?: string | null,"smtp_password_set"?: never,"smtp_port"?: number | null,"smtp_user"?: string | null
                  }
                  Update: {
                    "accessibility_architecture"?: string | null,"accessibility_contact_email"?: string | null,"accessibility_contact_name"?: string | null,"accessibility_contact_phone"?: string | null,"accessibility_office_address"?: string | null,"accessibility_sign_language"?: string | null,"ai_enabled"?: boolean,"appreciation_gap_days"?: number,"default_place"?: string | null,"evaluator_flag_central_share"?: number,"evaluator_flag_leniency_points"?: number,"evaluator_flag_min_evaluations"?: number,"notes_retention_months"?: number,"objection_addressee_sheet_a"?: string | null,"office_id"?: string,"reminder_lead_days"?: (number)[],"smtp_from"?: string | null,"smtp_host"?: string | null,"smtp_password_secret_id"?: string | null,"smtp_password_set"?: never,"smtp_port"?: number | null,"smtp_user"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "office_settings_office_id_fkey"
      columns: ["office_id"]
isOneToOne: true
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
                    "accepted_failing_cases": Json | null,"based_on": string | null,"code": string,"created_at": string,"created_by": string | null,"document": NonNullable<Json>,"effective_from": string,"id": string,"is_official": boolean,"office_id": string | null,"published_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_failing_cases"?: Json | null,"based_on"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"document": NonNullable<Json>,"effective_from": string,"id"?: string,"is_official": boolean,"office_id"?: string | null,"published_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "accepted_failing_cases"?: Json | null,"based_on"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"document"?: NonNullable<Json>,"effective_from"?: string,"id"?: string,"is_official"?: boolean,"office_id"?: string | null,"published_at"?: string | null,"status"?: string
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
                },"retained_dsc_events": {
                  Row: {
                    "id": string,"kind": string,"office_id": string,"outcome": string | null,"retained_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind": string,"office_id": string,"outcome"?: string | null,"retained_at"?: string,"year": number
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"office_id"?: string,"outcome"?: string | null,"retained_at"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "retained_dsc_events_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"retained_evaluation_facts": {
                  Row: {
                    "civil_servant": boolean,"evaluation_id": string,"evaluator_account_id": string,"grade_by_law_due_year": number | null,"grade_requested": boolean,"level_code": string | null,"mean": number | null,"office_id": string,"org_unit": string | null,"outcome": string | null,"ratings": NonNullable<Json>,"retained_at": string,"second_consecutive_negative": boolean,"sheet_id": string,"with_conclusions": boolean,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "civil_servant": boolean,"evaluation_id": string,"evaluator_account_id": string,"grade_by_law_due_year"?: number | null,"grade_requested": boolean,"level_code"?: string | null,"mean"?: number | null,"office_id": string,"org_unit"?: string | null,"outcome"?: string | null,"ratings": NonNullable<Json>,"retained_at"?: string,"second_consecutive_negative": boolean,"sheet_id": string,"with_conclusions": boolean,"year": number
                  }
                  Update: {
                    "civil_servant"?: boolean,"evaluation_id"?: string,"evaluator_account_id"?: string,"grade_by_law_due_year"?: number | null,"grade_requested"?: boolean,"level_code"?: string | null,"mean"?: number | null,"office_id"?: string,"org_unit"?: string | null,"outcome"?: string | null,"ratings"?: NonNullable<Json>,"retained_at"?: string,"second_consecutive_negative"?: boolean,"sheet_id"?: string,"with_conclusions"?: boolean,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "retained_evaluation_facts_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"retained_grade_grants": {
                  Row: {
                    "basis": string,"granted_year": number,"id": string,"new_grade": number,"office_id": string,"retained_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "basis": string,"granted_year": number,"id": string,"new_grade": number,"office_id": string,"retained_at"?: string
                  }
                  Update: {
                    "basis"?: string,"granted_year"?: number,"id"?: string,"new_grade"?: number,"office_id"?: string,"retained_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "retained_grade_grants_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "statistics_evaluation_facts": {
                  Row: {
                    "acquainted_on": string | null,"civil_servant": boolean | null,"content": NonNullable<Json>,"drafted_on": string | null,"employee_id": string,"evaluation_id": string,"evaluator_account_id": string,"grade_granted_on": string | null,"office_id": string,"org_unit": string | null,"regulation_version_id": string,"sheet_id": string,"sheet_version": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "evaluations_employee_fkey"
      columns: ["employee_id","office_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["id","office_id"]
    },{
      foreignKeyName: "evaluations_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluations_regulation_version_id_fkey"
      columns: ["regulation_version_id"]
isOneToOne: false
      referencedRelation: "regulation_versions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admit_account":
{ Args: { "p_account_id": string,"p_first_name": string,"p_last_name": string,"p_office_id": string,"p_role": Database["public"]['Enums']["office_role"] }; Returns: string
                           },
"ai_usage_log":
{ Args: { "p_limit"?: number }; Returns: {
              "content_deleted_at": string,"decisions": Json,"employee_id": string,"evaluation_id": string,"failure_reason": string,"finished_at": string,"id": string,"kind": Database["public"]['Enums']["ai_run_kind"],"model": string,"output_tokens": number,"prompt_version": string,"requested_at": string,"requested_by": string,"requester_first_name": string,"requester_last_name": string,"started_at": string,"status": Database["public"]['Enums']["ai_run_status"]
            }[]
                           },
"anonymize_employee":
{ Args: { "p_employee_id": string,"p_facts": Json,"p_today": string }; Returns: undefined
                           },
"apply_evaluation_transition":
{ Args: { "p_evaluation_id": string,"p_event_kind": Database["public"]['Enums']["evaluation_event_kind"],"p_expected_status": Database["public"]['Enums']["evaluation_status"],"p_lock_sheet": boolean,"p_next_status": Database["public"]['Enums']["evaluation_status"],"p_occurred_on": string,"p_payload": Json }; Returns: string
                           },
"apply_objection_outcome":
{ Args: { "p_evaluation_id": string,"p_new_content": Json,"p_occurred_on": string,"p_outcome": string,"p_payload": Json }; Returns: string
                           },
"change_evaluator":
{ Args: { "p_evaluation_id": string,"p_new_evaluator_account_id": string,"p_occurred_on": string,"p_reason": string }; Returns: string
                           },
"change_member_role":
{ Args: { "p_account_id": string,"p_role": Database["public"]['Enums']["office_role"] }; Returns: undefined
                           },
"close_unobjected_evaluations":
{ Args: { "p_today": string }; Returns: {
              "evaluation_id": string,"office_id": string
            }[]
                           },
"collect_notifications":
{ Args: { "p_today": string }; Returns: {
              "created": number,"queued": number,"resolved": number
            }[]
                           },
"confirm_archive_export":
{ Args: { "p_employee_id": string }; Returns: undefined
                           },
"correct_sheet":
{ Args: { "p_content": Json,"p_evaluation_id": string,"p_reason": string }; Returns: string
                           },
"end_employment":
{ Args: { "p_employee_id": string,"p_ended_on": string,"p_purge_due_on": string,"p_reason": string }; Returns: {
              "interrupted_evaluation_id": string
            }[]
                           },
"end_membership":
{ Args: { "p_account_id": string }; Returns: number
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
"grade_granted_since_evaluation":
{ Args: { "p_evaluation_id": string }; Returns: boolean
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
"notes_retention_preview":
{ Args: { "p_months": number }; Returns: {
              "ai_runs": number,"notes": number
            }[]
                           },
"notification_digest_facts":
{ Args: { "p_account_id": string,"p_day": string }; Returns: {
              "email": string,"nearest_due_on": string,"office_id": string,"status": string,"unread_count": number
            }[]
                           },
"office_smtp_settings":
{ Args: { "p_office_id": string }; Returns: {
              "host": string,"password": string,"port": number,"sender": string,"sender_name": string,"username": string
            }[]
                           },
"purge_expired_content":
{ Args: { "p_today": string }; Returns: {
              "ai_runs": number,"decisions": number,"notes": number
            }[]
                           },
"record_digest_result":
{ Args: { "p_account_id": string,"p_day": string,"p_error": string,"p_status": string }; Returns: undefined
                           },
"record_grade_grant":
{ Args: { "p_basis": string,"p_employee_id": string,"p_evaluation_id": string,"p_granted_on": string,"p_new_grade": number }; Returns: string
                           },
"record_labour_court_appeal":
{ Args: { "p_evaluation_id": string,"p_filed_on": string }; Returns: string
                           },
"retention_overview":
{ Args: { "p_within_days"?: number }; Returns: {
              "archive_exported_at": string,"employee_id": string,"purge_due_on": string
            }[]
                           },
"save_evaluation_results":
{ Args: { "p_results": Json }; Returns: number
                           },
"set_smtp_password":
{ Args: { "p_password": string }; Returns: undefined
                           },
"start_evaluation":
{ Args: { "p_after_negative": boolean,"p_content": Json,"p_cycle_start": string,"p_employee_id": string,"p_evaluator_account_id": string,"p_previous_acquainted_on": string,"p_previous_evaluation_id": string,"p_regulation_version_id": string,"p_sheet_id": string,"p_snapshot": Json }; Returns: string
                           },
"statistics_criteria":
{ Args: { "p_year": number }; Returns: {
              "criterion_id": string,"points": number,"ratings": number
            }[]
                           },
"statistics_distribution":
{ Args: { "p_year": number }; Returns: {
              "civil_servant": boolean,"evaluations": number,"grade_by_law": number,"grade_requests": number,"level_code": string,"negative": number,"org_unit": string,"second_negative": number,"with_conclusions": number
            }[]
                           },
"statistics_dsc_ock_counts":
{ Args: { "p_year": number }; Returns: {
              "civil_servants": number,"grades_by_law": number,"grades_on_request": number,"indefinite_employees": number,"labour_court_appeals": number,"objections_pending": number,"objections_rejected": number,"objections_upheld": number
            }[]
                           },
"statistics_evaluators":
{ Args: { "p_year": number }; Returns: {
              "evaluations": number,"evaluator_account_id": string,"evaluator_name": string,"level_code": string,"points_sum": number,"ratings": number
            }[]
                           },
"statistics_schedule":
{ Args: Record<PropertyKey, never>; Returns: {
              "cycle_start": string,"employee_id": string,"evaluation_due_on": string,"evaluation_id": string,"evaluator_account_id": string,"evaluator_name": string,"first_name": string,"interview_held": boolean,"last_name": string,"org_unit": string,"starting_interview_due_on": string,"status": string,"suspended": boolean
            }[]
                           },
"take_invitation_password":
{ Args: { "p_invitation_id": string }; Returns: string
                           }
          }
          Enums: {
            "account_invitation_mode": "invitation"|"temporary_password"|"existing_account","account_invitation_status": "pending"|"sent"|"failed","ai_run_kind": "sheet_draft"|"quality_check"|"sensitive_data"|"conversation_prep"|"criteria_proposals"|"appreciation_moments"|"hr_signals"|"procedure_question","ai_run_status": "queued"|"running"|"done"|"failed","employment_basis": "indefinite"|"appointment"|"fixed_term","evaluation_event_kind": "created"|"part_one_approved"|"part_one_signed"|"evaluation_interview_held"|"sheet_approved"|"acquainted"|"signature_refused"|"closed"|"objection_filed"|"objection_outcome"|"absence"|"term_changed"|"evaluator_changed"|"position_changed"|"correction"|"interrupted"|"labour_court_appeal","evaluation_status": "criteria"|"criteria_awaiting_signature"|"period"|"interview"|"drafted"|"delivered"|"closed"|"objection"|"interrupted","note_kind": "observation"|"ongoing_conversation"|"appreciation"|"workload_fact","notification_kind": "deadline_reminder"|"deadline_overdue"|"objection_decision"|"grade_by_law","office_role": "admin"|"hr"|"evaluator","position_kind": "office_head"|"manages_people"|"other","service_status": "civil_servant"|"employee"
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
            "account_invitation_mode": ["invitation", "temporary_password", "existing_account"],"account_invitation_status": ["pending", "sent", "failed"],"ai_run_kind": ["sheet_draft", "quality_check", "sensitive_data", "conversation_prep", "criteria_proposals", "appreciation_moments", "hr_signals", "procedure_question"],"ai_run_status": ["queued", "running", "done", "failed"],"employment_basis": ["indefinite", "appointment", "fixed_term"],"evaluation_event_kind": ["created", "part_one_approved", "part_one_signed", "evaluation_interview_held", "sheet_approved", "acquainted", "signature_refused", "closed", "objection_filed", "objection_outcome", "absence", "term_changed", "evaluator_changed", "position_changed", "correction", "interrupted", "labour_court_appeal"],"evaluation_status": ["criteria", "criteria_awaiting_signature", "period", "interview", "drafted", "delivered", "closed", "objection", "interrupted"],"note_kind": ["observation", "ongoing_conversation", "appreciation", "workload_fact"],"notification_kind": ["deadline_reminder", "deadline_overdue", "objection_decision", "grade_by_law"],"office_role": ["admin", "hr", "evaluator"],"position_kind": ["office_head", "manages_people", "other"],"service_status": ["civil_servant", "employee"]
          }
        }
} as const
