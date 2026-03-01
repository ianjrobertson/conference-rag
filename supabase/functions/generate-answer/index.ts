import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse the request body
    const { question, context_talks } = await req.json()
    if (!question || !context_talks?.length) {
      return new Response(JSON.stringify({ error: 'Missing question or context_talks' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build the prompt
    const talksContext = context_talks.map((talk: { title: string; speaker: string; text: string }, i: number) =>
      `Talk ${i + 1}: "${talk.title}" by ${talk.speaker}\n${talk.text}`
    ).join('\n\n---\n\n')

    const prompt = `You are a helpful assistant answering questions about General Conference talks.

Using ONLY the conference talks provided below, answer the following question. Cite which talks you draw from by mentioning the title and speaker.

Question: ${question}

Conference Talks:
${talksContext}`

    // Call GPT-4o
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPEN_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      }),
    })

    const openaiData = await openaiRes.json()
    const answer = openaiData.choices[0].message.content

    const response = new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // Fire-and-forget: log citations and question to analytics
    try {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const citationRows = context_talks.map((talk: { title: string; speaker: string; talk_id?: string }) => ({
        search_type: 'rag',
        talk_id: talk.talk_id ?? talk.title,
        title: talk.title,
        speaker: talk.speaker,
      }))
      await Promise.all([
        adminClient.from('citation_analytics').insert(citationRows),
        adminClient.from('question_analytics').insert({ search_type: 'rag', question }),
      ])
    } catch (analyticsErr) {
      console.error('Analytics write failed:', analyticsErr)
    }

    return response
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
