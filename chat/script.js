const CONFIG = {
    API_URL: "/api/chat",

    HEADERS: {},

    SUGGESTIONS: [
        "What can you do?",
        "Help me write an email",
        "Explain something simply",
        "Plan my week"
    ],

    CODE_SUGGESTIONS: [
        "Write a Python script",
        "Explain this error",
        "Build a landing page in HTML",
        "Review my code"
    ]
};


const $ = id => document.getElementById(id);

const chat = $("chat");
const main = $("main");
const input = $("input");
const sendBtn = $("send");

let chats = [];
let current = null;
let busy = false;

let view = "chat";
let tab = "chats";
let ctx = {};

let D = {
    projects: [],
    tasks: [],

    s: {
        name: "",
        instr: "",
        accent: "#8f92ff",
        theme: "dark",
        bg: "aurora"
    }
};


/* =========================
   HELPERS
========================= */

const esc = s =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");


const timeStr = ts =>
    ts
        ? new Date(ts).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        })
        : "";


const uid = () =>
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);


function toast(message) {

    const e = $("toast");

    e.textContent = message;

    e.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        e.classList.remove("show");
    }, 1700);
}


async function copy(text) {

    try {

        await navigator.clipboard.writeText(text);

        toast("Copied");

    } catch {

        toast("Couldn't copy");

    }
}


function download(name, text) {

    const a = document.createElement("a");

    a.href = URL.createObjectURL(
        new Blob([text], {
            type: "text/plain"
        })
    );

    a.download = name;

    a.click();

    setTimeout(() => {
        URL.revokeObjectURL(a.href);
    }, 1000);
}


function el(tag, cls, txt) {

    const e = document.createElement(tag);

    if (cls) e.className = cls;

    if (txt != null) {
        e.textContent = txt;
    }

    return e;
}


function scrollDown() {

    main.scrollTo({
        top: main.scrollHeight,
        behavior: "smooth"
    });
}


const projOf = c =>
    D.projects.find(p => p.id === c.projectId);


/* =========================
   MARKDOWN
========================= */

