export type UserRole = 'admin' | 'user';

/** Safe user fields returned by login and the admin user/member endpoints. */
export interface AppUser {
  id: number;
  name: string;
  username: string;
  role: UserRole;
}
