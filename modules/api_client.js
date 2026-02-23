// Configuración de red/API extraída de app.js

const envExists = typeof window !== 'undefined' && window.process && window.process.env;

const apiClientConfig = {
  SUPABASE_URL: envExists ? window.process.env.SUPABASE_URL : '',
  SUPABASE_ANON_KEY: envExists ? window.process.env.SUPABASE_ANON_KEY : '',
  GROQ_API_KEY: envExists ? window.process.env.GROQ_API_KEY : '',
  GROQ_API_BASE_URL: 'https://api.groq.com/openai/v1',
  GROQ_MODEL: 'openai/gpt-oss-120b'
};

const GROQ_API_KEY = apiClientConfig.GROQ_API_KEY;
const GROQ_API_BASE_URL = apiClientConfig.GROQ_API_BASE_URL;
const GROQ_MODEL = apiClientConfig.GROQ_MODEL;

        function encodeToonValue(value) {
            return String(value ?? '')
                .replace(/\\/g, '\\\\')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/=/g, '\\=');
        }

        function decodeToonValue(value) {
            return String(value ?? '')
                .replace(/\\=/g, '=')
                .replace(/\\r/g, '\r')
                .replace(/\\n/g, '\n')
                .replace(/\\\\/g, '\\');
        }

        function serializeToonRequest({
            model,
            messages,
            temperature,
            maxCompletionTokens,
            topP,
            stream,
            reasoningEffort,
            stop
        }) {
            const lines = [
                'TOON/1.0',
                `model=${encodeToonValue(model)}`,
                `temperature=${temperature}`,
                `max_completion_tokens=${maxCompletionTokens}`,
                `top_p=${topP}`,
                `stream=${stream ? 'true' : 'false'}`,
                `reasoning_effort=${encodeToonValue(reasoningEffort)}`
            ];

            if (stop) {
                const stopValue = Array.isArray(stop)
                    ? stop.map(encodeToonValue).join('|')
                    : encodeToonValue(stop);
                lines.push(`stop=${stopValue}`);
            }

            lines.push(`messages=${messages.length}`);
            messages.forEach((message, index) => {
                lines.push(`message.${index}.role=${encodeToonValue(message.role)}`);
                lines.push(`message.${index}.content=${encodeToonValue(message.content)}`);
            });

            return lines.join('\n');
        }

        async function streamGroqChatCompletion({
            messages,
            temperature = 1,
            maxCompletionTokens = 8192,
            topP = 1,
            reasoningEffort = 'medium',
            stop = null,
            onToken
        }) {
            if (!GROQ_API_KEY) {
                throw new Error('GROQ_API_KEY no configurada. Define la clave en env.js antes de usar Groq.');
            }

            const response = await fetch(`${GROQ_API_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/toon',
                    Accept: 'text/toon',
                    Authorization: `Bearer ${GROQ_API_KEY}`
                },
                body: serializeToonRequest({
                    model: GROQ_MODEL,
                    messages,
                    temperature,
                    maxCompletionTokens,
                    topP,
                    stream: true,
                    reasoningEffort,
                    stop
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Groq error ${response.status}: ${errorBody}`);
            }

            if (!response.body) {
                throw new Error('La respuesta de Groq no incluye un stream legible.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:')) continue;

                    const payload = trimmed.replace(/^data:\s*/, '');
                    if (payload === '[DONE]') {
                        return;
                    }

                    const token = decodeToonValue(payload);
                    if (token && typeof onToken === 'function') {
                        onToken(token, payload);
                    }
                }
            }
        }

        window.groqChatStream = async function groqChatStream(prompt, options = {}) {
            const messages = options.messages || [{ role: 'user', content: prompt }];
            let fullText = '';

            await streamGroqChatCompletion({
                messages,
                temperature: options.temperature ?? 1,
                maxCompletionTokens: options.maxCompletionTokens ?? 8192,
                topP: options.topP ?? 1,
                reasoningEffort: options.reasoningEffort ?? 'medium',
                stop: options.stop ?? null,
                onToken: (token, payload) => {
                    fullText += token;
                    if (typeof options.onToken === 'function') {
                        options.onToken(token, payload);
                    }
                }
            });

            return fullText;
        };


async function streamGroqChatCompletionWithConfig(options) {
    if (!apiClientConfig.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY no configurada. Define la clave en env.js antes de usar Groq.');
    }

    return streamGroqChatCompletion(options);
}

window.apiClientConfig = apiClientConfig;
window.streamGroqChatCompletionWithConfig = streamGroqChatCompletionWithConfig;
window.apiClientModule = {
    apiClientConfig,
    encodeToonValue,
    decodeToonValue,
    serializeToonRequest,
    streamGroqChatCompletion,
    streamGroqChatCompletionWithConfig
};
