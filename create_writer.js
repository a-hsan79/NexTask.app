import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://skpjkmcvcogdirnopzvg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrcGprbWN2Y29nZGlybm9wenZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzIxMjIsImV4cCI6MjA4ODkwODEyMn0.DIPkPVq9Ndcm9TRhO5Pna6gO9Cg7JBu3vXGSztUzLdI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createWriterUser() {
  const email = 'writer_test@nextask.com';
  const password = 'password123';
  const fullName = 'Writer Test User';

  console.log(`Creating user: ${email}...`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      console.log('User already exists. Proceeding.');
      process.exit(0);
    }
    console.error('Error creating user:', error.message);
    process.exit(1);
  }

  console.log('User created successfully:', data.user.id);
}

createWriterUser();
