import { addonBuilder } from "stremio-addon-sdk";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const ngrokStreamURL = process.env.STREAM_SERVER_URL; // Public URL of your stream server

// Manifest for the add-on
const manifest = {
    "id": "community.speculativestreamaddon",
    "version": "1.0.0",
    "name": "Speculative Stream Addon",
    "description": "Fetches torrents and streams dynamically.",
    "resources": [
        "stream"
    ],
    "types": [
        "movie"
    ],
    "idPrefixes": [
        "tt"
    ],
    "catalogs": [
        {
            "type": "movie",
            "id": "speculative_movies",
            "name": "Speculative Movies",
            "enabled": true,
            "extra": [
                {
                    "info": "This catalog dynamically adds speculative movies"
                }
            ]
        }
    ]
};

const builder = new addonBuilder(manifest);

// Torrent Search Function
async function searchTorrents(query) {
  try {
    // Example API: Replace with a real torrent search API
    const response = await axios.get(
      `https://yts.mx/api/v2/list_movies.json?query_term=${query}`
    );
    const movies = response.data.data.movies;

    // Map movies to torrent links
    const torrents = movies.flatMap((movie) =>
      movie.torrents.map((torrent) => ({
        name: `${movie.title} [${torrent.quality}]`,
        magnet: `magnet:?xt=urn:btih:${torrent.hash}`,
      }))
    );

    return torrents;
  } catch (err) {
    console.error("Torrent search failed:", err);
    return [];
  }
}

// Stream Handler
builder.defineStreamHandler(async (args) => {
  const { id } = args; // IMDB ID of the movie
  const searchQuery = id; // Simplistic: Use IMDB ID as the search term

  console.log(`Searching torrents for: ${searchQuery}`);

  const torrents = await searchTorrents(searchQuery);

  // Create Stremio-compatible stream links
  const streams = torrents.map((torrent) => ({
    name: "Custom Stream Server",
    title: torrent.name,
    url: `${ngrokStreamURL}/stream?torrent=${encodeURIComponent(torrent.magnet)}`,
  }));

  return { streams };
});

// Catalog Handler (required for the manifest definition)
builder.defineCatalogHandler(async (args) => {
  const { type, id } = args;

  if (type === "movie" && id === "speculative_movies") {
    // You could dynamically fetch or filter movies for your catalog
    const torrents = await searchTorrents("speculative movies");

    return {
      metas: torrents.map((torrent) => ({
        id: torrent.magnet, // Use the magnet as the movie ID
        name: torrent.name, // Movie name
        poster: "https://via.placeholder.com/150", // You can add an actual poster URL
        type: "movie", // The type is movie for this catalog
      })),
    };
  }

  return { metas: [] };
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
  return addonInterface(req, res, next); // Properly use the addon interface
});

// Start the server
app.listen(7000, () => {
  console.log("Addon listening on http://localhost:7000");
});
