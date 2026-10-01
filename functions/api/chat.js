export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const messages = body.messages;

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: "Invalid messages" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        const contents = messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [
                {
                    text: m.content
                }
            ]
        }));

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": context.env.OPENAI_API_KEY
                },

                body: JSON.stringify({
                    system_instruction: {
                        parts: [
                            {
                                text: `
You are QIRA,
Quick Intelligent Response Assistant.

Be helpful, friendly, clear and accurate.
Give simple explanations when appropriate.
`
                            }
                        ]
                    },

                    contents: contents
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error:
                        data.error?.message ||
                        "Gemini request failed"
                }),
                {
                    status: response.status,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const reply =
            data.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("") ||
            "I couldn't generate a response.";

        return new Response(
            JSON.stringify({ reply }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {
        console.error(error);

        return new Response(
            JSON.stringify({
                error: "Something went wrong."
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}