function inline(text) {

    return esc(text)

        .replace(
            /`([^`\n]+)`/g,
            "<code>$1</code>"
        )

        .replace(
            /\*\*([^*\n]+)\*\*/g,
            "<strong>$1</strong>"
        )

        .replace(
            /(^|[\s(])\*([^*\n]+)\*/g,
            "$1<em>$2</em>"
        )

        .replace(
            /\bhttps?:\/\/[^\s<)]+/g,
            url =>
                '<a href="' +
                url +
                '" target="_blank" rel="noopener noreferrer">' +
                url +
                "</a>"
        );
}


function md(src) {

    const blocks = [];

    src = String(src).replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        (match, lang, code) => {

            blocks.push(
                '<div class="code">' +
                '<div class="ch">' +
                '<span>' +
                esc(lang || "code") +
                '</span>' +
                '<button class="cp" type="button">Copy</button>' +
                '</div>' +
                '<pre><code>' +
                esc(code.replace(/\n$/, "")) +
                '</code></pre>' +
                '</div>'
            );

            return "\n@@" +
                (blocks.length - 1) +
                "@@\n";
        }
    );


    const output = [];

    let list = null;
    let paragraph = [];


    const finishParagraph = () => {

        if (paragraph.length) {

            output.push(
                "<p>" +
                paragraph.join("<br>") +
                "</p>"
            );

            paragraph = [];
        }
    };


    const finishList = () => {

        if (list) {

            output.push(
                "<" +
                list.type +
                ">" +

                list.items
                    .map(item =>
                        "<li>" +
                        item +
                        "</li>"
                    )
                    .join("") +

                "</" +
                list.type +
                ">"
            );

            list = null;
        }
    };


    src.split("\n").forEach(line => {

        let match;


        if (
            (match =
                line.match(/^@@(\d+)@@$/))
        ) {

            finishParagraph();
            finishList();

            output.push(
                blocks[Number(match[1])]
            );

        }

        else if (
            (match =
                line.match(/^\s*[-*]\s+(.*)/))
        ) {

            finishParagraph();

            if (!list || list.type !== "ul") {

                finishList();

                list = {
                    type: "ul",
                    items: []
                };
            }

            list.items.push(
                inline(match[1])
            );

        }

        else if (
            (match =
                line.match(/^\s*\d+[.)]\s+(.*)/))
        ) {

            finishParagraph();

            if (!list || list.type !== "ol") {

                finishList();

                list = {
                    type: "ol",
                    items: []
                };
            }

            list.items.push(
                inline(match[1])
            );

        }

        else if (
            (match =
                line.match(/^#{1,4}\s+(.*)/))
        ) {

            finishParagraph();
            finishList();

            output.push(
                "<h3>" +
                inline(match[1]) +
                "</h3>"
            );

        }

        else if (!line.trim()) {

            finishParagraph();
            finishList();

        }

        else {

            finishList();

            paragraph.push(
                inline(line)
            );
        }
    });


    finishParagraph();
    finishList();

    return output.join("");
}


/* =========================
   STORAGE
========================= */

function save() {

    try {

        localStorage.setItem(
            "qira_chats",
            JSON.stringify(chats)
        );

        localStorage.setItem(
            "qira_data",
            JSON.stringify(D)
        );

    } catch {}
}


function load() {

    try {

        chats = JSON.parse(
            localStorage.getItem(
                "qira_chats"
            ) || "[]"
        );

    } catch {

        chats = [];

    }


    try {

        const data = JSON.parse(
            localStorage.getItem(
                "qira_data"
            ) || "null"
        );

        if (data) {

            D.projects =
                data.projects || [];

            D.tasks =
                data.tasks || [];

            Object.assign(
                D.s,
                data.s || {}
            );
        }

    } catch {}
}


/* =========================
   SETTINGS
========================= */

function applySettings() {

    const root =
        document.documentElement;

    root.dataset.theme =
        D.s.theme;

    root.dataset.bg =
        D.s.bg;

    root.style.setProperty(
        "--accent-base",
        D.s.accent
    );


    $("theme").textContent =
        D.s.theme === "dark"
            ? "Light"
            : "Dark";


    $("mename").textContent =
        D.s.name || "You";


    $("av").textContent =
        (D.s.name || "Q")
            .trim()
            .charAt(0)
            .toUpperCase();
}


/* =========================
   VIEWS
========================= */

const TITLES = {

    projects: "Projects",

    artifacts: "Artifacts",

    custom: "Customize"
};


function setView(v) {

    view = v;

    document
        .querySelectorAll(".view")
        .forEach(section =>
            section.classList.remove("active")
        );


    const id = {

        chat: "vChat",

        projects: "vProjects",

        artifacts: "vArtifacts",

        custom: "vCustom"

    }[v];


    $(id).classList.add("active");


    document
        .querySelectorAll(".nav button")
        .forEach(button =>
            button.classList.remove("on")
        );


    if (v === "projects")
        renderProjects();

    if (v === "artifacts")
        renderArtifacts();

    if (v === "custom")
        renderCustom();


    setTitle();

    closeSide();
}


function setTitle() {

    if (view !== "chat") {

        $("ttl").textContent =
            TITLES[view];

        return;
    }


    if (current) {

        $("ttl").textContent =
            current.title;

        return;
    }


    if (ctx.mode === "code") {

        $("ttl").textContent =
            "Code";

        return;
    }


    if (ctx.projectId) {

        const project =
            D.projects.find(
                p => p.id === ctx.projectId
            );

        if (project) {

            $("ttl").textContent =
                project.name;

            return;
        }
    }


    $("ttl").textContent =
        "New chat";
}


function openSide() {

    $("side").classList.add("open");

    $("scrim").classList.add("open");
}


function closeSide() {

    $("side").classList.remove("open");

    $("scrim").classList.remove("open");
}


/* =========================
   NEW CHAT
========================= */

function newChat(context) {

    if (busy) return;

    current = null;

    ctx = context || {};

    setView("chat");

    showEmpty();

    renderSide();

    input.focus();
}


function greeting() {

    const hour =
        new Date().getHours();


    const greeting =
        hour < 5
            ? "Still up"
            : hour < 12
                ? "Good morning"
                : hour < 18
                    ? "Good afternoon"
                    : "Good evening";


    return greeting +
        (D.s.name
            ? ", " + D.s.name
            : "") +
        ".";
}


function showEmpty() {

    chat.innerHTML = "";


    const project =
        ctx.projectId
            ? D.projects.find(
                x => x.id === ctx.projectId
            )
            : null;


    const container =
        el("div", "empty");


    const title =
        el(
            "h1",
            null,

            ctx.mode === "code"
                ? "What are we building?"
                : project
                    ? project.name
                    : greeting()
        );


    const subtitle =
        el(
            "p",
            null,

            ctx.mode === "code"
                ? "Coding mode. Ask for code, fixes or reviews."
                : project
                    ? "Qira will follow this project's instructions in this chat."
                    : "I'm Qira. Ask me anything, or start with one of these."
        );


    const chips =
        el("div", "chips");


    const suggestions =
        ctx.mode === "code"
            ? CONFIG.CODE_SUGGESTIONS
            : CONFIG.SUGGESTIONS;


    suggestions.forEach(text => {

        const button =
            el("button", null, text);


        button.onclick = () =>
            send(text);


        chips.appendChild(button);
    });


    container.append(
        title,
        subtitle,
        chips
    );


    chat.appendChild(container);

    setTitle();
}


/* =========================
   OPEN CHAT
========================= */

function openChat(c) {

    if (busy) return;

    current = c;

    ctx = {};

    chat.innerHTML = "";


    c.messages.forEach(message => {

        if (message.role === "user") {

            addUser(
                message.content,
                message.ts
            );

        } else {

            addAI(
                message.content,
                message.ts
            );
        }
    });


    setView("chat");

    renderSide();

    scrollDown();

    input.focus();
}


/* =========================
   MESSAGES
========================= */

function addUser(text, ts) {

    const message =
        el("div", "msg user");


    message.append(

        el(
            "div",
            "bub",
            text
        ),

        el(
            "div",
            "meta",
            timeStr(ts)
        )
    );


    chat.appendChild(message);

    scrollDown();
}


function addAI(text, ts, options) {

    options =
        options || {};


    const message =
        el("div", "msg ai");


    const column =
        el("div", "col");


    const body =
        el("div", "md");


    const meta =
        el("div", "meta");


    column.append(
        body,
        meta
    );


    message.append(
        el("span", "mark"),
        column
    );


    chat.appendChild(message);


    message.setBody =
        function(reply, time, error) {

            body.innerHTML =
                md(reply);


            message.classList.toggle(
                "err",
                !!error
            );


            meta.innerHTML = "";


            if (!error) {

                const copyButton =
                    el(
                        "button",
                        null,
                        "Copy"
                    );


                copyButton.onclick =
                    () => copy(reply);


                const regenerateButton =
                    el(
                        "button",
                        "regen",
                        "Regenerate"
                    );


                regenerateButton.onclick =
                    regenerate;


                meta.append(
                    el(
                        "span",
                        null,
                        timeStr(time)
                    ),

                    copyButton,

                    regenerateButton
                );

            } else {

                const retry =
                    el(
                        "button",
                        null,
                        "Try again"
                    );


                retry.onclick =
                    () => {

                        message.remove();

                        generate();
                    };


                meta.append(retry);
            }


            scrollDown();
        };


    message.setPending =
        function() {

            body.innerHTML =
                '<span class="dots">' +
                '<span></span>' +
                '<span></span>' +
                '</span>';


            meta.innerHTML = "";
        };


    if (options.pending) {

        message.setPending();

    } else {

        message.setBody(
            text,
            ts
        );
    }


    scrollDown();

    return message;
}


/* =========================
   HISTORY
========================= */

function dayLabel(ts) {

    const date =
        new Date(ts);

    const now =
        new Date();

    const yesterday =
        new Date();

    yesterday.setDate(
        now.getDate() - 1
    );


    if (
        date.toDateString() ===
        now.toDateString()
    ) {

        return "Today";
    }


    if (
        date.toDateString() ===
        yesterday.toDateString()
    ) {

        return "Yesterday";
    }


    return date.toLocaleDateString(
        [],
        {
            month: "long",
            day: "numeric",
            year:
                date.getFullYear() !==
                now.getFullYear()
                    ? "numeric"
                    : undefined
        }
    );
}


function ib(
    cls,
    label,
    text,
    fn
) {

    const button =
        el(
            "button",
            "ib " + cls,
            text
        );


    button.setAttribute(
        "aria-label",
        label
    );


    button.title = label;


    button.onclick = event => {

        event.stopPropagation();

        fn();
    };


    return button;
}


function exportChat(c) {

    const name =
        c.title
            .replace(/[^\w]+/g, "-")
            .slice(0, 30)
            .toLowerCase();


    download(
        "qira-" +
        name +
        ".txt",

        c.title +
        "\n\n" +

        c.messages
            .map(message =>
                (
                    message.role === "user"
                        ? "You"
                        : "Qira AI"
                ) +

                ":\n" +

                message.content
            )
            .join("\n\n")
    );
}


function renderSide() {

    const list =
        $("slist");


    list.innerHTML = "";


    const query =
        $("sq").value
            .trim()
            .toLowerCase();


    if (tab === "tasks") {

        const open =
            D.tasks.filter(
                task => !task.done
            ).length;


        if (!D.tasks.length) {

            list.appendChild(
                el(
                    "div",
                    "none",
                    "No tasks yet. Type one above and press Enter."
                )
            );

            return;
        }


        list.appendChild(
            el(
                "div",
                "grp",
                open +
                " open · " +
                (D.tasks.length - open) +
                " done"
            )
        );


        D.tasks.forEach(task => {

            const row =
                el(
                    "div",
                    "row task" +
                    (
                        task.done
                            ? " done"
                            : ""
                    )
                );


            const checkbox =
                el("input");


            checkbox.type =
                "checkbox";


            checkbox.checked =
                task.done;


            checkbox.onchange =
                () => {

                    task.done =
                        checkbox.checked;

                    save();

                    renderSide();
                };


            const actions =
                el("div", "acts");


            actions.append(
                ib(
                    "del",
                    "Delete task",
                    "×",
                    () => {

                        D.tasks =
                            D.tasks.filter(
                                x => x !== task
                            );

                        save();

                        renderSide();
                    }
                )
            );


            row.append(
                checkbox,

                el(
                    "span",
                    null,
                    task.text
                ),

                actions
            );


            list.appendChild(row);
        });


        return;
    }


    const filtered =
        [...chats]
            .sort(
                (a,b) =>
                    b.updated -
                    a.updated
            )
            .filter(c =>
                !query ||
                c.title
                    .toLowerCase()
                    .includes(query) ||

                c.messages.some(
                    message =>
                        message.content
                            .toLowerCase()
                            .includes(query)
                )
            );


    if (!filtered.length) {

        list.appendChild(
            el(
                "div",
                "none",

                chats.length
                    ? "No chats match your search."
                    : "No past chats yet. Send a message and it will show up here."
            )
        );

        return;
    }


    let lastGroup = "";


    filtered.forEach(c => {

        const group =
            dayLabel(c.updated);


        if (group !== lastGroup) {

            list.appendChild(
                el(
                    "div",
                    "grp",
                    group
                )
            );

            lastGroup = group;
        }


        const row =
            el(
                "div",
                "row" +
                (
                    current &&
                    current.id === c.id
                        ? " on"
                        : ""
                )
            );


        const open =
            el("button", "open");


        const project =
            projOf(c);


        open.append(

            el(
                "span",
                "t",
                c.title
            ),

            el(
                "span",
                "d",

                (
                    project
                        ? project.name + " · "
                        : c.mode === "code"
                            ? "Code · "
                            : ""
                ) +

                c.messages.length +

                (
                    c.messages.length === 1
                        ? " message"
                        : " messages"
                )
            )
        );


        open.onclick =
            () => openChat(c);


        const actions =
            el("div", "acts");


        actions.append(

            ib(
                "",
                "Rename chat",
                "✎",

                () => {

                    const name =
                        prompt(
                            "Rename chat",
                            c.title
                        );


                    if (
                        name &&
                        name.trim()
                    ) {

                        c.title =
                            name
                                .trim()
                                .slice(0,80);

                        save();

                        renderSide();

                        setTitle();
                    }
                }
            ),


            ib(
                "",
                "Download chat",
                "↓",

                () =>
                    exportChat(c)
            ),


            ib(
                "del",
                "Delete chat",
                "×",

                () => {

                    if (busy) return;


                    chats =
                        chats.filter(
                            x => x !== c
                        );


                    save();


                    if (
                        current === c
                    ) {

                        newChat();

                    } else {

                        renderSide();
                    }
                }
            )
        );


        row.append(
            open,
            actions
        );


        list.appendChild(row);
    });
}


/* =========================
   PROJECTS
========================= */

function renderProjects() {

    const grid =
        $("pgrid");


    grid.innerHTML = "";


    if (!D.projects.length) {

        grid.appendChild(
            el(
                "div",
                "none",
                "No projects yet. Create one to give Qira standing instructions."
            )
        );

        return;
    }


    D.projects.forEach(project => {

        const card =
            el("div", "card");


        const count =
            chats.filter(
                c =>
                    c.projectId ===
                    project.id
            ).length;


        const actions =
            el("div", "acts2");


        const start =
            el(
                "button",
                "solid",
                "Start chat"
            );


        start.onclick =
            () =>
                newChat({
                    projectId:
                        project.id
                });


        const remove =
            el(
                "button",
                "ghost",
                "Delete"
            );


        remove.onclick =
            () => {

                if (
                    confirm(
                        'Delete project "' +
                        project.name +
                        '"? Its chats stay in History.'
                    )
                ) {

                    D.projects =
                        D.projects.filter(
                            p => p !== project
                        );

                    save();

                    renderProjects();
                }
            };


        actions.append(
            start,
            remove
        );


        card.append(

            el(
                "h3",
                null,
                project.name
            ),

            el(
                "p",
                null,
                project.instr ||
                    "No instructions."
            ),

            el(
                "p",
                null,
                count +
                (
                    count === 1
                        ? " chat"
                        : " chats"
                )
            ),

            actions
        );


        grid.appendChild(card);
    });
}


/* =========================
   ARTIFACTS
========================= */

const EXT = {

    javascript: "js",
    js: "js",
    python: "py",
    py: "py",
    html: "html",
    css: "css",
    json: "json",
    bash: "sh",
    sh: "sh",
    ts: "ts",
    typescript: "ts",
    java: "java",
    cpp: "cpp",
    c: "c",
    sql: "sql"
};


function renderArtifacts() {

    const grid =
        $("agrid");


    grid.innerHTML = "";


    let count = 0;


    [...chats]
        .sort(
            (a,b) =>
                b.updated -
                a.updated
        )
        .forEach(c => {

            c.messages.forEach(message => {

                if (
                    message.role !==
                    "assistant"
                ) return;


                for (
                    const match of
                    message.content.matchAll(
                        /```(\w*)\n?([\s\S]*?)```/g
                    )
                ) {

                    count++;


                    const language =
                        match[1] ||
                        "text";


                    const code =
                        match[2]
                            .replace(
                                /\n$/,
                                ""
                            );


                    const card =
                        el(
                            "div",
                            "card"
                        );


                    const actions =
                        el(
                            "div",
                            "acts2"
                        );


                    const copyButton =
                        el(
                            "button",
                            "ghost",
                            "Copy"
                        );


                    copyButton.onclick =
                        () => copy(code);


                    const downloadButton =
                        el(
                            "button",
                            "ghost",
                            "Download"
                        );


                    downloadButton.onclick =
                        () =>
                            download(
                                "qira-artifact." +
                                (
                                    EXT[
                                        language
                                            .toLowerCase()
                                    ] ||
                                    "txt"
                                ),
                                code
                            );


                    const openButton =
                        el(
                            "button",
                            "ghost",
                            "Open chat"
                        );


                    openButton.onclick =
                        () =>
                            openChat(c);


                    actions.append(
                        copyButton,
                        downloadButton,
                        openButton
                    );


                    card.append(

                        el(
                            "h3",
                            null,
                            language
                        ),

                        el(
                            "p",
                            null,
                            c.title
                        ),

                        el(
                            "pre",
                            null,
                            code
                                .split("\n")
                                .slice(0,6)
                                .join("\n")
                        ),

                        actions
                    );


                    grid.appendChild(card);
                }
            });
        });


    if (!count) {

        grid.appendChild(
            el(
                "div",
                "none",
                "No artifacts yet. Ask Qira to write some code and it will appear here."
            )
        );
    }
}


/* =========================
   CUSTOMIZE
========================= */

function seg(id, options, key) {

    const box =
        $(id);


    box.innerHTML = "";


    options.forEach(
        ([value,label]) => {

            const button =
                el(
                    "button",

                    D.s[key] === value
                        ? "on"
                        : "",

                    label
                );


            button.onclick =
                () => {

                    D.s[key] =
                        value;

                    save();

                    applySettings();

                    seg(
                        id,
                        options,
                        key
                    );
                };


            box.appendChild(button);
        }
    );
}


function renderCustom() {

    $("cname").value =
        D.s.name;


    $("cinstr").value =
        D.s.instr;


    seg(
        "sTheme",
        [
            ["dark","Dark"],
            ["light","Light"]
        ],
        "theme"
    );


    seg(
        "sBg",
        [
            ["aurora","Aurora"],
            ["grid","Grid"],
            ["plain","Plain"]
        ],
        "bg"
    );


    const sw =
        $("sAccent");


    sw.innerHTML = "";


    [
        ["#8f92ff","Indigo"],
        ["#4fd1c5","Teal"],
        ["#ff8fab","Rose"],
        ["#f5b84b","Amber"],
        ["#7ed98b","Green"]
    ]
    .forEach(
        ([color,name]) => {

            const button =
                el(
                    "button",

                    D.s.accent === color
                        ? "on"
                        : ""
                );


            button.style.background =
                color;


            button.setAttribute(
                "aria-label",
                name
            );


            button.title =
                name;


            button.onclick =
                () => {

                    D.s.accent =
                        color;

                    save();

                    applySettings();

                    renderCustom();
                };


            sw.appendChild(button);
        }
    );
}


/* =========================
   AI SYSTEM PROMPT
========================= */

function systemFor(c) {

    const project =
        projOf(c);


    const parts = [];


    parts.push(
        "You are Qira AI, a helpful AI assistant."
    );


    parts.push(
        "Give clear, useful and accurate answers."
    );


    if (D.s.name) {

        parts.push(
            "The user's name is " +
            D.s.name +
            "."
        );
    }


    if (D.s.instr) {

        parts.push(
            D.s.instr
        );
    }


    if (
        project &&
        project.instr
    ) {

        parts.push(
            'Project "' +
            project.name +
            '": ' +
            project.instr
        );
    }


    if (
        c.mode === "code"
    ) {

        parts.push(
            "Coding mode: provide clear working code in fenced code blocks with brief explanations."
        );
    }


    return parts.join("\n\n");
}


/* =========================
   TALK TO YOUR CLOUDFLARE API
========================= */

async function askAI(c) {

    const response =
        await fetch(
            CONFIG.API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    ...CONFIG.HEADERS
                },

                body: JSON.stringify({

                    messages:
                        c.messages,

                    system:
                        systemFor(c)

                })
            }
        );


    let data;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "The server returned an invalid response."
        );
    }


    if (!response.ok) {

        throw new Error(
            data.error ||
            data.message ||
            "Server error " +
            response.status
        );
    }


    const reply =
        data.reply ??
        data.response ??
        data.message ??
        data.text ??
        data.output ??
        (
            data.choices &&
            data.choices[0] &&
            (
                data.choices[0]
                    .message?.content ??
                data.choices[0].text
            )
        );


    if (
        typeof reply !==
        "string"
    ) {

        throw new Error(
            "The server did not return a reply."
        );
    }


    return reply;
}


/* =========================
   GENERATE
========================= */

async function generate() {

    busy = true;

    sendBtn.disabled = true;


    const conversation =
        current;


    const message =
        addAI(
            "",
            0,
            {
                pending: true
            }
        );


    try {

        const reply =
            await askAI(
                conversation
            );


        const timestamp =
            Date.now();


        conversation.messages.push({

            role: "assistant",

            content: reply,

            ts: timestamp
        });


        conversation.updated =
            timestamp;


        save();


        if (
            current ===
            conversation
        ) {

            message.setBody(
                reply,
                timestamp
            );
        }


    } catch (error) {

        console.error(
            "QIRA API ERROR:",
            error
        );


        message.setBody(

            "Couldn't reach Qira AI. " +
            error.message,

            0,

            true
        );
    }


    busy = false;

    sendBtn.disabled = false;


    renderSide();

    scrollDown();
}


/* =========================
   SEND
========================= */

function send(text) {

    text =
        (
            text ??
            input.value
        ).trim();


    if (!text || busy)
        return;


    if (!current) {

        current = {

            id: uid(),

            title:
                text.slice(0,50),

            updated:
                Date.now(),

            messages: [],

            projectId:
                ctx.projectId ||
                null,

            mode:
                ctx.mode ||
                null
        };


        chats.push(
            current
        );


        chat.innerHTML = "";

        ctx = {};
    }


    input.value = "";

    input.style.height =
        "auto";


    const timestamp =
        Date.now();


    current.messages.push({

        role: "user",

        content: text,

        ts: timestamp
    });


    current.updated =
        timestamp;


    save();


    addUser(
        text,
        timestamp
    );


    setTitle();

    renderSide();

    generate();
}


/* =========================
   REGENERATE
========================= */

function regenerate() {

    if (
        busy ||
        !current
    ) return;


    const last =
        current.messages[
            current.messages.length - 1
        ];


    if (
        last &&
        last.role === "assistant"
    ) {

        current.messages.pop();

        save();
    }


    const elements =
        chat.querySelectorAll(
            ".msg.ai"
        );


    if (elements.length) {

        elements[
            elements.length - 1
        ].remove();
    }


    generate();
}


/* =========================
   EVENTS
========================= */

sendBtn.onclick =
    () => send();


input.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {

            event.preventDefault();

            send();
        }
    }
);


input.addEventListener(
    "input",
    () => {

        input.style.height =
            "auto";

        input.style.height =
            input.scrollHeight +
            "px";
    }
);


chat.addEventListener(
    "click",
    event => {

        if (
            event.target.classList
                .contains("cp")
        ) {

            copy(
                event.target
                    .closest(".code")
                    .querySelector("code")
                    .textContent
            );
        }
    }
);


/* NAV */

document
    .querySelectorAll(
        ".nav [data-go]"
    )
    .forEach(button => {

        button.onclick =
            () => {

                const go =
                    button.dataset.go;


                if (go === "new") {

                    newChat();

                }

                else if (
                    go === "code"
                ) {

                    newChat({
                        mode: "code"
                    });

                }

                else {

                    setView(go);
                }
            };
    });


/* TABS */

document
    .querySelectorAll(
        ".tabs [data-tab]"
    )
    .forEach(button => {

        button.onclick =
            () => {

                tab =
                    button.dataset.tab;


                document
                    .querySelectorAll(
                        ".tabs button"
                    )
                    .forEach(
                        item =>
                            item.classList.toggle(
                                "on",
                                item === button
                            )
                    );


                $("sq").value = "";


                $("sq").placeholder =
                    tab === "chats"
                        ? "Search your chats"
                        : "Add a task and press Enter";


                $("sq").type =
                    tab === "chats"
                        ? "search"
                        : "text";


                renderSide();
            };
    });


/* SEARCH */

$("sq").addEventListener(
    "input",
    () => {

        if (
            tab === "chats"
        ) {

            renderSide();
        }
    }
);


$("sq").addEventListener(
    "keydown",
    event => {

        if (
            tab === "tasks" &&
            event.key === "Enter" &&
            event.target.value.trim()
        ) {

            D.tasks.unshift({

                text:
                    event.target.value
                        .trim()
                        .slice(0,120),

                done: false
            });


            event.target.value = "";

            save();

            renderSide();
        }
    }
);


/* MOBILE MENU */

$("menu").onclick =
    openSide;


$("sclose").onclick =
    closeSide;


$("scrim").onclick =
    closeSide;


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeSide();
        }
    }
);


/* THEME */

$("theme").onclick =
    () => {

        D.s.theme =
            D.s.theme === "dark"
                ? "light"
                : "dark";


        save();

        applySettings();


        if (
            view === "custom"
        ) {

            renderCustom();
        }
    };


/* PROJECT CREATION */

$("pnew").onclick =
    () => {

        $("pform").hidden =
            !$("pform").hidden;


        if (
            !$("pform").hidden
        ) {

            $("pname").focus();
        }
    };


$("pmake").onclick =
    () => {

        const name =
            $("pname").value
                .trim();


        if (!name) {

            toast(
                "Give the project a name"
            );

            return;
        }


        D.projects.unshift({

            id: uid(),

            name,

            instr:
                $("pinstr")
                    .value
                    .trim()
        });


        save();


        $("pname").value = "";

        $("pinstr").value = "";

        $("pform").hidden = true;


        renderProjects();
    };


/* CUSTOMIZATION */

$("cname").addEventListener(
    "input",
    event => {

        D.s.name =
            event.target.value;

        save();

        applySettings();
    }
);


$("cinstr").addEventListener(
    "input",
    event => {

        D.s.instr =
            event.target.value;

        save();
    }
);


/* =========================
   START
========================= */

load();

applySettings();

showEmpty();

renderSide();


$("status")
    .classList
    .toggle(
        "on",
        !!CONFIG.API_URL
    );


$("stxt").textContent =
    CONFIG.API_URL
        ? "Connected"
        : "Demo mode";
