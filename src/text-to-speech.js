const fetch = require("node-fetch");

const VOICES = [
  "Brian",
  "Ivy",
  "Justin",
  "Russell",
  "Nicole",
  "Emma",
  "Amy",
  "Joanna",
  "Salli",
  "Kimberly",
  "Kendra",
  "Joey",
];

async function getAudioURL({ voice, text }) {
  const response = await fetch("https://streamlabs.com/ninja/speak", {
    method: "POST",
    body: JSON.stringify({
      voice,
      text,
    }),
    headers: {
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (response.status !== 200) {
    throw new Error(`Something went wrong (${response.statusText})`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error);
  }

  if (!json.success) {
    throw new Error(
      "Something went wrong getting text-to-speech audio URL"
    );
  }

  return json.speak_url;
}

async function getAudioURLs(text) {
  const randomVoice =
    VOICES[Math.floor(Math.random() * VOICES.length)];
  return getAudioURL({ voice: randomVoice, text });
}

module.exports = getAudioURLs;
