import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getSupabase } from "@/lib/supabase";

export interface StoredUser {
  email: string;
  password: string;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export async function createUser(
  email: string,
  password: string,
): Promise<StoredUser> {
  const normalized = email.trim().toLowerCase();
  const supabase = getSupabase();
  const { error } = await supabase.from("users").insert({
    email: normalized,
    password_hash: hashPassword(password),
  });

  if (error?.code === "23505") {
    throw new Error("User already exists");
  }
  if (error) {
    throw new Error(error.message);
  }

  return { email: normalized, password };
}

export async function findUser(
  email: string,
  password: string,
): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("email, password_hash")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || !verifyPassword(password, data.password_hash)) {
    return null;
  }

  return { email: data.email, password };
}
