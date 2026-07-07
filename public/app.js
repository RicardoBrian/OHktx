const $ = (sel) => document.querySelector(sel);

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function showMain(show) {
  $("#mainView").hidden = !show;
  $("#loginView").hidden = show;
  $("#logoutBtn").hidden = !show;
}

async function checkSession() {
  const { authed } = await api("/session");
  showMain(authed);
  if (authed) await refreshAll();
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginError").hidden = true;
  try {
    await api("/login", { method: "POST", body: JSON.stringify({ password: $("#loginPassword").value }) });
    $("#loginPassword").value = "";
    showMain(true);
    await refreshAll();
  } catch (err) {
    $("#loginError").textContent = err.message;
    $("#loginError").hidden = false;
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  showMain(false);
});

async function loadSettings() {
  const s = await api("/settings");
  $("#korailStatus").textContent = s.hasKorailAccount ? `등록됨 (${s.korailId})` : "미등록";
  $("#paymentStatus").textContent = s.hasPayment ? `등록됨 (**** ${s.cardNumber})` : "미등록";
  $("#telegramStatus").textContent = s.telegramConfigured ? "연동됨" : "미연동 (인앱 알림만 사용)";
}

$("#korailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/settings/korail-account", {
    method: "POST",
    body: JSON.stringify({ id: $("#korailId").value, password: $("#korailPw").value }),
  });
  $("#korailId").value = "";
  $("#korailPw").value = "";
  await loadSettings();
});

$("#paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/settings/payment", {
    method: "POST",
    body: JSON.stringify({
      cardNumber: $("#cardNumber").value,
      expiry: $("#cardExpiry").value,
      birthOrBizNo: $("#cardBirth").value,
      cardPassword: $("#cardPassword").value,
    }),
  });
  $("#cardNumber").value = "";
  $("#cardExpiry").value = "";
  $("#cardBirth").value = "";
  $("#cardPassword").value = "";
  await loadSettings();
});

function fmtHM(v) {
  return v ? v.replace(":", "") + "00" : "000000";
}

$("#watchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/watches", {
    method: "POST",
    body: JSON.stringify({
      depStation: $("#depStation").value,
      arrStation: $("#arrStation").value,
      travelDate: $("#travelDate").value.replaceAll("-", ""),
      timeFrom: fmtHM($("#timeFrom").value),
      timeTo: fmtHM($("#timeTo").value),
      trainType: $("#trainType").value,
      seatType: $("#seatType").value,
      passengerCount: Number($("#passengerCount").value),
      autoPay: $("#autoPay").checked,
    }),
  });
  e.target.reset();
  await loadWatches();
});

async function loadWatches() {
  const watches = await api("/watches");
  const tbody = $("#watchTable tbody");
  tbody.innerHTML = "";
  for (const w of watches) {
    const tr = document.createElement("tr");
    const dateStr = `${w.travel_date.slice(0, 4)}-${w.travel_date.slice(4, 6)}-${w.travel_date.slice(6, 8)}`;
    tr.innerHTML = `
      <td>${w.dep_station} → ${w.arr_station}</td>
      <td>${dateStr} ${w.time_from.slice(0, 2)}:${w.time_from.slice(2, 4)}~${w.time_to.slice(0, 2)}:${w.time_to.slice(2, 4)}</td>
      <td>${w.train_type === "ktx" ? "KTX" : "전체"} / ${w.seat_type} / ${w.passenger_count}인${w.auto_pay ? " / 자동결제" : ""}</td>
      <td>${w.status}</td>
      <td>${w.last_checked_at ?? "-"}</td>
      <td></td>
    `;
    const actionsTd = tr.querySelector("td:last-child");

    if (w.status === "active") {
      const pauseBtn = document.createElement("button");
      pauseBtn.textContent = "일시정지";
      pauseBtn.className = "ghost";
      pauseBtn.onclick = async () => {
        await api(`/watches/${w.id}`, { method: "PATCH", body: JSON.stringify({ status: "paused" }) });
        await loadWatches();
      };
      actionsTd.appendChild(pauseBtn);
    } else if (w.status === "paused") {
      const resumeBtn = document.createElement("button");
      resumeBtn.textContent = "재개";
      resumeBtn.onclick = async () => {
        await api(`/watches/${w.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
        await loadWatches();
      };
      actionsTd.appendChild(resumeBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.textContent = "삭제";
    delBtn.className = "ghost";
    delBtn.style.marginLeft = "6px";
    delBtn.onclick = async () => {
      if (!confirm("이 감시를 삭제할까요?")) return;
      await api(`/watches/${w.id}`, { method: "DELETE" });
      await loadWatches();
    };
    actionsTd.appendChild(delBtn);

    tbody.appendChild(tr);
  }
}

async function loadEvents() {
  const events = await api("/events?limit=100");
  const list = $("#eventList");
  list.innerHTML = "";
  for (const ev of events) {
    const li = document.createElement("li");
    li.className = ev.level;
    li.textContent = `[${ev.created_at}] ${ev.message}`;
    list.appendChild(li);
  }
}

async function refreshAll() {
  await Promise.all([loadSettings(), loadWatches(), loadEvents()]);
}

checkSession();
setInterval(() => {
  if (!$("#mainView").hidden) refreshAll().catch(console.error);
}, 10000);
