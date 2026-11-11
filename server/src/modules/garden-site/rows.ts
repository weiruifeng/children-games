import type { RowDataPacket } from '../database/database.service';

export interface UserRow extends RowDataPacket {
  id: string;
  username_normalized: string;
  user_role: 'user' | 'admin';
  user_status: 'active' | 'disabled';
  password_hash: string;
}
export interface SessionRow extends UserRow {
  session_id: string;
  csrf_secret: string;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}
export interface InvitationRow extends RowDataPacket {
  id: string;
  user_id: string;
  used_at: Date | null;
  revoked_at: Date | null;
  consumed_at: Date | null;
  expires_at: Date;
}
export interface ProfileRow extends RowDataPacket {
  id: string;
  slot_number: number;
  revision: number | string;
  generation: number;
  history_floor: number;
  updated_at: Date;
  profile_json: unknown;
  garden_name: string | null;
}
export interface MutationRow extends RowDataPacket {
  request_hash: string;
  result_json: unknown;
}
export interface LearningRow extends RowDataPacket {
  id: number;
  generation: number;
  event_json: unknown;
}
export interface ArchiveRow extends RowDataPacket {
  id: string;
  archive_json: unknown;
  created_at: Date;
}
