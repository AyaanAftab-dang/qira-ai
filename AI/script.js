const messages = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const newChat = document.getElementById("newChat");

let chatHistory = [];


function addMessage(role, text) {

    const welcome = document.querySelector(".welcome");

    if (welcome) {
        welcome.remove();
    }

    const message = document.createElement("div");

    message.className = `message ${role}`;

    const avatar = document.createElement("div");

    avatar.className = "avatar";

    avatar.textContent =
        role === "user" ? "You" : "Q";


    const content = document.createElement("div");

    content.className = "message-content";

    content.textContent = text;


    message.appendChild(avatar);

    message.appendChild(content);

    messages.appendChild(message);


    messages.scrollTop = messages.scrollHeight;


    return content;
}


async function sendMessage() {

    const text = input.value.trim();

    if (!text) {
        return;
    }


    input.value = "";


    addMessage("user", text);


    chatHistory.push({
        role: "user",
        content: text
    });


    sendButton.disabled = true;


    const aiMessage = addMessage(
        "assistant",
        "Thinking..."
    );


    try {

        const response = await fetch(
            "/api/chat",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    messages: chatHistory
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.error || "Server error"
            );

        }


        aiMessage.textContent = data.reply;


        chatHistory.push({
            role: "assistant",
            content: data.reply
        });


    } catch (error) {

        console.error(error);

        aiMessage.textContent =
            "Sorry, QIRA couldn't respond right now.";

    }


    sendButton.disabled = false;

    input.focus();

}


sendButton.addEventListener(
    "click",
    sendMessage
);


input.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


newChat.addEventListener(
    "click",
    function() {

        chatHistory = [];


        messages.innerHTML = `
            <div class="welcome">

                <div class="big-logo">Q</div>

                <h1>How can I help?</h1>

                <p>Ask QIRA anything.</p>

            </div>
        `;


        input.focus();

    }
);
