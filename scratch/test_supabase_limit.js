const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://rnelxupyiejsqekmcrcz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ");
async function test() {
  const { data, error } = await supabase.from("questions").select("id").eq("course", "Civil Services").limit(15000);
  console.log(data ? data.length : error);
}
test();
