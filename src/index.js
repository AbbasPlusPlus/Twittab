const axios = require("axios");

$main = document.getElementById("main");
$options = document.getElementById("options");
$titleMain = document.getElementById("titleMain");
$titleSub = document.getElementById("titleSub");
const form = document.querySelector("form");

const manifest = chrome.runtime.getManifest();

const bearerToken = manifest.bearerToken;

async function getRequest(userID) {
  const res = await axios.get(
    `https://api.twitter.com/2/users/by?usernames=${userID}`,
    {
      headers: {
        // "User-Agent": "v2UserLookupJS",
        authorization: `Bearer ${bearerToken}`,
      },
    }
  );

  if (res.data) {
    return res.data;
  } else {
    console.log("get request erorr", res);
    titleMain.innerHTML = res;
    throw new Error("Unsuccessful request");
  }
}

async function getID(userID) {
  try {
    // Make request
    const response = await getRequest(userID);
    getUserID = response.data[0]["id"];
    chrome.storage.local.set({ userName: userID }, function () {
      console.log("USername saved");
    });
    return getUserID;
  } catch (e) {
    console.log("get ID error", e);
    titleMain.innerHTML = "Error: " + e.message;
    titleSub.innerHTML = "Going back to previous twitter account.";
    process.exit();
  }
}

const getUserTweets = async (userID) => {
  let userTweets = [];

  // we request the author_id expansion so that we can print out the user name later
  let params = {
    max_results: 100,
    exclude: "retweets,replies",
    expansions: "author_id",
  };

  const options = {
    headers: {
      authorization: `Bearer ${bearerToken}`,
    },
  };

  let hasNextPage = true;
  let nextToken = null;
  let userName;
  console.log("Retrieving Tweets...");

  while (hasNextPage) {
    let resp = await getPage(params, options, nextToken, userID);
    if (
      resp &&
      resp.meta &&
      resp.meta.result_count &&
      resp.meta.result_count > 0
    ) {
      userName = resp.includes.users[0].username;
      if (resp.data) {
        userTweets.push.apply(userTweets, resp.data);
      }
      if (resp.meta.next_token) {
        nextToken = resp.meta.next_token;
      } else {
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }
  }

  let allTweets = userTweets.map((a) => a.text);
  chrome.storage.local.set({ allTweets: allTweets }, function () {
    console.log("Array saved");
  });
};

const getPage = async (params, options, nextToken, userID) => {
  if (nextToken) {
    params.pagination_token = nextToken;
  }

  try {
    const getTweetsURL = `https://api.twitter.com/2/users/${userID}/tweets`;
    const resp = await axios.get(getTweetsURL, {
      params: params,
      headers: options.headers,
    });

    if (resp.status !== 200) {
      console.log(`${resp.status} ${resp.statusText}: ${resp.data}`);
      return;
    }
    return resp.data;
  } catch (err) {
    console.log("getpage error", err);
    throw new Error(`Request failed: ${err}`);
  }
};

function displayTweets(userName) {
  getID(userName).then((result) => {
    getUserTweets(result);
  });
}

async function getLocalTweets() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("allTweets", function (items) {
      allTweets = items.allTweets;
      return resolve(allTweets);
    });
  });
}

async function getLocalUserName() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("userName", function (items) {
      userName = items.userName;
      return resolve(userName);
    });
  });
}

const getRandomTweet = async () => {
  const allTweets = await getLocalTweets();
  let maxTweets = allTweets.length;
  randomNumber = Math.floor(Math.random() * maxTweets) + 1;
  titleMain.innerHTML = allTweets[randomNumber];

  const userName = await getLocalUserName();
  titleSub.innerHTML = "@" + userName;
};

async function init() {
  form.addEventListener("submit", async (event) => {
    try {
      event.preventDefault();
      titleMain.innerHTML = "loading...";

      const userName = document.querySelector("#userName").value;
      titleSub.innerHTML = "";

      await displayTweets(userName);

      setTimeout(function () {
        window.location.reload(); // you can pass true to reload function to ignore the client cache and reload from the server
      }, 6000);
    } catch (err) {
      throw new Error(`Request failed: ${err}`);
    }
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
      getRandomTweet();

      const userName = await getLocalUserName();
      titleSub.innerHTML = "@" + userName;
    }
  });

  const settingsDefault = {
    titleMain: "Double click the background to enter a username",
    titleSub: "Double click the background to enter a username",
  };

  let settings = { ...settingsDefault };

  async function loadSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(settings, (items) => {
        settings = { ...items };
        return resolve(items);
      });
    });
  }

  async function restoreOptions() {
    await loadSettings();
    console.log(`settings:`, settings);
    $titleMain.innerHTML = settings.titleMain;
    $titleSub.innerHTML = settings.titleSub;
  }
  await restoreOptions();

  function openOptions(e) {
    e.preventDefault();
    e.stopPropagation();
    $options.style.display = "block";
    document
      .querySelector("#closeOptions")
      .addEventListener("click", () => ($options.style.display = "none"));
  }

  $main.addEventListener("dblclick", openOptions);
}

init();
