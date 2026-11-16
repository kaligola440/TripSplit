export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          start_date: string;
          end_date: string | null;
          currency: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          start_date: string;
          end_date?: string | null;
          currency: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          start_date?: string;
          end_date?: string | null;
          currency?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trip_participants: {
        Row: {
          id: string;
          trip_id: string;
          user_id: string | null;
          display_name: string;
          email: string | null;
          role: Database["public"]["Enums"]["trip_participant_role"];
          status: Database["public"]["Enums"]["trip_participant_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          user_id?: string | null;
          display_name: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["trip_participant_role"];
          status?: Database["public"]["Enums"]["trip_participant_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          user_id?: string | null;
          display_name?: string;
          email?: string | null;
          role?: Database["public"]["Enums"]["trip_participant_role"];
          status?: Database["public"]["Enums"]["trip_participant_status"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_participants_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_invitations: {
        Row: {
          id: string;
          trip_id: string;
          participant_id: string;
          email: string;
          token_hash: string;
          status: string;
          expires_at: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          participant_id: string;
          email: string;
          token_hash: string;
          status?: string;
          expires_at?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          participant_id?: string;
          email?: string;
          token_hash?: string;
          status?: string;
          expires_at?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_invitations_participant_trip_fkey";
            columns: ["participant_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trip_participants";
            referencedColumns: ["id", "trip_id"];
          },
          {
            foreignKeyName: "trip_invitations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          trip_id: string;
          description: string;
          amount: number;
          currency: string;
          category: string;
          expense_date: string;
          paid_by_participant_id: string;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          description: string;
          amount: number;
          currency: string;
          category?: string;
          expense_date: string;
          paid_by_participant_id: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          description?: string;
          amount?: number;
          currency?: string;
          category?: string;
          expense_date?: string;
          paid_by_participant_id?: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_paid_by_participant_trip_fkey";
            columns: ["paid_by_participant_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trip_participants";
            referencedColumns: ["id", "trip_id"];
          },
          {
            foreignKeyName: "expenses_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_shares: {
        Row: {
          id: string;
          expense_id: string;
          trip_id: string;
          participant_id: string;
          share_amount: number;
          share_type: Database["public"]["Enums"]["expense_share_type"];
          share_percentage: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          trip_id: string;
          participant_id: string;
          share_amount: number;
          share_type: Database["public"]["Enums"]["expense_share_type"];
          share_percentage?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          trip_id?: string;
          participant_id?: string;
          share_amount?: number;
          share_type?: Database["public"]["Enums"]["expense_share_type"];
          share_percentage?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_shares_expense_trip_fkey";
            columns: ["expense_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id", "trip_id"];
          },
          {
            foreignKeyName: "expense_shares_participant_trip_fkey";
            columns: ["participant_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trip_participants";
            referencedColumns: ["id", "trip_id"];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          trip_id: string;
          from_participant_id: string;
          to_participant_id: string;
          amount: number;
          currency: string;
          payment_date: string;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          from_participant_id: string;
          to_participant_id: string;
          amount: number;
          currency: string;
          payment_date: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          from_participant_id?: string;
          to_participant_id?: string;
          amount?: number;
          currency?: string;
          payment_date?: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_from_participant_trip_fkey";
            columns: ["from_participant_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trip_participants";
            referencedColumns: ["id", "trip_id"];
          },
          {
            foreignKeyName: "settlements_to_participant_trip_fkey";
            columns: ["to_participant_id", "trip_id"];
            isOneToOne: false;
            referencedRelation: "trip_participants";
            referencedColumns: ["id", "trip_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_external_participant: {
        Args: { p_trip_id: string; p_name: string; p_email: string };
        Returns: string;
      };
      create_trip_invitation: {
        Args: { p_trip_id: string; p_name: string; p_email: string; p_token_hash: string };
        Returns: string;
      };
      resend_trip_invitation: {
        Args: { p_trip_id: string; p_invitation_id: string; p_token_hash: string };
        Returns: string;
      };
      cancel_trip_invitation: {
        Args: { p_trip_id: string; p_invitation_id: string };
        Returns: undefined;
      };
      respond_to_trip_invitation: {
        Args: { p_token: string; p_accept: boolean };
        Returns: Json;
      };
      remove_trip_participant: {
        Args: { p_trip_id: string; p_participant_id: string };
        Returns: string;
      };
      create_expense_with_shares: {
        Args: {
          p_trip_id: string;
          p_description: string;
          p_amount: string;
          p_currency: string;
          p_expense_date: string;
          p_paid_by_participant_id: string;
          p_shares: Json;
          p_category?: string;
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      trip_participant_role: "owner" | "member";
      trip_participant_status: "active" | "invited" | "inactive";
      expense_share_type: "equal" | "custom" | "percentage";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
