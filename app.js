const songs = [
  {
    id: "pop-01",
    title: "Neon Skyline",
    artist: "Luna Rivers",
    genre: "pop",
    mood: "Shimmer pop",
    description: "A driving synth hook with breezy vocals tailor-made for road trips.",
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    accent: "linear-gradient(120deg, #ff69b4, #ffa6ff)",
  },
  {
    id: "pop-02",
    title: "Daydream Static",
    artist: "Echo Bloom",
    genre: "pop",
    mood: "Alt electro-pop",
    description: "Glittering arpeggios, a bass drop that sneaks up, and a soaring hook.",
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    accent: "linear-gradient(120deg, #ffd86f, #ff9a9e)",
  },
  {
    id: "pop-03",
    title: "Velvet Hour",
    artist: "Mira K",
    genre: "pop",
    mood: "Slow-burn pop",
    description: "Lush vocal stacks over a warm low-end perfect for unwinding.",
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    accent: "linear-gradient(120deg, #70e1f5, #ffd194)",
  },
  {
    id: "rock-01",
    title: "Midnight Riot",
    artist: "The Static Hearts",
    genre: "rock",
    mood: "Indie rock",
    description: "Crunchy guitars, kinetic drums, and a cathartic sing-along chorus.",
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    accent: "linear-gradient(120deg, #00c6ff, #0072ff)",
  },
  {
    id: "rock-02",
    title: "Embers",
    artist: "Wild Parade",
    genre: "rock",
    mood: "Anthemic rock",
    description: "Slow-build verses erupt into a wall-of-sound finale.",
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    accent: "linear-gradient(120deg, #f5576c, #f093fb)",
  },
    {
      id: "rock-03",
      title: "Voltage Bloom",
      artist: "Satellite Riot",
      genre: "rock",
      mood: "Alt-grunge",
      description: "Fuzzy riffs and tight grooves inspired by late-90s power trios.",
      audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      accent: "linear-gradient(120deg, #1d976c, #93f9b9)",
    },
    {
      id: "pop-04",
      title: "Chrome Confetti",
      artist: "Nova Shift",
      genre: "pop",
      mood: "Hyperpop rush",
      description: "Compressed beats, vocoder swells, and a euphoric post-chorus drop.",
      audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
      accent: "linear-gradient(120deg, #f6d365, #fda085)",
    },
    {
      id: "pop-05",
      title: "Halogen Bloom",
      artist: "City Arcade",
      genre: "pop",
      mood: "Retro wave",
      description: "Glass-pad chords and neon-soaked leads that build a late-night pulse.",
      audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
      accent: "linear-gradient(120deg, #5ee7df, #b490ca)",
    },
    {
      id: "rock-04",
      title: "Glassland Run",
      artist: "Northern Lanes",
      genre: "rock",
      mood: "Post-rock drift",
      description: "Delay-washed guitars crescendo into a cinematic, thunderous climax.",
      audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
      accent: "linear-gradient(120deg, #667eea, #764ba2)",
    },
    {
      id: "rock-05",
      title: "Engine Ember",
      artist: "Voltage Ferry",
      genre: "rock",
      mood: "Blues-rock grit",
      description: "Slide riffs, stomping drums, and a gravelly vocal swagger.",
      audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
      accent: "linear-gradient(120deg, #ffafbd, #ffc3a0)",
    },
];

const gridEl = document.getElementById("music-grid");
const template = document.getElementById("card-template");
const filterButtons = document.querySelectorAll(".pill");

function renderSongs(filter = "all") {
  gridEl.innerHTML = "";
  const filtered = filter === "all" ? songs : songs.filter((song) => song.genre === filter);

  filtered.forEach((song) => {
    const card = template.content.cloneNode(true);
    const badge = card.querySelector(".card__badge");
    const genre = card.querySelector(".card__genre");
    const title = card.querySelector(".card__title");
    const artist = card.querySelector(".card__artist");
    const description = card.querySelector(".card__description");
    const audio = card.querySelector(".card__audio");
    const source = audio.querySelector("source");

    badge.style.background = song.accent;
    genre.textContent = `${song.genre.toUpperCase()} • ${song.mood}`;
    title.textContent = song.title;
    artist.textContent = song.artist;
    description.textContent = song.description;
    source.src = song.audio;
    audio.load();
    audio.setAttribute("aria-label", `${song.title} by ${song.artist}`);

    gridEl.appendChild(card);
  });

  if (!filtered.length) {
    gridEl.innerHTML = `
      <p class="empty-state">
        No tracks yet. Try a different filter.
      </p>
    `;
  }
}

function handleFilterClick(event) {
  const { filter } = event.target.dataset;
  if (!filter) return;

  filterButtons.forEach((button) => button.classList.remove("pill--active"));
  event.target.classList.add("pill--active");
  renderSongs(filter);
}

filterButtons.forEach((button) => button.addEventListener("click", handleFilterClick));
renderSongs();
