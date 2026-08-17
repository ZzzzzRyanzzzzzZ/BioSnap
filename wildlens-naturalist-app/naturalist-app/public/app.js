document.addEventListener("DOMContentLoaded", () => {

  let user = JSON.parse(localStorage.getItem("biosnap_user")) || null;
  let currentTarget = null;
  let capturedImageFile = null;
  let notebook = JSON.parse(localStorage.getItem("biosnap_notebook")) || [];

  const onboardingOverlay = document.getElementById("onboarding-overlay");
  const onboardingForm = document.getElementById("onboarding-form");
  const appRoot = document.getElementById("app-root");
  const headerSub = document.getElementById("header-sub");

  const targetImg = document.getElementById("target-img");
  const targetCommonName = document.getElementById("target-common-name");
  const targetSci = document.getElementById("target-sci");
  const targetClue = document.getElementById("target-clue");
  const targetLocation = document.getElementById("target-location");
  const targetStamp = document.getElementById("target-stamp");

  const btnReroll = document.getElementById("btn-reroll");
  const btnGoIdentify = document.getElementById("btn-go-identify");
  const btnCapture = document.getElementById("btn-capture");
  const btnGallery = document.getElementById("btn-gallery");
  const inputCamera = document.getElementById("input-camera");
  const inputGallery = document.getElementById("input-gallery");
  const previewCard = document.getElementById("preview-card");
  const previewImg = document.getElementById("preview-img");
  const btnRetake = document.getElementById("btn-retake");
  const btnIdentify = document.getElementById("btn-identify");
  const loadingCard = document.getElementById("loading-card");
  const errorCard = document.getElementById("error-card");
  const verdictCard = document.getElementById("verdict-card");

  const collectionCountEl = document.getElementById("collection-count");
  const collectionEmptyEl = document.getElementById("collection-empty");
  const collectionGridEl = document.getElementById("collection-grid");
  const achievementsGridEl = document.getElementById("achievements-grid");
  const achievementProgressEl = document.getElementById("achievement-progress");
  const detailOverlay = document.getElementById("detail-overlay");
  const detailSheet = document.getElementById("detail-sheet");

  const navTabs = document.querySelectorAll(".nav-tab");
  const viewSections = document.querySelectorAll(".view-section");

  const leaderboardListEl = document.getElementById("leaderboard-list");

  const FAKE_NEIGHBORS = [
    { username: "ForestGuardian", species: 14 },
    { username: "MossWhisperer", species: 11 },
    { username: "PetalPatrol", species: 9 },
    { username: "RootRambler", species: 7 },
    { username: "SunflowerSadie", species: 6 },
    { username: "FernFinder99", species: 4 },
    { username: "WeedWanderer", species: 2 },
    { username: "BarkBuddy", species: 1 },
  ];

  const ACHIEVEMENTS = [
    { id: "first-sprout", icon: "🌱", title: "First Sprout", description: "Successfully identify and save your first plant.", goal: 1 },
    { id: "green-thumb", icon: "🌿", title: "Green Thumb", description: "Find 5 different species.", goal: 5 },
    { id: "botanist", icon: "🌳", title: "Botanist", description: "Find 10 different species.", goal: 10 },
  ];


  if (!user) {
    onboardingOverlay.classList.remove("hidden");
    appRoot.classList.add("hidden");
  } else {
    initApp();
  }

 
  onboardingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("ob-username").value.trim();
    const region = document.getElementById("ob-region").value;
    const password = document.getElementById("ob-password").value;

    if (!username || !region) return;

    user = { username, region, password };
    localStorage.setItem("biosnap_user", JSON.stringify(user));

    onboardingOverlay.classList.add("hidden");
    appRoot.classList.remove("hidden");
    initApp();
  });

  document.getElementById("btn-signout").addEventListener("click", () => {
    localStorage.removeItem("biosnap_user");
    location.reload();
  });

  function initApp() {
    onboardingOverlay.classList.add("hidden");
    appRoot.classList.remove("hidden");
    headerSub.textContent = `exploring ${user.region}`;
    targetLocation.textContent = user.region.replace("-", " ");
    loadTargetPlant();
    renderNotebook();
    renderAchievements();
    renderLeaderboard();
  }

  async function loadTargetPlant(attempt = 0) {
    const MAX_ATTEMPTS = 4;
    try {
      const res = await fetch(`/api/target?region=${encodeURIComponent(user.region)}`);
      const data = await res.json();

      if ((!data.image || data.image.trim() === "") && attempt < MAX_ATTEMPTS) {
        return loadTargetPlant(attempt + 1);
      }

      currentTarget = data;

      targetCommonName.textContent = data.common_name;
      targetSci.textContent = data.scientific_name;
      targetClue.textContent = data.clue;
      targetImg.src = data.image || "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/A_sunflower.jpg/640px-A_sunflower.jpg";
      targetStamp.classList.add("hidden");
    } catch (err) {
      console.error("Failed to load target plant:", err);

      targetCommonName.textContent = "Yelloweyed Grass";
      targetSci.textContent = "Xyris torta";
      targetClue.textContent = "Look in wet pinelands and bogs for distinctive yellow terminal flower spikes.";
      targetImg.src = "https://upload.wikimedia.org/wikipedia/commons/3/35/Xyris_torta_Kral.jpg";
    }
  }

  btnReroll.addEventListener("click", () => {
    loadTargetPlant();
    showToast("Loaded a new target plant!");
  });

  btnGoIdentify.addEventListener("click", () => {
    document.getElementById("view-capture").scrollIntoView({ behavior: "smooth" });
  });

  btnCapture.addEventListener("click", () => inputCamera.click());
  btnGallery.addEventListener("click", () => inputGallery.click());

  [inputCamera, inputGallery].forEach(input => {
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      capturedImageFile = file;
      const reader = new FileReader();
      reader.onload = (evt) => {
        previewImg.src = evt.target.result;
        document.getElementById("capture-card").classList.add("hidden");
        previewCard.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    });
  });

  btnRetake.addEventListener("click", () => {
    capturedImageFile = null;
    previewCard.classList.add("hidden");
    document.getElementById("capture-card").classList.remove("hidden");
    previewImg.src = "";
    inputCamera.value = "";
    inputGallery.value = "";
  });

  btnIdentify.addEventListener("click", async () => {
    if (!capturedImageFile) return;

    previewCard.classList.add("hidden");
    loadingCard.classList.remove("hidden");
    errorCard.classList.add("hidden");
    verdictCard.classList.add("hidden");

    const formData = new FormData();
    formData.append("image", capturedImageFile);

    const params = new URLSearchParams();
    if (currentTarget?.scientific_name) params.set("target", currentTarget.scientific_name);
    if (currentTarget?.common_name) params.set("target_name", currentTarget.common_name);

    try {
      const res = await fetch(`/api/identify?${params.toString()}`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();

      loadingCard.classList.add("hidden");

      if (!json.success) {
        throw new Error(json.error || "Identification failed");
      }

      const parsedData = JSON.parse(json.data);
      const isMatch = !!parsedData.matches_target;

      previewCard.classList.remove("hidden");

      if (isMatch) {
        verdictCard.className = "rounded-2xl p-5 text-center shadow-sm bg-[#7A9A77]/15 border border-[#7A9A77] text-biosnapDark";
        verdictCard.innerHTML = `<p class="font-bold text-lg">Specimen analyzed successfully!</p><p class="text-sm text-slate-600 mt-1">Identified as: <strong>${parsedData.common_name || "Unknown Plant"}</strong></p>`;
        targetStamp.classList.remove("hidden");

        const newlyUnlocked = addToNotebook({
          common_name: parsedData.common_name || currentTarget?.common_name || "Unknown plant",
          scientific_name: parsedData.scientific_name || currentTarget?.scientific_name || "Unknown",
          image: previewImg.src,
        });

        showToast(
          newlyUnlocked.length
            ? `Match confirmed! 🏆 New badge: ${newlyUnlocked[0].title}`
            : "Match confirmed! Added to your notebook."
        );
      } else {
        verdictCard.className = "rounded-2xl p-5 text-center shadow-sm bg-amber-50 border border-amber-300 text-amber-900";
        verdictCard.innerHTML = `<p class="font-bold text-lg">Not quite — try again</p><p class="text-sm mt-1">That looks more like <strong>${parsedData.common_name || "something else"}</strong>, not today's target (<em>${currentTarget?.common_name || currentTarget?.scientific_name || "your plant"}</em>).</p>`;
        showToast("That doesn't match today's plant yet.");
      }

      verdictCard.classList.remove("hidden");

    } catch (err) {
      loadingCard.classList.add("hidden");
      errorCard.textContent = `Error: ${err.message}. Make sure your backend API key is configured.`;
      errorCard.classList.remove("hidden");
      previewCard.classList.remove("hidden");
    }
  });


  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetView = tab.getAttribute("data-tab");

      navTabs.forEach(t => {
        t.classList.remove("text-[#5E7D5B]");
        t.classList.add("text-slate-400");
        const span = t.querySelector("span");
        if (span) span.classList.remove("font-medium");
      });
      tab.classList.add("text-[#5E7D5B]");
      tab.classList.remove("text-slate-400");
      const activeSpan = tab.querySelector("span");
      if (activeSpan) activeSpan.classList.add("font-medium");

      viewSections.forEach(sec => sec.classList.add("hidden"));
      document.getElementById(`view-${targetView}`).classList.remove("hidden");
    });
  });

  function addToNotebook({ common_name, scientific_name, image }) {
    const speciesCountBefore = notebook.length;
    const idx = notebook.findIndex(
      (n) => n.scientific_name.toLowerCase() === scientific_name.toLowerCase()
    );

    if (idx >= 0) {
      notebook[idx] = { ...notebook[idx], common_name, image, foundAt: Date.now() };
    } else {
      notebook.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        common_name,
        scientific_name,
        image,
        region: user.region,
        foundAt: Date.now(),
      });
    }

    localStorage.setItem("biosnap_notebook", JSON.stringify(notebook));
    renderNotebook();
    renderLeaderboard();

    const newlyUnlocked = ACHIEVEMENTS.filter(
      (a) => speciesCountBefore < a.goal && notebook.length >= a.goal
    );
    renderAchievements();
    return newlyUnlocked;
  }

  function renderNotebook() {
    collectionCountEl.textContent = notebook.length
      ? `${notebook.length} species`
      : "";
    collectionEmptyEl.classList.toggle("hidden", notebook.length > 0);
    collectionGridEl.innerHTML = "";

    notebook
      .slice()
      .sort((a, b) => b.foundAt - a.foundAt)
      .forEach((entry) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className =
          "text-left rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer";
        card.innerHTML = `
          <div class="aspect-square bg-slate-100 overflow-hidden">
            <img src="${entry.image}" alt="${entry.common_name}" class="w-full h-full object-cover" />
          </div>
          <div class="p-2.5">
            <p class="font-bold text-sm text-biosnapDark leading-tight truncate">${entry.common_name}</p>
            <p class="italic text-[11px] text-biosnapMuted truncate">${entry.scientific_name}</p>
          </div>
        `;
        card.addEventListener("click", () => openDetail(entry));
        collectionGridEl.appendChild(card);
      });
  }

  function openDetail(entry) {
    detailSheet.innerHTML = `
      <div class="relative">
        <img src="${entry.image}" alt="${entry.common_name}" class="w-full max-h-72 object-cover bg-slate-100" />
        <button id="detail-close" type="button"
          class="absolute top-3 right-3 bg-biosnapDark/70 text-white text-xs font-mono px-2.5 py-1.5 rounded-full backdrop-blur cursor-pointer">
          close ✕
        </button>
      </div>
      <div class="p-5 space-y-2">
        <p class="font-bold text-2xl text-biosnapDark leading-tight">${entry.common_name}</p>
        <p class="italic text-biosnapMuted">${entry.scientific_name}</p>
        <p class="text-xs font-mono text-biosnapMuted pt-1">found ${new Date(entry.foundAt).toLocaleDateString()}</p>
        <button id="detail-remove" type="button"
          class="w-full border border-slate-200 text-biosnapMuted hover:bg-slate-50 transition text-sm font-medium py-2.5 rounded-xl mt-3 cursor-pointer">
          Remove from notebook
        </button>
      </div>
    `;
    document.getElementById("detail-close").addEventListener("click", closeDetail);
    document.getElementById("detail-remove").addEventListener("click", () => {
      notebook = notebook.filter((n) => n.id !== entry.id);
      localStorage.setItem("biosnap_notebook", JSON.stringify(notebook));
      closeDetail();
      renderNotebook();
      renderAchievements();
      renderLeaderboard();
    });
    detailOverlay.classList.remove("hidden");
  }

  function closeDetail() {
    detailOverlay.classList.add("hidden");
    detailSheet.innerHTML = "";
  }
  detailOverlay.addEventListener("click", (e) => {
    if (e.target === detailOverlay) closeDetail();
  });

  function renderAchievements() {
    const speciesCount = notebook.length;
    const unlockedCount = ACHIEVEMENTS.filter((a) => speciesCount >= a.goal).length;
    achievementProgressEl.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length} Unlocked`;

    achievementsGridEl.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = speciesCount >= a.goal;
      const card = document.createElement("div");
      card.className = `rounded-2xl bg-white border p-4 flex items-center gap-4 shadow-sm ${
        unlocked ? "border-[#7A9A77]" : "border-slate-200"
      }`;
      card.innerHTML = `
        <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-xl ${
          unlocked ? "bg-[#7A9A77]/15 text-[#5E7D5B]" : "bg-slate-100 text-slate-400"
        }">${a.icon}</div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-biosnapDark text-base">${a.title}</p>
          <p class="text-xs text-biosnapMuted">${a.description}</p>
          ${!unlocked ? `<p class="text-[11px] font-mono text-slate-400 mt-1">${speciesCount} / ${a.goal}</p>` : ""}
        </div>
        <span class="text-xs font-mono px-2 py-1 rounded shrink-0 ${
          unlocked ? "bg-[#7A9A77]/15 text-[#5E7D5B] font-medium" : "text-slate-400 bg-slate-100"
        }">${unlocked ? "Unlocked" : "Locked"}</span>
      `;
      achievementsGridEl.appendChild(card);
    });
  }

  function renderLeaderboard() {
    if (!leaderboardListEl || !user) return;

    const entries = [
      ...FAKE_NEIGHBORS,
      { username: user.username, species: notebook.length, isUser: true },
    ].sort((a, b) => b.species - a.species || a.username.localeCompare(b.username));

    leaderboardListEl.innerHTML = "";
    entries.forEach((entry, i) => {
      const unlockedCount = ACHIEVEMENTS.filter((a) => entry.species >= a.goal).length;
      const level = Math.max(1, unlockedCount);

      const row = document.createElement("div");
      row.className = `p-4 flex items-center justify-between ${
        entry.isUser ? "bg-[#7A9A77]/10" : ""
      }`;
      row.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="font-mono ${
            entry.isUser ? "text-[#5E7D5B]" : "text-biosnapMuted"
          } font-bold text-sm">${i + 1}</span>
          <div>
            <p class="font-bold text-biosnapDark">${entry.username}${
        entry.isUser
          ? ' <span class="text-[11px] font-mono text-[#5E7D5B]">(You)</span>'
          : ""
      }</p>
            <p class="text-[11px] font-mono text-biosnapMuted">${entry.species} species found</p>
          </div>
        </div>
        <span class="bg-[#7A9A77]/15 text-[#5E7D5B] text-xs font-mono px-2.5 py-1 rounded-full font-medium">Level ${level}</span>
      `;
      leaderboardListEl.appendChild(row);
    });
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
  }
});