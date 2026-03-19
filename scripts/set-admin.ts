/**
 * set-admin.ts — Promote a user to admin role in production
 *
 * This script uses the Supabase service role key to bypass RLS and directly
 * update a user's role in the profiles table. Run this ONCE after initial
 * deployment to set up the first admin user.
 *
 * Prerequisites:
 *   1. User must have logged in via Google OAuth at least once
 *   2. NEXT_PUBLIC_SUPABASE_URL env var must be set
 *   3. SUPABASE_SERVICE_ROLE_KEY env var must be set (server-only, never expose to client)
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/set-admin.ts admin@example.com
 */

import { createClient } from "@supabase/supabase-js";

// Read configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Read the target admin email from command line argument
const targetEmail = process.argv[2];

// Validate required inputs before proceeding
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: Missing required environment variables.");
  console.error(
    "  Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

if (!targetEmail) {
  console.error("Error: No email address provided.");
  console.error("  Usage: npx tsx scripts/set-admin.ts your-email@example.com");
  process.exit(1);
}

// Create a Supabase client with the service role key.
// IMPORTANT: Service role key bypasses ALL RLS policies.
// Never use this key in client-side code or expose it publicly.
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // Disable automatic session persistence — this is a one-off script
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function promoteToAdmin(email: string): Promise<void> {
  console.log(`Looking up user: ${email}`);

  // Step 1: Find the user in Supabase Auth by email
  const { data: usersData, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  const targetUser = usersData.users.find((u) => u.email === email);

  if (!targetUser) {
    console.error(`User not found: ${email}`);
    console.error("Make sure the user has logged in at least once via OAuth.");
    process.exit(1);
  }

  console.log(`Found user: ${targetUser.id} (${targetUser.email})`);

  // Step 2: Update the user's role to 'admin' in the profiles table
  const { data, error: updateError } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", targetUser.id)
    .select("id, display_name, email, role")
    .single();

  if (updateError) {
    console.error("Failed to update role:", updateError.message);
    process.exit(1);
  }

  console.log("Admin promoted successfully!");
  console.log("  User ID:      ", data.id);
  console.log("  Display Name: ", data.display_name);
  console.log("  Email:        ", data.email);
  console.log("  New Role:     ", data.role);
}

// Run the promotion script
promoteToAdmin(targetEmail).catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
