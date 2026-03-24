const API = "https://crm.skch.cz/ajax0/procedure.php";

function make_base_auth(user, password) {
  return "Basic " + btoa(user + ":" + password);
}

const username = "coffe";
const password = "kafe";
const AUTH_HEADER = make_base_auth(username, password);

function saveOfflineData(payload) {
    const existing = JSON.parse(localStorage.getItem("offlineDrinks") || "[]");
    existing.push(payload);
    localStorage.setItem("offlineDrinks", JSON.stringify(existing));
}

async function resendOfflineData() {
    const data = JSON.parse(localStorage.getItem("offlineDrinks") || "[]");

    if (data.length === 0) return;

    const remaining = [];

    for (const payload of data) {
        try {
            const res = await fetch(`${API}?cmd=saveDrinks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": AUTH_HEADER
                },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                remaining.push(payload);
            }

        } catch {
            remaining.push(payload);
        }
    }

    localStorage.setItem("offlineDrinks", JSON.stringify(remaining));
}

async function getPeopleList() {
    const res = await fetch(`${API}?cmd=getPeopleList`, {
        credentials: 'include',
        headers: {
            'Authorization': AUTH_HEADER
        }
    });

    if (!res.ok) throw new Error(`getPeopleList HTTP ${res.status}`);
    return res.json();
}

async function getTypesList() {
    const res = await fetch(`${API}?cmd=getTypesList`, {
        credentials: 'include',
        headers: {
            'Authorization': AUTH_HEADER
        }
    });

    if (!res.ok) throw new Error(`getTypesList HTTP ${res.status}`);
    return res.json();
}

function fillSelect(select, data, valueKey, textKey) {
    Object.values(data).forEach(item => {
        const option = document.createElement("option");
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("drinkForm");
    const message = document.getElementById("message");
    const allDrinksDiv = document.getElementById("allDrinks");
    const button = form.querySelector("button[type='submit']");
    const personSelect = form.querySelector("select[name='person']");

    resendOfflineData();

    try {
        const [people, types] = await Promise.all([
            getPeopleList(),
            getTypesList()
        ]);

        fillSelect(form.person, people, "ID", "name");

        const savedUser = localStorage.getItem("lastUser");
        if (savedUser) {
            personSelect.value = savedUser;
        }

        Object.values(types).forEach(type => {
            allDrinksDiv.innerHTML += `
                <div class="drink-row" data-name="${type.typ}">
                    <label>${type.typ}:</label>
                    <button type="button" class="quantity-btn" data-action="minus">-</button>
                    <input type="number" min="0" value="0" readonly>
                    <button type="button" class="quantity-btn" data-action="plus">+</button>
                </div>`;
        });

    } catch (err) {
        message.textContent = "Nepodařilo se načíst data.";
        message.className = "message error";
    }

    allDrinksDiv.addEventListener("click", (e) => {
        if (!e.target.classList.contains("quantity-btn")) return;

        const input = e.target.parentElement.querySelector("input");
        let val = parseInt(input.value) || 0;

        if (e.target.dataset.action === "plus") {
            input.value = val + 1;
        } else {
            input.value = (val > 0) ? val - 1 : 0;
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        button.disabled = true;

        const payload = {
            user: form.person.value,
            drinks: Array.from(document.querySelectorAll(".drink-row")).map(row => ({
                type: row.dataset.name,
                value: Number(row.querySelector("input").value) || 0
            }))
        };

        if (!payload.user || payload.drinks.every(d => d.value === 0)) {
            message.textContent = "Vyberte osobu a alespoň jeden nápoj!";
            message.className = "message error";
            button.disabled = false;
            return;
        }

        localStorage.setItem("lastUser", payload.user);

        try {
            const res = await fetch(`${API}?cmd=saveDrinks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": AUTH_HEADER
                },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error();

            message.textContent = "Uloženo!";
            message.className = "message success";

            document.querySelectorAll(".drink-row input").forEach(i => i.value = 0);

        } catch {
            saveOfflineData(payload);

            message.textContent = "Offline - data uložena a odešlou se později.";
            message.className = "message error";
        } finally {
            button.disabled = false;
        }
    });
});

window.addEventListener("online", () => {
    resendOfflineData();
});