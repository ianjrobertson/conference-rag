"""
Step 6: Create Analytics Tables
================================
Creates citation_analytics and question_analytics tables with RLS policies
in your Supabase database.

Usage:
    python scripts/06_create_analytics.py

Prerequisites:
    - config.public.json with Supabase URL and anon key
    - config.secret.json with Supabase service key, access token, and project ref
    - Supabase project created
"""

import json
import sys
import time

# Load configuration from both config files
with open('config.public.json', 'r') as f:
    public_config = json.load(f)
with open('config.secret.json', 'r') as f:
    secrets = json.load(f)

SUPABASE_URL = public_config['SUPABASE_URL']
SUPABASE_SERVICE_KEY = secrets['SUPABASE_SERVICE_KEY']
SUPABASE_ACCESS_TOKEN = secrets['SUPABASE_ACCESS_TOKEN']
SUPABASE_PROJECT_REF = secrets['SUPABASE_PROJECT_REF']


def create_analytics():
    import requests
    from supabase import create_client

    print("=" * 60)
    print("Creating Analytics Tables")
    print("=" * 60)

    analytics_sql = """
CREATE TABLE IF NOT EXISTS citation_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_type TEXT NOT NULL CHECK (search_type IN ('keyword', 'semantic', 'rag')),
    talk_id TEXT NOT NULL,
    title TEXT NOT NULL,
    speaker TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_type TEXT NOT NULL CHECK (search_type IN ('keyword', 'semantic', 'rag')),
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE citation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read citation_analytics" ON citation_analytics;
CREATE POLICY "Authenticated users can read citation_analytics"
ON citation_analytics FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read question_analytics" ON question_analytics;
CREATE POLICY "Authenticated users can read question_analytics"
ON question_analytics FOR SELECT TO authenticated USING (true);
"""

    url = f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    resp = requests.post(url, headers=headers, json={"query": analytics_sql})
    if resp.status_code in (200, 201):
        print("✅ Analytics tables created successfully!")
    else:
        print(f"❌ Analytics table creation failed: {resp.status_code}")
        print(resp.text[:500])
        return False

    # Verify tables exist via PostgREST
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    for table in ('citation_analytics', 'question_analytics'):
        for attempt in range(5):
            try:
                result = client.table(table).select('id', count='exact').limit(1).execute()
                print(f"✅ Table '{table}' verified. Current rows: {result.count or 0}")
                break
            except Exception:
                if attempt < 4:
                    print(f"   Waiting for schema cache to refresh... ({attempt + 1}/5)")
                    time.sleep(3)
                else:
                    print(f"⚠️  Table '{table}' created but PostgREST cache hasn't refreshed yet.")
                    print("   This is normal — it should be ready shortly.")

    return True


if __name__ == '__main__':
    if not create_analytics():
        sys.exit(1)
    print("\n✅ Analytics tables ready!")
    print("Next: deploy edge functions with:")
    print("  supabase functions deploy embed-question --no-verify-jwt")
    print("  supabase functions deploy generate-answer --no-verify-jwt")
