# Analytics Feature Spec

Goal: Create a simple analytics page that shows how users are interacting with the system.

## Main Features

- **Most commonly cited talks** — which talks appear in keyword, semantic, and RAG results, and how often
- **Most common questions** — the questions users ask most, broken down by search type

---

## Database

### Table: `citation_analytics`
Tracks which talks are returned for each search.

```sql
CREATE TABLE citation_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_type TEXT NOT NULL CHECK (search_type IN ('keyword', 'semantic', 'rag')),
    talk_id TEXT NOT NULL,
    title TEXT NOT NULL,
    speaker TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `question_analytics`
Tracks every question submitted, by search type.

```sql
CREATE TABLE question_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_type TEXT NOT NULL CHECK (search_type IN ('keyword', 'semantic', 'rag')),
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies

- **Reads**: Authenticated users only
- **Writes**: Service role only (Edge Functions write via service key, bypassing RLS)

```sql
-- Enable RLS
ALTER TABLE citation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_analytics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read citation_analytics"
ON citation_analytics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read question_analytics"
ON question_analytics FOR SELECT TO authenticated USING (true);
```

---

## Backend Changes

### `embed-question` Edge Function
- After generating the embedding, insert a row into `question_analytics` with:
  - `search_type`: passed in the request body alongside `question`
  - `question`: the question text

### `generate-answer` Edge Function
- After generating the answer, insert one row per talk into `citation_analytics` with:
  - `search_type`: `'rag'`
  - `talk_id`, `title`, `speaker`: from each `context_talk`

> Note: Both functions use the Supabase service role key to write analytics, bypassing RLS.

---

## Frontend

Add an **Analytics** section below the search panels, visible only to logged-in users.

### Top Cited Talks Table
| Talk Title | Speaker | Times Cited | Search Type Breakdown |
|------------|---------|:-----------:|----------------------|

Group by `talk_id`, count citations, optionally break down by `search_type`.

### Top Questions Table
| Question | Search Type | Times Asked |
|----------|-------------|:-----------:|

Group by `question` + `search_type`, count occurrences.

Both tables show the top 10 results, sorted by count descending.
