import { Request } from 'express';
// import { User } from '@supabase/supabase-js'; // Removed Supabase User
import { User } from '@prisma/client'; // Imported Prisma User

export interface AuthenticatedRequest extends Request {
  user: User; // User is now the database user model
}
