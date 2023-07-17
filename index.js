const dotenv = require("dotenv");
const axios = require("axios");
const { Client } = require("@notionhq/client");

dotenv.config();

const notionClient = new Client({ auth: process.env.NOTION_KEY });

const pokemonArray = [];

async function fetchPokemonData() {
  const startNumber = 1;
  const endNumber = 1010;

  for (let i = startNumber; i <= endNumber; i++) {
    const pokemonData = await axios
      .get(`https://pokeapi.co/api/v2/pokemon/${i}`)
      .then((response) => {
        const typesRaw = response.data.types;
        const typesArray = [];

        for (let type of typesRaw) {
          const typeObject = {
            name: type.type.name,
          };

          typesArray.push(typeObject);
        }

        const processedName = response.data.species.name
          .split(/-/)
          .map((name) => {
            return name[0].toUpperCase() + name.substring(1);
          })
          .join(" ")
          .replace(/^Mr M/, "Mr. M")
          .replace(/^Mime Jr/, "Mime Jr.")
          .replace(/^Mr R/, "Mr. R")
          .replace(/mo O/, "mo-o")
          .replace(/Porygon Z/, "Porygon-Z")
          .replace(/Type Null/, "Type: Null")
          .replace(/Ho Oh/, "Ho-Oh")
          .replace(/Nidoran F/, "Nidoran♀")
          .replace(/Nidoran M/, "Nidoran♂")
          .replace(/Flabebe/, "Flabébé");

        const bulbapediaURL = `https://bulbapedia.bulbagarden.net/wiki/${processedName.replace(
          " ",
          "_"
        )}_(Pokémon)`;

        const sprite = !response.data.sprites.front_default
          ? response.data.sprites.other["official-artwork"].front_default
          : response.data.sprites.front_default;

        const pokemonObject = {
          name: processedName,
          number: response.data.id,
          types: typesArray,
          height: response.data.height,
          weight: response.data.weight,
          hp: response.data.stats[0].base_stat,
          attack: response.data.stats[1].base_stat,
          defense: response.data.stats[2].base_stat,
          "special-attack": response.data.stats[3].base_stat,
          "special-defense": response.data.stats[4].base_stat,
          speed: response.data.stats[5].base_stat,
          sprite: sprite,
          artwork:
            response.data.sprites.other["official-artwork"].front_default,
          bulbapediaURL: bulbapediaURL,
        };

        pokemonArray.push(pokemonObject);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  for (let pokemon of pokemonArray) {
    const flavorData = await axios
      .get(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.number}`)
      .then((response) => {
        const flavorText = response.data.flavor_text_entries
          .find(({ language: { name } }) => name === "en")
          .flavor_text.replace(/\n|\f|\r/g, " ");

        const category = response.data.genera.find(
          ({ language: { name } }) => name === "en"
        ).genus;

        const generation = response.data.generation.name
          .split(/-/)
          .pop()
          .toUpperCase();

        pokemon["flavor-text"] = flavorText;
        pokemon.category = category;
        pokemon.generation = generation;
      })
      .catch((error) => {
        console.log(error);
      });
  }

  createNotionPage();
}

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

async function createNotionPage() {
  for (let pokemon of pokemonArray) {
    const data = {
      parent: {
        type: "database_id",
        database_id: process.env.NOTION_DATABASE_ID,
      },
      icon: {
        type: "external",
        external: {
          url: pokemon.sprite,
        },
      },
      cover: {
        type: "external",
        external: {
          url: pokemon.artwork,
        },
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: pokemon.name,
              },
            },
          ],
        },
        Category: {
          rich_text: [
            {
              type: "text",
              text: {
                content: pokemon.category,
              },
            },
          ],
        },
        No: {
          number: pokemon.number,
        },
        Type: {
          multi_select: pokemon.types,
        },
        Generation: {
          select: {
            name: pokemon.generation,
          },
        },
        Sprite: {
          files: [
            {
              type: "external",
              name: "Pokemon Sprite",
              external: {
                url: pokemon.sprite,
              },
            },
          ],
        },
        Height: { number: pokemon.height },
        Weight: { number: pokemon.weight },
        HP: { number: pokemon.hp },
        Attack: { number: pokemon.attack },
        Defense: { number: pokemon.defense },
        "Sp. Attack": { number: pokemon["special-attack"] },
        "Sp. Defense": { number: pokemon["special-defense"] },
        Speed: { number: pokemon.speed },
      },
      children: [
        {
          object: "block",
          type: "quote",
          quote: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: pokemon["flavor-text"],
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "View This Pokémon's Entry on Bulbapedia:",
                },
              },
            ],
          },
        },
        {
          object: "block",
          type: "bookmark",
          bookmark: {
            url: pokemon.bulbapediaURL,
          },
        },
      ],
    };

    await sleep(300);

    const response = await notionClient.pages.create(data);
    console.log(response);
  }

  console.log(`Operation complete.`);
}

fetchPokemonData();
