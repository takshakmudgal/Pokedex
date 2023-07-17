require("dotenv").config();
/* Bring in the external packages we'll be using.

Axios is an HTTP client that makes working with APIs easier: https://axios-http.com/docs/intro

Additionally, we bring in the Notion API client so we can make requests to it. */
const axios = require("axios");
const { Client } = require("@notionhq/client");

/* Create a new object 'notion' that gives our code access to the Notion credentials set up in the .env file */
const notion = new Client({ auth: process.env.NOTION_KEY });

/* Create a blank array in which we'll store an object for each pokemon fetched from the PokeAPI */
const pokeArray = [];

/* Create a function for making requests to the PokeAPI. We have to use an asynchronous function becuause axios.get() returns a Promise. 

Without using an async function, the rest of our code would run before axios gets a response from the PokeAPI. */
async function getPokemon() {
  /* Define start and end variables for the 'for' loop below. 
  
  These numbers would usually be set directly in the for loop itself, but I've made them into their own variables so you can easily tweak them. 
  
  They correspond to actual Pokemon numbers - e.g. 1 = bulbasaur. */
  const start = 1;
  const end = 10;

  /* This 'for' loop will make the first set of requests to the PokeAPI.
  
  We're using a basic 'for (let i = num)' loop because i will correspond to specific Pokemon numbers. So if you only wanted the original 151, you'd set start at 1 and end at 151. */
  for (let i = start; i <= end; i++) {
    /* Use the axios.get() method to make a GET request to the PokeAPI's 'pokemon' endpoint: https://pokeapi.co/docs/v2#pokemon
    
    This endpoint allows to to access MOST of the information we need. The only info we can't get from this endpoint is flavor text, generation #, and category (e.g. "Flame Pokemon"). For that info, we'll have to query the 'pokemon-species' endpoint later on. 
    
    Note how we're using a template literal in order to pass our `i` variable's value into the URL.    This is what will allow us to call PokeAPI for the correct pokemon on each run of the loop, e.g. https://pokeapi.co/api/v2/pokemon/4 (when i = 4) will get Charmander. */
    const poke = await axios
      .get(`https://pokeapi.co/api/v2/pokemon/${i}`)
      .then((poke) => {
        /* Pokemon have a variable number of types (some have 1, some have 2). The Notion API expects Multi-Select property selections to come in the form of an array of objects, so we need to create an array of objects that we can pass when we're setting the 'Type' Multi-Select property's values. 
      
      First, we store the types array from PokeAPI in the typesRaw variable. */
        const typesRaw = poke.data.types;

        /* Now we'll create a blank array that will contain our type objects, which will be formated specifically so they'll work with the Notion  API. */
        const typesArray = [];

        /*  Create a for...of loop that will loop through all the elements of typesRaw. 
      
      For each one, we'll create an object 'typeObj' which is formatted as needed for the Notion API, which which contains ONE of the Pokemon's types. Since the number of loop iterations is defined by the length of the typesRaw array, we'll end up with a new array (typesArray) that contains an object for each of the Pokemon's types. 
      
      E.G. - Butterfree is Bug-type and Flying-type, so its typesArray will have two elements. */
        for (let type of typesRaw) {
          const typeObj = {
            name: type.type.name,
          };

          /* Add the object onto the end of typesArray */
          typesArray.push(typeObj);
        }

        /* The PokeAPI returns very basic formatting for Pokemon names - e.g. 'Mr. Mime' is formatted as 'mr-mime'. We want to show names with proper punctuation and capitalization in Notion - e.g. 'Mr. Mime'. 
      
      This is also important for auto-generating links to Bulbapedia, where more information about each Pokemon can be found (this is a basic Pokedex that doesn't include move information, locations, etc.)
      
      To accomplish this, we're running the poke.data.species.name object through several functions. First, the split().map().join() combo capitalizes the first letter of each word - e.g. 'mr-mime' becomes 'Mr Mime'.
      
      When methods are chained like this, they are executed left-to-right. So the return value of split() is fed into map(), and map()'s return value is fed into join(). 
      
      Then, we run that result through a gauntlet of replace() calls to deal with edge case Pokemon like Type: Null, Ho-Oh, Mr. Mime, and Nidoran♀ - all of which include punctuation or symbols. Each replace() call looks for a regular expression match and replaces the first one it finds with the next argument. */
        const processedName = poke.data.species.name
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

        /* Define a variable that holds the bulbapedia URL for the Pokemon. Bulbapedia has a very standardized URL scheme for Pokemon, so all we need to do is pass in the processedName variable and then replace any space characters it contains with underscores. 
      
      All other special characters are left in the URL - even :,é,-,etc.
      
      Example URL: https://bulbapedia.bulbagarden.net/wiki/Mr._Mime_(Pokémon) */
        const bulbURL = `https://bulbapedia.bulbagarden.net/wiki/${processedName.replace(
          " ",
          "_"
        )}_(Pokémon)`;

        /* Here we're defining a variable for the sprite using ternary syntax (? and : ) to create a conditional statement. 
      
      We need to do this because certain Gen VIII Pokemon were introduced in Pokemon Legends: Arceus and do not have a sprite. The PokeAPI has an 'official-artwork' image for EVERY Pokemon, so we'll set the value of sprite to 'official-artwork' if a 'front_default' sprite doesn't exist. 
      
      (!poke.data.sprites.front_default) is a Boolean check; if the value of this object is null, it'll evaluate to false. */
        const sprite = !poke.data.sprites.front_default
          ? poke.data.sprites.other["official-artwork"].front_default
          : poke.data.sprites.front_default;

        /* Now we'll construct the object that will hold all of the data about this Pokemon. If you recall, we aren't able to pull generation, flavor text, or category from PokeAPI's 'pokemon' endpoint, so we'll add those to this object later. 
      
      For now, each object property is being set to the value of the corresponding property returned from our first PokeAPI call. 
      
      Note how ['official-artwork'] is defined differently. Property key names with dashes or spaces must be called using 'bracket notation' rather than 'dot notation'. */
        const pokeData = {
          name: processedName,
          number: poke.data.id,
          types: typesArray,
          height: poke.data.height,
          weight: poke.data.weight,
          hp: poke.data.stats[0].base_stat,
          attack: poke.data.stats[1].base_stat,
          defense: poke.data.stats[2].base_stat,
          "special-attack": poke.data.stats[3].base_stat,
          "special-defense": poke.data.stats[4].base_stat,
          speed: poke.data.stats[5].base_stat,
          sprite: sprite,
          artwork: poke.data.sprites.other["official-artwork"].front_default,
          bulbURL: bulbURL,
        };

        /* Send a log to the console with each fetched Pokemon's name. Doing this will allow the console to show activity the whole time the script is running. Without it, you'll just see a blank spot in your console while the script takes minutes to run. */
        console.log(`Fetched ${pokeData.name}.`);

        /* Push our pokeData object onto the end of the pokeArray array. This is done each time our loop executes, resulting in an array full of objects - one for each Pokemon that you included in the loop (using the start and end numbers).
      
      Each object will look just like the pokeData object definition above, except the properties will contain actual information. If you want to see how these look, add console.log(pokeData) above this line. */
        pokeArray.push(pokeData);
      })
      .catch((error) => {
        /* if axios.get() fails and throws an error, this catch block will catch it and log it in the console. */
        console.log(error);
      });
  }

  /* We now need to call another PokeAPI endpoint to get three more pieces of information about each Pokemon:    - Flavor text (e.g. "Spits fire that is hot enough to melt boulders. Known to cause forest fires unintentionally.")  - Generation (e.g. I, II, III...)  - Category (e.g. "Flame Pokemon", "Owl Pokemon")
  
  These must be obtained from the pokemon-species endpoint (https://pokeapi.co/docs/v2#pokemon-species)
  
  We now have all of the Pokemon we'll sent to Notion in pokeArray, so we'll now use a for...of loop to loop through that array,  get the 'species' info for each element from PokeAPI, and add each piece of info to that pokemon's object in pokeArray. */
  for (let pokemon of pokeArray) {
    /* Just like we did above, here we use axios.get() to call the PokeAPI endpoint we want. Note that this time we're passing the pokemon.number property from the current element of pokeArray (which is stored in the pokemon variable created in this loop) into the PokeAPI URL. */
    const flavor = await axios
      .get(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.number}`)
      .then((flavor) => {
        /* Create a variable to store the pokemon's flavor text. Depending on the pokemon, PokeAPI will have a differing number of flavor text options. These are all stored in an array called flavor_text_entries, and the English-language flavor text might be at any one of the indexes.
        
        See for yourself: Go to pokeapi.co and enter 'pokemon-species/charmander' in the testing box. Array index 0 (the first one) contains English-language flavor text. 
        
        However, try 'pokemon-species/cramorant' and you'll see that the English flavor text doesn't show up until Array index 7. 
        
        So instead of calling a specific array index, we have to search deeply inside the array's objects to find the one that has a 'language' object, which itself contains a 'name' property with a value of 'en'. 
        
        To accomplish this, we call the find() method on the flavor_text_entries array, which returns the first array element that satisfies a test condition we'll set up though a function. 
        
        That function is name === 'en'. To make sure the value of the nested 'name' property is fed into the function as the 'name' varible, we do what is called nested object destructuring. ({language: { name }}) tells find() that for each array element, go into its language object, then into the name property nested within, and pass name's value as the variable for the function.   
        
        find() returns the full array element that matches the test condition, so we then tack on `.flavor_text` to get the value of its flavor_text property.
        
        Finally, we pass the found value through replace(/\n|\f|\r/g, " ") to replace any newline characters with spaces, resulting in a single line of flavor text. */
        const flavorText = flavor.data.flavor_text_entries
          .find(({ language: { name } }) => name === "en")
          .flavor_text.replace(/\n|\f|\r/g, " ");

        /* Here we do the exact same thing as was done with the flavorText variable, except for the 'genus' property, which is PokeAPI's term for the category - e.g. "Flame Pokemon" */
        const category = flavor.data.genera.find(
          ({ language: { name } }) => name === "en"
        ).genus;

        /* Now we get the pokemon's generation. It is returned in this format: 'generation-i' - but we want it to simply be 'I', so we run the result through split(/-/), which splits the string into an array using the dash character (-) as the divider.
        
        Then we use pop() to "pop" the last element of that array off of the array and return it - this will always be the generation number in Roman numerals, e.g. 'iv'. Finally, we pass that value through toUpperCase() to capitalize it - e.g. 'IV'. */
        const generation = flavor.data.generation.name
          .split(/-/)
          .pop()
          .toUpperCase();

        /* Now we add our three new pieces of information to the current pokemon's object by creating three new properties within that object, and then assigning them the values from our three variables above.
        
        Note how pokemon['flavor-text'] uses bracket notation; this is required when an object property name has or will have spaces, dashes, or other special characters in it. Dot notation can only be used when property names contain letters, numbers, and underscores. */
        pokemon["flavor-text"] = flavorText;
        pokemon.category = category;
        pokemon.generation = generation;

        /* Add a log entry in the console each time this information is fetched from PokeAPI. */
        console.log(`Fetched flavor info for ${pokemon.name}.`);
      })
      .catch((error) => {
        /* Log any errors thrown by axios.get(), just as in the previous loop block. */
        console.log(error);
      });
  }

  /* Once both loops have finished running, we call the createNotionPage() function which is defined below. It's important to note that we're calling this function within the getPokemon() function. 
  
  Since getPokemon() is an async function, calling createNotionPage() outside of it (in the global context) will cause createNotionPage() to run before getPokemon() can finish construcing its array of objects.
  
  Calling it here forces createNotionPage() to run only after our two loops have completely finished fetching and formatting the data from PokeAPI. */
  createNotionPage();
}

/* Here's where we actually call the getPokemon() function. When you type `node index.js` in the Terminal to run this script, it immediately runs this function, which kicks off everything else.

Note how we've defined additional functions below this; these are totally fine to exist below this line because JavaScript "hoists"function definitions to the top when it actually runs a .js file. Look up "JavaScript Hoisting" to learn more about this. */
getPokemon();

/* Create a "wait" function to comply with Notion API rate-limiting. 

The Notion API only allows ~3 requests per second, so after we create each new page in our Notion database, we'll call this sleep function and have it wait for 300ms. This will ensure that our app doesn't try to send data to Notion too quickly, which would cause our calls to eventually fail. */
const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/* Create a function for sending our data to the Notion API. As with getPokemon(), this function has to be async because it is using axios.get(), which is an asynchronous method that returns a Promise first. Therefore, we must await it, and to do that it has to be inside an async function. */
async function createNotionPage() {
  /* Here's our main loop for the process of sending data to Notion. We already have our array of pokemon objects (pokeArray), so we can use a for...of loop to iterate through it. 
  
  For each element, we'll construct a new object that formats the data in the way   Notion wants. Then we'll create a new page in our Notion database with that data. */
  for (let pokemon of pokeArray) {
    /* Here we'll construct the data object that we'll send to Notion in order to create a new page. This object defines the database in which the page will live (the "parent") and sets its icon, cover, and property values. It also adds a few blocks to the page's body, including the flavor text and a link to the pokemon's Bulbapedia page.
    
    I won't verbosely comment every piece of this object definition. Instead, I'll encourage you to study it and also point you to a few reference pages that you'll fine invaluable for working with the Notion API: 
    
    - Property Values: https://developers.notion.com/reference/property-value-object 
    - Block Objects: https://developers.notion.com/reference/block 
    - Create a Page: https://developers.notion.com/reference/post-page 
    
    Note how, for each block, we're setting the relevant property values to the variables in our pokemon object (except for     the database ID, which is set by process.env.NOTION_DATABASE_ID).
    
    It's also useful to note that EVERYTHING in Notion is a block. The 'data' object will end up being a block that is recognized by Notion as a page due to the 'parent' value we're giving it (a database), and due to the fact that we're using the notion.pages.create() method to create it.
    
    However, you can see below that this block has children, which are blocks that will show up as its page content. Note that you can create 'block children' under nearly any block - not just under a page!
    
    See more: https://developers.notion.com/reference/patch-block-children */
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
            url: pokemon.bulbURL,
          },
        },
      ],
    };

    /*  Here we call our sleep() function, passing it a value of 300 so that the loop "sleeps" for 300ms before going onto the next cycle. This ensures that we respect the Notion API's rate limit of ~3 requests per second. */
    await sleep(300);

    /* Finally, we actually create the new page in our Notion database. First, we add a log item to the console for our own benefit. 
    
    Then we call the notion.pages.create() function, which creates a new page in our database. We pass it our data object (defined above), which contains all of the necessary information.
    
    Finally, we store the Notion API's response in the response variable, and log it. */
    console.log(`Sending ${pokemon.name} to Notion`);
    const response = await notion.pages.create(data);
    console.log(response);
  }

  /* When the entire process is done, this will simply print "Operation Complete" in the console. */
  console.log(`Operation complete.`);
}
