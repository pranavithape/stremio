import { addonBuilder } from "stremio-addon-sdk";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const ngrokStreamURL = process.env.STREAM_SERVER_URL; // Your stream server URL

// Manifest for the add-on
const manifest = {
  id: "community.speculativestreamaddon",
  version: "1.0.0",
  name: "Speculative Stream Addon",
  description: "Fetches torrents and streams dynamically.",
  resources: ["stream"],
  types: ["movie"],
  idPrefixes: ["tt"],
  catalogs: [
    {
      type: "movie",
      id: "speculative_movies",
      name: "Speculative Movies",
    },
  ],
};

// Create an instance of the addon
const builder = new addonBuilder(manifest);

// Torrent Search Function
async function searchTorrents(query) {
  try {
    const response = await axios.get(
      `https://yts.mx/api/v2/list_movies.json?query_term=${query}`
    );
    const movies = response.data.data.movies;
    return movies.flatMap((movie) =>
      movie.torrents.map((torrent) => ({
        name: `${movie.title} [${torrent.quality}]`,
        magnet: `magnet:?xt=urn:btih:${torrent.hash}`,
      }))
    );
  } catch (err) {
    console.error("Torrent search failed:", err);
    return [];
  }
}

// Define Catalog Handler
builder.defineCatalogHandler(async (args) => {
  const { type, id } = args;

  if (type === "movie" && id === "speculative_movies") {
    const torrents = await searchTorrents("speculative movies");
    return {
      metas: torrents.map((torrent) => ({
        id: torrent.magnet,
        name: torrent.name,
        poster: "url_to_poster_image",
      })),
    };
  }

  return { metas: [] };
});

// Define Stream Handler
builder.defineStreamHandler(async (args) => {
  const { id } = args;
  const torrents = await searchTorrents(id);

  return {
    streams: torrents.map((torrent) => ({
      name: "Custom Stream Server",
      title: torrent.name,
      url: `${ngrokStreamURL}/stream?torrent=${encodeURIComponent(
        torrent.magnet
      )}`,
    })),
  };
});

// Create the add-on interface
const addonInterface = builder.getInterface();

// Set up express server to handle requests
const app = express();

// Serve the manifest.json file at the root
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

// Add-on Interface Middleware
app.use("/stremio", (req, res, next) => {
  return addonInterface(req, res, next);
});

// Start the server
app.listen(7000, () => {
  console.log("Addon listening on http://localhost:7000");
});
