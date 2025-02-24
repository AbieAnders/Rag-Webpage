This is a Next.js app designed to work with Supabase and Gemini API, It uses PostgreSQL to store web pages and perform similairty searches using vector embeddings.

Before running the app locally, make sure you have the following installed: 
1)Node.js 
2)Supabase account 
3)Gemini API Key

Run the following commands: 1)git clone https://github.com/AbieAnders/Rag-Webpage.git 
2)cd Rag-Webpage 
3)npm install

Environment variables: You will need a 
1)SUPABASE_URL
2)SUPABASE_SERVICE_ROLE_KEY
3)PROD_URL=https://rag-two-mu.vercel.app
4)GEMINI_API_KEY

The first 2 can be obtained from a supabase project after running the following PostgreSQL commands in the SQL editor.

1)CREATE EXTENSION IF NOT EXISTS vector;

2)CREATE TABLE webpages_1 ( id SERIAL PRIMARY KEY, url TEXT UNIQUE NOT NULL, content TEXT NOT NULL, embedding vector(768) --768 is the size of the output by the embeddings model-- );

3)CREATE OR REPLACE FUNCTION match_webpages( query_embedding vector(768), match_threshold float, match_count int ) RETURNS TABLE(id int, url text, content text, similarity float) AS $$ BEGIN RETURN QUERY SELECT w.id, w.url, w.content, 1 - (w.embedding <=> query_embedding) AS similarity FROM webpages_1 w WHERE (embedding <=> query_embedding) < match_threshold ORDER BY similarity DESC LIMIT match_count; END; $$ LANGUAGE plpgsql;

Run the following command: npm run dev

Now youre running the app locally :)
