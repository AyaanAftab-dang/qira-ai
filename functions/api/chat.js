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

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${context.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `
You are QIRA,
Quick Intelligent Response Assistant.

Be helpful, friendly, clear and accurate.
Give simple explanations when appropriate.
`
            },
            ...messages.map(m => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content
            }))
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.error?.message || "Groq request failed"
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "I couldn't generate a response.";

    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: "Something went wrong." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
