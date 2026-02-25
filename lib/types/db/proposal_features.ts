export type Database = {
  public: {
    Tables: {
      proposal_features: {
        Row: {
          created_at: string;
          feature_description: string;
          feature_name: string;
          feature_notes: string | null;
          feature_priority: string;
          id: string;
          proposal_id: string;
        };
        Insert: {
          created_at?: string;
          feature_description: string;
          feature_name: string;
          feature_notes?: string | null;
          feature_priority: string;
          id?: string;
          proposal_id?: string;
        };
        Update: {
          created_at?: string;
          feature_description?: string;
          feature_name?: string;
          feature_notes?: string | null;
          feature_priority?: string;
          id?: string;
          proposal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_features_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          business_name: string;
          client_email: string;
          client_name: string;
          client_phone: number;
          created_at: string;
          id: string;
          project_budget: number;
          project_description: string;
          project_requirements: string[];
          project_requirements_description: string;
          project_status: Database["public"]["Enums"]["project_status"];
          project_timeline: string;
          public: boolean;
          user_id: string | null;
        };
        Insert: {
          business_name: string;
          client_email: string;
          client_name: string;
          client_phone: number;
          created_at?: string;
          id?: string;
          project_budget: number;
          project_description: string;
          project_requirements: string[];
          project_requirements_description: string;
          project_status?: Database["public"]["Enums"]["project_status"];
          project_timeline: string;
          public?: boolean;
          user_id?: string | null;
        };
        Update: {
          business_name?: string;
          client_email?: string;
          client_name?: string;
          client_phone?: number;
          created_at?: string;
          id?: string;
          project_budget?: number;
          project_description?: string;
          project_requirements?: string[];
          project_requirements_description?: string;
          project_status?: Database["public"]["Enums"]["project_status"];
          project_timeline?: string;
          public?: boolean;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["role"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["role"];
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["role"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      project_status:
        | "NEW_IDEA"
        | "GENERATING_REVENUE"
        | "GROWTH_PHASE"
        | "INDUSTRY_LEADER";
      role: "ADMIN" | "USER";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
export type ProposalFeature =
  Database["public"]["Tables"]["proposal_features"]["Row"];
