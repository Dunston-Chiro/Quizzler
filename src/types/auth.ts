export type UserRole = "PARTICIPANT" | "ADMIN" | "SUPER_ADMIN";

export interface SessionPayload {
  userId: string;
  name: string;
  teamName?: string;
  email: string;
  role: UserRole;
  collegeName?: string;
  rollNumber?: string;
  expiresAt: Date | string;
}

export interface IUserPublic {
  id: string;
  teamName?: string | null;
  name: string;
  email: string;
  role: UserRole;
  collegeName?: string | null;
  rollNumber?: string | null;
  isActive: boolean;
  createdAt: string;
}
