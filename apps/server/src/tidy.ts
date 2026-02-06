import { Request, Response } from 'express';
import OpenAI from 'openai';

// Lazy initialization of AI client (supports Groq or OpenAI)
let aiClient: OpenAI | null = null;

function getAIClient(): { client: OpenAI; model: string } | null {
  // Prefer Groq, fall back to OpenAI
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!groqKey && !openaiKey) {
    return null;
  }

  if (!aiClient) {
    if (groqKey) {
      // Use Groq (OpenAI-compatible API)
      aiClient = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      console.log('🚀 Using Groq API for clustering');
    } else {
      // Use OpenAI
      aiClient = new OpenAI({
        apiKey: openaiKey,
      });
      console.log('🚀 Using OpenAI API for clustering');
    }
  }

  // Return client with appropriate model
  return {
    client: aiClient,
    model: groqKey ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
  };
}

// Types for the tidy request/response
interface NoteInput {
  id: string;
  text: string;
}

interface ClusterResult {
  name: string;
  noteIds: string[];
}

interface TidyResponse {
  clusters: ClusterResult[];
}

// System prompt for clustering
const SYSTEM_PROMPT = `You are an expert at organizing and categorizing information. 
Your task is to group sticky notes into semantic clusters based on their content.

Analyze the notes and group them by topic, theme, or category. Each note should belong to exactly one cluster.
Create meaningful, concise cluster names that describe the common theme.

Return ONLY a valid JSON object in this exact format, with no additional text:
{
  "clusters": [
    {
      "name": "Cluster Name",
      "noteIds": ["id1", "id2"]
    }
  ]
}

Guidelines:
- Create 2-6 clusters depending on the diversity of content
- If notes are too diverse, create broader categories
- If notes are similar, create fewer, more specific clusters
- Empty or meaningless notes can be grouped into "Uncategorized"
- Keep cluster names short (2-4 words)`;

export async function tidyEndpoint(req: Request, res: Response) {
  try {
    const { notes } = req.body as { notes: NoteInput[] };

    // Validate input
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Please provide an array of notes with id and text properties',
      });
    }

    // Check for API key (Groq or OpenAI)
    const ai = getAIClient();
    if (!ai) {
      console.warn('⚠️ No GROQ_API_KEY or OPENAI_API_KEY set, using mock clustering');
      return res.json(mockClustering(notes));
    }

    // Format notes for the prompt
    const notesText = notes
      .map((note) => `[ID: ${note.id}] "${note.text}"`)
      .join('\n');

    const userPrompt = `Please organize these ${notes.length} sticky notes into semantic clusters:\n\n${notesText}`;

    console.log(`🤖 Analyzing ${notes.length} notes with ${ai.model}...`);

    // Call AI API (Groq or OpenAI)
    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the response
    const result: TidyResponse = JSON.parse(responseText);

    // Validate the response structure
    if (!result.clusters || !Array.isArray(result.clusters)) {
      throw new Error('Invalid response structure from OpenAI');
    }

    console.log(`✅ Created ${result.clusters.length} clusters`);
    
    return res.json(result);
  } catch (error) {
    console.error('❌ Tidy endpoint error:', error);
    
    // If OpenAI fails, fall back to mock clustering
    const { notes } = req.body as { notes: NoteInput[] };
    if (notes && Array.isArray(notes)) {
      console.log('📋 Falling back to mock clustering');
      return res.json(mockClustering(notes));
    }

    return res.status(500).json({
      error: 'Clustering failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Mock clustering for when OpenAI is unavailable
function mockClustering(notes: NoteInput[]): TidyResponse {
  // Simple keyword-based clustering
  const clusters: Map<string, string[]> = new Map();
  
  const keywords: Record<string, string[]> = {
    'Ideas': ['idea', 'think', 'maybe', 'could', 'should', 'what if'],
    'Tasks': ['todo', 'task', 'do', 'complete', 'finish', 'need to', 'must'],
    'Questions': ['?', 'how', 'why', 'what', 'when', 'where', 'who'],
    'Important': ['important', 'urgent', 'critical', 'priority', 'asap', '!'],
  };

  for (const note of notes) {
    const textLower = note.text.toLowerCase();
    let assigned = false;

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some((word) => textLower.includes(word))) {
        if (!clusters.has(category)) {
          clusters.set(category, []);
        }
        clusters.get(category)!.push(note.id);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      if (!clusters.has('General')) {
        clusters.set('General', []);
      }
      clusters.get('General')!.push(note.id);
    }
  }

  return {
    clusters: Array.from(clusters.entries()).map(([name, noteIds]) => ({
      name,
      noteIds,
    })),
  };
}
