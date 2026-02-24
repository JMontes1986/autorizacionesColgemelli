// Configuración centralizada de la aplicación para reducir acoplamiento en app.js

const envExists = typeof window !== 'undefined' && !!(window.process && window.process.env);

const appConfig = {
    envExists,
    SUPABASE_URL: envExists ? window.process.env.SUPABASE_URL : '',
    SUPABASE_ANON_KEY: envExists ? window.process.env.SUPABASE_ANON_KEY : '',
    GROQ_API_KEY: envExists ? window.process.env.GROQ_API_KEY : '',
    GROQ_API_BASE_URL: 'https://api.groq.com/openai/v1',
    GROQ_MODEL: 'openai/gpt-oss-120b',
    STORAGE_BUCKET: 'autorizaciones',
    EXIT_EDIT_USERS: [
        'convivencia@colgemelli.edu.co',
        'sistemas@colgemelli.edu.co'
    ]
};

window.appConfig = appConfig;
